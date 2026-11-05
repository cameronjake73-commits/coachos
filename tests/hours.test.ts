import assert from 'node:assert/strict';
import { hoursFrom, isOpen, nextOpenText, hoursSummary, autoReplyText, quickRepliesFrom, replyPromise } from '../src/lib/hours';

const h = hoursFrom({ hours_enabled: true, hours_days: [1, 2, 3, 4, 5], hours_start: '09:00', hours_end: '18:00', reply_within_hours: 24 });
// Thursday 5 Nov 2026 (GMT = UTC in winter)
assert.equal(isOpen(h, new Date('2026-11-05T10:00:00Z')), true);
assert.equal(isOpen(h, new Date('2026-11-05T08:59:00Z')), false);
assert.equal(isOpen(h, new Date('2026-11-05T18:00:00Z')), false);
assert.equal(nextOpenText(h, new Date('2026-11-05T07:00:00Z')), 'today at 9am');
assert.equal(nextOpenText(h, new Date('2026-11-05T22:30:00Z')), 'tomorrow at 9am');
assert.equal(nextOpenText(h, new Date('2026-11-06T19:00:00Z')), 'on Monday at 9am'); // Friday evening
assert.equal(nextOpenText(h, new Date('2026-11-08T12:00:00Z')), 'tomorrow at 9am'); // Sunday
// British Summer Time: 08:30 UTC on 1 July 2026 is 09:30 in the UK
assert.equal(isOpen(h, new Date('2026-07-01T08:30:00Z')), true);
assert.equal(isOpen(hoursFrom({ hours_enabled: false }), new Date('2026-11-05T03:00:00Z')), true);
assert.equal(hoursSummary(h), 'Mon–Fri, 9am–6pm');
assert.equal(hoursSummary(hoursFrom({ hours_enabled: true, hours_days: [1, 3, 5], hours_start: '07:30', hours_end: '19:00' })), 'Mon, Wed, Fri, 7:30am–7pm');
assert.equal(hoursSummary(hoursFrom({ hours_enabled: true, hours_days: [5, 6, 0], hours_start: '10:00', hours_end: '14:00' })), 'Fri–Sun, 10am–2pm');
assert.equal(hoursSummary(hoursFrom({ hours_enabled: true, hours_days: [0, 1, 2, 3, 4, 5, 6] })), 'Every day, 9am–6pm');
assert.equal(replyPromise(h), '1 working day');
assert.equal(replyPromise(hoursFrom({ reply_within_hours: 4 })), '4 hours');
assert.equal(autoReplyText(null, 'Emma', 'tomorrow at 9am'), "Thanks Emma! I'm offline right now, but your message is saved and I'll get back to you tomorrow at 9am.");
assert.equal(autoReplyText('Hi {name}, back {next}', 'Liam', 'on Monday at 9am'), 'Hi Liam, back on Monday at 9am');
assert.equal(quickRepliesFrom([{ title: 'Hi', body: ' Hello ' }, { title: 'x', body: '' }, null]).length, 1);
// Bad saved values fall back safely
assert.equal(hoursFrom({ hours_enabled: true, hours_start: '25:00', hours_end: 'x' }).start, '09:00');
assert.equal(hoursFrom({ hours_enabled: true, hours_start: '18:00', hours_end: '09:00' }).enabled, false);
console.log('hours tests passed');
