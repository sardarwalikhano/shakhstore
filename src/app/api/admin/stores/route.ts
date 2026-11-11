import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";
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
    const {data,error}=await ctx.db.from("stores").select("id,owner_id,name,slug,store_type,description,phone,address,status,admin_note,reviewed_by,reviewed_at,created_at").order("created_at",{ascending:false}).limit(200);
    if(error)throw error;
    const stores=await Promise.all((data??[]).map(async s=>{const {data}=await ctx.db.auth.admin.getUserById(s.owner_id);return {...s,owner_email:data.user?.email??null};}));
    return NextResponse.json({stores});
  }catch(e){console.error("Admin stores list failed",e);return NextResponse.json({error:"Unable to load stores"},{status:500});}
}
export async function PATCH(request:Request){
  try{
    const ctx=await adminContext();if("response" in ctx)return ctx.response;
    const body:unknown=await request.json();if(!body||typeof body!=="object")return NextResponse.json({error:"Invalid request"},{status:400});
    const v=body as Record<string,unknown>;
    if(typeof v.storeId!=="string"||!/^[0-9a-f-]{36}$/i.test(v.storeId))return NextResponse.json({error:"Invalid store ID"},{status:400});
    if(!["approved","rejected","suspended"].includes(String(v.status)))return NextResponse.json({error:"Invalid status"},{status:400});
    const {data:store,error:findError}=await ctx.db.from("stores").select("id,status,owner_id,store_type").eq("id",v.storeId).maybeSingle();
    if(findError)throw findError;if(!store)return NextResponse.json({error:"Store not found"},{status:404});
    if(store.status!=="pending"&&v.status!=="suspended")return NextResponse.json({error:"Only pending applications can be approved or rejected"},{status:409});
    const {data,error}=await ctx.db.from("stores").update({status:v.status,admin_note:typeof v.note==="string"?v.note.trim().slice(0,1000):null,reviewed_by:ctx.user.id,reviewed_at:new Date().toISOString()}).eq("id",v.storeId).select("id,status,admin_note,reviewed_at").single();
    if(error)throw error;
    return NextResponse.json({success:true,store:data});
  }catch(e){console.error("Store review failed",e);return NextResponse.json({error:"Unable to review store"},{status:500});}
}
