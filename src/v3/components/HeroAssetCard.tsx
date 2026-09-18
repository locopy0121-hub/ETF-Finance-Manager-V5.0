import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import {
  V3_THEME,
  resolvePnlTone,
  type MarketColorMode,
} from '../theme';

export type PortfolioViewModel = ReturnType<
  typeof import('../engine').calculatePortfolioView
>;

export type HeroAssetCardProps = {
  portfolio: PortfolioViewModel;
  market?: MarketColorMode;
  style?: ViewStyle;
  currencyLabel?: string;
  showTotalAssets?: boolean;
  showTodayPnl?: boolean;
  showTotalPnl?: boolean;
  fontScale?: number;
  privacyMode?: boolean;
};

type PnlBadgeProps = {
  label: string;
  value: number;
  market: MarketColorMode;
  hidden?: boolean;
};

const money = (value: number) =>
  Math.round(Number.isFinite(value) ? value : 0).toLocaleString('zh-TW');

const signedMoney = (value: number) => {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe > 0 ? '+' : safe < 0 ? '-' : '';
  return `${sign}${money(Math.abs(safe))}`;
};

function PnlBadge({ label, value, market, hidden }: PnlBadgeProps) {
  const tone = resolvePnlTone(value, market);

  return (
    <View style={[styles.badge, { backgroundColor: tone.background }]}>
      <Text style={styles.badgeLabel}>{label}</Text>
      <Text style={[styles.badgeValue, { color: tone.foreground }]}>
        {hidden ? '••••' : signedMoney(value)}
      </Text>
    </View>
  );
}

/**
 * Top-level portfolio hero.
 *
 * Accounting boundary:
 * - Receives the engine View Model only.
 * - Never reads ledger entries.
 * - Never calculates commission, tax, cost basis, market value, or P/L.
 * - Local math is formatting/presentation only.
 */
export function HeroAssetCard({
  portfolio,
  market = 'TW',
  style,
  currencyLabel = 'TWD',
  showTotalAssets = true,
  showTodayPnl = true,
  showTotalPnl = true,
  fontScale = 100,
  privacyMode = false,
}: HeroAssetCardProps) {
  const [localHidden, setLocalHidden] = useState(false);
  const hidden = privacyMode || localHidden;
  const scale = Math.max(0.8, Math.min(1.6, fontScale / 100));

  const assetText = hidden ? '＊＊＊＊＊＊' : money(portfolio.totalAssets);

  // Decorative curve direction only. No financial value is recomputed here.
  const chartPath = useMemo(
    () =>
      portfolio.todayPnl >= 0
        ? 'M0 78 C28 74 42 56 68 61 C91 66 103 43 130 48 C154 52 169 27 194 31 C218 35 236 15 268 19'
        : 'M0 24 C30 29 42 48 70 42 C98 36 112 57 138 53 C164 49 179 70 203 66 C229 62 244 79 268 76',
    [portfolio.todayPnl],
  );

  const fillPath = `${chartPath} L268 96 L0 96 Z`;

  return (
    <View style={[styles.card, style]}>
      <Svg
        pointerEvents="none"
        width="100%"
        height="100%"
        viewBox="0 0 360 210"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <LinearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0066FF" stopOpacity={0.14} />
            <Stop offset="1" stopColor="#0066FF" stopOpacity={0.01} />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width="360" height="210" rx="16" fill="#FFFFFF" />

        <Path
          d={fillPath}
          transform="translate(82 78)"
          fill="url(#chartFill)"
          opacity={0.9}
        />
        <Path
          d={chartPath}
          transform="translate(82 78)"
          fill="none"
          stroke="#0066FF"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.78}
        />
      </Svg>

      {showTotalAssets ? (
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.eyebrow, { fontSize: 10 * scale }]}>總資產 ({currencyLabel})</Text>
            <View style={styles.valueRow}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                style={[styles.heroValue, { fontSize: 34 * scale }]}
              >
                {assetText}
              </Text>

              {!privacyMode ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={hidden ? '顯示總資產' : '隱藏總資產'}
                  hitSlop={10}
                  onPress={() => setLocalHidden(v => !v)}
                  style={({ pressed }) => [
                    styles.eyeButton,
                    pressed && styles.eyeButtonPressed,
                  ]}
                >
                  <Text style={styles.eyeIcon}>{hidden ? '◎' : '◉'}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.spacer} />

      <View style={styles.badgeRow}>
        {showTodayPnl ? (
          <PnlBadge
            label="今日損益"
            value={portfolio.todayPnl}
            market={market}
            hidden={hidden}
          />
        ) : null}
        {showTotalPnl ? (
          <PnlBadge
            label="累積損益"
            value={portfolio.totalPnl}
            market={market}
            hidden={hidden}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 220,
    overflow: 'hidden',
    borderRadius: V3_THEME.radius.card,
    padding: V3_THEME.spacing.xl,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...V3_THEME.shadow,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 2,
  },
  eyebrow: {
    ...V3_THEME.typography.helper,
    color: '#64748B',
    marginBottom: V3_THEME.spacing.sm,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '94%',
  },
  heroValue: {
    ...V3_THEME.typography.heroValue,
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  eyeButton: {
    width: 34,
    height: 34,
    marginLeft: V3_THEME.spacing.sm,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeButtonPressed: {
    opacity: 0.68,
  },
  eyeIcon: {
    color: '#0066FF',
    fontSize: 16,
    fontWeight: '700',
  },
  spacer: {
    flex: 1,
    minHeight: 74,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: V3_THEME.spacing.sm,
    zIndex: 2,
  },
  badge: {
    minHeight: 38,
    paddingHorizontal: V3_THEME.spacing.md,
    paddingVertical: V3_THEME.spacing.sm,
    borderRadius: V3_THEME.radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  badgeLabel: {
    ...V3_THEME.typography.helper,
    color: '#64748B',
  },
  badgeValue: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});

export default HeroAssetCard;
