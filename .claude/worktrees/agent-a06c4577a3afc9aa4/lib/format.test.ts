import { faCompact, faCurrency, faNumber, faPercent, toFaDigits } from '../lib/format';

describe('toFaDigits', () => {
  it('converts every ASCII digit', () => {
    expect(toFaDigits('ORD-72411')).toBe('ORD-۷۲۴۱۱');
  });

  it('leaves non-digit characters untouched', () => {
    expect(toFaDigits('a1b2')).toBe('a۱b۲');
  });
});

describe('faNumber', () => {
  it('groups thousands with the Persian separator', () => {
    expect(faNumber(1234567)).toBe('۱٬۲۳۴٬۵۶۷');
  });

  it('keeps requested fraction digits with the Persian decimal separator', () => {
    expect(faNumber(12.4, 1)).toBe('۱۲٫۴');
  });

  it('uses the minus sign and rounds to the last digit', () => {
    expect(faNumber(-2.78, 1)).toBe('−۲٫۸');
  });

  it('returns an em dash for non-finite input', () => {
    expect(faNumber(Number.NaN)).toBe('—');
  });
});

describe('faCompact', () => {
  it('compacts millions', () => {
    expect(faCompact(4_284_500_000)).toBe('۴٫۳ میلیارد');
  });

  it('compacts thousands', () => {
    expect(faCompact(12_400)).toBe('۱۲٫۴ هزار');
  });

  it('keeps small numbers as-is', () => {
    expect(faCompact(842)).toBe('۸۴۲');
  });
});

describe('faPercent', () => {
  it('adds the sign when asked', () => {
    expect(faPercent(12.4, { signed: true })).toBe('+۱۲٫۴٪');
  });

  it('stays unsigned by default', () => {
    expect(faPercent(12.4)).toBe('۱۲٫۴٪');
  });
});

describe('faCurrency', () => {
  it('appends the Toman unit', () => {
    expect(faCurrency(1_000_000)).toBe('۱ میلیون تومان');
    expect(faCurrency(720_000, false)).toBe('۷۲۰٬۰۰۰ تومان');
  });
});
