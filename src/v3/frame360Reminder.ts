import type {
  Frame360CellContent,
  Frame360DataCell,
  Frame360ReminderSource,
} from './frame360';
import { FRAME360_REMINDERS } from './frame360Registry';

export type Frame360ReminderContext = {
  today: string;
  dividendDate?: string;
  exDividendDate?: string;
  lastBuyDate?: string;
  payDate?: string;
};

export type Frame360ReminderRender = {
  visible: boolean;
  text?: string;
  source?: Frame360ReminderSource;
};

const sameDay = (a?: string, b?: string) => Boolean(a && b && a === b);

export function isFrame360ReminderActive(
  source: Frame360ReminderSource,
  context: Frame360ReminderContext,
): boolean {
  switch (source) {
    case 'dividendToday':
      return sameDay(context.today, context.dividendDate);
    case 'exDividendToday':
      return sameDay(context.today, context.exDividendDate);
    case 'lastBuyToday':
      return sameDay(context.today, context.lastBuyDate);
    case 'payDateToday':
      return sameDay(context.today, context.payDate);
    default:
      return false;
  }
}

export function resolveFrame360Reminder(
  content: Extract<Frame360CellContent, { kind: 'reminder' }>,
  context: Frame360ReminderContext,
): Frame360ReminderRender {
  if (!isFrame360ReminderActive(content.source, context)) {
    return { visible: false };
  }

  const preset = FRAME360_REMINDERS.find(item => item.source === content.source);
  return {
    visible: true,
    source: content.source,
    text: content.activeLabel || preset?.activeLabel || '［提醒］',
  };
}

export function resolveFrame360CellVisibility(
  cell: Frame360DataCell,
  context: Frame360ReminderContext,
): { visible: boolean; text?: string } {
  if (cell.content.kind !== 'reminder') {
    return { visible: true };
  }
  return resolveFrame360Reminder(cell.content, context);
}
