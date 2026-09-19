export type ProfitLossColors = {
  positive: string;
  negative: string;
  neutral: string;
};

export type Frame360ResolvedColorRule =
  | 'auto'
  | 'fixed'
  | 'theme'
  | 'pnl'
  | 'market'
  | undefined;

export function resolveFrame360RuleColor(
  rule: Frame360ResolvedColorRule,
  value: unknown,
  fixed: string | undefined,
  surface: 'text' | 'background' | 'border' = 'text',
  profitLossColors: ProfitLossColors = {
    positive: '#EF4444',
    negative: '#10B981',
    neutral: '#CA8A04',
  },
) {
  if (!rule || rule === 'fixed' || rule === 'auto') return fixed;
  if (rule === 'theme') {
    return fixed ?? (surface === 'background' ? '#EFF6FF' : '#0066FF');
  }

  // Dynamic sign colors are intentionally driven by raw numeric data only.
  // Display strings such as "+22,500" or "+18.75%" must never be parsed here.
  if (typeof value !== 'number' || !Number.isFinite(value)) return fixed;

  const hex =
    value > 0
      ? profitLossColors.positive
      : value < 0
        ? profitLossColors.negative
        : profitLossColors.neutral;

  return surface === 'background' ? hex + '22' : hex;
}
