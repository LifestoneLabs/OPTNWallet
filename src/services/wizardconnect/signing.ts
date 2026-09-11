import {
  CompilationContextBCH,
  SigningSerializationFlag,
  binToHex,
  decodeTransaction,
  encodeTransaction,
  generateSigningSerializationBCH,
  generateTransaction,
  hash256,
  hexToBin,
  importWalletTemplate,
  lockingBytecodeToCashAddress,
  secp256k1,
  sha256,
  type Transaction,
  type TransactionTemplateFixed,
  walletTemplateP2pkhNonHd,
  walletTemplateToCompilerBCH,
} from '@bitauth/libauth';
import { DerivationPath } from '@wizardconnect/wallet';
import type { SignTransactionRequest } from '@wizardconnect/core';
import type { Network } from '../../state/slices/networkSlice';
import { PREFIX } from '../../utils/constants';
import { ensureUint8Array } from '../../utils/binary';
import { getPublicKeyCompressed } from '../../utils/hex';
import { zeroize } from '../../utils/secureMemory';
import { derivePrivateKeyForPath } from './derivation';
import {
  reviveSourceOutputs,
  reviveTransactionBins,
} from './reviveSourceOutputs';

type WalletSeedMaterial = {
  mnemonic: string;
  passphrase: string;
  network: Network;
  accountPath?: string;
};

function pathNameToDerivationPath(pathName: string): DerivationPath {
  switch (pathName) {
    case 'receive':
      return DerivationPath.Receive;
    case 'change':
      return DerivationPath.Change;
    case 'defi':
      return DerivationPath.Cauldron;
    default:
      throw new Error(`Unsupported WizardConnect path: ${pathName}`);
  }
}

export async function signWizardConnectTransaction(
  request: SignTransactionRequest,
  wallet: WalletSeedMaterial
): Promise<string> {
  const payload = request.transaction;
  const decodedTx =
    typeof payload.transaction === 'string'
      ? decodeTransaction(hexToBin(payload.transaction))
      : payload.transaction;

  if (!decodedTx || typeof decodedTx === 'string') {
    throw new Error(
      'WizardConnect transaction payload must include a structured transaction or valid raw hex'
    );
  }

  // TokenSales (and similar dapps) sanitize bins to hex strings and satoshis to
  // decimal strings before transport. Revive before libauth generateTransaction.
  const txDetails = reviveTransactionBins(decodedTx);
  const sourceOutputs = reviveSourceOutputs(payload.sourceOutputs);

  if (sourceOutputs.length === 0) {
    throw new Error('WizardConnect request is missing source outputs');
  }

  const template = importWalletTemplate(walletTemplateP2pkhNonHd);
  if (typeof template === 'string') {
    throw new Error(template);
  }
  const compiler = walletTemplateToCompilerBCH(template);
  const txTemplate = { ...txDetails } as TransactionTemplateFixed<typeof compiler>;
  const inputPaths = new Map(request.inputPaths.map(([index, path, addressIndex]) => [
    index,
    { path, addressIndex },
  ]));
  const usedKeys = new Set<Uint8Array>();
  const networkPrefix = PREFIX[wallet.network];

  try {
    for (let i = 0; i < txTemplate.inputs.length; i += 1) {
      const input = txTemplate.inputs[i];
      const utxo = sourceOutputs[i];
      if (!utxo) {
        throw new Error(`Missing source output for input ${i}`);
      }

      const pathInfo = inputPaths.get(i);
      if (!pathInfo) {
        const existingUnlockingBytecode = input.unlockingBytecode;
        const hasPresetUnlocking =
          existingUnlockingBytecode instanceof Uint8Array ||
          Array.isArray(existingUnlockingBytecode);
        if (!hasPresetUnlocking) {
          throw new Error(
            `Missing WizardConnect input path for wallet-managed input ${i}`
          );
        }
        continue;
      }

      const signerKey = await derivePrivateKeyForPath(
        wallet.mnemonic,
        wallet.passphrase,
        wallet.network,
        pathNameToDerivationPath(pathInfo.path),
        BigInt(pathInfo.addressIndex),
        wallet.accountPath
      );
      usedKeys.add(signerKey);

      if (utxo.contract?.artifact?.contractName) {
        let hexUnlock = binToHex(ensureUint8Array(utxo.unlockingBytecode));
        const sigPlaceholder = '41' + binToHex(new Uint8Array(65).fill(0));
        const pubkeyPlaceholder = '21' + binToHex(new Uint8Array(33).fill(0));
        const hashType =
          SigningSerializationFlag.allOutputs |
          SigningSerializationFlag.utxos |
          SigningSerializationFlag.forkId;

        if (hexUnlock.includes(sigPlaceholder)) {
          const context = {
            inputIndex: i,
            sourceOutputs,
            transaction: txDetails as Transaction,
          } as CompilationContextBCH;
          const preimage = generateSigningSerializationBCH(context, {
            coveredBytecode: utxo.contract.redeemScript!,
            signingSerializationType: new Uint8Array([hashType]),
          });
          const sighash = hash256(preimage);
          const sig = secp256k1.signMessageHashSchnorr(
            signerKey,
            sighash
          ) as Uint8Array;
          const sigWithType = Uint8Array.from([...sig, hashType]);
          hexUnlock = hexUnlock.replace(sigPlaceholder, '41' + binToHex(sigWithType));
        }

        if (hexUnlock.includes(pubkeyPlaceholder)) {
          const pubkey = getPublicKeyCompressed(signerKey, false) as Uint8Array;
          hexUnlock = hexUnlock.replace(pubkeyPlaceholder, '21' + binToHex(pubkey));
        }

        input.unlockingBytecode = hexToBin(hexUnlock);
        continue;
      }

      input.unlockingBytecode = {
        compiler,
        data: { keys: { privateKeys: { key: signerKey } } },
        valueSatoshis: utxo.valueSatoshis,
        script: 'unlock',
        token: utxo.token,
      };
    }

    const generated = generateTransaction(txTemplate);
    if (!generated.success) {
      throw new Error('WizardConnect transaction signing failed');
    }

    const rawSigned = encodeTransaction(generated.transaction);
    const txid = binToHex(sha256.hash(sha256.hash(rawSigned)).reverse());
    const signedTransaction = binToHex(rawSigned);

    if (request.transaction.broadcast) {
      try {
        const lockAddress = txTemplate.outputs
          .map((output) =>
            lockingBytecodeToCashAddress({
              prefix: networkPrefix,
              bytecode: ensureUint8Array(output.lockingBytecode),
            })
          )
          .find((result) => typeof result !== 'string');
        void lockAddress;
      } catch {
        // Best-effort validation only for this first pass.
      }
    }

    void txid;
    return signedTransaction;
  } finally {
    for (const key of usedKeys) {
      zeroize(key);
    }
  }
}
