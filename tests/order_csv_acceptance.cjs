'use strict';
/**
 * The first paid order may be accepted only after the product passes
 * conservative CSV safety checks. No customer's private data is used.
 */
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const input=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=input.match(/<script>\s*([\s\S]*?)<\/script>/);
assert.ok(script,'HTML must include an inline offline script');
const cut=script[1].indexOf('const ui=');
assert.ok(cut>0,'CSV processing should remain independent of browser UI');
const context=vm.createContext({});
vm.runInContext(script[1].slice(0,cut),context);
let checked=0;
function check(label,fn){fn();checked++; console.log('PASS',label);}
const a=s=>context.analyzeCSV(s);
check('sample duplicate is only flagged (no deletion)',()=>{
 const x=a('주문번호,채널,결제금액\nA1,가게,10000\nA2,가게,20000\nA2,가게,20000\n');
 assert.equal(x.unique,2);assert.equal(x.duplicateCount,1);assert.equal(x.rows.length,3);assert.equal(x.amount,30000);
 assert.equal(x.rows[2].duplicate,true);
});
check('BOM, comma, linebreak and quote in quoted fields',()=>{
 const x=a('\ufeff주문번호,상품,결제금액\r\nA1,"도구, 소형", "1250"\r\nA2,"행1\n행2 ""정상""",2200\n'.replace('", "1250"','","1250"'));
 assert.equal(x.rows[0].values[1],'도구, 소형');
 assert.equal(x.rows[1].values[1],'행1\n행2 "정상"');
 assert.equal(x.amount,3450);
});
check('empty order number is reported, never considered unique',()=>{
 const x=a('주문번호,금액\n,500\nO1,300\n');
 assert.equal(x.missing,1);assert.equal(x.unique,1);assert.equal(x.amount,300);
});
check('invalid money is flagged, not silently treated as income',()=>{
 const x=a('주문번호,금액\nA1,not-money\nA2,650\n');
 assert.equal(x.invalidAmount,1); assert.equal(x.amount,650);
});
check('cancelled amount is explicitly labelled as not accounting revenue',()=>{
 const x=a('주문번호,금액,상태\nA1,20000,취소\nA2,30000,완료');
 assert.equal(x.amount,50000);
 assert.ok(input.includes('취소 포함 가능')&&input.includes('실제 매출/정산 아님'));
});
check('required header rejected',()=>assert.throws(()=>a('상품,금액\nA1,200'),/주문번호/));
check('unterminated quote rejected',()=>assert.throws(()=>a('주문번호,상품\nA1,"미완료'),/따옴표/));
check('formula injection guarded across CSV export',()=>{
 const csv=context.cleanCsv([['=1+1','+cmd','@sum','-cmd','-400',' \t=2+2','안전한 이름']]);
 assert.ok(csv.includes("'=1+1"));assert.ok(csv.includes("'+cmd"));
 assert.ok(csv.includes("'@sum"));assert.ok(csv.includes("'-cmd"));
 assert.ok(csv.includes(',-400,'));assert.ok(csv.includes("' \t=2+2"));
});
check('huge currency / Infinity is rejected',()=>{
 const x=a('주문번호,금액\nA1,'+'9'.repeat(400)+'\nA2,100');
 assert.equal(x.invalidAmount,1);
 assert.equal(x.amount,100);
 assert.ok(Number.isFinite(x.amount)&&Number.isSafeInteger(x.amount));
});
check('unexpected extra column cannot be silently discarded',()=>{
 assert.throws(()=>a('주문번호,금액\nA1,100,LOST'),/열|컬럼|칸/);
});
check('duplicate header cannot silently use wrong order ID',()=>{
 assert.throws(()=>a('주문번호,주문번호,금액\nA1,A2,100'),/중복|열/);
});
check('offline safe: no external upload and 3 MB UI limit',()=>{
 assert.ok(!script[1].includes('fetch('));
 assert.ok(!script[1].includes('XMLHttpRequest'));
 assert.ok(!script[1].includes('sendBeacon('));
 assert.ok(input.includes("f.size>3_000_000"));
 assert.ok(input.includes('검토 상태'));
});
console.log('ACCEPTANCE_GATE_PASSED '+checked+'/12');
