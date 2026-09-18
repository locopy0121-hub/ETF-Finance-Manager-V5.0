export const PAGE_REGISTRY = [
  { key: 'dashboard', label: '首頁', title: '資產總覽' },
  { key: 'portfolio', label: '庫存', title: '庫存持股' },
  { key: 'dividend', label: '股息', title: '股息月曆' },
  { key: 'ledger', label: '記帳', title: '智慧記帳' },
  { key: 'calculator', label: '試算', title: '情境模擬' },
  { key: 'market', label: '市場', title: '市場總覽' },
  { key: 'ai', label: 'AI', title: 'AI 助理' },
  { key: 'settings', label: '設定', title: '設定中心' },
  { key: 'detail', label: 'ETF 詳情', title: 'ETF 詳情' },
] as const;

export type PageFieldKey = (typeof PAGE_REGISTRY)[number]['key'];

export const PAGE_KEYS = PAGE_REGISTRY.map(item => item.key) as PageFieldKey[];

export const PAGE_LABELS = Object.fromEntries(
  PAGE_REGISTRY.map(item => [item.key, item.label]),
) as Record<PageFieldKey, string>;

export const PAGE_TITLES = Object.fromEntries(
  PAGE_REGISTRY.map(item => [item.key, item.title]),
) as Record<PageFieldKey, string>;

export function makePageRecord<T>(factory: (page: PageFieldKey) => T): Record<PageFieldKey, T> {
  return Object.fromEntries(PAGE_KEYS.map(page => [page, factory(page)])) as Record<PageFieldKey, T>;
}
