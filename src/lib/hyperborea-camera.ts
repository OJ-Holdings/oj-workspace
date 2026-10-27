/** Throttle moving camera readouts without leaving a camp just below its threshold. */
export function cameraReadout(current:number,target:number) {
  return Math.abs(current-target)<1 ? target : Math.round(current/10)*10;
}
