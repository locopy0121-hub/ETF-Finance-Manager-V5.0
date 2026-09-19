import { describe, expect, it } from 'vitest';
import { createFrame360Grid } from '../../src/v3/frame360';
import {
  createFrame360ComponentInstance,
  updateFrame360ComponentInstance,
} from '../../src/v3/frame360Components';

describe('360 component cell', () => {
  it('creates a calendar as an independent component instance inside one cell', () => {
    const grid = createFrame360Grid(1, 1);
    grid.dataCells[0].content = {
      kind: 'component',
      component: 'calendar',
      config: { showDividendEvents: false },
    };

    const instance = createFrame360ComponentInstance(
      grid.dataCells[0],
      'calendar-1',
    );

    expect(instance.kind).toBe('calendar');
    expect(instance.parentCellId).toBe(grid.dataCells[0].id);
    expect(instance.settings.showMonthTitle).toBe(true);
    expect(instance.settings.showDividendEvents).toBe(false);
  });

  it('updates one component instance without mutating another instance', () => {
    const grid = createFrame360Grid(1, 2);
    grid.dataCells[0].content = { kind: 'component', component: 'calendar' };
    grid.dataCells[1].content = { kind: 'component', component: 'calendar' };

    const a = createFrame360ComponentInstance(grid.dataCells[0], 'a');
    const b = createFrame360ComponentInstance(grid.dataCells[1], 'b');
    const nextA = updateFrame360ComponentInstance(a, { showWeekdays: false });

    expect(nextA.settings.showWeekdays).toBe(false);
    expect(b.settings.showWeekdays).toBe(true);
  });
});
