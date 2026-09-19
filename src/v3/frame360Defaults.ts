import {
  appendFrame360Block,
  createFrame360Template,
  migrateFrame360CellsToBlocks,
  type Frame360CellContent,
  type Frame360Template,
} from './frame360';

function append(
  template: Frame360Template,
  content: Frame360CellContent,
  layout: { x: number; y: number; width: number; height: number },
): Frame360Template {
  const result = appendFrame360Block(template, content);
  return {
    ...result.template,
    blocks: result.template.blocks.map(block =>
      block.id === result.block.id
        ? {
            ...block,
            layout: {
              ...block.layout,
              mode: 'free',
              ...layout,
            },
          }
        : block,
    ),
  };
}

export function createPortfolioHoldingFrame360Template(): Frame360Template {
  let template = createFrame360Template({
    id: 'portfolio:portfolio-list',
    surface: 'portfolio',
    templateKey: 'shared-list-template',
    name: '庫存持股｜持股卡片',
    rows: 2,
    columns: 5,
  });

  // V5.0.8+: the frame itself is the Canvas. These are direct Blocks;
  // no 5x2 content cells are created or merged.
  template = append(template, { kind: 'data', binding: 'symbol' }, { x: 1, y: 8, width: 18, height: 38 });
  template = append(template, { kind: 'data', binding: 'name' }, { x: 21, y: 8, width: 35, height: 38 });
  template = append(template, { kind: 'reminder', source: 'exDividendToday', activeLabel: '今日除息', effect: 'blink' }, { x: 58, y: 8, width: 18, height: 38 });
  template = append(template, { kind: 'data', binding: 'category' }, { x: 1, y: 54, width: 24, height: 36 });
  template = append(template, { kind: 'data', binding: 'cashPnl', colorRule: 'pnl' }, { x: 27, y: 54, width: 34, height: 36 });
  template = append(template, { kind: 'data', binding: 'cashRoi', format: 'percent', colorRule: 'pnl' }, { x: 63, y: 54, width: 36, height: 36 });

  return migrateFrame360CellsToBlocks(template);
}
