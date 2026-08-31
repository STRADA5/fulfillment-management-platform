"use client";

import { useActionState } from "react";

import {
  setRolePermissionAction,
  type RolePermissionActionState,
} from "@/lib/admin/role-permission-actions";

const initialState: RolePermissionActionState = {};

export type PermissionDefinition = { id: string; code: string; name: string; description: string };
export type RoleDefinition = {
  id: string;
  code: string;
  name: string;
  description: string;
  permissionIds: string[];
};

function PermissionControl({ role, permission, assigned, editable }: {
  role: RoleDefinition;
  permission: PermissionDefinition;
  assigned: boolean;
  editable: boolean;
}) {
  const [state, action, pending] = useActionState(setRolePermissionAction, initialState);
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{permission.name}</p>
          <p className="mt-0.5 font-mono text-xs text-slate-500">{permission.code}</p>
        </div>
        {editable ? (
          <form action={action}>
            <input type="hidden" name="roleId" value={role.id} />
            <input type="hidden" name="permissionId" value={permission.id} />
            <input type="hidden" name="operation" value={assigned ? "remove" : "grant"} />
            <button
              disabled={pending}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${assigned ? "border border-red-200 text-red-700" : "bg-slate-950 text-white"}`}
            >
              {pending ? "Saving…" : assigned ? "Remove" : "Grant"}
            </button>
          </form>
        ) : (
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${assigned ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {assigned ? "Assigned" : "Not assigned"}
          </span>
        )}
      </div>
      {state.error ? <p role="alert" className="mt-2 text-xs text-red-700">{state.error}</p> : null}
      {state.success ? <p role="status" className="mt-2 text-xs text-emerald-700">{state.success}</p> : null}
    </li>
  );
}

export function RolePermissionAdministration({ roles, permissions, canEdit }: {
  roles: RoleDefinition[];
  permissions: PermissionDefinition[];
  canEdit: boolean;
}) {
  return (
    <div className="mt-8 space-y-6">
      {roles.map((role) => (
        <section key={role.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{role.name}</h2>
              <p className="mt-1 font-mono text-xs text-slate-500">{role.code}</p>
              <p className="mt-3 max-w-3xl text-sm text-slate-600">{role.description}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {role.permissionIds.length} permissions
            </span>
          </div>
          {role.code === "SUPER_ADMIN" && canEdit ? (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">SUPER_ADMIN permissions are immutable.</p>
          ) : null}
          <ul className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {permissions.map((permission) => (
              <PermissionControl
                key={permission.id}
                role={role}
                permission={permission}
                assigned={role.permissionIds.includes(permission.id)}
                editable={canEdit && role.code !== "SUPER_ADMIN"}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
