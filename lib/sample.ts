import { normalizeArticles } from './news-engine.ts';
// Fictional titles for interaction and algorithm demonstrations, never current news.
const events = [
  ['Business', ['Chipmaker unveils new plant with $2 billion investment','Chipmaker unveils new plant with $1.5 billion investment','Chipmaker announces new plant with $2 billion investment','New chipmaker plant unveiled with $2 billion investment']],
  ['World', ['Coastal earthquake leaves 300 dead as rescue work continues','Coastal earthquake leaves 250 dead as rescue work continues','Rescue work continues after coastal earthquake leaves 300 dead','Coastal earthquake rescue work continues with 250 dead']],
  ['Politics', ['Senate passes budget bill after overnight session','Senate approves budget bill after overnight session','Budget bill passes Senate after overnight debate']],
  ['Tech', ['Regulators open probe into AI chatbot data practices','Regulators launch probe into AI chatbot data practices','Probe opened by regulators into AI chatbot data practices']],
  ['Sports', ['League title decided on final day of season','League title decided on season final day','Final day of season decides league title']],
  ['Health', ['Health agency updates seasonal flu vaccine guidance','Health agency issues updated seasonal flu vaccine guidance','Seasonal flu vaccine guidance updated by health agency']],
  ['World', ['Space telescope captures distant galaxy images','Distant galaxy images captured by space telescope','Space telescope releases distant galaxy images']],
] as const;
export const sampleArticles = normalizeArticles(events.flatMap(([category,titles])=>titles.map((title,i)=>({title,category,source:['A 언론','B 언론','C 언론','D 언론'][i],date:'2026-11-01'})))).articles;
