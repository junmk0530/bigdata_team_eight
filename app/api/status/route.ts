import { database, databaseConfigured, json } from '@/lib/supabase-server';
export const dynamic='force-dynamic';
export async function GET(){
 let databaseReady=false;
 if(databaseConfigured()){const {error}=await database().from('news_datasets').select('id').limit(1);databaseReady=!error;}
 const aiConfigured=Boolean((process.env.ZAI_API_KEY&&process.env.ZAI_MODEL)||(process.env.OPENAI_API_KEY&&process.env.OPENAI_MODEL));
 return json({aiEnabled:Boolean(databaseReady&&aiConfigured),databaseConfigured:databaseConfigured(),databaseReady});
}
