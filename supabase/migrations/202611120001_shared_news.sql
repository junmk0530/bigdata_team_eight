begin;
create table public.workspace_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('admin','tester')),
 created_at timestamptz not null default now()
);
create function public.is_news_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workspace_members where user_id=(select auth.uid()) and role='admin');
$$;
create function public.is_news_tester() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workspace_members where user_id=(select auth.uid()) and role in ('admin','tester'));
$$;
create table public.news_datasets (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 1 and 120),
 article_count integer not null check(article_count between 1 and 5000),
 threshold double precision not null check(threshold between 0.25 and 0.85),
 stats jsonb not null check(jsonb_typeof(stats)='object'),
 is_sample boolean not null default false,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create table public.news_groups (
 id uuid primary key default gen_random_uuid(),
 dataset_id uuid not null references public.news_datasets(id) on delete cascade,
 local_id text not null,
 position integer not null check(position>=0),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 unique(dataset_id,local_id), unique(id,dataset_id)
);
create index news_groups_dataset_order on public.news_groups(dataset_id,position);
create table public.group_summaries (
 group_id uuid primary key,
 dataset_id uuid not null,
 text text not null check(length(text) between 1 and 4000),
 evidence jsonb not null check(jsonb_typeof(evidence)='array' and jsonb_array_length(evidence)>0),
 verified boolean not null check(verified),
 created_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 foreign key(group_id,dataset_id) references public.news_groups(id,dataset_id) on delete cascade
);
create index group_summaries_dataset on public.group_summaries(dataset_id);
create table public.bookmarks (
 user_id uuid not null references auth.users(id) on delete cascade,
 group_id uuid not null references public.news_groups(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,group_id)
);
create table public.qa_feedback (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 group_id uuid references public.news_groups(id) on delete set null,
 message text not null check(length(message) between 5 and 2000),
 context text not null default '' check(length(context)<=500),
 status text not null default 'open' check(status in ('open','resolved')),
 created_at timestamptz not null default now()
);
create index qa_feedback_reporter_created on public.qa_feedback(reporter_id,created_at);
create table public.ai_usage (
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null default ((now() at time zone 'UTC')::date),
 requests integer not null default 0,
 primary key(user_id,day)
);
alter table public.workspace_members enable row level security;
alter table public.news_datasets enable row level security;
alter table public.news_groups enable row level security;
alter table public.group_summaries enable row level security;
alter table public.bookmarks enable row level security;
alter table public.qa_feedback enable row level security;
alter table public.ai_usage enable row level security;

revoke all on public.workspace_members,public.news_datasets,public.news_groups,public.group_summaries,public.bookmarks,public.qa_feedback,public.ai_usage from anon,authenticated;
grant all on public.workspace_members,public.news_datasets,public.news_groups,public.group_summaries,public.bookmarks,public.qa_feedback,public.ai_usage to service_role;
grant select on public.news_datasets,public.news_groups,public.group_summaries to anon,authenticated;
grant select on public.workspace_members,public.qa_feedback to authenticated;
grant select,insert,update,delete on public.bookmarks to authenticated;
grant insert,update on public.group_summaries to authenticated;
create policy public_dataset_read on public.news_datasets for select to anon,authenticated using(true);
create policy public_groups_read on public.news_groups for select to anon,authenticated using(true);
create policy public_summaries_read on public.group_summaries for select to anon,authenticated using(true);
create policy own_membership_read on public.workspace_members for select to authenticated using(user_id=(select auth.uid()) or (select public.is_news_admin()));
create policy tester_summary_insert on public.group_summaries for insert to authenticated with check((select public.is_news_tester()) and created_by=(select auth.uid()));
create policy tester_summary_update on public.group_summaries for update to authenticated using((select public.is_news_tester())) with check((select public.is_news_tester()) and created_by=(select auth.uid()));
create policy own_bookmarks on public.bookmarks for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_or_admin_feedback_read on public.qa_feedback for select to authenticated using(reporter_id=(select auth.uid()) or (select public.is_news_admin()));

create function public.publish_news_dataset(p_name text,p_threshold double precision,p_stats jsonb,p_groups jsonb,p_is_sample boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare dataset uuid; group_count integer; article_total integer;
begin
 if not (public.is_news_admin() or coalesce(auth.role(),'')='service_role') then raise exception 'Admin role required' using errcode='42501'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 120 or p_threshold is null or not (p_threshold between 0.25 and 0.85) then raise exception 'Invalid dataset metadata'; end if;
 if jsonb_typeof(p_groups) is distinct from 'array' or jsonb_typeof(p_stats) is distinct from 'object' then raise exception 'Invalid payload'; end if;
 group_count:=jsonb_array_length(p_groups);
 if group_count not between 1 and 5000 or octet_length(p_groups::text)>10000000 then raise exception 'Dataset limit exceeded'; end if;
 if exists(select 1 from jsonb_array_elements(p_groups) g where jsonb_typeof(g->'articles') is distinct from 'array' or jsonb_typeof(g->'id') is distinct from 'string' or length(g->>'id')>120 or jsonb_typeof(g->'title') is distinct from 'string' or length(g->>'title') not between 1 and 1000) then raise exception 'Invalid group'; end if;
 select sum(jsonb_array_length(g->'articles')) into article_total from jsonb_array_elements(p_groups) g;
 if article_total not between 1 and 5000 or article_total is distinct from (p_stats->>'articles')::integer then raise exception 'Invalid article count'; end if;
 insert into public.news_datasets(name,article_count,threshold,stats,is_sample,created_by) values(trim(p_name),article_total,p_threshold,p_stats,p_is_sample,auth.uid()) returning id into dataset;
 insert into public.news_groups(dataset_id,local_id,position,payload) select dataset,g->>'id',(ordinality-1)::integer,g from jsonb_array_elements(p_groups) with ordinality as groups(g,ordinality);
 return dataset;
end;
$$;
create function public.consume_ai_quota() returns boolean language plpgsql security definer set search_path='' as $$
declare count_now integer;
begin
 if not public.is_news_tester() then raise exception 'QA member role required' using errcode='42501'; end if;
 insert into public.ai_usage(user_id,day,requests) values(auth.uid(),(now() at time zone 'UTC')::date,1)
 on conflict(user_id,day) do update set requests=public.ai_usage.requests+1 where public.ai_usage.requests<20
 returning requests into count_now;
 return count_now is not null;
end;
$$;
create function public.submit_qa_feedback(p_message text,p_group_id uuid default null,p_context text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare feedback uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if (select count(*) from public.qa_feedback where reporter_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'Feedback rate limit exceeded'; end if;
 insert into public.qa_feedback(reporter_id,group_id,message,context) values(auth.uid(),p_group_id,trim(p_message),p_context) returning id into feedback;
 return feedback;
end;
$$;
revoke all on function public.is_news_admin(), public.is_news_tester() from public;
grant execute on function public.is_news_admin(), public.is_news_tester() to anon,authenticated,service_role;
revoke all on function public.publish_news_dataset(text,double precision,jsonb,jsonb,boolean),public.consume_ai_quota(),public.submit_qa_feedback(text,uuid,text) from public;
grant execute on function public.publish_news_dataset(text,double precision,jsonb,jsonb,boolean) to authenticated,service_role;
grant execute on function public.consume_ai_quota(),public.submit_qa_feedback(text,uuid,text) to authenticated;
commit;
