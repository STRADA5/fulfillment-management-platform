import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const url=process.env.LOCAL_SUPABASE_URL;
if(!url||new URL(url).hostname!=='127.0.0.1')throw Error('LOCAL Supabase only');
const opt={auth:{persistSession:false,autoRefreshToken:false}},svc=createClient(url,process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY,opt),anon=createClient(url,process.env.LOCAL_SUPABASE_ANON_KEY,opt);
const run=randomUUID(),users=[],orgs=[],roleIds=[];let passed=0;
const check=(name,result)=>{assert.ok(result,name);console.log(`PASS ${++passed}: ${name}`);};
async function must(p){const r=await p;if(r.error)throw Error(JSON.stringify(r.error));return r.data;}
async function denied(name,p){const r=await p;check(name,!!r.error);}
async function user(label){const email=`p3e-${label}-${run}@example.test`,password=`Local-${randomUUID()}-Aa1!`,{user}=await must(svc.auth.admin.createUser({email,password,email_confirm:true}));users.push(user.id);const c=createClient(url,process.env.LOCAL_SUPABASE_ANON_KEY,opt);await must(c.auth.signInWithPassword({email,password}));return{id:user.id,c,email,password};}
async function org(label,type='fulfillment_company',parent=null){const r=await must(svc.from('organizations').insert({name:`P3E ${label}`,slug:`p3e-${label}-${run}`,organization_type:type,status:'active',parent_organization_id:parent}).select('id').single());orgs.push(r.id);return r.id;}
async function member(o,u,r){await must(svc.from('organization_memberships').insert({organization_id:o,user_id:u.id,role_id:r,status:'active',is_primary:true}));}
try{
 const roles=Object.fromEntries((await must(svc.from('roles').select('id,code'))).map(x=>[x.code,x.id]));
 const platform=await org('platform','platform_owner'),provider=await org('provider'),otherProvider=await org('other'),a=await org('a','client_company',provider),b=await org('b','client_company',provider);
 const root=await user('super'),admin=await user('provider'),other=await user('other'),alice=await user('alice'),bob=await user('bob'),reader=await user('reader'),suspended=await user('suspended'),catalog=await user('catalog'),limited=await user('limited');
 for(const[o,u,r]of[[platform,root,'SUPER_ADMIN'],[provider,admin,'ADMIN'],[otherProvider,other,'ADMIN'],[a,alice,'CLIENT_ADMIN'],[b,bob,'CLIENT_ADMIN'],[a,reader,'CLIENT_USER'],[a,suspended,'CLIENT_ADMIN']])await member(o,u,roles[r]);
 for(const[u,codes]of[[catalog,['client_catalog.view']],[limited,['customers.view','customers.manage']]]){
  const role=await must(svc.from('roles').insert({code:`P3E_${u===catalog?'CAT':'LIMIT'}_${run.replaceAll('-','_').toUpperCase()}`,name:`P3E ${u.id}`,description:'Disposable regression role',is_system:false}).select('id').single());roleIds.push(role.id);
  const permissions=await must(svc.from('permissions').select('id').in('code',codes));await must(svc.from('role_permissions').insert(permissions.map(p=>({role_id:role.id,permission_id:p.id}))));await member(a,u,role.id);
 }
 await must(svc.from('profiles').update({status:'suspended'}).eq('id',suspended.id));
 // A real stock fixture makes non-interference verification non-vacuous.
 const cat=await must(svc.from('product_categories').insert({organization_id:provider,name:'P3E stock',slug:'stock'}).select('id').single());
 const product=await must(svc.from('products').insert({organization_id:provider,category_id:cat.id,product_name:'Stock',search_name:'stock',product_type:'supply',default_unit_of_measure:'each'}).select('id').single());
 const variant=await must(svc.from('product_variants').insert({organization_id:provider,product_id:product.id,sku:'P3E-STOCK',variant_name:'Each'}).select('id').single());
 const wh=await must(admin.c.rpc('admin_save_warehouse',{target_id:null,target_organization_id:provider,target_code:'WH',target_name:'Stock warehouse',target_status:'active',target_city:'',target_region:'',target_postal:'',target_country:'US',target_timezone:'UTC',target_notes:''}));
 const loc=await must(admin.c.rpc('admin_save_warehouse_location',{target_id:null,target_organization_id:provider,target_warehouse_id:wh,target_code:'LOC',target_name:'Location',target_type:'storage',target_status:'active',target_description:'',target_notes:''}));
 const lot=await must(admin.c.rpc('admin_save_inventory_lot',{target_id:null,target_organization_id:provider,target_variant_id:variant.id,target_lot_number:'LOT',target_manufacturer_lot:'',target_manufactured:null,target_received:null,target_expiration:'2030-01-01',target_bud:'2030-01-01',target_uom:'each',target_status:'pending_receipt',target_notes:'',target_supplier_id:null,target_supplier_relationship_id:null}));
 await must(admin.c.rpc('admin_receive_inventory',{target_organization_id:provider,target_warehouse_id:wh,target_location_id:loc,target_lot_id:lot,target_quantity:10,target_reference:'P3E baseline',target_expected:10,target_discrepancy_reason:'',target_idempotency_key:run}));
 const stock=()=>Promise.all(['inventory_balances','inventory_transactions','inventory_reservations'].map(t=>must(svc.from(t).select('*').eq('organization_id',provider).order('id'))));
 const before=JSON.stringify(await stock());
 const accountArgs={target_id:null,parent_id:provider,target_name:'P3E Onboarded',target_slug:`p3e-onboarded-${run}`,target_email:'contact@example.test',target_phone:'',target_status:'inactive'};
 await denied('Provider cannot onboard arbitrary client',admin.c.rpc('admin_save_client_account',accountArgs));
 const onboarded=await must(root.c.rpc('admin_save_client_account',accountArgs));orgs.push(onboarded);
 check('Trusted onboarding creates inactive client',(await must(svc.from('organizations').select('status').eq('id',onboarded).single())).status==='inactive');
 await must(root.c.rpc('admin_save_client_account',{...accountArgs,target_id:onboarded,target_status:'active',target_name:'P3E Updated'}));
 check('Authorized account editing and activation persist',(await must(svc.from('organizations').select('name,status').eq('id',onboarded).single())).name==='P3E Updated');
 await denied('Account cannot be silently reparented',root.c.rpc('admin_save_client_account',{...accountArgs,target_id:onboarded,parent_id:otherProvider}));
 const customerArgs={target_id:null,client_id:a,target_number:'CUST-A',target_name:'Private Alice Customer',target_email:'private-alice@example.test',target_phone:'+1 555 0101',target_status:'active',expected_version:null};
 const customer=await must(alice.c.rpc('admin_save_customer',customerArgs));
 const customerB=await must(bob.c.rpc('admin_save_customer',{...customerArgs,client_id:b,target_number:'CUST-B',target_name:'Private Bob Customer'}));
 check('Client can create and read own customer',(await must(alice.c.from('customers').select('id'))).length===1);
 for(const who of [bob,admin,other,catalog,suspended]){
  const read=await must(who.c.from('customers').select('*',{count:'exact'}).eq('id',customer));check(`${who===bob?'Other client':who===admin?'Parent provider':who===other?'Unrelated provider':who===catalog?'Catalog-only user':'Suspended user'} cannot enumerate customer`,read.length===0);
 }
 const search=await bob.c.from('customers').select('id',{count:'exact'}).ilike('display_name','%Alice%');check('Cross-client search/count reveals nothing',!search.error&&search.count===0&&search.data.length===0);
 check('Client contexts exclude other clients',(await must(bob.c.rpc('get_customer_contexts'))).every(x=>x.id===b));
 await denied('Client cannot mutate other customer',bob.c.rpc('admin_save_customer',{...customerArgs,target_id:customer,expected_version:1,target_name:'Attack'}));
 await denied('Customer cannot be reassigned by super-admin RPC',root.c.rpc('admin_save_customer',{...customerArgs,target_id:customer,client_id:b,expected_version:1}));
 await denied('Customer owner immutable even for trusted direct writes',svc.from('customers').update({organization_id:b}).eq('id',customer));
 await denied('Customer number immutable',alice.c.rpc('admin_save_customer',{...customerArgs,target_id:customer,target_number:'CHANGED',expected_version:1}));
 await denied('Read-only client cannot create customer',reader.c.rpc('admin_save_customer',{...customerArgs,target_number:'READER'}));
 await denied('Missing lifecycle permission cannot activate',limited.c.rpc('admin_save_customer',{...customerArgs,target_number:'LIMIT'}));
 await denied('Customer mutation validates email',alice.c.rpc('admin_save_customer',{...customerArgs,target_number:'BAD',target_email:'invalid'}));
 const connection={target_organization_id:provider,target_client_organization_id:a,target_status:'active'};await must(root.c.rpc('admin_save_client_catalog_connection',connection));
 check('Explicit catalog connection still grants no customer access',(await must(admin.c.from('customers').select('id').eq('id',customer))).length===0);
 await must(svc.from('organizations').update({settings:{customer_access:'manage',client_id:a}}).eq('id',provider));
 check('Organization settings cannot manufacture customer authority',(await must(admin.c.from('customers').select('id').eq('id',customer))).length===0);
 const serviceArgs={target_id:null,provider_id:provider,client_id:a,target_status:'active',target_access:'read',expected_version:null};
 for(const who of [admin,alice,other])await denied('Non-super service change denied',who.c.rpc('admin_save_client_service',serviceArgs));
 const service=await must(root.c.rpc('admin_save_client_service',serviceArgs));
 check('Explicit read service grants permitted provider access',(await must(admin.c.from('customers').select('id'))).length===1);
 await denied('Read service does not grant mutation',admin.c.rpc('admin_save_customer',{...customerArgs,target_id:customer,expected_version:1}));
 await denied('Duplicate service rejected',root.c.rpc('admin_save_client_service',serviceArgs));
 await must(root.c.rpc('admin_save_client_service',{...serviceArgs,target_id:service,target_access:'manage',expected_version:1}));
 await must(admin.c.rpc('admin_save_customer',{...customerArgs,target_id:customer,target_name:'Provider edited customer',expected_version:1}));
 check('Manage service plus permission authorizes edit',(await must(alice.c.from('customers').select('display_name').eq('id',customer).single())).display_name==='Provider edited customer');
 await denied('Stale customer version rejected',alice.c.rpc('admin_save_customer',{...customerArgs,target_id:customer,expected_version:1}));
 await denied('Service parties immutable',root.c.rpc('admin_save_client_service',{...serviceArgs,target_id:service,client_id:b,expected_version:2}));
 const addrArgs={target_id:null,client_id:a,target_customer_id:customer,target_address:{label:'Home',recipient:'Private Recipient',line1:'123 Private Road',line2:'',city:'Austin',region:'TX',postal_code:'78701',country_code:'US'},target_status:'active',shipping_default:true,billing_default:true,expected_version:null};
 const address=await must(alice.c.rpc('admin_save_customer_address',addrArgs));
 for(const who of [bob,catalog,limited,suspended])for(const table of ['customer_addresses','customer_address_revisions'])check(`Unauthorized ${table} access denied`,(await must(who.c.from(table).select('*'))).length===0);
 await denied('Cross-client address edit denied',bob.c.rpc('admin_save_customer_address',{...addrArgs,target_id:address,expected_version:1}));
 await denied('Address cannot attach to another client customer',alice.c.rpc('admin_save_customer_address',{...addrArgs,target_customer_id:customerB}));
 await denied('Address payload cannot inject ownership',alice.c.rpc('admin_save_customer_address',{...addrArgs,target_address:{...addrArgs.target_address,organization_id:b}}));
 await denied('Malformed country code denied',alice.c.rpc('admin_save_customer_address',{...addrArgs,target_address:{...addrArgs.target_address,country_code:'USA'}}));
 await must(alice.c.rpc('admin_save_customer_address',{...addrArgs,target_id:address,target_address:{...addrArgs.target_address,line1:'456 New Road'},expected_version:1}));
 const revisions=await must(alice.c.from('customer_address_revisions').select('version,snapshot').eq('address_id',address).order('version'));
 check('Address edits preserve immutable historical values',revisions.length===2&&revisions[0].snapshot.line1==='123 Private Road'&&revisions[1].snapshot.line1==='456 New Road');
 await denied('Stale address overwrite denied',alice.c.rpc('admin_save_customer_address',{...addrArgs,target_id:address,expected_version:1}));
 await denied('Inactive address cannot be default',alice.c.rpc('admin_save_customer_address',{...addrArgs,target_status:'inactive'}));
 const race=await Promise.all(['Office','Alternate'].map(label=>alice.c.rpc('admin_save_customer_address',{...addrArgs,target_address:{...addrArgs.target_address,label}})));
 check('Concurrent defaults serialize successfully',race.every(x=>!x.error));
 const defaults=await must(alice.c.from('customer_addresses').select('is_default_shipping,is_default_billing').eq('customer_id',customer));
 check('Exactly one shipping and billing default remains',defaults.filter(x=>x.is_default_shipping).length===1&&defaults.filter(x=>x.is_default_billing).length===1);
 for(const table of ['customers','customer_addresses','customer_address_revisions','customer_lifecycle_events','client_service_relationships'])await denied(`Direct deletion of ${table} denied`,root.c.from(table).delete().eq('organization_id',table==='client_service_relationships'?provider:a));
 await denied('Direct customer update denied',alice.c.from('customers').update({status:'active'}).eq('id',customer));
 await denied('Historical address rewrite denied',alice.c.from('customer_address_revisions').update({snapshot:{}}).eq('address_id',address));
 await must(alice.c.rpc('admin_save_customer',{...customerArgs,target_id:customer,expected_version:2,target_status:'suspended'}));
 await denied('Suspended customer cannot receive address mutations',alice.c.rpc('admin_save_customer_address',{...addrArgs,shipping_default:false,billing_default:false}));
 check('Suspended customer history remains available to owner',(await must(alice.c.from('customer_lifecycle_events').select('id').eq('resource_id',customer))).length>=3);
 await must(alice.c.rpc('admin_save_customer',{...customerArgs,target_id:customer,expected_version:3,target_status:'active'}));
 await must(root.c.rpc('admin_save_client_service',{...serviceArgs,target_id:service,target_access:'manage',target_status:'suspended',expected_version:2}));
 check('Service suspension immediately removes provider customer/address/revision access',(await Promise.all(['customers','customer_addresses','customer_address_revisions'].map(t=>must(admin.c.from(t).select('*'))))).every(x=>x.length===0));
 check('Service suspension does not remove client ownership access',(await must(alice.c.from('customers').select('id'))).length===1);
 await denied('Suspended service cannot edit customer',admin.c.rpc('admin_save_customer',{...customerArgs,target_id:customer,expected_version:4}));
 await must(root.c.rpc('admin_save_client_service',{...serviceArgs,target_id:service,target_access:'manage',expected_version:3}));
 await must(svc.from('organizations').update({status:'suspended'}).eq('id',provider));
 check('Inactive provider loses customer access',(await must(admin.c.from('customers').select('id'))).length===0);
 await must(svc.from('organizations').update({status:'active'}).eq('id',provider));
 await must(svc.from('organizations').update({status:'inactive'}).eq('id',a));
 for(const who of [alice,admin,root])check('Inactive client denies customer rows including super-admin',(await must(who.c.from('customers').select('id').eq('organization_id',a))).length===0);
 await denied('Inactive client denies customer mutation',alice.c.rpc('admin_save_customer',customerArgs));
 await must(svc.from('organizations').update({status:'active'}).eq('id',a));
 await denied('Suspended user cannot mutate customer',suspended.c.rpc('admin_save_customer',customerArgs));
 await denied('Anonymous customer mutation denied',anon.rpc('admin_save_customer',customerArgs));
 await denied('Anonymous address mutation denied',anon.rpc('admin_save_customer_address',addrArgs));
 for(const table of ['customers','customer_addresses','customer_address_revisions','customer_lifecycle_events','client_service_relationships']){const r=await anon.from(table).select('*');check(`Anonymous ${table} access denied`,r.error?.code==='42501'||(!r.error&&r.data.length===0));}
 const audits=await must(svc.from('audit_logs').select('action,metadata').in('organization_id',orgs).like('action','customer_foundation.%'));
 check('All mutation kinds create trusted audit events',['client_account_created','client_account_updated','service_relationship_created','service_relationship_updated','customer_created','customer_updated','address_created','address_updated'].every(x=>audits.some(r=>r.action===`customer_foundation.${x}`)));
 check('General audit metadata excludes customer/address PII',audits.every(x=>Object.keys(x.metadata).every(k=>['old_status','status'].includes(k))));
 const serviceHistory=await must(root.c.from('customer_lifecycle_events').select('details').eq('resource_id',service));
 check('Service capability escalation is recorded in history',serviceHistory.some(x=>x.details.old_access==='read'&&x.details.access==='manage'));
 check('Authorized provider can review service capability history',(await must(admin.c.from('customer_lifecycle_events').select('details').eq('resource_id',service))).some(x=>x.details.access==='manage'));
 await must(svc.from('profiles').update({status:'suspended'}).eq('id',root.id));
 await denied('Suspended super-admin cannot onboard clients',root.c.rpc('admin_save_client_account',{...accountArgs,target_slug:`p3e-denied-${run}`}));
 await denied('Suspended super-admin cannot change services',root.c.rpc('admin_save_client_service',{...serviceArgs,target_id:service,expected_version:4}));
 await must(svc.from('profiles').update({status:'active'}).eq('id',root.id));
 await denied('Anonymous service changes denied',anon.rpc('admin_save_client_service',serviceArgs));
 check('Cross-client lifecycle history hidden',(await must(bob.c.from('customer_lifecycle_events').select('id').eq('organization_id',a))).length===0);
 check('Real inventory balances, ledger, and reservations remain byte-for-byte unchanged',before===JSON.stringify(await stock()));
 check('No onboarding memberships created automatically',(await must(svc.from('organization_memberships').select('id').eq('organization_id',onboarded))).length===0);
 console.log(`Phase 3E: ${passed} checks passed.`);
 if(process.env.LOCAL_KEEP_PHASE3E_FIXTURES==='1')console.log('DISPOSABLE LOCAL UI users',JSON.stringify([root,alice,bob].map(({email,password})=>({email,password}))));
}catch(e){console.error('PHASE 3E FAILURE',e);process.exitCode=1;}
finally{if(process.env.LOCAL_KEEP_PHASE3E_FIXTURES!=='1'||process.exitCode){try{
 for(const table of ['customer_address_revisions','customer_addresses','customers','customer_lifecycle_events','client_service_relationships','client_catalog_connections','inventory_transactions','inventory_reservations','receiving_lines','receivings','inventory_balances','inventory_lot_sources','inventory_lots','warehouse_locations','warehouses','product_variants','products','product_categories','organization_memberships','audit_logs'])await must(svc.from(table).delete().in('organization_id',orgs));
 for(const id of [...orgs].reverse())await must(svc.from('organizations').delete().eq('id',id));
 for(const id of users)await must(svc.auth.admin.deleteUser(id));
 if(roleIds.length){await must(svc.from('role_permissions').delete().in('role_id',roleIds));await must(svc.from('roles').delete().in('id',roleIds));}
}catch(e){console.error('LOCAL cleanup failure',e);process.exitCode=1;}}}
