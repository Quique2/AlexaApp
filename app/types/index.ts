export type MaterialType = "LUPULO" | "MALTA" | "YEAST" | "ADJUNTO" | "OTRO";
export type AlertStatus = "RED" | "YELLOW" | "GREEN" | "NONE";
export type ActionStatus = "ORDER_NOW" | "ORDER_SOON" | "COVERED" | "OK";
export type ProductionStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
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

export interface ProductionRequirement {
  id: string;
  productionPlanId: string;
  inventoryId: string;
  materialId: string;
  material?: { name: string; unit: string };
  requiredQuantity: number;
  reservedQuantity: number;
  missingQuantity: number;
  isCritical: boolean;
  actionStatus: ActionStatus;
  linkedOrderId: string | null;
  linkedOrder?: {
    id: string;
    folio: string;
    estimatedArrivalDate: string | null;
    status: OrderStatus;
  } | null;
}

export interface InventoryRow {
  id: string;
  materialId: string;
  material?: Material;
  currentStock: number;
  reservedStock: number;
  dailyConsumption: number;
  reorderPointDays: number;
  alertStatus: AlertStatus;
  isCritical: boolean;
  quantityToOrder: number;
  estimatedOrderCost: number;
  notes: string | null;
  updatedAt: string;
  requirements?: ProductionRequirement[];
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
  productionStatus: ProductionStatus;
  approvedById: string | null;
  approvedAt: string | null;
  rejectedById: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  hasMissingPrices: boolean;
  estimatedCost: number;
  createdById: string | null;
  createdAt: string;
  requirements?: ProductionRequirement[];
  hasCriticalRequirements?: boolean;
}

export interface Order {
  id: string;
  folio: string;
  orderDate: string;
  materialId: string;
  material?: Material;
  supplierId: string | null;
  supplier?: Supplier | null;
  productionPlanId: string | null;
  productionPlan?: { id: string; style: string; productionDate: string } | null;
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
  requiredQuantity: number;
  currentStock: number;
  reservedByOthers: number;
  incomingQuantity: number;
  missingQuantity: number;
  isCritical: boolean;
  actionStatus: ActionStatus;
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

export interface RequirementAnalysis {
  materialId: string;
  materialName: string;
  unit: string;
  requiredQuantity: number;
  currentStock: number;
  reservedByOthers: number;
  incomingQuantity: number;
  effectiveAvailable: number;
  missingQuantity: number;
  isCritical: boolean;
  actionStatus: ActionStatus;
  bestExpectedDelivery: string | null;
  supplierName: string | null;
  daysToOrder: number;
}

export interface JITSummary {
  requirements: {
    orderNow: number;
    orderSoon: number;
    covered: number;
    ok: number;
  };
  criticalItems: InventoryRow[];
  urgentPlans: ProductionPlan[];
}

export interface DashboardSummary {
  alerts: { red: number; yellow: number; green: number; none: number; critical: number };
  totalMaterials: number;
  upcoming: {
    plans: (ProductionPlan & { hasCriticalRequirements: boolean })[];
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
