import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Polygon, Polyline, Rect } from 'react-native-svg';

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
import { resolveFrame360RuleColor, type ProfitLossColors } from '../frame360Color';

type Props = {
  template: Frame360Template;
  data: Record<string, unknown>;
  reminderContext: Frame360ReminderContext;
  minHeight?: number;
  profitLossColors?: ProfitLossColors;
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
  value: unknown,
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

function resolveDataValue(cell: Frame360DataCell, data: Props['data']) {
  if (cell.content.kind !== 'data') return undefined;
  return cell.content.formula
    ? evaluateFormula(cell.content.formula, data)
    : data[cell.content.binding];
}

function numericSeries(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      if (typeof item === 'number') return item;
      if (item && typeof item === 'object' && 'value' in item) {
        return Number((item as { value?: unknown }).value);
      }
      return Number(item);
    })
    .filter(item => Number.isFinite(item));
}

function MiniChart({
  type,
  values,
  color,
}: {
  type: string;
  values: number[];
  color: string;
}) {
  if (values.length < 2) {
    return <Text style={styles.placeholder}>尚無可繪製的圖表資料</Text>;
  }
  const width = 180;
  const height = 72;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.0001, max - min);
  const points = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 8) - 4;
    return { x, y };
  });
  const pointText = points.map(point => `${point.x},${point.y}`).join(' ');
  if (type === 'bar') {
    const barWidth = width / values.length;
    return (
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {points.map((point, index) => (
          <Rect
            key={index}
            x={index * barWidth + 1}
            y={point.y}
            width={Math.max(1, barWidth - 2)}
            height={Math.max(1, height - point.y)}
            fill={color}
          />
        ))}
      </Svg>
    );
  }
  if (type === 'area') {
    const areaPoints = `0,${height} ${pointText} ${width},${height}`;
    return (
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Polygon points={areaPoints} fill={color} opacity={0.18} />
        <Polyline points={pointText} fill="none" stroke={color} strokeWidth={2} />
      </Svg>
    );
  }
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Polyline points={pointText} fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

function CellContent({
  cell,
  data,
  reminderContext,
  profitLossColors,
}: {
  cell: Frame360DataCell;
  data: Props['data'];
  reminderContext: Frame360ReminderContext;
  profitLossColors: ProfitLossColors;
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
    const color = resolveFrame360RuleColor(
      cell.style.textColorRule ?? content.colorRule ?? 'auto',
      raw,
      cell.style.textColor,
      'text',
      profitLossColors,
    );
    const textBackgroundColor = resolveFrame360RuleColor(
      cell.style.textBackgroundColorRule,
      raw,
      cell.style.textBackgroundColor,
      'background',
      profitLossColors,
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
    const primaryBinding = content.yBindings?.[0] ?? content.binding;
    const values = numericSeries(data[primaryBinding]);
    return (
      <View style={styles.chartBox}>
        <MiniChart
          type={content.chartType}
          values={values}
          color={cell.style.textColor ?? '#0066FF'}
        />
      </View>
    );
  }
  if (content.kind === 'image') {
    if (!content.uri) return <Text style={styles.placeholder}>尚未選擇圖片</Text>;
    const resizeMode =
      content.fit === 'original'
        ? 'center'
        : content.fit === 'repeat'
          ? 'repeat'
          : content.fit ?? 'cover';
    return (
      <Image
        source={{ uri: content.uri }}
        resizeMode={resizeMode as any}
        style={[
          styles.contentImage,
          {
            opacity: (content.opacity ?? 100) / 100,
            transform: [
              { translateX: content.x ?? 0 },
              { translateY: content.y ?? 0 },
              { scale: content.scale ?? 1 },
              { rotate: `${content.rotation ?? 0}deg` },
            ],
          },
        ]}
      />
    );
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

  const backgroundUri = cell.style.backgroundImageUri;
  const backgroundFit = cell.style.backgroundImageFit ?? 'cover';
  const resizeMode =
    backgroundFit === 'original'
      ? 'center'
      : backgroundFit === 'repeat'
        ? 'repeat'
        : backgroundFit;
  return (
    <Animated.View style={[styles.cell, style, animatedStyle]}>
      {backgroundUri ? (
        <Image
          source={{ uri: backgroundUri }}
          resizeMode={resizeMode as any}
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: (cell.style.backgroundImageOpacity ?? 100) / 100,
              transform: [
                { translateX: cell.style.backgroundImageX ?? 0 },
                { translateY: cell.style.backgroundImageY ?? 0 },
                { scale: cell.style.backgroundImageScale ?? 1 },
                { rotate: `${cell.style.backgroundImageRotation ?? 0}deg` },
              ],
            },
          ]}
        />
      ) : null}
      {cell.style.backgroundOverlayColor && (cell.style.backgroundOverlayOpacity ?? 0) > 0 ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: cell.style.backgroundOverlayColor,
              opacity: (cell.style.backgroundOverlayOpacity ?? 0) / 100,
            },
          ]}
        />
      ) : null}
      {children}
    </Animated.View>
  );
}

export default function Frame360Runtime({
  template,
  data,
  reminderContext,
  minHeight = 92,
  profitLossColors = {
    positive: '#EF4444',
    negative: '#10B981',
    neutral: '#CA8A04',
  },
}: Props) {
  const cells = useMemo(
    () => template.blocks
      .filter(cell => cell.content.kind !== 'empty' || Boolean(cell.targetNodeId))
      .slice()
      .sort((a, b) => {
        const z = (a.layout?.zIndex ?? 0) - (b.layout?.zIndex ?? 0);
        if (z !== 0) return z;
        return a.id.localeCompare(b.id);
      }),
    [template],
  );

  return (
    <View style={[styles.root, { minHeight }]}>
      {cells.map(cell => {
        if (cell.style.visible === false) return null;
        const left = cell.layout?.x ?? 0;
        const top = cell.layout?.y ?? 0;
        const width = cell.layout?.width ?? 20;
        const height = ((cell.layout?.height ?? 12) / 100) * minHeight;
        const rawForColor = resolveDataValue(cell, data);
        const backgroundColor = resolveFrame360RuleColor(
          cell.style.backgroundColorRule,
          rawForColor,
          cell.style.backgroundColor,
          'background',
          profitLossColors,
        );
        const borderColor = resolveFrame360RuleColor(
          cell.style.borderColorRule,
          rawForColor,
          cell.style.borderColor,
          'border',
          profitLossColors,
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
              top: `${top}%`,
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
              profitLossColors={profitLossColors}
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
  chartBox: { width: '100%', minHeight: 72, justifyContent: 'center' },
  contentImage: { width: '100%', height: '100%' },
});
