import { cluster, normalizeArticles } from '@/lib/news-engine';
import { mapSharedGroups } from '@/lib/shared-data';
import { ApiError, apiFailure, authenticated, database, databaseConfigured, guardOrigin, json, readJson, requireRole } from '@/lib/supabase-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){try{
 if(!databaseConfigured())return json({datasets:[],selected:null,result:null,summaries:{},configured:false});
 const db=database(),{data:datasets,error}=await db.from('news_datasets').select('*').order('created_at',{ascending:false}).limit(50);
 if(error)throw new ApiError(503,'공유 데이터 테이블을 읽을 수 없습니다. Supabase 마이그레이션을 확인해 주세요.');
 const requested=new URL(request.url).searchParams.get('id');
 const selected=requested?datasets.find(d=>d.id===requested):datasets[0];
 if(requested&&!selected)throw new ApiError(404,'데이터셋을 찾을 수 없습니다.');
 if(!selected)return json({datasets,selected:null,result:null,summaries:{},configured:true});
 const rows=[];
 // PostgREST returns at most 1,000 rows by default; page so a large dataset is complete.
 for(let offset=0;offset<5000;offset+=1000){const {data,error}=await db.from('news_groups').select('id,dataset_id,payload,position').eq('dataset_id',selected.id).order('position').range(offset,offset+999);if(error)throw new ApiError(503,'뉴스 그룹을 읽지 못했습니다.');rows.push(...data);if(data.length<1000)break;}
 const groups=mapSharedGroups(rows,selected.name,selected.threshold),summaries:Record<string,unknown>={};
 const byId=new Map(groups.map(g=>[g.databaseId,g]));
 for(let offset=0;offset<5000;offset+=1000){
  const {data:stored,error:summaryError}=await db.from('group_summaries').select('group_id,text,evidence,verified').eq('dataset_id',selected.id).order('group_id').range(offset,offset+999);
  if(summaryError)throw new ApiError(503,'공유 요약을 읽지 못했습니다.');
  for(const s of stored||[]){const g=byId.get(s.group_id);if(g)summaries[g.id]={text:s.text,evidence:s.evidence,verified:s.verified};}
  if(stored.length<1000)break;
 }
 return json({datasets,selected,result:{groups,stats:selected.stats},summaries,configured:true});
 }catch(error){return apiFailure(error);}}
export async function POST(request:Request){try{
 guardOrigin(request);const {db,user}=await authenticated(request);await requireRole(db,user.id,['admin']);
 const input=await readJson(request,3500000);
 if(typeof input.name!=='string'||!input.name.trim()||input.name.length>120||!Array.isArray(input.articles))throw new ApiError(400,'데이터 이름과 기사 배열을 확인해 주세요.');
 const threshold=Number(input.threshold);if(!Number.isFinite(threshold)||threshold<.25||threshold>.85)throw new ApiError(400,'유사도 기준은 0.25~0.85 사이여야 합니다.');
 let articles;try{articles=normalizeArticles(input.articles).articles;}catch(e){throw new ApiError(400,e instanceof Error?e.message:'기사 형식을 확인해 주세요.');}
 const result=cluster(articles,threshold);
 const {data:id,error}=await db.rpc('publish_news_dataset',{p_name:input.name.trim(),p_threshold:threshold,p_stats:result.stats,p_groups:result.groups,p_is_sample:input.isSample===true});
 if(error)throw new ApiError(503,'데이터 게시에 실패했습니다. DB 마이그레이션과 관리자 권한을 확인해 주세요.');
 return json({id,articleCount:articles.length,groupCount:result.groups.length},201);
 }catch(error){return apiFailure(error);}}
