'use client';

import {useState} from 'react';
import {canPageSourceWindow} from '@/lib/exterior-job-followup';
import {
 loadExteriorJobCommentPage,type TaskNote,
} from '@/app/workspace/exterior-followup-actions';

type Props={
 org:string;bookingId:string;leadId:string;taskId:string;
 initialNotes:TaskNote[];
};
type History={notes:TaskNote[];total:number|null;window:number};
const moment=(value:string)=>{
 const day=new Date(value);
 return Number.isFinite(day.getTime())?day.toLocaleString('en-US',{
  month:'short',day:'numeric',hour:'numeric',minute:'2-digit',
 }):'Time unavailable';
};

/** Historical comments are fetched only after explicit operator intent.
 * This is a read-only, per-task RLS query; existing comments remain visible
 * even when the optional history request cannot complete. */
export function ExteriorTaskCommentHistory({
 org,bookingId,leadId,taskId,initialNotes,
}:Props){
 const [history,setHistory]=useState<History|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const load=async()=>{
  if(loading||(history&&!canPageSourceWindow(history.window,history.total,50)))return;
  const offset=history?.window??0;
  setLoading(true);setError('');
  try{
   const response=await loadExteriorJobCommentPage(
    org,bookingId,leadId,taskId,offset,
   );
   if(!response.ok)throw Error(response.reason);
   if(response.taskId!==taskId||response.offset!==offset||
      response.scanned<0||response.scanned>50||
      (offset>0&&response.scanned===0)||
      (history&&history.total!==response.total))
    throw Error('Company comment history changed; reopen this task before continuing.');
   const ids=new Set(history?.notes.map(n=>n.id)??[]);
   if(response.notes.some(n=>ids.has(n.id)))
    throw Error('Comment history overlapped a previous page. Reload to avoid duplicates.');
   const next=offset+response.scanned;
   setHistory({
    notes:[...(history?.notes??[]),...response.notes],
    window:next,total:response.total,
   });
  }catch(e){setError(e instanceof Error?e.message:'Historical comments could not be loaded.');}
  finally{setLoading(false);}
 };
 const notes=history?.notes??initialNotes;
 const complete=!!history&&history.total!==null&&history.window===history.total;
 return <div className="ecjob-history" aria-label="Authenticated task comment history">
  {notes.map(n=><p key={n.id}><b>{n.author}</b><time>{moment(n.createdAt)}</time><span>{n.body}</span></p>)}
  {error&&<p role="alert">{error}</p>}
  {!history&&<button type="button" onClick={()=>void load()} disabled={loading}>
   {loading?'Loading…':'Open authenticated comment history'}
  </button>}
  {history&&!complete&&<button type="button"
   onClick={()=>void load()} disabled={loading||!canPageSourceWindow(history.window,history.total,50)}>
   {loading?'Loading older comments…':!canPageSourceWindow(history.window,history.total,50)?
    'Further paging unavailable at this source boundary':'Load older comments'}
  </button>}
  {history&&<small>{history.window} comment source rows loaded
   {history.total===null?' · total unavailable':' of '+history.total}.
   {complete?' Full current source window.':' History is partial.'}
  </small>}
 </div>;
}
