const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const js = html.match(/<script>\s*([\s\S]*?)<\/script>/);
assert.ok(js, 'demo script must exist');
const start = js[1].indexOf('const ui=');
assert.ok(start > 100, 'separable processing functions must exist');
const context = vm.createContext({});
vm.runInContext(js[1].slice(0, start), context);
const input = [
 '주문번호,채널,상품,결제금액,상태',
 'A-1,네이버,선반,10000,완료',
 'A-2,쿠팡,조명,20000,취소',
 'A-2,쿠팡,조명,20000,취소',
 'A-3,네이버,문구,15000,완료',
].join('\n');
const result=context.analyzeCSV(input);
assert.equal(result.unique,3);
assert.equal(result.duplicateCount,1);
assert.equal(result.rows.length,4);
assert.equal(result.amount,45000); // intentionally includes cancelled 20000
assert.throws(()=>context.analyzeCSV('채널,금액\n네이버,10000'),/주문번호/);
const exportCsv=context.cleanCsv([['=1+1','-400','@HYPERLINK("x")']]);
assert.ok(exportCsv.includes("'=1+1"));
assert.ok(exportCsv.includes(",-400,"));
assert.ok(exportCsv.includes("'@HYPERLINK"));
assert.ok(html.includes('href="#demo"'));
assert.ok(html.includes('consultation.yml'));
assert.ok(html.includes('해당 글은 공개되므로'));
assert.ok(!html.includes('mailto:'));
assert.ok(!html.includes('XMLHttpRequest'));
assert.ok(!html.includes('sendBeacon('));
assert.ok(!html.includes('fetch('));
assert.ok(html.includes('시범 제안가'));
console.log('HAN_NUN_DEMO_TEST_OK; orders='+result.rows.length+' duplicates='+result.duplicateCount);
