import React, { useMemo } from 'react';
import {
  binToHex,
  decodeTransactionCommon,
  hexToBin,
  Input,
  lockingBytecodeToCashAddress,
  Output,
  TransactionCommon,
} from '@bitauth/libauth';
import { Network } from '../../../state/slices/networkSlice';
import type { UTXO } from '../../../types/types';
import { PREFIX } from '../../../utils/constants';
import { ensureUint8Array } from '../../../utils/binary';
import { deriveTrackedTxid } from '../../../services/OutboundTransactionTracker';
import {
  bcmrForCategory,
  computeTransactionFeeSats,
  formatOutpoint,
  formatSatsAsBch,
  matchUtxoByOutpoint,
  utxoSats,
  type RawTxIoView,
} from '../../../utils/rawTransactionDetails';
import useTokenMetadata from '../../../hooks/useTokenMetadata';
import { useI18n } from '../../../i18n/useI18n';
import RawTxIoCard from './RawTxIoCard';

type RawTransactionDetailsProps = {
  rawTX: string;
  selectedUtxos: UTXO[];
  currentNetwork: string;
  transactionId?: string;
};

function prevoutTxidHex(hash: Uint8Array | number[]): string {
  const bytes = Uint8Array.from(ensureUint8Array(hash));
  return binToHex(bytes.reverse());
}

function toCashAddress(
  bytecode: Uint8Array,
  prefix: 'bitcoincash' | 'bchtest' | 'bchreg'
): string | null {
  try {
    const result = lockingBytecodeToCashAddress({ bytecode, prefix });
    return typeof result === 'string' ? null : result.address;
  } catch {
    return null;
  }
}

function parsePushData(bytecode: Uint8Array): string[] {
  const result: string[] = [];
  let i = 1;
  while (i < bytecode.length) {
    const len = bytecode[i];
    i += 1;
    const chunk = bytecode.slice(i, i + len);
    const hex = binToHex(chunk);
    const ascii = new TextDecoder('utf-8', { fatal: false }).decode(chunk);
    result.push(`${ascii} (0x${hex})`);
    i += len;
  }
  return result;
}

const RawTransactionDetails: React.FC<RawTransactionDetailsProps> = ({
  rawTX,
  selectedUtxos,
  currentNetwork,
  transactionId,
}) => {
  const { t } = useI18n();
  const decodedTx = useMemo(() => {
    try {
      const bin = hexToBin(rawTX);
      const result = decodeTransactionCommon(bin);
      return typeof result === 'string'
        ? null
        : (result as TransactionCommon<Input, Output>);
    } catch (error) {
      console.error('Failed to decode transaction:', error);
      return null;
    }
  }, [rawTX]);

  const builtTxid = transactionId || deriveTrackedTxid(rawTX);

  const io = useMemo(() => {
    if (!decodedTx) {
      return { inputs: [] as RawTxIoView[], outputs: [] as RawTxIoView[] };
    }

    const prefix =
      currentNetwork === Network.MAINNET ? PREFIX.mainnet : PREFIX.chipnet;

    const inputs: RawTxIoView[] = decodedTx.inputs.map((input, index) => {
      const prevoutTxid = prevoutTxidHex(input.outpointTransactionHash);
      const matched = matchUtxoByOutpoint(
        selectedUtxos,
        prevoutTxid,
        input.outpointIndex
      );
      const token = matched?.token ?? matched?.token_data ?? null;
      return {
        kind: 'input',
        index,
        sats: matched ? utxoSats(matched) : 0n,
        outpoint: formatOutpoint(prevoutTxid, input.outpointIndex),
        address: matched?.address ?? null,
        isOpReturn: false,
        opReturnChunks: [],
        token: token?.category
          ? {
              category: token.category,
              ftAmount:
                typeof token.amount === 'bigint'
                  ? token.amount
                  : BigInt(token.amount ?? 0),
              nft: token.nft
                ? {
                    capability: token.nft.capability || 'none',
                    commitment: token.nft.commitment ?? '',
                  }
                : null,
              bcmr: token.BcmrTokenMetadata ?? null,
            }
          : null,
      };
    });

    const outputs: RawTxIoView[] = decodedTx.outputs.map((output, index) => {
      const lockingBytecode = ensureUint8Array(output.lockingBytecode);
      const isOpReturn = lockingBytecode[0] === 0x6a;
      const token = output.token;
      const category = token ? binToHex(ensureUint8Array(token.category)) : '';
      const commitment = token?.nft?.commitment
        ? binToHex(ensureUint8Array(token.nft.commitment))
        : '';
      return {
        kind: 'output',
        index,
        sats:
          typeof output.valueSatoshis === 'bigint'
            ? output.valueSatoshis
            : BigInt(output.valueSatoshis ?? 0),
        outpoint: builtTxid ? formatOutpoint(builtTxid, index) : null,
        address: isOpReturn
          ? null
          : toCashAddress(lockingBytecode, prefix as 'bitcoincash' | 'bchtest'),
        isOpReturn,
        opReturnChunks: isOpReturn ? parsePushData(lockingBytecode) : [],
        token: token
          ? {
              category,
              ftAmount:
                typeof token.amount === 'bigint'
                  ? token.amount
                  : BigInt(token.amount ?? 0),
              nft: token.nft
                ? {
                    capability: token.nft.capability || 'none',
                    commitment,
                  }
                : null,
              bcmr: bcmrForCategory(selectedUtxos, category),
            }
          : null,
      };
    });

    return { inputs, outputs };
  }, [builtTxid, currentNetwork, decodedTx, selectedUtxos]);

  const categories = useMemo(
    () =>
      [...io.inputs, ...io.outputs]
        .map((item) => item.token?.category)
        .filter((category): category is string => Boolean(category)),
    [io]
  );
  const tokenMetadata = useTokenMetadata(categories);

  const feeSats = computeTransactionFeeSats(
    io.inputs.map((item) => item.sats),
    io.outputs.map((item) => item.sats)
  );

  if (!decodedTx) {
    return (
      <>
        <p className="text-sm mb-2 wallet-danger-text">
          {t('builder.decodeFailed')}
        </p>
        <textarea
          readOnly
          value={rawTX}
          className="w-full h-40 p-2 border rounded text-xs wallet-input"
        />
      </>
    );
  }

  return (
    <div className="max-h-[60vh] space-y-3 overflow-y-auto text-sm">
      <section className="wallet-card space-y-2 p-3">
        <h4 className="text-sm font-semibold wallet-text-strong">
          {t('builder.inputs')}
        </h4>
        <div className="space-y-2">
          {io.inputs.map((item) => (
            <RawTxIoCard
              key={`in-${item.index}-${item.outpoint}`}
              item={item}
              metadata={
                item.token ? tokenMetadata[item.token.category] ?? null : null
              }
            />
          ))}
        </div>
      </section>

      <section className="wallet-card space-y-2 p-3">
        <h4 className="text-sm font-semibold wallet-text-strong">
          {t('builder.outputs')}
        </h4>
        <div className="space-y-2">
          {io.outputs.map((item) => (
            <RawTxIoCard
              key={`out-${item.index}-${item.outpoint}`}
              item={item}
              metadata={
                item.token ? tokenMetadata[item.token.category] ?? null : null
              }
            />
          ))}
        </div>
      </section>

      <section className="wallet-section space-y-1 p-3">
        <h4 className="text-sm font-semibold wallet-text-strong">
          {t('builder.minerFee')}
        </h4>
        <p className="text-sm wallet-text-strong">
          {formatSatsAsBch(feeSats)} {t('txDetails.bch')} ({feeSats.toString()}{' '}
          {t('txSummary.sats')})
        </p>
        <p className="text-xs wallet-muted">{t('builder.minerFeeToMiners')}</p>
      </section>
    </div>
  );
};

export default RawTransactionDetails;
