import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { I18nContext } from '../../../../i18n/I18nContext';
import { translations } from '../../../../i18n/resources';
import type { TransactionBurnReport } from '../../../../utils/detectTransactionBurns';
import BurnConfirmDialog from '../BurnConfirmDialog';

const SAMPLE_CATEGORY =
  'ad95860f11111111111111111111111111111111111111111111111111115753';

const report: TransactionBurnReport = {
  fungibleTokens: [{ category: SAMPLE_CATEGORY, amount: 1n }],
  nfts: [
    {
      category: SAMPLE_CATEGORY,
      capability: 'none',
      commitment: 'cafe',
    },
  ],
  bch: [
    { kind: 'op_return', amount: 1000n },
    { kind: 'excess_fee', amount: 50000n },
  ],
};

describe('BurnConfirmDialog', () => {
  it('lists exact FT, NFT, and BCH burns with Cancel as the safe action', () => {
    const html = renderToStaticMarkup(
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
        <BurnConfirmDialog
          open
          report={report}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
        />
      </I18nContext.Provider>
    );

    expect(html).toContain('This transaction would burn assets');
    expect(html).toContain(SAMPLE_CATEGORY);
    expect(html).toContain('1');
    expect(html).toContain('cafe');
    expect(html).toContain('none');
    expect(html).toContain('OP_RETURN output: 1000 sats');
    expect(html).toContain('Excessive fee: 50000 sats');
    expect(html).toContain('Cancel');
    expect(html).toContain('Burn and broadcast');
    expect(html.indexOf('Cancel')).toBeLessThan(
      html.indexOf('Burn and broadcast')
    );
    expect(html).toContain('wallet-btn-danger');
    expect(html).not.toContain('wallet-btn-primary wallet-dialog-button');
  });

  it('renders nothing when there is no burn report', () => {
    const html = renderToStaticMarkup(
      <I18nContext.Provider
        value={{
          locale: 'en',
          setLocale: () => undefined,
          t: (key) => translations.en[key],
        }}
      >
        <BurnConfirmDialog
          open
          report={null}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
        />
      </I18nContext.Provider>
    );

    expect(html).toBe('');
  });
});
