"use client";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { submitOrder, type OrderState } from "@/lib/orders/actions";

type Customer={id:string;name:string;number:string};type Address={id:string;customer_id:string;label:string;recipient:string;line1:string;city:string};
type Item={entry_id:string;display_name:string;sku:string|null;unit_price:number|string;currency:string};
export function OrderIntakeForm({clientId,customers,addresses,catalog}:{clientId:string;customers:Customer[];addresses:Address[];catalog:Item[]}){
 const[state,action,pending]=useActionState(submitOrder,{} as OrderState),[customer,setCustomer]=useState(customers[0]?.id??""),[quantities,setQuantities]=useState<Record<string,number>>({}),[requestKey]=useState(()=>crypto.randomUUID());
 const lines=useMemo(()=>catalog.flatMap(x=>(quantities[x.entry_id]??0)>0?[{entry_id:x.entry_id,quantity:quantities[x.entry_id]}]:[]),[catalog,quantities]);
 return <form action={action} className="space-y-5 rounded-xl border bg-white p-5 shadow-sm"><input type="hidden" name="clientId" value={clientId}/><input type="hidden" name="currency" value="USD"/><input type="hidden" name="idempotencyKey" value={requestKey}/><input type="hidden" name="lines" value={JSON.stringify(lines)}/>
 <h2 className="text-xl font-semibold">Create and submit order</h2><p className="text-sm">Submission revalidates catalog eligibility and resolves the price tier for each final quantity. It does not reserve inventory.</p>
 <label className="block">Customer<select required name="customerId" value={customer} onChange={e=>setCustomer(e.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Select</option>{customers.map(x=><option key={x.id} value={x.id}>{x.number} — {x.name}</option>)}</select></label>
 <label className="block">Ship-to address<select required name="addressId" className="mt-1 w-full rounded border p-2"><option value="">Select</option>{addresses.filter(x=>x.customer_id===customer).map(x=><option key={x.id} value={x.id}>{x.label} — {x.recipient}, {x.line1}, {x.city}</option>)}</select></label>
 <div><h3 className="font-semibold">Authorized catalog</h3>{catalog.map(x=><label key={x.entry_id} className="my-2 grid grid-cols-[1fr_7rem] items-center gap-3 rounded border p-3"><span>{x.display_name}{x.sku?` · ${x.sku}`:""}<small className="block">Current quantity-1 price: {Number(x.unit_price).toFixed(4)} {x.currency}; final tier is resolved on submission.</small></span><input aria-label={`Quantity for ${x.display_name}`} type="number" min="0" max="1000000" step="1" value={quantities[x.entry_id]??0} onChange={e=>setQuantities(q=>({...q,[x.entry_id]:Number(e.target.value)}))} className="rounded border p-2"/></label>)}</div>
 <p>{lines.length} selected line(s). Review: {lines.map(x=>`${catalog.find(i=>i.entry_id===x.entry_id)?.display_name} × ${x.quantity}`).join(", ")||"none"}</p>
 <button disabled={pending||!customer||!lines.length} className="rounded bg-slate-950 px-4 py-2 text-white disabled:opacity-50">{pending?"Submitting…":"Submit order"}</button>{state.error?<p role="alert" className="text-red-700">{state.error}</p>:state.success?<p role="status" className="text-emerald-700">{state.success} <Link href={`/orders/${state.orderId}`} className="underline">View order</Link></p>:null}
 </form>;
}
