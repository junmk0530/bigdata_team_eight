import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
const out = new URL('public/workers/', root);
mkdirSync(out, { recursive: true });
const source = readFileSync(new URL('lib/news-engine.ts', root), 'utf8');
writeFileSync(new URL('news-engine.js', out), ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
writeFileSync(new URL('cluster.js', out), `import { cluster } from './news-engine.js';
self.onmessage = ({data}) => {
 try { const result = cluster(data.articles, data.threshold, progress => self.postMessage({progress})); self.postMessage({result}); }
 catch(error) { self.postMessage({error:error instanceof Error ? error.message : '분석에 실패했습니다.'}); }
};\n`);
console.log('Browser analysis worker built.');
