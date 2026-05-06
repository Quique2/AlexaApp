export type Role = "DEVELOPER" | "SUPERVISOR" | "OPERATOR" | "TRANSPORTER";

export const canApproveProduction = (role: Role) =>
  role === "DEVELOPER" || role === "SUPERVISOR";

export const canCreateMaterial = (role: Role) =>
  role === "DEVELOPER" || role === "SUPERVISOR";

export const canEditPrices = (role: Role) =>
  role === "DEVELOPER" || role === "SUPERVISOR";

export const canImportInventory = (role: Role) =>
  role === "DEVELOPER" || role === "SUPERVISOR";

export const canBlockEntities = (role: Role) => role === "DEVELOPER";

export const canManageUsers = (role: Role) =>
  role === "DEVELOPER" || role === "SUPERVISOR";

// Supervisor cannot modify or reset a Developer user
export const canModifyUser = (actorRole: Role, targetRole: Role): boolean => {
  if (actorRole === "DEVELOPER") return true;
  if (actorRole === "SUPERVISOR") return targetRole !== "DEVELOPER";
  return false;
};

// Supervisor cannot assign the Developer role
export const canAssignRole = (actorRole: Role, targetRole: Role): boolean => {
  if (actorRole === "DEVELOPER") return true;
  if (actorRole === "SUPERVISOR") return targetRole !== "DEVELOPER";
  return false;
};
