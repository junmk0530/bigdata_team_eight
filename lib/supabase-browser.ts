'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let client: SupabaseClient | null = null;
export function getBrowserDatabase() {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return null;
 return client ||= createClient(url,key);
}
export async function sessionHeaders():Promise<Record<string,string>> {
 const db=getBrowserDatabase();if(!db)return {};
 const {data:{session}}=await db.auth.getSession();
 return session?{Authorization:`Bearer ${session.access_token}`} : {};
}
