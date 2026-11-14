import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";
type AdminStoreRow = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  store_type: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  delivery_fee_iqd: number | null;
  service_center_lat: number | null;
  service_center_lng: number | null;
  service_radius_km: number | null;
};

async function adminContext(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anon||!service)return {response:NextResponse.json({error:"Server configuration is incomplete"},{status:500})};
  const jar=await cookies();
  const auth=createServerClient(url,anon,{cookies:{getAll:()=>jar.getAll(),setAll:(items)=>{try{items.forEach(({name,value,options})=>jar.set(name,value,options));}catch{}}}});
  const {data:{user},error}=await auth.auth.getUser();
  if(error||!user)return {response:NextResponse.json({error:"Authentication required"},{status:401})};
  if(user.app_metadata?.role!=="super_admin"&&user.app_metadata?.role!=="admin")return {response:NextResponse.json({error:"Admin access required"},{status:403})};
  return {user,db:createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})};
}
export async function GET(){
  try{
    const ctx=await adminContext();if("response" in ctx)return ctx.response;
    const selectBase="id,owner_id,name,slug,store_type,description,phone,address,status,admin_note,reviewed_by,reviewed_at,created_at";
    const primary=await ctx.db.from("stores").select(selectBase+",delivery_fee_iqd,service_center_lat,service_center_lng,service_radius_km").order("created_at",{ascending:false}).limit(200);
    let rows:AdminStoreRow[]=(primary.data??[]) as unknown as AdminStoreRow[];
    if(primary.error){
      if(primary.error.code!=="42703")throw primary.error;
      const feeFallback=await ctx.db.from("stores").select(selectBase+",delivery_fee_iqd").order("created_at",{ascending:false}).limit(200);
      if(!feeFallback.error){
        rows=(feeFallback.data??[]).map(s=>({...s,service_center_lat:null,service_center_lng:null,service_radius_km:null})) as unknown as AdminStoreRow[];
      }else{
        if(feeFallback.error.code!=="42703")throw feeFallback.error;
        const legacyFallback=await ctx.db.from("stores").select(selectBase).order("created_at",{ascending:false}).limit(200);
        if(legacyFallback.error)throw legacyFallback.error;
        rows=(legacyFallback.data??[]).map(s=>({...s,delivery_fee_iqd:null,service_center_lat:null,service_center_lng:null,service_radius_km:null})) as unknown as AdminStoreRow[];
      }
    }
    const stores=await Promise.all(rows.map(async (s:AdminStoreRow)=>{const {data}=await ctx.db.auth.admin.getUserById(s.owner_id);return {...s,owner_email:data.user?.email??null};}));
    return NextResponse.json({stores});
  }catch(e){console.error("Admin stores list failed",e);return NextResponse.json({error:"Unable to load stores"},{status:500});}
}
export async function PATCH(request:Request){
  try{
    const ctx=await adminContext();if("response" in ctx)return ctx.response;
    const body:unknown=await request.json();if(!body||typeof body!=="object")return NextResponse.json({error:"Invalid request"},{status:400});
    const v=body as Record<string,unknown>;
    if(typeof v.storeId!=="string"||!/^[0-9a-f-]{36}$/i.test(v.storeId))return NextResponse.json({error:"Invalid store ID"},{status:400});
    if("serviceCenterLat" in v || "serviceCenterLng" in v || "serviceRadiusKm" in v){
      if(!("serviceCenterLat" in v)||!("serviceCenterLng" in v)||!("serviceRadiusKm" in v)){
        return NextResponse.json({error:"Latitude, longitude and radius must be submitted together"},{status:400});
      }
      const clearZone=v.serviceCenterLat===null&&v.serviceCenterLng===null&&v.serviceRadiusKm===null;
      let zone:{service_center_lat:number|null;service_center_lng:number|null;service_radius_km:number|null};
      if(clearZone){
        zone={service_center_lat:null,service_center_lng:null,service_radius_km:null};
      }else{
        const lat=Number(v.serviceCenterLat),lng=Number(v.serviceCenterLng),radius=Number(v.serviceRadiusKm);
        if(!Number.isFinite(lat)||lat < -90||lat > 90||!Number.isFinite(lng)||lng < -180||lng > 180||!Number.isFinite(radius)||radius < 0.1||radius > 100){
          return NextResponse.json({error:"Service zone needs valid coordinates and a radius from 0.1 to 100 km"},{status:400});
        }
        zone={service_center_lat:lat,service_center_lng:lng,service_radius_km:radius};
      }
      const {data:existing,error:findZoneError}=await ctx.db.from("stores").select("id,status").eq("id",v.storeId).maybeSingle();
      if(findZoneError)throw findZoneError;
      if(!existing)return NextResponse.json({error:"Store not found"},{status:404});
      if(existing.status!=="approved")return NextResponse.json({error:"Only approved stores can have a delivery zone configured"},{status:409});
      const {data,error}=await ctx.db.from("stores").update(zone).eq("id",v.storeId).eq("status","approved")
        .select("id,service_center_lat,service_center_lng,service_radius_km").maybeSingle();
      if(error)throw error;
      if(!data)return NextResponse.json({error:"Store status changed. Refresh and try again."},{status:409});
      return NextResponse.json({success:true,store:data});
    }
    if("deliveryFeeIqd" in v){
      const fee=Number(v.deliveryFeeIqd);
      if(!Number.isSafeInteger(fee)||fee<0||fee>100000000)return NextResponse.json({error:"Delivery fee must be between 0 and 100,000,000 IQD"},{status:400});
      const {data:existing,error:findFeeError}=await ctx.db.from("stores").select("id,status").eq("id",v.storeId).maybeSingle();
      if(findFeeError)throw findFeeError;
      if(!existing)return NextResponse.json({error:"Store not found"},{status:404});
      if(existing.status!=="approved")return NextResponse.json({error:"Only approved stores can have a delivery fee configured"},{status:409});
      const {data,error}=await ctx.db.from("stores").update({delivery_fee_iqd:fee})
        .eq("id",v.storeId).eq("status","approved")
        .select("id,delivery_fee_iqd").maybeSingle();
      if(error)throw error;
      if(!data)return NextResponse.json({error:"Store status changed. Refresh and try again."},{status:409});
      return NextResponse.json({success:true,store:data});
    }
    if(!["approved","rejected","suspended"].includes(String(v.status)))return NextResponse.json({error:"Invalid status"},{status:400});
    const {data:store,error:findError}=await ctx.db.from("stores").select("id,status,owner_id,store_type").eq("id",v.storeId).maybeSingle();
    if(findError)throw findError;if(!store)return NextResponse.json({error:"Store not found"},{status:404});
    if(store.status!=="pending"&&v.status!=="suspended")return NextResponse.json({error:"Only pending applications can be approved or rejected"},{status:409});
    const {data,error}=await ctx.db.from("stores").update({status:v.status,admin_note:typeof v.note==="string"?v.note.trim().slice(0,1000):null,reviewed_by:ctx.user.id,reviewed_at:new Date().toISOString()})
      .eq("id",v.storeId).eq("status",store.status)
      .select("id,status,admin_note,reviewed_at").maybeSingle();
    if(error)throw error;
    if(!data)return NextResponse.json({error:"Store status changed by another admin. Refresh and review the latest status."},{status:409});
    return NextResponse.json({success:true,store:data});
  }catch(e){console.error("Store review failed",e);return NextResponse.json({error:"Unable to review store"},{status:500});}
}
