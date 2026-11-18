import { test } from 'node:test';
import assert from 'node:assert/strict';
import {cluster,jaccard,tokens,signature,normalizeArticles,parseDataset,parseCSV,numericDifferences} from '../lib/news-engine.ts';
import {summaryRequest} from '../lib/summary-agent.ts';
test('identical and rearranged titles cluster, unrelated events stay separate',()=>{
 const data=normalizeArticles([{title:'Senate passes budget bill after overnight session',source:'A'},{title:'Budget bill passes Senate after overnight session',source:'B'},{title:'Space telescope captures distant galaxy',source:'C'}]).articles;
 const r=cluster(data,.6);assert.deepEqual(r.groups.map(g=>g.articles.length),[2,1]);assert.equal(r.stats.matches,1);assert.ok(r.stats.candidates<r.stats.possiblePairs);
});
test('deterministic 128-dimensional MinHash and exact Jaccard',()=>{const a=tokens('The Senate passes a budget bill'),b=tokens('Budget bill passes the Senate');assert.equal(jaccard(a,b),1);assert.equal(signature(a).length,128);assert.deepEqual(signature(a),signature(b));assert.equal(jaccard(new Set(),new Set()),0);});
test('strict threshold splits moderately similar titles',()=>{const data=normalizeArticles([{title:'coastal earthquake leaves 300 dead rescue work continues'},{title:'coastal earthquake leaves 250 dead rescue work continues'}]).articles;assert.equal(cluster(data,.4).groups.length,1);assert.equal(cluster(data,1).groups.length,2);});
test('CSV handles BOM, quoted commas, escaped quotes and multiline fields',()=>{const r=parseCSV('\uFEFFtitle,source\r\n"A, B and ""C""\nnew line",Outlet\r\n');assert.equal(r[0].title,'A, B and "C"\nnew line');assert.equal(r[0].source,'Outlet');assert.throws(()=>parseCSV('title,source\n"unfinished,A'));assert.throws(()=>parseCSV('title,source\nabc,A,extra'));});
test('dataset supports HuffPost JSONL and removes unsafe URLs',()=>{const r=parseDataset('{"headline":"Senate budget vote","category":"POLITICS","link":"javascript:alert(1)"}\n{"headline":"Space telescope images","authors":"Reporter","link":"https://example.org/news"}','data.jsonl');assert.equal(r.articles[0].category,'Politics');assert.equal(r.articles[0].url,'');assert.equal(r.articles[1].url,'https://example.org/news');});
test('rejects malformed datasets and reports skipped titles',()=>{assert.throws(()=>parseDataset('source\nOutlet','x.csv'));assert.throws(()=>parseDataset('{bad}','x.json'));assert.throws(()=>normalizeArticles(Array(5001).fill({title:'x'})));const r=normalizeArticles([{title:''},{title:'a and the'},{title:'valid galaxy headline'}]);assert.equal(r.skipped,2);assert.equal(r.articles.length,1);assert.throws(()=>cluster(r.articles,NaN));});
test('numeric cues compare only expressions carrying same unit',()=>{const a=normalizeArticles([{title:'Plant investment $2 billion creates 300 jobs'},{title:'Plant investment $1.5 billion creates 250 jobs'}]).articles;assert.deepEqual(numericDifferences(a).map(d=>d.value).sort(),['$1.5 billion','$2 billion']);});
test('empty analysis safely returns no groups',()=>{assert.equal(cluster([]).groups.length,0);});
test('article and group identifiers survive input reordering',()=>{const rows=[{title:'Senate passes budget bill',source:'A'},{title:'Budget bill passes Senate',source:'B'}];const a=cluster(normalizeArticles(rows).articles),b=cluster(normalizeArticles([...rows].reverse()).articles);assert.equal(a.groups[0].id,b.groups[0].id);});
test('summary endpoint refuses missing configuration and cross-origin requests',async()=>{let r=await summaryRequest(new Request('https://site.test/api/summary',{method:'POST'}),{});assert.equal(r.status,503);r=await summaryRequest(new Request('https://site.test/api/summary',{method:'POST',headers:{origin:'https://other.test'}}),{OPENAI_API_KEY:'test',OPENAI_MODEL:'test'});assert.equal(r.status,403);});
test('summary agent runs draft and evidence verification, rejects invented evidence',async()=>{
 const articles=normalizeArticles([{title:'Senate approves budget bill'}]).articles;let calls=0;
 const mock:typeof fetch=async(_url,options)=>{calls++;const payload=JSON.parse(options!.body as string);assert.equal(payload.store,false);assert.equal(payload.text.format.type,'json_schema');return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({text:'제목에 따르면 상원이 예산안을 통과시켰습니다.',evidence:[articles[0].id],verified:calls>1})}]}]});};
 const request=()=>new Request('https://site.test/api/summary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({articles})});
 const r=await summaryRequest(request(),{OPENAI_API_KEY:'test',OPENAI_MODEL:'test'},mock);assert.equal(r.status,200);assert.equal(calls,2);assert.equal((await r.json() as {verified:boolean}).verified,true);
 const invalid:typeof fetch=async()=>Response.json({output:[{content:[{type:'output_text',text:JSON.stringify({text:'unsupported',evidence:['invented'],verified:true})}]}]});
 assert.equal((await summaryRequest(request(),{OPENAI_API_KEY:'test',OPENAI_MODEL:'test'},invalid)).status,502);
});
test('summary agent prefers Z.ai chat completions when that key is set',async()=>{
 const articles=normalizeArticles([{title:'Senate approves budget bill'}]).articles;
 const mock:typeof fetch=async(url,options)=>{
  assert.equal(url,'https://api.z.ai/api/paas/v4/chat/completions');
  const payload=JSON.parse(options!.body as string);assert.equal(payload.response_format.type,'json_object');assert.equal(payload.model,'glm-test');
  return Response.json({choices:[{message:{content:JSON.stringify({text:'제목에 따르면 상원이 예산안을 통과시켰습니다.',evidence:[articles[0].id],verified:true})}}]});
 };
 const request=()=>new Request('https://site.test/api/summary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({articles})});
 const response=await summaryRequest(request(),{ZAI_API_KEY:'zai',ZAI_MODEL:'glm-test',OPENAI_API_KEY:'openai',OPENAI_MODEL:'gpt'},mock);
 assert.equal(response.status,200);
});
