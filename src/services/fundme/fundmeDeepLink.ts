/**
 * FundMe campaign deep link parsing.
 *
 * Accepts URL shapes:
 *  - https://fundme.cash/campaigns/<campaignId>
 *  - https://fundme.cash/campaigns/#<campaignId>
 *  - https://fundme.cash/campaigns#<campaignId>
 *  - https://fundme.cash/campaigns/?id=<campaignId>
 *  - https://fundme.cash/campaigns?id=<campaignId>
 *
 * Returns only the campaign ID as a number; the contract address is a wallet
 * whitelist (AddressCashStarter), never taken from the URL.
 */

const FUNDME_HOST = 'fundme.cash';
const CAMPAIGNS_PATH_PREFIX = '/campaigns';

export type FundMeParsedLink = {
  campaignId: number;
};

function isFundMeHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^www\./, '');
  return normalized === FUNDME_HOST;
}

function extractCampaignIdFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/campaigns\/(\d+)\/?$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function extractCampaignIdFromHash(hash: string): number | null {
  const normalized = hash.replace(/^#/, '').trim();
  const num = parseInt(normalized, 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function extractCampaignIdFromQuery(search: string): number | null {
  try {
    const params = new URLSearchParams(search);
    const idParam = params.get('id');
    if (!idParam) return null;
    const num = parseInt(idParam, 10);
    return Number.isFinite(num) && num > 0 ? num : null;
  } catch {
    return null;
  }
}

export function parseFundMeCampaignUrl(
  urlString: string
): FundMeParsedLink | null {
  if (!urlString || typeof urlString !== 'string') return null;

  const trimmed = urlString.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (!isFundMeHost(url.host)) return null;

  const pathname = url.pathname.toLowerCase();
  if (!pathname.startsWith(CAMPAIGNS_PATH_PREFIX)) return null;

  const fromPath = extractCampaignIdFromPath(url.pathname);
  if (fromPath !== null) {
    return { campaignId: fromPath };
  }

  if (url.hash) {
    const fromHash = extractCampaignIdFromHash(url.hash);
    if (fromHash !== null) {
      return { campaignId: fromHash };
    }
  }

  const fromQuery = extractCampaignIdFromQuery(url.search);
  if (fromQuery !== null) {
    return { campaignId: fromQuery };
  }

  return null;
}

export function extractFundMeCampaignIdFromOpenUrl(
  openUrl: string
): number | null {
  const parsed = parseFundMeCampaignUrl(openUrl);
  return parsed?.campaignId ?? null;
}

let pendingFundMeCampaign: number | null = null;

export function stashFundMeCampaignId(campaignId: number): void {
  pendingFundMeCampaign = campaignId;
}

export function takeStashedFundMeCampaignId(): number | null {
  const next = pendingFundMeCampaign;
  pendingFundMeCampaign = null;
  return next;
}

export function peekStashedFundMeCampaignId(): number | null {
  return pendingFundMeCampaign;
}
