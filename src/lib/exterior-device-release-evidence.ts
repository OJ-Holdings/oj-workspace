/** R44/P2: represent exactly what THIS browser's server reported.
 * This is a same-origin release identifier, not proof of a passing deployment,
 * a verified account, shared data, private backup or two-founder acceptance.
 */
export type DeviceReleaseState='reported'|'unmanaged'|'unavailable'|'invalid';
export type DeviceReleaseEvidence={
 state:DeviceReleaseState;sha:string|null;label:string;detail:string;
};
const sha=/^[0-9a-f]{40}$/i;
const record=(v:unknown):Record<string,unknown>|null=>
 v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
export function assessDeviceReleaseResponse(response:unknown):DeviceReleaseEvidence{
 const data=record(response);
 if(!data||data.status!=='ok')return {
  state:'unavailable',sha:null,label:'Version not verified',
  detail:'The connected app did not return a valid release health response.',
 };
 if(data.release==='unmanaged')return {
  state:'unmanaged',sha:null,label:'Unmanaged release',
  detail:'This running server has no CI-managed Git release identifier; compare with your host before acceptance.',
 };
 if(typeof data.release!=='string'||!sha.test(data.release))return {
  state:'invalid',sha:null,label:'Invalid release identity',
  detail:'The server response does not contain a trusted-format 40-character Git SHA.',
 };
 return {
  state:'reported',sha:data.release.toLowerCase(),label:'Server-reported commit',
  detail:'This is the exact commit reported by the current server, not independent GitHub/main, user-role or data-recovery verification.',
 };
}
/** Copy-safe: no URL, origin, cookies, auth IDs, customer data or unexpected
 * response fields can enter the local founder's manual acceptance receipt.
 */
export function sanitizedDeviceReleaseReceipt(evidence:DeviceReleaseEvidence,checkedUtc:string){
 const utc=Number.isFinite(Date.parse(checkedUtc))?new Date(checkedUtc).toISOString():'unknown';
 return [
  'OJ EXTERIOR / P2 DEVICE RELEASE CHECK (MANUAL, NOT CERTIFIED)',
  'Observed UTC: '+utc,
  'Same-origin server identity: '+evidence.state,
  'Reported full commit: '+(evidence.sha??'UNKNOWN'),
  'GitHub main / public route parity: NOT VERIFIED BY THIS DEVICE CHECK',
  'Signed-in independent second founder: NOT VERIFIED',
  'Shared booking/task/comment round-trip: NOT VERIFIED',
  'Actual production backup / independent restore / Storage bytes: NOT VERIFIED',
  'This text contains no customer, account, session or host credentials.',
 ].join('\n');
}
