import { MembershipAdministration } from "@/components/admin/membership-administration";
import { PageHeading } from "@/components/ui/page-heading";
import { loadMembershipPageData } from "@/lib/admin/membership-page-data";
import { requirePermission } from "@/lib/auth/authorization";

export default async function InvitationsPage() {
  await requirePermission("memberships.manage");
  const data = await loadMembershipPageData();
  if (!data) return null;
  return (
    <>
      <PageHeading title="Invitations" description={`Invite users and review pending access for ${data.organizationName}.`} />
      <MembershipAdministration {...data} memberships={data.memberships.filter((item) => item.status === "invited")} />
    </>
  );
}
