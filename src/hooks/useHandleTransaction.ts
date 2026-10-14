// src/hooks/useHandleTransaction.ts

import { useState } from 'react';
import { useDispatch } from 'react-redux';
import TransactionService, {
  type BroadcastResult,
  type BroadcastState,
} from '../services/TransactionService';
import { Toast } from '@capacitor/toast';
import { TransactionOutput, UTXO } from '../types/types';
import {
  clearTransaction,
  setTxOutputs,
} from '../state/slices/transactionBuilderSlice';
import { resetContract } from '../state/slices/contractSlice';
import { logError, toErrorMessage } from '../utils/errorHandling';
import {
  assertSafeTransactionValues,
  detectTransactionBurns,
  hasTransactionBurns,
  utxoSats,
  type TransactionBurnReport,
} from '../utils/detectTransactionBurns';
import type { BuiltSourceOutput } from '../apis/TransactionManager/TransactionBuilderHelper';
// import { optimisticRemoveSpentByOutpoints, requestUTXORefreshForMany } from '../workers/UTXOWorkerService';

interface BuildTransactionResult {
  bytecodeSize: number;
  finalTransaction: string;
  finalOutputs: TransactionOutput[] | null;
  errorMsg: string;
  sourceOutputs?: BuiltSourceOutput[];
}

const useHandleTransaction = (
  txOutputs: TransactionOutput[],
  contractFunctionInputs: { [key: string]: string } | null,
  changeAddress: string,
  selectedUtxos: UTXO[],
  setBytecodeSize: (value: number) => void,
  setRawTX: React.Dispatch<React.SetStateAction<string>>,
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>,
  setShowRawTxPopup: React.Dispatch<React.SetStateAction<boolean>>,
  setShowTxIdPopup: React.Dispatch<React.SetStateAction<boolean>>, // Added parameter
  setBroadcastState: React.Dispatch<React.SetStateAction<BroadcastState>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  onBroadcastSuccess?: () => void
) => {
  const dispatch = useDispatch();
  const [burnReport, setBurnReport] = useState<TransactionBurnReport | null>(
    null
  );
  const [showBurnConfirm, setShowBurnConfirm] = useState(false);
  const [sourceOutputs, setSourceOutputs] = useState<BuiltSourceOutput[]>([]);

  const handleBuildTransaction = async () => {
    if (selectedUtxos.length === 0) {
      setErrorMessage('No input selected');
      setRawTX('');
      return;
    }
    // Calculate the sum of selected UTXOs as bigint
    const inputSum = selectedUtxos.reduce(
      (sum, utxo) => sum + utxoSats(utxo),
      0n
    );

    // Calculate the sum of transaction outputs as bigint
    const outputSum = txOutputs.reduce((sum, txOutput) => {
      // Ensure that txOutput.amount is a bigint
      const txAmount =
        'amount' in txOutput && txOutput.amount !== undefined
          ? BigInt(txOutput.amount)
          : 0n;
      return sum + txAmount;
    }, 0n);

    // await Toast.show({
    //   text: `Input: ${inputSum}, Output: ${outputSum}`,
    // });

    if (outputSum > inputSum || inputSum === BigInt(0)) {
      setErrorMessage(
        'Error building transaction: ' + 'output amount exceeds inputs'
      );
      setRawTX('');
      return;
    }

    setBytecodeSize(0);
    setRawTX('');

    try {
      setLoading(true);
      // console.log('Building transaction with:');
      // console.log('Outputs:', txOutputs);
      // console.log('Contract Function Inputs:', contractFunctionInputs);
      // console.log('Selected UTXOs:', selectedUtxos); // **Add Logging**

      // If a contract function is selected, ensure inputs are provided
      if (
        contractFunctionInputs &&
        Object.keys(contractFunctionInputs).length === 0
      ) {
        setErrorMessage(
          'Please provide all required contract function inputs.'
        );
        setLoading(false);
        return;
      }

      const transaction: BuildTransactionResult =
        await TransactionService.buildTransaction(
          txOutputs,
          contractFunctionInputs,
          changeAddress,
          selectedUtxos,
          true
        );

      // await Toast.show({
      //   text: `Input: ${transaction.bytecodeSize}, Output: ${transaction.errorMsg}, Input: ${transaction.finalOutputs}, Output: ${transaction.finalTransaction}`,
      // });

      if (!transaction.finalTransaction) {
        setBurnReport(null);
        setShowBurnConfirm(false);
        setSourceOutputs([]);
        setErrorMessage(`Failed to build transaction: ${transaction.errorMsg}`);
        setLoading(false);
        return;
      }

      // console.log('Transaction Build Result:', transaction);

      // Update Redux outputs state with finalOutputs
      if (transaction.finalOutputs) {
        setBytecodeSize(transaction.bytecodeSize);
        setRawTX(transaction.finalTransaction);
        setSourceOutputs(transaction.sourceOutputs ?? []);
        // Clear existing outputs
        dispatch(clearTransaction());

        // Set the entire txOutputs array to finalOutputs
        dispatch(setTxOutputs(transaction.finalOutputs));

        // console.log('Final Outputs after Build:', transaction.finalOutputs);
      }

      const report = detectTransactionBurns({
        inputs: selectedUtxos,
        outputs: transaction.finalOutputs ?? [],
        bytecodeSize: transaction.bytecodeSize,
        txHex: transaction.finalTransaction,
      });
      const burnsDetected = hasTransactionBurns(report);
      setBurnReport(burnsDetected ? report : null);
      setShowBurnConfirm(burnsDetected);

      setErrorMessage(transaction.errorMsg);
      setShowRawTxPopup(true);
      setLoading(false);
    } catch (err) {
      logError('useHandleTransaction.handleBuildTransaction', err, {
        outputCount: txOutputs.length,
        utxoCount: selectedUtxos.length,
      });
      setRawTX('');
      setBurnReport(null);
      setShowBurnConfirm(false);
      setSourceOutputs([]);
      setErrorMessage('Error building transaction: ' + toErrorMessage(err));
      setShowRawTxPopup(true);
      setLoading(false);
    }
  };

  const handleSendTransaction = async (
    rawTX: string,
    setTransactionId: React.Dispatch<React.SetStateAction<string>>,
    options?: { confirmBurns?: boolean }
  ): Promise<BroadcastResult> => {
    if (
      burnReport &&
      hasTransactionBurns(burnReport) &&
      !options?.confirmBurns
    ) {
      setShowBurnConfirm(true);
      return { txid: null, errorMessage: null };
    }

    try {
      const inputTotal =
        sourceOutputs.length > 0
          ? sourceOutputs.reduce(
              (sum, source) => sum + (source.valueSatoshis ?? 0n),
              0n
            )
          : selectedUtxos.reduce((sum, utxo) => sum + utxoSats(utxo), 0n);
      const outputTotal = txOutputs.reduce((sum, output) => {
        if ('amount' in output && output.amount !== undefined) {
          return sum + BigInt(output.amount);
        }
        return sum;
      }, 0n);
      const changeOutput = txOutputs.find(
        (output) =>
          'recipientAddress' in output &&
          output.recipientAddress === changeAddress
      );
      assertSafeTransactionValues({
        inputTotal,
        outputTotal,
        changeSats:
          changeOutput && 'amount' in changeOutput
            ? BigInt(changeOutput.amount ?? 0)
            : undefined,
      });

      setLoading(true);
      const transactionID = await TransactionService.sendTransaction(
        rawTX,
        selectedUtxos,
        {
          source: 'transaction-builder',
          sourceLabel: 'Transaction Builder',
          amountSummary: `${txOutputs.length} output${txOutputs.length === 1 ? '' : 's'}`,
        }
      );

      // If we didn't get a txid, treat as an error even if no errorMessage was returned.
      if (!transactionID?.txid) {
        const msg =
          transactionID?.errorMessage ?? 'Broadcast failed (no txid returned).';
        setErrorMessage(msg);
        await Toast.show({ text: `Error: ${msg}` });
        setShowTxIdPopup(false);
        setLoading(false);
        return { txid: null, errorMessage: msg };
      }

      // Success path
      setTransactionId(transactionID.txid);
      setBroadcastState(transactionID.broadcastState ?? 'broadcasted');
      setShowTxIdPopup(true);

      // Clear state only on success
      setRawTX('');
      setBurnReport(null);
      setShowBurnConfirm(false);
      dispatch(clearTransaction());
      dispatch(resetContract());
      onBroadcastSuccess?.();

      setLoading(false);
      return transactionID;
    } catch (error) {
      logError('useHandleTransaction.handleSendTransaction', error, {
        selectedUtxoCount: selectedUtxos.length,
      });
      const message = toErrorMessage(error);
      setErrorMessage('Error sending transaction: ' + message);
      setShowTxIdPopup(false);
      setLoading(false);
      return { txid: null, errorMessage: message };
    }
  };

  const cancelBurnConfirm = () => {
    setShowBurnConfirm(false);
  };

  const confirmBurnAndBroadcast = (
    rawTX: string,
    setTransactionId: React.Dispatch<React.SetStateAction<string>>
  ): Promise<BroadcastResult> => {
    setShowBurnConfirm(false);
    return handleSendTransaction(rawTX, setTransactionId, {
      confirmBurns: true,
    });
  };

  return {
    handleBuildTransaction,
    handleSendTransaction,
    burnReport,
    showBurnConfirm,
    sourceOutputs,
    cancelBurnConfirm,
    confirmBurnAndBroadcast,
  };
};

export default useHandleTransaction;
