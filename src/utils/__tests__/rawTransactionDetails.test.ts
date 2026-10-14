import { describe, expect, it } from 'vitest';
import type { UTXO } from '../../types/types';
import { detectTransactionBurns } from '../detectTransactionBurns';
import {
  bcmrForCategory,
  computeTransactionFeeSats,
  formatFeeRateSatsPerByte,
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

  it('formats fee rate as sats/byte with 2 decimals', () => {
    expect(formatFeeRateSatsPerByte(250n, 200)).toBe('1.25');
    expect(formatFeeRateSatsPerByte(3n, 2)).toBe('1.50');
    expect(formatFeeRateSatsPerByte(0n, 200)).toBe('0.00');
    expect(formatFeeRateSatsPerByte(100n, 0)).toBe('0.00');
  });

  it('reads BCH sats from a token+BCH UTXO without using token.amount', () => {
    const tokenPlusBch = {
      address: 'bitcoincash:qsource',
      height: 1,
      tx_hash: 'aa'.repeat(32),
      tx_pos: 0,
      satoshis: 0n,
      value: 0,
      amount: 0,
      valueSatoshis: 5460n,
      token: {
        category:
          'ad95860f11111111111111111111111111111111111111111111111111115753',
        amount: 1n,
      },
    } as UTXO & { valueSatoshis: bigint };

    expect(utxoSats(tokenPlusBch)).toBe(5460n);
    expect(utxoSats({ ...tokenPlusBch, value: 5460, valueSatoshis: 0n })).toBe(
      5460n
    );
    expect(
      utxoSats({
        ...tokenPlusBch,
        satoshis: undefined,
        value: undefined,
        amount: 5460,
        valueSatoshis: undefined,
      })
    ).toBe(5460n);
    expect(utxoSats(tokenPlusBch)).not.toBe(1n);

    const fee = computeTransactionFeeSats(
      [utxoSats(tokenPlusBch)],
      [1000n]
    );
    expect(fee).toBe(4460n);
  });

  it('matches token UTXO outpoints when tx_pos is a string or bigint index', () => {
    const utxo: UTXO = {
      address: 'bitcoincash:qsource',
      height: 1,
      tx_hash: 'cc'.repeat(32),
      tx_pos: '0' as unknown as number,
      value: 5460,
      token: {
        category:
          'ad95860f11111111111111111111111111111111111111111111111111115753',
        amount: 1n,
      },
    };
    expect(matchUtxoByOutpoint([utxo], 'cc'.repeat(32), 0)).toBe(utxo);
    expect(matchUtxoByOutpoint([utxo], 'cc'.repeat(32), 0n)).toBe(utxo);
  });
});

describe('token+BCH UTXO burn fee uses real satoshis', () => {
  it('does not treat a token+BCH input as 0 sats when satoshis is 0n', () => {
    const category =
      'ad95860f11111111111111111111111111111111111111111111111111115753';
    const report = detectTransactionBurns({
      inputs: [
        {
          address: 'bitcoincash:qsource',
          height: 800000,
          tx_hash: 'aa'.repeat(32),
          tx_pos: 0,
          satoshis: 0n,
          value: 20_000,
          token: { category, amount: 1n },
        },
      ],
      outputs: [
        {
          recipientAddress: 'bitcoincash:qrecipient',
          amount: 1000,
          token: { category, amount: 1n },
        },
      ],
      bytecodeSize: 200,
    });

    expect(report.fungibleTokens).toEqual([]);
    // 20_000 - 1_000 = 19_000, well above 10× the 200-byte relay fee.
    // Reading satoshis: 0n via ?? would yield feePaid < 0 and miss this burn.
    expect(report.bch).toEqual([{ kind: 'excess_fee', amount: 19_000n }]);
    expect(utxoSats({ satoshis: 0n, value: 20_000, amount: 0 })).toBe(20_000n);
  });
});
