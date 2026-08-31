import { notFound } from "next/navigation";
import { CatalogList } from "@/components/catalog/catalog-list";
import { PageHeading } from "@/components/ui/page-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function Page({params}:{params:Promise<{kind:string;id:string}>}){
 const{kind,id}=await params;if(kind!=="receiving"&&kind!=="inspection")notFound();
 const c=await requirePermission(kind==="receiving"?"receiving.view":"qc.view"),s=await createClient(),org=c.membership!.organizationId;
 if(kind==="receiving"){
  const{data:r}=await s.from("receivings").select("id,warehouse_id,receiving_reference,received_at,received_by_user_id,status").eq("organization_id",org).eq("id",id).maybeSingle();if(!r)notFound();
  const{data:lines}=await s.from("receiving_lines").select("id,product_variant_id,lot_id,destination_location_id,quantity_expected,quantity_received,quantity_accepted,quantity_damaged,quantity_rejected,discrepancy_quantity,discrepancy_reason,status,expiration_date,bud_date,qc_required").eq("receiving_id",id);
  return <><PageHeading title="Receiving record" description="Immutable receipt history. Subsequent quality decisions are separate audited events."/><CatalogList title="Receipt" rows={[r]}/><CatalogList title="Receipt lines" rows={lines??[]}/></>;
 }
 const{data:r}=await s.from("qc_inspections").select("*").eq("organization_id",org).eq("id",id).maybeSingle();if(!r)notFound();
 const{data:events}=await s.from("qc_release_events").select("id,quantity,warehouse_id,location_id,actor_user_id,created_at").eq("inspection_id",id);
 return <><PageHeading title="QC inspection record" description="Original decision is append-only. Releases below do not rewrite the inspection."/><CatalogList title="Inspection" rows={[r]}/><CatalogList title="Release history" rows={events??[]}/></>;
}
