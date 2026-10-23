import test from 'node:test';
import assert from 'node:assert/strict';
import type { FinanceEntry } from '../src/lib/dashboard';
import { compareStatementRow, parseStatementCents, parseStatementCsv, parseStatementDate, statementRollForward } from '../src/lib/atlas-statement-review';
const ledger=(id:string,amount:number,date:string,opts:Partial<FinanceEntry>={}):FinanceEntry=>({
  id,amount,occurred_on:date,venture:'exterior',kind:'cost',category:'Fuel',note:'',...opts,
});
test('reads quoted CSV, multiline descriptions, BOM and USD debit-credit convention',()=>{
  const csv='\uFEFFDate,Description,Debit,Credit,Currency\r\n10/23/2026,"Supplier, LLC\nPremium service",12.35,,USD\r\n2026-10-24,Customer refund,,30.01,USD\r\n';
  const result=parseStatementCsv(csv);
  assert.equal(result.status,'accepted');
  assert.deepEqual(result.rows.map(x=>[x.date,x.signedCents]),[['2026-10-23',-1235],['2026-10-24',3001]]);
  assert.equal(result.rows[0].description,'Supplier, LLC\nPremium service');
  assert.equal(result.totalCents,1766);
  assert.deepEqual(result.dateRange,{start:'2026-10-23',end:'2026-10-24'});
});
test('exact decimal parsing is integer cents only, no exponents or invalid comma groups',()=>{
  assert.equal(parseStatementCents('($1,234.50)'),-123450);
  assert.equal(parseStatementCents('- $2.00'),-200);
  assert.equal(parseStatementCents('+0.01'),1);
  assert.equal(parseStatementCents('0'),0);
  assert.equal(parseStatementCents('1.2'),120);
  assert.equal(parseStatementCents('1e3'),null);
  assert.equal(parseStatementCents('1.009'),null);
  assert.equal(parseStatementCents('12,34.00'),null);
  assert.equal(parseStatementCents('Infinity'),null);
  assert.equal(parseStatementCents('(−1)'),null);
});
test('rejects malformed quoted CSV, missing required headers and oversized files',()=>{
  assert.throws(()=>parseStatementCsv('Date,Description,Amount\n2026-10-23,"unterminated,123'),/Unterminated/);
  assert.throws(()=>parseStatementCsv('Date,Description,Amount\n2026-10-23,"ok"x,123'),/Unexpected/);
  assert.throws(()=>parseStatementCsv('Date,Description\n2026-10-23,gas'),/needs Date/);
  assert.throws(()=>parseStatementCsv('Date,Description,Amount\n'+('x'.repeat(1_050_000))),/1 MiB/);
});
test('row errors never silently disappear or generate an approved statement',()=>{
  const csv='Date,Description,Amount,Currency\n2026-10-23,Fuel,20.00,USD\n2026-02-30,Bad,20.00,USD\n2026-10-23,Euro,15.00,EUR\n2026-10-23,Odd,1.001,USD\n2026-10-23,,10,USD';
  const result=parseStatementCsv(csv);
  assert.equal(result.status,'needs-correction');
  assert.equal(result.rows.length,1);
  assert.deepEqual(result.problems.map(x=>x.rowNumber),[3,4,5,6]);
  const balance=statementRollForward(result,'100','120');
  assert.equal(balance.status,'incomplete-source');
  assert.equal(balance.varianceCents,null);
});
test('statement arithmetic can be consistent without being bank-certified',()=>{
  const result=parseStatementCsv('Date,Description,Amount\n2026-10-23,Purchase,-20.00\n2026-10-24,Deposit,51.25');
  assert.deepEqual(result.rows.map(x=>x.signedCents),[-2000,5125]);
  const ok=statementRollForward(result,'100.00','131.25');
  assert.equal(ok.status,'arithmetic-consistent');
  assert.equal(ok.varianceCents,0);
  assert.match(ok.detail,/Not a bank-certified reconciliation/);
  const err=statementRollForward(result,'100.00','141.25');
  assert.equal(err.status,'arithmetic-difference');
  assert.equal(err.varianceCents,1000);
  assert.equal(statementRollForward(result,'','').status,'not-provided');
  assert.equal(statementRollForward(result,'oops','131.25').status,'invalid');
});
test('candidate suggestions are exact magnitude with +/- four days and never classified by sign',()=>{
  const source=parseStatementCsv('Date,Description,Amount\n2026-10-23,Payment,-225.00');
  const rows=[
    ledger('one',225,'2026-10-23',{kind:'revenue'}),
    ledger('two',225,'2026-10-27',{kind:'cost',auto:'Exterior Care job'}),
    ledger('wrong',225.01,'2026-10-23'),
    ledger('late',225,'2026-10-28'),
  ];
  assert.deepEqual(compareStatementRow(source.rows[0],rows).map(x=>x.entryId),['one','two']);
  assert.deepEqual(compareStatementRow(source.rows[0],rows).map(x=>x.source),['manual-entry','derived-source']);
  assert.equal(compareStatementRow(source.rows[0],rows)[0].kind,'revenue');
  assert.equal(rows.length,4);
});
test('statement dates reject ambiguous years and impossible dates',()=>{
  assert.equal(parseStatementDate('10/23/2026'),'2026-10-23');
  assert.equal(parseStatementDate('2026-02-30'),null);
  assert.equal(parseStatementDate('02/29/2024'),'2024-02-29');
  assert.equal(parseStatementDate('02/29/2026'),null);
  assert.equal(parseStatementDate('10/23/26'),null);
  assert.equal(parseStatementDate('23/10/2026'),null);
});
test('no valid rows means arithmetic withheld, and zero transactions do not suggest ledger matches',()=>{
  const s=parseStatementCsv('Date,Description,Amount\n2026-10-23,Zero,0');
  assert.equal(s.status,'accepted');
  assert.deepEqual(compareStatementRow(s.rows[0],[ledger('zero',0,'2026-10-23')]),[]);
  const empty=parseStatementCsv('Date,Description,Amount\n');
  assert.equal(empty.rows.length,0);
  assert.equal(statementRollForward(empty,'100','100').status,'incomplete-source');
});
test('header CSV field count conflicts and mixed debit-credit are rejected by row',()=>{
  const s=parseStatementCsv('Date,Description,Debit,Credit\n2026-10-23,Double,10,10\n2026-10-23,Missing,,\n2026-10-23,Wrong,10');
  assert.equal(s.rows.length,0);
  assert.equal(s.problems.length,3);
});
