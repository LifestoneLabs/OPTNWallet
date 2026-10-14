import React, { useEffect, useRef } from 'react';
import { useI18n } from '../../../i18n/useI18n';
import type { TransactionBurnReport } from '../../../utils/detectTransactionBurns';

type BurnConfirmDialogProps = {
  open: boolean;
  report: TransactionBurnReport | null;
  onCancel: () => void;
  onConfirm: () => void;
};

const BurnConfirmDialog: React.FC<BurnConfirmDialogProps> = ({
  open,
  report,
  onCancel,
  onConfirm,
}) => {
  const { t } = useI18n();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open || !report) return null;

  return (
    <div
      className="wallet-dialog-backdrop"
      role="presentation"
      onMouseDown={onCancel}
    >
      <section
        className="wallet-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="burn-confirm-title"
        aria-describedby="burn-confirm-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="burn-confirm-title" className="wallet-dialog-title">
          {t('builder.burnConfirmTitle')}
        </h2>
        <p id="burn-confirm-description" className="wallet-dialog-message">
          {t('builder.burnConfirmDescription')}
        </p>

        <div className="mb-3 max-h-[40vh] space-y-3 overflow-y-auto text-sm">
          {report.fungibleTokens.length > 0 && (
            <section>
              <h3 className="mb-1 font-semibold wallet-text-strong">
                {t('builder.burnConfirmFungible')}
              </h3>
              <ul className="space-y-2">
                {report.fungibleTokens.map((token) => (
                  <li
                    key={`ft-${token.category}`}
                    className="rounded-lg border border-[var(--wallet-border)] p-2 wallet-surface-strong"
                  >
                    <div className="font-mono break-all text-xs">
                      {token.category}
                    </div>
                    <div className="mt-1">
                      {t('builder.fungibleAmount')}: {token.amount.toString()}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {report.nfts.length > 0 && (
            <section>
              <h3 className="mb-1 font-semibold wallet-text-strong">
                {t('builder.burnConfirmNfts')}
              </h3>
              <ul className="space-y-2">
                {report.nfts.map((nft, index) => (
                  <li
                    key={`nft-${nft.category}-${nft.commitment}-${nft.capability}-${index}`}
                    className="rounded-lg border border-[var(--wallet-border)] p-2 wallet-surface-strong"
                  >
                    <div className="font-mono break-all text-xs">
                      {nft.category}
                    </div>
                    <div className="mt-1">
                      {t('builder.capability')}: {nft.capability || '—'}
                    </div>
                    <div className="font-mono break-all text-xs">
                      {t('builder.commitment')}: {nft.commitment || '—'}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {report.bch.length > 0 && (
            <section>
              <h3 className="mb-1 font-semibold wallet-text-strong">
                {t('builder.burnConfirmBch')}
              </h3>
              <ul className="space-y-1">
                {report.bch.map((item, index) => (
                  <li key={`${item.kind}-${index}`}>
                    {item.kind === 'op_return'
                      ? t('builder.burnConfirmOpReturn', {
                          amount: item.amount.toString(),
                        })
                      : t('builder.burnConfirmExcessFee', {
                          amount: item.amount.toString(),
                        })}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <p className="mb-3 text-sm font-semibold wallet-danger-text">
          {t('builder.burnConfirmIrreversible')}
        </p>

        <div className="wallet-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="wallet-btn-secondary wallet-dialog-button"
            onClick={onCancel}
          >
            {t('confirm.cancel')}
          </button>
          <button
            type="button"
            className="wallet-btn-danger wallet-dialog-button"
            onClick={onConfirm}
          >
            {t('builder.burnAndBroadcast')}
          </button>
        </div>
      </section>
    </div>
  );
};

export default BurnConfirmDialog;
