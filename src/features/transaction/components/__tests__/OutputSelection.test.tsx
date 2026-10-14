/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { configureStore } from '@reduxjs/toolkit';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { I18nContext } from '../../../../i18n/I18nContext';
import { translations } from '../../../../i18n/resources';
import { Network } from '../../../../state/slices/networkSlice';
import type { UTXO } from '../../../../types/types';
import OutputSelection from '../OutputSelection';

vi.mock('../../../../hooks/useTokenMetadata', () => ({
  default: () => ({}),
}));

vi.mock('../../../../utils/barcodeScanner', () => ({
  getBarcodeScannerErrorMessage: () => 'scan failed',
  scanBarcodeSafely: vi.fn(),
}));

const SAMPLE_TOKEN_CATEGORY = 'sample-token-category';

function makeStore() {
  return configureStore({
    reducer: {
      priceFeed: (state = { 'BCH-USD': { price: 0 } }) => state,
    },
  });
}

function renderOutputSelection(token: UTXO['token']) {
  const selectedUtxos: UTXO[] = [
    {
      address: 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
      height: 100,
      tx_hash: '11'.repeat(32),
      tx_pos: 0,
      value: 10_000,
      amount: 10_000,
      token,
    },
  ];

  return render(
    <Provider store={makeStore()}>
      <I18nContext.Provider
        value={{
          locale: 'en',
          setLocale: () => undefined,
          t: (key) => translations.en[key],
        }}
      >
        <OutputSelection
          recipientAddress="bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a"
          setRecipientAddress={() => undefined}
          currentNetwork={Network.MAINNET}
          transferAmount={1000}
          setTransferAmount={() => undefined}
          tokenAmount={0n}
          setTokenAmount={() => undefined}
          utxos={selectedUtxos}
          selectedUtxos={selectedUtxos}
          selectedTokenCategory={SAMPLE_TOKEN_CATEGORY}
          setSelectedTokenCategory={() => undefined}
          addOutput={() => undefined}
          changeAddress="bitcoincash:qchange"
          setChangeAddress={() => undefined}
          txOutputs={[]}
          handleRemoveOutput={() => undefined}
          nftCapability={undefined}
          setNftCapability={() => undefined}
          nftCommitment={undefined}
          setNftCommitment={() => undefined}
        />
      </I18nContext.Provider>
    </Provider>
  );
}

describe('OutputSelection token metadata fallbacks', () => {
  afterEach(() => {
    cleanup();
  });

  it.each([
    {
      label: 'undefined BCMR metadata',
      token: { category: SAMPLE_TOKEN_CATEGORY, amount: 1n },
    },
    {
      label: 'empty BCMR object without uris',
      token: {
        category: SAMPLE_TOKEN_CATEGORY,
        amount: 1n,
        BcmrTokenMetadata: {},
      },
    },
  ])(
    'selecting a category with $label does not crash and shows a short id',
    ({ token }) => {
      expect(() => renderOutputSelection(token as UTXO['token'])).not.toThrow();

      fireEvent.click(screen.getByRole('button', { name: 'Add recipient' }));

      expect(screen.getByRole('combobox')).toHaveValue(SAMPLE_TOKEN_CATEGORY);
      expect(screen.getAllByText('samp...gory').length).toBeGreaterThan(0);
    }
  );
});
