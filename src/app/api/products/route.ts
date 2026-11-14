import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { productCategoryForRole } from "@/lib/product-categories";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const CATEGORIES=["food","grocery","produce","meat_seafood","drinks","household","other"] as const;
const MERCHANT_ROLES=["restaurant","supermarket","produce_vendor","meat_seafood_vendor"] as const;
type LegacyProduct = { id:string; store_id:null; name:string; description:string|null; category:string; price_iqd:number; image_url:string|null; stock_quantity:number; created_at:string; stores:null };
async function context(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!anon||!service)return {response:NextResponse.json({error:"Server configuration is incomplete"},{status:500})};
 const jar=await cookies();
 const auth=createServerClient(url,anon,{cookies:{getAll:()=>jar.getAll(),setAll:(items)=>{try{items.forEach(({name,value,options})=>jar.set(name,value,options));}catch{}}}});
 const {data:{user},error}=await auth.auth.getUser();
 if(error||!user)return {response:NextResponse.json({error:"Authentication required"},{status:401})};
 return {user,role:String(user.app_metadata?.role??"customer"),db:createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})};
}
function validImage(value:unknown){if(value==null||value==="")return null;if(typeof value!=="string"||value.length>2048)return undefined;try{const u=new URL(value);return u.protocol==="https:"?u.toString():undefined;}catch{return undefined;}}
export async function GET(){
 try{
  const c=await context();if("response" in c)return c.response;
  if(c.role==="customer"){
   const {data,error}=await c.db.from("products")
    .select("id,store_id,owner_id,name,description,category,price_iqd,image_url,stock_quantity,created_at,stores!inner(id,name,slug,store_type,status,service_center_lat,service_center_lng,service_radius_km)")
    .eq("is_active",true).eq("stores.status","approved")
    .order("created_at",{ascending:false}).limit(200);
   if(error)throw error;
   const catalogStoreIds=[...new Set((data??[]).map(p=>p.store_id).filter((id):id is string=>Boolean(id)))];
   const feeByStore=new Map<string,number|null>();
   if(catalogStoreIds.length){
    const {data:fees,error:feeError}=await c.db.from("stores").select("id,delivery_fee_iqd").in("id",catalogStoreIds);
    if(feeError){
     if(feeError.code!=="42703"&&!feeError.message.includes("delivery_fee_iqd"))throw feeError;
     catalogStoreIds.forEach(id=>feeByStore.set(id,null));
    }else (fees??[]).forEach(store=>feeByStore.set(store.id,Number(store.delivery_fee_iqd)));
   }
   const productsWithFees=(data??[]).map(p=>{
    const store=Array.isArray(p.stores)?p.stores[0]:p.stores;
    const zoneConfigured=Boolean(store?.service_center_lat!==null&&store?.service_center_lat!==undefined
      &&store?.service_center_lng!==null&&store?.service_center_lng!==undefined
      &&store?.service_radius_km!==null&&store?.service_radius_km!==undefined);
    // Do not expose the private service-zone centre through the public catalog.
    // Customers only need to know whether delivery is available and the radius.
    const publicStore=store?{
     id:store.id,
     name:store.name,
     slug:store.slug,
     store_type:store.store_type,
     status:store.status
    }:null;
    return {
     id:p.id,
     store_id:p.store_id,
     name:p.name,
     description:p.description,
     category:p.category,
     price_iqd:p.price_iqd,
     image_url:p.image_url,
     stock_quantity:p.stock_quantity,
     created_at:p.created_at,
     stores:Array.isArray(p.stores)?(publicStore?[publicStore]:[]):publicStore,
     delivery_fee_iqd:p.store_id?feeByStore.get(p.store_id)??null:null,
     delivery_zone_configured:zoneConfigured,
     delivery_zone_radius_km:zoneConfigured?Number(store?.service_radius_km):null
    };
   });
   // Legacy Super Admin posts created before store selection have a null store_id.
   // Keep those platform-owned items visible as SHAKH STORE catalog entries.
   const {data:authUsers,error:usersError}=await c.db.auth.admin.listUsers({page:1,perPage:200});
   if(usersError)throw usersError;
   const adminIds=authUsers.users.filter(u=>["super_admin","admin"].includes(String(u.app_metadata?.role??""))).map(u=>u.id);
   let legacy:LegacyProduct[]=[];
   if(adminIds.length){
    const {data:orphaned,error:orphanError}=await c.db.from("products")
     .select("id,store_id,owner_id,name,description,category,price_iqd,image_url,stock_quantity,created_at")
     .is("store_id",null).in("owner_id",adminIds).eq("is_active",true)
     .order("created_at",{ascending:false}).limit(200);
    if(orphanError)throw orphanError;
    legacy=(orphaned??[]).map(p=>({
     id:p.id,
     store_id:null,
     name:p.name,
     description:p.description,
     category:p.category,
     price_iqd:p.price_iqd,
     image_url:p.image_url,
     stock_quantity:p.stock_quantity,
     created_at:p.created_at,
     stores:null,
     delivery_fee_iqd:null,
     delivery_zone_configured:false,
     delivery_zone_radius_km:null
    }));
   }
   const products=[...productsWithFees,...legacy].sort((x,y)=>Number(new Date(y.created_at??0))-Number(new Date(x.created_at??0))).slice(0,200);
   return NextResponse.json({products});
  }
  let q=c.db.from("products").select("id,store_id,owner_id,name,description,category,price_iqd,image_url,sku,stock_quantity,is_active,created_at,updated_at").order("created_at",{ascending:false}).limit(200);
  if(MERCHANT_ROLES.includes(c.role as typeof MERCHANT_ROLES[number])){
   const {data:store,error:storeError}=await c.db.from("stores").select("id").eq("owner_id",c.user.id).eq("status","approved").maybeSingle();
   if(storeError)throw storeError;
   if(!store)return NextResponse.json({products:[],role:c.role,store_status:"inactive"});
   q=q.eq("owner_id",c.user.id).eq("store_id",store.id);
   const roleCategory=productCategoryForRole(c.role);
   if(roleCategory)q=q.eq("category",roleCategory);
  }
  else if(c.role!=="super_admin"&&c.role!=="admin")return NextResponse.json({error:"Access denied"},{status:403});
  const {data,error}=await q;if(error)throw error;
  return NextResponse.json({
   products:data??[],
   role:c.role,
   allowedCategories:c.role==="admin"||c.role==="super_admin"
    ? ["food","grocery","produce","meat_seafood","drinks","household","other"]
    : productCategoryForRole(c.role)?[productCategoryForRole(c.role)]:[]
  });
 }catch(e){console.error("Products GET failed",e);return NextResponse.json({error:"Unable to load products"},{status:500});}
}
export async function POST(request:Request){
 try{
  const c=await context();if("response" in c)return c.response;
  const isAdmin=c.role==="super_admin"||c.role==="admin";
  const isMerchant=MERCHANT_ROLES.includes(c.role as typeof MERCHANT_ROLES[number]);
  if(!isAdmin&&!isMerchant)return NextResponse.json({error:"Merchant access required"},{status:403});
  const raw:unknown=await request.json();if(!raw||typeof raw!=="object")return NextResponse.json({error:"Invalid request"},{status:400});
  const v=raw as Record<string,unknown>,name=typeof v.name==="string"?v.name.trim():"",category=String(v.category??"");
  const price=Number(v.price_iqd),stock=Number(v.stock_quantity??0);
  if(name.length<2||name.length>160)return NextResponse.json({error:"ناوی بەرهەم دەبێت لە ٢ تا ١٦٠ پیت بێت."},{status:400});
  if(!CATEGORIES.includes(category as typeof CATEGORIES[number]))return NextResponse.json({error:"پۆلێنی بەرهەم دروست نییە."},{status:400});
  const requiredMerchantCategory=productCategoryForRole(c.role);
  if(requiredMerchantCategory&&category!==requiredMerchantCategory){
   return NextResponse.json({error:"تۆ تەنها دەتوانیت لە پۆلێنی تایبەت بە جۆری دوکانەکەت بەرهەم زیاد بکەیت."},{status:403});
  }
  if(!Number.isSafeInteger(price)||price<=0||price>9000000000000)return NextResponse.json({error:"نرخ دەبێت ژمارەیەکی دروستی دیناری عێراقی بێت."},{status:400});
  if(!Number.isSafeInteger(stock)||stock<0||stock>100000000)return NextResponse.json({error:"بڕی کۆگا دروست نییە."},{status:400});
  const image=validImage(v.image_url);if(image===undefined)return NextResponse.json({error:"لینکی وێنە دەبێت HTTPS بێت."},{status:400});
  let storeId:string|null=null;
  if(isMerchant){
   const {data:store,error}=await c.db.from("stores").select("id").eq("owner_id",c.user.id).eq("status","approved").maybeSingle();
   if(error)throw error;if(!store)return NextResponse.json({error:"دوکانەکەت هێشتا پەسەند نەکراوە."},{status:403});storeId=store.id;
  }else if(isAdmin){
   if(typeof v.store_id!=="string"||!/^[0-9a-f-]{36}$/i.test(v.store_id))return NextResponse.json({error:"تکایە دوکانێکی پەسەندکراو هەڵبژێرە."},{status:400});
   const {data:store,error}=await c.db.from("stores").select("id").eq("id",v.store_id).eq("status","approved").maybeSingle();
   if(error)throw error;if(!store)return NextResponse.json({error:"دوکان نەدۆزرایەوە یان پەسەند نەکراوە."},{status:400});storeId=store.id;
  }else if(typeof v.store_id==="string"&&v.store_id){
   const {data:store,error}=await c.db.from("stores").select("id").eq("id",v.store_id).eq("status","approved").maybeSingle();
   if(error)throw error;if(!store)return NextResponse.json({error:"دوکان نەدۆزرایەوە یان پەسەند نەکراوە."},{status:400});storeId=store.id;
  }
  const record={store_id:storeId,owner_id:c.user.id,name,description:typeof v.description==="string"?v.description.trim().slice(0,4000):null,category,price_iqd:price,image_url:image,sku:typeof v.sku==="string"&&v.sku.trim()?v.sku.trim().slice(0,80):null,stock_quantity:stock,is_active:v.is_active!==false};
  const {data,error}=await c.db.from("products").insert(record).select("id,store_id,name,category,price_iqd,image_url,sku,stock_quantity,is_active,created_at").single();
  if(error)throw error;return NextResponse.json({product:data},{status:201});
 }catch(e){console.error("Products POST failed",e);return NextResponse.json({error:"زیادکردنی بەرهەم سەرکەوتوو نەبوو. SKU لەوانەیە دووبارە بێت."},{status:409});}
}
