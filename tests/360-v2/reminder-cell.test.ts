import { describe, expect, it } from 'vitest';
import { createFrame360Grid } from '../../src/v3/frame360';
import {
  resolveFrame360CellVisibility,
  resolveFrame360Reminder,
} from '../../src/v3/frame360Reminder';

describe('360 reminder cell', () => {
  it('shows 今日除息 only when the selected reminder condition is active', () => {
    const result = resolveFrame360Reminder(
      {
        kind: 'reminder',
        source: 'exDividendToday',
        activeLabel: '［今日除息］',
        effect: 'breathe',
      },
      { today: '2026-09-19', exDividendDate: '2026-09-19' },
    );
    expect(result.visible).toBe(true);
    expect(result.text).toBe('［今日除息］');
  });

  it('keeps the cell structure but hides the reminder object when inactive', () => {
    const grid = createFrame360Grid(1, 1);
    grid.dataCells[0].content = {
      kind: 'reminder',
      source: 'exDividendToday',
      activeLabel: '［今日除息］',
      effect: 'blink',
    };

    const result = resolveFrame360CellVisibility(
      grid.dataCells[0],
      { today: '2026-09-20', exDividendDate: '2026-09-19' },
    );

    expect(result.visible).toBe(false);
    expect(grid.dataCells).toHaveLength(1);
    expect(grid.dataCells[0].content.kind).toBe('reminder');
  });
});
