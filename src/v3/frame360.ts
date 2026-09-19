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

export type Frame360CellStyle = {
  alignment: Frame360Alignment;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  opacity?: number;
  padding?: number;
  fontSize?: number;
  fontWeight?: '400' | '600' | '700' | '800' | '900';
};

export type Frame360CellContent =
  | { kind: 'empty' }
  | { kind: 'text'; text: string }
  | { kind: 'data'; binding: string; label?: string }
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
  rowStart: number;
  columnStart: number;
  rowSpan: number;
  columnSpan: number;
  baseCellIds: string[];
  content: Frame360CellContent;
  style: Frame360CellStyle;
};

export type Frame360Grid = {
  rows: number;
  columns: number;
  baseCells: Frame360BaseCell[];
  dataCells: Frame360DataCell[];
};

export type Frame360Template = {
  id: string;
  surface: Frame360Surface;
  templateKey: string;
  name: string;
  version: number;
  grid: Frame360Grid;
  updatedAt: number;
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
