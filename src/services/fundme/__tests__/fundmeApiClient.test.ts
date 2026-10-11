import { describe, it, expect } from 'vitest';
import {
  stripHtmlTags,
  truncateText,
  isValidImageUrl,
  resolveCampaignImageUrl,
  resolveProfileBannerUrl,
  resolveProfileLogoUrl,
} from '../fundmeApiClient';

const FUNDME_ORIGIN = 'https://fundme.cash';
const RELATIVE_LOGO = '/campaign-img/169/logo.5e91aa57a549.webp';
const RELATIVE_BANNER = '/campaign-img/169/banner.9155baf335c2.webp';
const RELATIVE_CARD = '/campaign-img/169/card.9f45c614e6f6.webp';

describe('stripHtmlTags', () => {
  it('removes HTML tags from content', () => {
    expect(stripHtmlTags('<p>Hello <b>world</b></p>')).toBe('Hello world');
    expect(stripHtmlTags('<div class="test">Content</div>')).toBe('Content');
  });

  it('removes script and style tags with their content', () => {
    expect(
      stripHtmlTags('<p>Text</p><script>alert("xss")</script><p>More</p>')
    ).toBe('Text More');
    expect(
      stripHtmlTags('<style>.class { color: red; }</style><p>Content</p>')
    ).toBe('Content');
  });

  it('decodes HTML entities', () => {
    expect(stripHtmlTags('&amp; &lt; &gt; &quot; &#39;')).toBe('& < > " \'');
    expect(stripHtmlTags('&nbsp;test&nbsp;')).toBe('test');
  });

  it('normalizes whitespace', () => {
    expect(stripHtmlTags('<p>Hello</p>  <p>World</p>')).toBe('Hello World');
    expect(stripHtmlTags('Multiple   spaces')).toBe('Multiple spaces');
  });

  it('handles empty and null input', () => {
    expect(stripHtmlTags('')).toBe('');
    expect(stripHtmlTags(null)).toBe('');
    expect(stripHtmlTags(undefined)).toBe('');
  });
});

describe('truncateText', () => {
  it('truncates text longer than maxLength', () => {
    expect(truncateText('Hello, World!', 5)).toBe('Hello…');
    expect(truncateText('Short', 10)).toBe('Short');
  });

  it('trims before adding ellipsis', () => {
    expect(truncateText('Hello World', 6)).toBe('Hello…');
  });

  it('handles exact length', () => {
    expect(truncateText('Hello', 5)).toBe('Hello');
  });
});

describe('resolveCampaignImageUrl', () => {
  it('resolves a hashed relative campaign-img path against the FundMe origin', () => {
    expect(resolveCampaignImageUrl(RELATIVE_LOGO, FUNDME_ORIGIN)).toBe(
      `${FUNDME_ORIGIN}${RELATIVE_LOGO}`
    );
    expect(resolveCampaignImageUrl(RELATIVE_BANNER, FUNDME_ORIGIN)).toBe(
      `${FUNDME_ORIGIN}${RELATIVE_BANNER}`
    );
    expect(resolveCampaignImageUrl(RELATIVE_CARD, FUNDME_ORIGIN)).toBe(
      `${FUNDME_ORIGIN}${RELATIVE_CARD}`
    );
  });

  it('accepts an absolute FundMe campaign-img URL', () => {
    const absolute = `${FUNDME_ORIGIN}${RELATIVE_BANNER}`;
    expect(resolveCampaignImageUrl(absolute, FUNDME_ORIGIN)).toBe(absolute);
  });

  it('rejects a malicious or other-host URL', () => {
    expect(
      resolveCampaignImageUrl(
        `https://evil.example${RELATIVE_LOGO}`,
        FUNDME_ORIGIN
      )
    ).toBeNull();
    expect(
      resolveCampaignImageUrl(
        `https://fundme.cash.evil.example${RELATIVE_LOGO}`,
        FUNDME_ORIGIN
      )
    ).toBeNull();
    expect(
      resolveCampaignImageUrl(
        `https://evil.example/@fundme.cash${RELATIVE_LOGO}`,
        FUNDME_ORIGIN
      )
    ).toBeNull();
  });

  it('rejects path traversal', () => {
    expect(
      resolveCampaignImageUrl(
        '/campaign-img/169/../logo.5e91aa57a549.webp',
        FUNDME_ORIGIN
      )
    ).toBeNull();
    expect(
      resolveCampaignImageUrl(
        '/campaign-img/../169/logo.5e91aa57a549.webp',
        FUNDME_ORIGIN
      )
    ).toBeNull();
    expect(
      resolveCampaignImageUrl(
        `${FUNDME_ORIGIN}/campaign-img/169/../../../etc/passwd`,
        FUNDME_ORIGIN
      )
    ).toBeNull();
    expect(
      resolveCampaignImageUrl(
        '//evil.example/campaign-img/169/logo.5e91aa57a549.webp',
        FUNDME_ORIGIN
      )
    ).toBeNull();
  });

  it('rejects a wrong extension or filename', () => {
    expect(
      resolveCampaignImageUrl(
        '/campaign-img/169/logo.5e91aa57a549.png',
        FUNDME_ORIGIN
      )
    ).toBeNull();
    expect(
      resolveCampaignImageUrl(
        '/campaign-img/169/logo.5e91aa57a549.jpg',
        FUNDME_ORIGIN
      )
    ).toBeNull();
    expect(
      resolveCampaignImageUrl(
        '/campaign-img/169/hero.5e91aa57a549.webp',
        FUNDME_ORIGIN
      )
    ).toBeNull();
    expect(
      resolveCampaignImageUrl(
        `${FUNDME_ORIGIN}/uploads/old-banner.png`,
        FUNDME_ORIGIN
      )
    ).toBeNull();
  });

  it('rejects data URIs, empty values, and missing fields', () => {
    expect(
      resolveCampaignImageUrl('data:image/png;base64,abc123', FUNDME_ORIGIN)
    ).toBeNull();
    expect(
      resolveCampaignImageUrl('data:image/webp;base64,xyz', FUNDME_ORIGIN)
    ).toBeNull();
    expect(resolveCampaignImageUrl('', FUNDME_ORIGIN)).toBeNull();
    expect(resolveCampaignImageUrl('   ', FUNDME_ORIGIN)).toBeNull();
    expect(resolveCampaignImageUrl(null, FUNDME_ORIGIN)).toBeNull();
    expect(resolveCampaignImageUrl(undefined, FUNDME_ORIGIN)).toBeNull();
  });
});

describe('resolveProfileBannerUrl / resolveProfileLogoUrl', () => {
  it('prefers bannerUrl and falls back to cardUrl', () => {
    expect(
      resolveProfileBannerUrl(
        { bannerUrl: RELATIVE_BANNER, cardUrl: RELATIVE_CARD },
        FUNDME_ORIGIN
      )
    ).toBe(`${FUNDME_ORIGIN}${RELATIVE_BANNER}`);

    expect(
      resolveProfileBannerUrl({ cardUrl: RELATIVE_CARD }, FUNDME_ORIGIN)
    ).toBe(`${FUNDME_ORIGIN}${RELATIVE_CARD}`);
  });

  it('uses logoUrl for the logo', () => {
    expect(
      resolveProfileLogoUrl({ logoUrl: RELATIVE_LOGO }, FUNDME_ORIGIN)
    ).toBe(`${FUNDME_ORIGIN}${RELATIVE_LOGO}`);
  });

  it('handles images.json-style nested fields and legacy logo/banner strings', () => {
    expect(
      resolveProfileBannerUrl(
        { images: { bannerUrl: RELATIVE_BANNER } },
        FUNDME_ORIGIN
      )
    ).toBe(`${FUNDME_ORIGIN}${RELATIVE_BANNER}`);
    expect(
      resolveProfileLogoUrl({ images: { logo: RELATIVE_LOGO } }, FUNDME_ORIGIN)
    ).toBe(`${FUNDME_ORIGIN}${RELATIVE_LOGO}`);
    expect(
      resolveProfileBannerUrl({ banner: RELATIVE_BANNER }, FUNDME_ORIGIN)
    ).toBe(`${FUNDME_ORIGIN}${RELATIVE_BANNER}`);
    expect(resolveProfileLogoUrl({ logo: RELATIVE_LOGO }, FUNDME_ORIGIN)).toBe(
      `${FUNDME_ORIGIN}${RELATIVE_LOGO}`
    );
  });

  it('returns null when image fields are missing or unusable', () => {
    expect(resolveProfileBannerUrl(null, FUNDME_ORIGIN)).toBeNull();
    expect(resolveProfileBannerUrl({}, FUNDME_ORIGIN)).toBeNull();
    expect(
      resolveProfileLogoUrl({ name: 'No images' }, FUNDME_ORIGIN)
    ).toBeNull();
    expect(
      resolveProfileBannerUrl(
        { bannerUrl: 'https://example.com/banner.png' },
        FUNDME_ORIGIN
      )
    ).toBeNull();
  });
});

describe('isValidImageUrl', () => {
  it('accepts resolved FundMe campaign image URLs only', () => {
    expect(isValidImageUrl(`${FUNDME_ORIGIN}${RELATIVE_LOGO}`)).toBe(true);
    expect(isValidImageUrl(RELATIVE_BANNER)).toBe(true);
  });

  it('rejects data URIs, other hosts, and missing values', () => {
    expect(isValidImageUrl('data:image/png;base64,abc123')).toBe(false);
    expect(isValidImageUrl('https://example.com/image.png')).toBe(false);
    expect(isValidImageUrl('https://example.com/api/image/123')).toBe(false);
    expect(isValidImageUrl('')).toBe(false);
    expect(isValidImageUrl(null)).toBe(false);
    expect(isValidImageUrl(undefined)).toBe(false);
    expect(isValidImageUrl('not-a-url')).toBe(false);
  });
});
