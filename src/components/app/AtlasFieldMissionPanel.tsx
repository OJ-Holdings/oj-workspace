'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, ClipboardCopy, Download, HardHat, ShieldAlert, Users, Wrench } from 'lucide-react';
import type { Card } from '@/lib/board';
import type { ExtBooking } from '@/lib/exterior';
import type { FleetWorkbook } from '@/lib/fleet-command';
import {
  projectEquipmentEvidence, resolveSourceBooking,
  type CommercialProject,
} from '@/lib/atlas-commercial-portfolio';
import { exactLocalProjectIds } from '@/lib/atlas-task-handoff';
import {
  emptyFieldCrewPlan, fieldCrewCapacity, fieldWorkforceFindings,
  internalFieldMissionPacket, type FieldCrewPlan,
} from '@/lib/atlas-field-mission';

type Props={
  org:string;base:string;project:CommercialProject;isSaved:boolean;
  day:string;plan:FieldCrewPlan;onChange:(next:FieldCrewPlan)=>void;
  fleet:FleetWorkbook|null;bookings:ExtBooking[];cards:Card[];
};
const value=(n:number|null)=>n??'';
const boundedInt=(v:string,max:number):number|null=>{
  if(v.trim()==='')return null;
  const n=Number(v);
  return Number.isFinite(n)&&n>0?Math.min(max,Math.max(1,Math.round(n))):null;
};
const quarter=(v:string):number|null=>{
  if(v.trim()==='')return null;
  const n=Number(v);
  return Number.isFinite(n)&&n>0?Math.min(12,Math.max(.5,Math.round(n*4)/4)):null;
};
const numberLabel=(num:number|null,unit:string)=>num===null?'Not entered':num.toLocaleString('en-US')+' '+unit;

export function AtlasFieldMissionPanel({org,base,project,isSaved,day,plan,onChange,fleet,bookings,cards}:Props){
  const [notice,setNotice]=useState('');
  const report=useMemo(()=>fieldCrewCapacity(project.input,plan),[project.input,plan]);
  const findings=useMemo(()=>fieldWorkforceFindings(project.input,plan),[project.input,plan]);
  const booking=resolveSourceBooking(project.bookingId,bookings);
  const equipment=projectEquipmentEvidence(project,fleet,day);
  const linkedTasks=cards.filter(card=>card.organization_id===org&&card.business==='exterior'&&
    exactLocalProjectIds(card.description).includes(project.id)).slice(0,20);
  const summary=internalFieldMissionPacket({
    organizationId:org,
    project:{...project,fieldCrewPlan:plan},
    booking:booking.booking,
    bookingState:booking.state,
    assets:equipment,
    linkedTasks,
    localToday:day,
  });
  async function copyPack(){
    try{
      await navigator.clipboard.writeText(summary);
      setNotice('Current-editor internal field pack copied. No customer or crew member was contacted; no task or dispatch was created.');
    }catch{setNotice('Clipboard access failed. Download the private text pack instead.');}
  }
  function downloadPack(){
    try{
      const url=URL.createObjectURL(new Blob([summary],{type:'text/plain;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;
      link.download='oj-internal-field-mission-pack.txt';link.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setNotice('Internal field pack downloaded. Treat this as a confidential, potentially stale planning snapshot.');
    }catch{setNotice('Unable to export internal field pack from this browser.');}
  }
  return <section className="atlas-mission-pack" aria-label="Crew planning and internal field mission pack">
    <header className="atlas-mission-pack-head">
      <div><p>ATLAS / FIELD MISSION PLANNER</p><h4>Prepare the operation, not just the quote.</h4>
        <span>Model staffing against entered paid crew-hours, inspect access/equipment assumptions, and generate a non-customer-facing job brief. No dispatch or external action.</span>
      </div>
      <span className="atlas-mission-pack-status">{isSaved?'SAVED PROJECT OPEN':'UNSAVED PROJECT'}</span>
    </header>
    <div className="atlas-mission-pack-body">
      <div className="atlas-mission-crew">
        <div className="atlas-mission-section-label"><Users size={15}/> Crew & production capacity <small>Manual scenario · not staffing evidence</small></div>
        <div className="atlas-mission-fields">
          <label>Planned crew size
            <input type="number" min={1} max={40} step={1} inputMode="numeric" value={value(plan.crewSize)}
              placeholder="Unknown" onChange={e=>onChange({...plan,crewSize:boundedInt(e.target.value,40)})}/>
          </label>
          <label>Productive hours per person/day
            <input type="number" min={.5} max={12} step={.25} inputMode="decimal"
              placeholder="Unknown" value={value(plan.productiveHoursPerPersonDay)}
              onChange={e=>onChange({...plan,productiveHoursPerPersonDay:quarter(e.target.value)})}/>
          </label>
          <label>Planned field days
            <input type="number" min={1} max={45} step={1} inputMode="numeric"
              placeholder="Unknown" value={value(plan.plannedFieldDays)}
              onChange={e=>onChange({...plan,plannedFieldDays:boundedInt(e.target.value,45)})}/>
          </label>
        </div>
        <div className="atlas-mission-metrics">
          <div><small>Entered labor requirement</small><strong>{numberLabel(report.requiredPaidCrewHours,'paid hours')}</strong></div>
          <div><small>Modeled crew capacity</small><strong>{numberLabel(report.plannedPaidCrewHourCapacity,'paid hours')}</strong></div>
          <div><small>Minimum modeled days</small><strong>{numberLabel(report.estimatedMinimumFieldDays,'days')}</strong></div>
          <div><small>Capacity surplus / shortfall</small><strong data-status={report.state}>{numberLabel(report.capacityGapHours,'paid hours')}</strong></div>
        </div>
        {report.state==='assumptions-fit'&&<p className="atlas-mission-model-note">Entered capacity is sufficient on paper; actual labor availability, elapsed hours, weather, breaks and site access have not been verified.</p>}
        {report.state==='shortfall'&&<p className="atlas-mission-shortfall"><AlertTriangle size={15}/> Crew-hour shortfall under your entries. Revise field days, crew or the original site production estimate before relying on the scenario.</p>}
        <label className="atlas-mission-private-note">Private staging notes (not included in the copied field pack)
          <textarea value={plan.stagingNote} rows={3} maxLength={1800}
            placeholder="Internal prep notes; do not store passwords, customer contact details or access codes."
            onChange={e=>onChange({...plan,stagingNote:e.target.value})}/>
        </label>
      </div>
      <div className="atlas-mission-evidence">
        <div className="atlas-mission-section-label"><ShieldAlert size={15}/> Verification queue <small>{findings.filter(f=>f.severity==='attention').length} modeled attention flags</small></div>
        <div className="atlas-mission-source">
          <strong>{booking.state==='loaded-active'?'Matching Exterior booking loaded':'Booking not verified for field execution'}</strong>
          <small>{booking.label}. Exact source only; customer consent, booking scope and crew availability remain unverified.</small>
        </div>
        {equipment.length>0&&<div className="atlas-mission-source">
          <strong><Wrench size={13}/> {equipment.length} candidate equipment item(s)</strong>
          <small>{equipment.filter(a=>a.state==='recorded-ready').length} manually marked ready; {equipment.filter(a=>a.state!=='recorded-ready').length} require status attention/verification. No physical inspection is implied.</small>
        </div>}
        {findings.map(f=><p className="atlas-mission-finding" key={f.id} data-severity={f.severity}>
          <b>{f.severity}</b><span>{f.text}</span>
        </p>)}
        <p className="atlas-mission-caution">Independent site/safety assessment, actual crew confirmation, insurance, customer permission, rental booking and weather review remain mandatory before any job.</p>
        <div className="atlas-mission-links">
          <Link href={base+'/tools/fleet'}>Fleet Command <ArrowUpRight size={13}/></Link>
          <Link href={base+'/tasks'}>Shared task board <ArrowUpRight size={13}/></Link>
        </div>
      </div>
    </div>
    <footer className="atlas-mission-pack-footer">
      <div><HardHat size={17}/><span><strong>Current editor snapshot.</strong> Save the selected project to retain crew assumptions in this browser. Export excludes dedicated address, private-note and customer contact fields. Project/building names are included and may themselves contain sensitive details—review before sharing.</span></div>
      <button type="button" className="secondary" onClick={()=>void copyPack()}><ClipboardCopy size={15}/> Copy internal pack</button>
      <button type="button" className="secondary" onClick={downloadPack}><Download size={15}/> Download pack</button>
    </footer>
    {notice&&<p className="atlas-mission-notice" role="status">{notice}</p>}
  </section>;
}
