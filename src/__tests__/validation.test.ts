import {
  detectCardBrand,
  getSupportedPostalCodeCountries,
  validateAccountNumberUS,
  validateCard,
  validateCardExpiry,
  validateDateOfBirth,
  validateEmail,
  validateFullName,
  validateNonEmpty,
  validatePhoneE164,
  validatePostalCode,
  validateRoutingNumberUS,
  validateSSNLast4,
  validateZipUS,
} from '../validation';

describe('validateNonEmpty', () => {
  it('null for non-empty trimmed value', () => {
    expect(validateNonEmpty('Eric', 'Name')).toBeNull();
  });

  it('error includes field name', () => {
    expect(validateNonEmpty('', 'Address line 1')).toBe('Address line 1 is required');
    expect(validateNonEmpty('   ', 'City')).toBe('City is required');
  });
});

describe('validateFullName', () => {
  it('accepts first + last', () => {
    expect(validateFullName('Eric Townsend')).toBeNull();
    expect(validateFullName('  Eric  Townsend  ')).toBeNull();
  });

  it('accepts 3+ parts', () => {
    expect(validateFullName('Eric Logan Townsend')).toBeNull();
  });

  it('rejects empty', () => {
    expect(validateFullName('')).toBe('Full name is required');
    expect(validateFullName('   ')).toBe('Full name is required');
  });

  it('rejects single word', () => {
    expect(validateFullName('Eric')).toBe('Enter first and last name');
  });
});

describe('validateEmail', () => {
  it.each(['eric@framepayments.com', 'a@b.co', 'name+tag@host.io', 'unicode.test@xn--80akhbyknj4f.com'])(
    'accepts %s',
    (input) => {
      expect(validateEmail(input)).toBeNull();
    },
  );

  it.each(['', '   '])('rejects empty as "required"', (input) => {
    expect(validateEmail(input)).toBe('Email is required');
  });

  it.each(['no-at-sign', 'two@@signs.com', 'no@dot', '@nostart.com', 'noend@', 'space @space.com'])(
    'rejects %s',
    (input) => {
      expect(validateEmail(input)).toBe('Enter a valid email address');
    },
  );
});

describe('validateZipUS', () => {
  it('accepts 5-digit zip', () => {
    expect(validateZipUS('94107')).toBeNull();
  });

  it('rejects empty as required', () => {
    expect(validateZipUS('')).toBe('Zip code is required');
  });

  it('rejects non-5-digit values', () => {
    expect(validateZipUS('9410')).toBe('Enter a 5-digit zip code');
    expect(validateZipUS('941078')).toBe('Enter a 5-digit zip code');
    expect(validateZipUS('9410A')).toBe('Enter a 5-digit zip code');
    // The native validateZipUS rejects the extended ZIP+4 form (use validatePostalCode for that).
    expect(validateZipUS('94107-1234')).toBe('Enter a 5-digit zip code');
  });
});

describe('validateCard', () => {
  it('accepts a Luhn-valid Visa test card', () => {
    expect(validateCard('4242 4242 4242 4242')).toBeNull();
  });

  it('accepts MasterCard', () => {
    expect(validateCard('5555555555554444')).toBeNull();
  });

  it('accepts AmEx (15 digits)', () => {
    expect(validateCard('378282246310005')).toBeNull();
  });

  it('rejects empty / non-digits', () => {
    expect(validateCard('')).toBe('Enter valid card details');
    expect(validateCard('not a card')).toBe('Enter valid card details');
  });

  it('rejects wrong length', () => {
    expect(validateCard('4242424242')).toBe('Enter valid card details');
  });

  it('rejects Luhn failure', () => {
    expect(validateCard('4242424242424241')).toBe('Enter valid card details');
  });

  it('rejects unknown IIN', () => {
    expect(validateCard('1234567890123452')).toBe('Enter valid card details');
  });
});

describe('detectCardBrand', () => {
  it('detects common brands', () => {
    expect(detectCardBrand('4242424242424242')).toBe('visa');
    expect(detectCardBrand('5555555555554444')).toBe('mastercard');
    expect(detectCardBrand('378282246310005')).toBe('amex');
    expect(detectCardBrand('6011111111111117')).toBe('discover');
    expect(detectCardBrand('3530111333300000')).toBe('jcb');
  });

  it('detects 2-series MasterCard (2221–2720)', () => {
    expect(detectCardBrand('2221000000000009')).toBe('mastercard');
    expect(detectCardBrand('2720990000000007')).toBe('mastercard');
  });

  it('disambiguates JCB (35) from Diners (36/38/39)', () => {
    expect(detectCardBrand('3530111333300000')).toBe('jcb');
    expect(detectCardBrand('3600000000000007')).toBe('diners');
    expect(detectCardBrand('3800000000000003')).toBe('diners');
  });

  it('returns null on unknown IIN', () => {
    expect(detectCardBrand('1234567890123456')).toBeNull();
  });
});

describe('validateCardExpiry', () => {
  const now = new Date(Date.UTC(2026, 4, 22)); // 2026-05-22

  it('accepts future date (4-digit year)', () => {
    expect(validateCardExpiry('12', '2030', now)).toBeNull();
  });

  it('accepts future date (2-digit year)', () => {
    expect(validateCardExpiry('12', '30', now)).toBeNull();
  });

  it('rejects out-of-range month', () => {
    expect(validateCardExpiry('00', '2030', now)).toBe('Invalid expiration month');
    expect(validateCardExpiry('13', '2030', now)).toBe('Invalid expiration month');
  });

  it('rejects out-of-range year', () => {
    expect(validateCardExpiry('06', '1999', now)).toBe('Invalid expiration year');
    expect(validateCardExpiry('06', '2101', now)).toBe('Invalid expiration year');
  });

  it('rejects expired card', () => {
    expect(validateCardExpiry('04', '2026', now)).toBe('Card has expired');
    expect(validateCardExpiry('12', '2025', now)).toBe('Card has expired');
  });

  it('accepts current month', () => {
    expect(validateCardExpiry('05', '2026', now)).toBeNull();
  });

  it('accepts both "05" and "5" for the month', () => {
    expect(validateCardExpiry('05', '2030', now)).toBeNull();
    expect(validateCardExpiry('5', '2030', now)).toBeNull();
  });

  it('rejects scientific notation in month/year (stricter than Number())', () => {
    expect(validateCardExpiry('5e2', '2030', now)).toBe('Invalid expiration month');
    expect(validateCardExpiry('05', '2e3', now)).toBe('Invalid expiration year');
  });

  it('rejects decimal month', () => {
    expect(validateCardExpiry('5.5', '2030', now)).toBe('Invalid expiration month');
  });
});

describe('validateSSNLast4', () => {
  it('accepts 4 digits', () => {
    expect(validateSSNLast4('1234')).toBeNull();
  });

  it('rejects empty as required', () => {
    expect(validateSSNLast4('')).toBe('SSN is required');
  });

  it('rejects wrong length / non-digits', () => {
    expect(validateSSNLast4('123')).toBe('Enter last 4 digits of SSN');
    expect(validateSSNLast4('12345')).toBe('Enter last 4 digits of SSN');
    expect(validateSSNLast4('12a4')).toBe('Enter last 4 digits of SSN');
  });
});

describe('validateRoutingNumberUS', () => {
  it('accepts a valid ABA-checksum routing number (Bank of America NY)', () => {
    expect(validateRoutingNumberUS('021000322')).toBeNull();
  });

  it('rejects empty as required', () => {
    expect(validateRoutingNumberUS('')).toBe('Routing number is required');
  });

  it('rejects wrong length / non-digit', () => {
    expect(validateRoutingNumberUS('12345678')).toBe('Enter a 9-digit routing number');
    expect(validateRoutingNumberUS('1234567890')).toBe('Enter a 9-digit routing number');
    expect(validateRoutingNumberUS('12345678A')).toBe('Enter a 9-digit routing number');
  });

  it('rejects checksum failure', () => {
    expect(validateRoutingNumberUS('021000321')).toBe('Enter a valid routing number');
  });

  // The ABA checksum on all-zero passes (0 % 10 === 0). This isn't a real
  // routing number, but iOS does the same — locking in the parity behavior.
  it('does not reject all-zeros (parity with iOS — checksum-only)', () => {
    expect(validateRoutingNumberUS('000000000')).toBeNull();
  });
});

describe('validateAccountNumberUS', () => {
  it('accepts within default 4–17 range', () => {
    expect(validateAccountNumberUS('1234')).toBeNull();
    expect(validateAccountNumberUS('12345678901234567')).toBeNull();
  });

  it('rejects empty as required', () => {
    expect(validateAccountNumberUS('')).toBe('Account number is required');
  });

  it('rejects too short / too long / non-digit', () => {
    expect(validateAccountNumberUS('123')).toBe('Enter a valid account number');
    expect(validateAccountNumberUS('123456789012345678')).toBe('Enter a valid account number');
    expect(validateAccountNumberUS('12345abc')).toBe('Enter a valid account number');
  });

  it('honors custom min/max', () => {
    expect(validateAccountNumberUS('12345', 6, 12)).toBe('Enter a valid account number');
    expect(validateAccountNumberUS('1234567', 6, 12)).toBeNull();
  });
});

describe('validateDateOfBirth', () => {
  const now = new Date(Date.UTC(2026, 4, 22));

  it('accepts an adult DOB', () => {
    expect(validateDateOfBirth('1990', '5', '22', 18, 120, now)).toBeNull();
  });

  it('rejects any empty field as required', () => {
    expect(validateDateOfBirth('', '5', '22', 18, 120, now)).toBe('Date of birth is required');
    expect(validateDateOfBirth('1990', '', '22', 18, 120, now)).toBe('Date of birth is required');
    expect(validateDateOfBirth('1990', '5', '', 18, 120, now)).toBe('Date of birth is required');
  });

  it('rejects 2-digit year', () => {
    expect(validateDateOfBirth('90', '5', '22', 18, 120, now)).toBe('Enter a valid date of birth');
  });

  it('rejects out-of-range month / day', () => {
    expect(validateDateOfBirth('1990', '13', '01', 18, 120, now)).toBe('Enter a valid date of birth');
    expect(validateDateOfBirth('1990', '5', '0', 18, 120, now)).toBe('Enter a valid date of birth');
  });

  it('rejects calendar-invalid date (Feb 31)', () => {
    expect(validateDateOfBirth('1990', '2', '31', 18, 120, now)).toBe('Enter a valid date of birth');
  });

  it('rejects minor (below minAge) with explicit message', () => {
    expect(validateDateOfBirth('2020', '5', '22', 18, 120, now)).toBe('You must be at least 18 years old');
  });

  it('rejects age above maxAge as generic invalid', () => {
    expect(validateDateOfBirth('1800', '5', '22', 18, 120, now)).toBe('Enter a valid date of birth');
  });

  it('honors custom minAge in the error', () => {
    expect(validateDateOfBirth('2015', '5', '22', 21, 120, now)).toBe('You must be at least 21 years old');
  });
});

describe('validatePostalCode', () => {
  it.each([
    ['US', '94107'],
    ['US', '94107-1234'],
    ['CA', 'K1A 0B1'],
    ['CA', 'K1A0B1'],
    ['GB', 'SW1A 1AA'],
    ['GB', 'EC1A1BB'],
    ['DE', '10115'],
    ['JP', '100-0001'],
    ['JP', '1000001'],
    ['BR', '01310-100'],
    ['NL', '1011AB'],
    ['NL', '1011 AB'],
    ['IE', 'D02 X285'],
  ])('accepts %s %s', (country, code) => {
    expect(validatePostalCode(code, country)).toBeNull();
  });

  it.each([
    ['US', '9410'],
    ['CA', '94107'],
    ['GB', '12345'],
    ['JP', 'ABC-1234'],
  ])('rejects %s %s', (country, code) => {
    expect(validatePostalCode(code, country)).toBe('Enter a valid postal code');
  });

  it('rejects empty as required', () => {
    expect(validatePostalCode('', 'US')).toBe('Postal code is required');
    expect(validatePostalCode('   ', 'US')).toBe('Postal code is required');
  });

  it('skips validation for unknown countries (returns null)', () => {
    expect(validatePostalCode('any-thing', 'ZZ')).toBeNull();
  });

  it('country code is case-insensitive', () => {
    expect(validatePostalCode('94107', 'us')).toBeNull();
  });

  it('supports all 16 documented postal-code countries', () => {
    expect(getSupportedPostalCodeCountries().sort()).toEqual(
      ['AU', 'BR', 'CA', 'DE', 'ES', 'FR', 'GB', 'IE', 'IN', 'IT', 'JP', 'MX', 'NL', 'NZ', 'SG', 'US'].sort(),
    );
  });
});

describe('validatePhoneE164', () => {
  it('accepts a valid US number', () => {
    expect(validatePhoneE164('555 555 1212', 'US')).toBeNull();
    expect(validatePhoneE164('+1 415 555 1212', 'US')).toBeNull();
  });

  it('accepts a valid international number', () => {
    expect(validatePhoneE164('20 7946 0958', 'GB')).toBeNull();
  });

  it('rejects empty as required', () => {
    expect(validatePhoneE164('', 'US')).toBe('Phone number is required');
    expect(validatePhoneE164('   ', 'US')).toBe('Phone number is required');
  });

  it('rejects unparseable input', () => {
    expect(validatePhoneE164('abc', 'US')).toBe('Enter a valid phone number');
    expect(validatePhoneE164('1', 'US')).toBe('Enter a valid phone number');
  });

  // PhoneNumberKit and libphonenumber-js both accept a foreign-prefix number
  // (e.g. UK +44 with regionCode='US') because the explicit + prefix overrides
  // the supplied region. iOS does the same. Locked-in for parity.
  it('accepts a number with a foreign + prefix regardless of region (iOS parity)', () => {
    expect(validatePhoneE164('+44 20 7946 0958', 'US')).toBeNull();
  });
});
