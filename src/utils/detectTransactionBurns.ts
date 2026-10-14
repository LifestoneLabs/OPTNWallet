import {
  requiredFeeForBytes,
  txBytesFromHex,
} from '../apis/TransactionManager/feePolicy';
import type { TransactionOutput, UTXO } from '../types/types';

/** A fee this many times the size-based relay fee counts as a BCH burn. */
export const EXCESS_FEE_BURN_MULTIPLIER = 10n;

export type FungibleTokenBurn = {
  category: string;
  amount: bigint;
};

export type NftBurn = {
  category: string;
  commitment: string;
  capability: string;
};

export type BchBurnKind = 'op_return' | 'excess_fee';

export type BchBurn = {
  kind: BchBurnKind;
  amount: bigint;
};

export type TransactionBurnReport = {
  fungibleTokens: FungibleTokenBurn[];
  nfts: NftBurn[];
  bch: BchBurn[];
};

export type DetectTransactionBurnsParams = {
  inputs: UTXO[];
  outputs: TransactionOutput[];
  bytecodeSize?: number;
  txHex?: string;
  excessFeeMultiplier?: bigint;
};

export function emptyBurnReport(): TransactionBurnReport {
  return { fungibleTokens: [], nfts: [], bch: [] };
}

export function hasTransactionBurns(report: TransactionBurnReport): boolean {
  return (
    report.fungibleTokens.length > 0 ||
    report.nfts.length > 0 ||
    report.bch.length > 0
  );
}

export function toAtomicAmount(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.trunc(value));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0n;
    try {
      return BigInt(trimmed);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

export function isTokenCategorySelected(
  category: string | undefined | null
): boolean {
  return Boolean(category) && category !== 'none';
}

function inputSats(input: UTXO): bigint {
  const src = input as UTXO & { satoshis?: unknown };
  return toAtomicAmount(src.satoshis ?? src.value ?? src.amount ?? 0);
}

function outputSats(output: TransactionOutput): bigint {
  if ('amount' in output && output.amount !== undefined) {
    return toAtomicAmount(output.amount);
  }
  return 0n;
}

function isOpReturnOutput(output: TransactionOutput): boolean {
  if ('opReturn' in output && output.opReturn !== undefined) return true;
  if ('recipientAddress' in output && output.recipientAddress === 'OP_RETURN') {
    return true;
  }
  const lockingBytecode = (
    output as TransactionOutput & { lockingBytecode?: Uint8Array | number[] }
  ).lockingBytecode;
  if (lockingBytecode && lockingBytecode.length > 0) {
    return lockingBytecode[0] === 0x6a;
  }
  return false;
}

function tokenFtAmount(token: { amount?: unknown } | null | undefined): bigint {
  if (!token) return 0n;
  return toAtomicAmount(token.amount);
}

function nftIdentity(nft: {
  category: string;
  capability?: string;
  commitment?: string;
}): string {
  return `${nft.category}\0${nft.capability ?? ''}\0${nft.commitment ?? ''}`;
}

function collectNft(
  token:
    | {
        category: string;
        nft?: { capability?: string; commitment?: string } | null;
      }
    | null
    | undefined
): NftBurn | null {
  if (!token?.nft) return null;
  return {
    category: token.category,
    capability: token.nft.capability ?? '',
    commitment: token.nft.commitment ?? '',
  };
}

export function detectTransactionBurns({
  inputs,
  outputs,
  bytecodeSize,
  txHex,
  excessFeeMultiplier = EXCESS_FEE_BURN_MULTIPLIER,
}: DetectTransactionBurnsParams): TransactionBurnReport {
  const inputFt = new Map<string, bigint>();
  const outputFt = new Map<string, bigint>();
  const inputNfts: NftBurn[] = [];
  const outputNftIds = new Map<string, number>();

  for (const input of inputs) {
    const token = input.token ?? input.token_data;
    if (!token?.category) continue;
    const amount = tokenFtAmount(token);
    if (amount > 0n) {
      inputFt.set(token.category, (inputFt.get(token.category) ?? 0n) + amount);
    }
    const nft = collectNft(token);
    if (nft) inputNfts.push(nft);
  }

  let opReturnSats = 0n;
  let spendableOutputSats = 0n;

  for (const output of outputs) {
    const value = outputSats(output);
    if (isOpReturnOutput(output)) {
      opReturnSats += value;
    } else {
      spendableOutputSats += value;
    }

    if (!('token' in output) || !output.token?.category) continue;
    const amount = tokenFtAmount(output.token);
    if (amount > 0n) {
      outputFt.set(
        output.token.category,
        (outputFt.get(output.token.category) ?? 0n) + amount
      );
    }
    const nft = collectNft(output.token);
    if (nft) {
      const id = nftIdentity(nft);
      outputNftIds.set(id, (outputNftIds.get(id) ?? 0) + 1);
    }
  }

  const fungibleTokens: FungibleTokenBurn[] = [];
  for (const [category, inAmount] of inputFt) {
    const burned = inAmount - (outputFt.get(category) ?? 0n);
    if (burned > 0n) {
      fungibleTokens.push({ category, amount: burned });
    }
  }
  fungibleTokens.sort((a, b) => a.category.localeCompare(b.category));

  const nfts: NftBurn[] = [];
  for (const nft of inputNfts) {
    const id = nftIdentity(nft);
    const remaining = outputNftIds.get(id) ?? 0;
    if (remaining > 0) {
      outputNftIds.set(id, remaining - 1);
      continue;
    }
    nfts.push(nft);
  }

  const bch: BchBurn[] = [];
  if (opReturnSats > 0n) {
    bch.push({ kind: 'op_return', amount: opReturnSats });
  }

  const size =
    typeof bytecodeSize === 'number' && Number.isSafeInteger(bytecodeSize)
      ? bytecodeSize
      : txHex
        ? txBytesFromHex(txHex)
        : null;

  if (size !== null && size > 0) {
    const inputTotal = inputs.reduce(
      (sum, input) => sum + inputSats(input),
      0n
    );
    const feePaid = inputTotal - spendableOutputSats - opReturnSats;
    if (feePaid > 0n) {
      const requiredFee = requiredFeeForBytes(size);
      if (requiredFee > 0n && feePaid > requiredFee * excessFeeMultiplier) {
        bch.push({ kind: 'excess_fee', amount: feePaid });
      }
    }
  }

  return { fungibleTokens, nfts, bch };
}
