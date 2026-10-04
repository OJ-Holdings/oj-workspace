import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { isValidBlock, jobLengths, makeBlock } from '../src/lib/exterior-ops';

/** The bookings table as it is on the live project: three allowed blocks, enforced by a check. */
async function legacyBookings(db: PGlite) {
  await db.exec(`create table public.bookings(id uuid primary key default gen_random_uuid(), date date not null,
    time_block varchar not null check (time_block in ('9-12','12-3','4-6')), status varchar not null default 'pending_approval');
    insert into public.bookings(date, time_block, status) values ('2026-10-06','12-3','confirmed'),('2026-10-06','4-6','confirmed'),('2026-10-07','9-12','confirmed');`);
}
const insert = (db: PGlite, block: string) => db.query(`insert into public.bookings(date, time_block, status) values ('2026-10-09', $1, 'confirmed')`, [block]);

test('before the update the live table refuses any block but the three old ones', async () => {
  const db = new PGlite();
  await legacyBookings(db);
  await assert.rejects(insert(db, '10-11'));
});

test('the any-time update keeps old bookings, accepts every time the workspace can make, and still refuses nonsense', async () => {
  for (const file of ['supabase/schemas/exterior-hourly-slots.sql', 'supabase/applied/2026-10-04-exterior-any-time-bookings.sql']) {
    const fresh = new PGlite();
    await legacyBookings(fresh);
    await fresh.exec(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
    const rows = await fresh.query<{ n: number }>(`select count(*)::int as n from public.bookings`);
    assert.equal(rows.rows[0].n, 3, `${file}: old bookings are untouched`);
    // Running it twice is harmless.
    await fresh.exec(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
    for (let start = 8 * 60; start <= 19 * 60 + 55; start += 15) for (const length of jobLengths) {
      const block = makeBlock(start, length);
      if (isValidBlock(block)) await insert(fresh, block);
    }
    await insert(fresh, '4:30-9');
    for (const bad of ['morning', '13-14', '9-', '-3', '0-1', '9-12-1', '', '9 - 12', '4:60-5', '4:5-6', '4:30', '24:00-1']) await assert.rejects(insert(fresh, bad), /./, `${file}: ${bad}`);
    for (const old of ['9-12', '12-3', '4-6']) await insert(fresh, old);
  }
});
