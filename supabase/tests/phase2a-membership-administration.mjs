import { createClient } from "@supabase/supabase-js";

const url = process.env.LOCAL_SUPABASE_URL;
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRoleKey || !url.includes("127.0.0.1")) {
  throw new Error("Phase 2A tests require local Supabase credentials at 127.0.0.1.");
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = createClient(url, serviceRoleKey, options);
const anonymous = createClient(url, anonKey, options);
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `Phase2A-${runId}-Aa1!`;
const createdUserIds = [];
const createdOrganizationIds = [];
const results = [];

const rows = (value) => Array.isArray(value) ? value : [];
const record = (number, name, passed, detail) => results.push({ number, name, passed, detail });

async function createUser(label) {
  const email = `phase2a-${label}-${runId}@example.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `Phase 2A ${label}` },
  });
  if (error || !data.user) throw error ?? new Error(`Unable to create ${label}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email };
}

async function createInvitedAuthUser(label) {
  const email = `phase2a-${label}-${runId}@example.test`;
  const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
    data: { display_name: `Phase 2A ${label}` },
  });
  if (error || !data.user) throw error ?? new Error(`Unable to invite ${label}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email };
}

async function enableInvitedLogin(user) {
  const { error } = await service.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) throw error;
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
  const { data, error } = await service.from("organization_memberships").insert({
    organization_id: organizationId,
    user_id: userId,
    role_id: roleId,
    status,
    is_primary: isPrimary,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function main() {
  const users = {
    adminA: await createUser("admin-a"),
    adminB: await createUser("admin-b"),
    normalA: await createUser("normal-a"),
    normalB: await createUser("normal-b"),
    multi: await createUser("multi"),
    suspended: await createUser("suspended"),
    superAdmin: await createUser("super"),
    forbiddenTarget: await createUser("forbidden-target"),
  };
  const invited = await createInvitedAuthUser("invited");

  const { data: roleRows, error: rolesError } = await service.from("roles").select("id, code");
  if (rolesError) throw rolesError;
  const roles = Object.fromEntries(roleRows.map((role) => [role.code, role.id]));
  const suffix = runId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const orgA = await createOrganization({ name: "Phase 2A Organization A", slug: `phase2a-a-${suffix}`, organization_type: "fulfillment_company" });
  const orgB = await createOrganization({ name: "Phase 2A Organization B", slug: `phase2a-b-${suffix}`, organization_type: "fulfillment_company" });
  const { data: existingPlatform } = await service.from("organizations").select("id").eq("organization_type", "platform_owner").maybeSingle();
  const platformOrg = existingPlatform?.id ?? await createOrganization({ name: "Phase 2A Platform", slug: `phase2a-platform-${suffix}`, organization_type: "platform_owner" });

  const memberships = {
    adminA: await createMembership(orgA, users.adminA.id, roles.ADMIN),
    adminB: await createMembership(orgB, users.adminB.id, roles.ADMIN),
    normalA: await createMembership(orgA, users.normalA.id, roles.STAFF),
    normalB: await createMembership(orgB, users.normalB.id, roles.STAFF),
    multiA: await createMembership(orgA, users.multi.id, roles.STAFF),
    suspendedA: await createMembership(orgA, users.suspended.id, roles.STAFF),
    superAdmin: await createMembership(platformOrg, users.superAdmin.id, roles.SUPER_ADMIN),
  };
  await service.from("profiles").update({ status: "suspended" }).eq("id", users.suspended.id);

  const [adminA, adminB, normalA, multiClient, suspendedClient, superClient] = await Promise.all([
    signIn(users.adminA), signIn(users.adminB), signIn(users.normalA), signIn(users.multi), signIn(users.suspended), signIn(users.superAdmin),
  ]);

  // 1. Authorized invitation creates a pending membership and audit event.
  const invitation = await adminA.rpc("admin_invite_organization_member", {
    target_organization_id: orgA,
    target_user_id: invited.id,
    target_role_id: roles.STAFF,
  });
  const { data: invitedMembership } = await service.from("organization_memberships").select("id, status").eq("organization_id", orgA).eq("user_id", invited.id).single();
  const { data: invitationAudit } = await service.from("audit_logs").select("id").eq("action", "membership.invited").eq("entity_id", invitedMembership?.id).maybeSingle();
  record(1, "Authorized invitation", !invitation.error && invitedMembership?.status === "invited" && Boolean(invitationAudit), "Authorized ADMIN created an invited membership and transactional audit event.");

  // 2. Cross-tenant and anonymous invitations are denied.
  const crossTenantInvite = await adminA.rpc("admin_invite_organization_member", { target_organization_id: orgB, target_user_id: users.forbiddenTarget.id, target_role_id: roles.STAFF });
  const anonymousInvite = await anonymous.rpc("admin_invite_organization_member", { target_organization_id: orgA, target_user_id: users.forbiddenTarget.id, target_role_id: roles.STAFF });
  const { data: forbiddenMemberships } = await service.from("organization_memberships").select("id").eq("user_id", users.forbiddenTarget.id);
  record(2, "Invitation tenant boundary", Boolean(crossTenantInvite.error) && Boolean(anonymousInvite.error) && rows(forbiddenMemberships).length === 0, "Cross-tenant and anonymous invitation calls created no membership.");

  // 3. Disallowed role assignment and ordinary-user invitations are denied.
  const assignSuper = await adminA.rpc("admin_invite_organization_member", { target_organization_id: orgA, target_user_id: users.forbiddenTarget.id, target_role_id: roles.SUPER_ADMIN });
  const normalInvite = await normalA.rpc("admin_invite_organization_member", { target_organization_id: orgA, target_user_id: users.forbiddenTarget.id, target_role_id: roles.STAFF });
  record(3, "Invitation role enforcement", Boolean(assignSuper.error) && Boolean(normalInvite.error), "ADMIN could not assign SUPER_ADMIN and STAFF could not invite.");

  // 4. Invite acceptance is self-only, activates the membership, chooses a primary, and audits.
  await enableInvitedLogin(invited);
  const invitedClient = await signIn(invited);
  const acceptInvite = await invitedClient.rpc("accept_my_organization_invitations");
  const { data: acceptedMembership } = await service.from("organization_memberships").select("status, is_primary").eq("id", invitedMembership.id).single();
  const { data: acceptanceAudit } = await service.from("audit_logs").select("id").eq("action", "membership.invitation_accepted").eq("entity_id", invitedMembership.id).maybeSingle();
  record(4, "Invitation acceptance", !acceptInvite.error && acceptInvite.data === 1 && acceptedMembership.status === "active" && acceptedMembership.is_primary && Boolean(acceptanceAudit), "Invitee activated only the pre-authorized invitation and received a primary membership.");

  // 5. Authorized membership role/status changes work and are audited.
  const updateRole = await adminA.rpc("admin_update_organization_membership", { target_membership_id: memberships.normalA, target_role_id: roles.WAREHOUSE, target_status: "active" });
  const suspendMembership = await adminA.rpc("admin_update_organization_membership", { target_membership_id: memberships.normalA, target_role_id: roles.WAREHOUSE, target_status: "suspended" });
  const { data: updatedMembership } = await service.from("organization_memberships").select("role_id, status, is_primary").eq("id", memberships.normalA).single();
  const { data: updateAudits } = await service.from("audit_logs").select("id").eq("action", "membership.updated").eq("entity_id", memberships.normalA);
  record(5, "Authorized membership administration", !updateRole.error && !suspendMembership.error && updatedMembership.role_id === roles.WAREHOUSE && updatedMembership.status === "suspended" && !updatedMembership.is_primary && rows(updateAudits).length === 2, "Authorized role and suspension changes were applied and audited.");

  // 6. Self-modification, cross-tenant modification, and role escalation remain denied.
  const adminSelfUpdate = await adminA.rpc("admin_update_organization_membership", { target_membership_id: memberships.adminA, target_role_id: roles.STAFF, target_status: "active" });
  const adminSelfRemove = await adminA.rpc("admin_remove_organization_membership", { target_membership_id: memberships.adminA });
  const crossTenantUpdate = await adminA.rpc("admin_update_organization_membership", { target_membership_id: memberships.normalB, target_role_id: roles.STAFF, target_status: "suspended" });
  const elevateTarget = await adminA.rpc("admin_update_organization_membership", { target_membership_id: memberships.normalA, target_role_id: roles.SUPER_ADMIN, target_status: "active" });
  record(6, "Membership anti-escalation", Boolean(adminSelfUpdate.error) && Boolean(adminSelfRemove.error) && Boolean(crossTenantUpdate.error) && Boolean(elevateTarget.error), "Self, cross-tenant, and elevated-role mutations were denied.");

  // 7. A user can select only their own active membership as primary.
  const inviteMultiB = await adminB.rpc("admin_invite_organization_member", { target_organization_id: orgB, target_user_id: users.multi.id, target_role_id: roles.STAFF });
  const acceptMulti = await multiClient.rpc("accept_my_organization_invitations");
  const { data: multiBMembership } = await service.from("organization_memberships").select("id").eq("organization_id", orgB).eq("user_id", users.multi.id).single();
  const setPrimary = await multiClient.rpc("set_my_primary_organization", { target_membership_id: multiBMembership.id });
  const setOtherPrimary = await multiClient.rpc("set_my_primary_organization", { target_membership_id: memberships.normalB });
  const { data: multiMemberships } = await service.from("organization_memberships").select("id, is_primary").eq("user_id", users.multi.id);
  record(7, "Primary organization selection", !inviteMultiB.error && !acceptMulti.error && !setPrimary.error && Boolean(setOtherPrimary.error) && multiMemberships.filter((row) => row.is_primary).length === 1 && multiMemberships.find((row) => row.id === multiBMembership.id)?.is_primary === true, "User selected exactly one own active membership and could not select another user's membership.");

  // 8. Suspended profiles cannot accept invitations, set primary, or receive activated membership.
  await service.from("organization_memberships").insert({ organization_id: orgB, user_id: users.suspended.id, role_id: roles.STAFF, status: "invited", is_primary: false });
  const suspendedAccept = await suspendedClient.rpc("accept_my_organization_invitations");
  const suspendedPrimary = await suspendedClient.rpc("set_my_primary_organization", { target_membership_id: memberships.suspendedA });
  const activateSuspended = await adminA.rpc("admin_update_organization_membership", { target_membership_id: memberships.suspendedA, target_role_id: roles.STAFF, target_status: "active" });
  record(8, "Suspended-user administration boundary", Boolean(suspendedAccept.error) && Boolean(suspendedPrimary.error) && Boolean(activateSuspended.error), "Suspended profile could not regain access through invitation, primary selection, or membership activation.");

  // 9. Only super-admin can globally suspend/reactivate profiles, and both changes are audited.
  const adminProfileSuspend = await adminA.rpc("admin_set_profile_status", { target_user_id: users.normalB.id, target_status: "suspended" });
  const superSuspend = await superClient.rpc("admin_set_profile_status", { target_user_id: users.normalB.id, target_status: "suspended" });
  const superReactivate = await superClient.rpc("admin_set_profile_status", { target_user_id: users.normalB.id, target_status: "active" });
  const superSelfSuspend = await superClient.rpc("admin_set_profile_status", { target_user_id: users.superAdmin.id, target_status: "suspended" });
  const { data: profileAudits } = await service.from("audit_logs").select("id").eq("action", "profile.status_changed").eq("entity_id", users.normalB.id);
  record(9, "Global profile status authorization", Boolean(adminProfileSuspend.error) && !superSuspend.error && !superReactivate.error && Boolean(superSelfSuspend.error) && rows(profileAudits).length === 2, "Only super-admin changed another profile; self-suspension was denied and changes were audited.");

  // 10. Audit records are complete and immutable to ordinary authenticated users.
  const forgedAudit = await normalA.from("audit_logs").insert({ organization_id: orgA, actor_user_id: users.normalA.id, action: "forged", entity_type: "membership" });
  const modifyAudit = await adminA.from("audit_logs").update({ action: "rewritten" }).eq("action", "membership.invited");
  const { data: phase2AuditRows } = await service.from("audit_logs").select("action").in("action", ["membership.invited", "membership.invitation_accepted", "membership.updated", "membership.primary_changed", "profile.status_changed"]);
  const actions = new Set(phase2AuditRows.map((row) => row.action));
  record(10, "Trusted audit logging", Boolean(forgedAudit.error) && Boolean(modifyAudit.error) && ["membership.invited", "membership.invitation_accepted", "membership.updated", "membership.primary_changed", "profile.status_changed"].every((action) => actions.has(action)), "Required administrative events exist and authenticated clients cannot forge or rewrite them.");
}

async function cleanup() {
  if (createdUserIds.length) await service.from("audit_logs").delete().in("actor_user_id", createdUserIds);
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
