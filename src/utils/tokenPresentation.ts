import {
  getBcmrMetadataStatusLabel,
  getBcmrMetadataStatusTone,
  type BcmrTokenMetadataState,
} from '../types/bcmr';
import { shortenHash } from './shortenHash';

export type TokenPresentationStatusTone =
  | 'accent'
  | 'muted'
  | 'warning'
  | 'danger';

export type TokenPresentationFallback = {
  name?: string | null;
  symbol?: string | null;
  decimals?: number | null;
  iconUri?: string | null;
};

export type TokenPresentation = {
  category: string;
  primaryLabel: string;
  secondaryLabel: string | null;
  name: string;
  symbol: string;
  decimals: number;
  iconUri: string | null;
  statusLabel: string | null;
  statusTone: TokenPresentationStatusTone | null;
  hasSnapshot: boolean;
  hasFallback: boolean;
  shortCategory: string;
};

function pickString(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function pickNumber(...values: Array<number | null | undefined>): number {
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    return Math.max(0, Math.trunc(value));
  }
  return 0;
}

export function shortTokenCategory(category: string): string {
  return shortenHash(String(category ?? '').trim(), 4, 4);
}

/**
 * Read BCMR identity fields without assuming `token` or `uris` exist.
 * Missing metadata, `{}`, and snapshots without `uris` all become a
 * placeholder fallback (no icon, decimals 0). Callers should still use
 * `resolveTokenPresentation`, which shows a short category id as the name.
 */
export function tokenPresentationFallbackFromBcmr(
  bcmr: unknown
): TokenPresentationFallback | null {
  if (bcmr == null || typeof bcmr !== 'object') return null;

  const record = bcmr as {
    name?: unknown;
    token?: { symbol?: unknown; decimals?: unknown } | null;
    uris?: { icon?: unknown } | null;
  };

  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const symbol =
    typeof record.token?.symbol === 'string' ? record.token.symbol.trim() : '';
  const decimalsRaw = record.token?.decimals;
  const decimals =
    typeof decimalsRaw === 'number' && Number.isFinite(decimalsRaw)
      ? Math.max(0, Math.trunc(decimalsRaw))
      : 0;
  const iconUri =
    typeof record.uris?.icon === 'string' ? record.uris.icon.trim() : '';

  return {
    name: name || null,
    symbol: symbol || null,
    decimals,
    iconUri: iconUri || null,
  };
}

export function formatAtomicTokenAmount(
  amount: bigint | number | string,
  decimals = 0
): string {
  const normalizedDecimals = Math.max(0, Math.trunc(decimals));
  if (normalizedDecimals <= 0) {
    return typeof amount === 'bigint' ? amount.toString() : String(amount);
  }

  const amountString =
    typeof amount === 'bigint'
      ? amount.toString()
      : typeof amount === 'number'
        ? Number.isFinite(amount)
          ? Math.trunc(amount).toString()
          : '0'
        : String(amount).trim();

  if (!amountString) return '0';

  const isNegative = amountString.startsWith('-');
  const unsigned = isNegative ? amountString.slice(1) : amountString;
  if (!/^\d+$/.test(unsigned)) return '0';

  if (unsigned.length <= normalizedDecimals) {
    const fractional = unsigned
      .padStart(normalizedDecimals, '0')
      .replace(/0+$/, '');
    return `${isNegative ? '-' : ''}0${fractional ? `.${fractional}` : ''}`;
  }

  const whole = unsigned.slice(0, unsigned.length - normalizedDecimals);
  const fractional = unsigned
    .slice(unsigned.length - normalizedDecimals)
    .replace(/0+$/, '');
  return `${isNegative ? '-' : ''}${whole}${fractional ? `.${fractional}` : ''}`;
}

export function getTokenPresentationStatusClassName(
  tone: TokenPresentationStatusTone
): string {
  switch (tone) {
    case 'accent':
      return 'wallet-accent-text';
    case 'warning':
      return 'wallet-warning-text';
    case 'danger':
      return 'wallet-danger-text';
    case 'muted':
    default:
      return 'wallet-muted';
  }
}

export function resolveTokenPresentation(
  category: string,
  metadata?: Pick<
    BcmrTokenMetadataState,
    | 'status'
    | 'freshness'
    | 'name'
    | 'symbol'
    | 'decimals'
    | 'iconUri'
    | 'snapshot'
    | 'isRefreshing'
    | 'identityStatus'
  > | null,
  fallback?: TokenPresentationFallback | null
): TokenPresentation {
  // Legacy UTXO/cache metadata cannot override a scoped runtime observation.
  if (metadata?.identityStatus) fallback = null;
  const normalizedCategory = String(category ?? '').trim();
  const shortCategory = shortTokenCategory(normalizedCategory);
  const hasSnapshot = Boolean(metadata?.snapshot);
  const hasFallback = Boolean(
    fallback &&
      (fallback.name != null ||
        fallback.symbol != null ||
        fallback.decimals != null ||
        fallback.iconUri != null)
  );

  const fallbackName = pickString(fallback?.name);
  const fallbackSymbol = pickString(fallback?.symbol);
  const fallbackIconUri = pickString(fallback?.iconUri);
  const fallbackDecimals = pickNumber(fallback?.decimals);

  const name = hasSnapshot
    ? pickString(metadata?.name, fallbackName)
    : fallbackName;
  const symbol = hasSnapshot
    ? pickString(metadata?.symbol, fallbackSymbol)
    : fallbackSymbol;
  const decimals = hasSnapshot
    ? pickNumber(metadata?.decimals, fallbackDecimals)
    : fallbackDecimals;
  const iconUri = metadata?.identityStatus
    ? null
    : hasSnapshot
      ? pickString(metadata?.iconUri, fallbackIconUri) || null
      : fallbackIconUri || null;

  const primaryLabel = pickString(name, symbol, shortCategory);
  const secondaryLabel = name && symbol && name !== symbol ? symbol : null;

  const shouldShowStatus =
    Boolean(metadata?.identityStatus) ||
    metadata?.status === 'loading' ||
    metadata?.isRefreshing === true ||
    metadata?.freshness === 'refreshing';
  const statusLabel = shouldShowStatus
    ? getBcmrMetadataStatusLabel(metadata)
    : null;
  const statusTone: TokenPresentationStatusTone | null = shouldShowStatus
    ? getBcmrMetadataStatusTone(metadata)
    : null;

  return {
    category: normalizedCategory,
    primaryLabel,
    secondaryLabel,
    name,
    symbol,
    decimals,
    iconUri,
    statusLabel,
    statusTone,
    hasSnapshot,
    hasFallback,
    shortCategory,
  };
}
