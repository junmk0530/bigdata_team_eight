// Explicit source allowlist: never include credentials, build state, node_modules, or the old Site.
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
const root=process.cwd();
const roots=['app','components','lib','public','vendor','supabase','tests'];
const files=['package.json','package-lock.json','tsconfig.json','next.config.ts','postcss.config.mjs','vercel.json','README.md','scripts/build-worker.mjs','scripts/seed-supabase.ts'];
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const path=join(dir,e.name),rel=relative(root,path).replaceAll('\\','/');if(rel==='public/workers')continue;if(e.isDirectory())walk(path);else if(e.isFile())files.push(rel);else throw new Error('Deployment source must contain regular files only');}}
for(const dir of roots)walk(join(root,dir));
process.stdout.write(JSON.stringify({files:files.map(file=>({file,data:readFileSync(join(root,file)).toString('base64'),encoding:'base64'}))}));
