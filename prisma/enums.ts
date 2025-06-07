// Manually define the Prisma enums to avoid TypeScript issues
export enum UserRole {
  SUPERADMIN = "SUPERADMIN",
  ADMIN = "ADMIN",
  COMPANY = "COMPANY",
  EMPLOYEE = "EMPLOYEE"
}

export enum EmployeeSubrole {
  OPERATOR = "OPERATOR",
  DRIVER = "DRIVER",
  TRANSPORTER = "TRANSPORTER",
  GUARD = "GUARD"
}

export enum SessionStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED"
}

export enum SealStatus {
  VERIFIED = "VERIFIED",
  MISSING = "MISSING",
  BROKEN = "BROKEN",
  TAMPERED = "TAMPERED"
}

export enum TransactionReason {
  ADMIN_CREATION = "ADMIN_CREATION",
  OPERATOR_CREATION = "OPERATOR_CREATION",
  COIN_ALLOCATION = "COIN_ALLOCATION",
  SESSION_CREATION = "SESSION_CREATION"
}

export enum ActivityAction {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
  TRANSFER = "TRANSFER",
  ALLOCATE = "ALLOCATE",
  VIEW = "VIEW"
}

export enum VehicleStatus {
  ACTIVE = "ACTIVE",
  BUSY = "BUSY",
  INACTIVE = "INACTIVE",
  MAINTENANCE = "MAINTENANCE"
}

export enum VehicleType {
  TRUCK = "TRUCK",
  TRAILER = "TRAILER",
  CONTAINER = "CONTAINER",
  TANKER = "TANKER",
  OTHER = "OTHER"
}

export enum CommentUrgency {
  NA = "NA",
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH"
} 