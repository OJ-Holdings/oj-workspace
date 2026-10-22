export type ReleaseMatch = 'matched'|'different'|'host-unavailable'|'unmanaged'|'github-unknown'|'invalid-release';
export type ReleaseAssessment = {
  state: ReleaseMatch;
  runningSha: string | null;
  mainSha: string | null;
  label: string;
  detail: string;
};
const shaPattern=/^[a-f0-9]{40}$/i;
const object=(value:unknown):Record<string,unknown>|null=>
  value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const sha=(value:unknown):string|null=>
  typeof value==='string'&&shaPattern.test(value)?value.toLowerCase():null;

/**
 * Only a single sanitized running-release identifier can be checked.
 * A SHA match is NOT confirmation that CI, Supabase, worker jobs, authentication,
 * billing, mail delivery or anything beyond this GET endpoint is healthy.
 * All failures remain explicit unknowns rather than passing silently.
 */
export function assessRelease(hostResponse:unknown, githubResponse:unknown):ReleaseAssessment {
  const host=object(hostResponse);
  const github=object(githubResponse);
  const running=sha(host?.release);
  const expected=sha(github?.sha);
  const base={runningSha:running,mainSha:expected};
  if(!host||host.status!=='ok'){
    return {...base,state:'host-unavailable',label:'Application probe unavailable',
      detail:'The current app did not return the expected healthy release probe. No deployment claim is possible.'};
  }
  if(host.release==='unmanaged'){
    return {...base,state:'unmanaged',label:'Release identifier not configured',
      detail:'This app responds but is not reporting a CI-managed release SHA. It cannot be compared with GitHub main.'};
  }
  if(!running){
    return {...base,state:'invalid-release',label:'Release identifier invalid',
      detail:'The app responded but did not provide a valid 40-character Git commit SHA.'};
  }
  if(!expected){
    return {...base,state:'github-unknown',label:'GitHub main could not be verified',
      detail:'The running release is known but GitHub main is unavailable or returned an invalid SHA. No match claim is possible.'};
  }
  if(running!==expected){
    return {...base,state:'different',label:'Running release differs from GitHub main',
      detail:'This app reports a different commit from current main. An updater may be in progress, blocked or deliberately pinned; investigate before assuming why.'};
  }
  return {...base,state:'matched',label:'Running release SHA matches GitHub main',
    detail:'The app identifies itself as the same commit as GitHub main at check time. This is NOT an end-to-end health or deployment-safety guarantee.'};
}

export const releaseLinks={
  source:'https://github.com/OJ-Holdings/oj-workspace',
  actions:'https://github.com/OJ-Holdings/oj-workspace/actions',
  latest:'https://github.com/OJ-Holdings/oj-workspace/commits/main',
  help:'https://github.com/OJ-Holdings/oj-workspace/blob/main/scripts/verify-production-windows.ps1',
} as const;
