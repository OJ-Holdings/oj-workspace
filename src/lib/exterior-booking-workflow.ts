import type { ExtBooking } from './exterior';
import { parseBlock } from './exterior-ops';

/** Only stored booking status/date is evidence of work; no dispatch or payment is inferred. */
export const bookingWorkFocuses = ['upcoming', 'today', 'next-seven', 'pending', 'past', 'denied'] as const;
export type BookingWorkFocus = typeof bookingWorkFocuses[number];
export const bookingWorkLabels: Record<BookingWorkFocus, string> = {
  upcoming: 'All upcoming',
  today: 'Today',
  'next-seven': 'Next 7 days',
  pending: 'Awaiting approval',
  past: 'Past bookings',
  denied: 'Denied bookings',
};
export const bookingWorkDescriptions: Record<BookingWorkFocus, string> = {
  upcoming: 'Records dated today or later, excluding denied. Scheduling is not job completion.',
  today: 'Bookings dated today. No arrival, crew or work-start confirmation is inferred.',
  'next-seven': 'Bookings dated after today through the next seven calendar days.',
  pending: 'Upcoming bookings explicitly recorded as pending approval, not confirmed jobs.',
  past: 'Past non-denied bookings. A past date does not mean the job was completed.',
  denied: 'Booking records explicitly marked denied; excluded from active schedules.',
};
/** Date-only arithmetic in UTC avoids daylight-saving and server/client timezone drift. */
export function addBookingDays(today: string, days: number): string {
  const date = new Date(`${today}T12:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !Number.isFinite(date.getTime()))
    return today;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function matchesBookingWorkFocus(booking: ExtBooking, focus: BookingWorkFocus, today: string): boolean {
  const denied = booking.status === 'denied';
  if (focus === 'denied') return denied;
  if (denied) return false;
  if (focus === 'upcoming') return booking.date >= today;
  if (focus === 'today') return booking.date === today;
  if (focus === 'next-seven') return booking.date > today && booking.date <= addBookingDays(today, 7);
  if (focus === 'pending') return booking.date >= today && booking.status === 'pending_approval';
  if (focus === 'past') return booking.date < today;
  return false;
}
export function bookingWorkCounts(bookings: readonly ExtBooking[], today: string): Record<BookingWorkFocus, number> {
  return Object.fromEntries(bookingWorkFocuses.map(focus => [
    focus, bookings.reduce((n, booking) => n + Number(matchesBookingWorkFocus(booking, focus, today)), 0),
  ])) as Record<BookingWorkFocus, number>;
}
export function sortBookingsForWork<T extends ExtBooking>(rows: readonly T[], reverseDates = false): T[] {
  return [...rows].sort((a, b) => {
    const dateOrder = reverseDates ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
    if (dateOrder) return dateOrder;
    const aStart = parseBlock(a.time_block)?.start;
    const bStart = parseBlock(b.time_block)?.start;
    if (aStart !== undefined && bStart !== undefined && aStart !== bStart) return aStart - bStart;
    if (aStart === undefined && bStart !== undefined) return 1;
    if (aStart !== undefined && bStart === undefined) return -1;
    return a.id.localeCompare(b.id);
  });
}
