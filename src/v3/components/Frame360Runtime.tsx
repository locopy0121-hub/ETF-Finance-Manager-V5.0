import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {
  Frame360DataCell,
  Frame360Effect,
  Frame360Template,
} from '../frame360';
import {
  resolveFrame360CellVisibility,
  type Frame360ReminderContext,
} from '../frame360Reminder';
import { frame360ComponentLabel } from '../frame360Registry';

type Props = {
  template: Frame360Template;
  data: Record<string, string | number | undefined>;
  reminderContext: Frame360ReminderContext;
  minHeight?: number;
};

function ReminderObject({
  text,
  effect,
}: {
  text: string;
  effect: Frame360Effect;
}) {
  const value = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (effect === 'none') {
      value.setValue(1);
      return;
    }
    const low = effect === 'blink' ? 0.2 : 0.55;
    const duration = effect === 'blink' ? 420 : 850;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: low,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [effect, value]);

  return (
    <Animated.View
      style={[
        styles.reminderPill,
        effect !== 'none' ? { opacity: value } : null,
      ]}
    >
      <Text style={styles.reminderText}>{text}</Text>
    </Animated.View>
  );
}

function evaluateFormula(
  formula: string,
  data: Props['data'],
): number | undefined {
  const expression = formula.replace(/\b[A-Za-z_][A-Za-z0-9_]*\b/g, token => {
    const value = Number(data[token]);
    return Number.isFinite(value) ? String(value) : '0';
  });
  if (!/^[0-9+\-*/().\s]+$/.test(expression)) return undefined;
  try {
    const value = Function(`"use strict"; return (${expression});`)();
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function formatDataValue(
  value: string | number | undefined,
  format: 'text' | 'number' | 'currency' | 'percent' = 'text',
) {
  if (value === undefined) return '—';
  if (format === 'text') return String(value);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  if (format === 'percent') return `${numeric.toFixed(2)}%`;
  return numeric.toLocaleString('zh-TW', {
    maximumFractionDigits: format === 'currency' ? 0 : 4,
  });
}

function resolveDataColor(
  cell: Frame360DataCell,
  value: string | number | undefined,
) {
  if (cell.content.kind !== 'data') return cell.style.textColor;
  const rule = cell.content.colorRule ?? 'auto';
  if (rule === 'fixed') return cell.style.textColor;
  if (rule === 'pnl' || rule === 'market') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      if (numeric > 0) return '#DC2626';
      if (numeric < 0) return '#16A34A';
      return '#CA8A04';
    }
  }
  return cell.style.textColor;
}

function CellContent({
  cell,
  data,
  reminderContext,
}: {
  cell: Frame360DataCell;
  data: Props['data'];
  reminderContext: Frame360ReminderContext;
}) {
  const visibility = resolveFrame360CellVisibility(cell, reminderContext);
  if (!visibility.visible) return null;

  const content = cell.content;
  if (content.kind === 'empty') return null;
  const textStyle = {
    color: cell.style.textColor ?? '#0F172A',
    fontSize: cell.style.fontSize ?? 12,
    fontWeight: cell.style.fontWeight ?? '700',
    letterSpacing: cell.style.letterSpacing ?? 0,
    lineHeight: cell.style.lineHeight,
    textAlign: (
      cell.style.alignment.includes('Right')
        ? 'right'
        : cell.style.alignment.includes('Left')
          ? 'left'
          : 'center'
    ) as 'left' | 'center' | 'right',
  };

  if (content.kind === 'text') {
    return <Text style={[styles.value, textStyle]}>{content.text}</Text>;
  }
  if (content.kind === 'data') {
    const raw = content.formula
      ? evaluateFormula(content.formula, data)
      : data[content.binding];
    const color = resolveDataColor(cell, raw);
    return (
      <View>
        {content.label ? (
          <Text style={[styles.dataLabel, textStyle, color ? { color } : null]}>
            {content.label}
          </Text>
        ) : null}
        <Text style={[styles.value, textStyle, color ? { color } : null]}>
          {formatDataValue(raw, content.format)}
        </Text>
      </View>
    );
  }
  if (content.kind === 'reminder') {
    return (
      <ReminderObject
        text={visibility.text ?? content.activeLabel}
        effect={content.effect}
      />
    );
  }
  if (content.kind === 'component') {
    return (
      <View style={styles.componentPill}>
        <Text style={styles.componentText}>
          {frame360ComponentLabel(content.component)}
        </Text>
      </View>
    );
  }
  if (content.kind === 'icon') {
    return <Text style={styles.value}>{content.icon}</Text>;
  }
  if (content.kind === 'chart') {
    return <Text style={styles.placeholder}>圖表</Text>;
  }
  if (content.kind === 'image') {
    return <Text style={styles.placeholder}>圖片</Text>;
  }
  if (content.kind === 'container') {
    return <Text style={styles.placeholder}>子框架</Text>;
  }
  return null;
}

export default function Frame360Runtime({
  template,
  data,
  reminderContext,
  minHeight = 92,
}: Props) {
  const rowHeight = minHeight / template.grid.rows;
  const cells = useMemo(
    () => [...template.grid.dataCells].sort((a, b) =>
      a.rowStart === b.rowStart
        ? a.columnStart - b.columnStart
        : a.rowStart - b.rowStart,
    ),
    [template],
  );

  return (
    <View style={[styles.root, { minHeight }]}>
      {cells.map(cell => {
        if (cell.style.visible === false) return null;
        const left = ((cell.columnStart - 1) / template.grid.columns) * 100;
        const top = ((cell.rowStart - 1) / template.grid.rows) * 100;
        const width = (cell.columnSpan / template.grid.columns) * 100;
        const height = rowHeight * cell.rowSpan;
        const align =
          cell.style.alignment.includes('Right')
            ? 'flex-end'
            : cell.style.alignment.includes('Left')
              ? 'flex-start'
              : 'center';
        const justify =
          cell.style.alignment.startsWith('top')
            ? 'flex-start'
            : cell.style.alignment.startsWith('bottom')
              ? 'flex-end'
              : 'center';

        return (
          <View
            key={cell.id}
            style={[
              styles.cell,
              {
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height,
                alignItems: align,
                justifyContent: justify,
                padding: cell.style.padding ?? 8,
                margin: cell.style.margin ?? 0,
                borderRadius: cell.style.radius ?? 8,
                opacity: (cell.style.opacity ?? 100) / 100,
                backgroundColor: cell.style.backgroundColor ?? 'transparent',
                borderColor: cell.style.borderColor ?? 'transparent',
                borderWidth: cell.style.borderWidth ?? 0,
                shadowOpacity: cell.style.shadowOpacity ?? 0,
                shadowRadius: cell.style.shadowRadius ?? 0,
                elevation: cell.style.elevation ?? 0,
              },
            ]}
          >
            <CellContent
              cell={cell}
              data={data}
              reminderContext={reminderContext}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    width: '100%',
  },
  cell: {
    position: 'absolute',
    justifyContent: 'center',
  },
  value: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  dataLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 2,
  },
  reminderPill: {
    borderRadius: 999,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reminderText: {
    color: '#C2410C',
    fontSize: 9,
    fontWeight: '900',
  },
  componentPill: {
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  componentText: {
    color: '#0066FF',
    fontSize: 9,
    fontWeight: '800',
  },
  placeholder: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },
});
