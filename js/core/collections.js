import { getSupabaseClient } from "./supabase.js";

export async function listCollections(userId){
 const supabase = await getSupabaseClient();
 let query=supabase.from("anime_collections").select("id,owner_id,title,description,cover_url,is_public,created_at,updated_at").order("created_at",{ascending:false});
 query=userId?query.or("is_public.eq.true,owner_id.eq."+userId):query.eq("is_public",true);
 const {data,error}=await query;
 if(error)throw error;
 const rows=data||[];
 if(!rows.length)return [];
 const ids=rows.map(x=>x.id);
 const [itemsResult,ratingsResult]=await Promise.all([
  supabase.from("anime_collection_items").select("collection_id").in("collection_id",ids),
  supabase.from("anime_collection_ratings").select("collection_id,rating").in("collection_id",ids)
 ]);
 if(itemsResult.error)throw itemsResult.error;
 if(ratingsResult.error)throw ratingsResult.error;
 return rows.map(row=>{
  const ratings=(ratingsResult.data||[]).filter(x=>x.collection_id===row.id);
  return {...row,item_count:(itemsResult.data||[]).filter(x=>x.collection_id===row.id).length,
   rating_count:ratings.length,average_rating:ratings.length?ratings.reduce((s,x)=>s+Number(x.rating),0)/ratings.length:0};
 });
}

export async function getCollection(id){
 const supabase = await getSupabaseClient();
 const {data:collection,error}=await supabase.from("anime_collections").select("*").eq("id",id).single();
 if(error)throw error;
 const [itemsResult,ratingsResult,userResult]=await Promise.all([
  supabase.from("anime_collection_items").select("*").eq("collection_id",id).order("position").order("created_at"),
  supabase.from("anime_collection_ratings").select("user_id,rating").eq("collection_id",id),
  supabase.auth.getUser()
 ]);
 if(itemsResult.error)throw itemsResult.error;
 if(ratingsResult.error)throw ratingsResult.error;
 const ratings=ratingsResult.data||[];
 const userId=userResult.data?.user?.id||null;
 return {collection,items:itemsResult.data||[],ratings,
  average_rating:ratings.length?ratings.reduce((s,x)=>s+Number(x.rating),0)/ratings.length:0,
  rating_count:ratings.length,my_rating:ratings.find(x=>x.user_id===userId)?.rating||0};
}

export async function createCollection(userId,values){
 const supabase = await getSupabaseClient();
 const {data,error}=await supabase.from("anime_collections").insert({
  owner_id:userId,title:String(values.title||"").trim(),description:String(values.description||"").trim(),
  cover_url:String(values.cover_url||"").trim()||null,is_public:!!values.is_public
 }).select("*").single();
 if(error)throw error;
 return data;
}
export async function updateCollection(id,values){
 const supabase = await getSupabaseClient();
 const {error}=await supabase.from("anime_collections").update({
  title:String(values.title||"").trim(),description:String(values.description||"").trim(),
  cover_url:String(values.cover_url||"").trim()||null,is_public:!!values.is_public,updated_at:new Date().toISOString()
 }).eq("id",id);
 if(error)throw error;
}
export async function deleteCollection(id){
 const supabase = await getSupabaseClient();
 const {error}=await supabase.from("anime_collections").delete().eq("id",id);
 if(error)throw error;
}
export async function addCollectionAnime(collectionId,anime){
 const supabase = await getSupabaseClient();
 const {data:last,error:readError}=await supabase.from("anime_collection_items").select("position").eq("collection_id",collectionId).order("position",{ascending:false}).limit(1).maybeSingle();
 if(readError)throw readError;
 const nextPosition=Math.max(0,Number(last?.position)||0)+1;
 const {error}=await supabase.from("anime_collection_items").upsert({collection_id:collectionId,anime_id:Number(anime.id),anime_data:anime,position:nextPosition},{onConflict:"collection_id,anime_id"});
 if(error)throw error;
}
export async function removeCollectionAnime(itemId){
 const supabase = await getSupabaseClient();
 const {error}=await supabase.from("anime_collection_items").delete().eq("id",itemId);
 if(error)throw error;
}
export async function rateCollection(collectionId,userId,rating){
 const supabase = await getSupabaseClient();
 const {error}=await supabase.from("anime_collection_ratings").upsert({
  collection_id:collectionId,user_id:userId,rating:Number(rating),updated_at:new Date().toISOString()
 },{onConflict:"collection_id,user_id"});
 if(error)throw error;
}
