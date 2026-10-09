/* Logic checks for the evening and weekend clock: London time, greetings, LED strip, colour and drift. */
const A = require('../../dashboards/_shared/after-hours.js');
const assert = require('node:assert/strict');
const at = iso => A.londonParts(new Date(iso));
// London is BST (UTC+1) until 25 Oct 2026, then GMT.
let p = at('2026-10-03T10:07:30Z'); assert.deepEqual([p.dayName, p.hour, p.minute, p.day, p.month], ['Saturday', 11, 7, 3, 'October']);
p = at('2026-10-26T00:30:00Z'); assert.deepEqual([p.dayName, p.hour, p.minute], ['Monday', 0, 30], 'GMT after the clocks go back');
assert.equal(at('2026-10-25T00:30:00Z').hour, 1, 'still BST before the change');
const g = iso => A.greeting(at(iso));
assert.equal(g('2026-10-03T10:00:00Z'), 'Enjoy your weekend');
assert.equal(g('2026-10-04T19:00:00Z'), 'Enjoy your weekend');
assert.equal(g('2026-10-09T17:00:00Z'), 'Have a good weekend');
assert.equal(g('2026-10-09T08:00:00Z'), 'Good morning');
assert.equal(g('2026-10-06T18:42:00Z'), 'Good evening');
assert.equal(g('2026-10-06T21:30:00Z'), 'Good night');
assert.equal(g('2026-10-07T02:15:00Z'), 'Good night');
assert.equal(g('2026-10-07T04:30:00Z'), 'Good morning');
const l0 = A.leds(0); assert.equal(l0.length, 60); assert.equal(l0[0], 1); assert.ok(l0.slice(1).every(v => v === 0));
const l30 = A.leds(30); assert.equal(l30[30], 1); assert.equal(l30[31], 0);
assert.ok(l30.slice(0, 30).every((v, i, a) => v > 0 && v < 1 && (i === 0 || v >= a[i - 1])), 'earlier minutes fade up to the current one');
assert.equal(A.leds(59).filter(v => v > 0).length, 60); assert.equal(A.leds(-5)[0], 1); assert.equal(A.leds(99)[59], 1);
for (const m of [0, 239, 240, 390, 720, 1050, 1200, 1350, 1439, 1440]) { const c = A.light(m); assert.ok(c.rgb.every(v => v >= 0 && v <= 255) && c.level > 0 && c.level <= 1, 'light ' + m); }
assert.ok(A.light(0).level < A.light(720).level, 'dimmer overnight than at midday');
assert.ok(A.light(1350).rgb[2] < A.light(1050).rgb[2], 'warmer late evening than at 17:30');
const d1 = A.drift(0), d2 = A.drift(450000); assert.ok(Math.abs(d1.x) <= 28 && Math.abs(d1.y) <= 18 && Math.abs(d2.x) <= 28); assert.notDeepEqual(d1, d2);
console.log('After-hours checks passed: London time, greetings, LED strip, colour and drift.');
