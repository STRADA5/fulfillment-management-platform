import { MembershipAdministration } from "@/components/admin/membership-administration";
import { PageHeading } from "@/components/ui/page-heading";
import { loadMembershipPageData } from "@/lib/admin/membership-page-data";

export default async function UsersPage() {
  const data = await loadMembershipPageData();
  if (!data) return null;

  return (
    <>
      <PageHeading title="Users" description={`View and manage authorized users for ${data.organizationName}.`} />
      <MembershipAdministration
        organizationId={data.organizationId}
        roles={data.roles}
        memberships={data.memberships}
        canManageProfiles={data.canManageProfiles}
        showInviteForm={false}
      />
    </>
  );
}
