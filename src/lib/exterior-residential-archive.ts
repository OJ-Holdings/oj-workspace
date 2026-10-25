import {parseLocalEstimateBook} from './exterior-estimate';

/**
 * Residential draft vault (R51-A): private, same-origin browser rescue only.
 *
 * This archive is NOT a synced quote, submitted proposal, accepted contract,
 * customer approval, paid invoice, remote backup, or a cloud restore.
 * No network or database calls. Private unit costs and notes are included.
 */
export const residentialArchiveMaxChars=32_000_000;
const maxIndividualChars=2_000_000;
const maxEntries=5000;
const keyPrefix=(org:string)=>'oj-exterior-estimate-v1:'+org+':';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ResidentialStorageReader={
 readonly length:number;
 key(index:number):string|null;
 getItem(key:string):string|null;
};
export type ResidentialStorageWriter=ResidentialStorageReader&{
 setItem(key:string,value:string):void;
};
export type ResidentialArchiveEntry={
 leadId:string;
 raw:string;
 sha256:string;
 status:'validated'|'unreadable';
};
type ResidentialArchivePayload={
 schema:1;
 kind:'oj-residential-estimate-origin-archive';
 organizationId:string;
 capturedAt:string;
 entries:ResidentialArchiveEntry[];
};
export type ResidentialArchive=ResidentialArchivePayload&{sha256:string};
export type ResidentialArchivePlan={
 missing:string[];
 identical:string[];
 conflicts:string[];
 unreadable:string[];
};
export type ResidentialRestoreResult={
 imported:number;
 skippedExisting:number;
 skippedUnreadable:number;
 failed:number;
 failedLeadId:string|null;
};

const validOrg=(org:string)=>{
 if(!uuid.test(org))throw Error('Residential archive requires an exact company UUID.');
};
const isSafeLead=(leadId:string)=>leadId.length>0&&leadId.length<=128&&
 leadId===leadId.trim()&&!/[\x00-\x1f\x7f]/.test(leadId);
const validTime=(s:string)=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export async function residentialArchiveHash(data:string):Promise<string>{
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data));
 return hex(new Uint8Array(digest));
}
const validated=(leadId:string,raw:string):boolean=>{
 try{parseLocalEstimateBook(raw,leadId);return true;}catch{return false;}
};
const fail=(reason:string):never=>{throw Error(reason);};

function reviewItems(
 entries:ResidentialArchiveEntry[],org:string,
):void{
 validOrg(org);
 if(!Array.isArray(entries)||entries.length>maxEntries)
  fail('Residential archive contains too many records.');
 let size=0;
 const ids=new Set<string>();
 let previous='';
 for(const entry of entries){
  if(!entry||typeof entry.leadId!=='string'||!isSafeLead(entry.leadId)||
   typeof entry.raw!=='string'||entry.raw.length>maxIndividualChars||
   typeof entry.sha256!=='string'||!/^[a-f0-9]{64}$/.test(entry.sha256)||
   !['validated','unreadable'].includes(entry.status))
   fail('Residential archive contains an invalid or oversized entry.');
  if(ids.has(entry.leadId)||previous>=entry.leadId)
   fail('Residential archive lead IDs must be unique and sorted.');
  ids.add(entry.leadId);previous=entry.leadId;
  size+=entry.raw.length;
  if(size>residentialArchiveMaxChars)
   fail('Residential archive exceeds its safe size limit.');
 }
}
/**
 * Gather ALL exact-org original estimate keys. A corrupt original is included
 * as raw bytes with "unreadable" status, NOT silently discarded or repaired.
 *
 * No mutations. Refuse partial archives on read/size failures rather than
 * claiming a misleading "success" backup.
 */
export async function captureResidentialArchive(
 org:string,storage:ResidentialStorageReader,capturedAt:string,
):Promise<ResidentialArchive>{
 validOrg(org);
 if(!validTime(capturedAt))fail('Residential archive capture time is invalid.');
 const prefix=keyPrefix(org);
 const originals:Array<{leadId:string;raw:string}>=[];
 let size=0;
 // Snapshot all storage values synchronously BEFORE any async SHA work.
 // Otherwise another tab may change indexed browser keys between awaits.
 const keyCount=storage.length;
 for(let i=0;i<keyCount;i++){
  const k=storage.key(i);
  if(k===null)fail('Browser storage changed while building the archive; retry.');
  if(!k.startsWith(prefix))continue;
  const leadId=k.slice(prefix.length);
  if(!isSafeLead(leadId))fail('An unusual estimate key needs manual recovery before archiving.');
  const raw=storage.getItem(k);
  if(raw===null)fail('Browser storage changed while reading an estimate; retry.');
  size+=raw.length;
  if(raw.length>maxIndividualChars||size>residentialArchiveMaxChars||
   originals.length>=maxEntries)fail('Residential drafts exceed the single-file archive size limit; do not delete the originals.');
  originals.push({leadId,raw});
 }
 originals.sort((a,b)=>a.leadId<b.leadId?-1:a.leadId>b.leadId?1:0);
 const entries:ResidentialArchiveEntry[]=await Promise.all(originals.map(async({leadId,raw})=>({
  leadId,raw,sha256:await residentialArchiveHash(raw),
  status:validated(leadId,raw)?'validated' as const:'unreadable' as const,
 })));
 reviewItems(entries,org);
 const payload:ResidentialArchivePayload={
  schema:1,kind:'oj-residential-estimate-origin-archive',
  organizationId:org,capturedAt,entries,
 };
 return {...payload,sha256:await residentialArchiveHash(JSON.stringify(payload))};
}
/**
 * Refuses malicious/tampered, wrong-company, duplicate and excessively large
 * files BEFORE any option to restore missing local drafts is provided.
 */
export async function verifyResidentialArchive(
 rawFile:string,expectedOrg:string,
):Promise<ResidentialArchive>{
 validOrg(expectedOrg);
 if(rawFile.length>residentialArchiveMaxChars*2)fail('Residential archive file is too large.');
 let parsed:unknown;
 try{parsed=JSON.parse(rawFile);}catch{fail('The residential archive file is not valid JSON.');}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))
  fail('Unrecognized residential archive file.');
 const a=parsed as Partial<ResidentialArchive>;
 if(a.schema!==1||a.kind!=='oj-residential-estimate-origin-archive'||
  a.organizationId!==expectedOrg||
  typeof a.capturedAt!=='string'||!validTime(a.capturedAt)||
  typeof a.sha256!=='string'||!/^[a-f0-9]{64}$/.test(a.sha256)||
  !Array.isArray(a.entries))
  fail('Archive is for a different company or has invalid metadata.');
 reviewItems(a.entries,expectedOrg);
 for(const entry of a.entries){
  if(await residentialArchiveHash(entry.raw)!==entry.sha256)
   fail('An archived residential draft failed its checksum.');
  if((validated(entry.leadId,entry.raw)?'validated':'unreadable')!==entry.status)
   fail('An archived residential draft has inconsistent validation metadata.');
 }
 const payload:ResidentialArchivePayload={
  schema:1,kind:'oj-residential-estimate-origin-archive',
  organizationId:expectedOrg,capturedAt:a.capturedAt,entries:a.entries,
 };
 if(await residentialArchiveHash(JSON.stringify(payload))!==a.sha256)
  fail('Residential archive manifest checksum failed.');
 return {...payload,sha256:a.sha256};
}
export function planResidentialRestore(
 archive:ResidentialArchive,storage:ResidentialStorageReader,
):ResidentialArchivePlan{
 const missing:string[]=[],identical:string[]=[],conflicts:string[]=[],unreadable:string[]=[];
 for(const entry of archive.entries){
  if(entry.status==='unreadable'){unreadable.push(entry.leadId);continue;}
  const existing=storage.getItem(keyPrefix(archive.organizationId)+entry.leadId);
  if(existing===null)missing.push(entry.leadId);
  else if(existing===entry.raw)identical.push(entry.leadId);
  else conflicts.push(entry.leadId);
 }
 return {missing,identical,conflicts,unreadable};
}
/**
 * Verified archive only. Caller MUST invoke verifyResidentialArchive first.
 * Writes missing, validated draft keys only and never uses removeItem or
 * overwrites any existing browser entry, even when existing is malformed.
 */
export function restoreMissingResidentialDrafts(
 archive:ResidentialArchive,storage:ResidentialStorageWriter,
):ResidentialRestoreResult{
 const p=planResidentialRestore(archive,storage);
 let imported=0,failed=0,failedLeadId:string|null=null;
 for(const entry of archive.entries){
  if(entry.status!=='validated')continue;
  const k=keyPrefix(archive.organizationId)+entry.leadId;
  if(storage.getItem(k)!==null)continue;
  try{
   storage.setItem(k,entry.raw);
   if(storage.getItem(k)!==entry.raw)throw Error('Browser storage did not confirm the restored value.');
   imported++;
  }catch{
   failed++;failedLeadId=entry.leadId;
   break; // A quota or permission failure should not cause further writes.
  }
 }
 return {
  imported,failed,failedLeadId,
  skippedExisting:p.identical.length+p.conflicts.length,
  skippedUnreadable:p.unreadable.length,
 };
}
