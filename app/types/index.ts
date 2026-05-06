export type MaterialType = "LUPULO" | "MALTA" | "YEAST" | "ADJUNTO" | "OTRO";
export type AlertStatus = "RED" | "YELLOW" | "GREEN" | "NONE";
export type OrderStatus =
  | "PENDING"
  | "IN_TRANSIT"
  | "RECEIVED_COMPLETE"
  | "RECEIVED_PARTIAL"
  | "CANCELLED";
export type PaymentMethod =
  | "TRANSFER"
  | "SUPPLIER_CREDIT"
  | "CASH"
  | "CARD"
  | "OTHER";
export type ReceptionCondition =
  | "GOOD"
  | "REGULAR"
  | "DAMAGED"
  | "INCOMPLETE"
  | "EXPIRED";

export type Role = "DEVELOPER" | "SUPERVISOR" | "OPERATOR" | "TRANSPORTER";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type BlockType = "EMAIL" | "IP";

export interface Supplier {
  id: string;
  name: string;
  country: string | null;
  materialType: string | null;
  daysToOrder: number;
  estimatedDeliveryDays: number;
  minOrderQuantity: number | null;
  minOrderUnit: string | null;
  hasCredit: boolean;
  notes: string | null;
}

export interface Material {
  id: string;
  name: string;
  type: MaterialType;
  brand: string | null;
  unit: string;
  unitPrice: number;
  priceUnit: string | null;
  supplierId: string | null;
  supplier?: Supplier | null;
  inventory?: InventoryRow | null;
}

export interface InventoryRow {
  id: string;
  materialId: string;
  material?: Material;
  currentStock: number;
  dailyConsumption: number;
  reorderPointDays: number;
  alertStatus: AlertStatus;
  quantityToOrder: number;
  estimatedOrderCost: number;
  notes: string | null;
  updatedAt: string;
}

export interface ProductionPlan {
  id: string;
  productionDate: string;
  style: string;
  plannedBatches: number;
  maltKgPerBatch: number;
  hopKgPerBatch: number;
  yeastGPerBatch: number;
  totalMaltKg: number;
  totalHopKg: number;
  totalYeastG: number;
  notes: string | null;
  orderedAt: string | null;
  approvalStatus: ApprovalStatus;
  approvedById: string | null;
  approvedAt: string | null;
  rejectedById: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  hasMissingPrices: boolean;
  estimatedCost: number;
  createdById: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  folio: string;
  orderDate: string;
  materialId: string;
  material?: Material;
  supplierId: string | null;
  supplier?: Supplier | null;
  orderedQuantity: number;
  totalPaid: number | null;
  paymentMethod: PaymentMethod | null;
  estimatedArrivalDate: string | null;
  status: OrderStatus;
  month: string;
  notes: string | null;
  receptions?: Reception[];
  createdAt: string;
}

export interface Reception {
  id: string;
  receptionDate: string;
  orderId: string;
  order?: Order;
  receivedQuantity: number;
  condition: ReceptionCondition;
  isConforming: boolean;
  batchLot: string | null;
  receivedBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface RecipeLine {
  id: string;
  beerStyle: string;
  materialId: string;
  material?: Material;
  qtyPerBatch: number;
  notes: string | null;
}

export interface OrderPreviewItem {
  materialId: string;
  materialName: string;
  unit: string;
  needed: number;
  currentStock: number;
  shortfall: number;
  supplierId: string | null;
  supplierName: string | null;
  estimatedCost: number;
  willOrder: boolean;
}

export interface GenerateOrdersPreview {
  plan: ProductionPlan;
  preview: OrderPreviewItem[];
  totalEstimatedCost: number;
}

export interface DashboardSummary {
  alerts: { red: number; yellow: number; green: number; none: number };
  totalMaterials: number;
  upcoming: {
    plans: ProductionPlan[];
    batches: number;
    maltKg: number;
    hopKg: number;
  };
  monthlySpend: { total: number; orderCount: number };
  inTransitOrders: number;
}

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  createdById: string | null;
}

export interface BlockedEntity {
  id: string;
  type: BlockType;
  value: string;
  reason: string | null;
  createdAt: string;
}

export interface ImportResult {
  updated: number;
  errors: { row: number; id: string; reason: string }[];
  total: number;
}
