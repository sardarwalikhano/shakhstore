import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const CATEGORIES=["food","grocery","produce","meat_seafood","drinks","household","other"] as const;
const MERCHANT_ROLES=["restaurant","supermarket","produce_vendor","meat_seafood_vendor"] as const;
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
  let q=c.db.from("products").select("id,store_id,owner_id,name,description,category,price_iqd,image_url,sku,stock_quantity,is_active,created_at,updated_at").order("created_at",{ascending:false}).limit(200);
  if(MERCHANT_ROLES.includes(c.role as typeof MERCHANT_ROLES[number]))q=q.eq("owner_id",c.user.id);
  else if(c.role!=="super_admin"&&c.role!=="admin")return NextResponse.json({error:"Merchant or admin account required"},{status:403});
  const {data,error}=await q;if(error)throw error;
  return NextResponse.json({products:data??[]});
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
  if(!Number.isSafeInteger(price)||price<=0||price>9000000000000)return NextResponse.json({error:"نرخ دەبێت ژمارەیەکی دروستی دیناری عێراقی بێت."},{status:400});
  if(!Number.isSafeInteger(stock)||stock<0||stock>100000000)return NextResponse.json({error:"بڕی کۆگا دروست نییە."},{status:400});
  const image=validImage(v.image_url);if(image===undefined)return NextResponse.json({error:"لینکی وێنە دەبێت HTTPS بێت."},{status:400});
  let storeId:string|null=null;
  if(isMerchant){
   const {data:store,error}=await c.db.from("stores").select("id").eq("owner_id",c.user.id).eq("status","approved").maybeSingle();
   if(error)throw error;if(!store)return NextResponse.json({error:"دوکانەکەت هێشتا پەسەند نەکراوە."},{status:403});storeId=store.id;
  }else if(typeof v.store_id==="string"&&v.store_id){
   const {data:store,error}=await c.db.from("stores").select("id").eq("id",v.store_id).eq("status","approved").maybeSingle();
   if(error)throw error;if(!store)return NextResponse.json({error:"دوکان نەدۆزرایەوە یان پەسەند نەکراوە."},{status:400});storeId=store.id;
  }
  const record={store_id:storeId,owner_id:c.user.id,name,description:typeof v.description==="string"?v.description.trim().slice(0,4000):null,category,price_iqd:price,image_url:image,sku:typeof v.sku==="string"&&v.sku.trim()?v.sku.trim().slice(0,80):null,stock_quantity:stock,is_active:v.is_active!==false};
  const {data,error}=await c.db.from("products").insert(record).select("id,store_id,name,category,price_iqd,image_url,sku,stock_quantity,is_active,created_at").single();
  if(error)throw error;return NextResponse.json({product:data},{status:201});
 }catch(e){console.error("Products POST failed",e);return NextResponse.json({error:"زیادکردنی بەرهەم سەرکەوتوو نەبوو. SKU لەوانەیە دووبارە بێت."},{status:409});}
}
