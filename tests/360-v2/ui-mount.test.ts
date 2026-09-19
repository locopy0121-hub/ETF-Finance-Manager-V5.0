import { describe, expect, it } from 'vitest';
import {
  FRAME360_CELL_TYPES,
  FRAME360_REMINDERS,
} from '../../src/v3/frame360Registry';

describe('360 UI contract', () => {
  it('exposes reminder and component choices required by the mounted editor', () => {
    expect(FRAME360_CELL_TYPES.some(item => item.kind === 'reminder')).toBe(true);
    expect(FRAME360_CELL_TYPES.some(item => item.kind === 'component')).toBe(true);
    expect(FRAME360_REMINDERS.some(item => item.source === 'exDividendToday')).toBe(true);
  });
});
