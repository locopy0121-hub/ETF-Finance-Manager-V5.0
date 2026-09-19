import { describe, expect, it } from 'vitest';
import {
  createFrame360Grid,
  createFrame360Template,
  instantiateFrame360Template,
  updateFrame360Template,
  mergeFrame360Cells,
  splitFrame360Cell,
} from '../../src/v3/frame360';

describe('360 frame core model', () => {
  it('creates an 8 x 4 grid as 32 independent base/data cells', () => {
    const grid = createFrame360Grid(4, 8);
    expect(grid.rows).toBe(4);
    expect(grid.columns).toBe(8);
    expect(grid.baseCells).toHaveLength(32);
    expect(grid.dataCells).toHaveLength(32);
    expect(new Set(grid.dataCells.map(cell => cell.id)).size).toBe(32);
  });

  it('separates shared frame template from data instances', () => {
    const template = createFrame360Template({
      id: 'portfolio-holding',
      surface: 'portfolio',
      templateKey: 'holding-card',
      name: '持股框架',
      rows: 2,
      columns: 5,
      updatedAt: 1,
    });

    const a = instantiateFrame360Template(template, 'holding-0050', '0050');
    const b = instantiateFrame360Template(template, 'holding-00878', '00878');

    expect(a.templateId).toBe(template.id);
    expect(b.templateId).toBe(template.id);
    expect(a.dataKey).not.toBe(b.dataKey);
  });

  it('updates the shared template without changing its identity', () => {
    const template = createFrame360Template({
      id: 'portfolio-holding',
      surface: 'portfolio',
      templateKey: 'holding-card',
      name: '持股框架',
      rows: 2,
      columns: 5,
      updatedAt: 1,
    });
    const next = updateFrame360Template(template, { name: '持股框架新版' });
    expect(next.id).toBe(template.id);
    expect(next.templateKey).toBe(template.templateKey);
    expect(next.version).toBe(2);
  });
});


describe('360 frame merge safety', () => {
  it('requires an explicit decision when multiple selected cells already contain data', () => {
    const grid = createFrame360Grid(1, 2);
    grid.dataCells[0].content = { kind: 'text', text: '0050' };
    grid.dataCells[1].content = { kind: 'text', text: '元大台灣50' };

    const result = mergeFrame360Cells(
      grid,
      [grid.dataCells[0].id, grid.dataCells[1].id],
    );

    expect(result.status).toBe('needsDecision');
  });

  it('merges selected rectangle into one data cell and can split it back', () => {
    const grid = createFrame360Grid(2, 2);
    const ids = grid.dataCells.map(cell => cell.id);
    const result = mergeFrame360Cells(grid, ids, 'keepFirst');
    expect(result.status).toBe('merged');
    if (result.status !== 'merged') return;
    expect(result.grid.dataCells).toHaveLength(1);
    expect(result.mergedCell.baseCellIds).toHaveLength(4);

    const restored = splitFrame360Cell(result.grid, result.mergedCell.id);
    expect(restored.dataCells).toHaveLength(4);
  });
});
