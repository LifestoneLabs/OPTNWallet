/**
 * fundmeApiClient.ts
 *
 * HTTP client for the FundMe server API.
 * Uses CapacitorHttp on native platforms to bypass CORS restrictions.
 */

import { CapacitorHttp } from '@capacitor/core';
import { isWebPlatform } from '../../utils/platform';
import { getFundMeApiBaseUrl } from '../../pages/apps/fundme/fundmeApi';

export type FundMeProfileUpdate = {
  number?: number;
  text?: string;
};

export type FundMeCampaignProfile = {
  id?: number | string;
  name?: string;
  owner?: string;
  description?: string;
  logo?: string;
  banner?: string;
  ownersAddress?: string;
  updates?: FundMeProfileUpdate[];
  isComplete?: boolean;
  status?: string;
};

export type FundMeApiError = {
  error: string;
};

async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      credentials: 'omit',
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function capacitorHttpGet(
  url: string,
  timeoutMs: number
): Promise<unknown> {
  return await Promise.race([
    CapacitorHttp.get({ url, headers: { Accept: 'application/json' } }).then(
      (response) => {
        if (response.status >= 400) {
          const error = new Error(`HTTP ${response.status}`) as Error & {
            status?: number;
            data?: unknown;
          };
          error.status = response.status;
          error.data = response.data;
          throw error;
        }
        return response.data;
      }
    ),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]);
}

export async function fetchCampaignProfile(
  campaignId: number,
  options: { timeoutMs?: number } = {}
): Promise<FundMeCampaignProfile | null> {
  const { timeoutMs = 10000 } = options;
  const url = `${getFundMeApiBaseUrl()}/get-campaign/${campaignId}`;

  try {
    if (isWebPlatform()) {
      const response = await fetchWithTimeout(url, timeoutMs);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as
        | FundMeCampaignProfile
        | FundMeApiError;
      if ('error' in data && data.error) return null;
      return data as FundMeCampaignProfile;
    }

    const data = (await capacitorHttpGet(url, timeoutMs)) as
      | FundMeCampaignProfile
      | FundMeApiError;
    if ('error' in data && data.error) return null;
    return data as FundMeCampaignProfile;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('404') ||
        error.message.includes('not found') ||
        (error as Error & { status?: number }).status === 404)
    ) {
      return null;
    }
    throw error;
  }
}

export function stripHtmlTags(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '…';
}

export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith('data:image/')) return true;
  if (/^https?:\/\/.+\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url)) return true;
  if (/^https?:\/\//.test(url)) return true;
  return false;
}
