import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { primaryNavigation } from "@/config/navigation";
import { can, getAppContext } from "@/lib/auth/authorization";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const context = await getAppContext();
  const navigation = primaryNavigation.filter((item) => !item.permission || can(context, item.permission));

  return (
    <AppShell
      navigation={navigation}
      organizationName={context.membership?.organizationName ?? "No active organization"}
      displayName={context.profile.displayName}
      email={context.user.email}
      currentMembershipId={context.membership?.id}
      memberships={context.memberships.map((membership) => ({
        id: membership.id,
        organizationName: membership.organizationName,
        roleCode: membership.roleCode,
      }))}
    >
      {children}
    </AppShell>
  );
}
