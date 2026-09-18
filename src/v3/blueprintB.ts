import type { V3Preferences } from './model';

export const BLUEPRINT_B = {
  background: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  primary: '#0066FF',
  primarySoft: '#EFF6FF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  taiwanUp: '#EF4444',
  taiwanDown: '#10B981',
  cardRadius: 16,
  cardOpacity: 100,
} as const;

/**
 * V5 has one visual contract: Blueprint B.
 * Only visual tokens are locked here. Dynamic/user settings (font scale,
 * page layouts, visibility, calendar, monitoring, AI, ticker, etc.) remain
 * untouched and continue flowing from Settings 2.0.
 */
export function resolveBlueprintBPreferences(prefs: V3Preferences): V3Preferences {
  return {
    ...prefs,
    primaryTextColor: BLUEPRINT_B.textPrimary,
    secondaryTextColor: BLUEPRINT_B.textSecondary,
    accentColor: BLUEPRINT_B.primary,
    positiveColor: BLUEPRINT_B.taiwanUp,
    negativeColor: BLUEPRINT_B.taiwanDown,
    backgroundOpacity: 100,
    overlayOpacity: 0,
    cardOpacity: BLUEPRINT_B.cardOpacity,
    cardRadius: BLUEPRINT_B.cardRadius,
  };
}

export function scaledFont(base: number, prefs: Pick<V3Preferences, 'fontScale'>) {
  return Math.max(8, base * Math.max(0.8, Math.min(1.8, prefs.fontScale / 100)));
}
