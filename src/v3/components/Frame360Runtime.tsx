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

function resolveRuleColor(
  rule: 'auto' | 'fixed' | 'theme' | 'pnl' | 'market' | undefined,
  value: string | number | undefined,
  fixed: string | undefined,
  surface: 'text' | 'background' | 'border' = 'text',
) {
  if (!rule || rule === 'fixed' || rule === 'auto') return fixed;
  if (rule === 'theme') return fixed ?? (surface === 'background' ? '#EFF6FF' : '#0066FF');
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fixed;
  if (surface === 'background') {
    if (numeric > 0) return '#FEE2E2';
    if (numeric < 0) return '#DCFCE7';
    return '#FEF9C3';
  }
  if (numeric > 0) return '#DC2626';
  if (numeric < 0) return '#16A34A';
  return '#CA8A04';
}

function resolveDataValue(cell: Frame360DataCell, data: Props['data']) {
  if (cell.content.kind !== 'data') return undefined;
  return cell.content.formula
    ? evaluateFormula(cell.content.formula, data)
    : data[cell.content.binding];
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
    backgroundColor: cell.style.textBackgroundColor ?? 'transparent',
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
    const raw = resolveDataValue(cell, data);
    const color = resolveRuleColor(
      content.colorRule ?? cell.style.textColorRule ?? 'auto',
      raw,
      cell.style.textColor,
      'text',
    );
    const textBackgroundColor = resolveRuleColor(
      cell.style.textBackgroundColorRule,
      raw,
      cell.style.textBackgroundColor,
      'background',
    );
    return (
      <View>
        {content.label ? (
          <Text style={[styles.dataLabel, textStyle, color ? { color } : null, textBackgroundColor ? { backgroundColor: textBackgroundColor } : null]}>
            {content.label}
          </Text>
        ) : null}
        <Text style={[styles.value, textStyle, color ? { color } : null, textBackgroundColor ? { backgroundColor: textBackgroundColor } : null]}>
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


function RuntimeCellSurface({
  cell,
  style,
  children,
}: {
  cell: Frame360DataCell;
  style: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const value = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const effect = cell.style.effect ?? 'none';
    value.stopAnimation();
    value.setValue(1);
    if (effect === 'none') return;

    const low =
      effect === 'blink'
        ? 0.15
        : effect === 'fade'
          ? 0.35
          : 0.65;
    const duration =
      effect === 'blink'
        ? 360
        : effect === 'jump'
          ? 520
          : 820;

    const loop = Animated.loop(
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
    loop.start();
    return () => loop.stop();
  }, [cell.style.effect, value]);

  const effect = cell.style.effect ?? 'none';
  const animatedStyle =
    effect === 'jump'
      ? {
          transform: [
            {
              translateY: value.interpolate({
                inputRange: [0, 1],
                outputRange: [-3, 0],
              }),
            },
          ],
        }
      : effect === 'pulse' || effect === 'breathe'
        ? {
            transform: [
              {
                scale: value.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.97, 1],
                }),
              },
            ],
            opacity: value,
          }
        : effect === 'none'
          ? undefined
          : { opacity: value };

  return (
    <Animated.View style={[styles.cell, style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

export default function Frame360Runtime({
  template,
  data,
  reminderContext,
  minHeight = 92,
}: Props) {
  const rowHeight = minHeight / template.grid.rows;
  const cells = useMemo(
    () => template.grid.dataCells
      .filter(cell => cell.content.kind !== 'empty' || Boolean(cell.targetNodeId))
      .slice()
      .sort((a, b) => {
        const z = (a.layout?.zIndex ?? 0) - (b.layout?.zIndex ?? 0);
        if (z !== 0) return z;
        return a.rowStart === b.rowStart
          ? a.columnStart - b.columnStart
          : a.rowStart - b.rowStart;
      }),
    [template],
  );

  return (
    <View style={[styles.root, { minHeight }]}>
      {cells.map(cell => {
        if (cell.style.visible === false) return null;
        const free = cell.layout?.mode === 'free';
        const left = free && cell.layout?.x != null
          ? cell.layout.x
          : ((cell.columnStart - 1) / template.grid.columns) * 100;
        const top = free && cell.layout?.y != null
          ? cell.layout.y
          : ((cell.rowStart - 1) / template.grid.rows) * 100;
        const width = free && cell.layout?.width != null
          ? cell.layout.width
          : (cell.columnSpan / template.grid.columns) * 100;
        const height = free && cell.layout?.height != null
          ? (cell.layout.height / 100) * minHeight
          : rowHeight * cell.rowSpan;
        const rawForColor = resolveDataValue(cell, data);
        const backgroundColor = resolveRuleColor(
          cell.style.backgroundColorRule,
          rawForColor,
          cell.style.backgroundColor,
          'background',
        );
        const borderColor = resolveRuleColor(
          cell.style.borderColorRule,
          rawForColor,
          cell.style.borderColor,
          'border',
        );
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
          <RuntimeCellSurface
            key={cell.id}
            cell={cell}
            style={{
              left: `${left}%`,
              top: free ? `${top}%` : `${top}%`,
              width: `${width}%`,
              zIndex: cell.layout?.zIndex ?? 0,
              height,
              alignItems: align,
              justifyContent: justify,
              padding: cell.style.padding ?? 8,
              margin: cell.style.margin ?? 0,
              borderRadius: cell.style.radius ?? 8,
              opacity: (cell.style.opacity ?? 100) / 100,
              backgroundColor: backgroundColor ?? 'transparent',
              borderColor: borderColor ?? 'transparent',
              borderWidth: cell.style.borderWidth ?? 0,
              shadowOpacity: cell.style.shadowOpacity ?? 0,
              shadowRadius: cell.style.shadowRadius ?? 0,
              elevation: cell.style.elevation ?? 0,
            }}
          >
            <CellContent
              cell={cell}
              data={data}
              reminderContext={reminderContext}
            />
          </RuntimeCellSurface>
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
