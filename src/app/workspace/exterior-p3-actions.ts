'use server';
import {getP3OriginalBookingRead} from '@/lib/exterior-p3-db-read';
import type {P3ProjectionResult} from '@/lib/exterior-p3-data';

/**
 * P3.2 preparation. Authenticated RLS-backed read only; no UI auto-fallback,
 * user-controlled provider attestation, quote acceptance or production writes.
 */
export async function loadExteriorP3Booking(
 organizationId:string,bookingId:string,
):Promise<P3ProjectionResult|{ok:false;reason:'unavailable'|'access-denied'}>{
 return getP3OriginalBookingRead(organizationId,bookingId);
}
