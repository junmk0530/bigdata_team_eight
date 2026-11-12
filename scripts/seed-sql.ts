// Produces an idempotent sample-only seed for the new project's SQL editor.
import {cluster} from '../lib/news-engine.ts';
import {sampleArticles} from '../lib/sample.ts';
const result=cluster(sampleArticles,.4),name='SameStory 가상 시연 데이터';
const quote=(s:string)=>`'${s.replaceAll("'","''")}'`;
process.stdout.write(`with dataset as (
 insert into public.news_datasets(name,article_count,threshold,stats,is_sample)
 select ${quote(name)},${sampleArticles.length},0.4,${quote(JSON.stringify(result.stats))}::jsonb,true
 where not exists(select 1 from public.news_datasets where name=${quote(name)} and is_sample=true)
 returning id
)
insert into public.news_groups(dataset_id,local_id,position,payload)
select dataset.id,g->>'id',(ordinality-1)::integer,g
from dataset cross join jsonb_array_elements(${quote(JSON.stringify(result.groups))}::jsonb) with ordinality groups(g,ordinality)
returning dataset_id;\n`);
