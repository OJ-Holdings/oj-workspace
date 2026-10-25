import {
  encodeCommercialPortfolio, portfolioLimit, validateCommercialPortfolio,
  type CommercialPortfolio, type CommercialProject,
} from './atlas-commercial-portfolio';

/**
 * ATLAS R15 — explicit file-based founder handoff, NOT live synchronization.
 *
 * Two browsers can independently change a project carrying the same local ID.
 * Their revision counters and timestamps are NOT a cross-device ordering
 * mechanism. Thus any difference to an existing ID must be reviewed manually;
 * no "newest wins", no name/address matching and no silent overwrites.
 */
export type PortfolioMergeConflict={
  id:string;
  existingName:string;
  incomingName:string;
  existingRevision:number;
  incomingRevision:number;
  existingUpdatedAt:string;
  incomingUpdatedAt:string;
};
export type PortfolioMergePlan={
  existingCount:number;incomingCount:number;additions:CommercialProject[];
  identicalIds:string[];conflicts:PortfolioMergeConflict[];
  projectedCount:number;limit:number;capacityAvailable:boolean;
};
const same=(a:CommercialProject,b:CommercialProject)=>JSON.stringify(a)===JSON.stringify(b);

/** Pure dry-run. Both operands are validated; never trusts imported membership or
 * project identity, never compares customer name/address, never mutates inputs.
 */
export function previewPortfolioMerge(
  existing:CommercialPortfolio,incoming:CommercialPortfolio,org:string,
):PortfolioMergePlan{
  const current=validateCommercialPortfolio(existing,org);
  const imported=validateCommercialPortfolio(incoming,org);
  const byId=new Map(current.projects.map(p=>[p.id,p]));
  const additions:CommercialProject[]=[];
  const identicalIds:string[]=[];
  const conflicts:PortfolioMergeConflict[]=[];
  for(const remote of imported.projects){
    const local=byId.get(remote.id);
    if(!local){additions.push(remote);continue;}
    if(same(local,remote)){identicalIds.push(remote.id);continue;}
    conflicts.push({
      id:remote.id,existingName:local.name,incomingName:remote.name,
      existingRevision:local.revision,incomingRevision:remote.revision,
      existingUpdatedAt:local.updatedAt,incomingUpdatedAt:remote.updatedAt,
    });
  }
  return {
    existingCount:current.projects.length,incomingCount:imported.projects.length,
    additions,identicalIds,conflicts,
    projectedCount:current.projects.length+additions.length,
    limit:portfolioLimit,capacityAvailable:current.projects.length+additions.length<=portfolioLimit,
  };
}
/** Adds ONLY new exact IDs. Identical IDs remain local; collisions remain local
 * and are explicitly returned as unresolved conflicts. The caller MUST get a
 * separate user confirmation before saving. New records are still local.
 */
export function mergeNonConflictingPortfolio(
  existing:CommercialPortfolio,incoming:CommercialPortfolio,org:string,
):{next:CommercialPortfolio;plan:PortfolioMergePlan;changed:boolean}{
  const current=validateCommercialPortfolio(existing,org);
  const plan=previewPortfolioMerge(current,incoming,org);
  if(!plan.capacityAvailable)
    throw new Error('Merge exceeds the 250-project browser recovery limit. No projects were imported.');
  if(plan.additions.length===0)return {next:current,plan,changed:false};
  const next:CommercialPortfolio={
    ...current,revision:current.revision+1,
    projects:[...current.projects,...plan.additions],
  };
  // Additional guard against output exceeding storage limits BEFORE any write.
  encodeCommercialPortfolio(next,org);
  return {next,plan,changed:true};
}
