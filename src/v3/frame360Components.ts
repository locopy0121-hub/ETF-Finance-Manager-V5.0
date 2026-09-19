import type {
  Frame360ComponentKind,
  Frame360DataCell,
} from './frame360';

export type Frame360ComponentInstance = {
  id: string;
  kind: Frame360ComponentKind;
  parentCellId: string;
  settings: Record<string, unknown>;
};

export const FRAME360_COMPONENT_DEFAULTS: Record<
  Frame360ComponentKind,
  Record<string, unknown>
> = {
  calendar: {
    followTheme: true,
    showMonthTitle: true,
    showWeekdays: true,
    showDividendEvents: true,
  },
  ticker: {
    direction: 'left',
    speedSeconds: 4,
    pauseSeconds: 1,
  },
  summary: {
    density: 'standard',
  },
  list: {
    density: 'standard',
  },
  progress: {
    showPercent: true,
  },
  status: {
    showIcon: true,
  },
};

export function createFrame360ComponentInstance(
  cell: Frame360DataCell,
  instanceId: string,
): Frame360ComponentInstance {
  if (cell.content.kind !== 'component') {
    throw new Error('只有組件格可以建立組件實例');
  }

  return {
    id: instanceId,
    kind: cell.content.component,
    parentCellId: cell.id,
    settings: {
      ...FRAME360_COMPONENT_DEFAULTS[cell.content.component],
      ...(cell.content.config ?? {}),
    },
  };
}

export function updateFrame360ComponentInstance(
  instance: Frame360ComponentInstance,
  patch: Record<string, unknown>,
): Frame360ComponentInstance {
  return {
    ...instance,
    settings: {
      ...instance.settings,
      ...patch,
    },
  };
}
