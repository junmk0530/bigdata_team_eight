import { apiFailure, authenticated, json } from '@/lib/supabase-server';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const {db,user}=await authenticated(request);const {data,error}=await db.from('workspace_members').select('role').eq('user_id',user.id).maybeSingle();if(error)throw error;return json({id:user.id,email:user.email,role:data?.role||'viewer'});}catch(error){return apiFailure(error);}}
