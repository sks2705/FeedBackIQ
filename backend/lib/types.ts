export type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
export type Category = 'UI_UX' | 'PERFORMANCE' | 'BUG' | 'FEATURE_REQUEST' | 'SECURITY' | 'OTHER';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Status = 'NEW' | 'REVIEWING' | 'RESOLVED';
export type AnalysisStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface Attachment {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  url: string;
}

export interface Feedback {
  id: string;
  message: string;
  productName: string;
  userName: string | null;
  userEmail: string | null;
  source: string | null;
  sentiment: Sentiment | null;
  category: Category | null;
  priority: Priority | null;
  summary: string | null;
  confidence: number | null;
  status: Status;
  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  modelVersion: string | null;
  analyzedAt: string | null;
  isSeed: boolean;
  createdAt: string;
  updatedAt: string;
  attachment?: Attachment | null;
}

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ListMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface CategoryDistributionItem {
  category: Category;
  count: number;
}

export interface TrendItem {
  date: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
}

export interface AnalyticsSummary {
  total: number;
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
    unanalyzed: number;
  };
  priority: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  highPriorityCount: number;
  criticalCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  pendingAnalysisCount: number;
  failedAnalysisCount: number;
  categoryDistribution: CategoryDistributionItem[];
  trend: TrendItem[];
}

export interface FeedbackListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sentiment?: Sentiment;
  category?: Category;
  priority?: Priority;
  status?: Status;
  analysisStatus?: AnalysisStatus;
  from?: string;
  to?: string;
  sort?: 'createdAt:desc' | 'createdAt:asc' | 'priority:desc';
}
