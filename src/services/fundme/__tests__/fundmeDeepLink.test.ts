import { describe, it, expect } from 'vitest';
import {
  parseFundMeCampaignUrl,
  extractFundMeCampaignIdFromOpenUrl,
  stashFundMeCampaignId,
  takeStashedFundMeCampaignId,
  peekStashedFundMeCampaignId,
} from '../fundmeDeepLink';

describe('parseFundMeCampaignUrl', () => {
  it('parses campaign ID from path', () => {
    expect(parseFundMeCampaignUrl('https://fundme.cash/campaigns/123')).toEqual({
      campaignId: 123,
    });
    expect(parseFundMeCampaignUrl('https://fundme.cash/campaigns/42/')).toEqual({
      campaignId: 42,
    });
  });

  it('parses campaign ID from hash fragment', () => {
    expect(parseFundMeCampaignUrl('https://fundme.cash/campaigns/#456')).toEqual({
      campaignId: 456,
    });
    expect(parseFundMeCampaignUrl('https://fundme.cash/campaigns#789')).toEqual({
      campaignId: 789,
    });
  });

  it('parses campaign ID from query parameter', () => {
    expect(parseFundMeCampaignUrl('https://fundme.cash/campaigns?id=101')).toEqual({
      campaignId: 101,
    });
    expect(parseFundMeCampaignUrl('https://fundme.cash/campaigns/?id=202')).toEqual({
      campaignId: 202,
    });
  });

  it('returns null for non-fundme.cash hosts', () => {
    expect(parseFundMeCampaignUrl('https://example.com/campaigns/123')).toBeNull();
    expect(parseFundMeCampaignUrl('https://notfundme.cash/campaigns/123')).toBeNull();
  });

  it('returns null for non-campaigns paths', () => {
    expect(parseFundMeCampaignUrl('https://fundme.cash/other/123')).toBeNull();
    expect(parseFundMeCampaignUrl('https://fundme.cash/123')).toBeNull();
  });

  it('returns null for invalid campaign IDs', () => {
    expect(parseFundMeCampaignUrl('https://fundme.cash/campaigns/abc')).toBeNull();
    expect(parseFundMeCampaignUrl('https://fundme.cash/campaigns/-1')).toBeNull();
    expect(parseFundMeCampaignUrl('https://fundme.cash/campaigns/0')).toBeNull();
  });

  it('returns null for empty or invalid input', () => {
    expect(parseFundMeCampaignUrl('')).toBeNull();
    expect(parseFundMeCampaignUrl('not-a-url')).toBeNull();
    expect(parseFundMeCampaignUrl(null as unknown as string)).toBeNull();
    expect(parseFundMeCampaignUrl(undefined as unknown as string)).toBeNull();
  });

  it('handles www prefix', () => {
    expect(parseFundMeCampaignUrl('https://www.fundme.cash/campaigns/123')).toEqual({
      campaignId: 123,
    });
  });

  it('handles mixed case', () => {
    expect(parseFundMeCampaignUrl('https://FundMe.Cash/Campaigns/123')).toEqual({
      campaignId: 123,
    });
  });

  it('prefers path over hash and query', () => {
    expect(
      parseFundMeCampaignUrl('https://fundme.cash/campaigns/100#200?id=300')
    ).toEqual({ campaignId: 100 });
  });
});

describe('extractFundMeCampaignIdFromOpenUrl', () => {
  it('returns campaign ID from valid URL', () => {
    expect(
      extractFundMeCampaignIdFromOpenUrl('https://fundme.cash/campaigns/55')
    ).toBe(55);
  });

  it('returns null for invalid URL', () => {
    expect(extractFundMeCampaignIdFromOpenUrl('https://example.com/123')).toBeNull();
  });
});

describe('stash/take/peek FundMe campaign ID', () => {
  it('stashes and takes campaign ID', () => {
    stashFundMeCampaignId(42);
    expect(peekStashedFundMeCampaignId()).toBe(42);
    expect(takeStashedFundMeCampaignId()).toBe(42);
    expect(takeStashedFundMeCampaignId()).toBeNull();
  });
});
