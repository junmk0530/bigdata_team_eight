import { ApiError, apiFailure, authenticated, guardOrigin, json, readJson } from '@/lib/supabase-server';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{
 guardOrigin(request);const {db,user}=await authenticated(request),body=await readJson(request,12000);
 if(typeof body.message!=='string'||body.message.trim().length<5||body.message.length>2000)throw new ApiError(400,'QA 의견을 5~2,000자로 작성해 주세요.');
 const {data,error}=await db.rpc('submit_qa_feedback',{p_message:body.message.trim(),p_group_id:typeof body.groupId==='string'?body.groupId:null,p_context:typeof body.context==='string'?body.context.slice(0,500):''});
 if(error)throw new ApiError(429,'의견 저장에 실패했습니다. 잠시 후 다시 시도하거나 DB 설정을 확인해 주세요.');
 return json({id:data,reporterId:user.id},201);
 }catch(error){return apiFailure(error);}}
