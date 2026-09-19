import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { PageFieldKey } from './pageRegistry';
import type { V3Preferences } from './model';
import { useGlobal360, type Global360NodeDescriptor } from './components/Global360Context';
import type { Frame360Template } from './frame360';
import Frame360Runtime from './components/Frame360Runtime';

const QUOTE_FIELDS = new Set(['price', 'previousClose', 'open', 'high', 'low', 'volume', 'marketValue', 'changePct']);
const TODAY_FIELDS = new Set(['todayPnl', 'todayPnlPct']);
const TOTAL_PNL_FIELDS = new Set(['totalPnl', 'totalRoi', 'pricePnl', 'unrealizedPnl', 'cashUnrealizedPnl', 'realizedPnl', 'pnl', 'roi', 'cashPnl', 'cashRoi']);
const DIVIDEND_FIELDS = new Set(['cumulativeDividends', 'cumulativeDividend', 'pendingDividends', 'pendingDividend', 'yearReceived', 'yearExpected', 'monthlyAverage', 'nextPayDate', 'nextExDate', 'eligibleShares', 'costYield', 'eventCount', 'annualDividend']);

export function isGlobalFieldVisible(prefs: V3Preferences, key: string) {
  if (key === 'nav' && !prefs.visibility.nav) return false;
  if (key === 'premium' && !prefs.visibility.premium) return false;
  if (QUOTE_FIELDS.has(key) && !prefs.visibility.liveQuote) return false;
  if (TODAY_FIELDS.has(key) && !prefs.visibility.todayPnl) return false;
  if (TOTAL_PNL_FIELDS.has(key) && !prefs.visibility.totalPnl) return false;
  if (DIVIDEND_FIELDS.has(key) && !prefs.visibility.dividends) return false;
  if (key === 'updatedAt' && !prefs.visibility.updatedAt) return false;
  return true;
}

export function pageFieldsForFrame(
  prefs: V3Preferences,
  page: PageFieldKey,
  cardId?: string,
) {
  const card = cardId
    ? prefs.pageLayouts?.[page]?.cards?.find(item => item.id === cardId)
    : undefined;
  const selected = card?.fields ?? prefs.pageCardFields?.[page] ?? [];
  return selected.filter(key => isGlobalFieldVisible(prefs, key));
}

export function pageFieldEnabled(
  prefs: V3Preferences,
  page: PageFieldKey,
  key: string,
  cardId?: string,
) {
  return pageFieldsForFrame(prefs, page, cardId).includes(key);
}

export function pageCardVisible(prefs: V3Preferences, page: PageFieldKey, cardId: string) {
  const card = prefs.pageLayouts?.[page]?.cards?.find(item => item.id === cardId);
  return card ? !card.hidden : true;
}

export function pageCardOrder(prefs: V3Preferences, page: PageFieldKey, cardId: string, fallback = 999) {
  const cards = prefs.pageLayouts?.[page]?.cards ?? [];
  const index = cards.findIndex(item => item.id === cardId);
  return index >= 0 ? index : fallback;
}

function describeVisibleNodes(
  nodes: React.ReactNode,
  prefix = 'node',
  output: Global360NodeDescriptor[] = [],
) {
  React.Children.forEach(nodes, (node, index) => {
    if (!React.isValidElement(node) || output.length >= 40) return;
    const id = `${prefix}.${index}`;
    const props = node.props as { children?: React.ReactNode };
    const directText = React.Children.toArray(props.children)
      .filter(item => typeof item === 'string' || typeof item === 'number')
      .join(' ')
      .trim();
    if (directText) {
      output.push({
        id,
        label: directText.slice(0, 48),
        kind: 'text',
      });
    } else if (node.type !== React.Fragment) {
      const componentType = node.type as any;
      const rawName =
        typeof node.type === 'function'
          ? componentType.displayName || componentType.name || ''
          : typeof node.type === 'string'
            ? node.type
            : '';
      if (rawName && rawName !== 'View' && rawName !== 'Text') {
        output.push({
          id,
          label: rawName.slice(0, 48),
          kind: 'component',
        });
      }
    }
    if (props.children) describeVisibleNodes(props.children, id, output);
  });
  return output;
}

function nodeOverrideStyle(
  template: Frame360Template | undefined,
  nodeId: string,
  isText: boolean,
): any {
  const cell = template?.grid.dataCells.find(item => item.targetNodeId === nodeId);
  if (!cell) return undefined;
  const style = cell.style;
  const horizontal =
    style.alignment.includes('Right')
      ? 'right'
      : style.alignment.includes('Left')
        ? 'left'
        : 'center';
  const vertical =
    style.alignment.startsWith('top')
      ? 'flex-start'
      : style.alignment.startsWith('bottom')
        ? 'flex-end'
        : 'center';
  return {
    display: style.visible === false ? 'none' : undefined,
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    borderWidth: style.borderWidth,
    borderRadius: style.radius,
    opacity: style.opacity == null ? undefined : style.opacity / 100,
    padding: style.padding,
    margin: style.margin,
    shadowOpacity: style.shadowOpacity,
    shadowRadius: style.shadowRadius,
    elevation: style.elevation,
    ...(isText
      ? {
          color: style.textColor,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          letterSpacing: style.letterSpacing,
          lineHeight: style.lineHeight,
          textAlign: horizontal,
        }
      : {
          alignItems:
            horizontal === 'left'
              ? 'flex-start'
              : horizontal === 'right'
                ? 'flex-end'
                : 'center',
          justifyContent: vertical,
        }),
  };
}

function applyGlobal360NodeStyles(
  nodes: React.ReactNode,
  template: Frame360Template | undefined,
  prefix = 'node',
): React.ReactNode {
  return React.Children.map(nodes, (node, index) => {
    if (!React.isValidElement(node)) return node;
    const id = `${prefix}.${index}`;
    const props = node.props as { children?: React.ReactNode; style?: unknown };
    const nextChildren = props.children
      ? applyGlobal360NodeStyles(props.children, template, id)
      : props.children;
    const override = nodeOverrideStyle(template, id, node.type === Text);
    return React.cloneElement(node as React.ReactElement<any>, {
      ...props,
      style: override ? [props.style, override] : props.style,
      children: nextChildren,
    });
  });
}

function UserCreatedPageFrame({
  prefs,
  page,
  cardId,
  title,
}: {
  prefs: V3Preferences;
  page: PageFieldKey;
  cardId: string;
  title: string;
}) {
  const global360 = useGlobal360();
  const template = global360.resolveTemplate(page, cardId);
  return (
    <PageFrame prefs={prefs} page={page} cardId={cardId}>
      <View
        style={{
          minHeight: 112,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#E2E8F0',
          backgroundColor: '#FFFFFF',
          padding: 12,
          overflow: 'hidden',
        }}
      >
        {template && template.grid.dataCells.length ? (
          <Frame360Runtime
            template={template}
            data={{}}
            reminderContext={{ today: '' }}
            minHeight={88}
          />
        ) : (
          <>
            <Text style={{ color: '#0F172A', fontSize: 12, fontWeight: '900' }}>{title}</Text>
            <Text style={{ marginTop: 6, color: '#64748B', fontSize: 10 }}>
              長按框架進入 360 編輯器，再使用「＋新增方塊」建立內容。
            </Text>
          </>
        )}
      </View>
    </PageFrame>
  );
}

export function PageAddedFrames({
  prefs,
  page,
}: {
  prefs: V3Preferences;
  page: PageFieldKey;
}) {
  return (
    <>
      {(prefs.pageLayouts?.[page]?.cards ?? [])
        .filter(card => card.kind === 'custom')
        .map(card => (
          <UserCreatedPageFrame
            key={card.id}
            prefs={prefs}
            page={page}
            cardId={card.id}
            title={card.title}
          />
        ))}
    </>
  );
}

export function PageFrameStack({
  prefs,
  page,
  children,
}: {
  prefs: V3Preferences;
  page: PageFieldKey;
  children: React.ReactNode;
}) {
  const rank = new Map(
    (prefs.pageLayouts?.[page]?.cards ?? []).map((card, index) => [card.id, index]),
  );
  const flatten = (nodes: React.ReactNode): React.ReactNode[] =>
    React.Children.toArray(nodes).flatMap(node => {
      if (React.isValidElement(node) && node.type === React.Fragment) {
        return flatten((node.props as { children?: React.ReactNode }).children);
      }
      return [node];
    });
  const flattened = flatten(children);
  const existingIds = new Set(
    flattened
      .filter(React.isValidElement)
      .map(node => String((node as React.ReactElement<{ cardId?: string }>).props.cardId ?? ''))
      .filter(Boolean),
  );
  const customFrames = (prefs.pageLayouts?.[page]?.cards ?? [])
    .filter(card => card.kind === 'custom' && !existingIds.has(card.id))
    .map(card => (
      <UserCreatedPageFrame
        key={card.id}
        prefs={prefs}
        page={page}
        cardId={card.id}
        title={card.title}
      />
    ));
  const sorted = [...flattened, ...customFrames].sort((a, b) => {
    const aId = React.isValidElement(a) ? String((a.props as { cardId?: string }).cardId ?? '') : '';
    const bId = React.isValidElement(b) ? String((b.props as { cardId?: string }).cardId ?? '') : '';
    return (rank.get(aId) ?? 999) - (rank.get(bId) ?? 999);
  });
  return <>{sorted}</>;
}

export function PageFrame({
  prefs,
  page,
  cardId,
  children,
  style,
  fallbackOrder: _fallbackOrder,
}: {
  prefs: V3Preferences;
  page: PageFieldKey;
  cardId: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fallbackOrder?: number;
}) {
  // Settings must remain recoverable even if its own frame is accidentally hidden.
  if (page !== 'settings' && !pageCardVisible(prefs, page, cardId)) return null;
  const editActive =
    prefs.globalEditMode || Boolean(prefs.monitoring?.pageCustomize?.[page]);
  const global360 = useGlobal360();
  const fields = pageFieldsForFrame(prefs, page, cardId);
  const visualNodes = describeVisibleNodes(children);
  const descriptors: Global360NodeDescriptor[] = [
    { id: 'frame:root', label: '框架本體', kind: 'container' as const },
    ...fields.map(key => ({
      id: `field:${key}`,
      label: key,
      binding: key,
      kind: 'data' as const,
    })),
    ...visualNodes.filter(
      node => !fields.some(key => node.label === key || node.id === `field:${key}`),
    ),
  ].slice(0, 40);
  const savedTemplate = global360.resolveTemplate(page, cardId);
  const renderedChildren = savedTemplate
    ? applyGlobal360NodeStyles(children, savedTemplate)
    : children;
  const frameOverride = nodeOverrideStyle(savedTemplate, 'frame:root', false);
  return (
    <View
      style={[
        editActive
          ? {
              borderWidth: 1.5,
              borderColor: '#0066FF',
              borderRadius: 16,
              padding: 2,
              position: 'relative',
            }
          : undefined,
        style,
        frameOverride,
      ]}
    >
      {renderedChildren}
      {editActive && global360.enabled ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`360 編輯 ${cardId}`}
          accessibilityHint="長按進入此區塊的 360 編輯器"
          delayLongPress={360}
          onPress={() => undefined}
          onLongPress={() => global360.openFrame(page, cardId, descriptors, cardId)}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: 999,
            borderRadius: 16,
            backgroundColor: 'rgba(0,102,255,0.025)',
          }}
        />
      ) : null}
      {editActive && global360.enabled && cardId === `${page}-header` ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`新增 ${page} 頁面框架`}
          onPress={() => global360.addPageFrame(page)}
          style={{
            position: 'absolute',
            right: 8,
            top: 8,
            zIndex: 1001,
            minHeight: 34,
            borderRadius: 999,
            backgroundColor: '#0066FF',
            paddingHorizontal: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>＋新增</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
