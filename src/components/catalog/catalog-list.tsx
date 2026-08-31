"use client";
import Link from "next/link";
import { useState } from "react";
const editKinds:Record<string,string>={"Master products":"product","Categories":"category","Variants":"variant","Suppliers":"supplier","Sourcing relationships":"supplier-product","Inbound shipment queue":"inbound","Quality document metadata":"quality-document","Open and resolved supplier issues":"supplier-issue","Purchase order lines":"purchase-order-line"};
const inventoryKinds=new Set(["warehouse","location","lot"]),operationKinds=new Set(["inbound","quality-document","supplier-issue","purchase-order-line"]);
// Only authorized server projections are passed to this client table.
export function CatalogList({title,rows,editKind,allowEdit=true}:{title:string;rows:Array<Record<string,unknown>>;editKind?:string;allowEdit?:boolean}){
 const [search,setSearch]=useState(""),[filters,setFilters]=useState<Record<string,string>>({});
 const kind=allowEdit?(editKind??editKinds[title]):"",columns=rows.length?Object.keys(rows[0]).filter(key=>key!=="id"):[];
 const historyKind=title==="Receiving history"?"receiving":title==="QC inspection history"?"inspection":"";
 const filterKeys=columns.filter(key=>/^(status|warehouse_id|supplier_id|product_variant_id|lot_id)$/.test(key));
 const filtered=rows.filter(row=>Object.values(row).some(v=>String(v??"").toLowerCase().includes(search.toLowerCase()))&&Object.entries(filters).every(([k,v])=>!v||String(row[k])===v));
 const href=(id:string)=>kind==="purchase-order"?`/purchasing/${id}`:operationKinds.has(kind)?`/operations/edit/${kind}/${id}`:`${inventoryKinds.has(kind)?"/inventory-admin/edit":"/catalog/edit"}/${kind}/${id}`;
 return <section className="mt-8"><h2 className="text-lg font-semibold">{title}</h2>
 <div className="my-3 flex flex-wrap gap-3"><label className="text-sm">Search {title}<input className="ml-2 rounded border p-2" value={search} onChange={e=>setSearch(e.target.value)}/></label>{filterKeys.map(key=><label key={key} className="text-sm">{key.replaceAll("_"," ")}<select className="ml-2 rounded border p-2" value={filters[key]??""} onChange={e=>setFilters({...filters,[key]:e.target.value})}><option value="">All</option>{[...new Set(rows.map(row=>String(row[key]??"")))].filter(Boolean).map(v=><option key={v}>{v}</option>)}</select></label>)}</div>
 <p className="text-sm text-slate-500">{filtered.length} of {rows.length} loaded records</p>
 {filtered.length?<div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{columns.map(key=><th key={key} className="px-4 py-3">{key.replaceAll("_"," ")}</th>)}{kind||historyKind?<th>Actions</th>:null}</tr></thead><tbody>{filtered.map((row,index)=><tr key={String(row.id??index)} className="border-t border-slate-100">{columns.map(key=><td key={key} className="px-4 py-3">{String(row[key]??"—")}</td>)}{kind||historyKind?<td className="px-4 py-3"><Link className="font-semibold text-blue-700" href={historyKind?`/operations/history/${historyKind}/${row.id}`:href(String(row.id))}>{historyKind?"View":"Edit"}</Link></td>:null}</tr>)}</tbody></table></div>:<p className="mt-3 rounded-xl border border-dashed p-8 text-center text-sm">No records found.</p>}</section>;
}
