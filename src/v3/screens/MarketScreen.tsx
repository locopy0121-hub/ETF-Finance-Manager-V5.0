import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { calculateHoldingView } from '../engine';
import { PageFrame, pageFieldEnabled } from '../pageRuntime';
import { V3_THEME, resolvePnlTone } from '../theme';
import { scaledFont } from '../blueprintB';
import type { ScreenCommon } from '../screensBase';

type MarketScreenProps = {
  common: ScreenCommon;
  onSettings: () => void;
  onOpenHolding?: (symbol: string) => void;
};

const money = (value: number) =>
  Math.round(Number.isFinite(value) ? value : 0).toLocaleString('zh-TW');

export function MarketScreen({ common, onSettings, onOpenHolding }: MarketScreenProps) {
  const { prefs, holdings, quotes, ledger, dividends } = common;
  const symbols = prefs.watchlistSymbols.length
    ? prefs.watchlistSymbols
    : Array.from(new Set([...holdings.map(item => item.symbol), ...Object.keys(quotes)]));

  const rows = useMemo(
    () =>
      symbols
        .map(symbol => {
          const holding = holdings.find(item => item.symbol === symbol);
          const quote = quotes[symbol] ?? {};
          const view = holding
            ? calculateHoldingView(holding, quotes, ledger, dividends)
            : undefined;
          const price = Number(view?.price ?? quote.price ?? 0);
          const previousClose = Number(view?.previousClose ?? quote.previousClose ?? price);
          const changePct = Number(
            quote.changePercent ??
              (previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0),
          );
          return {
            symbol,
            name: holding?.name ?? String((quote as any).name ?? symbol),
            price,
            changePct: Number.isFinite(changePct) ? changePct : 0,
            volume: Number(view?.volume ?? quote.volume ?? 0),
            marketValue: Number(view?.marketValue ?? 0),
          };
        })
        .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)),
    [symbols.join('|'), holdings, quotes, ledger, dividends],
  );

  const showSymbol = pageFieldEnabled(prefs, 'market', 'symbol', 'market-main');
  const showPrice = pageFieldEnabled(prefs, 'market', 'price', 'market-main');
  const showChange = pageFieldEnabled(prefs, 'market', 'changePct', 'market-main');
  const showVolume = pageFieldEnabled(prefs, 'market', 'volume', 'market-main');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>MARKET</Text>
          <Text style={[styles.title, { fontSize: scaledFont(24, prefs) }]}>市場總覽</Text>
          <Text style={styles.subtitle}>觀察清單與目前持股的即時行情</Text>
        </View>
        <Pressable onPress={onSettings} style={styles.gear}>
          <Text style={styles.gearText}>⚙</Text>
        </Pressable>
      </View>

      <PageFrame prefs={prefs} page="market" cardId="market-main">
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>市場焦點</Text>
            <Text style={styles.cardMeta}>{rows.length} 檔</Text>
          </View>
          {rows.length ? rows.map(row => {
            const tone = resolvePnlTone(row.changePct, 'TW');
            return (
              <Pressable
                key={row.symbol}
                onPress={() => onOpenHolding?.(row.symbol)}
                style={styles.row}
              >
                {showSymbol ? (
                  <View style={styles.symbolPill}>
                    <Text style={styles.symbolText}>{row.symbol}</Text>
                  </View>
                ) : null}
                <View style={styles.identity}>
                  <Text style={styles.name}>{row.name}</Text>
                  {showVolume ? (
                    <Text style={styles.muted}>
                      成交量 {row.volume > 0 ? row.volume.toLocaleString() : '—'}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.values}>
                  {showPrice ? (
                    <Text style={styles.price}>{row.price > 0 ? row.price.toFixed(2) : '—'}</Text>
                  ) : null}
                  {showChange ? (
                    <Text style={[styles.change, { color: tone.foreground }]}>
                      {row.changePct > 0 ? '+' : ''}{row.changePct.toFixed(2)}%
                    </Text>
                  ) : null}
                  {row.marketValue > 0 && prefs.visibility.liveQuote ? (
                    <Text style={styles.muted}>{money(row.marketValue)}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }) : (
            <Text style={styles.empty}>尚無可顯示的行情資料。</Text>
          )}
        </View>
      </PageFrame>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: V3_THEME.colors.background },
  content: { padding: 18, paddingBottom: 36, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow: { color: V3_THEME.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 4, color: V3_THEME.colors.textPrimary, fontWeight: '900' },
  subtitle: { marginTop: 5, color: V3_THEME.colors.textSecondary, fontSize: 11 },
  gear: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: V3_THEME.colors.borderGlow, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  gearText: { color: V3_THEME.colors.primary, fontSize: 17 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', padding: 14, ...V3_THEME.shadow },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { ...V3_THEME.typography.cardTitle },
  cardMeta: { color: V3_THEME.colors.textSecondary, fontSize: 10, fontWeight: '700' },
  row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0', paddingVertical: 10 },
  symbolPill: { minWidth: 58, height: 34, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  symbolText: { color: '#0066FF', fontSize: 11, fontWeight: '900' },
  identity: { flex: 1, minWidth: 0 },
  name: { color: '#0F172A', fontSize: 12, fontWeight: '800' },
  muted: { marginTop: 3, color: '#64748B', fontSize: 9 },
  values: { alignItems: 'flex-end' },
  price: { color: '#0F172A', fontSize: 14, fontWeight: '900' },
  change: { marginTop: 3, fontSize: 10, fontWeight: '900' },
  empty: { color: '#64748B', fontSize: 11, paddingVertical: 16 },
});

export default MarketScreen;
