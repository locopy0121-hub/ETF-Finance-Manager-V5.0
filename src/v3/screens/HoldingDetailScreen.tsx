import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { calculateHoldingView } from '../engine';
import { pageFieldsForFrame, PageFrame } from '../pageRuntime';
import { V3_THEME, resolvePnlTone } from '../theme';
import FontScaleScope from '../components/FontScaleScope';
import type { ScreenCommon } from '../screensBase';

type HoldingDetailScreenProps = {
  common: ScreenCommon;
  symbol: string;
  onBack: () => void;
  onSettings: () => void;
};

const money = (value: number) =>
  Math.round(Number.isFinite(value) ? value : 0).toLocaleString('zh-TW');

export function HoldingDetailScreen({
  common,
  symbol,
  onBack,
  onSettings,
}: HoldingDetailScreenProps) {
  const holding = common.holdings.find(item => item.symbol === symbol);
  const view = useMemo(
    () => holding
      ? calculateHoldingView(holding, common.quotes, common.ledger, common.dividends)
      : null,
    [holding, common.quotes, common.ledger, common.dividends],
  );

  if (!holding || !view) {
    return (
      <View style={styles.screen}>
        <View style={styles.emptyCard}>
          <Text style={styles.title}>找不到 ETF 詳情</Text>
          <Pressable onPress={onBack} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>返回庫存</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const values: Record<string, string> = {
    shares: view.shares.toLocaleString(),
    purchaseCount: String(holding.purchaseRecords?.length ?? 0),
    pureCost: money(view.pureCost),
    totalFees: money(view.totalFees),
    totalCost: money(view.totalCost),
    historicalTradeCost: money(view.historicalTradeCost),
    historicalBuyFees: money(view.historicalBuyFees),
    historicalCashOutflow: money(view.historicalCashOutflow),
    avgCost: view.avgCost.toFixed(2),
    cashAvgCost: view.cashAvgCost.toFixed(2),
    broker: holding.broker ?? '—',
    account: holding.account ?? '—',
    lastBuyDate: holding.purchaseRecords?.map(item => item.date).sort().slice(-1)[0] ?? '—',
    price: view.price.toFixed(2),
    previousClose: view.previousClose != null ? Number(view.previousClose).toFixed(2) : '—',
    open: view.open != null ? Number(view.open).toFixed(2) : '—',
    high: view.high != null ? Number(view.high).toFixed(2) : '—',
    low: view.low != null ? Number(view.low).toFixed(2) : '—',
    volume: view.volume != null ? Number(view.volume).toLocaleString() : '—',
    todayPnl: money(view.todayPnl),
    todayPnlPct: view.todayPnlPct.toFixed(2) + '%',
    marketValue: money(view.marketValue),
    pnl: money(view.pnl),
    roi: view.roi.toFixed(2) + '%',
    cashPnl: money(view.cashPnl),
    cashRoi: view.cashRoi.toFixed(2) + '%',
    realizedPricePnl: money(view.realizedPricePnl),
    realizedCashPnl: money(view.realizedCashPnl),
    cumulativeDividend: money(view.cumulativeDividend),
    annualDividend: String(holding.annualDividendPerShare ?? 0),
    costYield: view.costYield.toFixed(2) + '%',
    weight: '—',
    nav: Number((common.quotes[symbol] as any)?.nav ?? 0) > 0 ? Number((common.quotes[symbol] as any)?.nav).toFixed(2) : '—',
    premium: '—',
    updatedAt: String((common.quotes[symbol] as any)?.quoteTime ?? '—'),
  };
  const labels: Record<string, string> = {
    shares:'持有股數',purchaseCount:'買進筆數',pureCost:'目前成交成本',totalFees:'分攤手續費',totalCost:'含費成本',
    historicalTradeCost:'累積成交成本',historicalBuyFees:'累積買進手續費',historicalCashOutflow:'累積現金支出',
    avgCost:'平均成交成本',cashAvgCost:'含費平均成本',broker:'券商',account:'帳戶',lastBuyDate:'最後買進日',
    price:'最新行情',previousClose:'昨收',open:'開盤',high:'最高',low:'最低',volume:'成交量',todayPnl:'今日損益',
    todayPnlPct:'今日損益 %',marketValue:'目前市值',pnl:'即時損益',roi:'即時報酬率',cashPnl:'即時損益（含費）',
    cashRoi:'即時報酬率（含費）',realizedPricePnl:'已實現價格損益',realizedCashPnl:'已實現含費損益',
    cumulativeDividend:'累積配息',annualDividend:'每股年配息估值',costYield:'Cost Yield',weight:'資產權重',
    nav:'NAV / 淨值',premium:'折溢價',updatedAt:'行情時間',
  };
  const fields = pageFieldsForFrame(common.prefs, 'detail', 'detail-summary');
  const tone = resolvePnlTone(view.cashPnl, 'TW');

  return (
    <FontScaleScope prefs={common.prefs}>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.circleButton}><Text style={styles.circleText}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>ETF DETAIL</Text>
          <Text style={styles.title}>{holding.symbol} {holding.name}</Text>
          <Text style={styles.subtitle}>單檔持有、行情、成本與損益詳情</Text>
        </View>
        {common.prefs.ai.enabled && common.prefs.ai.showHeaderButton && common.onAi ? (
          <Pressable onPress={common.onAi} style={styles.circleButton}><Text style={styles.circleText}>✦</Text></Pressable>
        ) : null}
        <Pressable onPress={onSettings} style={styles.circleButton}><Text style={styles.circleText}>⚙</Text></Pressable>
      </View>

      <PageFrame prefs={common.prefs} page="detail" cardId="detail-summary">
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>即時含費損益</Text>
          <Text style={[styles.heroValue, { color: tone.foreground }]}>
            {view.cashPnl > 0 ? '+' : ''}{money(view.cashPnl)}
          </Text>
          <Text style={[styles.heroPct, { color: tone.foreground }]}>
            {view.cashRoi > 0 ? '+' : ''}{view.cashRoi.toFixed(2)}%
          </Text>
        </View>
        <View style={styles.grid}>
          {fields.map(key => (
            <View key={key} style={styles.metric}>
              <Text style={styles.metricLabel}>{labels[key] ?? key}</Text>
              <Text style={styles.metricValue}>{values[key] ?? '—'}</Text>
            </View>
          ))}
        </View>
      </PageFrame>
    </ScrollView>
    </FontScaleScope>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F8FAFC'},
  content:{padding:18,paddingBottom:36,gap:14},
  header:{flexDirection:'row',alignItems:'flex-start',gap:10},
  circleButton:{width:40,height:40,borderRadius:20,borderWidth:1,borderColor:'#E2E8F0',backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
  circleText:{color:'#0066FF',fontSize:18,fontWeight:'900'},
  eyebrow:{color:'#0066FF',fontSize:11,fontWeight:'800',letterSpacing:1},
  title:{marginTop:4,color:'#0F172A',fontWeight:'900'},
  subtitle:{marginTop:5,color:'#64748B',fontSize:11},
  hero:{borderRadius:16,borderWidth:1,borderColor:'#E2E8F0',backgroundColor:'#FFFFFF',padding:18,...V3_THEME.shadow},
  heroLabel:{color:'#64748B',fontSize:10,fontWeight:'700'},
  heroValue:{marginTop:7,fontSize:28,fontWeight:'900'},
  heroPct:{marginTop:3,fontSize:12,fontWeight:'900'},
  grid:{marginTop:10,flexDirection:'row',flexWrap:'wrap',gap:9},
  metric:{width:'48.5%',minHeight:74,borderRadius:16,borderWidth:1,borderColor:'#E2E8F0',backgroundColor:'#FFFFFF',padding:12},
  metricLabel:{color:'#64748B',fontSize:9,fontWeight:'700'},
  metricValue:{marginTop:7,color:'#0F172A',fontSize:12,fontWeight:'900'},
  emptyCard:{margin:18,borderRadius:16,borderWidth:1,borderColor:'#E2E8F0',backgroundColor:'#FFFFFF',padding:18},
  primaryButton:{marginTop:14,minHeight:44,borderRadius:14,backgroundColor:'#0066FF',alignItems:'center',justifyContent:'center'},
  primaryButtonText:{color:'#FFFFFF',fontWeight:'900'},
});

export default HoldingDetailScreen;
