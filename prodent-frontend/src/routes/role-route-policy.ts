export type RoleRouteGroup =
  | "assistant"
  | "accountant"
  | "manager"
  | "clinic-admin"
  | "crm"
  | "medical"
  | "doctor";

export interface RoleAccessSnapshot {
  globalRoles?: readonly string[];
  membershipRoles?: readonly string[];
  resolvedRole?: string | null;
}

type RoleRouteRule = {
  globalRoles: ReadonlySet<string>;
  membershipRoles: ReadonlySet<string>;
};

const roleRouteRules: Record<RoleRouteGroup, RoleRouteRule> = {
  assistant: {
    globalRoles: new Set(["assistant", "super_admin"]),
    membershipRoles: new Set(["assistant"]),
  },
  accountant: {
    globalRoles: new Set(["accountant", "super_admin"]),
    membershipRoles: new Set(["accountant"]),
  },
  manager: {
    globalRoles: new Set(["clinic_manager", "super_admin"]),
    membershipRoles: new Set(["clinic_manager", "clinic_admin"]),
  },
  "clinic-admin": {
    globalRoles: new Set(["clinic_admin", "super_admin", "admin"]),
    membershipRoles: new Set(["clinic_admin"]),
  },
  crm: {
    globalRoles: new Set(),
    membershipRoles: new Set(),
  },
  medical: {
    globalRoles: new Set(),
    membershipRoles: new Set(),
  },
  doctor: {
    globalRoles: new Set(),
    membershipRoles: new Set(),
  },
};

const crmResolvedRoles = new Set([
  "super_admin",
  "admin",
  "doctor",
  "clinic_admin",
  "clinic_manager",
  "assistant",
  "accountant",
]);

const medicalResolvedRoles = new Set([
  "super_admin",
  "admin",
  "doctor",
  "clinic_admin",
  "clinic_manager",
]);

function containsAllowedRole(
  actualRoles: readonly string[] | undefined,
  allowedRoles: ReadonlySet<string>,
) {
  return actualRoles?.some((role) => allowedRoles.has(role)) ?? false;
}

export function canAccessRoleRoute(
  group: RoleRouteGroup,
  access: RoleAccessSnapshot,
) {
  if (group === "medical") {
    return access.resolvedRole
      ? medicalResolvedRoles.has(access.resolvedRole)
      : false;
  }

  if (group === "crm" || group === "doctor") {
    return access.resolvedRole
      ? crmResolvedRoles.has(access.resolvedRole)
      : false;
  }

  const rule = roleRouteRules[group];

  return (
    containsAllowedRole(access.globalRoles, rule.globalRoles) ||
    containsAllowedRole(access.membershipRoles, rule.membershipRoles)
  );
}
