import { binToHex, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';

import {
  reviveBin,
  reviveSatoshis,
  reviveSourceOutput,
  reviveSourceOutputs,
  reviveTransactionBins,
} from '../reviveSourceOutputs';

const CATEGORY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const TXID_HEX = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const LOCK_HEX = '76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac';

describe('reviveSourceOutputs', () => {
  it('revives TokenSales-style hex bins and string satoshis', () => {
    const revived = reviveSourceOutput({
      outpointTransactionHash: TXID_HEX,
      outpointIndex: 1,
      lockingBytecode: LOCK_HEX,
      unlockingBytecode: '',
      valueSatoshis: '546',
      token: {
        category: CATEGORY_HEX,
        amount: '0',
        nft: {
          capability: 'mutable',
          commitment: 'deadbeef',
        },
      },
      contract: {
        redeemScript: '51',
        artifact: { contractName: 'Example' },
      },
    });

    expect(revived.outpointTransactionHash).toBeInstanceOf(Uint8Array);
    expect(binToHex(revived.outpointTransactionHash as Uint8Array)).toBe(TXID_HEX);
    expect(revived.lockingBytecode).toBeInstanceOf(Uint8Array);
    expect(binToHex(revived.lockingBytecode as Uint8Array)).toBe(LOCK_HEX);
    expect(revived).not.toHaveProperty('unlockingBytecode');
    expect(revived.valueSatoshis).toBe(546n);
    expect(revived.token?.category).toBeInstanceOf(Uint8Array);
    expect(binToHex(revived.token!.category)).toBe(CATEGORY_HEX);
    // libauth token encoding path uses category.slice().reverse()
    expect(() => revived.token!.category.slice().reverse()).not.toThrow();
    expect(revived.token?.amount).toBe(0n);
    expect(revived.token?.nft?.commitment).toBeInstanceOf(Uint8Array);
    expect(binToHex(revived.token!.nft!.commitment as Uint8Array)).toBe('deadbeef');
    expect(revived.contract?.redeemScript).toBeInstanceOf(Uint8Array);
    expect(binToHex(revived.contract!.redeemScript)).toBe('51');
  });

  it('accepts tagged parseExtendedJson forms and leaves correct types alone', () => {
    const category = hexToBin(CATEGORY_HEX);
    const revived = reviveSourceOutput({
      outpointTransactionHash: `<Uint8Array: 0x${TXID_HEX}>`,
      outpointIndex: 0,
      lockingBytecode: hexToBin(LOCK_HEX),
      valueSatoshis: '<bigint: 1000n>',
      token: {
        category,
        amount: 7n,
      },
    });

    expect(binToHex(revived.outpointTransactionHash as Uint8Array)).toBe(TXID_HEX);
    expect(revived.lockingBytecode).toBeInstanceOf(Uint8Array);
    expect(revived.valueSatoshis).toBe(1000n);
    expect(revived.token?.category).toBe(category);
    expect(revived.token?.amount).toBe(7n);
  });

  it('maps arrays via reviveSourceOutputs', () => {
    const list = reviveSourceOutputs([
      {
        outpointTransactionHash: TXID_HEX,
        outpointIndex: 0,
        lockingBytecode: LOCK_HEX,
        valueSatoshis: '1',
      },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].valueSatoshis).toBe(1n);
  });

  it('revives structured transaction bins', () => {
    const tx = reviveTransactionBins({
      version: 2,
      locktime: 0,
      inputs: [
        {
          outpointTransactionHash: TXID_HEX,
          outpointIndex: 0,
          unlockingBytecode: '',
          sequenceNumber: 0xffffffff,
        },
      ],
      outputs: [
        {
          lockingBytecode: LOCK_HEX,
          valueSatoshis: '546',
          token: { category: CATEGORY_HEX, amount: '0' },
        },
      ],
    });

    expect(tx.inputs![0].outpointTransactionHash).toBeInstanceOf(Uint8Array);
    expect(tx.inputs![0].unlockingBytecode).toBeInstanceOf(Uint8Array);
    expect((tx.inputs![0].unlockingBytecode as Uint8Array).length).toBe(0);
    expect(tx.outputs![0].valueSatoshis).toBe(546n);
    expect(tx.outputs![0].token?.category).toBeInstanceOf(Uint8Array);
  });

  it('reviveBin / reviveSatoshis helpers are idempotent for correct types', () => {
    const bin = hexToBin('abcd');
    expect(reviveBin(bin)).toBe(bin);
    expect(reviveSatoshis(42n)).toBe(42n);
    expect(reviveSatoshis('99')).toBe(99n);
  });
});
