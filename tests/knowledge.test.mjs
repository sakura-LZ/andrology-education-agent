import test from 'node:test';
import assert from 'node:assert/strict';
import { loadKnowledge, searchKnowledge, chunkDocument, citationLinks } from '../server/knowledge.mjs';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
test('正文已有DOI和PMID转为可点击来源，保留未独立核验说明',()=>{
 const links=citationLinks('来源 DOI: 10.1111/andr.12511；PMID：34910301。');
 assert.ok(links.some(x=>x.url==='https://doi.org/10.1111/andr.12511'));
 assert.ok(links.some(x=>x.url==='https://pubmed.ncbi.nlm.nih.gov/34910301/'));
 assert.ok(links.every(x=>x.status.includes('未独立核验')));
});
test('后期专题正文与基础实验出现在统一目录，旧待核实条目不能成为回答依据', async()=>{
 const docs=await loadKnowledge(root);
 assert.ok(docs.some(d=>d.id==='topic-vc' && d.content.includes('精索静脉曲张')));
 assert.ok(docs.some(d=>d.category==='基础实验操作' && /Western blot/i.test(d.content)));
 const historical=docs.filter(d=>d.kind==='证据条目');
 assert.ok(historical.length>=8);
 assert.ok(historical.every(d=>d.retrievable===false));
 const hits=searchKnowledge(docs,'睾丸动脉损伤',{k:10});
 assert.ok(hits.every(h=>!historical.some(d=>d.id===h.id)));
 const wb=searchKnowledge(docs,'WB 阴性对照',{k:3});
 assert.ok(wb.length>0);
 assert.ok(wb.every(h=>/western blot|蛋白免疫印迹|WB/i.test(h.heading+' '+h.text)));
});
test('小节不能被并到前一节，片段保留所属标题',()=>{
 const d={id:'a',title:'实验',content:'# 实验\n## 阳性对照\n使用已知表达目标蛋白的样本。\n## 阴性对照\n使用敲除细胞检验抗体特异性。',retrievable:true};
 const cs=chunkDocument(d);
 assert.ok(cs.some(c=>c.heading.includes('阴性对照')&&c.text.includes('敲除')));
 assert.ok(cs.every(c=>!(c.text.includes('已知表达')&&c.text.includes('敲除'))));
});
test('WB 与中文免疫印迹可找回实验资料，无关问题不返回碰巧含通用词的正文',()=>{
 const docs=[{id:'wb',title:'Western blot 蛋白免疫印迹',content:'## 阴性对照\nWestern blot 检测目标蛋白时使用阴性对照评估抗体特异性。',retrievable:true},{id:'other',title:'指南',content:'## 说明\n这是一般资料说明。',retrievable:true}];
 assert.equal(searchKnowledge(docs,'WB 阴性对照')[0].id,'wb');
 assert.equal(searchKnowledge(docs,'免疫印迹')[0].id,'wb');
 assert.deepEqual(searchKnowledge(docs,'今天洛杉矶天气怎么样'),[]);
 assert.deepEqual(searchKnowledge(docs,'这个呢'),[]);
});
