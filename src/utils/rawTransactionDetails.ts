import type { UTXO } from '../types/types';
import { toAtomicAmount } from './detectTransactionBurns';
import {
  resolveTokenPresentation,
  tokenPresentationFallbackFromBcmr,
  type TokenPresentation,
} from './tokenPresentation';
import type { BcmrTokenMetadataState } from '../types/bcmr';

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

export function utxoSats(
  utxo: Pick<UTXO, 'satoshis' | 'value' | 'amount'>
): bigint {
  const src = utxo as UTXO & { satoshis?: unknown };
  return toAtomicAmount(src.satoshis ?? src.value ?? src.amount ?? 0);
}

export function computeTransactionFeeSats(
  inputSats: readonly bigint[],
  outputSats: readonly bigint[]
): bigint {
  const incoming = inputSats.reduce((sum, value) => sum + value, 0n);
  const outgoing = outputSats.reduce((sum, value) => sum + value, 0n);
  return incoming - outgoing;
}

export function formatSatsAsBch(sats: bigint): string {
  const sign = sats < 0n ? '-' : '';
  const abs = sats < 0n ? -sats : sats;
  const whole = abs / SATS_PER_BCH;
  const frac = (abs % SATS_PER_BCH).toString().padStart(8, '0');
  return `${sign}${whole.toString()}.${frac}`;
}

export function formatOutpoint(txid: string, vout: number): string {
  return `${String(txid ?? '')
    .trim()
    .toLowerCase()}:${vout}`;
}

export function matchUtxoByOutpoint(
  utxos: UTXO[],
  txid: string,
  vout: number
): UTXO | undefined {
  const normalized = String(txid ?? '')
    .trim()
    .toLowerCase();
  return utxos.find(
    (utxo) =>
      String(utxo.tx_hash ?? '')
        .trim()
        .toLowerCase() === normalized && utxo.tx_pos === vout
  );
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
