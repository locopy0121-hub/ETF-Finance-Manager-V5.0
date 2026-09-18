import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { PageFieldKey } from './pageRegistry';
import type { V3Preferences } from './model';

const QUOTE_FIELDS = new Set(['price', 'previousClose', 'open', 'high', 'low', 'volume', 'marketValue', 'changePct']);
const TODAY_FIELDS = new Set(['todayPnl', 'todayPnlPct']);
const TOTAL_PNL_FIELDS = new Set(['totalPnl', 'totalRoi', 'pricePnl', 'unrealizedPnl', 'cashUnrealizedPnl', 'realizedPnl', 'pnl', 'roi', 'cashPnl', 'cashRoi']);
const DIVIDEND_FIELDS = new Set(['cumulativeDividends', 'cumulativeDividend', 'pendingDividends', 'pendingDividend', 'yearReceived', 'yearExpected', 'monthlyAverage', 'nextPayDate', 'nextExDate', 'eligibleShares', 'costYield', 'eventCount', 'annualDividend']);

export function isGlobalFieldVisible(prefs: V3Preferences, key: string) {
  if ((key === 'nav' || key === 'premium') && !prefs.visibility.premium) return false;
  if (QUOTE_FIELDS.has(key) && !prefs.visibility.liveQuote) return false;
  if (TODAY_FIELDS.has(key) && !prefs.visibility.todayPnl) return false;
  if (TOTAL_PNL_FIELDS.has(key) && !prefs.visibility.totalPnl) return false;
  if (DIVIDEND_FIELDS.has(key) && !prefs.visibility.dividends) return false;
  if (key === 'updatedAt' && !prefs.visibility.updatedAt) return false;
  return true;
}

export function pageFieldEnabled(prefs: V3Preferences, page: PageFieldKey, key: string) {
  const selected = prefs.pageCardFields?.[page] ?? [];
  return selected.includes(key) && isGlobalFieldVisible(prefs, key);
}

export function pageCardVisible(prefs: V3Preferences, page: PageFieldKey, cardId: string) {
  const card = prefs.pageLayouts?.[page]?.cards?.find(item => item.id === cardId);
  return card ? !card.hidden : true;
}

export function pageCardOrder(prefs: V3Preferences, page: PageFieldKey, cardId: string, fallback = 999) {
  const cards = [...(prefs.pageLayouts?.[page]?.cards ?? [])].sort((a, b) => a.y - b.y || a.x - b.x);
  const index = cards.findIndex(item => item.id === cardId);
  return index >= 0 ? index : fallback;
}

export function PageFrame({
  prefs,
  page,
  cardId,
  children,
  style,
  fallbackOrder,
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
  const card = prefs.pageLayouts?.[page]?.cards?.find(item => item.id === cardId);
  const opacity = Math.max(0.35, Math.min(1, Number(card?.style?.backgroundOpacity ?? 100) / 100));
  return (
    <View
      style={[
        {
          order: pageCardOrder(prefs, page, cardId, fallbackOrder),
          opacity,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
