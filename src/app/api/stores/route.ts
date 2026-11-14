import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = ["restaurant","supermarket","produce_vendor","meat_seafood_vendor"] as const;
async function context() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anon||!service) return {error:NextResponse.json({error:"Server configuration is incomplete"},{status:500})};
  const jar=await cookies();
  const auth=createServerClient(url,anon,{cookies:{getAll:()=>jar.getAll(),setAll:(items)=>{try{items.forEach(({name,value,options})=>jar.set(name,value,options));}catch{}}}});
  const {data:{user},error}=await auth.auth.getUser();
  if(error||!user)return {error:NextResponse.json({error:"Authentication required"},{status:401})};
  const db=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
  return {user,role:String(user.app_metadata?.role??"customer"),db};
}

export async function GET(){
  try{
    const ctx=await context();if("error" in ctx)return ctx.error;
    const {data,error}=await ctx.db.from("stores").select("id,owner_id,name,slug,store_type,description,phone,address,status,admin_note,created_at,updated_at").eq("owner_id",ctx.user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(error)throw error;
    return NextResponse.json({store:data,role:ctx.role});
  }catch(e){console.error("Store profile load failed",e);return NextResponse.json({error:"Unable to load store profile"},{status:500});}
}

export async function POST(request:Request){
  try{
    const ctx=await context();if("error" in ctx)return ctx.error;
    const role=String(ctx.user.app_metadata?.role??"customer");
    if(!TYPES.includes(role as typeof TYPES[number]))return NextResponse.json({error:"Merchant account required"},{status:403});
    const body:unknown=await request.json();
    if(!body||typeof body!=="object")return NextResponse.json({error:"Invalid request"},{status:400});
    const v=body as Record<string,unknown>;
    const name=typeof v.name==="string"?v.name.trim():"";
    const slug=typeof v.slug==="string"?v.slug.trim().toLowerCase():"";
    const storeType=typeof v.storeType==="string"?v.storeType:"";
    if(name.length<2||name.length>120)return NextResponse.json({error:"ناوی دوکان دەبێت لە ٢ تا ١٢٠ پیت بێت."},{status:400});
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>80)return NextResponse.json({error:"ناوی لینک (slug) دروست نییە."},{status:400});
    if(storeType!==role)return NextResponse.json({error:"جۆری دوکان دەبێت لەگەڵ ڕۆڵی هەژمارەکەت یەک بگرێتەوە."},{status:403});
    const {data:existing,error:existingError}=await ctx.db.from("stores").select("id,status").eq("owner_id",ctx.user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(existingError)throw existingError;
    if(existing&&existing.status!=="rejected")return NextResponse.json({error:"پێشتر داواکاری یان دوکانێکت هەیە."},{status:409});
    const record={
      owner_id:ctx.user.id,name,slug,store_type:storeType,
      description:typeof v.description==="string"?v.description.trim().slice(0,2000):null,
      phone:typeof v.phone==="string"?v.phone.trim().slice(0,40):null,
      address:typeof v.address==="string"?v.address.trim().slice(0,300):null,
      status:"pending",admin_note:null,reviewed_by:null,reviewed_at:null
    };
    const result=existing
      ? await ctx.db.from("stores").update(record).eq("id",existing.id).select("id,name,slug,store_type,status,created_at").single()
      : await ctx.db.from("stores").insert(record).select("id,name,slug,store_type,status,created_at").single();
    if(result.error)throw result.error;
    return NextResponse.json({store:result.data}, {status:existing?200:201});
  }catch(e){console.error("Store application failed",e);return NextResponse.json({error:"دروستکردنی داواکاری دوکان سەرکەوتوو نەبوو. ناوی لینک لەوانەیە بەکارهاتووبێت."},{status:409});}
}
