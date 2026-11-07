import test from 'node:test';
import assert from 'node:assert/strict';
import { sheetSparkCounts, sparkDeltas } from '../src/lib/spark-feed';
test('Spark counts source rows by named headers and sender/channel', () => {
 const rows = [['Channel','Business Name','Sender'],['Instagram','Wash A','Jacob'],['Email','Wash B','Oscar'],['Email','','Oscar']];
 const counts = sheetSparkCounts(rows,'2026-11-07');
 assert.equal(counts.find(r=>r.sender==='Jacob'&&r.channel==='dm')?.row_count,1);
 assert.equal(counts.find(r=>r.sender==='Oscar'&&r.channel==='email')?.row_count,1);
 assert.throws(()=>sheetSparkCounts([['Other']], '2026-11-07'));
});
test('Spark does not mislabel first snapshot as new research',()=>{
 const current = sheetSparkCounts([['Sender','Channel','Business Name'],['Oscar','Email','A']],'2026-11-07');
 assert.equal(sparkDeltas(current,new Date('2026-11-07T17:00:00Z'))[2].newToday,null);
});
