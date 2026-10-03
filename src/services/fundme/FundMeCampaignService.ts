/**
 * FundMeCampaignService.ts
 *
 * Fetches and parses FundMe campaign data from the CashStarter contract UTXOs.
 * Uses the whitelisted contract address, not any address from a URL.
 * Also fetches off-chain profile data from the FundMe server.
 */

import ElectrumService from '../ElectrumService';
import { AddressCashStarter, MasterCategoryID } from '../../pages/apps/fundme/values';
import {
  fetchCampaignProfile,
  stripHtmlTags,
  truncateText,
  isValidImageUrl,
  type FundMeCampaignProfile,
  type FundMeProfileUpdate,
} from './fundmeApiClient';

export type { FundMeCampaignProfile, FundMeProfileUpdate };

export type FundMeCampaignFromChain = {
  campaignId: number;
  txHash: string;
  outputIndex: number;
  capability: 'minting' | 'mutable' | 'none';
  targetSatoshis: number;
  raisedSatoshis: number;
  endBlock: number;
  status: 'active' | 'stopped';
};

function normalizeHex(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^0x/i, '')
    .replace(/^\\x/i, '');
}

function decodeLittleEndianNumber(hex: string | null | undefined): number {
  const normalized = normalizeHex(hex);
  if (!normalized) return 0;
  const bytes = normalized.match(/.{2}/g);
  if (!bytes) return 0;
  return parseInt(bytes.reverse().join(''), 16);
}

function extractCampaignFromUtxo(utxo: {
  tx_hash: string;
  tx_pos: number;
  value: number;
  token?: {
    category?: string;
    nft?: {
      capability?: string;
      commitment?: string;
    };
  } | null;
}): FundMeCampaignFromChain | null {
  if (!utxo.token) return null;
  const category = normalizeHex(utxo.token.category);
  if (category !== normalizeHex(MasterCategoryID)) return null;

  const commitment = normalizeHex(utxo.token?.nft?.commitment);
  if (!commitment || commitment.length < 80) return null;

  if (commitment.slice(70, 80) === 'ffffffffff') return null;

  const capability = utxo.token?.nft?.capability;
  if (capability !== 'minting' && capability !== 'mutable') return null;

  const campaignId = decodeLittleEndianNumber(commitment.slice(70, 80));
  const targetSatoshis = decodeLittleEndianNumber(commitment.slice(0, 12));
  const endBlock = decodeLittleEndianNumber(commitment.slice(52, 60));
  const status = capability === 'mutable' ? 'stopped' : 'active';

  return {
    campaignId,
    txHash: utxo.tx_hash,
    outputIndex: utxo.tx_pos,
    capability: capability as 'minting' | 'mutable',
    targetSatoshis,
    raisedSatoshis: utxo.value,
    endBlock,
    status,
  };
}

export async function fetchCampaignById(
  campaignId: number
): Promise<FundMeCampaignFromChain | null> {
  if (!Number.isFinite(campaignId) || campaignId <= 0) {
    return null;
  }

  const utxos = await ElectrumService.getUTXOs(AddressCashStarter);
  for (const utxo of utxos) {
    const parsed = extractCampaignFromUtxo(utxo);
    if (parsed && parsed.campaignId === campaignId) {
      return parsed;
    }
  }

  return null;
}

export async function fetchAllCampaigns(): Promise<FundMeCampaignFromChain[]> {
  const utxos = await ElectrumService.getUTXOs(AddressCashStarter);
  const campaigns: FundMeCampaignFromChain[] = [];

  for (const utxo of utxos) {
    const parsed = extractCampaignFromUtxo(utxo);
    if (parsed) {
      campaigns.push(parsed);
    }
  }

  return campaigns.sort((a, b) => b.campaignId - a.campaignId);
}

export function formatBchFromSatoshis(satoshis: number): string {
  return (satoshis / 100_000_000).toFixed(8);
}

export function formatBchDisplay(satoshis: number): string {
  return (satoshis / 100_000_000).toFixed(4);
}

export function formatProgressPercent(
  raisedSatoshis: number,
  targetSatoshis: number
): string {
  if (targetSatoshis <= 0) return '0.00';
  const percent = (raisedSatoshis / targetSatoshis) * 100;
  return Math.min(percent, 100).toFixed(2);
}

export type FundMeProfileState = {
  profile: FundMeCampaignProfile | null;
  loading: boolean;
  error: string | null;
};

export async function fetchCampaignProfileById(
  campaignId: number
): Promise<FundMeCampaignProfile | null> {
  if (!Number.isFinite(campaignId) || campaignId <= 0) {
    return null;
  }
  return fetchCampaignProfile(campaignId);
}

export function getProfileDisplayName(
  profile: FundMeCampaignProfile | null,
  campaignId: number
): string {
  return profile?.name?.trim() || `Campaign #${campaignId}`;
}

export function getProfileOwner(
  profile: FundMeCampaignProfile | null
): string {
  return profile?.owner?.trim() || 'FundMe';
}

export function getProfileDescription(
  profile: FundMeCampaignProfile | null,
  maxLength = 500
): string {
  const raw = profile?.description;
  if (!raw) return '';
  const plainText = stripHtmlTags(raw);
  return truncateText(plainText, maxLength);
}

export function getProfileBanner(
  profile: FundMeCampaignProfile | null
): string | null {
  const banner = profile?.banner;
  return isValidImageUrl(banner) ? banner! : null;
}

export function getProfileLogo(
  profile: FundMeCampaignProfile | null
): string | null {
  const logo = profile?.logo;
  return isValidImageUrl(logo) ? logo! : null;
}

export function getProfileUpdates(
  profile: FundMeCampaignProfile | null,
  maxCount = 3
): FundMeProfileUpdate[] {
  const updates = profile?.updates;
  if (!Array.isArray(updates)) return [];
  return updates.slice(0, maxCount).map((update) => ({
    number: update.number,
    text: stripHtmlTags(update.text),
  }));
}

export { stripHtmlTags, truncateText, isValidImageUrl };
