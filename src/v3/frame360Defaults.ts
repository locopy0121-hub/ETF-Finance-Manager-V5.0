import {
  createFrame360Template,
  mergeFrame360Cells,
  type Frame360DataCell,
  type Frame360Template,
} from './frame360';

function setContent(
  template: Frame360Template,
  cellId: string,
  content: Frame360DataCell['content'],
) {
  template.grid.dataCells = template.grid.dataCells.map(cell =>
    cell.id === cellId ? { ...cell, content } : cell,
  );
}

export function createPortfolioHoldingFrame360Template(): Frame360Template {
  let template = createFrame360Template({
    id: 'portfolio:portfolio-list',
    surface: 'portfolio',
    templateKey: 'shared-list-template',
    name: '持股框架',
    rows: 2,
    columns: 5,
  });

  const byBase = (baseId: string) =>
    template.grid.dataCells.find(cell => cell.baseCellIds.includes(baseId))?.id;

  const leftTop = byBase('r1c1');
  const leftBottom = byBase('r2c1');
  if (!leftTop || !leftBottom) throw new Error('持股框架建立失敗');
  const left = mergeFrame360Cells(template.grid, [leftTop, leftBottom], 'keepFirst');
  if (left.status !== 'merged') throw new Error('持股框架建立失敗');
  template = { ...template, grid: left.grid };
  setContent(template, left.mergedCell.id, { kind: 'data', binding: 'symbol' });

  const nameIds = ['r1c2', 'r1c3', 'r1c4']
    .map(byBase)
    .filter((id): id is string => Boolean(id));
  const name = mergeFrame360Cells(template.grid, nameIds, 'keepFirst');
  if (name.status !== 'merged') throw new Error('持股框架建立失敗');
  template = { ...template, grid: name.grid };
  setContent(template, name.mergedCell.id, { kind: 'data', binding: 'name' });

  const reminderIds = ['r2c3', 'r2c4']
    .map(byBase)
    .filter((id): id is string => Boolean(id));
  const reminder = mergeFrame360Cells(template.grid, reminderIds, 'keepFirst');
  if (reminder.status !== 'merged') throw new Error('持股框架建立失敗');
  template = { ...template, grid: reminder.grid };
  setContent(template, reminder.mergedCell.id, {
    kind: 'reminder',
    source: 'exDividendToday',
    activeLabel: '［今日除息］',
    effect: 'breathe',
  });

  const categoryId = byBase('r2c2');
  const pnlId = byBase('r1c5');
  const roiId = byBase('r2c5');
  if (categoryId) setContent(template, categoryId, { kind: 'data', binding: 'category' });
  if (pnlId) setContent(template, pnlId, { kind: 'data', binding: 'cashPnl' });
  if (roiId) setContent(template, roiId, { kind: 'data', binding: 'cashRoi' });

  return template;
}
