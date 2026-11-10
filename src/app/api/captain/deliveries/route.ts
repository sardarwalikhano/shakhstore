import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";
async function context(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!anon||!service)return {response:NextResponse.json({error:"Server configuration is incomplete"},{status:500})};
 const jar=await cookies(),auth=createServerClient(url,anon,{cookies:{getAll:()=>jar.getAll(),setAll:(items)=>{try{items.forEach(({name,value,options})=>jar.set(name,value,options));}catch{}}}});
 const {data:{user},error}=await auth.auth.getUser();
 if(error||!user)return {response:NextResponse.json({error:"Authentication required"},{status:401})};
 if(user.app_metadata?.role!=="captain")return {response:NextResponse.json({error:"Captain account required"},{status:403})};
 return {user,db:createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})};
}
export async function GET(){
 try{
  const c=await context();if("response" in c)return c.response;
  const {data,error}=await c.db.from("orders").select("id,order_number,status,total_iqd,delivery_address,customer_name,customer_phone,customer_note,created_at,assigned_at,stores(name),order_items(id,product_name,quantity)").eq("captain_id",c.user.id).in("status",["assigned","out_for_delivery","delivered"]).order("assigned_at",{ascending:false}).limit(100);
  if(error)throw error;return NextResponse.json({deliveries:data??[]});
 }catch(e){console.error("Captain deliveries GET failed",e);return NextResponse.json({error:"Unable to load deliveries"},{status:500});}
}
export async function PATCH(request:Request){
 try{
  const c=await context();if("response" in c)return c.response;
  const raw:unknown=await request.json();if(!raw||typeof raw!=="object")return NextResponse.json({error:"Invalid request"},{status:400});
  const v=raw as Record<string,unknown>,id=typeof v.order_id==="string"?v.order_id:"",next=typeof v.status==="string"?v.status:"";
  if(!/^[0-9a-f-]{36}$/i.test(id)||!["out_for_delivery","delivered"].includes(next))return NextResponse.json({error:"Invalid order or status"},{status:400});
  const previous=next==="out_for_delivery"?"assigned":"out_for_delivery";
  const {data,error}=await c.db.from("orders").update({status:next}).eq("id",id).eq("captain_id",c.user.id).eq("status",previous).select("id,status,updated_at").maybeSingle();
  if(error)throw error;if(!data)return NextResponse.json({error:"Order not found, not assigned to you, or status transition is invalid"},{status:409});
  return NextResponse.json({success:true,order:data});
 }catch(e){console.error("Captain delivery update failed",e);return NextResponse.json({error:"Unable to update delivery status"},{status:500});}
}
