import type { ClusterResult, NewsGroup } from './news-engine';
export type SharedDataset={id:string;name:string;article_count:number;threshold:number;is_sample:boolean;stats:ClusterResult['stats'];created_at:string};
export type SharedSummary={text:string;evidence:string[];verified:boolean};
export type SharedResponse={datasets:SharedDataset[];selected:SharedDataset|null;result:ClusterResult|null;summaries:Record<string,SharedSummary>};
export function mapSharedGroups(rows:{id:string;dataset_id:string;payload:NewsGroup}[],name:string,threshold:number):NewsGroup[]{return rows.map(r=>({...r.payload,id:`shared:${r.id}`,databaseId:r.id,databaseDatasetId:r.dataset_id,dataset:name,threshold}));}
