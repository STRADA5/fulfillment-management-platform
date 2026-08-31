"use client";

import { useActionState } from "react";

import {
  inviteMemberAction,
  removeMembershipAction,
  setProfileStatusAction,
  updateMembershipAction,
  type AdminActionState,
} from "@/lib/admin/membership-actions";

const initialState: AdminActionState = {};

export type RoleOption = { id: string; code: string; name: string };
export type MembershipItem = {
  id: string;
  userId: string;
  displayName: string;
  profileStatus: "active" | "inactive" | "suspended";
  roleId: string;
  roleName: string;
  status: "invited" | "active" | "inactive" | "suspended";
  isPrimary: boolean;
  isSelf: boolean;
};

function ActionMessage({ state }: { state: AdminActionState }) {
  if (state.error) return <p role="alert" className="text-sm text-red-700">{state.error}</p>;
  if (state.success) return <p role="status" className="text-sm text-emerald-700">{state.success}</p>;
  return null;
}

function InviteForm({ organizationId, roles }: { organizationId: string; roles: RoleOption[] }) {
  const [state, action, pending] = useActionState(inviteMemberAction, initialState);
  return (
    <form action={action} className="mt-6 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <label className="text-sm font-medium text-slate-700">
        Email address
        <input name="email" type="email" required autoComplete="email" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Role
        <select name="roleId" required className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950">
          {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        First name
        <input name="firstName" maxLength={80} autoComplete="given-name" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Last name
        <input name="lastName" maxLength={80} autoComplete="family-name" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" />
      </label>
      <div className="flex items-center gap-4 sm:col-span-2">
        <button disabled={pending || roles.length === 0} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "Creating invitation…" : "Invite user"}
        </button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

function MembershipRow({ item, organizationId, roles, canManageProfiles }: {
  item: MembershipItem;
  organizationId: string;
  roles: RoleOption[];
  canManageProfiles: boolean;
}) {
  const [updateState, updateAction, updating] = useActionState(updateMembershipAction, initialState);
  const [removeState, removeAction, removing] = useActionState(removeMembershipAction, initialState);
  const [profileState, profileAction, profileUpdating] = useActionState(setProfileStatusAction, initialState);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{item.displayName}</h3>
          <p className="mt-1 font-mono text-xs text-slate-500">{item.userId}</p>
        </div>
        <div className="flex gap-2 text-xs">
          {item.isPrimary ? <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">Primary</span> : null}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">Profile: {item.profileStatus}</span>
        </div>
      </div>

      {item.isSelf ? (
        <p className="mt-5 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Your own membership cannot be changed from this administration form.</p>
      ) : (
        <form action={updateAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="membershipId" value={item.id} />
          <label className="text-sm font-medium text-slate-700">
            Role
            <select name="roleId" defaultValue={item.roleId} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Membership status
            <select name="status" defaultValue={item.status === "invited" ? "active" : item.status} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
          <button disabled={updating} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">
            {updating ? "Saving…" : "Save"}
          </button>
          <div className="sm:col-span-3"><ActionMessage state={updateState} /></div>
        </form>
      )}

      {!item.isSelf && canManageProfiles ? (
        <form action={profileAction} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
          <input type="hidden" name="userId" value={item.userId} />
          <label className="text-sm font-medium text-slate-700">
            Global profile status
            <select name="status" defaultValue={item.profileStatus} className="mt-1.5 block rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
          <button disabled={profileUpdating} className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50">
            {profileUpdating ? "Saving…" : "Update profile"}
          </button>
          <ActionMessage state={profileState} />
        </form>
      ) : null}

      {!item.isSelf ? (
        <form action={removeAction} className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="membershipId" value={item.id} />
          <button disabled={removing} className="text-sm font-semibold text-red-700 disabled:opacity-50">
            {removing ? "Removing…" : "Remove membership"}
          </button>
          <ActionMessage state={removeState} />
        </form>
      ) : null}
    </article>
  );
}

export function MembershipAdministration({
  organizationId,
  roles,
  memberships,
  canManageProfiles,
  showInviteForm = true,
  showMembershipList = true,
}: {
  organizationId: string;
  roles: RoleOption[];
  memberships: MembershipItem[];
  canManageProfiles: boolean;
  showInviteForm?: boolean;
  showMembershipList?: boolean;
}) {
  return (
    <>
      {showInviteForm ? <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Invite a user</h2>
        <p className="mt-1 text-sm text-slate-600">The selected role is checked by both the server action and database authorization policy.</p>
        <InviteForm organizationId={organizationId} roles={roles} />
      </section> : null}
      {showMembershipList ? <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-950">Organization memberships</h2>
        <div className="mt-4 grid gap-4">
          {memberships.length ? memberships.map((item) => (
            <MembershipRow key={item.id} item={item} organizationId={organizationId} roles={roles} canManageProfiles={canManageProfiles} />
          )) : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No memberships found.</p>}
        </div>
      </section> : null}
    </>
  );
}
