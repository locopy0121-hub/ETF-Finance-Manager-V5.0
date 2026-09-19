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
