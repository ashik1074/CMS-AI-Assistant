/** Customer lookup: the assistant finds a customer by phone number, CIF ID or customer ID. */

export type CustomerIdType = 'phone' | 'cif' | 'customerId';

/**
 * `choosing` = waiting for the user to say what kind of identifier the value is;
 * `searching` = the short search pause; `found` = profile shown; `invalid` = the value can't be that kind of ID.
 */
export type CustomerLookupStatus = 'choosing' | 'searching' | 'found' | 'invalid';

export interface CustomerLookupAction {
  type: 'customerLookup';
  /** The identifier as the user wrote it. */
  query: string;
  /** `null` until known: from the prompt, or picked by the user. */
  idType: CustomerIdType | null;
  /** The prompt said what kind of ID it is, so the user wasn't asked. */
  idTypeFromPrompt: boolean;
  status: CustomerLookupStatus;
  searchedAt?: number;
}

export type CustomerStatus = 'Active' | 'Inactive' | 'Dormant';

/** Calendar date and time as plain parts, so it reads the same in every time zone. */
export interface DateParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour?: number;
  minute?: number;
}

export interface CustomerProfile {
  salutation: 'Mr.' | 'Ms.';
  name: string;
  customerId: number;
  cifId: string;
  status: CustomerStatus;
  fatherName: string;
  motherName: string;
  dateOfBirth: DateParts;
  mobile: string;
  email: string;
  registeredOn: DateParts;
}
