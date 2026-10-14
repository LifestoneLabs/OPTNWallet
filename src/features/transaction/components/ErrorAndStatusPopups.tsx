// src/components/transaction/ErrorAndStatusPopups.tsx

import React from 'react';
import { useSelector } from 'react-redux';
import Popup from './Popup';
import { Network } from '../../../state/slices/networkSlice';
import { selectExplorerChoice } from '../../../state/slices/preferencesSlice';
import { buildTxUrl } from '../../../utils/servers/explorers';
import { shortenTxHash } from '../../../utils/shortenHash';
import { type BroadcastState } from '../../../services/TransactionService';
import { useI18n } from '../../../i18n/useI18n';
import { copyToClipboard } from '../../../utils/clipboard';
import type { UTXO } from '../../../types/types';
import type { BuiltSourceOutputView } from '../../../utils/rawTransactionDetails';
import RawTransactionDetails from './RawTransactionDetails';

interface ErrorAndStatusPopupsProps {
  showRawTxPopup: boolean;
  showTxIdPopup: boolean;
  rawTX: string;
  transactionId: string;
  errorMessage: string | null;
  currentNetwork: string;
  broadcastState?: BroadcastState;
  closePopups: () => void;
  selectedUtxos?: UTXO[];
  sourceOutputs?: BuiltSourceOutputView[];
}

const ErrorAndStatusPopups: React.FC<ErrorAndStatusPopupsProps> = ({
  showRawTxPopup,
  showTxIdPopup,
  rawTX,
  transactionId,
  errorMessage,
  currentNetwork,
  broadcastState,
  closePopups,
  selectedUtxos = [],
  sourceOutputs = [],
}) => {
  const { t } = useI18n();
  const explorerChoice = useSelector(selectExplorerChoice);

  const handleClose = () => {
    closePopups();
  };

  return (
    <>
      {showRawTxPopup && (
        <Popup closePopups={closePopups}>
          <h3 className="text-lg font-semibold flex flex-col items-center mb-2">
            {t('builder.rawTransactionDetails')}
          </h3>
          <RawTransactionDetails
            rawTX={rawTX}
            selectedUtxos={selectedUtxos}
            sourceOutputs={sourceOutputs}
            currentNetwork={currentNetwork}
            transactionId={transactionId}
          />
        </Popup>
      )}

      {showTxIdPopup && transactionId && (
        <Popup closePopups={handleClose}>
          <div className="flex flex-col items-center p-4">
            <div className="wallet-accent-icon text-4xl mb-4">✅</div>
            <h3 className="text-xl font-bold mb-2">
              {broadcastState === 'submitted'
                ? t('builder.transactionSubmitted')
                : t('builder.transactionSuccessful')}
            </h3>
            <p className="text-center mb-4">
              {broadcastState === 'submitted'
                ? t('builder.transactionSubmittedDescription')
                : t('builder.broadcastedSuccess')}
            </p>
            <div className="flex items-center mb-4">
              <strong className="mr-2">{t('builder.txId')}:</strong>
              <span className="font-mono">{shortenTxHash(transactionId)}</span>
              <button
                onClick={() => void copyToClipboard(transactionId)}
                className="wallet-btn-secondary ml-2 px-2 py-1"
                title={t('builder.copyToClipboard')}
              >
                📋
              </button>
            </div>
            <a
              href={buildTxUrl(
                explorerChoice,
                currentNetwork === Network.CHIPNET
                  ? Network.CHIPNET
                  : Network.MAINNET,
                transactionId
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="wallet-btn-primary py-2 px-4"
            >
              {t('builder.viewExplorer')}
            </a>
          </div>
        </Popup>
      )}

      {errorMessage && (
        <Popup closePopups={closePopups} closeButtonText={t('builder.close')}>
          <div className="flex flex-col items-center p-6">
            <div className="wallet-danger-text text-4xl mb-4">⚠️</div>
            <h3 className="text-2xl font-bold wallet-text-strong mb-3">
              {t('builder.transactionError')}
            </h3>
            <p className="wallet-muted text-center text-sm mb-6">
              {errorMessage}
            </p>
            <button
              onClick={closePopups}
              className="wallet-btn-danger py-2 px-6"
            >
              {t('builder.tryAgain')}
            </button>
          </div>
        </Popup>
      )}
    </>
  );
};

export default ErrorAndStatusPopups;
