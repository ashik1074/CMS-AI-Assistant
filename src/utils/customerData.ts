import type { CustomerIdType, CustomerProfile, CustomerStatus, DateParts } from '../types/customer';
import { hashString, seededRandom } from './reportData';

/*
 * Customer lookup. There is no customer system behind the demo: profiles are generated in the browser,
 * the same every time for the same identifier, plus one fixed sample customer.
 */

/* ---------- Intent ---------- */

/** "Give me customer information for this Phone Number '01789833786'", "customer details for CIF …", "find customer 13806". */
export const CUSTOMER_LOOKUP_PATTERN =
  /\bcustomers?\b[^\n]*\b(info(rmation)?|details?|profile|data|record|lookup)\b|\b(find|search|look\s*up|get|show|fetch)\b[^\n]*\bcustomers?\b/i;

export const ID_TYPE_LABELS: Record<CustomerIdType, string> = { phone: 'Phone Number', cif: 'CIF ID', customerId: 'Customer ID' };

export const ID_TYPE_CHOICES: { value: CustomerIdType; label: string; hint: string }[] = [
  { value: 'phone', label: 'Phone Number', hint: 'Registered mobile number, e.g. 01XXXXXXXXX' },
  { value: 'cif', label: 'CIF ID', hint: 'Customer Information File number' },
  { value: 'customerId', label: 'Customer ID', hint: 'The numeric ID the system gave the customer' },
];

/** The identifier to search for: a quoted value first, otherwise the last ID-like token. */
export function extractCustomerQuery(text: string): string | null {
  const quoted = /['"‘’“”`]\s*([A-Za-z0-9+\- ]{3,24}?)\s*['"‘’“”`]/.exec(text);
  if (quoted && /\d/.test(quoted[1])) return quoted[1].replace(/[\s-]+/g, '');
  const tokens = text.match(/\+?[A-Za-z]{0,4}\d[\d-]{2,16}\b/g);
  return tokens ? tokens[tokens.length - 1].replace(/-/g, '') : null;
}

/** What kind of identifier the prompt says it is, if it says. */
export function idTypeFromPrompt(text: string): CustomerIdType | null {
  if (/\bcif\b/i.test(text)) return 'cif';
  if (/\bcustomer\s*(id|no\.?|number)\b|\bcust\s*id\b/i.test(text)) return 'customerId';
  if (/\b(phone|mobile|cell|msisdn|contact\s*number)\b/i.test(text)) return 'phone';
  return null;
}

const FORMATS: Record<CustomerIdType, { test: (v: string) => boolean; rule: string }> = {
  phone: { test: (v) => /^(\+?88)?01[3-9]\d{8}$/.test(v), rule: 'A phone number has 11 digits and starts with 01 (for example 01789833786).' },
  cif: { test: (v) => /^(CIF)?\d{5,12}$/i.test(v), rule: 'A CIF ID is 5 to 12 digits, optionally starting with CIF (for example CIF0013806).' },
  customerId: { test: (v) => /^\d{1,10}$/.test(v), rule: 'A customer ID is a number of up to 10 digits (for example 13806).' },
};

export const isValidId = (value: string, type: CustomerIdType) => FORMATS[type].test(value);
export const idRule = (type: CustomerIdType) => FORMATS[type].rule;

/** The national part of a phone number: 01XXXXXXXXX. */
const localPhone = (v: string) => v.replace(/^\+?88/, '');

/* ---------- Profiles ---------- */

const SAMPLE: CustomerProfile = {
  salutation: 'Mr.',
  name: 'Nafidul Alam',
  customerId: 13806,
  cifId: 'CIF0013806',
  status: 'Active',
  fatherName: 'Rabbi',
  motherName: 'Salma',
  dateOfBirth: { year: 2003, month: 1, day: 6 },
  mobile: '01789833786',
  email: 'asnafidul.alam.2003bd@gmail.com',
  registeredOn: { year: 2026, month: 10, day: 27, hour: 14, minute: 59 },
};

const MALE = ['Nafidul', 'Tanvir', 'Rakibul', 'Mahmudul', 'Arif', 'Shakil', 'Imran', 'Fahim', 'Sabbir', 'Rashed', 'Tahmid', 'Mehedi'];
const FEMALE = ['Nusrat', 'Farzana', 'Sadia', 'Tasnim', 'Mim', 'Jannatul', 'Sumaiya', 'Rumana', 'Afsana', 'Nabila', 'Tahmina', 'Sharmin'];
const SURNAMES = ['Alam', 'Rahman', 'Hossain', 'Islam', 'Ahmed', 'Chowdhury', 'Khan', 'Sarker', 'Karim', 'Uddin', 'Haque', 'Akter'];
const FATHERS = ['Rabbi', 'Abdul Karim', 'Mizanur Rahman', 'Shahidul Islam', 'Abul Kalam', 'Nurul Amin', 'Delwar Hossain', 'Harun Or Rashid'];
const MOTHERS = ['Salma', 'Rokeya Begum', 'Nasrin Akter', 'Shirin Sultana', 'Hasina Begum', 'Rehana Parvin', 'Kohinoor', 'Fatema Khatun'];
const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com'];

const pick = <T>(rand: () => number, list: readonly T[]) => list[Math.floor(rand() * list.length)];
const between = (rand: () => number, lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const daysIn = (year: number, month: number) => new Date(year, month, 0).getDate();

function generated(value: string, type: CustomerIdType): CustomerProfile {
  const rand = seededRandom(hashString(`${type}:${value.toUpperCase()}`));
  const male = rand() < 0.55;
  const first = pick(rand, male ? MALE : FEMALE);
  const last = pick(rand, SURNAMES);
  const customerId = type === 'customerId' ? Number(value) : between(rand, 10000, 99999);
  const cifDigits = type === 'cif' ? value.replace(/^CIF/i, '') : String(customerId).padStart(7, '0');
  const dobYear = between(rand, 1965, 2005);
  const dobMonth = between(rand, 1, 12);
  const regYear = between(rand, 2018, 2026);
  const regMonth = between(rand, 1, regYear === 2026 ? 10 : 12);
  const statusRoll = rand();
  const status: CustomerStatus = statusRoll < 0.85 ? 'Active' : statusRoll < 0.95 ? 'Inactive' : 'Dormant';
  const local = `${first}.${last}${between(rand, 1, 99)}`.toLowerCase().replace(/\s+/g, '');
  return {
    salutation: male ? 'Mr.' : 'Ms.',
    name: `${first} ${last}`,
    customerId,
    cifId: `CIF${cifDigits}`,
    status,
    fatherName: pick(rand, FATHERS),
    motherName: pick(rand, MOTHERS),
    dateOfBirth: { year: dobYear, month: dobMonth, day: between(rand, 1, daysIn(dobYear, dobMonth)) },
    mobile: type === 'phone' ? localPhone(value) : `01${between(rand, 3, 9)}${String(between(rand, 0, 99999999)).padStart(8, '0')}`,
    email: `${local}@${pick(rand, DOMAINS)}`,
    registeredOn: { year: regYear, month: regMonth, day: between(rand, 1, daysIn(regYear, regMonth)), hour: between(rand, 8, 21), minute: between(rand, 0, 59) },
  };
}

/** The customer for an identifier, or `null` when the value can't be that kind of ID. */
export function findCustomer(value: string, type: CustomerIdType): CustomerProfile | null {
  if (!isValidId(value, type)) return null;
  const isSample =
    (type === 'phone' && localPhone(value) === SAMPLE.mobile) ||
    (type === 'customerId' && Number(value) === SAMPLE.customerId) ||
    (type === 'cif' && value.replace(/^CIF/i, '').replace(/^0+/, '') === String(SAMPLE.customerId));
  return isSample ? SAMPLE : generated(value, type);
}

/* ---------- Display ---------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** 06-Jan-2003 */
export const formatDay = (d: DateParts) => `${pad(d.day)}-${MONTHS[d.month - 1]}-${d.year}`;

/** 27-Oct-2026 · 02:59 PM */
export function formatDayTime(d: DateParts) {
  const hour = d.hour ?? 0;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${formatDay(d)} · ${pad(h12)}:${pad(d.minute ?? 0)} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** Keeps the first two characters of the mailbox name: as*******************@gmail.com */
export function maskEmail(email: string) {
  const at = email.lastIndexOf('@');
  if (at < 1) return email;
  const name = email.slice(0, at);
  const keep = Math.min(2, name.length);
  return `${name.slice(0, keep)}${'*'.repeat(name.length - keep)}${email.slice(at)}`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

/* ---------- Chat text ---------- */

export const customerFoundText = (query: string, type: CustomerIdType) => `Here's the customer I found for ${ID_TYPE_LABELS[type]} **${query}**.`;

export const customerInvalidText = (query: string, type: CustomerIdType) =>
  `**${query}** doesn't look like a valid ${ID_TYPE_LABELS[type]}. ${idRule(type)} You can search it as a different kind of ID below.`;

export const customerChooseText = (query: string) =>
  `I'll look up the customer for **${query}**. Is it a phone number, a CIF ID or a customer ID? Choose one and I'll search.`;

export const NO_CUSTOMER_QUERY_TEXT =
  "I can look up a customer, but I need their phone number, CIF ID or customer ID. Try: **Give me customer information for this Phone Number '01789833786'**.";
