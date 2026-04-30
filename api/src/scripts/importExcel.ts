/**
 * Importa datos del Excel Inventario_Rrey_v4.xlsx a la base de datos.
 * Uso: npm run import:excel --workspace=api
 */
import * as XLSX from "xlsx";
import { PrismaClient, MaterialType } from "@prisma/client";
import * as path from "path";

const prisma = new PrismaClient();

const TYPE_MAP: Record<string, MaterialType> = {
  LUPULO: "LUPULO",
  MALTA: "MALTA",
  YEAST: "YEAST",
  ADJUNTO: "ADJUNTO",
  OTRO: "OTRO",
  FILTRACIÓN: "OTRO",
  FILTRACION: "OTRO",
  PROPAGACIÓN: "OTRO",
};

const SUPPLIER_MAP: Record<string, string> = {
  "Principal (P1)": "P1",
  "República/HAAS (P2)": "P2",
  "Lallemand/WL (P3)": "P3",
  "Emergencia A (P4)": "P4",
  "Emergencia B (P5)": "P5",
};

async function importCatalog(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets["Catálogo de Materiales"];
  if (!sheet) {
    console.error("❌  Sheet 'Catálogo de Materiales' not found");
    return;
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    header: ["id", "name", "type", "brand", "unit", "unitPrice", "supplier"],
    range: 3,
  });

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const id = String(row.id ?? "").trim();
    const name = String(row.name ?? "").trim();
    const rawType = String(row.type ?? "").trim().toUpperCase();
    const unit = String(row.unit ?? "KG").trim().toUpperCase();
    const price = parseFloat(String(row.unitPrice ?? "0").replace(",", ".")) || 0;
    const supplierLabel = String(row.supplier ?? "").trim();
    const supplierId = SUPPLIER_MAP[supplierLabel] ?? "P1";

    if (!id.startsWith("I") || !name) {
      skipped++;
      continue;
    }

    const type: MaterialType = TYPE_MAP[rawType] ?? "OTRO";

    await prisma.material.upsert({
      where: { id },
      update: { name, type, unit, unitPrice: price, supplierId },
      create: {
        id,
        name,
        type,
        brand: String(row.brand ?? "").trim() || null,
        unit,
        unitPrice: price,
        supplierId,
      },
    });

    await prisma.inventory.upsert({
      where: { materialId: id },
      update: {},
      create: {
        materialId: id,
        reorderPointDays: supplierId === "P2" ? 12 : supplierId === "P3" ? 10 : 7,
      },
    });

    created++;
  }

  console.log(`✓ Catálogo: ${created} materials upserted, ${skipped} rows skipped`);
}

async function importInventory(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets["Inventario"];
  if (!sheet) {
    console.error("❌  Sheet 'Inventario' not found");
    return;
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(
    sheet,
    {
      header: ["id","name","type","brand","unit","price","stock","consumption","coverage","reorder","alert","qty","cost","supplier","notes"],
      range: 3,
    }
  );

  let updated = 0;
  for (const row of rows) {
    const materialId = String(row.id ?? "").trim();
    if (!materialId.startsWith("I")) continue;

    const currentStock = parseFloat(String(row.stock ?? "0")) || 0;
    const dailyConsumption = parseFloat(String(row.consumption ?? "0")) || 0;

    const inv = await prisma.inventory.findUnique({ where: { materialId } });
    if (!inv) continue;

    await prisma.inventory.update({
      where: { materialId },
      data: { currentStock, dailyConsumption },
    });
    updated++;
  }

  console.log(`✓ Inventario: ${updated} rows updated`);
}

async function importProductionPlan(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets["Plan Producción"];
  if (!sheet) return;

  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(
    sheet,
    {
      header: ["date","style","batches","maltPer","hopPer","yeastPer","totalMalt","totalHop","totalYeast","notes"],
      range: 3,
    }
  );

  let created = 0;
  for (const row of rows) {
    const dateRaw = row.date;
    const style = String(row.style ?? "").trim();
    if (!dateRaw || !style) continue;

    const productionDate = new Date(
      typeof dateRaw === "number"
        ? new Date(1900, 0, dateRaw - 1)
        : String(dateRaw)
    );
    if (isNaN(productionDate.getTime())) continue;

    const batches = parseInt(String(row.batches ?? "1")) || 1;
    const maltPer = parseFloat(String(row.maltPer ?? "0")) || 0;
    const hopPer = parseFloat(String(row.hopPer ?? "0")) || 0;
    const yeastPer = parseFloat(String(row.yeastPer ?? "0")) || 0;

    await prisma.productionPlan.create({
      data: {
        productionDate,
        style,
        plannedBatches: batches,
        maltKgPerBatch: maltPer,
        hopKgPerBatch: hopPer,
        yeastGPerBatch: yeastPer,
        totalMaltKg: maltPer * batches,
        totalHopKg: hopPer * batches,
        totalYeastG: yeastPer * batches,
        notes: String(row.notes ?? "") || null,
      },
    });
    created++;
  }

  console.log(`✓ Plan Producción: ${created} plans imported`);
}

async function main() {
  const excelPath = path.resolve(
    __dirname,
    "../../..",
    "Inventario_Rrey_v4.xlsx"
  );

  console.log(`\n📊  Importing Excel: ${excelPath}\n`);

  const workbook = XLSX.readFile(excelPath);
  console.log("Sheets found:", workbook.SheetNames.join(", "));

  await importCatalog(workbook);
  await importInventory(workbook);
  await importProductionPlan(workbook);

  console.log("\n✅  Import complete!\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
