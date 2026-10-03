/**
 * useFundMeDeepLink.ts
 *
 * Hook for handling FundMe campaign deep links.
 * Listens for appUrlOpen events and processes fundme.cash/campaigns URLs.
 */

import { useEffect, useState, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Toast } from '@capacitor/toast';
import { isNativePlatform } from '../../utils/platform';
import {
  extractFundMeCampaignIdFromOpenUrl,
  stashFundMeCampaignId,
  takeStashedFundMeCampaignId,
} from './fundmeDeepLink';
import {
  fetchCampaignById,
  type FundMeCampaignFromChain,
} from './FundMeCampaignService';

export type FundMeDeepLinkState = {
  campaignId: number | null;
  campaign: FundMeCampaignFromChain | null;
  loading: boolean;
  error: string | null;
  pledgeAmount: string;
};

export type UseFundMeDeepLinkResult = FundMeDeepLinkState & {
  setPledgeAmount: (amount: string) => void;
  clearCampaign: () => void;
  openCampaignFromUrl: (url: string) => Promise<void>;
};

/**
 * DEV ENTRY POINT: To test this handler without OS-level deep links, call
 * `window.__fundMeDeepLinkTest?.('https://fundme.cash/campaigns/123')` in
 * the browser console while a wallet is open.
 */
export function useFundMeDeepLink(
  walletId: number | null,
  enabled: boolean
): UseFundMeDeepLinkResult {
  const [state, setState] = useState<FundMeDeepLinkState>({
    campaignId: null,
    campaign: null,
    loading: false,
    error: null,
    pledgeAmount: '',
  });

  const clearCampaign = useCallback(() => {
    setState({
      campaignId: null,
      campaign: null,
      loading: false,
      error: null,
      pledgeAmount: '',
    });
  }, []);

  const setPledgeAmount = useCallback((amount: string) => {
    const sanitized = amount.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    const decimalIndex = sanitized.indexOf('.');
    if (decimalIndex !== -1) {
      const integerPart = sanitized.substring(0, decimalIndex);
      const decimalPart = sanitized.substring(decimalIndex + 1, decimalIndex + 9);
      setState((prev) => ({
        ...prev,
        pledgeAmount: `${integerPart}.${decimalPart}`,
      }));
    } else {
      setState((prev) => ({ ...prev, pledgeAmount: sanitized }));
    }
  }, []);

  const fetchAndSetCampaign = useCallback(
    async (campaignId: number) => {
      setState((prev) => ({
        ...prev,
        campaignId,
        campaign: null,
        loading: true,
        error: null,
        pledgeAmount: '',
      }));

      try {
        const campaign = await fetchCampaignById(campaignId);
        if (!campaign) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: `Campaign #${campaignId} not found on chain. It may have been claimed, cancelled, or does not exist.`,
          }));
          return;
        }

        setState((prev) => ({
          ...prev,
          campaign,
          loading: false,
          error: null,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to fetch campaign from chain.',
        }));
      }
    },
    []
  );

  const openCampaignFromUrl = useCallback(
    async (url: string) => {
      const campaignId = extractFundMeCampaignIdFromOpenUrl(url);
      if (!campaignId) return;

      if (!walletId || walletId <= 0) {
        stashFundMeCampaignId(campaignId);
        await Toast.show({
          text: 'Open a wallet to pledge to this FundMe campaign.',
        });
        return;
      }

      await fetchAndSetCampaign(campaignId);
    },
    [walletId, fetchAndSetCampaign]
  );

  useEffect(() => {
    if (!enabled || !isNativePlatform()) return;

    let removeListener: { remove: () => Promise<void> } | undefined;

    void CapacitorApp.getLaunchUrl()
      .then((launch) => {
        if (launch?.url) {
          void openCampaignFromUrl(launch.url);
        }
      })
      .catch(() => undefined);

    void CapacitorApp.addListener('appUrlOpen', (event) => {
      void openCampaignFromUrl(event.url);
    }).then((handle) => {
      removeListener = handle;
    });

    return () => {
      void removeListener?.remove();
    };
  }, [enabled, openCampaignFromUrl]);

  useEffect(() => {
    if (!enabled || !walletId || walletId <= 0) return;

    const stashedCampaignId = takeStashedFundMeCampaignId();
    if (stashedCampaignId) {
      void fetchAndSetCampaign(stashedCampaignId);
    }
  }, [enabled, walletId, fetchAndSetCampaign]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      (window as unknown as { __fundMeDeepLinkTest?: (url: string) => void }).__fundMeDeepLinkTest =
        (url: string) => {
          void openCampaignFromUrl(url);
        };
      return () => {
        delete (window as unknown as { __fundMeDeepLinkTest?: unknown }).__fundMeDeepLinkTest;
      };
    }
  }, [enabled, openCampaignFromUrl]);

  return {
    ...state,
    setPledgeAmount,
    clearCampaign,
    openCampaignFromUrl,
  };
}

export default useFundMeDeepLink;
