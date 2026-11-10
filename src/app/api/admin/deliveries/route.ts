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
 if(user.app_metadata?.role!=="super_admin"&&user.app_metadata?.role!=="admin")return {response:NextResponse.json({error:"Admin access required"},{status:403})};
 return {user,db:createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})};
}
export async function GET(){
 try{
  const c=await context();if("response" in c)return c.response;
  const [{data:orders,error:ordersError},{data:userData,error:userError}]=await Promise.all([
   c.db.from("orders").select("id,order_number,store_id,status,total_iqd,delivery_address,created_at,captain_id,stores(name)").in("status",["ready","assigned","out_for_delivery"]).order("created_at",{ascending:true}).limit(200),
   c.db.auth.admin.listUsers({page:1,perPage:200})
  ]);
  if(ordersError)throw ordersError;if(userError)throw userError;
  const captains=(userData.users??[]).filter(u=>u.app_metadata?.role==="captain").map(u=>({id:u.id,email:u.email??null,name:String(u.user_metadata?.full_name??u.user_metadata?.name??u.email??"Captain")}));
  return NextResponse.json({orders:orders??[],captains});
 }catch(e){console.error("Admin deliveries GET failed",e);return NextResponse.json({error:"Unable to load delivery assignments"},{status:500});}
}
export async function POST(request:Request){
 try{
  const c=await context();if("response" in c)return c.response;
  const raw:unknown=await request.json();if(!raw||typeof raw!=="object")return NextResponse.json({error:"Invalid request"},{status:400});
  const v=raw as Record<string,unknown>,orderId=typeof v.order_id==="string"?v.order_id:"",captainId=typeof v.captain_id==="string"?v.captain_id:"";
  if(!/^[0-9a-f-]{36}$/i.test(orderId)||!/^[0-9a-f-]{36}$/i.test(captainId))return NextResponse.json({error:"Invalid order or captain ID"},{status:400});
  const {data:captain,error:captainError}=await c.db.auth.admin.getUserById(captainId);
  if(captainError)throw captainError;
  if(!captain.user||captain.user.app_metadata?.role!=="captain")return NextResponse.json({error:"Selected user is not an active captain account"},{status:400});
  const {data:order,error:findError}=await c.db.from("orders").select("id,status,captain_id").eq("id",orderId).maybeSingle();
  if(findError)throw findError;if(!order)return NextResponse.json({error:"Order not found"},{status:404});
  if(order.status!=="ready"||order.captain_id)return NextResponse.json({error:"Only ready and unassigned orders can be assigned"},{status:409});
  const {data,error}=await c.db.from("orders").update({captain_id:captainId,assigned_at:new Date().toISOString(),status:"assigned"}).eq("id",orderId).eq("status","ready").is("captain_id",null).select("id,status,captain_id,assigned_at").maybeSingle();
  if(error)throw error;if(!data)return NextResponse.json({error:"Order was assigned by another admin. Refresh the page."},{status:409});
  return NextResponse.json({success:true,order:data});
 }catch(e){console.error("Admin delivery assignment failed",e);return NextResponse.json({error:"Unable to assign captain"},{status:500});}
}
