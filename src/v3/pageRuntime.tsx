import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import type { PageFieldKey } from './pageRegistry';
import type { V3Preferences } from './model';
import { useGlobal360 } from './components/Global360Context';

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
  const sorted = flatten(children).sort((a, b) => {
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
      ]}
    >
      {children}
      {editActive && global360.enabled ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`360 編輯 ${cardId}`}
          accessibilityHint="長按進入此區塊的 360 編輯器"
          delayLongPress={360}
          onPress={() => undefined}
          onLongPress={() => global360.openFrame(page, cardId, fields, cardId)}
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
    </View>
  );
}
