import { describe, expect, it } from 'vitest';
import {
  appendFrame360Block,
  createFrame360Grid,
  createFrame360Template,
  migrateFrame360CellsToBlocks,
  resizeFrame360Workspace,
} from '../../src/v3/frame360';

describe('V5.0.8 Canvas / Block migration', () => {
  it('migrates occupied legacy cells into canonical Blocks and clears Cell content storage', () => {
    const template = createFrame360Template({
      id: 'portfolio:header',
      surface: 'portfolio',
      templateKey: 'global:portfolio:header',
      name: 'portfolio-header',
      rows: 2,
      columns: 3,
      updatedAt: 1,
    });

    // Simulate a persisted pre-V5.0.8 Cell payload.
    template.grid = createFrame360Grid(2, 3);
    template.grid.dataCells[0].content = { kind: 'text', text: '庫存持股' };
    template.grid.dataCells[1].content = { kind: 'data', binding: 'totalAssets' };

    const migrated = migrateFrame360CellsToBlocks(template);

    expect(migrated.blocks.length).toBe(2);
    expect(migrated.blocks.every(block => block.layout?.mode === 'free')).toBe(true);
    expect(migrated.blocks.every(block => block.content.kind !== 'empty')).toBe(true);
    expect(migrated.grid.dataCells).toEqual([]);
  });

  it('resizes only Canvas guide density and preserves Blocks', () => {
    let template = createFrame360Template({
      id: 'portfolio:header',
      surface: 'portfolio',
      templateKey: 'global:portfolio:header',
      name: 'portfolio-header',
      rows: 2,
      columns: 2,
      updatedAt: 1,
    });
    template = appendFrame360Block(template, { kind: 'text', text: 'A' }).template;
    const migrated = migrateFrame360CellsToBlocks(template);
    const before = migrated.blocks[0];

    const resized = resizeFrame360Workspace(migrated, 6, 8);

    expect(resized.canvas.gridRows).toBe(6);
    expect(resized.canvas.gridColumns).toBe(8);
    expect(resized.grid.rows).toBe(6);
    expect(resized.grid.columns).toBe(8);
    expect(resized.grid.dataCells).toEqual([]);
    expect(resized.blocks.length).toBe(1);
    expect(resized.blocks[0].id).toBe(before.id);
    expect(resized.blocks[0].layout).toEqual(before.layout);
  });

  it('adds a new independent Block without creating any storage Cell', () => {
    const template = createFrame360Template({
      id: 'dividend:summary',
      surface: 'dividend',
      templateKey: 'global:dividend:summary',
      name: 'dividend-summary',
      rows: 4,
      columns: 4,
      updatedAt: 1,
    });
    const result = appendFrame360Block(template);

    expect(result.template.blocks.length).toBe(1);
    expect(result.template.grid.dataCells).toEqual([]);
    expect(result.block.id.startsWith('block-')).toBe(true);
    expect(result.block.layout?.mode).toBe('free');
    expect(result.block.baseCellIds).toEqual([]);
  });
});
