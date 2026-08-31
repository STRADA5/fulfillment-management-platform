import { MembershipAdministration } from "@/components/admin/membership-administration";
import { PageHeading } from "@/components/ui/page-heading";
import { loadMembershipPageData } from "@/lib/admin/membership-page-data";

export default async function MembershipsPage() {
  const data = await loadMembershipPageData();
  if (!data) return null;
  return (
    <>
      <PageHeading title="Memberships" description={`Manage role and access status within ${data.organizationName}.`} />
      <MembershipAdministration {...data} memberships={data.memberships.filter((item) => item.status !== "invited")} showInviteForm={false} />
    </>
  );
}
