import { outOfState } from '@/lib/out-of-state';

/** Shown beside an address outside Wisconsin: insurance, registration and tax are not cleared for other states yet (master plan 1e). */
export function OutOfStateFlag({ address }: { address: string | null | undefined }) {
  const state = outOfState(address);
  if (!state) return null;
  return <span className="oos-flag" title="Check insurance, registration and tax before booking work in another state">Out of state ({state}) - needs a check</span>;
}
