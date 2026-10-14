import { describe, expect, it } from 'vitest';
import type { UTXO } from '../../types/types';
import {
  bcmrForCategory,
  computeTransactionFeeSats,
  formatOutpoint,
  formatSatsAsBch,
  hasDisplayableBcmrIdentity,
  matchUtxoByOutpoint,
  nftCommitmentLabel,
  utxoSats,
} from '../rawTransactionDetails';

describe('rawTransactionDetails fee and formatting', () => {
  it('computes fee as sum(input sats) - sum(output sats)', () => {
    expect(
      computeTransactionFeeSats([12_000n, 3_000n], [10_000n, 4_800n])
    ).toBe(200n);
    expect(computeTransactionFeeSats([1000n], [1000n])).toBe(0n);
    expect(computeTransactionFeeSats([], [100n])).toBe(-100n);
  });

  it('formats sats as 8-decimal BCH', () => {
    expect(formatSatsAsBch(0n)).toBe('0.00000000');
    expect(formatSatsAsBch(1n)).toBe('0.00000001');
    expect(formatSatsAsBch(100_000_000n)).toBe('1.00000000');
    expect(formatSatsAsBch(12_345n)).toBe('0.00012345');
  });

  it('formats and matches outpoints', () => {
    expect(formatOutpoint('AA'.repeat(32), 1)).toBe(`${'aa'.repeat(32)}:1`);
    const utxos: UTXO[] = [
      {
        address: 'bitcoincash:qsource',
        height: 1,
        tx_hash: 'BB'.repeat(32),
        tx_pos: 2,
        value: 1500,
        token: {
          category:
            'ad95860f11111111111111111111111111111111111111111111111111115753',
          amount: 7n,
          BcmrTokenMetadata: {
            name: 'Sample',
            token: { symbol: 'SMP', decimals: 0 },
          } as never,
        },
      },
    ];
    expect(matchUtxoByOutpoint(utxos, 'bb'.repeat(32), 2)).toBe(utxos[0]);
    expect(utxoSats(utxos[0])).toBe(1500n);
    expect(
      bcmrForCategory(
        utxos,
        'AD95860F11111111111111111111111111111111111111111111111111115753'
      )
    ).toMatchObject({ name: 'Sample' });
  });

  it('only treats real BCMR name or icon as displayable identity', () => {
    expect(hasDisplayableBcmrIdentity('abcd', null, undefined)).toBe(false);
    expect(hasDisplayableBcmrIdentity('abcd', null, {})).toBe(false);
    expect(
      hasDisplayableBcmrIdentity('abcd', null, { name: 'Named Token' })
    ).toBe(true);
    expect(
      hasDisplayableBcmrIdentity('abcd', null, {
        uris: { icon: 'https://example.com/i.png' },
      })
    ).toBe(true);
  });

  it('labels an empty NFT commitment as none', () => {
    expect(nftCommitmentLabel('')).toBe('none');
    expect(nftCommitmentLabel('cafe')).toBe('cafe');
  });
});
