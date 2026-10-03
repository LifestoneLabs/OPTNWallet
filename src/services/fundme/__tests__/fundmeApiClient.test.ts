import { describe, it, expect } from 'vitest';
import {
  stripHtmlTags,
  truncateText,
  isValidImageUrl,
} from '../fundmeApiClient';

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
    expect(stripHtmlTags('&amp; &lt; &gt; &quot; &#39;')).toBe("& < > \" '");
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

describe('isValidImageUrl', () => {
  it('accepts data URIs', () => {
    expect(isValidImageUrl('data:image/png;base64,abc123')).toBe(true);
    expect(isValidImageUrl('data:image/jpeg;base64,xyz')).toBe(true);
  });

  it('accepts https image URLs', () => {
    expect(isValidImageUrl('https://example.com/image.png')).toBe(true);
    expect(isValidImageUrl('https://example.com/image.jpg')).toBe(true);
    expect(isValidImageUrl('https://example.com/image.jpeg')).toBe(true);
    expect(isValidImageUrl('https://example.com/image.gif')).toBe(true);
    expect(isValidImageUrl('https://example.com/image.webp')).toBe(true);
  });

  it('accepts https URLs without explicit image extension', () => {
    expect(isValidImageUrl('https://example.com/api/image/123')).toBe(true);
  });

  it('rejects invalid inputs', () => {
    expect(isValidImageUrl('')).toBe(false);
    expect(isValidImageUrl(null)).toBe(false);
    expect(isValidImageUrl(undefined)).toBe(false);
    expect(isValidImageUrl('not-a-url')).toBe(false);
  });
});
