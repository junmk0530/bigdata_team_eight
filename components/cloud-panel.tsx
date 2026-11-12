'use client';
import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { getBrowserDatabase, sessionHeaders } from '@/lib/supabase-browser';
import type { Article, NewsGroup } from '@/lib/news-engine';
import type { SharedDataset, SharedResponse } from '@/lib/shared-data';
type Props={articles:Article[];threshold:number;datasetName:string;active:NewsGroup|null;isShared:boolean;onLoad:(data:SharedResponse)=>void;onBookmarks:(groups:NewsGroup[])=>void;onNotice:(message:string)=>void};
type BookmarkRecord={news_groups:{id:string;dataset_id:string;payload:NewsGroup;news_datasets:{name:string;threshold:number}}|null};
export default function CloudPanel(props:Props){
 const callbacks=useRef(props);callbacks.current=props;
 const [session,setSession]=useState<Session|null>(null),[role,setRole]=useState('viewer'),[datasets,setDatasets]=useState<SharedDataset[]>([]),[selected,setSelected]=useState(''),[configured,setConfigured]=useState(false),[pending,setPending]=useState(false),[expanded,setExpanded]=useState<'login'|'feedback'|null>(null),[email,setEmail]=useState(''),[message,setMessage]=useState(''),[sent,setSent]=useState(false);
 const alive=useRef(true);
 async function loadDataset(id?:string){
  setPending(true);
  try{const r=await fetch(`/api/datasets${id?`?id=${encodeURIComponent(id)}`:''}`),data=await r.json() as SharedResponse&{configured?:boolean;error?:string};if(!r.ok)throw new Error(data.error||'공유 데이터를 읽지 못했습니다.');if(!alive.current)return;setConfigured(data.configured!==false);setDatasets(data.datasets);setSelected(data.selected?.id||'');if(data.result)callbacks.current.onLoad(data);}
  catch(e){if(alive.current)callbacks.current.onNotice(e instanceof Error?e.message:'공유 데이터 연결에 실패했습니다.');}finally{if(alive.current)setPending(false);}
 }
 async function loadAccount(){
  try {
  const headers=await sessionHeaders();if(!headers.Authorization)return;
  const [me,bookmarks]=await Promise.all([fetch('/api/me',{headers}),fetch('/api/bookmarks',{headers})]);
  if(me.ok){const data=await me.json() as {role:string};if(alive.current)setRole(data.role);}
  if(bookmarks.ok){const data=await bookmarks.json() as {bookmarks:BookmarkRecord[]};if(alive.current)callbacks.current.onBookmarks(data.bookmarks.flatMap(({news_groups:g})=>g?[{...g.payload,id:`shared:${g.id}`,databaseId:g.id,databaseDatasetId:g.dataset_id,dataset:g.news_datasets?.name,threshold:g.news_datasets?.threshold}]:[]));}
  }catch{if(alive.current)callbacks.current.onNotice('계정 설정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');}
 }
 useEffect(()=>{
  alive.current=true;void loadDataset();const db=getBrowserDatabase();if(!db)return()=>{alive.current=false;};
  db.auth.getSession().then(({data})=>{if(alive.current){setSession(data.session);if(data.session)void loadAccount();}});
  const {data:{subscription}}=db.auth.onAuthStateChange((_event,next)=>{if(alive.current){setSession(next);if(next)setTimeout(()=>void loadAccount(),0);else {setRole('viewer');callbacks.current.onBookmarks([]);}}});
  return()=>{alive.current=false;subscription.unsubscribe();};
 },[]);
 async function login(e:React.FormEvent){e.preventDefault();const db=getBrowserDatabase();if(!db){props.onNotice('Supabase 설정 후 로그인할 수 있습니다.');return;}setPending(true);try{const {error}=await db.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:window.location.origin}});if(error)throw new Error('로그인 메일을 보내지 못했습니다. 이메일과 Supabase 인증 설정을 확인해 주세요.');setSent(true);}catch(e){props.onNotice(e instanceof Error?e.message:'로그인 요청에 실패했습니다.');}finally{setPending(false);}}
 async function publish(){setPending(true);try{const r=await fetch('/api/datasets',{method:'POST',headers:{'Content-Type':'application/json',...await sessionHeaders()},body:JSON.stringify({name:props.datasetName,articles:props.articles,threshold:props.threshold,isSample:props.datasetName.includes('시연')})}),data=await r.json() as {id:string;error?:string};if(!r.ok)throw new Error(data.error||'공유 데이터 게시에 실패했습니다.');props.onNotice('공유 데이터로 게시했습니다. 다른 방문자도 같은 결과를 볼 수 있습니다.');await loadDataset(data.id);}catch(e){props.onNotice(e instanceof Error?e.message:'게시에 실패했습니다.');}finally{setPending(false);}}
 async function feedback(e:React.FormEvent){e.preventDefault();setPending(true);try{const r=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json',...await sessionHeaders()},body:JSON.stringify({message,groupId:props.active?.databaseId,context:`${props.datasetName} | ${props.active?.title||'목록'} | threshold=${props.threshold}`})}),data=await r.json() as {error?:string};if(!r.ok)throw new Error(data.error||'QA 의견을 저장하지 못했습니다.');setMessage('');setExpanded(null);props.onNotice('QA 의견을 저장했습니다.');}catch(e){props.onNotice(e instanceof Error?e.message:'의견 저장에 실패했습니다.');}finally{setPending(false);}}
 return <section className="cloud-panel panel" aria-label="공유 데이터와 계정"><div className="cloud-bar"><div><strong>{configured&&props.isShared?'공유 뉴스':'개인 분석'}</strong><span className="cloud-status">{configured?(props.isShared?'Supabase 공유 데이터':'로컬 분석 · 공유 전'):'공유 DB 설정 대기'}</span></div><div className="cloud-actions">{datasets.length>0&&<select aria-label="공유 데이터셋" value={selected} disabled={pending} onChange={e=>void loadDataset(e.target.value)}>{datasets.map(d=><option key={d.id} value={d.id}>{d.name}{d.is_sample?' · 가상 샘플':''}</option>)}</select>}{configured&&<Button variant="outline" disabled={pending} onClick={()=>void loadDataset(selected||undefined)}>공유 목록 새로고침</Button>}{role==='admin'&&<Button disabled={pending} onClick={()=>void publish()}>현재 데이터를 공유 게시</Button>}{session?<><Button variant="outline" onClick={()=>setExpanded(expanded==='feedback'?null:'feedback')}>QA 의견</Button><Button variant="ghost" onClick={async()=>{await getBrowserDatabase()?.auth.signOut();props.onNotice('로그아웃했습니다.');}}>로그아웃</Button></>:<Button variant="outline" disabled={!getBrowserDatabase()} onClick={()=>setExpanded(expanded==='login'?null:'login')}>테스터 로그인</Button>}</div></div><p className="cloud-hint">{session?`${session.user.email||'로그인 사용자'} · ${role==='admin'?'관리자':role==='tester'?'QA 멤버':'일반 사용자'} · 공유 그룹 북마크는 계정에 저장됩니다.`:'뉴스 열람은 로그인 없이 가능합니다. 로그인하면 공유 그룹 북마크와 QA 의견을 저장할 수 있습니다.'}</p>{expanded==='login'&&<form className="cloud-form" onSubmit={login}><label htmlFor="tester-email">테스터 이메일</label><div><input id="tester-email" type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email"/><Button type="submit" disabled={pending}>로그인 링크 받기</Button></div>{sent&&<p role="status">로그인 링크를 보냈습니다. 메일의 링크를 열어 로그인해 주세요.</p>}</form>}{expanded==='feedback'&&<form className="cloud-form" onSubmit={feedback}><label htmlFor="qa-message">발견한 문제와 재현 순서를 적어 주세요</label><textarea id="qa-message" required minLength={5} maxLength={2000} value={message} onChange={e=>setMessage(e.target.value)} rows={3}/><Button type="submit" disabled={pending}>QA 의견 저장</Button></form>}</section>;
}
