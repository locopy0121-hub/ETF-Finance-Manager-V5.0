export type Frame360Surface =
  | 'dashboard'
  | 'portfolio'
  | 'dividend'
  | 'ledger'
  | 'calculator'
  | 'market'
  | 'ai'
  | 'settings'
  | 'detail'
  | 'widget'
  | 'overlay';

export type Frame360CellKind =
  | 'empty'
  | 'text'
  | 'data'
  | 'image'
  | 'icon'
  | 'chart'
  | 'reminder'
  | 'component'
  | 'container';

export type Frame360Effect =
  | 'none'
  | 'breathe'
  | 'blink'
  | 'jump'
  | 'fade'
  | 'pulse'
  | 'borderPulse'
  | 'backgroundPulse';

export type Frame360Alignment =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'middleLeft'
  | 'center'
  | 'middleRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight';

export type Frame360ReminderSource =
  | 'dividendToday'
  | 'exDividendToday'
  | 'lastBuyToday'
  | 'payDateToday';

export type Frame360ComponentKind =
  | 'calendar'
  | 'ticker'
  | 'summary'
  | 'list'
  | 'progress'
  | 'status';

export type Frame360ColorRule = 'auto' | 'fixed' | 'theme' | 'pnl' | 'market';

export type Frame360BlockLayout = {
  mode?: 'grid' | 'free';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  lockAspectRatio?: boolean;
  locked?: boolean;
  zIndex?: number;
  nudgeStep?: number;
};

export type Frame360CellStyle = {
  alignment: Frame360Alignment;
  backgroundColor?: string;
  textColor?: string;
  textBackgroundColor?: string;
  borderColor?: string;
  textColorRule?: Frame360ColorRule;
  textBackgroundColorRule?: Frame360ColorRule;
  backgroundColorRule?: Frame360ColorRule;
  borderColorRule?: Frame360ColorRule;
  borderWidth?: number;
  radius?: number;
  opacity?: number;
  padding?: number;
  margin?: number;
  fontSize?: number;
  fontWeight?: '400' | '600' | '700' | '800' | '900';
  letterSpacing?: number;
  lineHeight?: number;
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
  effect?: Frame360Effect;
  visible?: boolean;
};

export type Frame360CellContent =
  | { kind: 'empty' }
  | { kind: 'text'; text: string }
  | {
      kind: 'data';
      binding: string;
      label?: string;
      formula?: string;
      format?: 'text' | 'number' | 'currency' | 'percent';
      colorRule?: Frame360ColorRule;
    }
  | { kind: 'image'; uri?: string; fit?: 'contain' | 'cover' }
  | { kind: 'icon'; icon: string }
  | { kind: 'chart'; chartType: string; binding: string }
  | {
      kind: 'reminder';
      source: Frame360ReminderSource;
      activeLabel: string;
      effect: Frame360Effect;
    }
  | { kind: 'component'; component: Frame360ComponentKind; config?: Record<string, unknown> }
  | { kind: 'container'; childTemplateId?: string };

export type Frame360BaseCell = {
  id: string;
  row: number;
  column: number;
};

export type Frame360DataCell = {
  id: string;
  targetNodeId?: string;
  nodeLabel?: string;
  rowStart: number;
  columnStart: number;
  rowSpan: number;
  columnSpan: number;
  baseCellIds: string[];
  content: Frame360CellContent;
  style: Frame360CellStyle;
  layout?: Frame360BlockLayout;
};

/**
 * V5.0.4: a visual item inside a 360 frame is a Block.
 * Frame360DataCell remains as a storage-compatible type name so existing
 * persisted layouts can be migrated without data loss.
 */
export type Frame360Block = Frame360DataCell;

export type Frame360Grid = {
  /** Workspace guide rows. They no longer imply content cells. */
  rows: number;
  /** Workspace guide columns. They no longer imply content cells. */
  columns: number;
  baseCells: Frame360BaseCell[];
  /** Visual Blocks only. Empty previous storage cells are removed by migration. */
  dataCells: Frame360Block[];
};

export type Frame360Template = {
  id: string;
  surface: Frame360Surface;
  templateKey: string;
  name: string;
  version: number;
  grid: Frame360Grid;
  updatedAt: number;
  locked?: boolean;
  allowOverlap?: boolean;
};

export type Frame360Instance = {
  id: string;
  templateId: string;
  dataKey: string;
};

export const DEFAULT_FRAME360_STYLE: Frame360CellStyle = {
  alignment: 'center',
  opacity: 100,
  padding: 8,
  radius: 8,
  fontSize: 12,
  fontWeight: '700',
  letterSpacing: 0,
  lineHeight: 16,
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
  effect: 'none',
  visible: true,
  textColorRule: 'fixed',
  textBackgroundColorRule: 'fixed',
  backgroundColorRule: 'fixed',
  borderColorRule: 'fixed',
};

const makeCellId = (row: number, column: number) => `r${row}c${column}`;

export function createFrame360Grid(rows: number, columns: number): Frame360Grid {
  if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1) {
    throw new Error('格線列數與欄數必須為正整數');
  }
  if (rows > 50 || columns > 50) {
    throw new Error('單一框架格線上限為 50 × 50');
  }

  const baseCells: Frame360BaseCell[] = [];
  const dataCells: Frame360DataCell[] = [];
  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= columns; column += 1) {
      const id = makeCellId(row, column);
      baseCells.push({ id, row, column });
      dataCells.push({
        id: `cell-${id}`,
        rowStart: row,
        columnStart: column,
        rowSpan: 1,
        columnSpan: 1,
        baseCellIds: [id],
        content: { kind: 'empty' },
        style: { ...DEFAULT_FRAME360_STYLE },
      });
    }
  }

  return { rows, columns, baseCells, dataCells };
}

function createBaseCells(rows: number, columns: number): Frame360BaseCell[] {
  const baseCells: Frame360BaseCell[] = [];
  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= columns; column += 1) {
      baseCells.push({ id: makeCellId(row, column), row, column });
    }
  }
  return baseCells;
}

function storedCellToFreeLayout(
  cell: Frame360DataCell,
  rows: number,
  columns: number,
): Frame360BlockLayout {
  const existing = cell.layout ?? {};
  const needsInset = existing.mode !== 'free';
  const baseX = ((cell.columnStart - 1) / Math.max(1, columns)) * 100;
  const baseY = ((cell.rowStart - 1) / Math.max(1, rows)) * 100;
  const baseWidth = (cell.columnSpan / Math.max(1, columns)) * 100;
  const baseHeight = (cell.rowSpan / Math.max(1, rows)) * 100;
  // A small inset makes migrated Blocks visibly independent instead of
  // reproducing the old edge-to-edge spreadsheet look.
  const gapX = needsInset ? Math.min(0.8, baseWidth * 0.08) : 0;
  const gapY = needsInset ? Math.min(0.8, baseHeight * 0.08) : 0;
  const width = existing.width ?? Math.max(4, baseWidth - gapX * 2);
  const height = existing.height ?? Math.max(4, baseHeight - gapY * 2);
  return {
    mode: 'free',
    x: existing.x ?? baseX + gapX,
    y: existing.y ?? baseY + gapY,
    width,
    height,
    minWidth: existing.minWidth ?? 4,
    minHeight: existing.minHeight ?? 4,
    maxWidth: existing.maxWidth ?? 100,
    maxHeight: existing.maxHeight ?? 100,
    lockAspectRatio: existing.lockAspectRatio ?? false,
    locked: existing.locked ?? false,
    zIndex: existing.zIndex ?? 0,
    nudgeStep: existing.nudgeStep ?? 1,
  };
}

/**
 * Converts previous 1-1 / 1-2 storage cells into independent free Blocks.
 * Empty cells are intentionally discarded; the grid remains only as a guide.
 * This function is idempotent and safe to run whenever a frame is opened.
 */
export function migrateFrame360CellsToBlocks(
  template: Frame360Template,
): Frame360Template {
  const rows = Math.max(1, template.grid.rows);
  const columns = Math.max(1, template.grid.columns);
  const blocks = template.grid.dataCells
    .filter(cell => cell.content.kind !== 'empty' || Boolean(cell.targetNodeId))
    .map(cell => ({
      ...cell,
      layout: storedCellToFreeLayout(cell, rows, columns),
    }));

  return {
    ...template,
    grid: {
      rows,
      columns,
      baseCells: createBaseCells(rows, columns),
      dataCells: blocks,
    },
  };
}

/**
 * Changes only the workspace guide dimensions. Existing Blocks stay in the
 * active frame and keep their free-layout positions instead of being replaced.
 */
export function resizeFrame360Workspace(
  template: Frame360Template,
  rows: number,
  columns: number,
): Frame360Template {
  if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1) {
    throw new Error('工作區列數與欄數必須為正整數');
  }
  if (rows > 50 || columns > 50) {
    throw new Error('單一框架工作區上限為 50 × 50');
  }
  const migrated = migrateFrame360CellsToBlocks(template);
  return {
    ...migrated,
    grid: {
      rows,
      columns,
      baseCells: createBaseCells(rows, columns),
      dataCells: migrated.grid.dataCells,
    },
  };
}

export function appendFrame360Block(
  template: Frame360Template,
  content: Frame360CellContent = { kind: 'text', text: '新方塊' },
): { template: Frame360Template; block: Frame360Block } {
  const migrated = migrateFrame360CellsToBlocks(template);
  const index = migrated.grid.dataCells.length;
  const width = Math.min(32, Math.max(18, 100 / Math.max(1, migrated.grid.columns)));
  const height = Math.min(28, Math.max(12, 100 / Math.max(1, migrated.grid.rows)));
  const step = 4;
  const x = Math.min(Math.max(0, 100 - width), (index * step) % Math.max(step, 100 - width));
  const y = Math.min(Math.max(0, 100 - height), (index * step) % Math.max(step, 100 - height));
  const id = `block-${Date.now()}-${index + 1}`;
  const block: Frame360Block = {
    id,
    rowStart: 1,
    columnStart: 1,
    rowSpan: 1,
    columnSpan: 1,
    baseCellIds: [],
    content,
    style: { ...DEFAULT_FRAME360_STYLE },
    layout: {
      mode: 'free',
      x,
      y,
      width,
      height,
      minWidth: 4,
      minHeight: 4,
      maxWidth: 100,
      maxHeight: 100,
      lockAspectRatio: false,
      locked: false,
      zIndex: index,
      nudgeStep: 1,
    },
  };
  return {
    template: {
      ...migrated,
      grid: {
        ...migrated.grid,
        dataCells: [...migrated.grid.dataCells, block],
      },
    },
    block,
  };
}

export function createFrame360Template(input: {
  id: string;
  surface: Frame360Surface;
  templateKey: string;
  name: string;
  rows: number;
  columns: number;
  updatedAt?: number;
}): Frame360Template {
  return {
    id: input.id,
    surface: input.surface,
    templateKey: input.templateKey,
    name: input.name,
    version: 1,
    grid: createFrame360Grid(input.rows, input.columns),
    updatedAt: input.updatedAt ?? Date.now(),
  };
}

export function instantiateFrame360Template(
  template: Frame360Template,
  instanceId: string,
  dataKey: string,
): Frame360Instance {
  return {
    id: instanceId,
    templateId: template.id,
    dataKey,
  };
}

export function updateFrame360Template(
  template: Frame360Template,
  patch: Partial<Omit<Frame360Template, 'id' | 'surface' | 'templateKey'>>,
): Frame360Template {
  return {
    ...template,
    ...patch,
    id: template.id,
    surface: template.surface,
    templateKey: template.templateKey,
    version: template.version + 1,
    updatedAt: Date.now(),
  };
}


export type Frame360MergeContentStrategy =
  | 'requireDecision'
  | 'keepFirst'
  | 'keepLast'
  | 'keepAll';

export type Frame360MergeResult =
  | { status: 'needsDecision'; occupiedCells: Frame360DataCell[] }
  | { status: 'merged'; grid: Frame360Grid; mergedCell: Frame360DataCell };

const isEmptyContent = (content: Frame360CellContent) => content.kind === 'empty';

function rectangleFromCells(cells: Frame360DataCell[]) {
  const rowStart = Math.min(...cells.map(cell => cell.rowStart));
  const columnStart = Math.min(...cells.map(cell => cell.columnStart));
  const rowEnd = Math.max(...cells.map(cell => cell.rowStart + cell.rowSpan - 1));
  const columnEnd = Math.max(...cells.map(cell => cell.columnStart + cell.columnSpan - 1));
  return {
    rowStart,
    columnStart,
    rowSpan: rowEnd - rowStart + 1,
    columnSpan: columnEnd - columnStart + 1,
  };
}

function expectedRectangleIds(
  rowStart: number,
  columnStart: number,
  rowSpan: number,
  columnSpan: number,
) {
  const ids: string[] = [];
  for (let row = rowStart; row < rowStart + rowSpan; row += 1) {
    for (let column = columnStart; column < columnStart + columnSpan; column += 1) {
      ids.push(makeCellId(row, column));
    }
  }
  return ids;
}

export function mergeFrame360Cells(
  grid: Frame360Grid,
  dataCellIds: string[],
  strategy: Frame360MergeContentStrategy = 'requireDecision',
): Frame360MergeResult {
  const uniqueIds = [...new Set(dataCellIds)];
  if (uniqueIds.length < 2) {
    throw new Error('至少需要選擇兩個資料格才能合併');
  }

  const selected = uniqueIds.map(id => {
    const found = grid.dataCells.find(cell => cell.id === id);
    if (!found) throw new Error(`找不到資料格：${id}`);
    return found;
  });

  const rect = rectangleFromCells(selected);
  const expected = expectedRectangleIds(
    rect.rowStart,
    rect.columnStart,
    rect.rowSpan,
    rect.columnSpan,
  ).sort();
  const actual = selected.flatMap(cell => cell.baseCellIds).sort();
  if (
    expected.length !== actual.length ||
    expected.some((id, index) => id !== actual[index])
  ) {
    throw new Error('合併範圍必須形成完整矩形，不能跨越未選取區域');
  }

  const occupied = selected.filter(cell => !isEmptyContent(cell.content));
  if (occupied.length > 1 && strategy === 'requireDecision') {
    return { status: 'needsDecision', occupiedCells: occupied };
  }

  let content: Frame360CellContent = { kind: 'empty' };
  if (occupied.length > 0) {
    if (strategy === 'keepLast') content = occupied[occupied.length - 1].content;
    else if (strategy === 'keepAll') {
      content = {
        kind: 'container',
        childTemplateId: undefined,
      };
    } else {
      content = occupied[0].content;
    }
  }

  const mergedCell: Frame360DataCell = {
    id: `merged-${rect.rowStart}-${rect.columnStart}-${rect.rowSpan}x${rect.columnSpan}`,
    targetNodeId: selected[0].targetNodeId,
    nodeLabel: selected[0].nodeLabel,
    ...rect,
    baseCellIds: expected,
    content,
    style: { ...selected[0].style },
  };

  const selectedSet = new Set(uniqueIds);
  return {
    status: 'merged',
    mergedCell,
    grid: {
      ...grid,
      dataCells: [
        ...grid.dataCells.filter(cell => !selectedSet.has(cell.id)),
        mergedCell,
      ],
    },
  };
}

export function splitFrame360Cell(
  grid: Frame360Grid,
  dataCellId: string,
): Frame360Grid {
  const target = grid.dataCells.find(cell => cell.id === dataCellId);
  if (!target) throw new Error(`找不到資料格：${dataCellId}`);
  if (target.baseCellIds.length === 1) return grid;

  const restored = target.baseCellIds.map(baseId => {
    const base = grid.baseCells.find(cell => cell.id === baseId);
    if (!base) throw new Error(`找不到基礎格：${baseId}`);
    return {
      id: `cell-${base.id}`,
      rowStart: base.row,
      columnStart: base.column,
      rowSpan: 1,
      columnSpan: 1,
      baseCellIds: [base.id],
      content: { kind: 'empty' } as Frame360CellContent,
      style: { ...DEFAULT_FRAME360_STYLE },
    };
  });

  return {
    ...grid,
    dataCells: [
      ...grid.dataCells.filter(cell => cell.id !== dataCellId),
      ...restored,
    ],
  };
}
