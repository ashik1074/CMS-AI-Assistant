import { describe, expect, it } from 'vitest';
import { extractCustomerQuery, findCustomer, formatDay, formatDayTime, idRule, idTypeFromPrompt, initials, isValidId, maskEmail, searchCustomers, validateCustomerSearch } from './customerData';
import { matchScenario, MOCK_SCENARIOS } from './mockResponses';

const lookup = MOCK_SCENARIOS.find((s) => s.id === 'customerLookup')!;
const NOW = new Date(2026, 10, 3, 12, 0);

describe('customer lookup prompts', () => {
  it.each([
    "Give me customer information for this Phone Number '01789833786'",
    "Give me customer information for '01789833786'",
    'give me customer info for 01712345678',
    'Show customer details for CIF ID CIF0013806',
    'Find customer 13806',
  ])('routes "%s" to the customer lookup', (prompt) => {
    expect(matchScenario(prompt).scenario?.id).toBe('customerLookup');
  });

  it('does not take over other requests', () => {
    expect(matchScenario('Show me visual transaction data for 01712345678').scenario?.id).toBe('transactionReport');
    expect(matchScenario('Create a Product').scenario?.id).toBe('createProduct');
  });

  it('reads the identifier, quoted or not', () => {
    expect(extractCustomerQuery("Give me customer information for this Phone Number '01789833786'")).toBe('01789833786');
    expect(extractCustomerQuery('customer information for “01789833786”')).toBe('01789833786');
    expect(extractCustomerQuery('customer details for CIF ID CIF0013806')).toBe('CIF0013806');
    expect(extractCustomerQuery('customer info for 0178-983-3786')).toBe('01789833786');
    expect(extractCustomerQuery('give me customer information')).toBeNull();
  });

  it('knows the ID type only when the prompt says it', () => {
    expect(idTypeFromPrompt("customer information for this Phone Number '01789833786'")).toBe('phone');
    expect(idTypeFromPrompt('customer details for mobile 01789833786')).toBe('phone');
    expect(idTypeFromPrompt('customer details for CIF ID 0013806')).toBe('cif');
    expect(idTypeFromPrompt('customer information for Customer ID 13806')).toBe('customerId');
    // "customer information" is not "customer ID".
    expect(idTypeFromPrompt("Give me customer information for '01789833786'")).toBeNull();
  });

  it('shows the customer straight away when the prompt names the ID type', () => {
    const reply = lookup.agent!("Give me customer information for this Phone Number '01789833786'", [], NOW);
    expect(reply.action).toEqual({ type: 'customerLookup', query: '01789833786', idType: 'phone', idTypeFromPrompt: true, status: 'found', searchedAt: NOW.getTime() });
    expect(reply.content).toContain('Phone Number **01789833786**');
  });

  it('asks for the ID type when the prompt does not say', () => {
    const reply = lookup.agent!("Give me customer information for '01789833786'", [], NOW);
    expect(reply.action).toEqual({ type: 'customerLookup', query: '01789833786', idType: null, idTypeFromPrompt: false, status: 'choosing' });
  });

  it('says when the value cannot be the named ID type, and asks for an identifier when there is none', () => {
    expect(lookup.agent!("customer information for Phone Number '12345'", [], NOW).action).toMatchObject({ status: 'invalid', idType: 'phone' });
    const none = lookup.agent!('give me customer information', [], NOW);
    expect(none.action).toBeUndefined();
    expect(none.content).toMatch(/phone number, CIF ID, customer ID or NID/);
  });
});

describe('findCustomer', () => {
  it('returns the sample customer for its phone number, customer ID or CIF ID', () => {
    for (const [value, type] of [
      ['01789833786', 'phone'],
      ['+8801789833786', 'phone'],
      ['13806', 'customerId'],
      ['CIF0013806', 'cif'],
    ] as const) {
      const c = findCustomer(value, type)!;
      expect(c.name).toBe('Nafidul Alam');
      expect(c.customerId).toBe(13806);
    }
    const c = findCustomer('01789833786', 'phone')!;
    expect(`${c.salutation} ${c.name}`).toBe('Mr. Nafidul Alam');
    expect([c.status, c.fatherName, c.motherName]).toEqual(['Active', 'Rabbi', 'Salma']);
    expect(formatDay(c.dateOfBirth)).toBe('06-Jan-2003');
    expect(maskEmail(c.email)).toBe('as*******************@gmail.com');
    expect(formatDayTime(c.registeredOn)).toBe('27-Oct-2026 · 02:59 PM');
  });

  it('gives any other valid ID a complete profile, the same every time, matching what was searched', () => {
    const a = findCustomer('01712345678', 'phone')!;
    expect(findCustomer('01712345678', 'phone')).toEqual(a);
    expect(a.mobile).toBe('01712345678');
    expect(a.name).toMatch(/^\S+ \S+$/);
    expect(isValidId(a.mobile, 'phone')).toBe(true);
    expect(findCustomer('4242', 'customerId')!.customerId).toBe(4242);
    expect(findCustomer('CIF778899', 'cif')!.cifId).toBe('CIF778899');
    expect(findCustomer('01712345678', 'customerId')).not.toEqual(a);
  });

  it('finds nobody for a value that cannot be that ID type', () => {
    expect(findCustomer('12345', 'phone')).toBeNull();
    expect(findCustomer('01789833786', 'customerId')).toBeNull(); // 11 digits is too long for a customer ID
    expect(findCustomer('ABC', 'cif')).toBeNull();
  });

  it('formats for display', () => {
    expect(formatDayTime({ year: 2026, month: 1, day: 5, hour: 0, minute: 7 })).toBe('05-Jan-2026 · 12:07 AM');
    expect(formatDayTime({ year: 2026, month: 1, day: 5, hour: 12, minute: 0 })).toBe('05-Jan-2026 · 12:00 PM');
    expect(maskEmail('ab@x.com')).toBe('ab@x.com');
    expect(initials('Nafidul Alam')).toBe('NA');
  });
});

describe('Customer Search form', () => {
  const blank = { phone: '', cif: '', nid: '' };

  it('needs at least one detail, and checks the format of each one given', () => {
    expect(validateCustomerSearch(blank)).toEqual({ form: 'Enter at least one: phone number, CIF ID or NID.' });
    expect(validateCustomerSearch({ ...blank, phone: '0171' })).toEqual({ phone: idRule('phone') });
    expect(validateCustomerSearch({ ...blank, nid: '12345678901234567' })).toEqual({});
    expect(validateCustomerSearch({ ...blank, cif: ' cif 0013806 ' })).toEqual({});
  });

  it('finds one customer matching every detail given', () => {
    const customer = searchCustomers({ phone: '017-1234-5678', cif: '', nid: '1987654321' })!;
    expect(customer.mobile).toBe('01712345678');
    expect(customer.nid).toBe('1987654321');
    expect(searchCustomers({ ...blank, cif: 'CIF0013806' })).toMatchObject({ name: 'Nafidul Alam', customerId: 13806, nid: '5102345678' });
    expect(searchCustomers(blank)).toBeNull();
  });

  it('finds customers by NID in chat lookups too', () => {
    expect(idTypeFromPrompt('Customer details for NID 5102345678')).toBe('nid');
    expect(findCustomer('5102345678', 'nid')?.name).toBe('Nafidul Alam');
    expect(findCustomer('12345', 'nid')).toBeNull();
  });
});
