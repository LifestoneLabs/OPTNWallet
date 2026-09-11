import type { Input, Output } from '@bitauth/libauth';
import type { ContractInfo } from '../../types/wcInterfaces';
import { ensureUint8Array, parseSatoshis } from '../../utils/binary';

type MutableRecord = Record<string, unknown>;

function isEmptyHexOrBin(value: unknown): boolean {
  if (value == null) return true;
  if (value instanceof Uint8Array) return value.length === 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return true;
    const hex = trimmed
      .replace(/^<Uint8Array:\s*0x/i, '')
      .replace(/^0x/i, '')
      .replace(/>$/, '');
    return hex.length === 0;
  }
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Revive a TokenSales / WizardConnect sanitize payload field that may arrive as
 * hex string, tagged `<Uint8Array: 0x…>`, number[], or already-Uint8Array.
 */
export function reviveBin(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  return ensureUint8Array(value);
}

/**
 * Revive satoshi / token amount fields that may arrive as string, number,
 * tagged `<bigint: Nn>`, or already-bigint.
 */
export function reviveSatoshis(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  return parseSatoshis(value);
}

function reviveToken(token: unknown): Output['token'] | undefined {
  if (token == null) return undefined;
  if (typeof token !== 'object') return undefined;

  const raw = token as MutableRecord;
  const revived: MutableRecord = {
    ...raw,
    category: reviveBin(raw.category),
    amount: reviveSatoshis(raw.amount ?? 0n),
  };

  if (raw.nft && typeof raw.nft === 'object') {
    const nft = raw.nft as MutableRecord;
    revived.nft = {
      ...nft,
      commitment:
        nft.commitment === undefined || nft.commitment === null
          ? nft.commitment
          : reviveBin(nft.commitment),
    };
  }

  return revived as Output['token'];
}

function reviveContract(contract: unknown): ContractInfo['contract'] | undefined {
  if (contract == null || typeof contract !== 'object') return undefined;
  const raw = contract as MutableRecord;
  const revived: MutableRecord = { ...raw };
  if (raw.redeemScript !== undefined && raw.redeemScript !== null) {
    revived.redeemScript = reviveBin(raw.redeemScript);
  }
  return revived as ContractInfo['contract'];
}

/**
 * Revive one sourceOutput so libauth can call `.slice().reverse()` on binary
 * fields (notably `token.category`) and treat amounts as bigint.
 *
 * Empty `unlockingBytecode` ("" / empty hex) is omitted so inputPaths-driven
 * signing can supply the unlock, matching WalletConnect behavior.
 */
export function reviveSourceOutput(
  source: unknown
): Input & Output & ContractInfo {
  if (!source || typeof source !== 'object') {
    throw new Error('WizardConnect sourceOutput must be an object');
  }

  const raw = source as MutableRecord;
  const revived: MutableRecord = { ...raw };

  if (raw.lockingBytecode !== undefined && raw.lockingBytecode !== null) {
    revived.lockingBytecode = reviveBin(raw.lockingBytecode);
  }

  if ('unlockingBytecode' in raw) {
    if (isEmptyHexOrBin(raw.unlockingBytecode)) {
      delete revived.unlockingBytecode;
    } else {
      revived.unlockingBytecode = reviveBin(raw.unlockingBytecode);
    }
  }

  if (
    raw.outpointTransactionHash !== undefined &&
    raw.outpointTransactionHash !== null
  ) {
    revived.outpointTransactionHash = reviveBin(raw.outpointTransactionHash);
  }

  if (raw.valueSatoshis !== undefined && raw.valueSatoshis !== null) {
    revived.valueSatoshis = reviveSatoshis(raw.valueSatoshis);
  }

  if (raw.token !== undefined) {
    revived.token = reviveToken(raw.token);
  }

  if (raw.contract !== undefined) {
    revived.contract = reviveContract(raw.contract);
  }

  return revived as Input & Output & ContractInfo;
}

export function reviveSourceOutputs(
  sourceOutputs: unknown
): Array<Input & Output & ContractInfo> {
  if (!Array.isArray(sourceOutputs)) {
    throw new Error('WizardConnect sourceOutputs must be an array');
  }
  return sourceOutputs.map((entry, index) => {
    try {
      return reviveSourceOutput(entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid WizardConnect sourceOutput at index ${index}: ${message}`);
    }
  });
}

/**
 * Revive binary / satoshi fields on a structured libauth transaction so
 * generateTransaction does not see hex strings for lockingBytecode etc.
 */
export function reviveTransactionBins<T extends { inputs?: unknown[]; outputs?: unknown[] }>(
  transaction: T
): T {
  const reviveIo = (entry: unknown): unknown => {
    if (!entry || typeof entry !== 'object') return entry;
    const raw = entry as MutableRecord;
    const revived: MutableRecord = { ...raw };

    if (raw.lockingBytecode !== undefined && raw.lockingBytecode !== null) {
      revived.lockingBytecode = reviveBin(raw.lockingBytecode);
    }
    if ('unlockingBytecode' in raw) {
      if (isEmptyHexOrBin(raw.unlockingBytecode)) {
        revived.unlockingBytecode = new Uint8Array();
      } else {
        revived.unlockingBytecode = reviveBin(raw.unlockingBytecode);
      }
    }
    if (
      raw.outpointTransactionHash !== undefined &&
      raw.outpointTransactionHash !== null
    ) {
      revived.outpointTransactionHash = reviveBin(raw.outpointTransactionHash);
    }
    if (raw.valueSatoshis !== undefined && raw.valueSatoshis !== null) {
      revived.valueSatoshis = reviveSatoshis(raw.valueSatoshis);
    }
    if (raw.token !== undefined) {
      revived.token = reviveToken(raw.token);
    }
    return revived;
  };

  return {
    ...transaction,
    inputs: Array.isArray(transaction.inputs)
      ? transaction.inputs.map(reviveIo)
      : transaction.inputs,
    outputs: Array.isArray(transaction.outputs)
      ? transaction.outputs.map(reviveIo)
      : transaction.outputs,
  };
}
