import { aiEnabled, summaryRequest } from '@/lib/summary-agent';
import { ApiError, apiFailure, authenticated, guardOrigin, json, readJson, requireRole } from '@/lib/supabase-server';
import type { NewsGroup } from '@/lib/news-engine';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;
export async function POST(request:Request){try{
 guardOrigin(request);const {db,user}=await authenticated(request);await requireRole(db,user.id,['admin','tester']);
 const body=await readJson(request);if(typeof body.groupId!=='string')throw new ApiError(400,'공유 데이터의 그룹을 선택해 주세요.');
 const {data:group,error}=await db.from('news_groups').select('id,dataset_id,payload').eq('id',body.groupId).single();if(error||!group)throw new ApiError(404,'공유 그룹을 찾을 수 없습니다.');
 const env={OPENAI_API_KEY:process.env.OPENAI_API_KEY,OPENAI_MODEL:process.env.OPENAI_MODEL,ZAI_API_KEY:process.env.ZAI_API_KEY,ZAI_MODEL:process.env.ZAI_MODEL};
 if(!aiEnabled(env))throw new ApiError(503,'서버의 AI 모델 설정이 필요합니다.');
 const {data:allowed,error:quotaError}=await db.rpc('consume_ai_quota');if(quotaError||!allowed)throw new ApiError(429,'하루 AI 요약 한도에 도달했습니다.');
 const payload=group.payload as NewsGroup;
 const response=await summaryRequest(new Request(request.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({articles:payload.articles.slice(0,20)})}),env);
 if(!response.ok)return response;
 const summary=await response.json() as {text:string;evidence:string[];verified:boolean};
 const {error:saveError}=await db.from('group_summaries').upsert({group_id:group.id,dataset_id:group.dataset_id,...summary,created_by:user.id,updated_at:new Date().toISOString()},{onConflict:'group_id'});
 if(saveError)throw new ApiError(503,'요약을 생성했지만 DB에 저장하지 못했습니다.');
 return json(summary);
 }catch(error){return apiFailure(error);}}
