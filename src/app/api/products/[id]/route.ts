import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const CATEGORIES=["food","grocery","produce","meat_seafood","drinks","household","other"];
const MERCHANT_ROLES=["restaurant","supermarket","produce_vendor","meat_seafood_vendor"];
async function context(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!anon||!service)return {response:NextResponse.json({error:"Server configuration is incomplete"},{status:500})};
 const jar=await cookies(),auth=createServerClient(url,anon,{cookies:{getAll:()=>jar.getAll(),setAll:(items)=>{try{items.forEach(({name,value,options})=>jar.set(name,value,options));}catch{}}}});
 const {data:{user},error}=await auth.auth.getUser();if(error||!user)return {response:NextResponse.json({error:"Authentication required"},{status:401})};
 const role=String(user.app_metadata?.role??"customer");
 if(!MERCHANT_ROLES.includes(role)&&role!=="super_admin"&&role!=="admin")return {response:NextResponse.json({error:"Merchant access required"},{status:403})};
 return {user,role,db:createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})};
}
type Params={params:Promise<{id:string}>};
export async function PATCH(request:Request,{params}:Params){
 try{
  const c=await context();if("response" in c)return c.response;
  const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Invalid product ID"},{status:400});
  const {data:current,error:findError}=await c.db.from("products").select("id,owner_id").eq("id",id).maybeSingle();
  if(findError)throw findError;if(!current)return NextResponse.json({error:"Product not found"},{status:404});
  if(c.role!=="super_admin"&&c.role!=="admin"&&current.owner_id!==c.user.id)return NextResponse.json({error:"Forbidden"},{status:403});
  const raw:unknown=await request.json();if(!raw||typeof raw!=="object")return NextResponse.json({error:"Invalid request"},{status:400});
  const v=raw as Record<string,unknown>,patch:Record<string,unknown>={};
  if("name" in v){if(typeof v.name!=="string"||v.name.trim().length<2||v.name.trim().length>160)return NextResponse.json({error:"Product name is invalid"},{status:400});patch.name=v.name.trim();}
  if("description" in v)patch.description=typeof v.description==="string"?v.description.trim().slice(0,4000):null;
  if("category" in v){if(typeof v.category!=="string"||!CATEGORIES.includes(v.category))return NextResponse.json({error:"Invalid category"},{status:400});patch.category=v.category;}
  if("price_iqd" in v){const n=Number(v.price_iqd);if(!Number.isSafeInteger(n)||n<=0)return NextResponse.json({error:"Invalid IQD price"},{status:400});patch.price_iqd=n;}
  if("stock_quantity" in v){const n=Number(v.stock_quantity);if(!Number.isSafeInteger(n)||n<0)return NextResponse.json({error:"Invalid stock quantity"},{status:400});patch.stock_quantity=n;}
  if("is_active" in v){if(typeof v.is_active!=="boolean")return NextResponse.json({error:"Invalid active state"},{status:400});patch.is_active=v.is_active;}
  if("image_url" in v){if(v.image_url===null||v.image_url==="")patch.image_url=null;else if(typeof v.image_url==="string"){try{const u=new URL(v.image_url);if(u.protocol!=="https:"||u.href.length>2048)throw new Error();patch.image_url=u.href;}catch{return NextResponse.json({error:"Image URL must use HTTPS"},{status:400});}}else return NextResponse.json({error:"Invalid image URL"},{status:400});}
  if("sku" in v)patch.sku=typeof v.sku==="string"&&v.sku.trim()?v.sku.trim().slice(0,80):null;
  if(!Object.keys(patch).length)return NextResponse.json({error:"No changes supplied"},{status:400});
  const {data,error}=await c.db.from("products").update(patch).eq("id",id).select("id,name,description,category,price_iqd,image_url,sku,stock_quantity,is_active,updated_at").single();
  if(error)throw error;return NextResponse.json({product:data});
 }catch(e){console.error("Product PATCH failed",e);return NextResponse.json({error:"Unable to update product"},{status:409});}
}
export async function DELETE(_request:Request,{params}:Params){
 try{
  const c=await context();if("response" in c)return c.response;
  const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Invalid product ID"},{status:400});
  let q=c.db.from("products").delete().eq("id",id);
  if(c.role!=="super_admin"&&c.role!=="admin")q=q.eq("owner_id",c.user.id);
  const {data,error}=await q.select("id").maybeSingle();
  if(error)throw error;if(!data)return NextResponse.json({error:"Product not found or access denied"},{status:404});
  return NextResponse.json({success:true});
 }catch(e){console.error("Product DELETE failed",e);return NextResponse.json({error:"Unable to delete product"},{status:500});}
}
