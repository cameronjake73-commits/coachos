import assert from 'node:assert/strict';
import { addMonths, checkinCycle, checkinStatus, e1rm } from '../src/lib/coaching';

// Fixed "now": Tuesday 3 Nov 2026, 18:00. Check-in day Sunday (0).
const now = new Date(2026, 10, 3, 18, 0);
const d = (y: number, m: number, day: number, h = 9) => new Date(y, m, day, h).toISOString();
const client = { start_date: '2026-08-01', created_at: d(2026, 7, 1) };

const cyc = checkinCycle(0, now);
assert.equal(cyc.due.getDate(), 1, 'Tuesday: current cycle is the Sunday just gone');
assert.equal(checkinCycle(0, new Date(2026, 10, 5, 10)).due.getDate(), 8, 'Thursday: window for next Sunday is open');

assert.equal(checkinStatus(client, d(2026, 9, 31), 0, now).state, 'submitted', 'Saturday before due counts');
const missed = checkinStatus(client, d(2026, 9, 24), 0, now);
assert.equal(missed.state, 'missed'); assert.equal(missed.missedCount, 1);
assert.equal(checkinStatus(client, d(2026, 9, 17), 0, now).missedCount, 2, 'two weeks without a check-in');
assert.equal(checkinStatus(client, null, 0, new Date(2026, 10, 1, 12)).state, 'due', 'due day itself is still "due"');
assert.equal(checkinStatus({ start_date: '2026-11-02', created_at: d(2026, 10, 2) }, null, 0, now).state, 'new', 'brand new client is not missed');

assert.equal(addMonths('2026-01-31', 1), '2026-02-28', 'clamps to month end');
assert.equal(addMonths('2026-11-11', 1), '2026-12-11');
assert.equal(addMonths('2026-12-15', 1), '2027-01-15');

assert.ok(Math.abs(e1rm(100, 5)! - 112.5) < 0.01);
assert.equal(e1rm(null, 5), null);
console.log('coaching tests passed');
