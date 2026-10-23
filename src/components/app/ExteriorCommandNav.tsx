'use client';

import Link from 'next/link';
import {useState} from 'react';
import {ArrowUpRight,ChartNoAxesCombined,ChevronDown,Compass,HardHat,LayoutDashboard,UsersRound} from 'lucide-react';

const primary=[
  {id:'command',title:'Command',short:'Command',href:'',icon:LayoutDashboard,paths:['overview']},
  {id:'customers',title:'Customers & Sales',short:'Customers',href:'/leads',icon:UsersRound,paths:['leads','quotes']},
  {id:'operations',title:'Field Operations',short:'Operations',href:'/bookings',icon:HardHat,paths:['bookings','calendar','board']},
  {id:'commercial',title:'Commercial Projects',short:'Commercial',href:'/commercial',icon:Compass,paths:['commercial','projects']},
  {id:'intelligence',title:'Intelligence',short:'Intelligence',href:'/jobs',icon:ChartNoAxesCombined,paths:['jobs','money','metrics','door-knocking']},
] as const;
const other=[
  {title:'Company board',path:'/board'},
  {title:'Operations calendar',path:'/calendar'},
  {title:'Project 360',path:'/projects'},
  {title:'Quote requests',path:'/quotes'},
  {title:'Acquisition history',path:'/door-knocking'},
  {title:'Exterior Finance',path:'/money'},
  {title:'Service metrics',path:'/metrics'},
  {title:'Documents',path:'/documents'},
  {title:'Source activity',path:'/activity'},
  {title:'Upgrade register',path:'/upgrades'},
  {title:'Division settings',path:'/settings'},
];
export function ExteriorCommandNav({base,active}:{base:string;active:string}){
  const [expanded,setExpanded]=useState(false);
  const current=primary.find(item=>(item.paths as readonly string[]).includes(active))??primary[0];
  const path=`${base}/b/exterior`;
  return <div className="excmd-nav" aria-label="Exterior Care application navigation">
    <div className="excmd-nav-identity"><div className="excmd-nav-emblem" aria-hidden="true">OJ<span>EC</span></div>
      <div><span>ATLAS / FIELD SERVICES DIVISION</span><strong>OJ Exterior Care</strong></div></div>
    <nav className="excmd-nav-tabs" aria-label="Exterior Command primary areas">
      {primary.map(item=><Link key={item.id} href={path+item.href} aria-current={current.id===item.id?'page':undefined} className={current.id===item.id?'excmd-nav-tab is-active':'excmd-nav-tab'}>
        <item.icon size={17} aria-hidden="true"/><span>{item.short}</span></Link>)}
    </nav>
    <div className="excmd-nav-more">
      <button type="button" aria-expanded={expanded} aria-controls="excmd-more-routes" onClick={()=>setExpanded(v=>!v)}>
        Full directory <ChevronDown size={15} aria-hidden="true"/></button>
    </div>
    {expanded&&<div className="excmd-nav-directory" id="excmd-more-routes" role="group" aria-label="Additional Exterior workspaces">
      {other.map(item=><Link key={item.path} href={path+item.path} onClick={()=>setExpanded(false)}>{item.title}<ArrowUpRight size={12} aria-hidden="true"/></Link>)}
    </div>}
  </div>;
}
