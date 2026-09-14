import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell } from '../src/lib/csv.ts';
import { incidentTrend } from '../src/lib/incidentTrend.ts';

test('every spreadsheet formula prefix is neutralized, including whitespace', () => {
  for (const value of ['=SUM(A1)', '+1', '-1', '@cmd', '  =1', '\ttext', '\ntext']) {
    assert.equal(csvCell(value), `"'${value}"`);
  }
  assert.equal(csvCell('Camera "A", Storage'), '"Camera ""A"", Storage"');
  assert.equal(csvCell(null), '""');
});
test('all-time trend includes incidents older than thirty days', () => {
  const items = [{detectedAt:'2026-01-01T12:00:00'}, {detectedAt:'2026-09-14T12:00:00'}];
  const result = incidentTrend(items, null, new Date('2026-09-14T14:00:00'));
  assert.equal(result[0].date.getMonth(), 0);
  assert.equal(result[0].count, 1);
  assert.equal(result.at(-1).count, 1);
  assert.equal(result.reduce((sum, day) => sum + day.count, 0), 2);
  assert.equal(incidentTrend([], null).length, 1);
  assert.equal(incidentTrend(items, 7).length, 7);
});
