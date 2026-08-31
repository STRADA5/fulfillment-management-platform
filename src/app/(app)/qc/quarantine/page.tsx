import Link from "next/link";
import { CatalogForm } from "@/components/catalog/catalog-form";
import { CatalogList } from "@/components/catalog/catalog-list";
import { PageHeading } from "@/components/ui/page-heading";
import { can, requirePermission } from "@/lib/auth/authorization";
import { resolveInventoryHold } from "@/lib/procurement/actions";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
 const context=await requirePermission("qc.view"),s=await createClient();
 const [{data:holds},{data:decisions},{data:balances}]=await Promise.all([
  s.from("inventory_transactions").select("id,lot_id,warehouse_id,location_id,quarantined_delta,reason,created_at").eq("transaction_type","quarantine").eq("reference_type","quarantine"),
  s.from("qc_hold_decisions").select("id,quarantine_transaction_id,approved_quantity,rejected_quantity,reason,actor_user_id,created_at"),
  s.from("inventory_availability").select("lot_id,warehouse_id,location_id,quarantined_quantity,eligible_available_quantity").gt("quarantined_quantity",0),
 ]);
 const pending=(holds??[]).map(h=>({...h,unresolved:Number(h.quarantined_delta)-(decisions??[]).filter(d=>d.quarantine_transaction_id===h.id).reduce((n,d)=>n+Number(d.approved_quantity)+Number(d.rejected_quantity),0)})).filter(h=>h.unresolved>0);
 return <><PageHeading title="Quarantine decisions" description="QC-held receipts use inspection release. Subsequent operational holds require a separate immutable QC decision."/>
 <div className="my-4 flex gap-4"><Link href="/inventory/adjustments">Place stock into quarantine</Link><Link href="/qc">Receipt QC and release</Link></div>
 {can(context,"qc.release")?<CatalogForm title="Resolve operational hold" action={resolveInventoryHold} fields={[
  {name:"transactionId",label:"Quarantine event",required:true,options:pending.map(h=>({value:String(h.id),label:`${h.id}: ${h.unresolved} held — ${h.reason}`}))},
  {name:"approved",label:"Approved quantity",type:"number",required:true},{name:"rejected",label:"Rejected quantity",type:"number",required:true},
  {name:"reason",label:"QC decision reason",required:true},{name:"requestKey",label:"Idempotency key",required:true},
 ]}/>:null}
 <CatalogList title="Quarantined inventory" rows={balances??[]}/><CatalogList title="Pending operational holds" rows={pending}/><CatalogList title="Hold decision history" rows={decisions??[]}/></>;
}
