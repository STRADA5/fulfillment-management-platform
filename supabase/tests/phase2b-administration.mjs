import { createClient } from "@supabase/supabase-js";

const url = process.env.LOCAL_SUPABASE_URL;
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRoleKey || !url.includes("127.0.0.1")) throw new Error("Phase 2B tests require local Supabase at 127.0.0.1.");

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = createClient(url, serviceRoleKey, options);
const anonymous = createClient(url, anonKey, options);
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `Phase2B-${runId}-Aa1!`;
const userIds = [];
const organizationIds = [];
const cleanupAssignments = [];
const results = [];
const rows = (value) => Array.isArray(value) ? value : [];
const record = (number, name, passed, detail) => results.push({ number, name, passed, detail });

async function createUser(label) {
  const email = `phase2b-${label}-${runId}@example.test`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: `Phase 2B ${label}` } });
  if (error || !data.user) throw error ?? new Error(`Could not create ${label}`);
  userIds.push(data.user.id);
  return { id: data.user.id, email };
}
async function signIn(user) {
  const client = createClient(url, anonKey, options);
  const { error } = await client.auth.signInWithPassword({ email: user.email, password });
  if (error) throw error;
  return client;
}
async function createOrganization(values) {
  const { data, error } = await service.from("organizations").insert(values).select("id").single();
  if (error) throw error;
  organizationIds.push(data.id);
  return data.id;
}
async function createMembership(organizationId, userId, roleId) {
  const { data, error } = await service.from("organization_memberships").insert({ organization_id: organizationId, user_id: userId, role_id: roleId, status: "active", is_primary: true }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function main() {
  const users = {
    superAdmin: await createUser("super"), adminA: await createUser("admin-a"), adminB: await createUser("admin-b"),
    normalA: await createUser("normal-a"), suspendedSuper: await createUser("suspended-super"), inactiveSuper: await createUser("inactive-super"),
  };
  const { data: roleRows } = await service.from("roles").select("id, code");
  const { data: permissionRows } = await service.from("permissions").select("id, code");
  const roles = Object.fromEntries(roleRows.map((item) => [item.code, item.id]));
  const permissions = Object.fromEntries(permissionRows.map((item) => [item.code, item.id]));
  const suffix = runId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const platformOrg = await createOrganization({ name: "Phase 2B Platform", slug: `phase2b-platform-${suffix}`, organization_type: "platform_owner" });
  const orgA = await createOrganization({ name: "Phase 2B Organization A", slug: `phase2b-a-${suffix}`, organization_type: "fulfillment_company" });
  const orgB = await createOrganization({ name: "Phase 2B Organization B", slug: `phase2b-b-${suffix}`, organization_type: "fulfillment_company" });
  const inactiveOrg = await createOrganization({ name: "Phase 2B Inactive", slug: `phase2b-inactive-${suffix}`, organization_type: "fulfillment_company", status: "suspended" });
  await createMembership(platformOrg, users.superAdmin.id, roles.SUPER_ADMIN);
  await createMembership(orgA, users.adminA.id, roles.ADMIN);
  await createMembership(orgB, users.adminB.id, roles.ADMIN);
  const normalMembership = await createMembership(orgA, users.normalA.id, roles.STAFF);
  await createMembership(platformOrg, users.suspendedSuper.id, roles.SUPER_ADMIN);
  await createMembership(inactiveOrg, users.inactiveSuper.id, roles.SUPER_ADMIN);
  await service.from("profiles").update({ status: "suspended" }).eq("id", users.suspendedSuper.id);
  const [superClient, adminA, adminB, suspendedSuper, inactiveSuper] = await Promise.all([
    signIn(users.superAdmin), signIn(users.adminA), signIn(users.adminB), signIn(users.suspendedSuper), signIn(users.inactiveSuper),
  ]);

  // 1. Super-admin can grant a permission to a non-super role and the change is audited.
  cleanupAssignments.push([roles.STAFF, permissions["security.manage"]]);
  const staffSecurityEntity = `${roles.STAFF}:${permissions["security.manage"]}`;
  const grant = await superClient.rpc("admin_set_role_permission", { target_role_id: roles.STAFF, target_permission_id: permissions["security.manage"], should_grant: true });
  const { data: grantedRow } = await service.from("role_permissions").select("role_id").eq("role_id", roles.STAFF).eq("permission_id", permissions["security.manage"]).maybeSingle();
  const { data: grantAudit } = await service.from("audit_logs").select("id").eq("action", "role.permission_granted").eq("entity_id", staffSecurityEntity).order("created_at", { ascending: false }).limit(1);
  record(1, "Authorized permission grant", !grant.error && grant.data === true && Boolean(grantedRow) && rows(grantAudit).length === 1, "Super-admin grant succeeded and was audited.");

  // 2. Super-admin can remove the permission and the removal is audited.
  const removal = await superClient.rpc("admin_set_role_permission", { target_role_id: roles.STAFF, target_permission_id: permissions["security.manage"], should_grant: false });
  const { data: removedRow } = await service.from("role_permissions").select("role_id").eq("role_id", roles.STAFF).eq("permission_id", permissions["security.manage"]).maybeSingle();
  const { data: removalAudit } = await service.from("audit_logs").select("id").eq("action", "role.permission_removed").eq("entity_id", staffSecurityEntity).order("created_at", { ascending: false }).limit(1);
  record(2, "Authorized permission removal", !removal.error && removal.data === true && !removedRow && rows(removalAudit).length === 1, "Super-admin removal succeeded and was audited.");

  // 3. Tenant administrators and anonymous users cannot mutate global assignments.
  const adminGrant = await adminA.rpc("admin_set_role_permission", { target_role_id: roles.STAFF, target_permission_id: permissions["security.manage"], should_grant: true });
  const anonGrant = await anonymous.rpc("admin_set_role_permission", { target_role_id: roles.STAFF, target_permission_id: permissions["security.manage"], should_grant: true });
  record(3, "Unauthorized permission administration", Boolean(adminGrant.error) && Boolean(anonGrant.error), "ADMIN and anon mutations were denied.");

  // 4. Direct table writes are blocked, forcing all authenticated changes through the audited RPC.
  const directSuperWrite = await superClient.from("role_permissions").insert({ role_id: roles.STAFF, permission_id: permissions["security.manage"] });
  const directAdminDelete = await adminA.from("role_permissions").delete().eq("role_id", roles.STAFF);
  record(4, "Audited mutation path enforcement", Boolean(directSuperWrite.error) && Boolean(directAdminDelete.error), "Direct authenticated DML was denied for super-admin and tenant admin.");

  // 5. SUPER_ADMIN permissions cannot be modified.
  const alterSuper = await superClient.rpc("admin_set_role_permission", { target_role_id: roles.SUPER_ADMIN, target_permission_id: permissions["security.manage"], should_grant: false });
  record(5, "SUPER_ADMIN immutability", Boolean(alterSuper.error), "The foundational super-admin permission set could not be downgraded.");

  // 6. Granting roles.manage to ADMIN does not let ADMIN call the super-only mutation RPC.
  cleanupAssignments.push([roles.ADMIN, permissions["roles.manage"]]);
  const grantManage = await superClient.rpc("admin_set_role_permission", { target_role_id: roles.ADMIN, target_permission_id: permissions["roles.manage"], should_grant: true });
  const attemptedEscalation = await adminA.rpc("admin_set_role_permission", { target_role_id: roles.STAFF, target_permission_id: permissions["security.manage"], should_grant: true });
  const removeManage = await superClient.rpc("admin_set_role_permission", { target_role_id: roles.ADMIN, target_permission_id: permissions["roles.manage"], should_grant: false });
  record(6, "Privilege-escalation resistance", !grantManage.error && Boolean(attemptedEscalation.error) && !removeManage.error, "Possessing roles.manage did not bypass the explicit super-admin requirement.");

  // 7. Suspended profiles and inactive organizations cannot confer super-admin mutation access.
  const suspendedAttempt = await suspendedSuper.rpc("admin_set_role_permission", { target_role_id: roles.STAFF, target_permission_id: permissions["security.manage"], should_grant: true });
  const inactiveAttempt = await inactiveSuper.rpc("admin_set_role_permission", { target_role_id: roles.STAFF, target_permission_id: permissions["security.manage"], should_grant: true });
  record(7, "Active security context enforcement", Boolean(suspendedAttempt.error) && Boolean(inactiveAttempt.error), "Suspended profile and suspended organization both denied mutation authority.");

  // 8. Tenant audit visibility remains isolated while super-admin can see platform-wide events.
  await adminA.rpc("admin_update_organization_membership", { target_membership_id: normalMembership, target_role_id: roles.WAREHOUSE, target_status: "active" });
  const auditA = await adminA.from("audit_logs").select("id").eq("organization_id", orgA).eq("action", "membership.updated");
  const auditB = await adminB.from("audit_logs").select("id").eq("organization_id", orgA).eq("action", "membership.updated");
  const auditSuper = await superClient.from("audit_logs").select("id").eq("organization_id", orgA).eq("action", "membership.updated");
  record(8, "Audit-log tenant isolation", rows(auditA.data).length === 1 && rows(auditB.data).length === 0 && rows(auditSuper.data).length === 1, "Organization A saw its event, B did not, and super-admin did.");

  // 9. Audit records remain immutable and cannot be forged.
  const rewriteAudit = await adminA.from("audit_logs").update({ action: "rewritten" }).eq("organization_id", orgA);
  const deleteAudit = await superClient.from("audit_logs").delete().eq("organization_id", orgA);
  const forgeAudit = await adminA.from("audit_logs").insert({ organization_id: orgA, actor_user_id: users.adminA.id, action: "forged", entity_type: "role" });
  record(9, "Audit immutability", Boolean(rewriteAudit.error) && Boolean(deleteAudit.error) && Boolean(forgeAudit.error), "Authenticated users, including super-admin, could not rewrite, delete, or forge audit rows.");

  // 10. Authorized users retain read access to definitions; suspended and anonymous users do not.
  const adminRoles = await adminA.from("roles").select("id");
  const suspendedRoles = await suspendedSuper.from("roles").select("id");
  const anonRoles = await anonymous.from("roles").select("id");
  record(10, "Definition read authorization", rows(adminRoles.data).length === 6 && rows(suspendedRoles.data).length === 0 && rows(anonRoles.data).length === 0, "Active authorized user could view definitions; suspended and anonymous users could not.");
}

async function cleanup() {
  for (const [roleId, permissionId] of cleanupAssignments) await service.from("role_permissions").delete().eq("role_id", roleId).eq("permission_id", permissionId);
  if (userIds.length) await service.from("audit_logs").delete().in("actor_user_id", userIds);
  if (organizationIds.length) await service.from("organizations").delete().in("id", organizationIds);
  for (const userId of userIds) await service.auth.admin.deleteUser(userId);
}

try { await main(); } catch (error) { console.error("TEST HARNESS ERROR:", error instanceof Error ? error.message : error); process.exitCode = 1; } finally { await cleanup(); }
for (const result of results) console.log(`${result.passed ? "PASS" : "FAIL"} ${result.number}: ${result.name} — ${result.detail}`);
if (results.length !== 10 || results.some((result) => !result.passed)) process.exitCode = 1;
