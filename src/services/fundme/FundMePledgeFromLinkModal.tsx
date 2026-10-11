/**
 * FundMePledgeFromLinkModal.tsx
 *
 * Modal displayed when the app is opened with a FundMe campaign URL.
 * Shows on-chain campaign data, off-chain profile, and allows entering a BCH pledge amount.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import type { FundMeCampaignFromChain, FundMeCampaignProfile } from './FundMeCampaignService';
import {
  formatBchDisplay,
  formatProgressPercent,
  getProfileDisplayName,
  getProfileOwner,
  getProfileDescription,
  getProfileBanner,
  getProfileLogo,
  getProfileUpdates,
} from './FundMeCampaignService';

type FundMePledgeFromLinkModalProps = {
  campaignId: number | null;
  campaign: FundMeCampaignFromChain | null;
  profile: FundMeCampaignProfile | null;
  profileLoading: boolean;
  profileError: string | null;
  loading: boolean;
  error: string | null;
  pledgeAmount: string;
  onPledgeAmountChange: (amount: string) => void;
  onClose: () => void;
};

const FundMePledgeFromLinkModal: React.FC<FundMePledgeFromLinkModalProps> = ({
  campaignId,
  campaign,
  profile,
  profileLoading,
  profileError,
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

  const displayName = getProfileDisplayName(profile, campaignId);
  const ownerName = getProfileOwner(profile);
  const description = getProfileDescription(profile, 300);
  const bannerUrl = getProfileBanner(profile);
  const logoUrl = getProfileLogo(profile);
  const updates = getProfileUpdates(profile, 2);

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
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <img
                src="/assets/images/fundme.png"
                alt="FundMe"
                className="h-8 w-8 object-contain flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <h3 className="text-base font-semibold wallet-text-strong truncate">
                {displayName}
              </h3>
              <p className="text-xs wallet-muted truncate">by {ownerName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="wallet-btn-danger px-3 py-2 text-sm flex-shrink-0"
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
              {bannerUrl && (
                <div
                  className="h-24 w-full rounded-2xl bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${bannerUrl})` }}
                />
              )}

              {description && (
                <div className="rounded-2xl wallet-surface-strong border border-[var(--wallet-border)] p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] wallet-muted mb-2">
                    About
                  </div>
                  <p className="text-sm wallet-text-strong leading-relaxed">
                    {description}
                  </p>
                  {profileLoading && (
                    <p className="mt-2 text-xs wallet-muted italic">
                      Loading campaign details…
                    </p>
                  )}
                </div>
              )}

              {!description && !profileLoading && profileError && (
                <div className="rounded-2xl wallet-surface-strong border border-[var(--wallet-border)] p-3">
                  <p className="text-xs wallet-muted text-center">
                    {profileError}
                  </p>
                </div>
              )}

              {updates.length > 0 && (
                <div className="rounded-2xl wallet-surface-strong border border-[var(--wallet-border)] p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] wallet-muted mb-2">
                    Recent Updates
                  </div>
                  <div className="space-y-2">
                    {updates.map((update, index) => (
                      <div
                        key={update.number ?? index}
                        className="text-xs wallet-muted"
                      >
                        <span className="font-semibold">
                          Update #{update.number ?? index + 1}:
                        </span>{' '}
                        {update.text
                          ? update.text.length > 100
                            ? `${update.text.slice(0, 100)}…`
                            : update.text
                          : '(No content)'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl wallet-surface-strong border border-[var(--wallet-border)] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] wallet-muted">
                    On-Chain Status
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

                <div className="mt-3">
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

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
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
                <button
                  type="button"
                  disabled={campaign.status !== 'active'}
                  className="w-full rounded-2xl bg-[#31d89a] px-4 py-3 text-sm font-semibold text-[#08261a] disabled:bg-gray-500 disabled:cursor-not-allowed disabled:text-gray-300"
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
