/**
 * Demo reference data for the product setup form. In a real deployment these lists
 * come from the card management system (policies, card ranges, ISO code tables).
 */

export interface CatalogItem {
  id: number;
  name: string;
}

/** ASP the demo user works under (15 characters, as the spec allows). */
export const DEFAULT_ASP_ID = 'ASP000000000001';

export interface PolicyItem extends CatalogItem {
  description: string;
}

export const PIN_POLICIES: PolicyItem[] = [
  { id: 29, name: '4 Digit Debit', description: '4-digit length.' },
  { id: 31, name: '6 Digit Secure', description: '6-digit length, changed at first use.' },
  { id: 35, name: 'Offline PIN', description: '4-digit length with offline verification on chip.' },
];

export const QUOTA_POLICIES: PolicyItem[] = [
  { id: 41, name: 'Travel Endorsement', description: 'International use needs a passport endorsement quota.' },
  { id: 42, name: 'Student File Quota', description: 'Annual quota for student file transactions.' },
];

export const REISSUE_POLICIES: PolicyItem[] = [
  { id: 12, name: 'Auto Renew', description: 'Cards are renewed automatically 30 days before expiry.' },
  { id: 14, name: 'Renew on Request', description: 'Cards are renewed only when the customer asks.' },
];

export interface Scheme {
  id: number;
  name: string;
}

export const SCHEMES: Scheme[] = [
  { id: 6, name: 'Mastercard' },
  { id: 5, name: 'VISA' },
  { id: 7, name: 'UnionPay' },
];

export interface Bin {
  id: number;
  schemeId: number;
  name: string;
}

export const BINS: Bin[] = [
  { id: 14, schemeId: 5, name: 'Visa Classic BIN 421234' },
  { id: 15, schemeId: 5, name: 'Visa Platinum BIN 421235' },
  { id: 16, schemeId: 5, name: 'Visa Business BIN 421236' },
  { id: 21, schemeId: 6, name: 'Mastercard Standard BIN 532100' },
  { id: 22, schemeId: 6, name: 'Mastercard World BIN 532101' },
  { id: 31, schemeId: 7, name: 'UnionPay Classic BIN 621234' },
  { id: 32, schemeId: 7, name: 'UnionPay Gold BIN 621235' },
];

export interface CardRange {
  id: number;
  binId: number;
  name: string;
}

export const CARD_RANGES: CardRange[] = [
  { id: 33, binId: 14, name: 'Range 0000000 to 4999999' },
  { id: 34, binId: 14, name: 'Range 5000000 to 9999999' },
  { id: 35, binId: 15, name: 'Range 0000000 to 9999999' },
  { id: 36, binId: 16, name: 'Range 0000000 to 0999999' },
  { id: 40, binId: 21, name: 'Range 0000000 to 4999999' },
  { id: 41, binId: 21, name: 'Range 5000000 to 9999999' },
  { id: 42, binId: 22, name: 'Range 0000000 to 9999999' },
  { id: 50, binId: 31, name: 'Range 0000000 to 0000002' },
  { id: 51, binId: 32, name: 'Range 0000000 to 4999999' },
];

export interface CardTemplate {
  id: number;
  schemeId: number;
  kind: 'NAMED' | 'ANONYMOUS';
  name: string;
}

export const CARD_TEMPLATES: CardTemplate[] = [
  { id: 101, schemeId: 5, kind: 'NAMED', name: 'Visa Classic Named' },
  { id: 102, schemeId: 5, kind: 'NAMED', name: 'Visa Platinum Named' },
  { id: 103, schemeId: 5, kind: 'ANONYMOUS', name: 'Visa Gift Anonymous' },
  { id: 201, schemeId: 6, kind: 'NAMED', name: 'Mastercard Standard Named' },
  { id: 202, schemeId: 6, kind: 'ANONYMOUS', name: 'Mastercard Instant Anonymous' },
  { id: 301, schemeId: 7, kind: 'NAMED', name: 'UnionPay Named' },
  { id: 302, schemeId: 7, kind: 'ANONYMOUS', name: 'UnionPay Anonymous' },
];

/** Transaction types a product can allow, limit or charge for. */
export const TXN_TYPES: Record<string, string> = {
  POS: 'POS Purchase',
  ECOM: 'E-commerce Purchase',
  ATM_CWD: 'ATM Cash Withdrawal',
  ATM_BI: 'ATM Balance Inquiry',
  NPSB_ATM_CWD: 'NPSB ATM CWD',
  NPSB_FT: 'NPSB Fund Transfer',
  REFUND: 'Refund',
};

/** Merchant category codes offered for MCC controls. */
export const MCCS: Record<string, string> = {
  '4829': 'Money transfer',
  '5411': 'Grocery stores',
  '5812': 'Restaurants',
  '5912': 'Pharmacies',
  '5999': 'Miscellaneous retail',
  '6011': 'ATM cash',
  '7995': 'Gambling',
};

/** Service fees a product can charge, outside of transactions. */
export const SERVICE_FEE_TYPES: Record<string, string> = {
  ANNUAL_MAINTENANCE: 'Card Annual Maintenance Fee',
  ATM_CWD: 'ATM Cash Withdrawal Fee',
  CARD_ISSUANCE: 'Card Issuance Fee',
  CARD_REPLACEMENT: 'Card Replacement Fee',
  PIN_REISSUE: 'PIN Reissue Fee',
  STATEMENT: 'Statement Fee',
};

export const CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'INR', 'SGD', 'AED', 'SAR', 'MYR', 'JPY', 'AUD', 'CAD'];

export const COUNTRIES: Record<string, string> = {
  BGD: 'Bangladesh',
  IND: 'India',
  USA: 'United States',
  GBR: 'United Kingdom',
  SGP: 'Singapore',
  ARE: 'United Arab Emirates',
  SAU: 'Saudi Arabia',
  MYS: 'Malaysia',
};

/** Country used for domestic transactions when the user doesn't name one. */
export const HOME_COUNTRY = 'BGD';
export const HOME_CURRENCY = 'BDT';
