import { database, databaseConfigured, json } from '@/lib/supabase-server';
export const dynamic='force-dynamic';
export async function GET(){
 let databaseReady=false;
 if(databaseConfigured()){const {error}=await database().from('news_datasets').select('id').limit(1);databaseReady=!error;}
 return json({aiEnabled:Boolean(databaseReady&&process.env.OPENAI_API_KEY&&process.env.OPENAI_MODEL),databaseConfigured:databaseConfigured(),databaseReady});
}
