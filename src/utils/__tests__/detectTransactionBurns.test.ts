import { describe, expect, it } from 'vitest';
import { requiredFeeForBytes } from '../../apis/TransactionManager/feePolicy';
import type { TransactionOutput, UTXO } from '../../types/types';
import {
  detectTransactionBurns,
  EXCESS_FEE_BURN_MULTIPLIER,
  hasTransactionBurns,
  isTokenCategorySelected,
  toAtomicAmount,
} from '../detectTransactionBurns';

const CATEGORY_A =
  'ad95860f11111111111111111111111111111111111111111111111111115753';
const CATEGORY_B = 'bb'.repeat(32);

function utxo(overrides: Partial<UTXO> = {}): UTXO {
  return {
    address: 'bitcoincash:qsource',
    height: 800000,
    tx_hash: 'aa'.repeat(32),
    tx_pos: 0,
    value: 10000,
    ...overrides,
  };
}

function output(
  overrides: Partial<
    Extract<TransactionOutput, { recipientAddress: string }>
  > = {}
): TransactionOutput {
  return {
    recipientAddress: 'bitcoincash:qrecipient',
    amount: 1000,
    ...overrides,
  };
}

describe('detectTransactionBurns helpers', () => {
  it('treats empty and "none" as no selected token category', () => {
    expect(isTokenCategorySelected('')).toBe(false);
    expect(isTokenCategorySelected('none')).toBe(false);
    expect(isTokenCategorySelected(undefined)).toBe(false);
    expect(isTokenCategorySelected(CATEGORY_A)).toBe(true);
  });

  it('coerces token amounts to bigint', () => {
    expect(toAtomicAmount(1)).toBe(1n);
    expect(toAtomicAmount(1n)).toBe(1n);
    expect(toAtomicAmount('7')).toBe(7n);
    expect(toAtomicAmount('')).toBe(0n);
    expect(toAtomicAmount(Number.NaN)).toBe(0n);
  });
});

describe('detectTransactionBurns', () => {
  it('returns no burns when inputs and outputs match', () => {
    const report = detectTransactionBurns({
      inputs: [
        utxo({
          value: 20000,
          token: { category: CATEGORY_A, amount: 5n },
        }),
      ],
      outputs: [
        output({
          amount: 19800,
          token: { category: CATEGORY_A, amount: 5n },
        }),
      ],
      bytecodeSize: 200,
    });

    expect(report).toEqual({ fungibleTokens: [], nfts: [], bch: [] });
    expect(hasTransactionBurns(report)).toBe(false);
  });

  it('detects per-category FT burns from BCH-only auto-change', () => {
    const report = detectTransactionBurns({
      inputs: [
        utxo({
          value: 12000,
          token: { category: CATEGORY_A, amount: 1n },
        }),
      ],
      outputs: [
        output({ amount: 1000 }),
        output({
          recipientAddress: 'bitcoincash:qchange',
          amount: 10800,
        }),
      ],
      bytecodeSize: 200,
    });

    expect(report.fungibleTokens).toEqual([
      { category: CATEGORY_A, amount: 1n },
    ]);
    expect(report.nfts).toEqual([]);
    expect(hasTransactionBurns(report)).toBe(true);
  });

  it('only reports the unassigned FT remainder when some tokens are sent', () => {
    const report = detectTransactionBurns({
      inputs: [
        utxo({ token: { category: CATEGORY_A, amount: 10n } }),
        utxo({
          tx_pos: 1,
          token: { category: CATEGORY_B, amount: 3n },
        }),
      ],
      outputs: [
        output({
          token: { category: CATEGORY_A, amount: 4n },
        }),
      ],
    });

    expect(report.fungibleTokens).toEqual([
      { category: CATEGORY_A, amount: 6n },
      { category: CATEGORY_B, amount: 3n },
    ]);
  });

  it('does not treat genesis (output FT without input FT) as a burn', () => {
    const report = detectTransactionBurns({
      inputs: [utxo({ value: 20000 })],
      outputs: [
        output({
          amount: 1000,
          token: { category: CATEGORY_A, amount: 100n },
        }),
        output({ recipientAddress: 'bitcoincash:qchange', amount: 18000 }),
      ],
      bytecodeSize: 200,
    });

    expect(report.fungibleTokens).toEqual([]);
    expect(hasTransactionBurns(report)).toBe(false);
  });

  it('detects input NFTs missing from outputs', () => {
    const report = detectTransactionBurns({
      inputs: [
        utxo({
          token: {
            category: CATEGORY_A,
            amount: 0,
            nft: { capability: 'none', commitment: 'cafe' },
          },
        }),
      ],
      outputs: [output({ amount: 1000 })],
    });

    expect(report.nfts).toEqual([
      {
        category: CATEGORY_A,
        capability: 'none',
        commitment: 'cafe',
      },
    ]);
  });

  it('does not report an NFT that is preserved on an output', () => {
    const nft = {
      category: CATEGORY_A,
      amount: 0 as const,
      nft: { capability: 'mutable' as const, commitment: '00ab' },
    };
    const report = detectTransactionBurns({
      inputs: [utxo({ token: nft })],
      outputs: [output({ token: nft })],
    });

    expect(report.nfts).toEqual([]);
  });

  it('uses multiset matching when duplicate NFT identities are spent', () => {
    const nft = {
      category: CATEGORY_A,
      amount: 0 as const,
      nft: { capability: 'none' as const, commitment: 'aa' },
    };
    const report = detectTransactionBurns({
      inputs: [utxo({ token: nft }), utxo({ tx_pos: 1, token: nft })],
      outputs: [output({ token: nft })],
    });

    expect(report.nfts).toEqual([
      {
        category: CATEGORY_A,
        capability: 'none',
        commitment: 'aa',
      },
    ]);
  });

  it('counts FT amounts on NFT-bearing inputs separately from the NFT', () => {
    const report = detectTransactionBurns({
      inputs: [
        utxo({
          token: {
            category: CATEGORY_A,
            amount: 8n,
            nft: { capability: 'minting', commitment: '' },
          },
        }),
      ],
      outputs: [output({ amount: 1000 })],
    });

    expect(report.fungibleTokens).toEqual([
      { category: CATEGORY_A, amount: 8n },
    ]);
    expect(report.nfts).toEqual([
      {
        category: CATEGORY_A,
        capability: 'minting',
        commitment: '',
      },
    ]);
  });

  it('detects BCH burned to OP_RETURN outputs with value > 0', () => {
    const report = detectTransactionBurns({
      inputs: [utxo({ value: 5000 })],
      outputs: [
        {
          recipientAddress: 'OP_RETURN',
          amount: 1000,
        },
        output({ amount: 3800 }),
      ],
      bytecodeSize: 200,
    });

    expect(report.bch).toEqual([{ kind: 'op_return', amount: 1000n }]);
  });

  it('detects typed opReturn chunks with an attached value as a BCH burn', () => {
    const report = detectTransactionBurns({
      inputs: [utxo({ value: 5000 })],
      outputs: [
        {
          opReturn: ['hello'],
          amount: 250,
        } as TransactionOutput,
        output({ amount: 4500 }),
      ],
    });

    expect(report.bch).toEqual([{ kind: 'op_return', amount: 250n }]);
  });

  it('does not treat zero-value OP_RETURN as a BCH burn', () => {
    const report = detectTransactionBurns({
      inputs: [utxo({ value: 5000 })],
      outputs: [
        {
          recipientAddress: 'OP_RETURN',
          amount: 0,
        },
        output({ amount: 4800 }),
      ],
      bytecodeSize: 200,
    });

    expect(report.bch).toEqual([]);
  });

  it('detects a fee more than 10× the size-based fee as a BCH burn', () => {
    const bytecodeSize = 100;
    const required = requiredFeeForBytes(bytecodeSize);
    const feePaid = required * EXCESS_FEE_BURN_MULTIPLIER + 1n;
    const outputsTotal = 20_000n - feePaid;

    const report = detectTransactionBurns({
      inputs: [utxo({ value: 20000 })],
      outputs: [output({ amount: Number(outputsTotal) })],
      bytecodeSize,
    });

    expect(report.bch).toEqual([{ kind: 'excess_fee', amount: feePaid }]);
  });

  it('does not flag a fee that is exactly 10× the size-based fee', () => {
    const bytecodeSize = 100;
    const required = requiredFeeForBytes(bytecodeSize);
    const feePaid = required * EXCESS_FEE_BURN_MULTIPLIER;
    const outputsTotal = 20_000n - feePaid;

    const report = detectTransactionBurns({
      inputs: [utxo({ value: 20000 })],
      outputs: [output({ amount: Number(outputsTotal) })],
      bytecodeSize,
    });

    expect(report.bch).toEqual([]);
    expect(hasTransactionBurns(report)).toBe(false);
  });

  it('does not double-count OP_RETURN value as an excessive fee', () => {
    const bytecodeSize = 100;
    const required = requiredFeeForBytes(bytecodeSize);
    const minerFee = required;
    const opReturnValue = 1000n;

    const report = detectTransactionBurns({
      inputs: [utxo({ value: 5000 })],
      outputs: [
        {
          recipientAddress: 'OP_RETURN',
          amount: Number(opReturnValue),
        },
        output({ amount: Number(5000n - minerFee - opReturnValue) }),
      ],
      bytecodeSize,
    });

    expect(report.bch).toEqual([{ kind: 'op_return', amount: 1000n }]);
  });

  it('derives bytecode size from tx hex when size is omitted', () => {
    const txHex = '00'.repeat(100);
    const required = requiredFeeForBytes(100);
    const feePaid = required * EXCESS_FEE_BURN_MULTIPLIER + 1n;

    const report = detectTransactionBurns({
      inputs: [utxo({ value: 20000 })],
      outputs: [output({ amount: Number(20_000n - feePaid) })],
      txHex,
    });

    expect(report.bch).toEqual([{ kind: 'excess_fee', amount: feePaid }]);
  });
});
