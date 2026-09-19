import type { ConfigValue, ConfigurationTree } from '../types/editor';

const canonicalize = (value: ConfigValue | ConfigurationTree | unknown): string => {
  if (value === undefined) return 'u';
  if (value === null) return 'n';
  if (typeof value === 'boolean') return value ? 'b1' : 'b0';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('V2_CFG_INVALID_VALUE_DOMAIN_001');
    return `d:${Object.is(value, -0) ? 0 : value}`;
  }
  if (typeof value === 'string') return `s:${JSON.stringify(value)}`;
  if (typeof value === 'bigint') return `i:${value.toString()}`;
  if (Array.isArray(value)) {
    return `a:[${value.map((item) => canonicalize(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new Error('V2_CFG_INVALID_VALUE_DOMAIN_001');
    }
    const record = value as Readonly<Record<string, unknown>>;
    const keys = Object.keys(record).sort();
    return `o:{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
  }
  throw new Error('V2_CFG_INVALID_VALUE_DOMAIN_001');
};

export const computeCanonicalFingerprint = (value: unknown): string => canonicalize(value);
