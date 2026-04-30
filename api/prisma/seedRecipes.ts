import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Realistic recipes based on Rrëy's material catalog
const RECIPES: { beerStyle: string; materialId: string; qtyPerBatch: number; notes?: string }[] = [
  // ─── Löndon (English Pale Ale) — 60kg malta / 0.5kg lúpulo por lote ─────
  { beerStyle: "Löndon", materialId: "I108", qtyPerBatch: 48, notes: "Base Maris Otter" },
  { beerStyle: "Löndon", materialId: "I076", qtyPerBatch: 6,  notes: "Color y caramelo" },
  { beerStyle: "Löndon", materialId: "I104", qtyPerBatch: 4,  notes: "Cuerpo y redondez" },
  { beerStyle: "Löndon", materialId: "I103", qtyPerBatch: 2,  notes: "Retención espuma" },
  { beerStyle: "Löndon", materialId: "I047", qtyPerBatch: 0.3, notes: "Bittering / aroma inglés" },
  { beerStyle: "Löndon", materialId: "I019", qtyPerBatch: 0.2, notes: "Aroma Fuggle" },

  // ─── Whïte (Witbier) — 55kg malta / 0.3kg lúpulo por lote ──────────────
  { beerStyle: "Whïte", materialId: "I057", qtyPerBatch: 28, notes: "Base Pale" },
  { beerStyle: "Whïte", materialId: "I058", qtyPerBatch: 20, notes: "Malta de trigo" },
  { beerStyle: "Whïte", materialId: "I073", qtyPerBatch: 5,  notes: "Trigo en escamas" },
  { beerStyle: "Whïte", materialId: "I103", qtyPerBatch: 2,  notes: "Retención espuma" },
  { beerStyle: "Whïte", materialId: "I039", qtyPerBatch: 0.2, notes: "Saaz — carácter Wit" },
  { beerStyle: "Whïte", materialId: "I046", qtyPerBatch: 0.1, notes: "Tettnang — especias" },

  // ─── Kölsh — 58kg malta / 0.4kg lúpulo por lote ─────────────────────────
  { beerStyle: "Kölsh", materialId: "I052", qtyPerBatch: 50, notes: "Base Pils Altiplano" },
  { beerStyle: "Kölsh", materialId: "I067", qtyPerBatch: 5,  notes: "Swaen Pilsner" },
  { beerStyle: "Kölsh", materialId: "I103", qtyPerBatch: 3,  notes: "Carapils — cuerpo" },
  { beerStyle: "Kölsh", materialId: "I022", qtyPerBatch: 0.25, notes: "Hallertau Mittelfrüh" },
  { beerStyle: "Kölsh", materialId: "I028", qtyPerBatch: 0.15, notes: "Hallertau Magnum bittering" },

  // ─── Mëxican IPA — 62kg malta / 1.2kg lúpulo por lote ───────────────────
  { beerStyle: "Mëxican IPA", materialId: "I055", qtyPerBatch: 50, notes: "Base 2-Row" },
  { beerStyle: "Mëxican IPA", materialId: "I102", qtyPerBatch: 7,  notes: "Caramunich — cuerpo/color" },
  { beerStyle: "Mëxican IPA", materialId: "I103", qtyPerBatch: 3,  notes: "Carapils — espuma" },
  { beerStyle: "Mëxican IPA", materialId: "I083", qtyPerBatch: 2,  notes: "GS Hell — suavidad" },
  { beerStyle: "Mëxican IPA", materialId: "I007", qtyPerBatch: 0.4, notes: "Cascade — cítrico" },
  { beerStyle: "Mëxican IPA", materialId: "I009", qtyPerBatch: 0.4, notes: "Centennial — floral/cítrico" },
  { beerStyle: "Mëxican IPA", materialId: "I013", qtyPerBatch: 0.2, notes: "Citra — tropical" },
  { beerStyle: "Mëxican IPA", materialId: "I031", qtyPerBatch: 0.2, notes: "Mosaic — dry hop" },

  // ─── Monterrëy Stout — 65kg malta / 0.5kg lúpulo por lote ───────────────
  { beerStyle: "Monterrëy Stout", materialId: "I055", qtyPerBatch: 42, notes: "Base 2-Row" },
  { beerStyle: "Monterrëy Stout", materialId: "I101", qtyPerBatch: 8,  notes: "Carafa 3 — color negro" },
  { beerStyle: "Monterrëy Stout", materialId: "I086", qtyPerBatch: 6,  notes: "Chocolate B — café" },
  { beerStyle: "Monterrëy Stout", materialId: "I087", qtyPerBatch: 5,  notes: "BS Barley — tostado" },
  { beerStyle: "Monterrëy Stout", materialId: "I093", qtyPerBatch: 2,  notes: "BS Black — seco" },
  { beerStyle: "Monterrëy Stout", materialId: "I114", qtyPerBatch: 2,  notes: "Briess C60 — dulzor" },
  { beerStyle: "Monterrëy Stout", materialId: "I019", qtyPerBatch: 0.3, notes: "Fuggle — terroso" },
  { beerStyle: "Monterrëy Stout", materialId: "I047", qtyPerBatch: 0.2, notes: "UK Goldings — suave" },

  // ─── Edición especial — placeholder ajustable ────────────────────────────
  { beerStyle: "Edición especial", materialId: "I055", qtyPerBatch: 50, notes: "Base ajustable" },
  { beerStyle: "Edición especial", materialId: "I031", qtyPerBatch: 0.5, notes: "Mosaic — ajustable" },
];

async function main() {
  console.log("\n🍺  Seeding recipe lines...\n");
  let created = 0;
  for (const r of RECIPES) {
    await prisma.recipeLine.upsert({
      where: { beerStyle_materialId: { beerStyle: r.beerStyle, materialId: r.materialId } },
      update: { qtyPerBatch: r.qtyPerBatch, notes: r.notes },
      create: r,
    });
    created++;
  }
  console.log(`✅  ${created} recipe lines upserted\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
