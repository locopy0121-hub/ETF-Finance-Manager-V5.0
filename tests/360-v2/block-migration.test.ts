import { describe, expect, it } from 'vitest';
import {
  appendFrame360Block,
  createFrame360Template,
  migrateFrame360CellsToBlocks,
  resizeFrame360Workspace,
} from '../../src/v3/frame360';

describe('V5.0.4 360 block migration', () => {
  it('drops empty legacy storage cells and converts occupied cells to free blocks', () => {
    const template = createFrame360Template({
      id: 'portfolio:header',
      surface: 'portfolio',
      templateKey: 'global:portfolio:header',
      name: 'portfolio-header',
      rows: 2,
      columns: 3,
      updatedAt: 1,
    });
    template.grid.dataCells[0].content = { kind: 'text', text: '庫存持股' };
    template.grid.dataCells[1].content = { kind: 'data', binding: 'totalAssets' };

    const migrated = migrateFrame360CellsToBlocks(template);

    expect(migrated.grid.dataCells.length).toBe(2);
    expect(migrated.grid.dataCells.every(block => block.layout?.mode === 'free')).toBe(true);
    expect(migrated.grid.dataCells.every(block => block.content.kind !== 'empty')).toBe(true);
    expect(migrated.grid.dataCells[0].layout?.width).toBeLessThan(100 / 3);
  });

  it('resizes only the active workspace and preserves blocks', () => {
    const template = createFrame360Template({
      id: 'portfolio:header',
      surface: 'portfolio',
      templateKey: 'global:portfolio:header',
      name: 'portfolio-header',
      rows: 2,
      columns: 2,
      updatedAt: 1,
    });
    template.grid.dataCells[0].content = { kind: 'text', text: 'A' };
    const migrated = migrateFrame360CellsToBlocks(template);
    const before = migrated.grid.dataCells[0];

    const resized = resizeFrame360Workspace(migrated, 6, 8);

    expect(resized.grid.rows).toBe(6);
    expect(resized.grid.columns).toBe(8);
    expect(resized.grid.dataCells.length).toBe(1);
    expect(resized.grid.dataCells[0].id).toBe(before.id);
    expect(resized.grid.dataCells[0].layout).toEqual(before.layout);
  });

  it('adds a new independent block instead of creating a storage cell', () => {
    const template = createFrame360Template({
      id: 'dividend:summary',
      surface: 'dividend',
      templateKey: 'global:dividend:summary',
      name: 'dividend-summary',
      rows: 4,
      columns: 4,
      updatedAt: 1,
    });
    const migrated = migrateFrame360CellsToBlocks(template);
    const result = appendFrame360Block(migrated);

    expect(result.template.grid.dataCells.length).toBe(1);
    expect(result.block.id.startsWith('block-')).toBe(true);
    expect(result.block.layout?.mode).toBe('free');
    expect(result.block.baseCellIds).toEqual([]);
  });
});
