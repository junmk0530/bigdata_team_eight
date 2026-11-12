export type Article = { id: string; title: string; source: string; category: string; date: string; url: string };
export type NewsGroup = { id: string; title: string; articles: Article[]; category: string; keywords: string[]; differences: { value: string; articles: Article[] }[]; threshold?: number; dataset?: string; databaseId?: string; databaseDatasetId?: string };
export type ClusterResult = { groups: NewsGroup[]; stats: { articles: number; candidates: number; possiblePairs: number; matches: number; ms: number; threshold: number } };
const STOP = new Set('a an the and or but to of in on at for from with by as is are was were be been this that after before into over amid says said new news report reports update live'.split(' '));
export function tokens(title: string): Set<string> {
  return new Set((title.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(w => !STOP.has(w)));
}
export function hash(text: string): number { let h = 2166136261; for (const c of text) { h ^= c.codePointAt(0)!; h = Math.imul(h, 16777619); } return h >>> 0; }
export function jaccard(a: Set<string>, b: Set<string>): number { let n = 0; for (const x of a) if (b.has(x)) n++; return a.size + b.size - n ? n / (a.size + b.size - n) : 0; }
const PRIME = 4294967291;
const PERMUTATIONS = Array.from({length:128}, (_, i) => [1 + hash(`a-${i}`) % 65534, hash(`b-${i}`)]);
export function signature(words: Set<string>): number[] {
  const values = [...words].map(hash);
  return PERMUTATIONS.map(([a,b]) => { let min = PRIME; for (const x of values) min = Math.min(min, (a * x + b) % PRIME); return min; });
}
export function numericDifferences(articles: Article[]) {
  const values = new Map<string, Article[]>();
  for (const article of articles) {
    const matches = article.title.toLowerCase().match(/\$?\d+(?:[.,]\d+)*\s*(?:billion|million|percent|%|dead|deaths|injured|a\.m\.|p\.m\.|hours?|votes?)/g) || [];
    for (const value of new Set(matches.map(x => x.trim()))) values.set(value, [...(values.get(value) || []), article]);
  }
  // Compare only numbers carrying the same explicit unit/context. This is a review cue, not NLI.
  const units = new Map<string, string[]>();
  for (const v of values.keys()) { const unit = v.replace(/[\d.,$\s]/g, ''); units.set(unit, [...(units.get(unit) || []), v]); }
  const differing = new Set([...units.values()].filter(v => v.length > 1).flat());
  return [...values].filter(([v]) => differing.has(v)).map(([value, articles]) => ({value, articles}));
}
export function cluster(articles: Article[], threshold = .4, progress?: (n: number) => void): ClusterResult {
  if (articles.length > 5000) throw new Error('한 번에 최대 5,000개 제목을 분석할 수 있습니다. 파일을 나누어 올려 주세요.');
  if (!Number.isFinite(threshold) || threshold < .2 || threshold > 1) throw new Error('유사도 기준은 0.2~1 사이여야 합니다.');
  const started = performance.now(), sets = articles.map(a => tokens(a.title));
  const sigs = sets.map(signature), buckets = new Map<string, number[]>(), candidates = new Set<number>();
  const n = articles.length, parent = Array.from({length:n}, (_,i) => i), degrees = new Uint32Array(n);
  const root = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  let matches = 0;
  for (let i = 0; i < n; i++) {
    if (!sets[i].size) continue;
    for (let band = 0; band < 64; band++) {
      const key = `${band}:${sigs[i][band*2]},${sigs[i][band*2+1]}`;
      const bucket = buckets.get(key) || [];
      for (const j of bucket) {
        const pair = j * n + i;
        if (candidates.has(pair)) continue;
        if (candidates.size >= 300000) throw new Error('유사 후보가 300,000쌍을 넘었습니다. 중복 행을 정리하거나 파일을 나누어 분석해 주세요.');
        candidates.add(pair);
        if (jaccard(sets[i], sets[j]) >= threshold) { parent[root(i)] = root(j); degrees[i]++; degrees[j]++; matches++; }
      }
      bucket.push(i); buckets.set(key, bucket);
    }
    if (i % 100 === 0) progress?.(Math.round(i / n * 100));
  }
  const components = new Map<number, number[]>();
  articles.forEach((_, i) => { const r = root(i); components.set(r, [...(components.get(r) || []), i]); });
  const groups = [...components.values()].map(indices => {
    indices.sort((a,b) => degrees[b]-degrees[a] || articles[a].title.localeCompare(articles[b].title));
    const members = indices.map(i => articles[i]), counts = new Map<string, number>();
    indices.forEach(i => sets[i].forEach(w => counts.set(w, (counts.get(w) || 0) + 1)));
    const categories = new Map<string, number>(); members.forEach(a => categories.set(a.category, (categories.get(a.category) || 0)+1));
    return { id: `g-${hash(members.map(a=>a.id).sort().join('|'))}`, title: members[0].title, articles: members,
      category: [...categories].sort((a,b)=>b[1]-a[1])[0][0], keywords: [...counts].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,6).map(([w])=>w), differences: numericDifferences(members) };
  }).sort((a,b) => b.articles.length-a.articles.length || a.title.localeCompare(b.title));
  return {groups, stats:{articles:n, candidates:candidates.size, possiblePairs:n*(n-1)/2, matches, ms:Math.round(performance.now()-started), threshold}};
}
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], value = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i+1] === '"') {value += '"'; i++;} else if (quoted || !value) quoted = !quoted; else value += c; }
    else if (c === ',' && !quoted) {row.push(value); value = '';}
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i+1] === '\n') i++; row.push(value); if (row.some(x=>x.trim())) rows.push(row); row=[]; value=''; }
    else value += c;
  }
  if (quoted) throw new Error('CSV의 따옴표가 닫히지 않았습니다. 파일 형식을 확인해 주세요.');
  row.push(value); if(row.some(x=>x.trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift()!.map(h => h.trim().toLowerCase());
  if (!headers.some(h => ['title','headline','news_title'].includes(h))) throw new Error('title 또는 headline 열이 필요합니다. 예시 CSV를 내려받아 확인해 주세요.');
  return rows.map((r, i) => { if(r.length !== headers.length) throw new Error(`CSV ${i+2}번째 행의 열 개수가 맞지 않습니다.`); return Object.fromEntries(headers.map((h,i) => [h,r[i] || ''])); });
}
export function normalizeArticles(rows: unknown[]): { articles: Article[]; skipped: number } {
  if(rows.length > 5000) throw new Error('한 번에 최대 5,000개 제목을 분석할 수 있습니다.');
  let skipped = 0;
  const occurrences = new Map<string,number>();
  const articles = rows.flatMap((input, i) => {
    const r = input && typeof input === 'object' ? input as Record<string,unknown> : {};
    const raw = r.title ?? r.headline ?? r.news_title;
    if(typeof raw !== 'string' || !raw.trim() || raw.length > 1000 || !tokens(raw).size) { skipped++; return []; }
    const str = (v: unknown, fallback = '') => typeof v === 'string' ? v.trim().slice(0,2000) : fallback;
    const title = raw.trim(), source = str(r.source ?? r.publisher ?? r.authors, '출처 미상') || '출처 미상';
    const url = str(r.url ?? r.link), date = str(r.date ?? r.published_at);
    let safeURL = ''; try { const u = new URL(url); if(['https:','http:'].includes(u.protocol)) safeURL=u.href; } catch {}
    const rawCategory = str(r.category ?? r.topic, 'Other');
    const map: Record<string,string> = {world:'World',politics:'Politics',business:'Business',tech:'Tech',technology:'Tech',sports:'Sports',sport:'Sports',health:'Health',wellness:'Health'};
    const fingerprint=`${title}|${source}|${date}|${safeURL}`;
    const occurrence=occurrences.get(fingerprint)||0; occurrences.set(fingerprint,occurrence+1);
    return [{id:`a-${hash(fingerprint)}-${hash([...fingerprint].reverse().join(''))}-${occurrence}`,title,source,category:map[rawCategory.toLowerCase()] || rawCategory || 'Other',date,url:safeURL}];
  });
  if(!articles.length) throw new Error('분석할 수 있는 제목이 없습니다. title/headline 열을 확인해 주세요.');
  return {articles,skipped};
}
export function parseDataset(text: string, filename: string) {
  let rows: unknown;
  if (/\.jsonl$/i.test(filename)) rows = text.split(/\r?\n/).filter(l=>l.trim()).map((l,i) => {try{return JSON.parse(l);}catch{throw new Error(`JSONL ${i+1}번째 줄을 확인해 주세요.`);}});
  else if (/\.json$/i.test(filename)) { const data=JSON.parse(text); rows = Array.isArray(data) ? data : data.articles; }
  else rows = parseCSV(text);
  if(!Array.isArray(rows)) throw new Error('JSON 배열 또는 {"articles": [...]} 형식이 필요합니다.');
  return normalizeArticles(rows);
}
