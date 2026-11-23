import test from 'node:test';
import assert from 'node:assert/strict';
import { toEnglishQuery, searchLiterature, plainText } from '../server/literature.mjs';

test('摘要去标签保留比较符与统计结果，实体解码不吞正文',()=>{
 assert.equal(plainText('P-value < 0.05. Results increased > 20%. Conclusion: test.'),'P-value < 0.05. Results increased > 20%. Conclusion: test.');
 assert.equal(plainText('<p><b>Results</b>: P &lt; 0.05, n &#61; 12; x &#x2264; 3.</p>'),'Results : P < 0.05, n = 12; x ≤ 3.');
 assert.equal(plainText('x<0.05 and y>2; <italic>P</italic> < 0.001'),'x<0.05 and y>2; P < 0.001');
});
test('中文具体术语转英文且保留英文缩写，主题词不被泛词淹没',()=>{
 assert.match(toEnglishQuery('精索静脉曲张复发'),/varicocele/i);
 assert.match(toEnglishQuery('精索静脉曲张复发'),/recurr/i);
 assert.match(toEnglishQuery('WB 阴性对照'),/western blot/i);
 assert.match(toEnglishQuery('qPCR 内参'),/reference gene/i);
 assert.match(toEnglishQuery('micro-TESE Klinefelter'),/Klinefelter/i);
 assert.equal(toEnglishQuery('(varicocele OR infertility) AND "systematic review"'),'(varicocele OR infertility) AND "systematic review"');
});
test('真实返回结构中保留摘要、PMID、来源链接和有效过滤参数',async()=>{
 let requested;
 const result=await searchLiterature('varicocele',{max:3,sort:'recent',since:2024,fetchImpl:async url=>{ requested=new URL(url);return {ok:true,json:async()=>({hitCount:1,resultList:{result:[{id:'123',source:'MED',title:'A study',pubYear:'2025',abstractText:'<p>A <b>real</b> abstract.</p>',authorString:'A, B',doi:'10.1/example',journalInfo:{journal:{title:'Andrology'}},isOpenAccess:'Y'}]}})};}});
 assert.equal(result.items[0].abstract,'A real abstract.');
 assert.equal(result.items[0].pmid,'123');
 assert.equal(result.items[0].journal,'Andrology');
 assert.match(requested.searchParams.get('query'),/FIRST_PDATE/);
 assert.match(requested.searchParams.get('query'),/sort_date:y/);
});
test('外部服务失败时抛出可辨识错误',async()=>{
 await assert.rejects(searchLiterature('varicocele',{fetchImpl:async()=>({ok:false,status:503})}),/503/);
});
