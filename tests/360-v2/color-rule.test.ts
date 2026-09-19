import { describe, expect, it } from 'vitest';
import { resolveFrame360RuleColor } from '../../src/v3/frame360Color';

const colors = {
  positive: '#EF4444',
  negative: '#10B981',
  neutral: '#CA8A04',
};

describe('360 dynamic P&L colors use raw numeric values', () => {
  it('maps positive, negative and zero raw numbers deterministically', () => {
    expect(resolveFrame360RuleColor('pnl', 12.5, '#111111', 'text', colors)).toBe(colors.positive);
    expect(resolveFrame360RuleColor('pnl', -12.5, '#111111', 'text', colors)).toBe(colors.negative);
    expect(resolveFrame360RuleColor('pnl', 0, '#111111', 'text', colors)).toBe(colors.neutral);
  });

  it('uses translucent P&L colors for backgrounds', () => {
    expect(resolveFrame360RuleColor('pnl', 1, '#111111', 'background', colors)).toBe(colors.positive + '22');
    expect(resolveFrame360RuleColor('pnl', -1, '#111111', 'background', colors)).toBe(colors.negative + '22');
    expect(resolveFrame360RuleColor('pnl', 0, '#111111', 'background', colors)).toBe(colors.neutral + '22');
  });

  it('does not infer P&L from already-formatted display strings', () => {
    expect(resolveFrame360RuleColor('pnl', '+22,500', '#111111', 'text', colors)).toBe('#111111');
    expect(resolveFrame360RuleColor('pnl', '+18.75%', '#111111', 'text', colors)).toBe('#111111');
  });
});
