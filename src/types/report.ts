/** Reporting actions the assistant attaches to a chat message. */

export type ReportChart = 'pie' | 'bar' | 'histogram';

/** Category groupings (pie and bar charts) and numeric ones binned into ranges (histograms). */
export type ProductGroupBy = 'scheme' | 'currency' | 'productType' | 'marketSegment' | 'status' | 'liveMonth' | 'validity' | 'annualFee';

/** `choosing` = waiting for the user to pick a grouping; `loading` = the short build pause; `ready` = chart shown. */
export type ProductReportStatus = 'choosing' | 'loading' | 'ready';

export interface ProductReportAction {
  type: 'productReport';
  status: ProductReportStatus;
  /** `null` until the user picks one (when the prompt didn't name a chart type). */
  chart: ReportChart | null;
  /** The prompt named the chart type, so the user isn't asked for it again. */
  chartFromPrompt: boolean;
  groupBy: ProductGroupBy | null;
  generatedAt?: number;
}

export type TxnRange = '24h' | '7d' | '30d' | '1y';
export type TxnView = 'time' | 'amount';
export type TxnMetric = 'count' | 'amount';

export interface TransactionReportAction {
  type: 'transactionReport';
  /** The phone number (wallet account) as the user wrote it. */
  phone: string;
  range: TxnRange;
  view: TxnView;
  metric: TxnMetric;
  /** The data ends at this moment, so a saved report keeps showing the same numbers. */
  asOf: number;
}

export type ReportAction = ProductReportAction | TransactionReportAction;
