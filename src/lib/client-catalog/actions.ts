"use server";

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export type ClientCatalogState={error?:string;success?:string};
const text=(f:FormData,key:string,max=200)=>{const value=String(f.get(key)??"").trim();if(value.length>max)throw new Error(`Invalid ${key}.`);return value;};
const uuid=(f:FormData,key:string,optional=false)=>{const value=text(f,key,36);if(!value&&optional)return null;if(!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value))throw new Error(`Invalid ${key}.`);return value;};
const date=(f:FormData,key:string,optional=false)=>{const value=text(f,key,40);if(!value&&optional)return null;if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)||!Number.isFinite(Date.parse(`${value}Z`)))throw new Error(`Invalid ${key}. Use UTC.`);return new Date(`${value}Z`).toISOString();};
const numeric=(f:FormData,key:string,optional=false)=>{const value=text(f,key,30);if(!value&&optional)return null;const n=Number(value);if(!value||!Number.isFinite(n)||n<0)throw new Error(`Invalid ${key}.`);return n;};
const integer=(f:FormData,key:string,optional=false)=>{const value=numeric(f,key,optional);if(value!==null&&(!Number.isSafeInteger(value)||value<1||value>1000000))throw new Error(`Invalid ${key}.`);return value;};
const status=(f:FormData)=>{const value=text(f,"status");if(value!=="active"&&value!=="inactive")throw new Error("Invalid status.");return value;};
async function authorized(f:FormData){
 await getAppContext();const s=await createClient(),org=uuid(f,"organizationId")!;
 const{data,error}=await s.rpc("get_client_catalog_admin_companies");
 if(error||!data?.some(x=>x.id===org))throw new Error("Not authorized for that company.");
 return{s,org};
}
async function result(work:()=>Promise<{error:{code?:string}|null}>):Promise<ClientCatalogState>{
 try{const{error}=await work();if(error)return{error:error.code==="23505"?"A duplicate assignment or overlapping price rule exists.":"Not permitted or invalid values. Check client connection, product/SKU, dates and price tiers."};
 revalidatePath("/client-catalog-admin");revalidatePath("/client-catalog");revalidatePath("/administration/audit-log");return{success:"Saved and audited."};
 }catch(e){return{error:e instanceof Error?e.message:"Unable to save."};}
}
export async function saveClientConnection(_:ClientCatalogState,f:FormData){return result(async()=>{const{s,org}=await authorized(f);return s.rpc("admin_save_client_catalog_connection",{target_organization_id:org,target_client_organization_id:uuid(f,"clientId")!,target_status:status(f)});});}
export async function saveClientEntry(_:ClientCatalogState,f:FormData){return result(async()=>{const{s,org}=await authorized(f);const name=text(f,"name");if(!name)throw new Error("Client-facing name is required.");return s.rpc("admin_save_client_catalog_entry",{
 target_id:uuid(f,"id",true)!,target_organization_id:org,target_client_organization_id:uuid(f,"clientId")!,target_product_id:uuid(f,"productId")!,target_variant_id:uuid(f,"variantId",true)!,target_name:name,target_description:text(f,"description",5000),target_status:status(f),target_starts_at:date(f,"startsAt")!,target_ends_at:date(f,"endsAt",true)!,
 });});}
export async function saveClientPrice(_:ClientCatalogState,f:FormData){return result(async()=>{const{s,org}=await authorized(f),kind=text(f,"kind"),currency=text(f,"currency",3).toUpperCase();if(!["base","client","override"].includes(kind)||!/^[A-Z]{3}$/.test(currency))throw new Error("Invalid price kind or currency.");return s.rpc("admin_save_client_selling_price",{
 target_id:uuid(f,"id",true)!,target_organization_id:org,target_client_organization_id:uuid(f,"clientId",true)!,target_product_id:uuid(f,"productId")!,target_variant_id:uuid(f,"variantId",true)!,target_kind:kind,target_currency:currency,target_price:numeric(f,"price")!,target_minimum:integer(f,"minimum")!,target_maximum:integer(f,"maximum",true)!,target_starts_at:date(f,"startsAt")!,target_ends_at:date(f,"endsAt",true)!,target_status:status(f),
 });});}
