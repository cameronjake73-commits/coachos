import assert from 'node:assert/strict';
import { scoreClientRisk } from '../src/lib/risk';

const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
const base = {
  checkinDay: 0, lastCheckinAt: ago(3), plannedWorkoutsPerWeek: 3, workoutsLast14Days: 6,
  lastClientMessageAt: ago(2), paymentStatus: 'paid' as const, renewalDate: null, startDate: ago(90),
  recentCheckins: [
    { training_adherence: 90, nutrition_adherence: 85, energy: 7, stress: 4, sleep_quality: 7 },
    { training_adherence: 92, nutrition_adherence: 80, energy: 7, stress: 4, sleep_quality: 7 },
  ],
};

const healthy = scoreClientRisk(base);
assert.equal(healthy.level, 'low'); assert.equal(healthy.score, 0);

const drifting = scoreClientRisk({
  ...base, lastCheckinAt: ago(17), workoutsLast14Days: 0, paymentStatus: 'overdue', renewalDate: new Date(Date.now() + 5 * 864e5).toISOString(),
  recentCheckins: [
    { training_adherence: 40, nutrition_adherence: 45, energy: 3, stress: 9, sleep_quality: 3 },
    { training_adherence: 90, nutrition_adherence: 85, energy: 7, stress: 4, sleep_quality: 7 },
  ],
});
assert.equal(drifting.level, 'high'); assert.ok(drifting.score <= 100);
assert.ok(drifting.reasons.some((r) => r.includes('No check-in')));
assert.ok(drifting.reasons.some((r) => r.includes('Renewal')));

const newClient = scoreClientRisk({ ...base, lastCheckinAt: null, recentCheckins: [], startDate: ago(3), workoutsLast14Days: 2 });
assert.equal(newClient.level, 'low');

const missedOne = scoreClientRisk({ ...base, lastCheckinAt: ago(10) });
assert.equal(missedOne.level, 'low'); assert.equal(missedOne.score, 18);

console.log('risk tests passed', { healthy: healthy.score, drifting: drifting.score, reasons: drifting.reasons.length });
