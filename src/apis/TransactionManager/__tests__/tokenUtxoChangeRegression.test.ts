import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeTransactionCommon,
  hexToBin,
  lockingBytecodeToCashAddress,
  privateKeyToP2pkhLockingBytecode,
} from '@bitauth/libauth';

import type { UTXO } from '../../../types/types';
import { requiredFeeForBytes } from '../feePolicy';
import { toTokenAwareCashAddress } from '../../../utils/cashAddress';
import { utxoSats } from '../../../utils/detectTransactionBurns';
import KeyService from '../../../services/KeyService';
import TransactionManager from '../TransactionManager';

const TEST_PRIVATE_KEY = hexToBin(
  '1111111111111111111111111111111111111111111111111111111111111111'
);
const CATEGORY =
  'ad95860f11111111111111111111111111111111111111111111111111115753';

vi.mock('../../../services/KeyService', () => ({
  default: {
    fetchAddressPrivateKey: vi.fn(),
  },
}));

vi.mock('../../../state/store', () => ({
  store: {
    dispatch: vi.fn(),
    getState: vi.fn(() => ({
      network: { currentNetwork: 'mainnet' },
      wallet_id: { currentWalletId: 1 },
    })),
  },
}));

function p2pkhAddress(): string {
  const bytecode = privateKeyToP2pkhLockingBytecode({
    privateKey: TEST_PRIVATE_KEY,
    throwErrors: true,
  });
  const result = lockingBytecodeToCashAddress({
    prefix: 'bitcoincash',
    bytecode,
  });
  if (typeof result === 'string') {
    throw new Error(result);
  }
  return result.address;
}

/**
 * Wallet/Electrum token UTXO shape plus the stale protocol fields that
 * first-positive utxoSats used to prefer (8500 → change 7220).
 */
function kyleTokenUtxo(address: string): UTXO {
  return {
    address,
    height: 800000,
    tx_hash: 'aa'.repeat(32),
    tx_pos: 0,
    value: 6500,
    amount: 6500,
    satoshis: 0n,
    token: { category: CATEGORY, amount: 1n },
    ...({ valueSatoshis: 8500n } as { valueSatoshis: bigint }),
  };
}

describe('Kyle token+BCH UTXO auto-change regression', () => {
  const mockedKeyService = vi.mocked(KeyService);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedKeyService.fetchAddressPrivateKey.mockResolvedValue(TEST_PRIVATE_KEY);
  });

  it('builds 6500 in / 1000+FT out with auto-change, not 7220', async () => {
    const address = p2pkhAddress();
    const tokenAddress = toTokenAwareCashAddress(address);
    const selectedUtxo = kyleTokenUtxo(address);

    console.info('kyle fixture selected UTXO', {
      value: selectedUtxo.value,
      amount: selectedUtxo.amount,
      satoshis: selectedUtxo.satoshis,
      valueSatoshis: (selectedUtxo as UTXO & { valueSatoshis?: bigint })
        .valueSatoshis,
      tokenAmount: selectedUtxo.token?.amount,
      utxoSats: utxoSats(selectedUtxo).toString(),
    });

    expect(utxoSats(selectedUtxo)).toBe(6500n);

    const res = await TransactionManager().buildTransaction(
      [
        {
          recipientAddress: tokenAddress,
          amount: 1000,
          token: { category: CATEGORY, amount: 1n },
        },
      ],
      null,
      address,
      [selectedUtxo],
      true
    );

    expect(res.errorMsg).toBe('');
    expect(res.finalTransaction).toMatch(/^[0-9a-f]+$/i);
    expect(res.sourceOutputs).toHaveLength(1);
    expect(res.sourceOutputs[0]?.valueSatoshis).toBe(6500n);

    const decoded = decodeTransactionCommon(hexToBin(res.finalTransaction));
    expect(typeof decoded).not.toBe('string');
    if (typeof decoded === 'string') {
      throw new Error(decoded);
    }

    const outputSats = decoded.outputs.map((output) =>
      typeof output.valueSatoshis === 'bigint'
        ? output.valueSatoshis
        : BigInt(output.valueSatoshis ?? 0)
    );
    expect(outputSats[0]).toBe(1000n);
    expect(outputSats).toHaveLength(2);

    const change = outputSats[1];
    const fee = 6500n - outputSats.reduce((sum, value) => sum + value, 0n);
    const estimate = requiredFeeForBytes(res.bytecodeSize);

    console.info('kyle decoded built tx', {
      bytecodeSize: res.bytecodeSize,
      sourceOutputSats: res.sourceOutputs[0]?.valueSatoshis.toString(),
      outputs: outputSats.map((value) => value.toString()),
      change: change.toString(),
      fee: fee.toString(),
      estimate: estimate.toString(),
      plannedChange: String(
        res.finalOutputs?.[1] && 'amount' in res.finalOutputs[1]
          ? res.finalOutputs[1].amount
          : ''
      ),
    });

    expect(change).toBeGreaterThan(0n);
    expect(change).toBeLessThan(6500n);
    expect(change).not.toBe(7220n);
    expect(fee).toBeGreaterThan(0n);
    expect(fee + 1000n + change).toBe(6500n);
    expect(fee).toBeGreaterThanOrEqual(estimate);
    expect(fee - estimate).toBeLessThanOrEqual(20n);
    expect(res.finalOutputs?.[1]).toMatchObject({
      recipientAddress: address,
      amount: Number(change),
    });
  });
});
