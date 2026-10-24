'use client';

import {useState} from 'react';
import {CheckCircle2,ClipboardCopy,RefreshCw,ShieldAlert} from 'lucide-react';
import {
 assessDeviceReleaseResponse,sanitizedDeviceReleaseReceipt,
 type DeviceReleaseEvidence,
} from '@/lib/exterior-device-release-evidence';

type Props={mode:'live'|'preview'};
/** A founder must initiate this read-only same-origin request on EACH device.
 * It neither signs off a user nor reads customer/project/financial data.
 */
export function ExteriorDeviceReleaseProof({mode}:Props){
 const [checking,setChecking]=useState(false);
 const [evidence,setEvidence]=useState<DeviceReleaseEvidence|null>(null);
 const [checkedUtc,setCheckedUtc]=useState('');
 const [copyStatus,setCopyStatus]=useState('');
 async function check(){
  if(checking||mode!=='live')return;
  setChecking(true);setEvidence(null);setCopyStatus('');
  try{
   const response=await fetch('/api/deploy-health',{
    method:'GET',credentials:'same-origin',cache:'no-store',
    headers:{'Accept':'application/json'},
   });
   if(!response.ok)throw Error('Release source unavailable');
   const value:unknown=await response.json();
   setEvidence(assessDeviceReleaseResponse(value));
  }catch{
   setEvidence(assessDeviceReleaseResponse(null));
  }finally{
   setCheckedUtc(new Date().toISOString());
   setChecking(false);
  }
 }
 async function copyReceipt(){
  if(!evidence||mode!=='live')return;
  try{
   await navigator.clipboard.writeText(sanitizedDeviceReleaseReceipt(evidence,checkedUtc));
   setCopyStatus('Sanitized manual check copied. It is NOT independent acceptance proof.');
  }catch{
   setCopyStatus('Could not copy the receipt. Check this device’s clipboard permission.');
  }
 }
 return <details className="ecjourney-release" aria-label="Read-only device release verification">
  <summary>Device and deployment check <span>Optional P2 acceptance evidence</span></summary>
  <div>
   <p>Run this on both founders’ phones to see which app commit each device is being served. Compare with GitHub main and the trusted host separately. Matching versions do <strong>not</strong> certify shared data, security, database backup, or accepted field work.</p>
   {mode==='preview'?<p className="ecjourney-coverage">Preview: no real app release check or two-founder acceptance is performed.</p>:<>
    <div className="ecjourney-release-actions">
     <button type="button" onClick={()=>void check()} disabled={checking}>
      <RefreshCw size={15}/>{checking?'Checking this server…':'Check my server version'}
     </button>
     {evidence&&<button type="button" onClick={()=>void copyReceipt()}>
      <ClipboardCopy size={15}/> Copy sanitized check
     </button>}
    </div>
    {evidence&&<div className="ecjourney-release-result" role="status">
     {evidence.state==='reported'?<CheckCircle2 size={17}/>:<ShieldAlert size={17}/>}
     <div><strong>{evidence.label}</strong>
      <p>{evidence.detail}</p>
      {evidence.sha&&<code>{evidence.sha}</code>}
     </div>
    </div>}
    {copyStatus&&<p className="ecjourney-release-note" role="status">{copyStatus}</p>}
   </>}
   <p className="ecjourney-release-note">This tool only reads an existing release endpoint and generates local text. It never stores a validation approval, reads booking contents or posts anything to GitHub or company tasks.</p>
  </div>
 </details>;
}
