import type { CustomerLookupAction } from './customer';
import type { ReportAction } from './report';

/**
 * Card product setup, modelled on the KONA PARTNER "Product Setup" flow:
 * Basics → Policies → Permissions → Limits → Fees → Schemes → Review.
 */

export type MarketSegment = 'CONSUMER' | 'COMMERCIAL';
export type ProductType = 'DEBIT' | 'CREDIT' | 'PREPAID';
export type YesNo = 'Y' | 'N';
export type IntlUsage = 'ENABLED_BY_DEFAULT' | 'DISABLED_BY_DEFAULT';
export type RenewalType = 'RENEWABLE' | 'ONE_TIME';
export type ControlMode = 'ALLOW_ALL_EXCEPT' | 'DISALLOW_ALL_EXCEPT';

/** Country, currency or MCC rule: everything allowed except the listed codes, or nothing allowed except them. */
export interface AccessControl {
  mode: ControlMode;
  exceptions: string[];
}

/** One BIN + card range row inside a scheme. `null` means "not chosen yet". */
export interface SchemeRangeRow {
  binId: number | null;
  cardRangeId: number | null;
}

/**
 * Scheme configuration chosen by the user (never pre-selected by the assistant):
 * the scheme, at least one card template, and the BIN / card range rows mapped to the product.
 */
export interface SchemeConfig {
  schemeId: number | null;
  namedTemplateId: number | null;
  anonymousTemplateId: number | null;
  ranges: SchemeRangeRow[];
}

/** The questions asked before the assistant prepares the full setup. */
export interface ProductBasics {
  productType: ProductType | '';
  currency: string;
  marketSegment: MarketSegment | '';
}

/** Limits for one transaction type. An empty value (`null`) means "No limit". */
export interface TxnLimit {
  txnType: string;
  perTxMin: number | null;
  perTxMax: number | null;
  dailyCount: number | null;
  dailyAmount: number | null;
  monthlyCount: number | null;
  monthlyAmount: number | null;
}

/** One usage band of a fee. `amountTo: null` means "and above". */
export interface FeeTier {
  amountFrom: number | null;
  amountTo: number | null;
  rate: number | null;
  minFee: number | null;
  maxFee: number | null;
  fixedFee: number | null;
  vatRate: number | null;
  vatIncluded: boolean;
}

/** A fee policy. `feeType` is a service fee code for service fees, or a transaction type for transaction fees. */
export interface FeeRule {
  feeType: string;
  title: string;
  effectiveDate: string;
  expiryDate: string;
  tiers: FeeTier[];
}

/** Editable form state. Dates are `YYYY-MM-DD`. */
export interface ProductForm {
  /* Basics */
  aspId: string;
  productName: string;
  shortDesc: string;
  marketSegment: MarketSegment;
  productType: ProductType | '';
  currency: string;
  validityYears: number | null;
  defaultName: string;
  effectiveDate: string;
  allowDomesticTxn: YesNo;
  domesticSettlementCurrency: string;
  allowIntlTxn: YesNo;
  intlSettlementCurrency: string;
  intlUsage: IntlUsage;
  /* Policies */
  pinPolicyRequired: YesNo;
  pinPolicyId: number | null;
  quotaPolicyRequired: YesNo;
  quotaPolicyId: number | null;
  renewalType: RenewalType;
  reissuePolicyId: number | null;
  /* Permissions */
  domesticTxnTypes: string[];
  intlTxnTypes: string[];
  countryControl: AccessControl;
  currencyControl: AccessControl;
  mccControl: AccessControl;
  /* Limits */
  domesticLimits: TxnLimit[];
  intlLimits: TxnLimit[];
  /* Fees */
  serviceFees: FeeRule[];
  domesticFees: FeeRule[];
  intlFees: FeeRule[];
  /* Schemes */
  schemes: SchemeConfig[];
  createdBy: string;
}

export type ProductField = keyof ProductForm;

/** Lifecycle of a product in the card management system. */
export type ProductStatus = 'DRAFT' | 'PENDING_APPROVAL';

/** Where a product was started, so pages outside the chat can update the chat's card. */
export interface ProductOrigin {
  conversationId: string;
  messageId: string;
}

export interface ProductRecord {
  productId: string;
  aspId: string;
  productName: string;
  status: ProductStatus;
  values: ProductForm;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  submittedAt?: number;
  origin?: ProductOrigin;
}

/**
 * `collecting` = asking for the product basics; `preparing` = the assistant is building the setup;
 * `pending` = full setup being reviewed;
 * `submitted` = sent for approval; `draft` = saved to finish later.
 */
export type ProductSetupStatus = 'collecting' | 'preparing' | 'pending' | 'submitting' | 'savingDraft' | 'submitted' | 'draft' | 'cancelled' | 'failed';

/** An agentic action attached to an assistant message: a product the assistant prepared for the user. */
export interface ProductSetupAction {
  type: 'createProduct';
  status: ProductSetupStatus;
  /** The AI's proposal, or the values last submitted or saved. */
  values: ProductForm;
  /** Fields whose values came from the user's own words (or their answers to the basics questions). */
  userProvided: ProductField[];
  /** Choices read from the conversation, kept so the full setup can be built once the basics are answered. */
  preferences: Partial<ProductForm>;
  /** Answers to the basics questions. */
  basics: ProductBasics;
  /** True once the basics were confirmed and the full setup was prepared. */
  basicsConfirmed: boolean;
  productId?: string;
  error?: string;
  completedAt?: number;
}

export type MessageAction = ProductSetupAction | ReportAction | CustomerLookupAction;
