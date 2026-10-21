import {
  isValidLightningAddress,
  lightningAddressError,
  looksLikeInvoice,
} from '../src/utils/lightningAddress';

describe('Lightning address validation', () => {
  it.each([
    'yourname@speed.app',
    'YourName@Speed.App',
    '  someone@speed.app  ',
    'satoshi@zbd.gg',
    'first.last+tips@walletofsatoshi.com',
    'a_b-c@getalby.com',
  ])('accepts %s', addr => {
    expect(isValidLightningAddress(addr)).toBe(true);
    expect(lightningAddressError(addr)).toBeNull();
  });

  it.each([
    '',
    'speed.app',
    'name@',
    '@speed.app',
    'name@speed',
    'name with space@speed.app',
    'name@speed..app',
  ])('rejects %j', addr => {
    expect(isValidLightningAddress(addr)).toBe(false);
    expect(lightningAddressError(addr)).not.toBeNull();
  });

  // The 19 Oct 2026 case: an invoice with "@speed.app" typed onto the end.
  const invoice =
    'lnbc13900n1p4dgdvvpp5td6lz4pxtd8g96pmqnhgr4kdg53zfrdnmyyjx78ryuvssj29vsnsdqqcqzzsxqyz5vqsp5536ax8pzhuc990q9rltjqu2crggq0vcnzqurjmwskxv2uqxuudmq9qxpqysgqxd4aql8uv0q7xzrd2a83gm5qwyqgnz9ekmwrd4mmwwmf8lleuhz5ky9a96ul4tjnu726sr4h8gje3h3vr9r7qd4se7gawqng8xwdujgq9zyt2d';

  it('recognises a pasted invoice, alone or with @speed.app added', () => {
    expect(looksLikeInvoice(invoice)).toBe(true);
    expect(looksLikeInvoice(`${invoice}@speed.app`)).toBe(true);
    expect(looksLikeInvoice(`lightning:${invoice}`)).toBe(true);
    expect(isValidLightningAddress(`${invoice}@speed.app`)).toBe(false);
    expect(lightningAddressError(`${invoice}@speed.app`)).toMatch(/invoice/i);
  });

  it('does not mistake an address for an invoice', () => {
    expect(looksLikeInvoice('lnbcfan@speed.app')).toBe(false);
  });
});
