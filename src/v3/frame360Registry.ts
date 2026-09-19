import type {
  Frame360CellKind,
  Frame360ComponentKind,
  Frame360ReminderSource,
} from './frame360';

export type Frame360CellTypeDefinition = {
  kind: Frame360CellKind;
  label: string;
  description: string;
  opensEditor: boolean;
};

export const FRAME360_CELL_TYPES: Frame360CellTypeDefinition[] = [
  { kind: 'empty', label: '空白格', description: '保留格線，不顯示內容', opensEditor: false },
  { kind: 'text', label: '文字格', description: '顯示自訂文字', opensEditor: true },
  { kind: 'data', label: '資料格', description: '連接框架目前資料實例', opensEditor: true },
  { kind: 'image', label: '圖片格', description: '顯示圖片內容', opensEditor: true },
  { kind: 'icon', label: '圖示格', description: '顯示圖示內容', opensEditor: true },
  { kind: 'chart', label: '圖表格', description: '顯示圖表內容', opensEditor: true },
  { kind: 'reminder', label: '提醒格', description: '條件成立時才顯示提醒物件', opensEditor: true },
  { kind: 'component', label: '組件格', description: '放入完整功能組件', opensEditor: true },
  { kind: 'container', label: '容器格', description: '建立可巢狀的子框架', opensEditor: true },
];

export type Frame360ReminderDefinition = {
  source: Frame360ReminderSource;
  label: string;
  activeLabel: string;
};

export const FRAME360_REMINDERS: Frame360ReminderDefinition[] = [
  { source: 'dividendToday', label: '今日股息提醒', activeLabel: '［今日股息］' },
  { source: 'exDividendToday', label: '今日除息提醒', activeLabel: '［今日除息］' },
  { source: 'lastBuyToday', label: '最後買進日提醒', activeLabel: '［最後買進日］' },
  { source: 'payDateToday', label: '股息發放日提醒', activeLabel: '［今日發放］' },
];

export type Frame360ComponentDefinition = {
  kind: Frame360ComponentKind;
  label: string;
  description: string;
};

export const FRAME360_COMPONENTS: Frame360ComponentDefinition[] = [
  { kind: 'calendar', label: '月曆', description: '完整月曆小組件' },
  { kind: 'ticker', label: '跑馬燈', description: '可在資料格內顯示連續資訊' },
  { kind: 'summary', label: '摘要', description: '摘要型資訊組件' },
  { kind: 'list', label: '清單', description: '列表型資訊組件' },
  { kind: 'progress', label: '進度', description: '進度條或進度環組件' },
  { kind: 'status', label: '狀態', description: '狀態指示組件' },
];

export const frame360CellTypeLabel = (kind: Frame360CellKind) =>
  FRAME360_CELL_TYPES.find(item => item.kind === kind)?.label ?? '未知類型';

export const frame360ReminderLabel = (source: Frame360ReminderSource) =>
  FRAME360_REMINDERS.find(item => item.source === source)?.label ?? '未知提醒';

export const frame360ComponentLabel = (kind: Frame360ComponentKind) =>
  FRAME360_COMPONENTS.find(item => item.kind === kind)?.label ?? '未知組件';
