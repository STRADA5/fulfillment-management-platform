import { createClient } from "@supabase/supabase-js";

const url = process.env.LOCAL_SUPABASE_URL;
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey || !url.includes("127.0.0.1")) {
  throw new Error("Local Supabase URL and keys are required; the URL must use 127.0.0.1.");
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = createClient(url, serviceRoleKey, options);
const anonymous = createClient(url, anonKey, options);
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `Local-only-${runId}-Aa1!`;
const createdUserIds = [];
const createdOrganizationIds = [];
const results = [];

function record(number, name, passed, detail) {
  results.push({ number, name, passed, detail });
}

function rows(value) {
  return Array.isArray(value) ? value : [];
}

async function createUser(label) {
  const email = `fmp-${label}-${runId}@example.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `Test ${label}` },
  });
  if (error || !data.user) throw error ?? new Error(`Could not create ${label}`);
  createdUserIds.push(data.user.id);
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
  createdOrganizationIds.push(data.id);
  return data.id;
}

async function createMembership(organizationId, userId, roleId, status = "active", isPrimary = true) {
  const { data, error } = await service
    .from("organization_memberships")
    .insert({ organization_id: organizationId, user_id: userId, role_id: roleId, status, is_primary: isPrimary })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function main() {
  const users = {
    normalA: await createUser("normal-a"),
    normalB: await createUser("normal-b"),
    suspended: await createUser("suspended"),
    inactiveOrg: await createUser("inactive-org"),
    superAdmin: await createUser("super-admin"),
    adminA: await createUser("admin-a"),
  };

  const { data: roleRows, error: roleError } = await service.from("roles").select("id, code");
  if (roleError) throw roleError;
  const roles = Object.fromEntries(roleRows.map((role) => [role.code, role.id]));

  const suffix = runId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const orgA = await createOrganization({ name: "Isolation Test Organization A", slug: `test-org-a-${suffix}`, organization_type: "fulfillment_company" });
  const orgB = await createOrganization({ name: "Isolation Test Organization B", slug: `test-org-b-${suffix}`, organization_type: "fulfillment_company" });
  const inactiveOrg = await createOrganization({ name: "Isolation Test Suspended Organization", slug: `test-org-inactive-${suffix}`, organization_type: "fulfillment_company", status: "suspended" });

  const { data: existingPlatform } = await service
    .from("organizations")
    .select("id")
    .eq("organization_type", "platform_owner")
    .maybeSingle();
  const platformOrg = existingPlatform?.id ?? await createOrganization({
    name: "Isolation Test Platform Owner",
    slug: `test-platform-${suffix}`,
    organization_type: "platform_owner",
  });

  const memberships = {
    normalA: await createMembership(orgA, users.normalA.id, roles.STAFF),
    normalB: await createMembership(orgB, users.normalB.id, roles.STAFF),
    suspended: await createMembership(orgA, users.suspended.id, roles.STAFF),
    inactiveOrg: await createMembership(inactiveOrg, users.inactiveOrg.id, roles.STAFF),
    superAdmin: await createMembership(platformOrg, users.superAdmin.id, roles.SUPER_ADMIN),
    adminA: await createMembership(orgA, users.adminA.id, roles.ADMIN),
  };

  const { error: suspendError } = await service.from("profiles").update({ status: "suspended" }).eq("id", users.suspended.id);
  if (suspendError) throw suspendError;

  const [clientA, clientB, suspendedClient, inactiveOrgClient, superClient, adminAClient] = await Promise.all([
    signIn(users.normalA),
    signIn(users.normalB),
    signIn(users.suspended),
    signIn(users.inactiveOrg),
    signIn(users.superAdmin),
    signIn(users.adminA),
  ]);

  // 1. Organization A cannot access Organization B.
  const aReadB = await clientA.from("organizations").select("id").eq("id", orgB);
  const aWriteB = await clientA.from("organizations").update({ name: "Compromised by A" }).eq("id", orgB).select("id");
  const { data: verifiedB } = await service.from("organizations").select("name").eq("id", orgB).single();
  record(1, "Organization A isolation", !aReadB.error && rows(aReadB.data).length === 0 && rows(aWriteB.data).length === 0 && verifiedB.name === "Isolation Test Organization B", "A could neither read nor modify B.");

  // 2. Organization B cannot access Organization A.
  const bReadA = await clientB.from("organizations").select("id").eq("id", orgA);
  const bWriteA = await clientB.from("organizations").update({ name: "Compromised by B" }).eq("id", orgA).select("id");
  const { data: verifiedA } = await service.from("organizations").select("name").eq("id", orgA).single();
  record(2, "Organization B isolation", !bReadA.error && rows(bReadA.data).length === 0 && rows(bWriteA.data).length === 0 && verifiedA.name === "Isolation Test Organization A", "B could neither read nor modify A.");

  // 3. A normal user cannot elevate role, membership, permissions, profile status, or organization authority.
  const selfRoleChange = await clientA.from("organization_memberships").update({ role_id: roles.ADMIN }).eq("id", memberships.normalA).select("id");
  const crossMembership = await clientA.from("organization_memberships").insert({ organization_id: orgB, user_id: users.normalA.id, role_id: roles.STAFF, status: "active" });
  const permission = await service.from("permissions").select("id").eq("code", "security.manage").single();
  const permissionGrant = await clientA.from("role_permissions").insert({ role_id: roles.STAFF, permission_id: permission.data.id });
  const statusChange = await clientA.from("profiles").update({ status: "active" }).eq("id", users.normalA.id);
  const ownOrgWrite = await clientA.from("organizations").update({ name: "Normal user changed org" }).eq("id", orgA).select("id");
  const { data: verifiedMembership } = await service.from("organization_memberships").select("role_id").eq("id", memberships.normalA).single();
  record(3, "Normal-user privilege escalation", rows(selfRoleChange.data).length === 0 && Boolean(crossMembership.error) && Boolean(permissionGrant.error) && Boolean(statusChange.error) && rows(ownOrgWrite.data).length === 0 && verifiedMembership.role_id === roles.STAFF, "Role, membership, permission, status, and organization escalation attempts were denied.");

  // 4. A suspended user cannot reactivate or edit the profile through self-service.
  const suspendedReactivation = await suspendedClient.from("profiles").update({ status: "active" }).eq("id", users.suspended.id);
  const suspendedProfileEdit = await suspendedClient.from("profiles").update({ display_name: "Reactivated" }).eq("id", users.suspended.id);
  const { data: verifiedSuspendedProfile } = await service.from("profiles").select("status, display_name").eq("id", users.suspended.id).single();
  record(4, "Suspended-user self-reactivation", Boolean(suspendedReactivation.error) && rows(suspendedProfileEdit.data).length === 0 && verifiedSuspendedProfile.status === "suspended" && verifiedSuspendedProfile.display_name === "Test suspended", "Suspended profile remained suspended and unchanged.");

  // 5. A suspended user receives no organization, membership, role, or permission-based access.
  const suspendedOrganizations = await suspendedClient.from("organizations").select("id");
  const suspendedMemberships = await suspendedClient.from("organization_memberships").select("id");
  const suspendedRoles = await suspendedClient.from("roles").select("id");
  const suspendedAudit = await suspendedClient.from("audit_logs").select("id");
  record(5, "Suspended-user access denial", rows(suspendedOrganizations.data).length === 0 && rows(suspendedMemberships.data).length === 0 && rows(suspendedRoles.data).length === 0 && rows(suspendedAudit.data).length === 0, "Suspended user received zero protected rows.");

  // 6. A suspended organization cannot grant access through an active user and membership.
  const inactiveOrgRead = await inactiveOrgClient.from("organizations").select("id").eq("id", inactiveOrg);
  const inactiveOrgWrite = await inactiveOrgClient.from("organizations").update({ name: "Reactivated by member" }).eq("id", inactiveOrg).select("id");
  const inactiveOrgMembershipInsert = await inactiveOrgClient.from("organization_memberships").insert({ organization_id: inactiveOrg, user_id: users.normalA.id, role_id: roles.STAFF, status: "active" });
  record(6, "Suspended-organization access denial", rows(inactiveOrgRead.data).length === 0 && rows(inactiveOrgWrite.data).length === 0 && Boolean(inactiveOrgMembershipInsert.error), "Active user and membership did not bypass suspended organization status.");

  // 7. Super-admin has platform-wide RLS access and can perform permitted non-security updates.
  const superRead = await superClient.from("organizations").select("id").in("id", [orgA, orgB, inactiveOrg]);
  const superUpdate = await superClient.from("organizations").update({ contact_phone: "+1-555-0100" }).eq("id", orgA).select("id");
  const superSecurityColumn = await superClient.from("organizations").update({ status: "suspended" }).eq("id", orgA);
  if (superRead.error || rows(superRead.data).length !== 3 || rows(superUpdate.data).length !== 1 || !superSecurityColumn.error) console.error("Super-admin diagnostic", {readError:superRead.error,readCount:rows(superRead.data).length,updateError:superUpdate.error,updateCount:rows(superUpdate.data).length,securityError:superSecurityColumn.error});
  record(7, "Super-admin behavior", !superRead.error && rows(superRead.data).length === 3 && rows(superUpdate.data).length === 1 && Boolean(superSecurityColumn.error), "Super-admin crossed tenant RLS as intended; direct security-column writes remained server-controlled.");

  // 8. Every preceding RLS assertion used a JWT-authenticated client, not the setup client.
  const authChecks = await Promise.all([clientA, clientB, suspendedClient, inactiveOrgClient, superClient, adminAClient].map((client) => client.auth.getUser()));
  record(8, "Authenticated-request RLS", authChecks.every(({ data, error }) => !error && Boolean(data.user)), "All tested user clients held independently authenticated local JWT sessions.");

  // 9. Anonymous access is denied.
  const anonOrganizations = await anonymous.from("organizations").select("id");
  const anonProfiles = await anonymous.from("profiles").select("id");
  const anonMemberships = await anonymous.from("organization_memberships").select("id");
  const anonInsert = await anonymous.from("organizations").insert({ name: "Anonymous Org", slug: `anonymous-${suffix}`, organization_type: "fulfillment_company" });
  record(9, "Anonymous access denial", rows(anonOrganizations.data).length === 0 && rows(anonProfiles.data).length === 0 && rows(anonMemberships.data).length === 0 && Boolean(anonInsert.error), "Anonymous reads returned no protected rows and writes were denied.");

  // 10. An organization admin cannot create SUPER_ADMIN, alter security columns, or touch a platform membership.
  const adminAssignSuper = await adminAClient.from("organization_memberships").update({ role_id: roles.SUPER_ADMIN }).eq("id", memberships.normalA).select("id");
  const adminStatusChange = await adminAClient.from("organizations").update({ status: "suspended" }).eq("id", orgA);
  const adminDeleteSuper = await adminAClient.from("organization_memberships").delete().eq("id", memberships.superAdmin).select("id");
  const normalAuditInsert = await clientA.from("audit_logs").insert({ organization_id: orgA, actor_user_id: users.normalA.id, action: "forged", entity_type: "test" });
  const ownProfileEdit = await clientA.from("profiles").update({ display_name: "Allowed Display Name" }).eq("id", users.normalA.id).select("id");
  record(10, "Additional escalation edges", rows(adminAssignSuper.data).length === 0 && Boolean(adminStatusChange.error) && rows(adminDeleteSuper.data).length === 0 && Boolean(normalAuditInsert.error) && rows(ownProfileEdit.data).length === 1, "Admin escalation and forged audit writes were denied; permitted profile fields remained editable.");
}

async function cleanup() {
  if (createdOrganizationIds.length) await service.from("organizations").delete().in("id", createdOrganizationIds);
  for (const userId of createdUserIds) await service.auth.admin.deleteUser(userId);
}

try {
  await main();
} catch (error) {
  console.error("TEST HARNESS ERROR:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await cleanup();
}

for (const result of results) {
  console.log(`${result.passed ? "PASS" : "FAIL"} ${result.number}: ${result.name} — ${result.detail}`);
}

if (results.length !== 10 || results.some((result) => !result.passed)) process.exitCode = 1;
