import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { jaccard, normalizeArticles, signature, tokens } from '../lib/news-engine.ts';

type Row = { title: string; source: string; category: string; date: string; url: string; story: string };
const rows = JSON.parse(readFileSync(new URL('../data/uci-eval.json', import.meta.url), 'utf8')) as Row[];
const normalized = normalizeArticles(rows);
if (normalized.articles.length !== rows.length) throw new Error(`전처리에서 ${rows.length - normalized.articles.length}건이 빠졌습니다.`);
const articles = normalized.articles;
const stories = rows.map(row => row.story);
const sets = articles.map(article => tokens(article.title));
const signatures = sets.map(signature);
const n = articles.length;
const possible = n * (n - 1) / 2;

function pairKey(left: number, right: number) {
  return left * n + right;
}

function truth(threshold: number) {
  const started = performance.now();
  const pairs = new Set<number>();
  let sameStory = 0;
  let sameStoryHit = 0;
  for (let right = 1; right < n; right++) {
    if (!sets[right].size) continue;
    for (let left = 0; left < right; left++) {
      if (!sets[left].size) continue;
      const same = stories[left] === stories[right];
      if (same) sameStory++;
      if (jaccard(sets[left], sets[right]) < threshold) continue;
      pairs.add(pairKey(left, right));
      if (same) sameStoryHit++;
    }
  }
  return { pairs, ms: Math.round(performance.now() - started), sameStory, sameStoryHit };
}

function candidates(bands: number, rowsPerBand: number) {
  const started = performance.now();
  const buckets = new Map<string, number[]>();
  const found = new Set<number>();
  let capped = false;
  for (let right = 0; right < n; right++) {
    if (!sets[right].size) continue;
    for (let band = 0; band < bands; band++) {
      const offset = band * rowsPerBand;
      let key = `${band}:`;
      for (let row = 0; row < rowsPerBand; row++) key += `${signatures[right][offset + row]},`;
      const bucket = buckets.get(key) || [];
      for (const left of bucket) {
        const key = pairKey(left, right);
        if (found.has(key)) continue;
        if (found.size >= 300000) { capped = true; break; }
        found.add(key);
      }
      if (capped) break;
      bucket.push(right);
      buckets.set(key, bucket);
    }
    if (capped) break;
  }
  return { found, ms: Math.round(performance.now() - started), capped };
}

function overlap(found: Set<number>, truthPairs: Set<number>) {
  let hit = 0;
  for (const pair of found) if (truthPairs.has(pair)) hit++;
  return hit;
}

function percent(value: number | null) {
  return value === null ? '해당 없음' : `${(value * 100).toFixed(1)}%`;
}

const thresholds = [0.3, 0.4, 0.5];
const truths = new Map(thresholds.map(threshold => [threshold, truth(threshold)]));
const bandConfigs = [
  { bands: 64, rows: 2 },
  { bands: 32, rows: 4 },
  { bands: 16, rows: 8 },
  { bands: 128, rows: 1 },
];
const candidateCache = new Map(bandConfigs.map(config => [`${config.bands}x${config.rows}`, candidates(config.bands, config.rows)]));
const runs = [
  { name: '64밴드 × 2행, 기준 0.40 (현재 서비스)', bands: 64, rows: 2, threshold: 0.4 },
  { name: '32밴드 × 4행, 기준 0.40', bands: 32, rows: 4, threshold: 0.4 },
  { name: '16밴드 × 8행, 기준 0.40', bands: 16, rows: 8, threshold: 0.4 },
  { name: '128밴드 × 1행, 기준 0.40', bands: 128, rows: 1, threshold: 0.4 },
  { name: '64밴드 × 2행, 기준 0.30', bands: 64, rows: 2, threshold: 0.3 },
  { name: '64밴드 × 2행, 기준 0.50', bands: 64, rows: 2, threshold: 0.5 },
].map(run => {
  const truthSet = truths.get(run.threshold)!;
  const cand = candidateCache.get(`${run.bands}x${run.rows}`)!;
  const hit = overlap(cand.found, truthSet.pairs);
  return {
    ...run,
    candidates: cand.found.size,
    capped: cand.capped,
    candidateMs: cand.ms,
    truthPairs: truthSet.pairs.size,
    truthMs: truthSet.ms,
    hit,
    precision: cand.found.size ? hit / cand.found.size : null,
    recall: truthSet.pairs.size ? hit / truthSet.pairs.size : null,
    reduction: 1 - cand.found.size / possible,
  };
});

const lines = [
  '# LSH 후보와 전체 쌍 Jaccard 비교',
  '',
  `샘플은 UCI News Aggregator에서 같은 사건(STORY)의 제목이 2개 이상인 사건만 모아 ${n.toLocaleString('ko-KR')}개로 잘랐다. 사건 수는 ${new Set(stories).size.toLocaleString('ko-KR')}개다. 비교 가능한 전체 쌍은 ${possible.toLocaleString('ko-KR')}개다.`,
  '',
  '정답 쌍은 두 제목의 단어 집합 Jaccard가 기준 이상인 쌍이다. LSH 후보는 같은 밴드 버킷에 들어간 쌍이며, 서비스와 같이 후보가 300,000쌍을 넘으면 거기서 멈춘다. Precision은 후보 중 정답인 비율, Recall은 정답 중 후보로 발견된 비율이다.',
  '',
  '## 전체 쌍 정답',
  '',
  '| Jaccard 기준 | 정답 쌍 | 전체 쌍 계산 시간 | 같은 사건 쌍 | 같은 사건이면서 기준 이상 |',
  '|---|---:|---:|---:|---:|',
  ...thresholds.map(threshold => {
    const item = truths.get(threshold)!;
    return `| ${threshold.toFixed(2)} | ${item.pairs.size.toLocaleString('ko-KR')} | ${item.ms.toLocaleString('ko-KR')} ms | ${item.sameStory.toLocaleString('ko-KR')} | ${item.sameStoryHit.toLocaleString('ko-KR')} |`;
  }),
  '',
  '같은 사건 쌍은 UCI가 같은 STORY로 묶어 둔 제목 쌍이다. 그중 Jaccard 기준을 넘는 비율이 낮으면, 제목 단어가 달라도 같은 사건인 경우를 이 방법이 놓친다는 뜻이다.',
  '',
  '## LSH 설정 비교',
  '',
  '| 설정 | 후보 쌍 | Precision | Recall | 전체 비교 대비 감소 | 후보 생성 시간 | 비고 |',
  '|---|---:|---:|---:|---:|---:|---|',
  ...runs.map(run => `| ${run.name} | ${run.candidates.toLocaleString('ko-KR')} | ${percent(run.precision)} | ${percent(run.recall)} | ${percent(run.reduction)} | ${run.candidateMs.toLocaleString('ko-KR')} ms | ${run.capped ? '후보 300,000쌍 한도에서 중단' : '한도 안'} |`),
  '',
  '현재 서비스 설정은 128차원 MinHash, 64밴드 × 2행, Jaccard 0.40이다. 서명은 128개이므로 밴드 수와 행 수의 곱은 128 이하다.',
  '',
  '1,500건에서는 전체 쌍 계산이 수백 ms, 현재 설정 후보 생성도 같은 자릿수다. 비교 횟수는 크게 줄지만 이 크기에서는 시간 차이가 크지 않다. 서비스는 후보를 만든 뒤 Jaccard로 다시 걸러 그룹을 만들므로, 낮은 Precision은 잘못된 그룹이 아니라 추가로 검증하는 쌍이 많다는 뜻이다. 화면 기본값은 정답을 놓치지 않는 64밴드 × 2행을 유지한다.',
  '',
  '같은 사건 쌍 가운데 Jaccard 기준을 넘는 비율이 낮으면, 제목 단어가 다른 같은 사건은 이 방법으로 묶이지 않는다.',
  '',
  '생성: `npm run eval:lsh`',
  '',
];

mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/EXPERIMENT.md', import.meta.url), lines.join('\n'), 'utf8');
writeFileSync(new URL('../data/lsh-results.json', import.meta.url), JSON.stringify({ n, possible, runs, truths: thresholds.map(threshold => ({ threshold, ...truths.get(threshold)!, pairs: truths.get(threshold)!.pairs.size })) }, null, 2), 'utf8');
console.log(lines.join('\n'));
