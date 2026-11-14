import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createInAppNotifications } from "@/lib/server/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MERCHANT_ROLES = ["restaurant","supermarket","produce_vendor","meat_seafood_vendor"];
const NEXT_STATUS: Record<string,string> = { pending:"confirmed", confirmed:"preparing", preparing:"ready" };

async function context() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anon||!service) return {response:NextResponse.json({error:"Server configuration is incomplete"},{status:500})};
  const jar=await cookies();
  const auth=createServerClient(url,anon,{cookies:{getAll:()=>jar.getAll(),setAll:(items)=>{try{items.forEach(({name,value,options})=>jar.set(name,value,options));}catch{}}}});
  const {data:{user},error}=await auth.auth.getUser();
  if(error||!user) return {response:NextResponse.json({error:"Authentication required"},{status:401})};
  const role=String(user.app_metadata?.role??"customer");
  if(!MERCHANT_ROLES.includes(role)&&role!=="admin"&&role!=="super_admin") return {response:NextResponse.json({error:"Merchant or admin access required"},{status:403})};
  return {user,role,db:createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})};
}

async function ownedStoreIds(db:SupabaseClient,userId:string,merchantRole:string) {
  let query=db.from("stores").select("id").eq("owner_id",userId);
  // A merchant can access orders only for stores whose type matches the
  // trusted app_metadata role, even if another store is attached to the user.
  if(MERCHANT_ROLES.includes(merchantRole)) query=query.eq("store_type",merchantRole);
  const {data,error}=await query;
  if(error) throw error;
  return (data??[]).map((s:{id:string})=>s.id);
}

export async function GET() {
  try {
    const c=await context(); if("response" in c) return c.response;
    let query=c.db.from("orders").select("id,order_number,store_id,customer_id,status,subtotal_iqd,delivery_fee_iqd,total_iqd,customer_name,customer_phone,delivery_address,customer_note,merchant_note,created_at,order_items(id,product_name,unit_price_iqd,quantity,line_total_iqd)").order("created_at",{ascending:false}).limit(200);
    if(c.role!=="admin"&&c.role!=="super_admin") {
      const storeIds=await ownedStoreIds(c.db,c.user.id,c.role);
      if(storeIds.length===0) return NextResponse.json({orders:[]});
      query=query.in("store_id",storeIds);
    }
    const {data,error}=await query;
    if(error) throw error;
    return NextResponse.json({orders:data??[]});
  } catch(e) {
    console.error("Merchant orders GET failed",e);
    return NextResponse.json({error:"Unable to load merchant orders"},{status:500});
  }
}

export async function PATCH(request:Request) {
  try {
    const c=await context(); if("response" in c) return c.response;
    const raw:unknown=await request.json();
    if(!raw||typeof raw!=="object") return NextResponse.json({error:"Invalid request"},{status:400});
    const v=raw as Record<string,unknown>;
    const id=typeof v.order_id==="string"?v.order_id:"";
    const next=typeof v.status==="string"?v.status:"";
    if(!/^[0-9a-f-]{36}$/i.test(id)||!Object.values(NEXT_STATUS).includes(next)) return NextResponse.json({error:"Invalid order or status"},{status:400});
    const {data:order,error:findError}=await c.db.from("orders").select("id,store_id,status,customer_id,order_number").eq("id",id).maybeSingle();
    if(findError) throw findError;
    if(!order) return NextResponse.json({error:"Order not found"},{status:404});
    const permittedStoreIds = c.role==="admin"||c.role==="super_admin"
      ? [order.store_id]
      : await ownedStoreIds(c.db,c.user.id);
    if(!permittedStoreIds.includes(order.store_id)) {
      return NextResponse.json({error:"You do not own this store"},{status:403});
    }
    if(NEXT_STATUS[order.status]!==next) return NextResponse.json({error:"This status transition is not allowed"},{status:409});
    const {data,error}=await c.db.from("orders").update({status:next})
      .eq("id",id).in("store_id",permittedStoreIds).eq("status",order.status)
      .select("id,status,updated_at").maybeSingle();
    if(error) throw error;
    if(!data) return NextResponse.json({error:"Order changed concurrently. Refresh and try again."},{status:409});
    const statusLabel: Record<string, string> = { confirmed: "دوکان داواکارییەکەی پشتڕاست کردەوە.", preparing: "ئامادەکردنی داواکارییەکەت دەستی پێکرد.", ready: "داواکارییەکەت ئامادەیە بۆ گەیاندن." };
    if (order.customer_id) {
      await createInAppNotifications([{
        userId: order.customer_id,
        type: "order",
        title: "گۆڕانی دۆخی داواکاری",
        body: "داواکاری " + String(order.order_number ?? "") + ": " + (statusLabel[next] ?? "دۆخی داواکاری نوێکرایەوە."),
        data: { order_id: id, status: next },
      }]);
    }
    return NextResponse.json({success:true,order:data});
  } catch(e) {
    console.error("Merchant order update failed",e);
    return NextResponse.json({error:"Unable to update order status"},{status:500});
  }
}
