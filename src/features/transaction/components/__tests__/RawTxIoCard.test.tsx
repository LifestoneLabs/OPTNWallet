/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  BcmrSnapshot,
  BcmrTokenMetadataState,
} from '../../../../types/bcmr';
import { I18nContext } from '../../../../i18n/I18nContext';
import { translations } from '../../../../i18n/resources';
import type { RawTxIoView } from '../../../../utils/rawTransactionDetails';
import RawTxIoCard from '../RawTxIoCard';

const CATEGORY =
  'ad95860f11111111111111111111111111111111111111111111111111115753';

function renderCard(
  item: RawTxIoView,
  metadata: BcmrTokenMetadataState | null = null
) {
  return render(
    <I18nContext.Provider
      value={{
        locale: 'en',
        setLocale: () => undefined,
        t: (key, values) => {
          const template = translations.en[key];
          if (!values) return template;
          return template.replace(/\{(\w+)\}/g, (_, name: string) =>
            String(values[name] ?? '')
          );
        },
      }}
    >
      <RawTxIoCard item={item} metadata={metadata} />
    </I18nContext.Provider>
  );
}

function makeMetadata(): BcmrTokenMetadataState {
  return {
    status: 'ready',
    freshness: 'fresh',
    name: 'Sample Token',
    symbol: 'SMP',
    decimals: 0,
    iconUri: 'https://example.com/icon.png',
    snapshot: {
      name: 'Sample Token',
      token: { category: CATEGORY, symbol: 'SMP', decimals: 0 },
      uris: { icon: 'https://example.com/icon.png' },
      extensions: {},
    } as BcmrSnapshot,
    isRefreshing: false,
  };
}

afterEach(() => {
  cleanup();
});

describe('RawTxIoCard', () => {
  it('starts collapsed and toggles details on click', () => {
    const item: RawTxIoView = {
      kind: 'output',
      index: 0,
      sats: 1000n,
      outpoint: `${'aa'.repeat(32)}:0`,
      address: 'bitcoincash:qrecipient',
      isOpReturn: false,
      opReturnChunks: [],
      token: null,
    };

    renderCard(item);

    const toggle = screen.getByRole('button', { name: /Output 0/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Outpoint/)).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Outpoint/)).toBeInTheDocument();
    expect(screen.getByText(`${'aa'.repeat(32)}:0`)).toBeInTheDocument();
    expect(
      screen.getByText(/0.00001000 BCH \(1000 sats\)/)
    ).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Outpoint/)).not.toBeInTheDocument();
  });

  it('shows an FT badge without BCMR name or icon', () => {
    const item: RawTxIoView = {
      kind: 'output',
      index: 1,
      sats: 1000n,
      outpoint: `${'bb'.repeat(32)}:1`,
      address: 'bitcoincash:qtoken',
      isOpReturn: false,
      opReturnChunks: [],
      token: {
        category: CATEGORY,
        ftAmount: 5n,
        nft: null,
        bcmr: {},
      },
    };

    renderCard(item);
    expect(screen.getByText('FT')).toBeInTheDocument();
    expect(screen.queryByText('Sample Token')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Output 1/i }));
    expect(screen.getByText('ad95...5753')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.queryByText('Sample Token')).not.toBeInTheDocument();
  });

  it('shows BCMR name and icon when metadata exists', () => {
    const item: RawTxIoView = {
      kind: 'output',
      index: 0,
      sats: 1000n,
      outpoint: `${'cc'.repeat(32)}:0`,
      address: 'bitcoincash:qtoken',
      isOpReturn: false,
      opReturnChunks: [],
      token: {
        category: CATEGORY,
        ftAmount: 2n,
        nft: null,
        bcmr: {
          name: 'Sample Token',
          token: { symbol: 'SMP', decimals: 0 },
          uris: { icon: 'https://example.com/icon.png' },
        },
      },
    };

    renderCard(item, makeMetadata());
    expect(screen.getAllByText('Sample Token').length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: 'Sample Token' })).toHaveAttribute(
      'src',
      'https://example.com/icon.png'
    );
  });

  it('lists NFT capability and empty commitment as none', () => {
    const item: RawTxIoView = {
      kind: 'input',
      index: 0,
      sats: 2000n,
      outpoint: `${'dd'.repeat(32)}:3`,
      address: 'bitcoincash:qsource',
      isOpReturn: false,
      opReturnChunks: [],
      token: {
        category: CATEGORY,
        ftAmount: 0n,
        nft: { capability: 'mutable', commitment: '' },
        bcmr: undefined,
      },
    };

    renderCard(item);
    expect(screen.getByText('NFT')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Input 0/i }));
    expect(screen.getByText(/NFT Capability/)).toBeInTheDocument();
    expect(screen.getByText('mutable')).toBeInTheDocument();
    expect(screen.getByText(/NFT Commitment/)).toBeInTheDocument();
    expect(screen.getByText('none')).toBeInTheDocument();
  });
});
