import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const ADMIN='11111111-1111-4111-8111-111111111111',TESTER='22222222-2222-4222-8222-222222222222',OTHER='33333333-3333-4333-8333-333333333333';
test('SQL migration, public reads, admin publishing, private bookmarks, feedback limits and AI quota',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);grant usage on schema public,auth to anon,authenticated,service_role;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
  insert into auth.users values('${ADMIN}'),('${TESTER}'),('${OTHER}');`);
  await db.exec(readFileSync(new URL('../supabase/migrations/202611120001_shared_news.sql',import.meta.url),'utf8'));
  await db.exec(`insert into public.workspace_members(user_id,role) values('${ADMIN}','admin'),('${TESTER}','tester');`);
  const asUser=async(role:string,id='')=>{await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claim.role','${role}',false);set role ${role};`);};
  const groups=JSON.stringify([{id:'g-test',title:'Senate budget passes',category:'Politics',articles:[{id:'a-test',title:'Senate budget passes',source:'Example',category:'Politics',date:'',url:''}],keywords:['senate'],differences:[]}]);
  const stats=JSON.stringify({articles:1,candidates:0,possiblePairs:0,matches:0,ms:1,threshold:.4});
  const publish=()=>db.query<{id:string}>('select public.publish_news_dataset($1,$2,$3::jsonb,$4::jsonb,true) id',['Test dataset',.4,stats,groups]);
  await asUser('authenticated',OTHER);await assert.rejects(publish,/Admin role required/);
  // Missing JWT claims must not bypass the function's admin check.
  await asUser('authenticated');await assert.rejects(publish,/Admin role required/);
  await asUser('authenticated',ADMIN);const dataset=(await publish()).rows[0].id;
  const group=(await db.query<{id:string}>('select id from public.news_groups where dataset_id=$1',[dataset])).rows[0].id;
  await asUser('anon');assert.equal((await db.query<{n:number}>('select count(*)::int n from public.news_groups')).rows[0].n,1);
  await assert.rejects(()=>db.exec("insert into public.news_datasets(name,article_count,threshold,stats) values('illegal',1,.4,'{}')"),/permission denied/);
  await asUser('authenticated',TESTER);await db.query('insert into public.bookmarks(user_id,group_id) values($1,$2)',[TESTER,group]);
  await asUser('authenticated',OTHER);assert.equal((await db.query('select * from public.bookmarks')).rows.length,0);await assert.rejects(()=>db.query('insert into public.bookmarks(user_id,group_id) values($1,$2)',[TESTER,group]),/row-level security|duplicate key/);
  await asUser('authenticated',TESTER);await db.query('select public.submit_qa_feedback($1,$2,$3)',['Title grouping looks incorrect',group,'QA test']);
  assert.equal((await db.query('select * from public.qa_feedback')).rows.length,1);
  for(let i=0;i<19;i++)await db.query('select public.submit_qa_feedback($1,$2,$3)',['Additional QA feedback',group,'Quota test']);
  await assert.rejects(()=>db.query('select public.submit_qa_feedback($1,$2,$3)',['Over the hourly quota',group,'Quota test']),/Feedback rate limit exceeded/);
  for(let i=0;i<20;i++)assert.equal((await db.query<{ok:boolean}>('select public.consume_ai_quota() ok')).rows[0].ok,true);
  assert.equal((await db.query<{ok:boolean}>('select public.consume_ai_quota() ok')).rows[0].ok,false);
  await asUser('authenticated',OTHER);assert.equal((await db.query('select * from public.qa_feedback')).rows.length,0);await assert.rejects(()=>db.query('select public.consume_ai_quota()'),/QA member role required/);
  await asUser('authenticated',ADMIN);assert.equal((await db.query('select * from public.qa_feedback')).rows.length,20);
  // Invalid payload must leave no partial dataset or groups.
  await assert.rejects(()=>db.query('select public.publish_news_dataset($1,$2,$3::jsonb,$4::jsonb,true)',['Broken',.4,JSON.stringify({...JSON.parse(stats),articles:2}),groups]),/Invalid article count/);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from public.news_datasets')).rows[0].n,1);
 }finally{await db.close();}
});
