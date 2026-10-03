/**
 * FundMePledgeFromLinkModal.tsx
 *
 * Modal displayed when the app is opened with a FundMe campaign URL.
 * Shows on-chain campaign data and allows entering a BCH pledge amount.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import type { FundMeCampaignFromChain } from './FundMeCampaignService';
import {
  formatBchDisplay,
  formatProgressPercent,
} from './FundMeCampaignService';

type FundMePledgeFromLinkModalProps = {
  campaignId: number | null;
  campaign: FundMeCampaignFromChain | null;
  loading: boolean;
  error: string | null;
  pledgeAmount: string;
  onPledgeAmountChange: (amount: string) => void;
  onClose: () => void;
};

const FundMePledgeFromLinkModal: React.FC<FundMePledgeFromLinkModalProps> = ({
  campaignId,
  campaign,
  loading,
  error,
  pledgeAmount,
  onPledgeAmountChange,
  onClose,
}) => {
  if (campaignId === null) return null;

  const progressPercent = campaign
    ? parseFloat(
        formatProgressPercent(campaign.raisedSatoshis, campaign.targetSatoshis)
      )
    : 0;

  const progressWidth = Math.max(Math.min(progressPercent, 100), 2);

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl wallet-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--wallet-border)] bg-[var(--wallet-card-bg)] px-4 py-3">
          <div className="flex items-center gap-3">
            <img
              src="/assets/images/fundme.png"
              alt="FundMe"
              className="h-8 w-8 object-contain"
            />
            <h3 className="text-lg font-semibold wallet-text-strong">
              FundMe Campaign
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="wallet-btn-danger px-3 py-2 text-sm"
          >
            Close
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#31d89a]" />
              <p className="mt-3 wallet-muted">
                Fetching campaign #{campaignId} from chain…
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl wallet-surface-strong border border-red-500/30 px-4 py-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {campaign && !loading && (
            <>
              <div className="rounded-2xl wallet-surface-strong border border-[var(--wallet-border)] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] wallet-muted">
                    Campaign #{campaign.campaignId}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      campaign.status === 'active'
                        ? 'bg-[#31d89a]/20 text-[#31d89a]'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {campaign.status === 'active' ? 'Active' : 'Stopped'}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="h-3 rounded-full bg-black/25 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#31d89a] transition-all"
                      style={{ width: `${progressWidth}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs wallet-muted">
                    <span>{progressPercent.toFixed(2)}%</span>
                    <span>
                      {formatBchDisplay(campaign.raisedSatoshis)} /{' '}
                      {formatBchDisplay(campaign.targetSatoshis)} BCH
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl wallet-surface border border-[var(--wallet-border)] p-3">
                    <div className="wallet-muted">End Block</div>
                    <div className="mt-1 font-semibold wallet-text-strong">
                      {campaign.endBlock.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-xl wallet-surface border border-[var(--wallet-border)] p-3">
                    <div className="wallet-muted">Raised</div>
                    <div className="mt-1 font-semibold wallet-text-strong">
                      {formatBchDisplay(campaign.raisedSatoshis)} BCH
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl wallet-surface-strong border border-[var(--wallet-border)] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] wallet-muted mb-3">
                  Pledge Amount
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={pledgeAmount}
                      onChange={(e) => onPledgeAmountChange(e.target.value)}
                      placeholder="0.00000000"
                      className="wallet-input flex-1 text-lg"
                    />
                    <span className="wallet-muted font-semibold">BCH</span>
                  </div>
                </div>
                <p className="mt-3 text-xs wallet-muted">
                  Enter the amount you want to pledge. Transaction signing will
                  open once you proceed to the FundMe app.
                </p>
              </div>

              <div className="rounded-2xl wallet-surface-strong border border-[var(--wallet-border)] p-4">
                <p className="text-xs wallet-muted text-center">
                  This campaign was loaded from the CashStarter contract on
                  chain. To complete your pledge, navigate to the FundMe app
                  within the wallet.
                </p>
                <button
                  type="button"
                  disabled={campaign.status !== 'active'}
                  className="mt-3 w-full rounded-2xl bg-[#31d89a] px-4 py-3 text-sm font-semibold text-[#08261a] disabled:bg-gray-500 disabled:cursor-not-allowed disabled:text-gray-300"
                >
                  {campaign.status === 'active'
                    ? 'Open in FundMe App'
                    : 'Campaign is stopped'}
                </button>
              </div>
            </>
          )}

          {!campaign && !loading && !error && (
            <div className="text-center py-8">
              <p className="wallet-muted">
                Ready to load campaign #{campaignId}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FundMePledgeFromLinkModal;
