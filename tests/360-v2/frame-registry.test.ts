import { describe, expect, it } from 'vitest';
import {
  FRAME360_CELL_TYPES,
  FRAME360_COMPONENTS,
  FRAME360_REMINDERS,
  frame360CellTypeLabel,
} from '../../src/v3/frame360Registry';

describe('360 registry', () => {
  it('includes reminder and component as first-class Block types', () => {
    expect(FRAME360_CELL_TYPES.some(item => item.kind === 'reminder')).toBe(true);
    expect(FRAME360_CELL_TYPES.some(item => item.kind === 'component')).toBe(true);
  });

  it('keeps all visible registry labels in Chinese', () => {
    const visible = [
      ...FRAME360_CELL_TYPES.flatMap(item => [item.label, item.description]),
      ...FRAME360_REMINDERS.flatMap(item => [item.label, item.activeLabel]),
      ...FRAME360_COMPONENTS.flatMap(item => [item.label, item.description]),
    ];
    for (const text of visible) {
      expect(/[A-Za-z]/.test(text)).toBe(false);
    }
    expect(frame360CellTypeLabel('reminder')).toBe('提醒方塊');
  });
});
