import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';

export const CATEGORIES = ['男科基础知识', '指南与共识', '基本手术', '基础实验操作', '技术与结果判读', '文献与科研'];
const BASE = {
  m1: ['模块一','解剖生理',0], m2: ['模块二','男性不育',0],
  m3: ['模块三','精液分析',4], m4: ['模块四','性功能障碍',0],
  m5: ['模块五','检查与治疗',0], m6: ['模块六','文献检索',5],
  m7: ['模块七','科研入门',5], m8: ['模块八','基本手术',2],
  m9: ['模块九','辅助生殖',0], map: ['学习地图','知识导航',0],
  scales: ['scales','量表速查',4], terms: ['术语表','术语对照',0]
};

// 保留具体术语，扩展中英文同义词；不把“手术/研究”等泛词扩成整个领域。
export const SYNONYMS = [
  ['western blot','western blotting','wb','免疫印迹','蛋白印迹'],
  ['qpcr','rt-qpcr','实时荧光定量','荧光定量','定量pcr'],
  ['精索静脉曲张','varicocele'], ['男性不育','male infertility'],
  ['无精子症','azoospermia'], ['显微取精','micro-tese','microdissection testicular sperm extraction'],
  ['人工授精','iui','intrauterine insemination'], ['体外受精','ivf','in vitro fertilization'],
  ['单精子注射','icsi'], ['睾丸扭转','testicular torsion'],
  ['勃起功能障碍','ed','erectile dysfunction'], ['早泄','pe','premature ejaculation'],
  ['免疫荧光','immunofluorescence'], ['细胞培养','cell culture'],
  ['阴性对照','negative control'], ['阳性对照','positive control'],
  ['内参','reference gene','loading control'], ['复发','recurrence'],
  ['流式','flow cytometry'], ['精液','semen'], ['精子','sperm']
];
const NOISE = /请问|请帮我|帮我|查一下|查找|怎么|如何|什么|为什么|一下|这个|那个|相关|知识|资料|内容|现在|最新|介绍|说明|有哪些|的|了|吗|呢|啊|是|和|与|在|我|你|想|要/g;
function contains(text, term) {
  return /^[a-z0-9-]+$/i.test(term)
    ? new RegExp('(^|[^a-z0-9])' + term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '(?=$|[^a-z0-9])','i').test(text)
    : text.includes(term);
}
export function queryTerms(query) {
  const text=String(query || '').toLowerCase();
  const terms=new Set(text.match(/[a-z][a-z0-9-]{1,}/g) || []);
  for(const run of text.replace(NOISE,' ').match(/[\u4e00-\u9fff]+/g) || []) {
    for(let i=0;i<run.length-1;i++) {
      terms.add(run.slice(i,i+2));
      if(i+3<=run.length) terms.add(run.slice(i,i+3));
    }
  }
  for(const group of SYNONYMS) if(group.some(t=>contains(text,t))) group.forEach(t=>terms.add(t));
  return [...terms];
}

function urlsIn(content) {
  return [...new Set((content.match(/https?:\/\/[^\s<>\])"`]+/g)||[]).map(s=>s.replace(/[，。；]+$/,'')))];
}
export function citationLinks(content) {
  const status='正文已登记标识符；本轮未独立核验书目或全文';
  const links=[];
  for(const m of content.matchAll(/\b10\.\d{4,9}\/[a-z0-9._;()/:\-]+/gi)) {
    const doi=m[0].replace(/[.,;:)]+$/,'');
    links.push({title:'DOI '+doi,url:'https://doi.org/'+doi,status});
  }
  for(const m of content.matchAll(/PMID\s*[:：]?\s*(\d{6,9})/gi)) {
    links.push({title:'PMID '+m[1],url:'https://pubmed.ncbi.nlm.nih.gov/'+m[1]+'/',status});
  }
  return links;
}
export async function loadKnowledge(root, { kbDir=join(root,'kb') }={}) {
  const registry=JSON.parse(await readFile(join(root,'data','knowledge-catalog.json'),'utf8'));
  const documents=[];
  const baseFiles=(await readdir(kbDir)).filter(f=>f.endsWith('.md')).sort();
  const records=baseFiles.map(file=>{
    const stem=file.slice(0,-3), base=BASE[stem];
    return { file: relative(root,join(kbDir,file)), id:base?.[0] || stem,
      short:base?.[1],category:CATEGORIES[base?.[2] ?? 0],kind:'知识正文',
      status:'初稿 · 待专业复核',version:'历史初稿',retrievable:true,
      ...(registry.base?.[stem] || {}) };
  }).concat(registry.documents || []);
  for(const record of records) {
    const file=resolve(root,record.file), rel=relative(root,file);
    if(rel.startsWith('..') || isAbsolute(rel)) throw new Error('知识目录包含项目外路径');
    const content=await readFile(file,'utf8');
    const title=record.title || content.split(/\r?\n/)[0].replace(/^#\s*/,'').trim();
    const outline=content.split(/\r?\n/).filter(l=>/^#{2,3}\s/.test(l)).map(l=>l.replace(/^#+\s*/,''));
    const sources=(record.sources || []).concat(citationLinks(content),urlsIn(content).map(url=>({title:new URL(url).hostname,url})));
    const uniqueSources=[...new Map(sources.filter(s=>/^https?:\/\//.test(s.url)).reverse().map(s=>[s.url,s])).values()];
    documents.push({...record,title,short:record.short || title.replace(/^模块[一二三四五六七八九十]+[：:]\s*/,''),
      content,outline,characters:content.length,sources:uniqueSources,
      summary:record.summary || outline.slice(0,5).join(' · '),
      href:'/#knowledge='+encodeURIComponent(record.id)});
  }
  if(new Set(documents.map(d=>d.id)).size!==documents.length) throw new Error('知识文档编号重复');
  return documents;
}

export function chunkDocument(document) {
  const chunks=[], headings=[];
  let buffer=[], fenced=false;
  const flush=()=>{
    const body=buffer.join('\n').trim();buffer=[];
    if(body.length<8)return;
    for(let i=0;i<body.length;i+=800) {
      chunks.push({id:document.id,module:document.id,title:document.title,
        heading:headings.filter(Boolean).join(' / '),text:body.slice(i,i+950),
        status:document.status,version:document.version,category:document.category,
        sources:document.sources || [],href:document.href || '/#knowledge='+encodeURIComponent(document.id)});
      if(i+950>=body.length)break;
    }
  };
  for(const line of String(document.content || '').split(/\r?\n/)) {
    if(/^\s*```/.test(line))fenced=!fenced;
    const h=!fenced && line.match(/^(#{1,6})\s+(.*)$/);
    if(h){flush();headings.length=h[1].length;headings[h[1].length-1]=h[2];}
    else buffer.push(line);
  }
  flush();return chunks;
}

export function searchKnowledge(documents, query, {k=6,module}={}) {
  const terms=queryTerms(query);
  if(!terms.length)return [];
  const lowerQuery=String(query || '').toLowerCase();
  const topics=SYNONYMS.slice(0,14).filter(group=>group.some(t=>contains(lowerQuery,t)));
  const chunks=documents.filter(d=>d.retrievable!==false).flatMap(chunkDocument);
  const frequency=new Map(terms.map(t=>[t,chunks.filter(c=>contains((c.title+' '+c.heading+' '+c.text).toLowerCase(),t)).length]));
  const scored=[];
  for(const chunk of chunks) {
    const head=(chunk.title+' '+chunk.heading).toLowerCase(),body=chunk.text.toLowerCase();
    const localHeading=(chunk.heading.split(' / ').at(-1) || '').toLowerCase();
    if(topics.length && !topics.some(group=>group.some(t=>contains(head+' '+body,t))))continue;
    let score=0, matched=0;
    for(const term of terms){
      const headHit=contains(localHeading,term), bodyHit=contains(body,term), titleHit=contains(chunk.title.toLowerCase(),term);
      if(!headHit&&!bodyHit&&!titleHit)continue;
      matched++;
      const idf=Math.log(1+(chunks.length-(frequency.get(term)||0)+0.5)/((frequency.get(term)||0)+0.5));
      score+=idf*(headHit?3:bodyHit?1:0.12)*(bodyHit?1.3:1)/Math.sqrt(Math.max(1,chunk.text.length/650));
    }
    if(/学习目标|大纲|思考题|参考答案|验收|留白|知识地图/.test(chunk.heading.split(' / ').at(-1) || ''))score*=0.3;
    if(matched && score>0.8)scored.push({...chunk,score:score*(chunk.id===module?1.15:1)});
  }
  scored.sort((a,b)=>b.score-a.score);
  return scored.slice(0,Math.max(1,Math.min(20,k)));
}
