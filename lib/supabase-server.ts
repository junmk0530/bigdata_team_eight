import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
export class ApiError extends Error { status:number; constructor(status:number,message:string){super(message);this.status=status;} }
export function databaseConfigured(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);}
export function database(token?:string):SupabaseClient {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw new ApiError(503,'Supabase 연결 설정이 필요합니다.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:token?{headers:{Authorization:`Bearer ${token}`}}:undefined});
}
export async function authenticated(request:Request):Promise<{db:SupabaseClient;user:User}> {
 const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
 if(!token)throw new ApiError(401,'이 기능을 사용하려면 로그인해 주세요.');
 const db=database(token),{data:{user},error}=await db.auth.getUser(token);
 if(error||!user)throw new ApiError(401,'로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
 return {db,user};
}
export async function requireRole(db:SupabaseClient,userId:string,roles:string[]) {
 const {data,error}=await db.from('workspace_members').select('role').eq('user_id',userId).maybeSingle();
 if(error)throw new ApiError(503,'Supabase 테이블과 접근 정책을 확인해 주세요.');
 if(!data||!roles.includes(data.role))throw new ApiError(403,'관리자 또는 QA 멤버 권한이 필요합니다.');
 return data.role as string;
}
export function guardOrigin(request:Request) {const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new ApiError(403,'허용되지 않은 요청입니다.');}
export async function readJson(request:Request,maxBytes=100000) {
 if(Number(request.headers.get('content-length'))>maxBytes)throw new ApiError(413,'요청이 너무 큽니다.');
 const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'요청 본문이 필요합니다.');
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new ApiError(413,'요청이 너무 큽니다.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ApiError(400,'JSON 형식을 확인해 주세요.');}
}
export function apiFailure(error:unknown){return Response.json({error:error instanceof ApiError?error.message:'서버 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.'},{status:error instanceof ApiError?error.status:500,headers:{'Cache-Control':'no-store'}});}
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
