import {revenueForAltitude} from './hyperborea-progress';
import {SUMMIT_ALTITUDE} from './hyperborea';

export const TRAIL_INTERVAL=5;
export type TrailStep={id:string;altitude:number;label:string;revenue:number};
/** Dense requirements, not fabricated completed tasks. Bounded at 1,770 points. */
export function trailSteps():TrailStep[] {
  const out:TrailStep[]=[];
  for(let altitude=TRAIL_INTERVAL;altitude<SUMMIT_ALTITUDE;altitude+=TRAIL_INTERVAL)
    out.push({id:`step:${altitude}`,altitude,label:`${altitude.toLocaleString('en-US')} m`,revenue:Math.ceil(revenueForAltitude(altitude))});
  out.push({id:`step:${SUMMIT_ALTITUDE}`,altitude:SUMMIT_ALTITUDE,label:'8,849 m',revenue:100000000});
  return out;
}
export function trailWindow(steps:readonly TrailStep[],center:number,count=25) {
  center=Number.isFinite(center)?center:0;
  count=Math.max(1,Math.min(101,Math.floor(Number.isFinite(count)?count:25)));
  const index=steps.findIndex(s=>s.altitude>=center);
  const start=Math.max(0,Math.min(steps.length-count,(index<0?steps.length-1:index)-Math.floor(count/2)));
  return steps.slice(start,start+count);
}
export function boundedZoom(current:number,factor:number) {
  if(!Number.isFinite(factor)||factor<=0)return current;
  return Math.max(0.10,Math.min(2.5,current*factor));
}
