import assert from 'node:assert/strict';
import test from 'node:test';
import {
 captureResidentialArchive,verifyResidentialArchive,planResidentialRestore,
 restoreMissingResidentialDrafts,residentialArchiveHash,
 type ResidentialArchive,type ResidentialStorageWriter,
} from '../src/lib/exterior-residential-archive';
import {newExteriorEstimate,type LocalEstimateBook} from '../src/lib/exterior-estimate';
import type {ExtLead} from '../src/lib/exterior';

const org='10000000-0000-4000-8000-000000000001';
const otherOrg='10000000-0000-4000-8000-000000000002';
const stamp='2026-10-25T12:00:00.000Z';
const prefix=(o:string,id:string)=>'oj-exterior-estimate-v1:'+o+':'+id;
const lead=(id:string):ExtLead=>({
 id,name:'Fictional Test Customer',phone:'+10000000000',address:'100 EXAMPLE ST',
 service_requested:'Exterior window cleaning',quote_amount:225,status:'new',
 source:'test',notes:null,job_revenue:null,job_cost:null,
 created_at:stamp,updated_at:stamp,completed_at:null,
});
const estimateRaw=(id:string):string=>{
 const estimate=newExteriorEstimate(lead(id));
 estimate.lines[0].costPerUnit=35.25;
 estimate.lines[0].notes='Private internal cost estimate';
 const book:LocalEstimateBook={schema:1,current:estimate,revisions:[{
  id:'historical-one',savedAt:stamp,estimate:JSON.parse(JSON.stringify(estimate)),
 }]};
 return JSON.stringify(book);
};
class FakeStorage implements ResidentialStorageWriter{
 private records=new Map<string,string>();
 get length(){return this.records.size;}
 key(i:number){return [...this.records.keys()][i]??null;}
 getItem(k:string){return this.records.get(k)??null;}
 setItem(k:string,v:string){this.records.set(k,v);}
 removeItem(k:string){this.records.delete(k);}
}
const file=(a:ResidentialArchive)=>JSON.stringify(a);

test('R51 all-draft backup includes exact company records, revisions and raw corrupt originals',async()=>{
 const storage=new FakeStorage();
 storage.setItem(prefix(org,'lead-one'),estimateRaw('lead-one'));
 storage.setItem(prefix(org,'lead-damaged'),'{invalid-json');
 storage.setItem(prefix(otherOrg,'secret-other-company'),estimateRaw('secret-other-company'));
 storage.setItem('oj-commercial-estimate-v2:'+org,'commercial-private-data');
 const archive=await captureResidentialArchive(org,storage,stamp);
 assert.equal(archive.kind,'oj-residential-estimate-origin-archive');
 assert.equal(archive.entries.length,2);
 assert.deepEqual(archive.entries.map(e=>e.leadId),['lead-damaged','lead-one']);
 assert.equal(archive.entries[0].status,'unreadable');
 assert.equal(archive.entries[0].raw,'{invalid-json');
 assert.equal(archive.entries[1].status,'validated');
 assert.match(archive.entries[1].raw,/Private internal cost estimate/);
 assert.doesNotMatch(file(archive),/secret-other-company|commercial-private-data/);
 assert.deepEqual(await verifyResidentialArchive(file(archive),org),archive);
 assert.equal(storage.length,4,'Backing up must be entirely read-only');
});
test('R51 checksums detect altered draft contents and manifest metadata before restore',async()=>{
 const storage=new FakeStorage();
 storage.setItem(prefix(org,'lead-one'),estimateRaw('lead-one'));
 const archive=await captureResidentialArchive(org,storage,stamp);
 const tampered=structuredClone(archive);
 tampered.entries[0].raw=tampered.entries[0].raw.replace('35.25','9999');
 await assert.rejects(verifyResidentialArchive(file(tampered),org),/checksum/i);
 const changedMetadata=structuredClone(archive);
 changedMetadata.capturedAt='2026-10-25T13:00:00.000Z';
 await assert.rejects(verifyResidentialArchive(file(changedMetadata),org),/manifest checksum/i);
 await assert.rejects(verifyResidentialArchive(file(archive),otherOrg),/different company/i);
 await assert.rejects(verifyResidentialArchive('{garbled',org),/not valid JSON/i);
});
test('R51 refuses duplicate or incorrectly sorted lead entries even with recomputed checksum',async()=>{
 const storage=new FakeStorage();
 storage.setItem(prefix(org,'lead-one'),estimateRaw('lead-one'));
 const original=await captureResidentialArchive(org,storage,stamp);
 const duplicate=structuredClone(original);
 duplicate.entries.push({...duplicate.entries[0]});
 const payload={schema:duplicate.schema,kind:duplicate.kind,organizationId:duplicate.organizationId,
  capturedAt:duplicate.capturedAt,entries:duplicate.entries};
 duplicate.sha256=await residentialArchiveHash(JSON.stringify(payload));
 await assert.rejects(verifyResidentialArchive(file(duplicate),org),/unique and sorted/i);
});
test('R51 imported records only fill missing keys and preserve conflicting browser drafts',async()=>{
 const source=new FakeStorage();
 source.setItem(prefix(org,'a'),estimateRaw('a'));
 source.setItem(prefix(org,'b'),estimateRaw('b'));
 source.setItem(prefix(org,'c'),estimateRaw('c'));
 source.setItem(prefix(org,'damaged'),'{broken');
 const archive=await verifyResidentialArchive(
  file(await captureResidentialArchive(org,source,stamp)),org);
 const destination=new FakeStorage();
 const conflict='IMPORTANT existing newer edited draft; never overwrite';
 destination.setItem(prefix(org,'a'),conflict);
 destination.setItem(prefix(org,'b'),estimateRaw('b'));
 destination.setItem(prefix(otherOrg,'a'),estimateRaw('a'));
 const preview=planResidentialRestore(archive,destination);
 assert.deepEqual(preview,{missing:['c'],identical:['b'],conflicts:['a'],unreadable:['damaged']});
 const result=restoreMissingResidentialDrafts(archive,destination);
 assert.deepEqual(result,{
  imported:1,skippedExisting:2,skippedUnreadable:1,failed:0,failedLeadId:null,
 });
 assert.equal(destination.getItem(prefix(org,'a')),conflict);
 assert.equal(destination.getItem(prefix(org,'b')),estimateRaw('b'));
 assert.equal(destination.getItem(prefix(org,'c')),estimateRaw('c'));
 assert.equal(destination.getItem(prefix(org,'damaged')),null);
 assert.equal(destination.getItem(prefix(otherOrg,'a')),estimateRaw('a'));
 assert.equal(restoreMissingResidentialDrafts(archive,destination).imported,0,'Repeated import is safe');
});
test('R51 valid imports do not overwrite previously corrupt local records',async()=>{
 const source=new FakeStorage();
 source.setItem(prefix(org,'same-lead'),estimateRaw('same-lead'));
 const archive=await verifyResidentialArchive(file(await captureResidentialArchive(org,source,stamp)),org);
 const destination=new FakeStorage();
 destination.setItem(prefix(org,'same-lead'),'{my-corrupt-original-still-matters');
 assert.deepEqual(planResidentialRestore(archive,destination).conflicts,['same-lead']);
 const result=restoreMissingResidentialDrafts(archive,destination);
 assert.equal(result.imported,0);
 assert.equal(destination.getItem(prefix(org,'same-lead')),'{my-corrupt-original-still-matters');
});
test('R51 quota failures stop restoration without removing originals or lying about partial success',async()=>{
 const source=new FakeStorage();
 source.setItem(prefix(org,'a'),estimateRaw('a'));
 source.setItem(prefix(org,'b'),estimateRaw('b'));
 const archive=await verifyResidentialArchive(file(await captureResidentialArchive(org,source,stamp)),org);
 class FullStorage extends FakeStorage{
  override setItem(k:string,v:string){
   if(k===prefix(org,'b'))throw Error('Quota exceeded');
   super.setItem(k,v);
  }
 }
 const destination=new FullStorage();
 destination.setItem(prefix(org,'important'),estimateRaw('important'));
 const result=restoreMissingResidentialDrafts(archive,destination);
 assert.deepEqual(result,{
  imported:1,failed:1,failedLeadId:'b',skippedExisting:0,skippedUnreadable:0,
 });
 assert.equal(destination.getItem(prefix(org,'a')),estimateRaw('a'));
 assert.equal(destination.getItem(prefix(org,'b')),null);
 assert.equal(destination.getItem(prefix(org,'important')),estimateRaw('important'));
});
test('R51 refusing a disappearing browser record prevents incomplete success archives',async()=>{
 const storage=new FakeStorage();
 storage.setItem(prefix(org,'lead-one'),estimateRaw('lead-one'));
 const unstable={
  length:storage.length,
  key:(i:number)=>storage.key(i),
  getItem:(_key:string)=>null,
 };
 await assert.rejects(captureResidentialArchive(org,unstable,stamp),/changed while reading/i);
 assert.equal(storage.length,1);
});
test('R51 empty origin exports a valid exact-org manifest without fake drafts',async()=>{
 const storage=new FakeStorage();
 storage.setItem(prefix(otherOrg,'someone'),estimateRaw('someone'));
 const archive=await captureResidentialArchive(org,storage,stamp);
 assert.equal(archive.entries.length,0);
 const verified=await verifyResidentialArchive(file(archive),org);
 assert.deepEqual(planResidentialRestore(verified,new FakeStorage()),{
  missing:[],identical:[],conflicts:[],unreadable:[],
 });
});
