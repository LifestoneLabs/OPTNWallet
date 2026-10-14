import React, { useId, useState } from 'react';
import TokenIdentityBadge from '../../../components/ui/TokenIdentityBadge';
import { useI18n } from '../../../i18n/useI18n';
import { copyToClipboard } from '../../../utils/clipboard';
import {
  formatSatsAsBch,
  hasDisplayableBcmrIdentity,
  nftCommitmentLabel,
  tokenPresentationForRawTx,
  type RawTxIoView,
} from '../../../utils/rawTransactionDetails';
import { shortTokenCategory } from '../../../utils/tokenPresentation';
import type { BcmrTokenMetadataState } from '../../../types/bcmr';

type RawTxIoCardProps = {
  item: RawTxIoView;
  metadata?: BcmrTokenMetadataState | null;
  defaultOpen?: boolean;
};

const RawTxIoCard: React.FC<RawTxIoCardProps> = ({
  item,
  metadata = null,
  defaultOpen = false,
}) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const detailsId = useId();
  const token = item.token;
  const showBcmr =
    token != null &&
    hasDisplayableBcmrIdentity(token.category, metadata, token.bcmr);
  const presentation = token
    ? tokenPresentationForRawTx(token.category, metadata, token.bcmr)
    : null;
  const isNft = Boolean(token?.nft);
  const bchAmount = formatSatsAsBch(item.sats);
  const heading =
    item.kind === 'input'
      ? t('builder.inputNumber', { index: item.index })
      : t('builder.outputNumber', { index: item.index });

  return (
    <article className="wallet-section overflow-hidden">
      <button
        type="button"
        className="flex min-h-[44px] w-full items-center gap-2 px-1 py-1 text-left"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold wallet-text-strong">
            {heading}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs wallet-muted">
            <span>
              {bchAmount} {t('txDetails.bch')}
            </span>
            {token ? (
              showBcmr && presentation ? (
                <TokenIdentityBadge
                  presentation={presentation}
                  avatarClassName="h-5 w-5 rounded"
                  primaryClassName="text-xs"
                  secondaryClassName="text-[10px]"
                  showStatus={false}
                  detail={
                    <span className="text-[10px] font-medium wallet-muted">
                      {isNft ? 'NFT' : 'FT'}
                    </span>
                  }
                />
              ) : (
                <span className="rounded-full border border-[var(--wallet-border)] px-2 py-0.5 text-[10px] font-semibold wallet-text-strong">
                  {isNft ? 'NFT' : 'FT'}
                </span>
              )
            ) : null}
            {item.isOpReturn ? (
              <span className="rounded-full border border-[var(--wallet-border)] px-2 py-0.5 text-[10px] font-semibold wallet-muted">
                OP_RETURN
              </span>
            ) : null}
          </span>
        </span>
        <span className="shrink-0 text-xs wallet-muted">
          {open ? t('builder.hideDetails') : t('builder.showDetails')}
        </span>
      </button>

      {open ? (
        <div
          id={detailsId}
          className="mt-2 space-y-2 border-t border-[var(--wallet-border)] pt-2 text-sm"
        >
          <p>
            <span className="font-medium">{t('builder.amount')}: </span>
            {bchAmount} {t('txDetails.bch')} ({item.sats.toString()}{' '}
            {t('txSummary.sats')})
          </p>

          {item.outpoint ? (
            <p className="break-all">
              <span className="font-medium">{t('builder.outpoint')}: </span>
              <span className="font-mono text-xs">{item.outpoint}</span>
            </p>
          ) : null}

          {item.address ? (
            <p className="break-all">
              <span className="font-medium">{t('builder.address')}: </span>
              <span className="font-mono text-xs wallet-link">
                {item.address}
              </span>
            </p>
          ) : null}

          {item.isOpReturn && item.opReturnChunks.length > 0 ? (
            <div>
              <p className="font-medium">{t('builder.opReturnOutput')}</p>
              {item.opReturnChunks.map((chunk) => (
                <p key={chunk} className="ml-2 font-mono text-xs wallet-muted">
                  {chunk}
                </p>
              ))}
            </div>
          ) : null}

          {token ? (
            <div className="wallet-surface-strong space-y-2 rounded-lg border border-[var(--wallet-border)] p-2 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {t('builder.tokenCategoryLabel')}
                  </p>
                  <p className="font-mono break-all">
                    {shortTokenCategory(token.category)}
                  </p>
                </div>
                <button
                  type="button"
                  className="wallet-btn-secondary min-h-[44px] shrink-0 px-3 text-xs"
                  title={t('builder.copyCategory')}
                  onClick={(event) => {
                    event.stopPropagation();
                    void copyToClipboard(token.category);
                  }}
                >
                  {t('builder.copyToClipboard')}
                </button>
              </div>

              {showBcmr && presentation ? (
                <TokenIdentityBadge
                  presentation={presentation}
                  avatarClassName="h-6 w-6 rounded"
                  primaryClassName="text-sm"
                  secondaryClassName="text-[11px]"
                  showStatus={false}
                />
              ) : null}

              {token.ftAmount > 0n || !token.nft ? (
                <p>
                  <span className="font-medium">
                    {t('builder.fungibleAmount')}:{' '}
                  </span>
                  {token.ftAmount.toString()}
                </p>
              ) : null}

              {token.nft ? (
                <>
                  <p>
                    <span className="font-medium">
                      {t('builder.nftCapability')}:{' '}
                    </span>
                    {token.nft.capability || 'none'}
                  </p>
                  <p className="font-mono break-all">
                    <span className="font-sans font-medium">
                      {t('builder.nftCommitment')}:{' '}
                    </span>
                    {nftCommitmentLabel(token.nft.commitment)}
                  </p>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};

export default RawTxIoCard;
