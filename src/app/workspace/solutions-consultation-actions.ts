'use server';

import { requireMember } from '@/lib/supabase';

const fields = 'id,name,email,phone,business,service,notes,preferred_date,preferred_time,status,created_at,sms_consent,sms_consent_at';

export type SolutionsConsultation = {
  id: string;
  name: string;
  email: string;
  phone: string;
  business: string;
  service: string;
  notes: string;
  preferred_date: string;
  preferred_time: string;
  status: 'requested' | 'confirmed' | 'declined' | 'completed';
  created_at: string;
  sms_consent: boolean;
  sms_consent_at: string | null;
};
export type SolutionsConsultationResult =
  | { ok: true; entries: SolutionsConsultation[] }
  | { ok: false; message: string };

export async function loadSolutionsConsultations(org: string): Promise<SolutionsConsultationResult> {
  try {
    // Personal contact details are available only to OJ Workspace owners/members, not viewers.
    const { client } = await requireMember(org, true);
    const { data, error } = await client.from('oj_solutions_consultations')
      .select(fields).eq('organization_id', org).order('created_at', { ascending: false }).limit(200);
    if (error) return { ok: false, message: 'Could not read website consultation requests. Check the booking table and your permissions.' };
    return { ok: true, entries: (data ?? []) as SolutionsConsultation[] };
  } catch {
    return { ok: false, message: 'Member access is required to view consultation contact details.' };
  }
}

export async function setSolutionsConsultationStatus(
  org: string, id: string, status: 'confirmed' | 'declined' | 'completed',
): Promise<{ ok: boolean; message: string }> {
  if (!/^[a-f0-9-]{36}$/i.test(id) || !['confirmed', 'declined', 'completed'].includes(status)) {
    return { ok: false, message: 'Invalid consultation update.' };
  }
  try {
    const { client } = await requireMember(org, true);
    const { data, error } = await client.from('oj_solutions_consultations')
      .update({ status }).eq('id', id).eq('organization_id', org).select('id').maybeSingle();
    if (error) {
      // The database prevents two confirmed bookings in the same 15-minute slot.
      return { ok: false, message: error.code === '23505'
        ? 'This time is already confirmed for another person. Choose a different request.'
        : 'Could not update consultation status.' };
    }
    if (!data) return { ok: false, message: 'Consultation not found or access denied.' };
    return { ok: true, message: 'Consultation status saved.' };
  } catch { return { ok: false, message: 'Member access is required to update requests.' }; }
}
