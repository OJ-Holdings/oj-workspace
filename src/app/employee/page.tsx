import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmployeePortal } from '@/components/EmployeePortal';
import { supabaseServer } from '@/lib/supabase';
import './employee.css';

export const dynamic = 'force-dynamic';

export default async function EmployeePage() {
  const client = await supabaseServer();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login?next=%2Femployee');
  const { data: profile, error: profileError } = await client.rpc('oj_employee_context');
  const employee = Array.isArray(profile) ? profile[0] : null;
  if (profileError || !employee) return <main className="employee-portal employee-no-access"><p className="eyebrow">Employee access</p><h1>This account has no employee portal access.</h1><p>Use the verified email from your invitation, or ask the OJ owner to check your employee account.</p><Link className="secondary" href="/login?next=%2Femployee">Sign in with another account</Link></main>;
  const [jobsResult, earningsResult] = await Promise.all([client.rpc('oj_employee_jobs'), client.rpc('oj_employee_earnings')]);
  if (jobsResult.error || earningsResult.error) return <main className="employee-portal employee-no-access"><p className="eyebrow">Employee access</p><h1>Your work could not be loaded.</h1><p>Refresh the page. If this continues, ask the owner to check the employee portal setup.</p><Link className="secondary" href="/auth/logout">Sign out</Link></main>;
  return <EmployeePortal displayName={employee.display_name} jobs={jobsResult.data ?? []} earnings={earningsResult.data ?? []} />;
}
