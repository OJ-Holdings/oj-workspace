'use server';

import { requireMember } from '@/lib/supabase';
import { isMissingTable } from '@/lib/invoices';
import type { Customer, LeadLink, Property } from '@/lib/customers';
import type { ActionResult } from './invoice-actions';

// Customers, properties and their links need docs/db-change-proposals/RUN-ME-2026-10-28-customers.sql. Until an owner has run it these actions report 'not-set-up' and change nothing.

export type CustomersLoad =
  | { ok: true; customers: Customer[]; properties: Property[]; links: LeadLink[] }
  | { ok: false; reason: 'not-set-up' | 'no-access' | 'failed' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const friendly = (message: string | undefined) => (message ?? 'That did not go through.').replace(/^.*?(ERROR:\s*)/i, '').slice(0, 240);

export async function loadCustomers(org: string): Promise<CustomersLoad> {
  let ctx;
  try { ctx = await requireMember(org, true); } catch { return { ok: false, reason: 'no-access' }; }
  const { client } = ctx;
  const customers = await client.from('oj_customers').select('id,kind,name,phone,email,notes,created_at').eq('organization_id', org).order('name').limit(5000);
  if (customers.error) return { ok: false, reason: isMissingTable(customers.error) ? 'not-set-up' : 'failed' };
  const [properties, links] = await Promise.all([
    client.from('oj_properties').select('id,customer_id,label,address,access_notes,water_notes,surface_notes').eq('organization_id', org).limit(10000),
    client.from('oj_lead_links').select('lead_id,customer_id,property_id').eq('organization_id', org).limit(20000),
  ]);
  if (properties.error || links.error) return { ok: false, reason: 'failed' };
  return {
    ok: true,
    customers: (customers.data ?? []).map(c => ({ id: c.id as string, kind: c.kind as Customer['kind'], name: c.name as string, phone: (c.phone as string | null) ?? null, email: (c.email as string | null) ?? null, notes: (c.notes as string) ?? '', created_at: c.created_at as string })),
    properties: (properties.data ?? []).map(p => ({ id: p.id as string, customer_id: p.customer_id as string, label: (p.label as string) ?? '', address: p.address as string, access_notes: (p.access_notes as string) ?? '', water_notes: (p.water_notes as string) ?? '', surface_notes: (p.surface_notes as string) ?? '' })),
    links: (links.data ?? []).map(k => ({ lead_id: k.lead_id as string, customer_id: k.customer_id as string, property_id: (k.property_id as string | null) ?? null })),
  };
}

/** Builds customers and properties from any jobs not linked yet. Safe to run again. */
export async function syncCustomers(org: string): Promise<ActionResult<{ customers: number; properties: number; linked: number }>> {
  try {
    const { client } = await requireMember(org, true);
    const { data, error } = await client.rpc('oj_backfill_customers', { p_org: org });
    if (error) return { ok: false, message: friendly(error.message) };
    const r = (data ?? {}) as { customers?: number; properties?: number; linked?: number };
    return { ok: true, customers: Number(r.customers ?? 0), properties: Number(r.properties ?? 0), linked: Number(r.linked ?? 0) };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not sync customers.' }; }
}

export async function saveCustomer(org: string, id: string, input: { name: string; phone: string; email: string; notes: string; kind: string }): Promise<ActionResult> {
  try {
    const { client } = await requireMember(org, true);
    const name = clip(input.name, 200);
    if (!UUID.test(id)) return { ok: false, message: 'That customer no longer exists.' };
    if (!name) return { ok: false, message: 'A customer needs a name.' };
    if (!['person', 'company'].includes(input.kind)) return { ok: false, message: 'Choose person or company.' };
    const { error } = await client.from('oj_customers').update({ name, phone: clip(input.phone, 40) || null, email: clip(input.email, 200) || null, notes: clip(input.notes, 2000), kind: input.kind }).eq('organization_id', org).eq('id', id);
    if (error) return { ok: false, message: friendly(error.message) };
    return { ok: true };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not save the customer.' }; }
}

export async function saveProperty(org: string, id: string, input: { label: string; address: string; access_notes: string; water_notes: string; surface_notes: string }): Promise<ActionResult> {
  try {
    const { client } = await requireMember(org, true);
    const address = clip(input.address, 500);
    if (!UUID.test(id)) return { ok: false, message: 'That property no longer exists.' };
    if (!address) return { ok: false, message: 'A property needs an address.' };
    const { error } = await client.from('oj_properties').update({ label: clip(input.label, 80), address, access_notes: clip(input.access_notes, 1000), water_notes: clip(input.water_notes, 500), surface_notes: clip(input.surface_notes, 1000) }).eq('organization_id', org).eq('id', id);
    if (error) return { ok: false, message: friendly(error.message) };
    return { ok: true };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not save the property.' }; }
}

export async function addProperty(org: string, customerId: string, input: { label: string; address: string }): Promise<ActionResult> {
  try {
    const { client } = await requireMember(org, true);
    const address = clip(input.address, 500);
    if (!UUID.test(customerId)) return { ok: false, message: 'That customer no longer exists.' };
    if (!address) return { ok: false, message: 'Enter the address.' };
    const { error } = await client.from('oj_properties').insert({ organization_id: org, customer_id: customerId, label: clip(input.label, 80), address });
    if (error) return { ok: false, message: friendly(error.message) };
    return { ok: true };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not add the property.' }; }
}

export async function mergeCustomers(org: string, keep: string, remove: string): Promise<ActionResult> {
  try {
    const { client } = await requireMember(org, true);
    if (!UUID.test(keep) || !UUID.test(remove)) return { ok: false, message: 'Choose two customers.' };
    const { error } = await client.rpc('oj_merge_customers', { p_org: org, p_keep: keep, p_remove: remove });
    if (error) return { ok: false, message: friendly(error.message) };
    return { ok: true };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not merge the customers.' }; }
}
