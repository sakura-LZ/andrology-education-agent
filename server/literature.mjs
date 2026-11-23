import { SYNONYMS } from './knowledge.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const runFile=promisify(execFile);
// Windows 的系统代理/证书配置未必由 Node fetch 继承；使用内置 HTTP 客户端，
// 只允许固定公开文献端点。Linux 部署仍直接使用 fetch，不增加外部依赖。
async function publicLiteratureFetch(url, options) {
  if(process.platform!=='win32')return fetch(url,options);
  const target=new URL(url);
  if(target.protocol!=='https:' || target.hostname!=='www.ebi.ac.uk' || target.pathname!=='/europepmc/webservices/rest/search')throw new Error('不支持的文献端点');
  const script="[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $u=[Uri]$env:ANDROLOGY_LITERATURE_URL; if($u.Scheme -ne 'https' -or $u.Host -ne 'www.ebi.ac.uk' -or $u.AbsolutePath -ne '/europepmc/webservices/rest/search'){throw 'Unsupported endpoint'}; try {$r=Invoke-WebRequest -UseBasicParsing -Uri $u.AbsoluteUri -TimeoutSec 20; [Console]::Write($r.Content)} catch {if($_.Exception.Response){[Console]::Write(('{\"transportStatus\":'+[int]$_.Exception.Response.StatusCode+'}'));exit 0};throw}";
  const args=['-NoProfile','-NonInteractive','-Command',script];
  const config={
    windowsHide:true,timeout:25000,maxBuffer:4*1024*1024,
    env:{...process.env,ANDROLOGY_LITERATURE_URL:target.toString()}
  };
  let response;
  try{response=await runFile('pwsh.exe',args,config);}
  catch(error){if(error.code!=='ENOENT')throw error;response=await runFile('powershell.exe',args,config);}
  const data=JSON.parse(response.stdout.replace(/^\uFEFF/,''));
  return data.transportStatus?{ok:false,status:data.transportStatus}:{ok:true,json:async()=>data};
}

const TRANSLATIONS=[
  ['精索静脉曲张','varicocele'], ['男性不育','male infertility'],
  ['非梗阻性无精子症','nonobstructive azoospermia'],['无精子症','azoospermia'],
  ['显微取精','micro-TESE'],['睾丸扭转','testicular torsion'],['睾酮','testosterone'],
  ['勃起功能障碍','erectile dysfunction'],['早泄','premature ejaculation'],
  ['辅助生殖','assisted reproduction'],['人工授精','intrauterine insemination'],
  ['阴茎假体','penile prosthesis'],['输精管吻合','vasovasostomy'],
  ['精液分析','semen analysis'],['精液','semen'],['精子','sperm'],
  ['免疫印迹','western blot'],['蛋白印迹','western blot'],['免疫荧光','immunofluorescence'],
  ['细胞培养','cell culture'],['流式','flow cytometry'],['阴性对照','negative control'],
  ['阳性对照','positive control'],['内参','reference gene'],['复发','recurrence'],
  ['手术','surgery'],['并发症','complications'],['指南','guideline'],['系统评价','systematic review'],
  ['综述','review'],['抗体','antibody'],['特异性','specificity'],['肥胖','obesity']
].sort((a,b)=>b[0].length-a[0].length);

export function toEnglishQuery(query) {
  let remainder=String(query || '').trim();
  if(!/[\u4e00-\u9fff]/.test(remainder))return remainder.replace(/\bwb\b/gi,'"western blot"');
  const groups=[];
  for(const [zh,en] of TRANSLATIONS)if(remainder.includes(zh)){
    groups.push(en.includes(' ')?'"'+en+'"':en);remainder=remainder.split(zh).join(' ');
  }
  const english=remainder.match(/[A-Za-z][A-Za-z0-9-]*/g)||[];
  for(const word of english){
    const group=SYNONYMS.find(g=>g.includes(word.toLowerCase()));
    const term=word.toLowerCase()==='wb'?'"western blot"':(group?.[0]==='qpcr'?'qPCR':word);
    groups.push(term);
  }
  // 去掉复合主题已经包含的泛词，避免“精液分析”同时强制要求孤立 semen。
  return [...new Set(groups)].slice(0,8).join(' AND ') || String(query || '').trim();
}
export function plainText(html) {
  return String(html || '')
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/<\/?[a-z][a-z0-9:-]*(?:\s+[a-z_:][a-z0-9_.:-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s<>]+))?)*\s*\/?>/gi, ' ')
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (entity, code) => {
      const point = /^x/i.test(code) ? parseInt(code.slice(1), 16) : Number(code);
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : entity;
    }).replace(/&nbsp;/g,' ')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
}
export async function searchLiterature(query, {max=5,sort='relevance',since,fetchImpl=publicLiteratureFetch}={}) {
  const translated=toEnglishQuery(query);
  if(!translated)throw new Error('请输入检索主题');
  const year=Number(since),currentYear=new Date().getUTCFullYear();
  const dateFiltered=Number.isInteger(year)&&year>=1900&&year<=currentYear
    ?`(${translated}) AND FIRST_PDATE:[${year}-01-01 TO ${currentYear}-12-31]`:translated;
  const filtered=dateFiltered+(sort==='recent'?' sort_date:y':'');
  const url=new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  url.search=new URLSearchParams({query:filtered,format:'json',pageSize:String(Math.max(1,Math.min(10,Number(max)||5))),resultType:'core'}).toString();
  let resp;
  try{resp=await fetchImpl(url.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});}
  catch(error){throw new Error(error.name==='TimeoutError'||error.killed?'文献服务响应超时，请稍后重试':'无法连接 Europe PMC，请检查网络',{cause:error});}
  if(!resp.ok)throw new Error(`Europe PMC HTTP ${resp.status}（公开文献服务暂不可用，请稍后重试）`);
  const data=await resp.json();
  const items=(data.resultList?.result || []).filter(r=>r.title).map(r=>({
    title:plainText(r.title),journal:r.journalTitle || r.journalInfo?.journal?.title || '',
    year:r.pubYear || '',authors:r.authorString || '',doi:r.doi || '',
    pmid:r.pmid || (r.source==='MED'?r.id:'') || '',pmcid:r.pmcid || '',
    abstract:plainText(r.abstractText).slice(0,16000),
    publicationTypes:r.pubTypeList?.pubType || [],openAccess:r.isOpenAccess==='Y',
    url:r.doi?'https://doi.org/'+r.doi:(r.pmcid?'https://pmc.ncbi.nlm.nih.gov/articles/'+r.pmcid+'/':'https://europepmc.org/article/'+encodeURIComponent(r.source || 'MED')+'/'+encodeURIComponent(r.id)),
    source:'Europe PMC'
  }));
  return {query:String(query),translatedQuery:translated,executedQuery:filtered,sort,
    hitCount:data.hitCount || 0,items,retrievedAt:new Date().toISOString()};
}
