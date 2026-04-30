import { PrismaClient, MaterialType } from "@prisma/client";

const prisma = new PrismaClient();

const SUPPLIERS = [
  {
    id: "P1",
    name: "Proveedor Principal (Altiplano/Maltier/Malteroup)",
    country: "MX",
    materialType: "Malta, Adjuntos y Químicos",
    daysToOrder: 7,
    estimatedDeliveryDays: 3,
    minOrderQuantity: null,
    minOrderUnit: null,
    hasCredit: true,
    notes: "Surtidor principal. Da crédito. Cubre ~95% de materiales.",
  },
  {
    id: "P2",
    name: "República / HAAS (lúpulo EUA)",
    country: "EUA",
    materialType: "Lúpulo (contrato anual)",
    daysToOrder: 12,
    estimatedDeliveryDays: 20,
    minOrderQuantity: 20,
    minOrderUnit: "KG (caja 4×5kg)",
    hasCredit: false,
    notes:
      "Contrato anual. Paquetería. Se pide proyección trimestral. Ahorro ~40%.",
  },
  {
    id: "P3",
    name: "Lallemand / White Labs (levaduras EUA)",
    country: "EUA",
    materialType: "Levaduras",
    daysToOrder: 10,
    estimatedDeliveryDays: 5,
    minOrderQuantity: null,
    minOrderUnit: null,
    hasCredit: false,
    notes: "Pedido 10 días hábiles antes. Llegan en 5 días hábiles.",
  },
  {
    id: "P4",
    name: "Proveedor Emergencia A",
    country: "MX",
    materialType: "Varios",
    daysToOrder: 2,
    estimatedDeliveryDays: 2,
    minOrderQuantity: null,
    minOrderUnit: null,
    hasCredit: true,
    notes: "Emergencia. 2 días hábiles. Da crédito.",
  },
  {
    id: "P5",
    name: "Proveedor Emergencia B",
    country: "MX",
    materialType: "Varios",
    daysToOrder: 5,
    estimatedDeliveryDays: 5,
    minOrderQuantity: null,
    minOrderUnit: null,
    hasCredit: false,
    notes: "Emergencia. 5 días hábiles. Sin crédito.",
  },
];

type MaterialRow = {
  id: string;
  name: string;
  type: MaterialType;
  brand: string | null;
  unit: string;
  unitPrice: number;
  supplierId: string;
};

const MATERIALS: MaterialRow[] = [
  // ─── LÚPULOS (I001–I051, I125) ───────────────────────────────────────────
  { id: "I001", name: "AFRICA QUEEN", type: "LUPULO", brand: null, unit: "KG", unitPrice: 745, supplierId: "P2" },
  { id: "I002", name: "AMARILLO REPÚBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 808, supplierId: "P2" },
  { id: "I003", name: "AMARILLO HAAS", type: "LUPULO", brand: "HAAS", unit: "KG", unitPrice: 516, supplierId: "P2" },
  { id: "I004", name: "AMARILLO CRYO REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 1853, supplierId: "P2" },
  { id: "I005", name: "AZZACA REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 702, supplierId: "P2" },
  { id: "I006", name: "AZZACA HAAS", type: "LUPULO", brand: "HAAS", unit: "KG", unitPrice: 496, supplierId: "P2" },
  { id: "I007", name: "CASCADE REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 481, supplierId: "P2" },
  { id: "I008", name: "CASCADE CRYO REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 1313, supplierId: "P2" },
  { id: "I009", name: "CENTENNIAL REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 520, supplierId: "P2" },
  { id: "I010", name: "CENTENNIAL CRYO REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 1313, supplierId: "P2" },
  { id: "I011", name: "CHINOOK REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 599, supplierId: "P2" },
  { id: "I012", name: "CHINOOK HAAS", type: "LUPULO", brand: "HAAS", unit: "KG", unitPrice: 398, supplierId: "P2" },
  { id: "I013", name: "CITRA REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 932, supplierId: "P2" },
  { id: "I014", name: "CRYO POP", type: "LUPULO", brand: null, unit: "KG", unitPrice: 1780, supplierId: "P2" },
  { id: "I015", name: "CTZ REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 394, supplierId: "P2" },
  { id: "I016", name: "COLUMBUS HAAS", type: "LUPULO", brand: "HAAS", unit: "KG", unitPrice: 302, supplierId: "P2" },
  { id: "I017", name: "EL DORADO REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 642, supplierId: "P2" },
  { id: "I018", name: "E.K. GOLDING", type: "LUPULO", brand: null, unit: "KG", unitPrice: 0, supplierId: "P2" },
  { id: "I019", name: "FUGGLE REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 856, supplierId: "P2" },
  { id: "I020", name: "GALAXY REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 1099, supplierId: "P2" },
  { id: "I021", name: "GALAXY HAAS", type: "LUPULO", brand: "HAAS", unit: "KG", unitPrice: 569, supplierId: "P2" },
  { id: "I022", name: "HALLERTAU MITTELFRUH REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 776, supplierId: "P2" },
  { id: "I023", name: "HALLERTAU MITTELFRUH HAAS", type: "LUPULO", brand: "HAAS", unit: "KG", unitPrice: 525, supplierId: "P2" },
  { id: "I024", name: "HUELL MELON REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 800, supplierId: "P2" },
  { id: "I025", name: "IDAHO 7 REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 717, supplierId: "P2" },
  { id: "I026", name: "IDAHO 7 HAAS", type: "LUPULO", brand: "HAAS", unit: "KG", unitPrice: 528, supplierId: "P2" },
  { id: "I027", name: "HALLERTAU MAGNUM REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 549, supplierId: "P2" },
  { id: "I028", name: "HALLERTAU MAGNUM HAAS", type: "LUPULO", brand: "HAAS", unit: "KG", unitPrice: 397, supplierId: "P2" },
  { id: "I029", name: "MANDARINA BAVARIA REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 662, supplierId: "P2" },
  { id: "I030", name: "MANDARINA BAVARIA HAAS", type: "LUPULO", brand: "HAAS", unit: "KG", unitPrice: 397, supplierId: "P2" },
  { id: "I031", name: "MOSAIC REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 824, supplierId: "P2" },
  { id: "I032", name: "MOSAIC HAAS", type: "LUPULO", brand: "HAAS", unit: "KG", unitPrice: 487, supplierId: "P2" },
  { id: "I033", name: "MOTUEKA REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 709, supplierId: "P2" },
  { id: "I034", name: "MOUNT HOOD REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 678, supplierId: "P2" },
  { id: "I035", name: "NELSON SAUVIN REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 1099, supplierId: "P2" },
  { id: "I036", name: "NUGGET", type: "LUPULO", brand: null, unit: "KG", unitPrice: 0, supplierId: "P2" },
  { id: "I037", name: "NORTHERN BREWER REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 658, supplierId: "P2" },
  { id: "I038", name: "PERLE REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 750, supplierId: "P2" },
  { id: "I039", name: "SAAZ REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 756, supplierId: "P2" },
  { id: "I040", name: "SABRO", type: "LUPULO", brand: null, unit: "KG", unitPrice: 698, supplierId: "P2" },
  { id: "I041", name: "SIMCOE REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 969, supplierId: "P2" },
  { id: "I042", name: "SOUTHERN PASSION", type: "LUPULO", brand: null, unit: "KG", unitPrice: 745, supplierId: "P2" },
  { id: "I043", name: "STERLING REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 763, supplierId: "P2" },
  { id: "I044", name: "STRATA", type: "LUPULO", brand: null, unit: "KG", unitPrice: 0, supplierId: "P2" },
  { id: "I045", name: "SUMMIT REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 811, supplierId: "P2" },
  { id: "I046", name: "TETTNANG REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 774, supplierId: "P2" },
  { id: "I047", name: "UK GOLDINGS REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 862, supplierId: "P2" },
  { id: "I048", name: "WILLAMETTE REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 702, supplierId: "P2" },
  { id: "I049", name: "WILLAMETTE HAAS", type: "LUPULO", brand: "HAAS", unit: "KG", unitPrice: 473, supplierId: "P2" },
  { id: "I050", name: "ZAPPA REPUBLICA", type: "LUPULO", brand: "REPUBLICA", unit: "KG", unitPrice: 630, supplierId: "P2" },
  { id: "I051", name: "WARRIOR", type: "LUPULO", brand: null, unit: "KG", unitPrice: 0, supplierId: "P2" },
  { id: "I125", name: "EXT MAGNÍFICO", type: "LUPULO", brand: null, unit: "LT", unitPrice: 4500, supplierId: "P2" },
  // ─── MALTAS (I052–I124, I137–I148) ───────────────────────────────────────
  { id: "I052", name: "AL PILS", type: "MALTA", brand: "ALTIPLANO", unit: "KG", unitPrice: 21.55, supplierId: "P1" },
  { id: "I053", name: "AL PALE", type: "MALTA", brand: "ALTIPLANO", unit: "KG", unitPrice: 21.55, supplierId: "P1" },
  { id: "I054", name: "BX SUPERIOR PILSEN", type: "MALTA", brand: "MALTIER (BEERMEX)", unit: "KG", unitPrice: 25.41, supplierId: "P1" },
  { id: "I055", name: "MA 2ROW", type: "MALTA", brand: "MALTEROUP", unit: "KG", unitPrice: 27, supplierId: "P1" },
  { id: "I056", name: "MA PILS", type: "MALTA", brand: "MALTEROUP", unit: "KG", unitPrice: 27, supplierId: "P1" },
  { id: "I057", name: "MA PALE", type: "MALTA", brand: "MALTEROUP", unit: "KG", unitPrice: 27, supplierId: "P1" },
  { id: "I058", name: "MA WHEAT", type: "MALTA", brand: "MALTEROUP", unit: "KG", unitPrice: 28, supplierId: "P1" },
  { id: "I059", name: "MA MUNICH", type: "MALTA", brand: "MALTEROUP", unit: "KG", unitPrice: 28, supplierId: "P1" },
  { id: "I060", name: "MA VIENNA", type: "MALTA", brand: "MALTEROUP", unit: "KG", unitPrice: 28, supplierId: "P1" },
  { id: "I061", name: "MA MELANY", type: "MALTA", brand: "MALTEROUP", unit: "KG", unitPrice: 0, supplierId: "P1" },
  { id: "I062", name: "MA DEXTRIN MALT", type: "MALTA", brand: "MALTEROUP", unit: "KG", unitPrice: 38.8, supplierId: "P1" },
  { id: "I063", name: "MA CRYSTAL WHEAT", type: "MALTA", brand: "MALTEROUP", unit: "KG", unitPrice: 40.4, supplierId: "P1" },
  { id: "I064", name: "MA FLAKE BARLEY", type: "MALTA", brand: "MALTEROUP", unit: "KG", unitPrice: 34.8, supplierId: "P1" },
  { id: "I065", name: "MA KILNED C60", type: "MALTA", brand: "MALTEROUP", unit: "KG", unitPrice: 0, supplierId: "P1" },
  { id: "I066", name: "MA STEAMED C3.5", type: "MALTA", brand: "MELTEROUP", unit: "KG", unitPrice: 0, supplierId: "P1" },
  { id: "I067", name: "SW PILSNER", type: "MALTA", brand: "SWAEN", unit: "KG", unitPrice: 25, supplierId: "P1" },
  { id: "I068", name: "SW ALE", type: "MALTA", brand: "SWAEN", unit: "KG", unitPrice: 25.4, supplierId: "P1" },
  { id: "I069", name: "SW VIENNA", type: "MALTA", brand: "SWAEN", unit: "KG", unitPrice: 31.4, supplierId: "P1" },
  { id: "I070", name: "SW MELANY", type: "MALTA", brand: "SWAEN", unit: "KG", unitPrice: 32, supplierId: "P1" },
  { id: "I071", name: "SW WHEAT CLASSIC", type: "MALTA", brand: "SWAEN", unit: "KG", unitPrice: 32, supplierId: "P1" },
  { id: "I072", name: "SW MUNICH DARK", type: "MALTA", brand: "SWAEN", unit: "KG", unitPrice: 31.8, supplierId: "P1" },
  { id: "I073", name: "SW FLAKED WHEAT", type: "MALTA", brand: "SWAEN", unit: "KG", unitPrice: 26.2, supplierId: "P1" },
  { id: "I074", name: "SW FLAKED BARLEY", type: "MALTA", brand: "SWAEN", unit: "KG", unitPrice: 34.8, supplierId: "P1" },
  { id: "I075", name: "SW RYE", type: "MALTA", brand: "SWAEN", unit: "KG", unitPrice: 39.4, supplierId: "P1" },
  { id: "I076", name: "GS RED", type: "MALTA", brand: "GOLDEN SWAEN", unit: "KG", unitPrice: 42.8, supplierId: "P1" },
  { id: "I077", name: "GS MUNICH DARK", type: "MALTA", brand: "GOLDEN SWAEN", unit: "KG", unitPrice: 42.8, supplierId: "P1" },
  { id: "I078", name: "GS LIGHT", type: "MALTA", brand: "GOLDEN SWAEN", unit: "KG", unitPrice: 42, supplierId: "P1" },
  { id: "I079", name: "GS BROWN SUPREME", type: "MALTA", brand: "GOLDEN SWAEN", unit: "KG", unitPrice: 42.8, supplierId: "P1" },
  { id: "I080", name: "GS AROMA", type: "MALTA", brand: "GOLDEN SWAEN", unit: "KG", unitPrice: 42.8, supplierId: "P1" },
  { id: "I081", name: "GS BROWN", type: "MALTA", brand: "GOLDEN SWAEN", unit: "KG", unitPrice: 42.8, supplierId: "P1" },
  { id: "I082", name: "GS AMBER", type: "MALTA", brand: "GOLDEN SWAEN", unit: "KG", unitPrice: 42.8, supplierId: "P1" },
  { id: "I083", name: "GS HELL", type: "MALTA", brand: "GOLDEN SWAEN", unit: "KG", unitPrice: 42.8, supplierId: "P1" },
  { id: "I084", name: "GS MUNICH LIGHT", type: "MALTA", brand: "GOLDEN SWAEN", unit: "KG", unitPrice: 42.8, supplierId: "P1" },
  { id: "I085", name: "GS CLASSIC", type: "MALTA", brand: "GOLDEN SWAEN", unit: "KG", unitPrice: 42.8, supplierId: "P1" },
  { id: "I086", name: "BS CHOCOLATE B", type: "MALTA", brand: "BLACK SWAEN", unit: "KG", unitPrice: 47.2, supplierId: "P1" },
  { id: "I087", name: "BS BARLEY", type: "MALTA", brand: "BLACK SWAEN", unit: "KG", unitPrice: 43.2, supplierId: "P1" },
  { id: "I088", name: "BS BLACK EXTRA", type: "MALTA", brand: "BLACK SWAEN", unit: "KG", unitPrice: 47.4, supplierId: "P1" },
  { id: "I089", name: "BS BISCUIT", type: "MALTA", brand: "BLACK SWAEN", unit: "KG", unitPrice: 47.2, supplierId: "P1" },
  { id: "I090", name: "BS HONEY BISCUIT", type: "MALTA", brand: "BLACK SWAEN", unit: "KG", unitPrice: 47.2, supplierId: "P1" },
  { id: "I091", name: "BS COFFEE", type: "MALTA", brand: "BLACK SWAEN", unit: "KG", unitPrice: 47.2, supplierId: "P1" },
  { id: "I092", name: "BS BLACK WHEAT", type: "MALTA", brand: "BLACK SWAEN", unit: "KG", unitPrice: 48.2, supplierId: "P1" },
  { id: "I093", name: "BS BLACK", type: "MALTA", brand: "BLACK SWAEN", unit: "KG", unitPrice: 45.8, supplierId: "P1" },
  { id: "I094", name: "BRIESS BLACKPRINZ", type: "MALTA", brand: "BRIESS (BEERMEX)", unit: "KG", unitPrice: 68.25, supplierId: "P1" },
  { id: "I095", name: "BRIESS MIDNIGHT WHEAT", type: "MALTA", brand: "BRIESS (BEERMEX)", unit: "KG", unitPrice: 74.74, supplierId: "P1" },
  { id: "I096", name: "BRIESS AROMATIC", type: "MALTA", brand: "BRIESS (BEERMEX)", unit: "KG", unitPrice: 55.86, supplierId: "P1" },
  { id: "I097", name: "BRIESS PILSEN DRY", type: "MALTA", brand: "BRIESS (BEERMEX)", unit: "KG", unitPrice: 114.77, supplierId: "P1" },
  { id: "I098", name: "BRIESS RICE HULLS", type: "MALTA", brand: "BRIESS (BEERMEX)", unit: "KG", unitPrice: 36.98, supplierId: "P1" },
  { id: "I099", name: "BRIESS RICE FLAKES", type: "MALTA", brand: "BRIESS (BEERMEX)", unit: "KG", unitPrice: 60.95, supplierId: "P1" },
  { id: "I100", name: "WE CARAFA 1", type: "MALTA", brand: "WEYERMANN", unit: "KG", unitPrice: 57.32, supplierId: "P1" },
  { id: "I101", name: "WE CARAFA 3", type: "MALTA", brand: "WEYERMANN", unit: "KG", unitPrice: 57.32, supplierId: "P1" },
  { id: "I102", name: "WE CARAMUNICH 1", type: "MALTA", brand: "WEYERMANN", unit: "KG", unitPrice: 49.04, supplierId: "P1" },
  { id: "I103", name: "WE CARAPILS", type: "MALTA", brand: "WEYERMANN", unit: "KG", unitPrice: 48.43, supplierId: "P1" },
  { id: "I104", name: "WE MUNICH 1", type: "MALTA", brand: "WEYERMANN", unit: "KG", unitPrice: 40.74, supplierId: "P1" },
  { id: "I105", name: "WE SPECIAL W", type: "MALTA", brand: "WEYERMANN", unit: "KG", unitPrice: 54.25, supplierId: "P1" },
  { id: "I106", name: "MO CRISTAL 150", type: "MALTA", brand: "MOUNTONS", unit: "KG", unitPrice: 0, supplierId: "P1" },
  { id: "I107", name: "ONE AVENA", type: "MALTA", brand: "ONE", unit: "KG", unitPrice: 18.97, supplierId: "P1" },
  { id: "I108", name: "SI MARIS OTTER", type: "MALTA", brand: "SIMPSONS", unit: "KG", unitPrice: 53.98, supplierId: "P1" },
  { id: "I109", name: "FU FENG DEXTROSA", type: "MALTA", brand: "FU FENG", unit: "KG", unitPrice: 24.2, supplierId: "P1" },
  { id: "I110", name: "MALTODEXTRINA", type: "MALTA", brand: null, unit: "KG", unitPrice: 33.66, supplierId: "P1" },
  { id: "I111", name: "CORN FLAKES", type: "MALTA", brand: "CORN", unit: "KG", unitPrice: 32.25, supplierId: "P1" },
  { id: "I112", name: "WE CARABOHEMIA", type: "MALTA", brand: "WEYERMANN", unit: "KG", unitPrice: 0, supplierId: "P1" },
  { id: "I113", name: "BRIESS SPECIAL ROAST", type: "MALTA", brand: "BRIESS", unit: "KG", unitPrice: 60.59, supplierId: "P1" },
  { id: "I114", name: "BRIESS C60", type: "MALTA", brand: "BRIESS", unit: "KG", unitPrice: 52.65, supplierId: "P1" },
  { id: "I115", name: "BRIESS C90", type: "MALTA", brand: "BRIESS", unit: "KG", unitPrice: 52.65, supplierId: "P1" },
  { id: "I116", name: "CRISP DEXTRIN MALT", type: "MALTA", brand: "CRISP", unit: "KG", unitPrice: 37.4, supplierId: "P1" },
  { id: "I117", name: "CRISP CORN FLAKES", type: "MALTA", brand: "CRISP", unit: "KG", unitPrice: 44.4, supplierId: "P1" },
  { id: "I118", name: "CRISP EXTRA PALE MALT (2 ROW)", type: "MALTA", brand: "CRISP", unit: "KG", unitPrice: 29.4, supplierId: "P1" },
  { id: "I119", name: "CRISP FLAKED RICE", type: "MALTA", brand: "CRISP", unit: "KG", unitPrice: 65.6, supplierId: "P1" },
  { id: "I120", name: "CRISP FLAKED BARLEY", type: "MALTA", brand: "CRISP", unit: "KG", unitPrice: 29, supplierId: "P1" },
  { id: "I121", name: "CRISP TORREFIED WHEAT", type: "MALTA", brand: "CRISP", unit: "KG", unitPrice: 29.8, supplierId: "P1" },
  { id: "I122", name: "PS SAUER", type: "MALTA", brand: null, unit: "KG", unitPrice: 56.4, supplierId: "P1" },
  { id: "I123", name: "PS FLAKED WHEAT", type: "MALTA", brand: null, unit: "KG", unitPrice: 30.4, supplierId: "P1" },
  { id: "I124", name: "OB PILS", type: "MALTA", brand: "OBOLON", unit: "KG", unitPrice: 23, supplierId: "P1" },
  { id: "I137", name: "ME MEXICO 2ROW", type: "MALTA", brand: null, unit: "KG", unitPrice: 22.48, supplierId: "P1" },
  { id: "I139", name: "TF&S MARIS OTTER", type: "MALTA", brand: "BEERMEX", unit: "KG", unitPrice: 40.59, supplierId: "P1" },
  { id: "I140", name: "CM WHEAT", type: "MALTA", brand: "CANADA MALTING", unit: "KG", unitPrice: 30.47, supplierId: "P1" },
  { id: "I141", name: "GW DEXTRAPILS", type: "MALTA", brand: "GREAT WESTERN", unit: "KG", unitPrice: 42.45, supplierId: "P1" },
  { id: "I142", name: "GW VIENNA", type: "MALTA", brand: "GREAT WESTERN", unit: "KG", unitPrice: 35.17, supplierId: "P1" },
  { id: "I143", name: "BS VICTORY", type: "MALTA", brand: "BLACK SWAEN", unit: "KG", unitPrice: 55.9, supplierId: "P1" },
  { id: "I144", name: "TF&S AMBER", type: "MALTA", brand: "BEERMEX", unit: "KG", unitPrice: 45.04, supplierId: "P1" },
  { id: "I145", name: "RA WHEAT", type: "MALTA", brand: "RAHR", unit: "KG", unitPrice: 41.32, supplierId: "P1" },
  // ─── LEVADURAS ────────────────────────────────────────────────────────────
  { id: "I128", name: "NOVALAGER", type: "YEAST", brand: "LALLEMAND", unit: "KG", unitPrice: 6910, supplierId: "P3" },
  { id: "I146", name: "CLARITY FERM", type: "YEAST", brand: "WHITE LABS", unit: "LT", unitPrice: 1661.22, supplierId: "P3" },
  { id: "I147", name: "PROP", type: "OTRO", brand: null, unit: "KG", unitPrice: 2603.52, supplierId: "P1" },
  // ─── ADJUNTOS Y QUÍMICOS ─────────────────────────────────────────────────
  { id: "I126", name: "PROTOSOL", type: "ADJUNTO", brand: "AB VICKERS", unit: "KG", unitPrice: 370, supplierId: "P1" },
  { id: "I127", name: "FOAMSOL", type: "ADJUNTO", brand: null, unit: "KG", unitPrice: 408, supplierId: "P1" },
  { id: "I129", name: "SULFATO DE CALCIO", type: "ADJUNTO", brand: "MICERVESA", unit: "KG", unitPrice: 7.44, supplierId: "P1" },
  { id: "I130", name: "SULFATO DE MAGNESIO", type: "ADJUNTO", brand: "MERCADO LIBRE", unit: "KG", unitPrice: 109, supplierId: "P1" },
  { id: "I131", name: "CLORURO DE CALCIO", type: "ADJUNTO", brand: "PAZGOR", unit: "KG", unitPrice: 35, supplierId: "P1" },
  { id: "I132", name: "ACIDO FOSFÓRICO 85%", type: "ADJUNTO", brand: null, unit: "KG", unitPrice: 77, supplierId: "P1" },
  { id: "I133", name: "METABISULFITO DE POTASIO", type: "ADJUNTO", brand: "HACER VINO", unit: "KG", unitPrice: 432.5, supplierId: "P1" },
  { id: "I134", name: "CARBONATO DE CALCIO", type: "ADJUNTO", brand: null, unit: "KG", unitPrice: 22.9, supplierId: "P1" },
  { id: "I135", name: "VICANT SB", type: "ADJUNTO", brand: null, unit: "KG", unitPrice: 580, supplierId: "P1" },
  { id: "I136", name: "E.K. GOLDING (ADJUNTO)", type: "ADJUNTO", brand: null, unit: "KG", unitPrice: 0, supplierId: "P1" },
  { id: "I138", name: "SINAMAR", type: "ADJUNTO", brand: null, unit: "KG", unitPrice: 190.29, supplierId: "P1" },
  { id: "I148", name: "BIOFINE", type: "ADJUNTO", brand: null, unit: "KG", unitPrice: 370, supplierId: "P1" },
  { id: "I149", name: "ÁCIDO LÁCTICO", type: "ADJUNTO", brand: null, unit: "KG", unitPrice: 66.39, supplierId: "P1" },
  { id: "I152", name: "SERVOMYCES", type: "ADJUNTO", brand: null, unit: "KG", unitPrice: 4188, supplierId: "P1" },
  // ─── OTROS ────────────────────────────────────────────────────────────────
  { id: "I150", name: "FILTRACIÓN", type: "OTRO", brand: null, unit: "KG", unitPrice: 1080, supplierId: "P1" },
  { id: "I151", name: "FLETE", type: "OTRO", brand: null, unit: "KG", unitPrice: 2000, supplierId: "P1" },
];

async function main() {
  console.log("🍺  Seeding Rrëy database...");

  // Suppliers
  for (const supplier of SUPPLIERS) {
    await prisma.supplier.upsert({
      where: { id: supplier.id },
      update: supplier,
      create: supplier,
    });
  }
  console.log(`✓ ${SUPPLIERS.length} suppliers`);

  // Materials
  for (const mat of MATERIALS) {
    await prisma.material.upsert({
      where: { id: mat.id },
      update: mat,
      create: mat,
    });
  }
  console.log(`✓ ${MATERIALS.length} materials`);

  // Inventory rows for every material
  for (const mat of MATERIALS) {
    await prisma.inventory.upsert({
      where: { materialId: mat.id },
      update: {},
      create: {
        materialId: mat.id,
        currentStock: 0,
        dailyConsumption: 0,
        reorderPointDays: mat.supplierId === "P2" ? 12 : mat.supplierId === "P3" ? 10 : 7,
        alertStatus: "NONE",
        quantityToOrder: 0,
        estimatedOrderCost: 0,
      },
    });
  }
  console.log(`✓ ${MATERIALS.length} inventory rows`);

  // JIT config
  await prisma.jITConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      workingDaysPerWeek: 5,
      maxDaysRawMaterial: 7,
      hopCoverageDays: 90,
      yeastCoverageDays: 15,
      safetyBufferDays: 1,
      avgDailyProduction: 1,
    },
  });
  console.log("✓ JIT config");

  // Sample production plans
  const today = new Date();
  const plans = [
    { style: "Löndon", daysOffset: 1, batches: 2, maltKg: 60, hopKg: 0.5, yeastG: 500 },
    { style: "Whïte", daysOffset: 3, batches: 1, maltKg: 55, hopKg: 0.3, yeastG: 400 },
    { style: "Kölsh", daysOffset: 5, batches: 2, maltKg: 58, hopKg: 0.4, yeastG: 450 },
    { style: "Mëxican IPA", daysOffset: 7, batches: 1, maltKg: 62, hopKg: 1.2, yeastG: 500 },
    { style: "Monterrëy Stout", daysOffset: 10, batches: 1, maltKg: 65, hopKg: 0.6, yeastG: 500 },
  ];

  for (const p of plans) {
    const d = new Date(today);
    d.setDate(d.getDate() + p.daysOffset);
    await prisma.productionPlan.create({
      data: {
        productionDate: d,
        style: p.style,
        plannedBatches: p.batches,
        maltKgPerBatch: p.maltKg,
        hopKgPerBatch: p.hopKg,
        yeastGPerBatch: p.yeastG,
        totalMaltKg: p.maltKg * p.batches,
        totalHopKg: p.hopKg * p.batches,
        totalYeastG: p.yeastG * p.batches,
      },
    });
  }
  console.log(`✓ ${plans.length} production plans`);

  console.log("\n✅  Seed complete. Run the import script to load Excel data:");
  console.log("   npm run import:excel --workspace=api\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
