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

export type FundMeCampaignImageSet = {
  logo?: string;
  banner?: string;
  card?: string;
  logoUrl?: string;
  bannerUrl?: string;
  cardUrl?: string;
};

export type FundMeCampaignProfile = {
  id?: number | string;
  name?: string;
  owner?: string;
  description?: string;
  logo?: string;
  banner?: string;
  logoUrl?: string;
  bannerUrl?: string;
  cardUrl?: string;
  images?: FundMeCampaignImageSet;
  ownersAddress?: string;
  updates?: FundMeProfileUpdate[];
  isComplete?: boolean;
  status?: string;
};

export const FUNDME_CAMPAIGN_IMAGE_PATH =
  /^\/campaign-img\/[A-Za-z0-9_-]+\/(logo|banner|card|desc)\.[a-f0-9]{12}\.webp$/;

const DEFAULT_FUNDME_ORIGIN = 'https://fundme.cash';

function normalizeFundMeOrigin(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function allowedImageOrigins(baseUrl: string): Set<string> {
  const origins = new Set<string>();
  const configured = originOf(normalizeFundMeOrigin(baseUrl));
  if (configured) origins.add(configured);
  origins.add(DEFAULT_FUNDME_ORIGIN);
  return origins;
}

/**
 * Resolve a FundMe campaign image value to an absolute https URL.
 *
 * Accepts only:
 * - relative hashed WebP paths (`/campaign-img/<id>/(logo|banner|card|desc).<12hex>.webp`)
 * - absolute URLs on the FundMe origin (or the configured API base) whose
 *   pathname matches that same pattern
 *
 * Rejects data URIs, other hosts, path traversal, and non-WebP filenames.
 */
export function resolveCampaignImageUrl(
  value: string | null | undefined,
  baseUrl: string = getFundMeApiBaseUrl()
): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const origin = normalizeFundMeOrigin(baseUrl) || DEFAULT_FUNDME_ORIGIN;

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    if (!FUNDME_CAMPAIGN_IMAGE_PATH.test(trimmed)) return null;
    return `${origin}${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.search || parsed.hash) return null;
  if (!allowedImageOrigins(origin).has(parsed.origin)) return null;
  if (!FUNDME_CAMPAIGN_IMAGE_PATH.test(parsed.pathname)) return null;

  return `${parsed.origin}${parsed.pathname}`;
}

function firstResolvedCampaignImage(
  candidates: Array<string | null | undefined>,
  baseUrl?: string
): string | null {
  for (const candidate of candidates) {
    const resolved = resolveCampaignImageUrl(candidate, baseUrl);
    if (resolved) return resolved;
  }
  return null;
}

export function resolveProfileBannerUrl(
  profile: FundMeCampaignProfile | null | undefined,
  baseUrl?: string
): string | null {
  const images = profile?.images;
  return firstResolvedCampaignImage(
    [
      profile?.bannerUrl,
      images?.bannerUrl,
      images?.banner,
      profile?.cardUrl,
      images?.cardUrl,
      images?.card,
      profile?.banner,
    ],
    baseUrl
  );
}

export function resolveProfileLogoUrl(
  profile: FundMeCampaignProfile | null | undefined,
  baseUrl?: string
): string | null {
  const images = profile?.images;
  return firstResolvedCampaignImage(
    [profile?.logoUrl, images?.logoUrl, images?.logo, profile?.logo],
    baseUrl
  );
}

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
  return resolveCampaignImageUrl(url) !== null;
}
