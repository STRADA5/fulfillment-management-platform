const permittedRoles: Record<string, string[]> = {
  SUPER_ADMIN: ["SUPER_ADMIN", "ADMIN", "STAFF", "WAREHOUSE", "CLIENT_ADMIN", "CLIENT_USER"],
  ADMIN: ["ADMIN", "STAFF", "WAREHOUSE"],
  CLIENT_ADMIN: ["CLIENT_ADMIN", "CLIENT_USER"],
};

export function getPermittedRoleCodes(actorRoleCode: string) {
  return permittedRoles[actorRoleCode] ?? [];
}
