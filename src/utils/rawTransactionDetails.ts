import type { UTXO } from '../types/types';
import { utxoSats } from './detectTransactionBurns';
import {
  resolveTokenPresentation,
  tokenPresentationFallbackFromBcmr,
  type TokenPresentation,
} from './tokenPresentation';
import type { BcmrTokenMetadataState } from '../types/bcmr';

export { utxoSats };

export const SATS_PER_BCH = 100_000_000n;

export type RawTxNftView = {
  capability: string;
  commitment: string;
};

export type RawTxTokenView = {
  category: string;
  ftAmount: bigint;
  nft: RawTxNftView | null;
  bcmr: unknown;
};

export type RawTxIoView = {
  kind: 'input' | 'output';
  index: number;
  sats: bigint;
  outpoint: string | null;
  address: string | null;
  isOpReturn: boolean;
  opReturnChunks: string[];
  token: RawTxTokenView | null;
};

export type BuiltSourceOutputView = {
  valueSatoshis: bigint;
  token?: {
    category: string;
    amount: bigint;
    nft?: {
      capability: string;
      commitment: string;
    };
  } | null;
};

export function computeTransactionFeeSats(
  inputSats: readonly bigint[],
  outputSats: readonly bigint[]
): bigint {
  const incoming = inputSats.reduce((sum, value) => sum + value, 0n);
  const outgoing = outputSats.reduce((sum, value) => sum + value, 0n);
  return incoming - outgoing;
}

export function formatFeeRateSatsPerByte(
  feeSats: bigint,
  serializedBytes: number
): string {
  if (!Number.isFinite(serializedBytes) || serializedBytes <= 0) {
    return '0.00';
  }
  const rate = Number(feeSats) / serializedBytes;
  if (!Number.isFinite(rate)) return '0.00';
  return rate.toFixed(2);
}

export function formatSatsAsBch(sats: bigint): string {
  const sign = sats < 0n ? '-' : '';
  const abs = sats < 0n ? -sats : sats;
  const whole = abs / SATS_PER_BCH;
  const frac = (abs % SATS_PER_BCH).toString().padStart(8, '0');
  return `${sign}${whole.toString()}.${frac}`;
}

function outpointIndexOf(value: unknown): number | null {
  if (typeof value === 'bigint') {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < 0n) return null;
    return Number(value);
  }
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : NaN;
  if (!Number.isFinite(numeric)) return null;
  return Math.trunc(numeric);
}

export function formatOutpoint(txid: string, vout: number | bigint): string {
  const index = outpointIndexOf(vout) ?? 0;
  return `${String(txid ?? '')
    .trim()
    .toLowerCase()}:${index}`;
}

export function matchUtxoByOutpoint(
  utxos: UTXO[],
  txid: string,
  vout: number | bigint
): UTXO | undefined {
  const normalized = String(txid ?? '')
    .trim()
    .toLowerCase();
  const index = outpointIndexOf(vout);
  if (index === null) return undefined;
  return utxos.find((utxo) => {
    const hash = String(
      utxo.tx_hash ?? (utxo as UTXO & { txid?: unknown }).txid ?? ''
    )
      .trim()
      .toLowerCase();
    return hash === normalized && outpointIndexOf(utxo.tx_pos) === index;
  });
}

export function bcmrForCategory(utxos: UTXO[], category: string): unknown {
  const normalized = String(category ?? '')
    .trim()
    .toLowerCase();
  for (const utxo of utxos) {
    const token = utxo.token ?? utxo.token_data;
    if (!token?.category) continue;
    if (String(token.category).trim().toLowerCase() === normalized) {
      return token.BcmrTokenMetadata ?? null;
    }
  }
  return null;
}

export function hasDisplayableBcmrIdentity(
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
  > | null,
  bcmr?: unknown
): boolean {
  const fallback = tokenPresentationFallbackFromBcmr(bcmr);
  if (fallback?.name || fallback?.iconUri) return true;
  const presentation = resolveTokenPresentation(category, metadata, fallback);
  return (
    presentation.hasSnapshot &&
    Boolean(presentation.name || presentation.iconUri)
  );
}

export function tokenPresentationForRawTx(
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
  > | null,
  bcmr?: unknown
): TokenPresentation {
  return resolveTokenPresentation(
    category,
    metadata,
    tokenPresentationFallbackFromBcmr(bcmr)
  );
}

export function nftCommitmentLabel(
  commitment: string | undefined | null
): string {
  const trimmed = String(commitment ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'none';
}
