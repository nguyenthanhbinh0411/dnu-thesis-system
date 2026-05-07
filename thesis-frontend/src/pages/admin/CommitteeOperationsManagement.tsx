import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Archive,
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Gavel,
  Lock,
  MessageSquare,
  Pencil,
  Maximize2,
  RefreshCw,
  RotateCcw,
  Search,
  Table,
  Trash2,
  Unlock,
  ChevronDown,
} from "lucide-react";
// `useNavigate` removed (not needed after module button removal)
import { useToast } from "../../context/useToast";
import { FetchDataError, fetchData } from "../../api/fetchData";
import type { ApiResponse } from "../../types/api";
import {
  readEnvelopeAllowedActions,
  readEnvelopeData,
  readEnvelopeErrorMessages,
  readEnvelopeMessage,
  readEnvelopeSuccess,
  readEnvelopeWarningMessages,
} from "../../utils/api-envelope";
import {
  extractDefensePeriodId,
  getActiveDefensePeriodId,
  normalizeDefensePeriodId,
  setActiveDefensePeriodId,
} from "../../utils/defensePeriod";
import { useSearchParams } from "react-router-dom";

type RevisionStatus = "all" | "pending" | "approved" | "rejected";
type LifecycleAction = "PUBLISH" | "ROLLBACK" | "ARCHIVE" | "REOPEN";
type ReportType = "council-summary" | "scoreboard" | "minutes" | "review" | "form-1" | "final-term" | "sync-errors";
type ReportFormat = "csv" | "pdf" | "excel" | "word" | "zip";
type OperationsPanelKey =
  | "snapshot"
  | "lifecycle"
  | "scoring"
  | "post-defense"
  | "audit-report";

type PreviewModalType = "meeting" | "scoreSheet" | "reviewer";

type PipelineOverview = {
  defenseTermId?: number;
  overallCompletionPercent?: number;
  totalTopics?: number;
  eligibleTopics?: number;
  assignedTopics?: number;
  scoredTopics?: number;
  pendingRevisionCount?: number;
  approvedRevisionCount?: number;
  rejectedRevisionCount?: number;
};

type AnalyticsOverview = {
  totalStudents?: number;
  average?: number;
  passRate?: number;
};

type DistributionOverview = {
  excellent?: number;
  good?: number;
  fair?: number;
  weak?: number;
};

type MonitoringSnapshot = {
  pipeline?: PipelineOverview & { waitingPublicTopics?: number };
  period?: Record<string, unknown>;
  analytics?: {
    overview?: AnalyticsOverview;
    byCouncil?: Array<Record<string, unknown>>;
    distribution?: DistributionOverview;
  };
  scoring?: {
    progress?: Array<{
      committeeId: number;
      committeeCode: string;
      totalAssignments: number;
      completedAssignments: number;
      waitingPublicAssignments: number;
      progressPercent: number;
    }>;
    alerts?: Array<Record<string, unknown>>;
  };
  tags?: Record<string, unknown>;
};

type ScoringMatrixRow = {
  committeeId?: number;
  committeeCode?: string;
  committeeName?: string;
  assignmentId?: number;
  assignmentCode?: string;
  topicCode?: string;
  topicTitle?: string;
  studentCode?: string;
  studentName?: string;
  className?: string;
  cohortCode?: string;
  startTime?: string;
  endTime?: string;
  submittedCount?: number;
  requiredCount?: number;
  isLocked?: boolean;
  room?: string;
  supervisorName?: string;
  supervisorLecturerName?: string;
  chair?: string;
  chairName?: string;
  committeeChair?: string;
  committeeChairName?: string;
  committeeChairCode?: string;
  secretary?: string;
  secretaryName?: string;
  committeeSecretary?: string;
  committeeSecretaryName?: string;
  committeeSecretaryCode?: string;
  reviewer?: string;
  reviewerName?: string;
  committeeReviewer?: string;
  committeeReviewerName?: string;
  committeeReviewerCode?: string;
  currentScore?: number;
  progressPercent?: number;
  scoreGvhd?: number;
  scoreCt?: number;
  scoreTk?: number;
  scorePb?: number;
  finalScore?: number;
  finalGrade?: string;
  variance?: number;
  status?: string;
  commentGvhd?: string | null;
  commentCt?: string | null;
  commentTk?: string | null;
  commentPb?: string | null;
  topicSupervisorScore?: number;
  defenseDocuments?: Array<Record<string, unknown>>;
};

type PostDefenseItem = {
  revisionId?: number;
  assignmentId?: number;
  committeeCode?: string;
  studentCode?: string;
  studentName?: string;
  topicCode?: string;
  topicTitle?: string;
  status?: string;
  submittedAt?: string;
  reviewedAt?: string;
  note?: string;
};

type PostDefenseOverview = {
  defenseTermId?: number;
  totalRevisions?: number;
  pendingRevisions?: number;
  approvedRevisions?: number;
  rejectedRevisions?: number;
  publishedScores?: number;
  lockedScores?: number;
  items?: PostDefenseItem[];
};

type AuditOverview = {
  syncHistory?: Array<Record<string, unknown>>;
  publishHistory?: Array<Record<string, unknown>>;
  councilAuditHistory?: Array<Record<string, unknown>>;
  revisionAuditTrail?: Array<Record<string, unknown>>;
};

type ReportingOverview = {
  supportedReportTypes?: string[];
  defaultFormat?: string;
  recentExports?: Array<Record<string, unknown>>;
};

type NavigatorFilter = "all" | "active" | "delayed" | "warning" | "completed";
type ProgressFilter = "all" | "under-50" | "50-80" | "80-100";
type AuditActionFilter = "all" | "open" | "submit" | "reopen" | "lock" | "publish" | "sync";
type CommitteeExportType = "scoreboard" | "minutes" | "review";

type DashboardAlertSeverity = "critical" | "warning" | "info";

type DashboardAlert = {
  severity: DashboardAlertSeverity;
  title: string;
  detail: string;
  committeeCode: string;
  focusKey: string;
  priority: number;
};

type CommitteeSummary = {
  key: string;
  code: string;
  name: string;
  room: string;
  chair: string;
  secretary: string;
  reviewer: string;
  totalTopics: number;
  scoredTopics: number;
  lockedTopics: number;
  status: string;
  currentTopic: string;
  currentStudent: string;
  progressPercent: number;
  estimatedCompletion: string;
  delayLabel: string;
};

type LeaderboardEntry = {
  label: string;
  title: string;
  score: string;
  committee: string;
  detail: string;
};

type OperationsSnapshotData = {
  defenseTermId?: number;
  state?: Record<string, unknown>;
  monitoring?: MonitoringSnapshot;
  councils?: {
    items?: Array<Record<string, unknown>>;
    totalCount?: number;
    page?: number;
    pageSize?: number;
  };
  scoringMatrix?: ScoringMatrixRow[];
  progressTracking?: Record<string, unknown>;
  postDefense?: PostDefenseOverview;
  audit?: AuditOverview;
  reporting?: ReportingOverview;
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: 18,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const selectControlStyle: React.CSSProperties = {
  minHeight: 40,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "0 34px 0 12px",
  backgroundColor: "#ffffff",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 500,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  backgroundImage:
    "linear-gradient(45deg, transparent 50%, #94a3b8 50%), linear-gradient(135deg, #94a3b8 50%, transparent 50%)",
  backgroundPosition:
    "calc(100% - 18px) calc(50% - 2px), calc(100% - 13px) calc(50% - 2px)",
  backgroundSize: "5px 5px, 5px 5px",
  backgroundRepeat: "no-repeat",
};

const tableHeadCellStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.02em",
  background: "#ffffff",
};

const tableCellStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderTop: "1px solid #e2e8f0",
  color: "#0f172a",
};

const actionIconButtonStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const dangerActionIconButtonStyle: React.CSSProperties = {
  ...actionIconButtonStyle,
  border: "1px solid #fecaca",
  color: "#ef4444",
};

const emptyStateCardStyle: React.CSSProperties = {
  ...cardStyle,
  borderStyle: "dashed",
  display: "grid",
  placeItems: "center",
  minHeight: 130,
  color: "#64748b",
  fontSize: 14,
  fontWeight: 600,
};

const panelTabs: Array<{
  key: OperationsPanelKey;
  label: string;
  icon: React.ReactNode;
}> = [
  { key: "snapshot", label: "Tổng quan", icon: <Search size={15} /> },
  { key: "lifecycle", label: "Vòng đời", icon: <Activity size={15} /> },
  { key: "scoring", label: "Chấm điểm", icon: <BarChart3 size={15} /> },
  {
    key: "post-defense",
    label: "Hậu bảo vệ",
    icon: <FileSpreadsheet size={15} />,
  },
  {
    key: "audit-report",
    label: "Kiểm toán & báo cáo",
    icon: <Download size={15} />,
  },
];

type ToneStyle = {
  bg: string;
  border: string;
  text: string;
};

const normalizeStatusKey = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

// Deep Blue Primary Palette
const DEEP_BLUE_PRIMARY = "#1e3a5f";
const DEEP_BLUE_HOVER = "#0f1e36";
const LIGHT_BLUE_BG = "#e0f2fe";
const LIGHT_BLUE_SOFTEN = "#f0f4f8";

const statusToneMap: Record<string, ToneStyle> = {
  // Semantic Success states - Green
  APPROVED: { bg: "#f0fdf4", border: "none", text: "#166534" },
  COMPLETED: { bg: "#f0fdf4", border: "none", text: "#166534" },
  PUBLISHED: { bg: "#f0fdf4", border: "none", text: "#166534" },
  // Semantic Alert/Warning states - Red
  REJECTED: { bg: "#fef2f2", border: "none", text: "#991b1b" },
  DELAYED: { bg: "#fef2f2", border: "none", text: "#991b1b" },
  // Operations states - Deep Blue harmony
  PENDING: { bg: LIGHT_BLUE_BG, border: "none", text: "#0c4a6e" },
  LOCKED: { bg: LIGHT_BLUE_BG, border: "none", text: DEEP_BLUE_PRIMARY },
  IN_PROGRESS: { bg: LIGHT_BLUE_BG, border: "none", text: DEEP_BLUE_PRIMARY },
  ONGOING: { bg: LIGHT_BLUE_BG, border: "none", text: DEEP_BLUE_PRIMARY },
  FINALIZED: { bg: LIGHT_BLUE_BG, border: "none", text: DEEP_BLUE_PRIMARY },
  // Active primary state
  READY: { bg: DEEP_BLUE_PRIMARY, border: "none", text: "#ffffff" },
  // Neutral states
  DRAFT: { bg: "#f8fafc", border: "none", text: "#475569" },
  ARCHIVED: { bg: "#f8fafc", border: "none", text: "#475569" },
  WARNING: { bg: LIGHT_BLUE_BG, border: "none", text: "#0c4a6e" },
  WAITING_PUBLIC: { bg: "#fffbeb", border: "1px solid #fde68a", text: "#b45309" },
};

const statusLabelMap: Record<string, string> = {
  APPROVED: "Đã duyệt",
  PENDING: "Chờ xử lý",
  REJECTED: "Từ chối",
  LOCKED: "Đã khóa",
  IN_PROGRESS: "Đang xử lý",
  ONGOING: "Đang diễn ra",
  COMPLETED: "Đã hoàn thành",
  DELAYED: "Đang trễ",
  DRAFT: "Nháp",
  READY: "Ready",
  FINALIZED: "Đã chốt",
  PUBLISHED: "Đã công bố",
  ARCHIVED: "Đã lưu trữ",
  WARNING: "Cảnh báo",
  WAITING_PUBLIC: "Chờ công bố",
};

const getStatusTone = (value: string | null | undefined): ToneStyle => {
  const normalized = normalizeStatusKey(value);
  return statusToneMap[normalized] ?? statusToneMap.DRAFT;
};

const getStatusLabel = (value: string | null | undefined) => {
  const normalized = normalizeStatusKey(value);
  return statusLabelMap[normalized] ?? (String(value ?? "-").trim() || "-");
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const normalizeLookupKey = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();

const getRecordValue = (record: Record<string, unknown> | null | undefined, key: string) => {
  if (!record) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(record, key)) {
    return record[key];
  }

  const normalizedKey = normalizeLookupKey(key);
  if (!normalizedKey) {
    return undefined;
  }

  for (const [candidateKey, candidateValue] of Object.entries(record)) {
    if (normalizeLookupKey(candidateKey) === normalizedKey) {
      return candidateValue;
    }
  }

  return undefined;
};

const toText = (value: unknown, fallback = "-") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const pickText = (record: Record<string, unknown> | null | undefined, keys: string[], fallback = "-") => {
  if (!record) {
    return fallback;
  }

  for (const key of keys) {
    const value = getRecordValue(record, key);
    const text = String(value ?? "").trim();
    if (text) {
      return text;
    }
  }

  return fallback;
};

const pickNumber = (record: Record<string, unknown> | null | undefined, keys: string[], fallback = 0) => {
  if (!record) {
    return fallback;
  }

  for (const key of keys) {
    const value = Number(getRecordValue(record, key));
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return fallback;
};

const pickRowText = (rows: ScoringMatrixRow[], keys: string[], fallback = "-") => {
  for (const row of rows) {
    for (const key of keys) {
      const value = getRecordValue(row as Record<string, unknown>, key);
      const text = String(value ?? "").trim();
      if (text) {
        return text;
      }
    }
  }
  return fallback;
};

const reportTypeOptions: Array<{ value: ReportType; label: string; description: string }> = [
  {
    value: "council-summary",
    label: "Tổng hợp hội đồng",
    description: "Danh sách hội đồng, phòng, trạng thái và tiến độ tổng hợp.",
  },
  {
    value: "scoreboard",
    label: "Bảng điểm hội đồng",
    description: "Template bảng điểm riêng cho từng hội đồng.",
  },
  {
    value: "minutes",
    label: "Biên bản hội đồng",
    description: "Template biên bản phiên bảo vệ theo hội đồng.",
  },
  {
    value: "review",
    label: "Nhận xét hội đồng",
    description: "Template nhận xét tổng hợp theo đề tài.",
  },
  {
    value: "form-1",
    label: "Form-1 (tương thích cũ)",
    description: "Giữ tương thích API cũ, map về bảng điểm hội đồng.",
  },
  {
    value: "final-term",
    label: "Kết quả cuối kỳ",
    description: "Bộ dữ liệu kết quả, điểm và trạng thái sau chốt.",
  },
  {
    value: "sync-errors",
    label: "Lỗi đồng bộ",
    description: "Danh sách các bản ghi cần rà soát hoặc đồng bộ lại.",
  },
];

const reportFormatOptions: Array<{ value: ReportFormat; label: string; description: string }> = [
  { value: "pdf", label: "PDF", description: "Biên bản, phiếu chấm, tổng hợp kết quả" },
  { value: "excel", label: "Excel", description: "Bảng điểm, tiến độ, thống kê" },
  { value: "csv", label: "CSV", description: "Điểm thô / dữ liệu phẳng" },
  { value: "word", label: "Word", description: "Biên bản họp / văn bản xuất" },
  { value: "zip", label: "ZIP", description: "Toàn bộ hồ sơ hội đồng" },
];

const navigatorFilterOptions: Array<{ value: NavigatorFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "active", label: "Hoạt động" },
  { value: "delayed", label: "Trễ" },
  { value: "warning", label: "Cảnh báo" },
  { value: "completed", label: "Hoàn thành" },
];

const progressFilterOptions: Array<{ value: ProgressFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "under-50", label: "< 50%" },
  { value: "50-80", label: "50% - 80%" },
  { value: "80-100", label: ">= 80%" },
];

const auditActionOptions: Array<{ value: AuditActionFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "open", label: "Mở ca" },
  { value: "submit", label: "Submit" },
  { value: "reopen", label: "Mở lại" },
  { value: "lock", label: "Khóa" },
  { value: "publish", label: "Công bố" },
  { value: "sync", label: "Đồng bộ" },
];

const committeeExportOptions = [
  { value: "scoreboard", label: "Bảng điểm hội đồng" },
  { value: "minutes", label: "Biên bản hội đồng" },
  { value: "review", label: "Nhận xét từng đề tài" },
];

const formatCompactDuration = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "0m";
  }

  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${remainingMinutes}m`;
  }

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

const parseDateValue = (value: string | null | undefined) => {
  const text = String(value ?? "").trim();
  if (!text || text === "-") {
    return null;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildSparklinePoints = (values: number[], width = 88, height = 26) => {
  if (values.length === 0) {
    return `0,${height}`;
  }

  const maxValue = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const x = Math.round(index * step);
      const y = Math.round(height - (value / maxValue) * (height - 2));
      return `${x},${y}`;
    })
    .join(" ");
};

const normalizeCommitteeStatus = (value: string | null | undefined) => {
  const normalized = normalizeStatusKey(value);
  if (normalized.includes("PUBLISHED") || normalized === "PUBLISHED") {
    return "PUBLISHED";
  }
  if (normalized.includes("LOCKED") || normalized === "LOCKED") {
    return "LOCKED";
  }
  if (normalized.includes("READY") || normalized === "READY") {
    return "READY";
  }
  if (normalized.includes("DELAY")) {
    return "DELAYED";
  }
  return "ONGOING";
};

const getCommitteeCompletionLabel = (scoredTopics: number, totalTopics: number) => {
  if (totalTopics <= 0) {
    return "0%";
  }

  return `${Math.min(100, Math.round((scoredTopics / totalTopics) * 100))}%`;
};

const distributionPalette: Record<string, string> = {
  A: "#16a34a",
  B: "#0ea5e9",
  C: "#f59e0b",
  D: "#ef4444",
  F: "#991b1b",
};

const CommitteeOperationsManagement: React.FC = () => {
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const queryPeriodId = normalizeDefensePeriodId(searchParams.get("periodId"));
  const [periodId, setPeriodId] = useState<number | null>(
    () => queryPeriodId ?? getActiveDefensePeriodId(),
  );
  const defensePeriodBase = periodId ? `/defense-periods/${periodId}` : "";
  const missingPeriodWarningRef = useRef(false);

  const [snapshot, setSnapshot] = useState<OperationsSnapshotData | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  const [backendAllowedActions, setBackendAllowedActions] = useState<string[]>(
    [],
  );
  const [lastLoadedAt, setLastLoadedAt] = useState<string>("");

  const [committeeIdFilter, setCommitteeIdFilter] = useState("");
  const [navigatorFilter, setNavigatorFilter] = useState<NavigatorFilter>("all");
  const [committeeRoomFilter, setCommitteeRoomFilter] = useState("");
  const [committeeChairFilter, setCommitteeChairFilter] = useState("");
  const [revisionStatus, setRevisionStatus] = useState<RevisionStatus>("all");
  const [revisionKeyword, setRevisionKeyword] = useState("");
  const [revisionPage, setRevisionPage] = useState(1);
  const [revisionSize, setRevisionSize] = useState(20);
  const [auditSize, setAuditSize] = useState(50);
  const [auditKeyword, setAuditKeyword] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState<AuditActionFilter>("all");
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [commandBarHeight, setCommandBarHeight] = useState(0);
  const [committeeStatusOverrides, setCommitteeStatusOverrides] = useState<Record<string, string>>({});
  const [showScoringMatrix, setShowScoringMatrix] = useState(false);
  const [analyticsTopics, setAnalyticsTopics] = useState<ScoringMatrixRow[]>([]);
  const [analyticsDistribution, setAnalyticsDistribution] = useState<DistributionOverview | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [distributionChartType, setDistributionChartType] = useState<"pie" | "bar" | "line">("pie");

  // Council / scoring UI state
  const [scoringModalOpen, setScoringModalOpen] = useState(false);
  const [selectedCouncilCode, setSelectedCouncilCode] = useState<string | null>(null);
  const [selectedCouncilNumericId, setSelectedCouncilNumericId] = useState<number | null>(null);
  const [selectedCouncilRow, setSelectedCouncilRow] = useState<Record<string, unknown> | null>(null);
  const [topicDetailModalOpen, setTopicDetailModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<ScoringMatrixRow | null>(null);

  const [reportType, setReportType] = useState<ReportType>("council-summary");
  const [reportFormat, setReportFormat] = useState<ReportFormat>("csv");
  const [reportCouncilId, setReportCouncilId] = useState("");
  const [committeeExportType, setCommitteeExportType] = useState<CommitteeExportType>("scoreboard");
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [previewModalType, setPreviewModalType] = useState<PreviewModalType | null>(null);
  const [isDownloadingPreviewFile, setIsDownloadingPreviewFile] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "analytics" | "committee" | "post-defense" | "audit">("overview");
  const commandBarRef = useRef<HTMLDivElement | null>(null);
  const committeeSearchInputRef = useRef<HTMLInputElement | null>(null);

  const isNoDataMessage = (message: string) => {
    const normalized = message
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return (
      normalized.includes("khong co du lieu") ||
      normalized.includes("chua co du lieu") ||
      normalized.includes("no data") ||
      normalized.includes("not found") ||
      normalized.includes("khong tim thay")
    );
  };

  const isNoDataEnvelope = (response: ApiResponse<unknown> | null | undefined) => {
    const status = Number(response?.httpStatusCode ?? response?.HttpStatusCode ?? 0);
    const message = String(readEnvelopeMessage(response) ?? "");
    return status === 204 || status === 404 || isNoDataMessage(message);
  };

  const notifyError = useCallback(
    (message: string) => addToast(message, "error"),
    [addToast],
  );
  const notifySuccess = useCallback(
    (message: string) => addToast(message, "success"),
    [addToast],
  );
  const notifyWarning = useCallback(
    (message: string) => addToast(message, "warning"),
    [addToast],
  );
  const notifyInfo = useCallback(
    (message: string) => addToast(message, "info"),
    [addToast],
  );

  useEffect(() => {
    if (queryPeriodId && queryPeriodId !== periodId) {
      setPeriodId(queryPeriodId);
    }
  }, [periodId, queryPeriodId]);

  useEffect(() => {
    setActiveDefensePeriodId(periodId);
  }, [periodId]);

  useEffect(() => {
    if (periodId != null) {
      return;
    }

    let cancelled = false;

    const resolvePeriod = async () => {
      try {
        const response = await fetchData<ApiResponse<unknown>>("/defense-periods", {
          method: "GET",
        });
        const payload = readEnvelopeData<unknown>(response);
        const fallbackPeriodId = extractDefensePeriodId(payload);
        if (!cancelled && fallbackPeriodId != null) {
          setPeriodId(fallbackPeriodId);
          setActiveDefensePeriodId(fallbackPeriodId);
        }
      } catch {
        // Keep explicit warning state when no period can be resolved.
      }
    };

    void resolvePeriod();

    return () => {
      cancelled = true;
    };
  }, [periodId]);

  const buildIdempotencyKey = (prefix: string) =>
    `${prefix}-${periodId ?? "NA"}-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

  const parseEnvelope = useCallback(
    <T,>(
      response: ApiResponse<T> | null | undefined,
      fallback: string,
      options?: { silentNoData?: boolean },
    ) => {
      if (!response) {
        notifyError(fallback);
        return { ok: false, data: null as T | null };
      }

      const allowedActions = readEnvelopeAllowedActions(response);
      if (allowedActions.length > 0) {
        setBackendAllowedActions(allowedActions);
      }

      const warningMessages = readEnvelopeWarningMessages(response);
      if (warningMessages.length > 0) {
        notifyWarning(warningMessages.join(" | "));
      }

      const success = readEnvelopeSuccess(response);
      const message = readEnvelopeMessage(response);
      if (!success) {
        if (options?.silentNoData && isNoDataEnvelope(response)) {
          return { ok: true, data: null as T | null };
        }
        const errors = readEnvelopeErrorMessages(response);
        notifyError(errors[0] || message || fallback);
        return { ok: false, data: null as T | null };
      }

      if (message) {
        notifyInfo(message);
      }

      return {
        ok: true,
        data: readEnvelopeData<T>(response),
      };
    },
    [notifyError, notifyInfo, notifyWarning],
  );

  const hasAllowedAction = (...actions: string[]) =>
    backendAllowedActions.length === 0 ||
    actions.some((action) => backendAllowedActions.includes(action));

  const canPublish = hasAllowedAction("PUBLISH", "UC2.PUBLISH", "UC2.5.PUBLISH");
  const canRollback = hasAllowedAction("ROLLBACK", "UC2.6.ROLLBACK");
  const canArchive = hasAllowedAction("ARCHIVE", "UC2.7.ARCHIVE");
  const canReopen = hasAllowedAction("REOPEN", "UC2.8.REOPEN");

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTimestamp(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const updateHeight = () => {
      const nextHeight = commandBarRef.current?.offsetHeight ?? 0;
      setCommandBarHeight(nextHeight);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [isFullscreen, lastLoadedAt]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await document.documentElement.requestFullscreen();
    } catch {
      setIsFullscreen((value) => !value);
    }
  };

  const loadOperationsSnapshot = useCallback(async () => {
    if (!periodId) {
      setSnapshot({});
      if (!missingPeriodWarningRef.current) {
        notifyWarning("Chua chon dot bao ve. Vui long chon dot tai module Quan ly dot truoc khi thao tac.");
        missingPeriodWarningRef.current = true;
      }
      return;
    }

    missingPeriodWarningRef.current = false;

    const params = new URLSearchParams();
    if (committeeIdFilter.trim()) {
      const numericValue = Number(committeeIdFilter.trim());
      if (Number.isFinite(numericValue) && numericValue > 0) {
        params.set("committeeId", String(Math.floor(numericValue)));
      }
    }
    params.set("revisionStatus", revisionStatus);
    if (revisionKeyword.trim()) {
      params.set("revisionKeyword", revisionKeyword.trim());
    }
    params.set("revisionPage", String(Math.max(1, revisionPage)));
    params.set("revisionSize", String(Math.min(200, Math.max(1, revisionSize))));
    params.set("auditSize", String(Math.min(500, Math.max(1, auditSize))));

    setLoadingSnapshot(true);
    try {
      const response = await fetchData<ApiResponse<OperationsSnapshotData>>(
        `${defensePeriodBase}/operations/snapshot?${params.toString()}`,
        { method: "GET" },
      );
      const parsed = parseEnvelope(
        response,
        "Không tải được snapshot điều hành chấm điểm.",
        { silentNoData: true },
      );
      if (!parsed.ok) {
        return;
      }

      if (!parsed.data) {
        setSnapshot({});
        setLastLoadedAt(new Date().toLocaleString("vi-VN"));
        return;
      }

      setSnapshot(parsed.data);
      setLastLoadedAt(new Date().toLocaleString("vi-VN"));

      const reporting = parsed.data.reporting;
      const supported = Array.isArray(reporting?.supportedReportTypes)
        ? reporting.supportedReportTypes
        : [];
      if (supported.length > 0 && !supported.includes(reportType)) {
        setReportType(supported[0] as ReportType);
      }
      if (reporting?.defaultFormat && reporting.defaultFormat !== reportFormat) {
        setReportFormat(reporting.defaultFormat as ReportFormat);
      }
    } catch (error) {
      if (error instanceof FetchDataError && (error.status === 404 || error.status === 204)) {
        setSnapshot({});
        setLastLoadedAt(new Date().toLocaleString("vi-VN"));
        return;
      }
      notifyError("Không tải được dữ liệu vận hành từ API.");
    } finally {
      setLoadingSnapshot(false);
    }
  }, [
    auditSize,
    committeeIdFilter,
    defensePeriodBase,
    periodId,
    notifyError,
    notifyWarning,
    parseEnvelope,
    reportFormat,
    reportType,
    revisionKeyword,
    revisionPage,
    revisionSize,
    revisionStatus,
  ]);

  useEffect(() => {
    void loadOperationsSnapshot();
  }, [loadOperationsSnapshot]);

  useEffect(() => {
    if (activeTab !== "analytics" || !periodId) return;
    
    let cancelled = false;
    const fetchAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const [progressRes, distRes] = await Promise.all([
          fetchData<ApiResponse<ScoringMatrixRow[]>>(`${defensePeriodBase}/scoring/progress-topic-final`, { method: "GET" }),
          fetchData<ApiResponse<DistributionOverview>>(`${defensePeriodBase}/scoring/distribution`, { method: "GET" })
        ]);
        
        if (cancelled) return;
        
        const progressParsed = parseEnvelope(progressRes, "Không tải được progress-topic-final", { silentNoData: true });
        const distParsed = parseEnvelope(distRes, "Không tải được distribution", { silentNoData: true });

        if (progressParsed.ok && progressParsed.data) {
          setAnalyticsTopics(progressParsed.data);
        }
        if (distParsed.ok && distParsed.data) {
          setAnalyticsDistribution(distParsed.data);
        }
      } catch (err) {
        if (!cancelled) notifyError("Lỗi tải API analytics mới.");
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    };
    
    void fetchAnalytics();
    return () => { cancelled = true; };
  }, [activeTab, periodId, defensePeriodBase, parseEnvelope, notifyError]);

  useEffect(() => {
    if (!autoRefreshEnabled) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadOperationsSnapshot();
    }, 60000);

    return () => window.clearInterval(timer);
  }, [autoRefreshEnabled, loadOperationsSnapshot]);

  const triggerLifecycle = async (action: LifecycleAction) => {
    if (!periodId) {
      notifyWarning("Chua chon dot bao ve. Vui long chon dot tai module Quan ly dot.");
      return;
    }

    if (
      action === "PUBLISH" &&
      !hasAllowedAction("PUBLISH", "UC2.PUBLISH", "UC2.5.PUBLISH")
    ) {
      notifyWarning("Backend chưa cho phép công bố điểm ở trạng thái hiện tại.");
      return;
    }
    if (
      action === "ROLLBACK" &&
      !hasAllowedAction("ROLLBACK", "UC2.6.ROLLBACK")
    ) {
      notifyWarning("Backend chưa cho phép rollback ở trạng thái hiện tại.");
      return;
    }
    if (
      action === "ARCHIVE" &&
      !hasAllowedAction("ARCHIVE", "UC2.7.ARCHIVE")
    ) {
      notifyWarning("Backend chưa cho phép lưu trữ đợt ở trạng thái hiện tại.");
      return;
    }
    if (
      action === "REOPEN" &&
      !hasAllowedAction("REOPEN", "UC2.8.REOPEN")
    ) {
      notifyWarning("Backend chưa cho phép mở lại đợt ở trạng thái hiện tại.");
      return;
    }

    const idempotencyKey = buildIdempotencyKey(action);
    const payload: Record<string, unknown> = {
      action,
      idempotencyKey,
    };

    if (action === "ROLLBACK") {
      const target = window.prompt(
        "Nhập target rollback: PUBLISH | FINALIZE | ALL",
        "PUBLISH",
      );
      if (!target) {
        return;
      }
      const normalizedTarget = target.trim().toUpperCase();
      if (!["PUBLISH", "FINALIZE", "ALL"].includes(normalizedTarget)) {
        notifyError("Target rollback không hợp lệ.");
        return;
      }
      const reason = window.prompt("Nhập lý do rollback", "Điều chỉnh điểm");
      if (!reason || !reason.trim()) {
        notifyError("Rollback bắt buộc nhập lý do.");
        return;
      }
      payload.rollback = {
        target: normalizedTarget,
        reason: reason.trim(),
        forceUnlockScores: true,
      };
    }

    try {
      setActionInFlight(`Lifecycle ${action}`);
      const response = await fetchData<ApiResponse<Record<string, unknown>>>(
        `${defensePeriodBase}/lifecycle`,
        {
          method: "POST",
          body: payload,
          headers: { "Idempotency-Key": idempotencyKey },
        },
      );
      const parsed = parseEnvelope(
        response,
        `Lifecycle ${action} thất bại. Vui lòng thử lại.`,
      );
      if (!parsed.ok) {
        return;
      }

      if (response.idempotencyReplay ?? response.IdempotencyReplay) {
        notifyInfo(`Yêu cầu ${action} đã được xử lý trước đó.`);
      } else {
        notifySuccess(`Đã thực thi ${action} thành công.`);
      }
      await loadOperationsSnapshot();
    } catch {
      notifyError(`Không thể thực thi ${action}.`);
    } finally {
      setActionInFlight(null);
    }
  };

  const exportReport = () => {
    if (!periodId) {
      notifyWarning("Chua chon dot bao ve. Vui long chon dot tai module Quan ly dot.");
      return;
    }

    let effectiveReportType: ReportType = reportType;
    let effectiveCouncilId = reportCouncilId.trim();

    if (activeTab === "committee" && selectedCommittee) {
      effectiveReportType = committeeExportType;
      if (!effectiveCouncilId) {
        const councilIdFromRows = selectedCommitteeRows.find((row) => Number.isFinite(Number(row.committeeId)))?.committeeId;
        if (councilIdFromRows != null) {
          effectiveCouncilId = String(councilIdFromRows);
        } else {
          const numericMatch = String(selectedCommittee.code ?? "").match(/\d+/);
          if (numericMatch) {
            effectiveCouncilId = numericMatch[0];
          }
        }
      }
    }

    if (["form-1", "scoreboard", "minutes", "review"].includes(effectiveReportType) && !effectiveCouncilId) {
      notifyError("Bao cao hoi dong bat buoc co councilId.");
      return;
    }

    const params = new URLSearchParams({
      reportType: effectiveReportType,
      format: reportFormat,
    });
    if (["form-1", "scoreboard", "minutes", "review"].includes(effectiveReportType)) {
      params.set("councilId", effectiveCouncilId);
    }

    window.open(
      `${defensePeriodBase}/reports/export?${params.toString()}`,
      "_blank",
      "noopener,noreferrer",
    );
    notifyInfo("Đã gửi yêu cầu mở file báo cáo.");
    setExportModalOpen(false);
  };

  const downloadCommitteeReport = (committeeRow: CommitteeSummary, reportTypeValue: CommitteeExportType, format: ReportFormat) => {
    if (!periodId) {
      notifyWarning("Chua chon dot bao ve. Vui long chon dot tai module Quan ly dot.");
      return;
    }

    const councilId = selectedCommitteeRows.find((row) => row.committeeId != null)?.committeeId;
    if (councilId == null) {
      notifyError("Không tìm thấy councilId cho hội đồng hiện tại.");
      return;
    }

    const params = new URLSearchParams({
      reportType: reportTypeValue,
      format,
      councilId: String(councilId),
    });

    window.open(`${defensePeriodBase}/reports/export?${params.toString()}`, "_blank", "noopener,noreferrer");
    notifyInfo(`Đã mở file ${reportTypeValue} cho ${committeeRow.code}.`);
  };

  const downloadPreviewDocument = async (template: PreviewModalType, format: "word" | "pdf") => {
    if (!selectedCommittee || !periodId) return;
    if ((template === "meeting" || template === "reviewer") && !selectedTopic) {
      notifyError("Vui lòng chọn đề tài trước khi xem/tải file.");
      return;
    }

    setIsDownloadingPreviewFile(true);
    try {
      const councilId = selectedCommitteeRows.find((row) => row.committeeId != null)?.committeeId;
      if (councilId == null) {
        notifyError("Không tìm thấy councilId.");
        return;
      }

      const params = new URLSearchParams({
        reportType: template === "meeting" ? "minutes" : template === "reviewer" ? "review" : "scoreboard",
        format,
        councilId: String(councilId),
      });

      window.open(`${defensePeriodBase}/reports/export?${params.toString()}`, "_blank", "noopener,noreferrer");
      notifySuccess("Yêu cầu tải file đã được gửi.");
    } catch {
      notifyError("Không thể tải tài liệu.");
    } finally {
      setIsDownloadingPreviewFile(false);
    }
  };

  const submitCommitteeAction = useCallback(
    async (action: "OPEN" | "LOCK" | "REOPEN", committee: CommitteeSummary | null) => {
      if (!periodId) {
        notifyWarning("Chua chon dot bao ve. Vui long chon dot tai module Quan ly dot.");
        return;
      }
      if (!committee) {
        notifyWarning("Chua chon hoi dong de thao tac.");
        return;
      }

      const actionKey = `COMMITTEE-${committee.code}-${action}`;
      const optimisticStatus = action === "LOCK" ? "LOCKED" : action === "REOPEN" ? "READY" : "ONGOING";
      setActionInFlight(actionKey);
      setCommitteeStatusOverrides((prev) => ({ ...prev, [committee.code]: optimisticStatus }));

      try {
        const response = await fetchData<ApiResponse<Record<string, unknown>>>(
          `${defensePeriodBase}/scoring/actions`,
          {
            method: "POST",
            body: {
              committeeCode: committee.code,
              committeeId: committee.key,
              action,
            },
          },
        );
        const parsed = parseEnvelope(response, "Khong the cap nhat trang thai hoi dong.");
        if (!parsed.ok) {
          throw new Error("Committee action failed");
        }
        notifySuccess(`Da gui lenh ${action} cho ${committee.code}.`);
        await loadOperationsSnapshot();
      } catch {
        setCommitteeStatusOverrides((prev) => {
          const next = { ...prev };
          delete next[committee.code];
          return next;
        });
        notifyError("Khong the cap nhat trang thai hoi dong. Vui long thu lai.");
      } finally {
        setActionInFlight(null);
      }
    },
    [defensePeriodBase, loadOperationsSnapshot, notifyError, notifySuccess, notifyWarning, parseEnvelope, periodId],
  );

  const handleTopicExport = (format: ReportFormat, row: ScoringMatrixRow) => {
    setReportFormat(format);
    setReportType("form-1");
    if (row.committeeId != null) {
      setReportCouncilId(String(row.committeeId));
    }
    notifyInfo(`San sang xuat ${format.toUpperCase()} cho de tai ${row.topicCode ?? "-"}.`);
    setExportModalOpen(true);
  };

  const pipeline = snapshot?.monitoring?.pipeline;
  const analytics = snapshot?.monitoring?.analytics;
  const scoringMatrix = snapshot?.scoringMatrix ?? [];
  const postDefense = snapshot?.postDefense;
  const audit = snapshot?.audit;
  const periodState = toRecord(snapshot?.state ?? null);
  const scoresPublished = Boolean(getRecordValue(periodState, "ScoresPublished") ?? getRecordValue(periodState, "scoresPublished"));
  const councilSourceRecords = snapshot?.councils?.items ?? [];

  const distributionRows = useMemo(() => {
    const distribution = analyticsDistribution ?? analytics?.distribution;
    const totalStudents = Number(analytics?.overview?.totalStudents ?? 0);
    const excellent = Number(distribution?.excellent ?? 0);
    const good = Number(distribution?.good ?? 0);
    const fair = Number(distribution?.fair ?? 0);
    const weak = Number(distribution?.weak ?? 0);
    const fallbackF = Math.max(0, totalStudents - (excellent + good + fair + weak));
    return [
      { label: "A", value: excellent },
      { label: "B", value: good },
      { label: "C", value: fair },
      { label: "D", value: weak },
      { label: "F", value: fallbackF },
    ];
  }, [analytics?.distribution, analytics?.overview?.totalStudents, analyticsDistribution]);

  const distributionTotal = useMemo(
    () => distributionRows.reduce((sum, item) => sum + item.value, 0),
    [distributionRows],
  );

  const distributionStops = useMemo(() => {
    let cursor = 0;
    return distributionRows.map((item) => {
      const percent = distributionTotal > 0 ? (item.value / distributionTotal) * 100 : 0;
      const start = cursor;
      const end = cursor + percent;
      cursor = end;
      return {
        label: item.label,
        color: distributionPalette[item.label] ?? "#cbd5e1",
        start,
        end,
      };
    });
  }, [distributionRows, distributionTotal]);

  const distributionPeak = useMemo(
    () => Math.max(1, ...distributionRows.map((item) => item.value)),
    [distributionRows],
  );

  const committeeOperationalRows = useMemo<CommitteeSummary[]>(() => {
    const councilByRoom = new Map<string, Record<string, unknown>>();
    const councilByCode = new Map<string, Record<string, unknown>>();

    (Array.isArray(analytics?.byCouncil) ? analytics.byCouncil : []).forEach((item) => {
      const record = toRecord(item);
      if (!record) {
        return;
      }

      const roomKey = normalizeLookupKey(pickText(record, ["room", "Room"], ""));
      const codeKey = normalizeLookupKey(pickText(record, ["councilCode", "CouncilCode", "committeeCode", "CommitteeCode", "code", "id"], ""));

      if (roomKey) {
        councilByRoom.set(roomKey, record);
      }
      if (codeKey) {
        councilByCode.set(codeKey, record);
      }
    });

    const rowsByCommittee = new Map<string, ScoringMatrixRow[]>();
    scoringMatrix.forEach((row) => {
      const code = normalizeLookupKey(row.committeeCode);
      if (!code) {
        return;
      }
      const current = rowsByCommittee.get(code) ?? [];
      current.push(row);
      rowsByCommittee.set(code, current);
    });

    const buildSummary = (committeeCode: string, topicRows: ScoringMatrixRow[], index: number): CommitteeSummary => {
      const firstRow = topicRows[0] ?? null;
      const analyticsRecord = councilByCode.get(committeeCode) ?? councilByRoom.get(normalizeLookupKey(firstRow?.room));
      const totalTopics = topicRows.length || pickNumber(analyticsRecord, ["count", "Count", "totalTopics", "topicCount"], 0);
      const waitingPublicTopics = topicRows.filter((row) => !row.isLocked && (row.submittedCount != null && row.requiredCount != null && row.submittedCount >= row.requiredCount && row.requiredCount > 0)).length;
      const lockedTopics = topicRows.filter((row) => row.isLocked).length;
      const scoredTopics = lockedTopics + waitingPublicTopics;
      const fallbackName = firstRow?.committeeName ?? `Hội đồng ${index + 1}`;
      const statusValue = normalizeCommitteeStatus(
        firstRow?.status ?? (scoresPublished ? "PUBLISHED" : scoredTopics > 0 ? "ONGOING" : "READY")
      );
      const overrideStatus = committeeStatusOverrides[firstRow?.committeeCode ?? committeeCode];
      const activeTopic = topicRows.find((row) => !row.isLocked && (row.finalScore == null || Number(row.finalScore) <= 0)) ?? topicRows[0] ?? null;
      const lastPlannedEnd = topicRows
        .map((row) => parseDateValue(row.endTime ?? null))
        .filter((value): value is Date => Boolean(value))
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
      const avgScore = pickNumber(analyticsRecord, ["avg", "Avg", "average", "Average"], 0) || (scoredTopics > 0 ? Number((topicRows.reduce((sum, row) => sum + Number(row.finalScore ?? row.currentScore ?? 0), 0) / scoredTopics).toFixed(1)) : 0);
      const finalLabel = scoresPublished || firstRow?.isLocked ? "Đã chốt" : scoredTopics > 0 ? "Đang xử lý" : "Sẵn sàng";

      return {
        key: firstRow?.assignmentId != null ? `${committeeCode}-${firstRow.assignmentId}` : committeeCode,
        code: firstRow?.committeeCode ?? committeeCode,
        name: firstRow?.committeeName ?? fallbackName,
        room: firstRow?.room ?? pickText(analyticsRecord, ["room", "Room"], "-"),
        chair: pickRowText(topicRows, ["chairName", "committeeChairName", "chair", "committeeChair", "committeeChairCode"], "") || pickText(analyticsRecord, ["chair", "chairName", "Chair", "chairman", "committeeChair", "committeeChairName"], "-"),
        secretary: pickRowText(topicRows, ["secretaryName", "committeeSecretaryName", "secretary", "committeeSecretary", "committeeSecretaryCode"], "") || pickText(analyticsRecord, ["secretary", "secretaryName", "Secretary", "clerk", "committeeSecretary", "committeeSecretaryName"], "-"),
        reviewer: pickRowText(topicRows, ["reviewerName", "committeeReviewerName", "reviewer", "committeeReviewer", "committeeReviewerCode"], "") || pickText(analyticsRecord, ["reviewer", "reviewerName", "Reviewer", "critic", "committeeReviewer", "committeeReviewerName"], "-"),
        totalTopics,
        scoredTopics,
        lockedTopics,
        status: overrideStatus ?? statusValue,
        currentTopic: toText(activeTopic?.topicTitle ?? activeTopic?.topicCode, finalLabel),
        currentStudent: toText(activeTopic?.studentName ?? activeTopic?.studentCode, "-"),
        progressPercent: totalTopics > 0 ? Math.min(100, Math.round((scoredTopics / totalTopics) * 100)) : 0,
        estimatedCompletion: lastPlannedEnd
          ? lastPlannedEnd.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
          : formatCompactDuration(Math.max(1, totalTopics - scoredTopics) * 12),
        delayLabel: totalTopics > 0 && scoredTopics < totalTopics ? `+${formatCompactDuration(Math.max(1, totalTopics - scoredTopics) * 12)}` : "On time",
      };
    };

    return Array.from(rowsByCommittee.entries())
      .map(([committeeCode, topicRows], index) => buildSummary(committeeCode, topicRows, index))
      .sort((left, right) => left.code.localeCompare(right.code));
  }, [analytics?.byCouncil, committeeStatusOverrides, scoringMatrix, scoresPublished]);

  const dashboardMetrics = useMemo(() => {
    const totalTopics = pipeline?.totalTopics ?? scoringMatrix.length;
    const lockedTopics = scoringMatrix.filter(row => row.isLocked).length;
    const waitingPublicTopics = pipeline?.waitingPublicTopics ?? scoringMatrix.filter((row) => !row.isLocked && (row.submittedCount != null && row.requiredCount != null && row.submittedCount >= row.requiredCount && row.requiredCount > 0)).length;
    const scoredTopics = lockedTopics + waitingPublicTopics;
    
    const activeCouncils = committeeOperationalRows.filter((row) => ["ONGOING", "READY", "DELAYED", "WAITING_PUBLIC"].includes(row.status)).length;
    const pendingTopics = Math.max(0, totalTopics - scoredTopics);
    const waitingTopics = scoringMatrix.filter((row) => !row.submittedCount || Number(row.submittedCount) === 0).length;
    const liveTopics = scoringMatrix.filter((row) => Number(row.submittedCount ?? 0) > 0 && !(row.submittedCount != null && row.requiredCount != null && row.submittedCount >= row.requiredCount)).length;
    const warnings = (postDefense?.items ?? []).filter((item) => String(item.status ?? "").toLowerCase() !== "approved").length;
    const completionRate = totalTopics > 0 ? Math.round((scoredTopics / totalTopics) * 100) : 0;

    return {
      totalCouncils: committeeOperationalRows.length,
      totalTopics,
      scoredTopics,
      lockedTopics,
      waitingPublicTopics,
      pendingTopics,
      waitingTopics,
      liveTopics,
      activeCouncils,
      warnings,
      completionRate,
    };
  }, [committeeOperationalRows, pipeline?.scoredTopics, pipeline?.totalTopics, pipeline?.waitingPublicTopics, postDefense?.items, scoringMatrix, scoresPublished]);

  const topTopic = useMemo(
    () => (scoresPublished ? scoringMatrix.filter((row) => row.finalScore != null && Number(row.finalScore) > 0).sort((left, right) => Number(right.finalScore) - Number(left.finalScore))[0] ?? null : null),
    [scoringMatrix, scoresPublished],
  );

  const lowTopic = useMemo(
    () => (scoresPublished ? scoringMatrix.filter((row) => row.finalScore != null && Number(row.finalScore) > 0).sort((left, right) => Number(left.finalScore) - Number(right.finalScore))[0] ?? null : null),
    [scoringMatrix, scoresPublished],
  );

  const selectedCommittee = useMemo(() => {
    if (selectedCouncilCode) {
      const code = selectedCouncilCode.trim().toUpperCase();
      const numeric = selectedCouncilNumericId != null ? String(selectedCouncilNumericId) : "";
      const directMatch = committeeOperationalRows.find((row) => row.code.toUpperCase() === code || row.key.toUpperCase() === code);
      if (directMatch) {
        return directMatch;
      }

      if (numeric) {
        const numericMatch = committeeOperationalRows.find((row) => row.code.replace(/[^\d]/g, "") === numeric || row.key.replace(/[^\d]/g, "") === numeric);
        if (numericMatch) {
          return numericMatch;
        }
      }
    }

    return committeeOperationalRows[0] ?? null;
  }, [committeeOperationalRows, selectedCouncilCode, selectedCouncilNumericId]);

  const selectedCommitteeRows = useMemo(() => {
    if (!selectedCommittee) {
      return scoringMatrix;
    }

    const code = selectedCommittee.code.trim().toUpperCase();
    return scoringMatrix
      .filter((row) => String(row.committeeCode ?? "").trim().toUpperCase() === code || String(row.committeeId ?? "").trim().toUpperCase() === code)
      .sort((left, right) => String(left.topicCode ?? "").localeCompare(String(right.topicCode ?? "")));
  }, [scoringMatrix, selectedCommittee]);

  const selectedCommitteeChair = selectedCommittee?.chair ?? "-";
  const selectedCommitteeSupervisor = useMemo(() => {
    const row = selectedCommitteeRows.find((row) => row.supervisorLecturerName || row.supervisorName);
    return row?.supervisorLecturerName ?? row?.supervisorName ?? "-";
  }, [selectedCommitteeRows]);

  const selectedCommitteeFinalized = useMemo(() => {
    if (!selectedCommittee) {
      return false;
    }
    const normalized = normalizeStatusKey(selectedCommittee.status);
    const allRowsFinalized = selectedCommitteeRows.length > 0 && selectedCommitteeRows.every((row) => row.isLocked || row.finalScore != null || Number(row.finalScore ?? 0) > 0);
    return ["LOCKED", "COMPLETED", "PUBLISHED", "FINALIZED"].includes(normalized) || scoresPublished || allRowsFinalized;
  }, [scoresPublished, selectedCommittee, selectedCommitteeRows]);

  const visibleCommitteeRows = useMemo(() => {
    const query = committeeIdFilter.trim().toUpperCase();
    const roomQuery = committeeRoomFilter.trim().toUpperCase();
    const chairQuery = committeeChairFilter.trim().toUpperCase();

    return committeeOperationalRows.filter((row) => {
      const haystack = `${row.code} ${row.name} ${row.room} ${row.chair} ${row.secretary} ${row.reviewer} ${row.currentTopic} ${row.currentStudent}`.toUpperCase();
      if (query && !haystack.includes(query)) {
        return false;
      }

      if (roomQuery && !row.room.toUpperCase().includes(roomQuery)) {
        return false;
      }

      if (chairQuery && !row.chair.toUpperCase().includes(chairQuery)) {
        return false;
      }

      switch (navigatorFilter) {
        case "active":
          return ["READY", "ONGOING", "DELAYED"].includes(row.status) && row.progressPercent < 100;
        case "delayed":
          return row.delayLabel !== "On time";
        case "warning":
          return row.delayLabel !== "On time" || row.scoredTopics < row.totalTopics;
        case "completed":
          return row.progressPercent >= 100 || row.status === "COMPLETED" || row.status === "PUBLISHED";
        case "all":
        default:
          return true;
      }
    });
  }, [committeeChairFilter, committeeIdFilter, committeeOperationalRows, committeeRoomFilter, navigatorFilter]);

  const keyAlerts = useMemo<DashboardAlert[]>(() => {
    const alertItems: DashboardAlert[] = [
      ...scoringMatrix
        .filter((row) => row.finalScore == null || Number(row.finalScore) <= 0)
        .slice(0, 4)
        .map((row) => ({
          severity: "critical" as DashboardAlertSeverity,
          title: row.topicTitle ?? "-",
          detail: `${row.studentName ?? "-"} · ${row.studentCode ?? "-"}`,
          committeeCode: row.committeeCode ?? "-",
          focusKey: row.committeeCode ?? "-",
          priority: 1,
        })),
      ...scoringMatrix
        .filter((row) => row.isLocked !== true && Number(row.submittedCount ?? 0) >= Number(row.requiredCount ?? 0) && Number(row.requiredCount ?? 0) > 0)
        .slice(0, 4)
        .map((row) => ({
          severity: "warning" as DashboardAlertSeverity,
          title: row.topicTitle ?? "-",
          detail: `${row.committeeCode ?? "-"} · chờ khóa ca`,
          committeeCode: row.committeeCode ?? "-",
          focusKey: row.committeeCode ?? "-",
          priority: 2,
        })),
      ...committeeOperationalRows
        .filter((row) => row.progressPercent >= 100)
        .slice(0, 3)
        .map((row) => ({
          severity: "info" as DashboardAlertSeverity,
          title: row.code,
          detail: `${row.name} · đã hoàn thành`,
          committeeCode: row.code,
          focusKey: row.code,
          priority: 3,
        })),
      ...committeeOperationalRows
        .filter((row) => row.delayLabel !== "On time")
        .slice(0, 3)
        .map((row) => ({
          severity: "warning" as DashboardAlertSeverity,
          title: row.code,
          detail: `${row.delayLabel} · ${row.currentTopic}`,
          committeeCode: row.code,
          focusKey: row.code,
          priority: 2,
        })),
      ...scoringMatrix
        .filter((row) => row.variance != null && Math.abs(Number(row.variance)) >= 2)
        .slice(0, 3)
        .map((row) => ({
          severity: "critical" as DashboardAlertSeverity,
          title: row.topicTitle ?? "-",
          detail: `Variance ${row.variance}`,
          committeeCode: row.committeeCode ?? "-",
          focusKey: row.committeeCode ?? "-",
          priority: 1,
        })),
    ];

    return alertItems
      .sort((left, right) => left.priority - right.priority)
      .slice(0, 10);
  }, [committeeOperationalRows, scoringMatrix, committeeStatusOverrides]);

  const leaderboardEntries = useMemo(() => {
    const completionSorted = [...committeeOperationalRows].sort((left, right) => right.progressPercent - left.progressPercent);
    const delaySorted = [...committeeOperationalRows].sort((left, right) => {
      const leftValue = Number(left.delayLabel.replace(/[^\d.]/g, "")) || 0;
      const rightValue = Number(right.delayLabel.replace(/[^\d.]/g, "")) || 0;
      return rightValue - leftValue;
    });

    return {
      highest: scoresPublished && topTopic
        ? { label: "Điểm cao nhất", title: topTopic.studentName ?? "-", score: String(topTopic.finalScore ?? "-"), committee: topTopic.committeeCode ?? "-", detail: topTopic.topicTitle ?? "-" }
        : null,
      lowest: scoresPublished && lowTopic
        ? { label: "Điểm thấp nhất", title: lowTopic.studentName ?? "-", score: String(lowTopic.finalScore ?? "-"), committee: lowTopic.committeeCode ?? "-", detail: lowTopic.topicTitle ?? "-" }
        : null,
      strictest: completionSorted[completionSorted.length - 1]
        ? { label: "Hội đồng chặt chẽ nhất", title: completionSorted[completionSorted.length - 1].name, score: `${completionSorted[completionSorted.length - 1].progressPercent}%`, committee: completionSorted[completionSorted.length - 1].code, detail: completionSorted[completionSorted.length - 1].currentTopic }
        : null,
      lenient: completionSorted[0]
        ? { label: "Hội đồng lỏng lẻo nhất", title: completionSorted[0].name, score: `${completionSorted[0].progressPercent}%`, committee: completionSorted[0].code, detail: completionSorted[0].currentTopic }
        : null,
      fastest: completionSorted[0]
        ? { label: "Hội đồng nhanh nhất", title: completionSorted[0].code, score: completionSorted[0].estimatedCompletion, committee: completionSorted[0].room, detail: completionSorted[0].currentStudent }
        : null,
      delayed: delaySorted[0]
        ? { label: "Hội đồng trễ nhất", title: delaySorted[0].code, score: delaySorted[0].delayLabel, committee: delaySorted[0].room, detail: delaySorted[0].currentTopic }
        : null,
    };
  }, [committeeOperationalRows, lowTopic, scoresPublished, topTopic]);

  const committeeScoreStats = useMemo(() => {
    if (!scoresPublished) {
      return [];
    }

    const map = new Map<string, { code: string; total: number; count: number; varianceTotal: number; varianceCount: number }>();
    scoringMatrix.forEach((row) => {
      const code = String(row.committeeCode ?? row.committeeId ?? "").trim();
      if (!code) {
        return;
      }
      const current = map.get(code) ?? { code, total: 0, count: 0, varianceTotal: 0, varianceCount: 0 };
      const score = Number(row.finalScore ?? row.currentScore ?? 0);
      if (Number.isFinite(score) && score > 0) {
        current.total += score;
        current.count += 1;
      }
      const variance = Number(row.variance ?? 0);
      if (Number.isFinite(variance) && variance !== 0) {
        current.varianceTotal += Math.abs(variance);
        current.varianceCount += 1;
      }
      map.set(code, current);
    });

    return Array.from(map.values())
      .map((item) => ({
        code: item.code,
        avgScore: item.count > 0 ? item.total / item.count : 0,
        avgVariance: item.varianceCount > 0 ? item.varianceTotal / item.varianceCount : 0,
        sample: item.count,
      }))
      .sort((left, right) => right.avgScore - left.avgScore);
  }, [scoringMatrix, scoresPublished]);

  const scorePeak = useMemo(
    () => Math.max(1, ...committeeScoreStats.map((item) => item.avgScore)),
    [committeeScoreStats],
  );

  const variancePeak = useMemo(
    () => Math.max(1, ...committeeScoreStats.map((item) => item.avgVariance)),
    [committeeScoreStats],
  );

  const progressSeries = useMemo(() => committeeOperationalRows.slice(0, 8).map((row) => row.progressPercent), [committeeOperationalRows]);
  const varianceSeries = useMemo(() => scoringMatrix.filter((row) => row.variance != null).slice(0, 8).map((row) => Math.abs(Number(row.variance ?? 0)) * 10), [scoringMatrix]);
  const completionTrend = useMemo(() => committeeOperationalRows.slice(0, 8).map((row) => row.progressPercent), [committeeOperationalRows]);

  const [scoreSort, setScoreSort] = React.useState<"score" | "name" | "topic">("score");
  const publishedAnalyticsTopics = useMemo(() => (scoresPublished ? analyticsTopics : []), [analyticsTopics, scoresPublished]);
  const publishedScoringRows = useMemo(() => (scoresPublished ? scoringMatrix.filter((row) => row.finalScore != null && Number(row.finalScore) > 0) : []), [scoringMatrix, scoresPublished]);

  const sortedScores = useMemo(() => {
    const arr = (publishedAnalyticsTopics.length > 0 ? publishedAnalyticsTopics : publishedScoringRows).slice();
    if (scoreSort === "score") {
      arr.sort((a, b) => Number(b.finalScore ?? b.currentScore ?? 0) - Number(a.finalScore ?? a.currentScore ?? 0));
    } else if (scoreSort === "name") {
      arr.sort((a, b) => String(a.studentName ?? "").localeCompare(String(b.studentName ?? "")));
    } else {
      arr.sort((a, b) => String(a.topicTitle ?? "").localeCompare(String(b.topicTitle ?? "")));
    }
    return arr;
  }, [publishedAnalyticsTopics, publishedScoringRows, scoreSort]);

  const topHigh10 = useMemo(() => (scoresPublished ? (publishedAnalyticsTopics.length > 0 ? publishedAnalyticsTopics : publishedScoringRows).slice().sort((a, b) => Number(b.finalScore ?? b.currentScore ?? 0) - Number(a.finalScore ?? a.currentScore ?? 0)).slice(0, 10) : []), [publishedAnalyticsTopics, publishedScoringRows, scoresPublished]);
  const topLow10 = useMemo(() => (scoresPublished ? (publishedAnalyticsTopics.length > 0 ? publishedAnalyticsTopics : publishedScoringRows).slice().sort((a, b) => Number(a.finalScore ?? a.currentScore ?? 0) - Number(b.finalScore ?? b.currentScore ?? 0)).slice(0, 10) : []), [publishedAnalyticsTopics, publishedScoringRows, scoresPublished]);

  const getGradeFromScore = (score: number) => {
    if (!Number.isFinite(score)) return "-";
    if (score >= 8.5) return "A";
    if (score >= 7) return "B";
    if (score >= 5) return "C";
    if (score >= 3) return "D";
    return "F";
  };

  const getTopicScoreDisplay = (row: ScoringMatrixRow) => {
    const hasAnyScore = row.finalScore != null || row.currentScore != null;
    const normalizedStatus = normalizeStatusKey(row.status ?? "");
    
    if (normalizedStatus === "WAITING_PUBLIC") {
      return "Chờ công bố";
    }
    
    if (!row.isLocked) {
      return hasAnyScore ? "Đang chấm..." : "Chưa chấm";
    }
    
    if (row.finalScore != null) {
      return String(row.finalScore);
    }
    if (row.currentScore != null) {
      return String(row.currentScore);
    }
    return "-";
  };

  const getTopicGradeDisplay = (row: ScoringMatrixRow) => {
    const hasAnyScore = row.finalScore != null || row.currentScore != null;
    const normalizedStatus = normalizeStatusKey(row.status ?? "");
    
    if (normalizedStatus === "WAITING_PUBLIC") {
      return "Chờ công bố";
    }
    
    if (!row.isLocked) {
      return hasAnyScore ? "Đang chấm..." : "Chưa chấm";
    }
    
    const score = Number(row.finalScore ?? row.currentScore ?? NaN);
    return score > 0 ? getGradeFromScore(score) : "-";
  };

  const getLockedScoreValue = (row: ScoringMatrixRow, value: number | string | undefined | null) => {
    const hasAnyScore = row.finalScore != null || row.currentScore != null;
    const normalizedStatus = normalizeStatusKey(row.status ?? "");
    
    if (normalizedStatus === "WAITING_PUBLIC") {
      return "Chờ công bố";
    }
    
    if (!row.isLocked) {
      return hasAnyScore ? "Đang chấm..." : "Chưa chấm";
    }
    if (value == null || value === "") {
      return "-";
    }
    return String(value);
  };

  const periodInfo = useMemo(() => {
    const record = toRecord(snapshot?.monitoring?.period ?? snapshot?.monitoring?.tags ?? null);
    const startDateText = pickText(record, ["startDate", "StartDate", "startedAt", "StartedAt"], "-");
    const endDateText = pickText(record, ["endDate", "EndDate", "endedAt", "EndedAt"], "-");
    const statusValue = pickText(record, ["status", "Status", "state", "State"], pipeline?.overallCompletionPercent && pipeline.overallCompletionPercent >= 100 ? "Published" : "In progress");
    const startDate = parseDateValue(startDateText);
    const endDate = parseDateValue(endDateText);

    const daysRemaining = (() => {
      if (!endDate) {
        return null;
      }
      return Math.ceil((endDate.getTime() - currentTimestamp) / 86400000);
    })();

    const elapsedMinutes = startDate ? Math.max(0, (currentTimestamp - startDate.getTime()) / 60000) : 0;
    const countdownLabel = daysRemaining == null ? "-" : `${Math.max(0, daysRemaining)} ngày`;

    return {
      name: pickText(record, ["name", "Name", "title", "Title"], periodId ? `Đợt ${periodId}` : "Chưa xác định"),
      status: statusValue,
      startDate: startDateText,
      endDate: endDateText,
      daysRemaining,
      elapsedLabel: formatCompactDuration(elapsedMinutes),
      countdownLabel,
    };
  }, [currentTimestamp, periodId, pipeline?.overallCompletionPercent, snapshot?.monitoring?.period, snapshot?.monitoring?.tags]);

  const dashboardHasSnapshotContent = useMemo(
    () =>
      Boolean(
        pipeline ||
          analytics?.overview ||
          scoringMatrix.length > 0 ||
          (postDefense?.items?.length ?? 0) > 0 ||
          (audit?.syncHistory?.length ?? 0) > 0 ||
          (audit?.publishHistory?.length ?? 0) > 0 ||
          (audit?.councilAuditHistory?.length ?? 0) > 0 ||
          (audit?.revisionAuditTrail?.length ?? 0) > 0,
      ),
    [analytics?.overview, audit?.councilAuditHistory?.length, audit?.publishHistory?.length, audit?.revisionAuditTrail?.length, audit?.syncHistory?.length, pipeline, postDefense?.items?.length, scoringMatrix.length],
  );

  const auditTimelineItems = useMemo(() => {
    const keyword = auditKeyword.trim().toUpperCase();
    const filter = auditActionFilter;
    const rows = [
      ...(audit?.councilAuditHistory ?? []).map((row, index) => ({
        key: `council-${index}`,
        action: pickText(row, ["action", "event", "type"], "Open"),
        actor: pickText(row, ["actor", "user", "createdBy", "name"], "System"),
        timestamp: pickText(row, ["timestamp", "createdAt", "time"], "-"),
        detail: pickText(row, ["detail", "note", "description"], "-"),
      })),
      ...(audit?.revisionAuditTrail ?? []).map((row, index) => ({
        key: `revision-${index}`,
        action: pickText(row, ["action", "event", "type"], "Reopen"),
        actor: pickText(row, ["actor", "user", "createdBy", "name"], "System"),
        timestamp: pickText(row, ["timestamp", "createdAt", "time"], "-"),
        detail: pickText(row, ["detail", "note", "description"], "-"),
      })),
      ...(audit?.publishHistory ?? []).map((row, index) => ({
        key: `publish-${index}`,
        action: pickText(row, ["action", "event", "type"], "Publish"),
        actor: pickText(row, ["actor", "user", "createdBy", "name"], "Publisher"),
        timestamp: pickText(row, ["publishedAt", "timestamp", "createdAt"], "-"),
        detail: pickText(row, ["detail", "note", "description"], "-"),
      })),
      ...(audit?.syncHistory ?? []).map((row, index) => ({
        key: `sync-${index}`,
        action: pickText(row, ["action", "event", "type"], "Sync"),
        actor: pickText(row, ["actor", "user", "createdBy", "name"], "System"),
        timestamp: pickText(row, ["timestamp", "createdAt", "time"], "-"),
        detail: pickText(row, ["detail", "note", "description"], "-"),
      })),
    ];

    const actionMatches = (actionText: string) => {
      if (filter === "all") {
        return true;
      }
      const normalized = actionText.toLowerCase();
      const tokens: Record<AuditActionFilter, string[]> = {
        all: [],
        open: ["open", "mo"],
        submit: ["submit", "nop"],
        reopen: ["reopen", "mo lai", "rollback"],
        lock: ["lock", "khoa"],
        publish: ["publish", "cong bo"],
        sync: ["sync", "dong bo"],
      };
      return tokens[filter].some((token) => normalized.includes(token));
    };

    return rows
      .filter((item) => actionMatches(item.action))
      .filter((item) => {
        if (!keyword) {
          return true;
        }
        const haystack = `${item.actor} ${item.action} ${item.detail}`.toUpperCase();
        return haystack.includes(keyword);
      })
      .slice(0, Math.max(1, auditSize));
  }, [audit, auditActionFilter, auditKeyword, auditSize]);

  const recentExports = useMemo(
    () => snapshot?.reporting?.recentExports ?? [],
    [snapshot?.reporting?.recentExports],
  );

  const tabNavTop = commandBarHeight > 0 ? commandBarHeight + 24 : 12;

  const focusCommittee = useCallback(
    (committeeCode: string) => {
      const normalizedCode = String(committeeCode ?? "").trim();
      if (!normalizedCode) {
        return;
      }

      setCommitteeIdFilter(normalizedCode);
      const matchedRow = committeeOperationalRows.find(
        (row) => row.code.toUpperCase() === normalizedCode.toUpperCase() || row.key.toUpperCase() === normalizedCode.toUpperCase(),
      );
      if (matchedRow) {
        setSelectedCouncilCode(matchedRow.code);
        const numericMatch = matchedRow.code.match(/\d+/);
        setSelectedCouncilNumericId(numericMatch ? Number(numericMatch[0]) : null);
        setSelectedCouncilRow({
          code: matchedRow.code,
          name: matchedRow.name,
          room: matchedRow.room,
          chair: matchedRow.chair,
          secretary: matchedRow.secretary,
          reviewer: matchedRow.reviewer,
        });
      }

      setActiveTab("committee");
    },
    [committeeOperationalRows],
  );

  const openCommitteeScoring = useCallback(
    (committeeRow: CommitteeSummary) => {
      setSelectedCouncilCode(committeeRow.code);
      const numericMatch = committeeRow.code.match(/\d+/);
      setSelectedCouncilNumericId(numericMatch ? Number(numericMatch[0]) : null);
      setSelectedCouncilRow({
        code: committeeRow.code,
        name: committeeRow.name,
        room: committeeRow.room,
        chair: committeeRow.chair,
        secretary: committeeRow.secretary,
        reviewer: committeeRow.reviewer,
      });
      setScoringModalOpen(true);
    },
    [],
  );

  const setCommitteeSearchFocus = useCallback(() => {
    committeeSearchInputRef.current?.focus();
    committeeSearchInputRef.current?.select();
  }, []);

  const renderSkeletonBlock = (height: number, width = "100%") => (
    <div
      style={{
        height,
        width,
        borderRadius: 8,
        background: "#e2e8f0",
      }}
    />
  );

  const renderSparkline = (values: number[], stroke = DEEP_BLUE_PRIMARY) => (
    <svg viewBox="0 0 88 26" width="100%" height="26" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${stroke.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polyline
        fill={`url(#spark-${stroke.replace(/[^a-z0-9]/gi, "")})`}
        stroke={stroke}
        strokeWidth="2"
        points={buildSparklinePoints(values)}
      />
    </svg>
  );

  const renderLeaderboardCard = (entry: LeaderboardEntry | null) => {
    if (!entry) {
      return null;
    }

    return (
      <div
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 12,
          padding: 12,
          background: "#ffffff",
          display: "grid",
          gap: 6,
        }}
      >
        <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>{entry.label}</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{entry.title}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: DEEP_BLUE_PRIMARY }}>{entry.score}</div>
        <div style={{ fontSize: 12, color: "#475569" }}>{entry.committee}</div>
        <div style={{ fontSize: 12, color: "#475569" }}>{entry.detail}</div>
      </div>
    );
  };

  const hasSnapshotContent = useMemo(
    () =>
      Boolean(
        pipeline ||
          analytics?.overview ||
          scoringMatrix.length > 0 ||
          (postDefense?.items?.length ?? 0) > 0 ||
          (audit?.syncHistory?.length ?? 0) > 0 ||
          (audit?.publishHistory?.length ?? 0) > 0 ||
          (audit?.councilAuditHistory?.length ?? 0) > 0 ||
          (audit?.revisionAuditTrail?.length ?? 0) > 0,
      ),
    [
      analytics?.overview,
      audit?.councilAuditHistory?.length,
      audit?.publishHistory?.length,
      audit?.revisionAuditTrail?.length,
      audit?.syncHistory?.length,
      pipeline,
      postDefense?.items?.length,
      scoringMatrix.length,
    ],
  );

  const formatNumber = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value.toLocaleString("vi-VN");
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed.toLocaleString("vi-VN");
    }
    return "0";
  };

  const getMatrixStatus = (row: ScoringMatrixRow) => {
    const normalized = normalizeStatusKey(row.status ?? "");
    if (normalized.includes("PUBLISHED")) {
      return "published";
    }
    if (row.isLocked) {
      return "locked";
    }
    if (row.finalScore != null && Number(row.finalScore) > 0) {
      return "submitted";
    }
    if (row.variance != null && Math.abs(Number(row.variance)) >= 2) {
      return "warning";
    }
    return "waiting";
  };

  const getMatrixTone = (status: string) => {
    switch (status) {
      case "published":
        return { border: "#16a34a", bg: "#ecfdf3", text: "#15803d" };
      case "locked":
        return { border: "#1d4ed8", bg: "#eff6ff", text: "#1d4ed8" };
      case "submitted":
        return { border: "#0ea5e9", bg: "#e0f2fe", text: "#0ea5e9" };
      case "warning":
        return { border: "#f59e0b", bg: "#fffbeb", text: "#b45309" };
      default:
        return { border: "#cbd5e1", bg: "#f8fafc", text: "#475569" };
    }
  };

  const getMatrixLabel = (status: string) => {
    switch (status) {
      case "published":
        return "Công bố";
      case "locked":
        return "Đã khóa";
      case "submitted":
        return "Đã nộp";
      case "warning":
        return "Cảnh báo";
      default:
        return "Chờ";
    }
  };

  const renderAuditRows = (
    title: string,
    rows: Array<Record<string, unknown>>,
    primaryField: string,
    secondaryField: string,
  ) => (
    <section style={cardStyle}>
      <h3 style={{ marginTop: 0, fontSize: 16, color: "#0f172a" }}>{title}</h3>
      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: "#0f172a" }}>
          Chưa có dữ liệu để hiển thị.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.slice(0, Math.min(rows.length, auditSize)).map((row, idx) => (
            <div
              key={`${title}-${idx}`}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "8px 10px",
                background: "#ffffff",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                {String(row[primaryField] ?? "-")}
              </div>
              <div style={{ fontSize: 12, color: "#0f172a", marginTop: 3 }}>
                {String(row[secondaryField] ?? "-")}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const renderSkeletonPanel = (titleWidth: number, rows: number) => (
    <section style={cardStyle}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ height: 16, width: `${titleWidth}px`, borderRadius: 8, background: "#e2e8f0" }} />
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} style={{ display: "grid", gap: 8 }}>
            <div style={{ height: 12, width: "72%", borderRadius: 8, background: "#e2e8f0" }} />
            <div style={{ height: 12, width: "48%", borderRadius: 8, background: "#e2e8f0" }} />
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div
      style={{
        maxWidth: 1780,
        margin: "0 auto",
        padding: 16,
        fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
      }}
    >
      <section
        ref={commandBarRef}
        style={{
          ...cardStyle,
          position: "sticky",
          top: 12,
          zIndex: 40,
          marginBottom: 12,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0f172a", fontWeight: 700 }}>
              Mission Control Dashboard · Điều hành chấm điểm bảo vệ đồ án
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <h1 style={{ margin: 0, fontSize: 22, color: "#0f172a", display: "flex", gap: 8, alignItems: "center" }}>
                <Gavel size={20} color={DEEP_BLUE_PRIMARY} /> {periodInfo.name}
              </h1>
              {(() => {
                const statusTone = getStatusTone(periodInfo.status);
                return (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 700, border: `1px solid ${statusTone.border}`, background: statusTone.bg, color: statusTone.text }}>
                    {getStatusLabel(periodInfo.status)} · Realtime
                  </span>
                );
              })()}
            </div>
            <div style={{ fontSize: 12, color: "#475569" }}>
              Clock {new Date(currentTimestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · Countdown {periodInfo.countdownLabel} · Last refresh {lastLoadedAt || "Chưa có"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => void loadOperationsSnapshot()} style={{ border: "none", background: DEEP_BLUE_PRIMARY, color: "#ffffff", borderRadius: 10, minHeight: 36, padding: "0 12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <RefreshCw size={14} /> Làm mới
            </button>
            <button
              type="button"
              onClick={() => setAutoRefreshEnabled((value) => !value)}
              style={{
                border: `1px solid ${autoRefreshEnabled ? "#16a34a" : "#cbd5e1"}`,
                background: autoRefreshEnabled ? "#ecfdf3" : "#ffffff",
                color: autoRefreshEnabled ? "#15803d" : "#0f172a",
                borderRadius: 10,
                minHeight: 36,
                padding: "0 12px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <RotateCcw size={14} /> Realtime {autoRefreshEnabled ? "On" : "Off"}
            </button>
            <button type="button" onClick={() => setExportModalOpen(true)} style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 10, minHeight: 36, padding: "0 12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <Download size={14} /> Xuất file
            </button>
            <button type="button" onClick={() => setActiveTab("audit")} style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 10, minHeight: 36, padding: "0 12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <Activity size={14} /> Kiểm toán
            </button>
            <button type="button" onClick={() => setActiveTab("committee")} style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 10, minHeight: 36, padding: "0 12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <Search size={14} /> Lọc
            </button>
            <button type="button" onClick={() => void toggleFullscreen()} style={{ border: "1px solid #cbd5e1", background: isFullscreen ? "#fff7ed" : "#ffffff", color: "#0f172a", borderRadius: 10, minHeight: 36, padding: "0 12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <Maximize2 size={14} /> Toàn màn hình
            </button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8 }}>
          {[
            { label: "HĐ đang hoạt động", value: formatNumber(dashboardMetrics.activeCouncils), trend: `${dashboardMetrics.totalCouncils} cộng`, action: "Tập trung", tone: DEEP_BLUE_PRIMARY, spark: progressSeries },
            { label: "Đề tài đang chạy", value: formatNumber(dashboardMetrics.liveTopics), trend: `${dashboardMetrics.scoredTopics} đã chấm`, action: "Kiểm tra", tone: "#0ea5e9", spark: completionTrend },
            { label: "Cảnh báo hoạt động", value: formatNumber(dashboardMetrics.warnings), trend: `${keyAlerts.length} sự kiện`, action: "Xem xét", tone: "#ef4444", spark: varianceSeries },
            { label: "Tiến độ", value: `${formatNumber(dashboardMetrics.completionRate)}%`, trend: `${dashboardMetrics.lockedTopics} đã chốt`, action: "Mở", tone: "#16a34a", spark: progressSeries },
            { label: "Chờ công bố", value: formatNumber(dashboardMetrics.waitingPublicTopics), trend: `${dashboardMetrics.waitingTopics} chưa bắt đầu`, action: "Xếp hàng", tone: "#f59e0b", spark: completionTrend },
            { label: "Điểm trung bình", value: formatNumber(analytics?.overview?.average), trend: `${formatNumber(analytics?.overview?.passRate)}% vượt`, action: "Biểu đồ", tone: "#1d4ed8", spark: completionTrend },
          ].map((item, index) => (
            <div key={item.label} style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 10, background: "#ffffff", display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>{item.label}</div>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: item.tone }} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{item.value}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{item.trend}</div>
              <div style={{ marginTop: 2 }}>{renderSparkline(item.spark ?? [], item.tone)}</div>
              <button type="button" onClick={() => {
                const tabMap: Record<number, typeof activeTab> = { 0: "committee", 1: "committee", 2: "audit", 3: "analytics", 4: "post-defense", 5: "analytics" };
                setActiveTab(tabMap[index] ?? "overview");
              }} style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 8, minHeight: 30, padding: "0 10px", fontWeight: 700, fontSize: 12, cursor: "pointer", justifySelf: "start" }}>
                {item.action}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* TAB NAVIGATION */}
      <section
        style={{
          ...cardStyle,
          position: "sticky",
          top: tabNavTop,
          zIndex: 39,
          marginBottom: 12,
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingRight: 12,
        }}
      >
        {[
          { key: "overview" as const, label: "Tổng quan", icon: <Search size={15} />, badge: null },
          { key: "analytics" as const, label: "Thống kê", icon: <BarChart3 size={15} />, badge: null },
          { key: "committee" as const, label: "Hội đồng", icon: <Gavel size={15} />, badge: committeeOperationalRows.length > 0 ? String(committeeOperationalRows.length) : null },
          { key: "post-defense" as const, label: "Hậu bảo vệ", icon: <FileSpreadsheet size={15} />, badge: postDefense?.items ? String(postDefense.items.length) : null },
          { key: "audit" as const, label: "Kiểm toán & Báo cáo", icon: <Download size={15} />, badge: keyAlerts.length > 0 ? String(keyAlerts.length) : null },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                border: `2px solid ${isActive ? DEEP_BLUE_PRIMARY : "#e2e8f0"}`,
                borderRadius: 10,
                padding: "8px 14px",
                background: isActive ? LIGHT_BLUE_SOFTEN : "#ffffff",
                color: isActive ? DEEP_BLUE_PRIMARY : "#0f172a",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.2s ease",
                flexShrink: 0,
                position: "relative",
              }}
            >
              {tab.icon}
              {tab.label}
              {tab.badge && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 20,
                    height: 20,
                    borderRadius: 999,
                    background: "#ef4444",
                    color: "#ffffff",
                    fontSize: 11,
                    fontWeight: 800,
                    marginLeft: 4,
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </section>

      {/* TAB CONTENT */}
      {activeTab === "overview" && (
        <section style={{ display: "grid", gap: 12 }}>
          {loadingSnapshot && renderSkeletonPanel(220, 3)}
          {/* OVERVIEW TAB: Dashboard at a glance */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
            {/* LEFT: KPIs */}
            <div style={{ display: "grid", gap: 12 }}>
              {/* KPIs Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                {[
                  {
                    label: "Tổng hội đồng",
                    value: dashboardMetrics.totalCouncils,
                    trend: `${dashboardMetrics.activeCouncils} đang hoạt động`,
                    progress: (dashboardMetrics.activeCouncils / Math.max(1, dashboardMetrics.totalCouncils)) * 100,
                    tone: DEEP_BLUE_PRIMARY,
                    spark: progressSeries,
                    tab: "committee" as const,
                  },
                  {
                    label: "Tổng đề tài",
                    value: dashboardMetrics.totalTopics,
                    trend: `${dashboardMetrics.pendingTopics} chờ xử lý`,
                    progress: (dashboardMetrics.scoredTopics / Math.max(1, dashboardMetrics.totalTopics)) * 100,
                    tone: "#0ea5e9",
                    spark: completionTrend,
                    tab: "overview" as const,
                  },
                  {
                    label: "Đã chấm",
                    value: dashboardMetrics.scoredTopics,
                    trend: `${dashboardMetrics.completionRate}% hoàn thành`,
                    progress: dashboardMetrics.completionRate,
                    tone: "#16a34a",
                    spark: completionTrend,
                    tab: "analytics" as const,
                  },
                  {
                    label: "Đang bảo vệ",
                    value: dashboardMetrics.liveTopics,
                    trend: "Đang chấm điểm",
                    progress: (dashboardMetrics.liveTopics / Math.max(1, dashboardMetrics.totalTopics)) * 100,
                    tone: "#f59e0b",
                    spark: progressSeries,
                    tab: "committee" as const,
                  },
                  {
                    label: "Chưa bắt đầu",
                    value: dashboardMetrics.waitingTopics,
                    trend: "Đang chờ lịch",
                    progress: (dashboardMetrics.waitingTopics / Math.max(1, dashboardMetrics.totalTopics)) * 100,
                    tone: "#ef4444",
                    spark: varianceSeries,
                    tab: "committee" as const,
                  },
                  {
                    label: "Tỷ lệ hoàn thành",
                    value: `${formatNumber(dashboardMetrics.completionRate)}%`,
                    trend: `${dashboardMetrics.scoredTopics}/${dashboardMetrics.totalTopics}`,
                    progress: dashboardMetrics.completionRate,
                    tone: "#1d4ed8",
                    spark: completionTrend,
                    tab: "analytics" as const,
                  },
                  {
                    label: "Hội đồng active",
                    value: dashboardMetrics.activeCouncils,
                    trend: `${dashboardMetrics.totalCouncils} tổng`,
                    progress: (dashboardMetrics.activeCouncils / Math.max(1, dashboardMetrics.totalCouncils)) * 100,
                    tone: "#0ea5e9",
                    spark: progressSeries,
                    tab: "committee" as const,
                  },
                  {
                    label: "Số cảnh báo",
                    value: keyAlerts.length,
                    trend: "Ưu tiên cao",
                    progress: Math.min(100, keyAlerts.length * 12),
                    tone: "#ef4444",
                    spark: varianceSeries,
                    tab: "audit" as const,
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveTab(item.tab)}
                    style={{ border: `2px solid ${item.tone}`, borderRadius: 12, padding: 12, background: "#ffffff", cursor: "pointer", textAlign: "left", display: "grid", gap: 6 }}
                  >
                    <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>{item.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: item.tone }}>{formatNumber(item.value)}</div>
                    <div style={{ fontSize: 12, color: "#475569" }}>{item.trend}</div>
                    <div style={{ height: 6, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, Math.max(0, item.progress))}%`, height: "100%", background: item.tone }} />
                    </div>
                    <div>{renderSparkline(item.spark ?? [], item.tone)}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* RIGHT: Progress + Alerts */}
            <div style={{ display: "grid", gap: 12 }}>
              <section style={cardStyle}>
                <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Tiến độ chung</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: DEEP_BLUE_PRIMARY, marginTop: 8 }}>{dashboardMetrics.completionRate}%</div>
                <div style={{ height: 12, borderRadius: 999, background: "#e2e8f0", overflow: "hidden", marginTop: 12, display: "flex" }}>
                  <div title="Đã chốt" style={{ width: `${(dashboardMetrics.lockedTopics / Math.max(1, dashboardMetrics.totalTopics)) * 100}%`, height: "100%", background: "#16a34a", transition: "width 0.5s ease" }} />
                  <div title="Chờ công bố" style={{ width: `${(dashboardMetrics.waitingPublicTopics / Math.max(1, dashboardMetrics.totalTopics)) * 100}%`, height: "100%", background: "#f59e0b", transition: "width 0.5s ease" }} />
                </div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                  <span>{dashboardMetrics.scoredTopics}/{dashboardMetrics.totalTopics} đề tài</span>
                  <span>{dashboardMetrics.waitingPublicTopics} chờ chốt · {dashboardMetrics.lockedTopics} đã chốt</span>
                </div>
              </section>

              <section style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Cảnh báo</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: keyAlerts.length > 0 ? "#ef4444" : "#16a34a", marginTop: 4 }}>
                      {keyAlerts.length}
                    </div>
                  </div>
                  <div style={{ fontSize: 40, opacity: 0.1 }}>⚠️</div>
                </div>
                {keyAlerts.length > 0 && (
                  <div style={{ display: "grid", gap: 8, marginTop: 12, maxHeight: 200, overflowY: "auto" }}>
                    {keyAlerts.slice(0, 3).map((alert) => (
                      <div key={`${alert.focusKey}-${alert.priority}`} style={{ fontSize: 12, color: "#0f172a", padding: 8, border: "1px solid #fecaca", borderRadius: 8, background: "#fef2f2" }}>
                        <strong>{alert.title}</strong> · {alert.committeeCode}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* ACTIVE COMMITTEES SNAPSHOT */}
          <section style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Hội đồng đang hoạt động</div>
                <div style={{ fontSize: 13, color: "#475569", marginTop: 3 }}>{committeeOperationalRows.filter((r) => ["ONGOING", "READY", "DELAYED"].includes(r.status)).length} đang chạy</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, marginTop: 12 }}>
              {committeeOperationalRows.slice(0, 4).map((row) => {
                const statusTone = getStatusTone(row.status);
                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => focusCommittee(row.code)}
                    style={{ textAlign: "left", border: "1px solid #cbd5e1", borderRadius: 12, padding: 12, background: "#ffffff", cursor: "pointer", transition: "all 0.2s ease" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                      <div style={{ fontWeight: 800, color: "#0f172a" }}>{row.code}</div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "3px 8px", fontSize: 11, fontWeight: 700, border: `1px solid ${statusTone.border}`, background: statusTone.bg, color: statusTone.text }}>
                        {getStatusLabel(row.status)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{row.room} · {row.chair}</div>
                    <div style={{ fontSize: 12, color: "#0f172a", marginTop: 6, fontWeight: 700 }}>{row.currentTopic}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "#475569", marginTop: 6 }}>
                      <span>{row.scoredTopics}/{row.totalTopics} chấm</span>
                      <strong>{row.progressPercent}%</strong>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: "#e2e8f0", overflow: "hidden", marginTop: 6, display: "flex" }}>
                      <div title="Đã chốt" style={{ width: `${(row.lockedTopics / Math.max(1, row.totalTopics)) * 100}%`, height: "100%", background: "#16a34a" }} />
                      <div title="Chờ công bố" style={{ width: `${((row.scoredTopics - row.lockedTopics) / Math.max(1, row.totalTopics)) * 100}%`, height: "100%", background: "#f59e0b" }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={cardStyle}>
            <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Điểm nổi bật</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 12 }}>
              {[leaderboardEntries.highest, leaderboardEntries.lowest, leaderboardEntries.fastest, leaderboardEntries.delayed].map((entry) => renderLeaderboardCard(entry))}
            </div>
          </section>
        </section>
      )}

      {activeTab === "analytics" && (
        <section style={{ display: "grid", gap: 12 }}>
          {/* ANALYTICS TAB: Charts and insights */}
          {!scoresPublished && (
            <section style={cardStyle}>
              <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Thống kê điểm</div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 8 }}>
                Số liệu điểm sẽ hiển thị sau khi chủ tịch hội đồng chốt và công bố điểm.
              </div>
            </section>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
            {/* Grade Distribution */}
            <section style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Phân bổ xếp loại</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["pie", "bar", "line"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setDistributionChartType(type)}
                      style={{
                        padding: "4px 8px",
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 6,
                        border: `1px solid ${distributionChartType === type ? DEEP_BLUE_PRIMARY : "#cbd5e1"}`,
                        background: distributionChartType === type ? DEEP_BLUE_PRIMARY : "#ffffff",
                        color: distributionChartType === type ? "#ffffff" : "#0f172a",
                        cursor: "pointer",
                        textTransform: "uppercase"
                      }}
                    >
                      {type === "pie" ? "Tròn" : type === "bar" ? "Cột" : "Đường"}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ minHeight: 180, display: "grid", placeItems: "center", padding: 12 }}>
                {distributionChartType === "pie" && (
                  <div style={{ width: 140, height: 140, borderRadius: "50%", background: `conic-gradient(${distributionStops.map((stop) => `${stop.color} ${stop.start}% ${stop.end}%`).join(", ")})`, position: "relative" }}>
                    <div style={{ position: "absolute", inset: 16, borderRadius: "50%", background: "#ffffff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
                      {formatNumber(distributionTotal)}
                    </div>
                  </div>
                )}

                {distributionChartType === "bar" && (
                  <div style={{ width: "100%", height: 140, display: "flex", alignItems: "flex-end", gap: 12, paddingBottom: 20 }}>
                    {distributionRows.map((item) => (
                      <div key={item.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ width: "100%", height: `${(item.value / distributionPeak) * 100}%`, background: distributionPalette[item.label] ?? "#cbd5e1", borderRadius: "4px 4px 0 0", minHeight: item.value > 0 ? 4 : 0, transition: "height 0.3s ease" }} />
                        <span style={{ fontSize: 10, fontWeight: 700 }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {distributionChartType === "line" && (
                  <div style={{ width: "100%", height: 140, padding: "10px 0" }}>
                    <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
                      <path
                        d={`M ${distributionRows.map((item, idx) => `${(idx / (distributionRows.length - 1)) * 100},${40 - (item.value / distributionPeak) * 35}`).join(" L ")}`}
                        fill="none"
                        stroke={DEEP_BLUE_PRIMARY}
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      {distributionRows.map((item, idx) => (
                        <circle
                          key={idx}
                          cx={(idx / (distributionRows.length - 1)) * 100}
                          cy={40 - (item.value / distributionPeak) * 35}
                          r="1.5"
                          fill={distributionPalette[item.label] ?? DEEP_BLUE_PRIMARY}
                        />
                      ))}
                    </svg>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      {distributionRows.map(item => (
                        <span key={item.label} style={{ fontSize: 10, fontWeight: 700 }}>{item.label}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, marginTop: 12 }}>
                {distributionRows.map((item) => (
                  <div key={item.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>{item.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: distributionPalette[item.label] }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </section>

            {scoresPublished && (
              <>
                <section style={cardStyle}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Trung bình theo hội đồng</div>
                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    {committeeScoreStats.slice(0, 6).map((item) => (
                      <div key={item.code}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, marginBottom: 4 }}>
                          <span style={{ fontWeight: 700 }}>{item.code}</span>
                          <strong>{item.avgScore.toFixed(1)}</strong>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                          <div style={{ width: `${(item.avgScore / scorePeak) * 100}%`, height: "100%", background: DEEP_BLUE_PRIMARY }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section style={cardStyle}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Trạng thái khóa</div>
                  <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                    {[
                      { label: "Đã khóa", value: scoringMatrix.filter((r) => r.isLocked).length, color: "#0ea5e9" },
                      { label: "Chưa khóa", value: scoringMatrix.filter((r) => !r.isLocked && r.finalScore != null).length, color: "#f59e0b" },
                      { label: "Đang xử lý", value: scoringMatrix.filter((r) => r.finalScore == null).length, color: "#ef4444" },
                    ].map((item) => (
                      <div key={item.label}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span>{item.label}</span>
                          <strong style={{ color: item.color }}>{formatNumber(item.value)}</strong>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${(item.value / Math.max(1, scoringMatrix.length)) * 100}%`,
                              height: "100%",
                              background: item.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section style={cardStyle}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Biến thiên điểm</div>
                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    {committeeScoreStats.slice(0, 6).map((item) => (
                      <div key={`${item.code}-variance`}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, marginBottom: 4 }}>
                          <span style={{ fontWeight: 700 }}>{item.code}</span>
                          <strong>{item.avgVariance.toFixed(1)}</strong>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                          <div style={{ width: `${(item.avgVariance / variancePeak) * 100}%`, height: "100%", background: "#f59e0b" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>

          {/* Committee Progress Bars */}
          <section style={cardStyle}>
            <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Tiến độ theo hội đồng</div>
            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              {committeeOperationalRows.map((row) => (
                <div key={row.key} style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                    <span style={{ fontWeight: 700 }}>{row.code}</span>
                    <strong>{row.progressPercent}%</strong>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                    <div style={{ width: `${row.progressPercent}%`, height: "100%", background: row.progressPercent >= 80 ? "#16a34a" : row.progressPercent >= 50 ? "#f59e0b" : "#ef4444" }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={cardStyle}>
            <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Xu hướng hoàn thành</div>
            <div style={{ marginTop: 12 }}>{renderSparkline(completionTrend, "#16a34a")}</div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 8 }}>Hoàn thành theo thời gian trong phạm vi dữ liệu hiện tại.</div>
          </section>

          {/* Top Insights */}
          {scoresPublished && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                {[leaderboardEntries.highest, leaderboardEntries.lowest, leaderboardEntries.fastest, leaderboardEntries.delayed].map((entry) => renderLeaderboardCard(entry))}
              </div>

              <section style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Chi tiết điểm theo đề tài</div>
                    <div style={{ fontSize: 13, color: "#475569", marginTop: 3 }}>Danh sách điểm, xếp hạng và top 10</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, color: "#475569" }}>Sắp xếp:</div>
                    <button type="button" onClick={() => setScoreSort("score")} style={{ border: `1px solid ${scoreSort === "score" ? DEEP_BLUE_PRIMARY : "#cbd5e1"}`, background: scoreSort === "score" ? LIGHT_BLUE_SOFTEN : "#ffffff", color: scoreSort === "score" ? DEEP_BLUE_PRIMARY : "#0f172a", borderRadius: 8, padding: "6px 10px", fontWeight: 700, cursor: "pointer" }}>Theo điểm</button>
                    <button type="button" onClick={() => setScoreSort("name")} style={{ border: `1px solid ${scoreSort === "name" ? DEEP_BLUE_PRIMARY : "#cbd5e1"}`, background: scoreSort === "name" ? LIGHT_BLUE_SOFTEN : "#ffffff", color: scoreSort === "name" ? DEEP_BLUE_PRIMARY : "#0f172a", borderRadius: 8, padding: "6px 10px", fontWeight: 700, cursor: "pointer" }}>Theo tên</button>
                    <button type="button" onClick={() => setScoreSort("topic")} style={{ border: `1px solid ${scoreSort === "topic" ? DEEP_BLUE_PRIMARY : "#cbd5e1"}`, background: scoreSort === "topic" ? LIGHT_BLUE_SOFTEN : "#ffffff", color: scoreSort === "topic" ? DEEP_BLUE_PRIMARY : "#0f172a", borderRadius: 8, padding: "6px 10px", fontWeight: 700, cursor: "pointer" }}>Theo đề tài</button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginTop: 12 }}>
                  <div style={{ border: "1px solid #e6eef6", borderRadius: 10, padding: 10, background: "#ffffff", maxHeight: 420, overflowY: "auto" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 110px 100px 80px", gap: 12, padding: "8px 12px", background: "#f8fafc", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#475569" }}>
                      <div>Hạng</div>
                      <div>Đề tài / Sinh viên</div>
                      <div>Hội đồng</div>
                      <div>Điểm</div>
                      <div>Xếp loại</div>
                    </div>
                    {sortedScores.slice(0, 200).map((row, idx) => (
                      <div key={`score-row-${row.assignmentId ?? idx}`} style={{ display: "grid", gridTemplateColumns: "48px 1fr 110px 100px 80px", gap: 12, padding: "10px 12px", borderTop: "1px solid #eef2f7", alignItems: "center", transition: "background 0.18s" }}>
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>{idx + 1}</div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{row.topicTitle ?? "-"}</div>
                          <div style={{ fontSize: 12, color: "#475569" }}>{row.studentName ?? "-"} · {row.studentCode ?? "-"}</div>
                        </div>
                        <div style={{ fontWeight: 700 }}>{row.committeeCode ?? "-"}</div>
                        <div style={{ fontWeight: 900, color: DEEP_BLUE_PRIMARY }}>
                          {row.finalScore != null ? row.finalScore : row.currentScore != null ? row.currentScore : (row.submittedCount != null && row.requiredCount != null && row.submittedCount >= row.requiredCount) ? "..." : "-"}
                        </div>
                        <div>
                          {row.finalGrade ? row.finalGrade : (row.submittedCount != null && row.requiredCount != null && row.submittedCount >= row.requiredCount && !row.isLocked) ? <span style={{ color: "#b45309", fontWeight: 700 }}>Chờ công bố</span> : row.finalScore != null ? getGradeFromScore(Number(row.finalScore)) : "-"}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ border: "1px solid #e6eef6", borderRadius: 10, padding: 10, background: "#ffffff" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>Top 10 điểm cao nhất</div>
                      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                        {topHigh10.map((r, i) => (
                          <div key={`high-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ fontWeight: 700 }}>{i + 1}. {r.topicTitle ?? "-"}</div>
                            <div style={{ fontWeight: 900, color: "#16a34a" }}>{r.finalScore ?? r.currentScore ?? "-"}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ border: "1px solid #e6eef6", borderRadius: 10, padding: 10, background: "#ffffff" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>Top 10 điểm thấp nhất</div>
                      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                        {topLow10.map((r, i) => (
                          <div key={`low-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ fontWeight: 700 }}>{i + 1}. {r.topicTitle ?? "-"}</div>
                            <div style={{ fontWeight: 900, color: "#ef4444" }}>{r.finalScore ?? r.currentScore ?? "-"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </section>
      )}

      {activeTab === "committee" && (
        <section style={{ display: "grid", gridTemplateColumns: "minmax(320px, 0.95fr) minmax(0, 1.45fr)", gap: 12, alignItems: "start" }}>
          {/* LEFT: Committee List */}
          <aside style={{ ...cardStyle, display: "grid", gap: 12, maxHeight: "calc(100vh - 236px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Danh sách hội đồng</div>
                <div style={{ fontSize: 13, color: "#475569", marginTop: 3 }}>{visibleCommitteeRows.length}/{committeeOperationalRows.length}</div>
              </div>
            </div>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600 }}>Tìm kiếm</span>
              <input ref={committeeSearchInputRef} value={committeeIdFilter} onChange={(event) => setCommitteeIdFilter(event.target.value)} placeholder="Mã, phòng, chủ tịch" style={{ minHeight: 38, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 12px" }} />
            </label>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600 }}>Phòng</span>
                <input value={committeeRoomFilter} onChange={(event) => setCommitteeRoomFilter(event.target.value)} placeholder="Lọc theo phòng" style={{ minHeight: 38, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 12px" }} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600 }}>Chủ tịch</span>
                <input value={committeeChairFilter} onChange={(event) => setCommitteeChairFilter(event.target.value)} placeholder="Lọc theo chủ tịch" style={{ minHeight: 38, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 12px" }} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {[
                { value: "all" as NavigatorFilter, label: "Tất cả" },
                { value: "active" as NavigatorFilter, label: "Hoạt động" },
                { value: "completed" as NavigatorFilter, label: "Hoàn thành" },
              ].map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setNavigatorFilter(filter.value)}
                  style={{
                    border: `1px solid ${navigatorFilter === filter.value ? DEEP_BLUE_PRIMARY : "#cbd5e1"}`,
                    background: navigatorFilter === filter.value ? LIGHT_BLUE_SOFTEN : "#ffffff",
                    color: navigatorFilter === filter.value ? DEEP_BLUE_PRIMARY : "#0f172a",
                    borderRadius: 999,
                    minHeight: 30,
                    padding: "0 10px",
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {visibleCommitteeRows.length === 0 ? (
                <div style={{ ...emptyStateCardStyle, minHeight: 160 }}>Không có hội đồng phù hợp.</div>
              ) : (
                visibleCommitteeRows.map((row) => {
                  const isActive = selectedCommittee?.code === row.code;
                  const statusTone = getStatusTone(row.status);
                  return (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => focusCommittee(row.code)}
                      style={{
                        textAlign: "left",
                        border: `1px solid ${isActive ? DEEP_BLUE_PRIMARY : "#cbd5e1"}`,
                        borderRadius: 12,
                        background: isActive ? LIGHT_BLUE_SOFTEN : "#ffffff",
                        padding: 12,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{row.code}</div>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "3px 8px", fontSize: 11, fontWeight: 700, border: `1px solid ${statusTone.border}`, background: statusTone.bg, color: statusTone.text }}>
                          {getStatusLabel(row.status)}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{row.room} · {row.chair}</div>
                      <div style={{ fontSize: 12, color: "#0f172a", marginTop: 6, fontWeight: 700 }}>{row.currentTopic}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        <button type="button" onClick={(event) => { event.stopPropagation(); void submitCommitteeAction("OPEN", row); }} style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 8, minHeight: 30, padding: "0 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          Mở ca
                        </button>
                        {(row.status === "WAITING_PUBLIC" || row.status === "WAITING_PUBLISH" || (row.totalTopics > 0 && row.scoredTopics >= row.totalTopics)) && row.status !== "LOCKED" && row.status !== "PUBLISHED" && (
                          <button type="button" onClick={(event) => { event.stopPropagation(); void submitCommitteeAction("LOCK", row); }} style={{ border: "none", background: "#16a34a", color: "#ffffff", borderRadius: 8, minHeight: 30, padding: "0 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            Công bố
                          </button>
                        )}
                        <button type="button" onClick={(event) => { event.stopPropagation(); void submitCommitteeAction("LOCK", row); }} style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 8, minHeight: 30, padding: "0 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          Khóa ca
                        </button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); void submitCommitteeAction("REOPEN", row); }} style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 8, minHeight: 30, padding: "0 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          Mở lại
                        </button>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "#475569", marginTop: 6 }}>
                        <span>{row.scoredTopics}/{row.totalTopics}</span>
                        <strong>{row.progressPercent}%</strong>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: "#e2e8f0", overflow: "hidden", marginTop: 6 }}>
                        <div style={{ width: `${row.progressPercent}%`, height: "100%", background: row.progressPercent >= 80 ? "#16a34a" : row.progressPercent >= 50 ? "#f59e0b" : "#ef4444" }} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* RIGHT: Committee Details */}
          <main style={{ display: "grid", gap: 12, maxHeight: "calc(100vh - 236px)", overflowY: "auto" }}>
            {!selectedCommittee ? (
              <section style={emptyStateCardStyle}>Chọn hội đồn từ danh sách bên trái.</section>
            ) : (
              <>
                <section style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
                    <div>
                      <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Chi tiết hội đồng</div>
                      <h2 style={{ margin: "6px 0 0 0", fontSize: 18, color: "#0f172a" }}>{selectedCommittee.name}</h2>
                      <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>{selectedCommittee.code} · Phòng {selectedCommittee.room}</div>
                    </div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 700, border: `1px solid ${getStatusTone(selectedCommittee.status).border}`, background: getStatusTone(selectedCommittee.status).bg, color: getStatusTone(selectedCommittee.status).text }}>
                      {getStatusLabel(selectedCommittee.status)}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase" }}>Tổng đề tài</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{selectedCommitteeRows.length}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase" }}>Đã chấm</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{selectedCommittee.scoredTopics}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase" }}>Tiến độ</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{selectedCommittee.progressPercent}%</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase" }}>Điểm TB</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{selectedCommitteeFinalized ? formatNumber(analytics?.overview?.average ?? analytics?.byCouncil?.[0]?.avg ?? 0) : "-"}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
                    <div style={cardStyle}>
                      <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#475569" }}>Giảng viên hướng dẫn</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 6 }}>{selectedCommitteeSupervisor}</div>
                    </div>
                    <div style={cardStyle}>
                      <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#475569" }}>Chủ tịch hội đồng</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 6 }}>{selectedCommittee.chair || "-"}</div>
                    </div>
                    <div style={cardStyle}>
                      <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#475569" }}>Ủy viên thư ký</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 6 }}>{selectedCommittee.secretary || "-"}</div>
                    </div>
                    <div style={cardStyle}>
                      <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#475569" }}>Ủy viên phản biện</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 6 }}>{selectedCommittee.reviewer || "-"}</div>
                    </div>
                  </div>
                  {selectedCommitteeFinalized && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: 'center' }}>
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          style={{ border: "1px solid #cbd5e1", background: DEEP_BLUE_PRIMARY, color: "#ffffff", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                          disabled={isDownloadingPreviewFile}
                          onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                        >
                          <Download size={14} /> {isDownloadingPreviewFile ? "Đang xử lý..." : "Tải xuống"} <ChevronDown size={14} style={{ transform: showDownloadDropdown ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                        </button>
                        {showDownloadDropdown && (
                          <div
                            style={{
                              position: "absolute",
                              top: "calc(100% + 6px)",
                              right: 0,
                              background: "#ffffff",
                              border: "1px solid #cbd5e1",
                              borderRadius: 10,
                              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                              minWidth: 180,
                              zIndex: 4100,
                              overflow: "hidden",
                              display: "grid",
                              padding: 4,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => { setShowDownloadDropdown(false); void downloadPreviewDocument("scoreSheet", "word"); }}
                              style={{ background: "none", border: "none", padding: "10px 12px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#0f172a", cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                            >
                              <FileText size={14} color="#2563eb" /> Xuất Word (.docx)
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowDownloadDropdown(false); void downloadPreviewDocument("scoreSheet", "pdf"); }}
                              style={{ background: "none", border: "none", padding: "10px 12px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#0f172a", cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                            >
                              <Archive size={14} color="#dc2626" /> Xuất PDF (.pdf)
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowDownloadDropdown(false); downloadCommitteeReport(selectedCommittee, "scoreboard", "excel"); }}
                              style={{ background: "none", border: "none", padding: "10px 12px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#0f172a", cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                            >
                              <Download size={14} color="#0f172a" /> Xuất Excel (.xlsx)
                            </button>
                          </div>
                        )}
                      </div>

                      <button type="button" onClick={() => { if (!selectedTopic) { notifyError("Vui lòng chọn đề tài để xem biên bản."); return; } setPreviewModalType("meeting"); }} style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 8, minHeight: 34, padding: "0 12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                        <Eye size={14} /> Xem biên bản
                      </button>

                      <button type="button" onClick={() => { if (!selectedTopic) { notifyError("Vui lòng chọn đề tài để xem nhận xét."); return; } setPreviewModalType("reviewer"); }} style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 8, minHeight: 34, padding: "0 12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                        <Eye size={14} /> Xem nhận xét
                      </button>

                      <button type="button" onClick={() => { setPreviewModalType("scoreSheet"); }} style={{ border: "1px solid #cbd5e1", background: LIGHT_BLUE_SOFTEN, color: DEEP_BLUE_PRIMARY, borderRadius: 8, minHeight: 34, padding: "0 12px", fontWeight: 700, cursor: "pointer" }}>
                        Xem bảng điểm
                      </button>
                    </div>
                  )}
                </section>


                <section style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Danh sách đề tài</div>
                      <div style={{ fontSize: 13, color: "#475569", marginTop: 3 }}>{selectedCommitteeRows.length} hàng</div>
                    </div>
                  </div>
                  <div style={{ overflow: "auto", marginTop: 12, border: "1px solid #cbd5e1", borderRadius: 10 }}>
                    <div style={{ minWidth: 800 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "72px 110px 1fr 1fr 1fr 90px 220px", gap: 12, padding: "10px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>
                        <div>STT</div>
                        <div>Mã SV</div>
                        <div>Họ tên</div>
                        <div>Đề tài</div>
                        <div>Giảng viên hướng dẫn</div>
                        <div>Điểm</div>
                        <div>Thao tác</div>
                      </div>
                      {selectedCommitteeRows.map((row, idx) => {
                        const statusValue = row.status ?? (row.isLocked ? "LOCKED" : row.finalScore ? "COMPLETED" : "ONGOING");
                        const statusTone = getStatusTone(statusValue);
                        const rowFinalized = selectedCommitteeFinalized || row.isLocked === true || ["LOCKED", "COMPLETED", "PUBLISHED", "FINALIZED", "WAITING_PUBLIC"].includes(normalizeStatusKey(statusValue));
                        return (
                          <div key={`${row.assignmentId ?? idx}`} style={{ display: "grid", gridTemplateColumns: "72px 110px 1fr 1fr 1fr 90px 220px", gap: 12, padding: "10px 12px", borderTop: "1px solid #e2e8f0", fontSize: 12, color: "#0f172a", alignItems: "center" }}>
                            <div>{idx + 1}</div>
                            <div style={{ fontWeight: 700 }}>{row.studentCode ?? "-"}</div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{row.studentName ?? "-"}</div>
                            </div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{row.topicTitle ?? "-"}</div>
                              <div style={{ fontSize: 11, color: "#475569" }}>{row.topicCode ?? "-"}</div>
                            </div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{row.supervisorLecturerName ?? row.supervisorName ?? selectedCommitteeChair}</div>
                              <div style={{ fontSize: 11, color: "#475569" }}>Giảng viên hướng dẫn</div>
                            </div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{getTopicScoreDisplay(row)}</div>
                              <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{getTopicGradeDisplay(row)}</div>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                              {!rowFinalized ? (
                                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Chờ chốt điểm</span>
                              ) : (
                                <>
                                  <button type="button" onClick={() => { setSelectedTopic(row); setPreviewModalType("meeting"); }} style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 8, minHeight: 28, padding: "0 8px", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Eye size={12} /> Xem biên bản</button>
                                  <button type="button" onClick={() => { setSelectedTopic(row); setPreviewModalType("reviewer"); }} style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 8, minHeight: 28, padding: "0 8px", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Eye size={12} /> Xem nhận xét</button>
                                  <button type="button" onClick={() => { setSelectedTopic(row); setTopicDetailModalOpen(true); }} style={{ border: "1px solid #cbd5e1", background: LIGHT_BLUE_SOFTEN, color: DEEP_BLUE_PRIMARY, borderRadius: 8, minHeight: 28, padding: "0 8px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Chi tiết</button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {selectedCommitteeFinalized && (
                  <section style={cardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Export hội đồng</div>
                        <div style={{ fontSize: 13, color: "#475569", marginTop: 3 }}>Bảng điểm, biên bản, nhận xét</div>
                      </div>
                      <button type="button" onClick={() => setExportModalOpen(true)} style={{ border: "none", background: DEEP_BLUE_PRIMARY, color: "#ffffff", borderRadius: 8, minHeight: 32, padding: "0 10px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        Mở menu xuất file
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 12 }}>
                      {committeeExportOptions.map((option) => (
                        <button key={option.value} type="button" onClick={() => setCommitteeExportType(option.value as CommitteeExportType)} style={{ border: `1px solid ${committeeExportType === option.value ? DEEP_BLUE_PRIMARY : "#cbd5e1"}`, borderRadius: 10, background: committeeExportType === option.value ? LIGHT_BLUE_SOFTEN : "#ffffff", color: committeeExportType === option.value ? DEEP_BLUE_PRIMARY : "#0f172a", padding: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 10 }}>Định dạng hiện tại: <strong>{reportFormat.toUpperCase()}</strong></div>
                  </section>
                )}

                {showScoringMatrix && (
                  <section style={cardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Scoring matrix</div>
                        <div style={{ fontSize: 13, color: "#475569", marginTop: 3 }}>CT · UVTK · UVPB · GVHD · AVG · Variance</div>
                      </div>
                    </div>
                    <div style={{ overflow: "auto", marginTop: 12, border: "1px solid #cbd5e1", borderRadius: 10 }}>
                      <div style={{ minWidth: 860 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr 1fr 90px 100px", gap: 10, padding: "10px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>
                          <div>CT</div>
                          <div>UVTK</div>
                          <div>UVPB</div>
                          <div>GVHD</div>
                          <div>AVG</div>
                          <div>Variance</div>
                          <div>Status</div>
                        </div>
                        {selectedCommitteeRows.slice(0, 12).map((row, idx) => {
                          const matrixStatus = getMatrixStatus(row);
                          const statusTone = getMatrixTone(matrixStatus);
                          return (
                            <div key={`matrix-${row.assignmentId ?? idx}`} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr 1fr 90px 100px", gap: 10, padding: "10px 12px", borderTop: "1px solid #e2e8f0", fontSize: 12, color: "#0f172a" }}>
                              <div>{idx + 1}</div>
                              <div>{row.studentName ?? "-"}</div>
                              <div>{row.topicTitle ?? "-"}</div>
                              <div>{row.supervisorName ?? selectedCommitteeChair}</div>
                              <div>{getTopicScoreDisplay(row)}</div>
                              <div>{row.variance ?? "-"}</div>
                              <div>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999, padding: "3px 8px", fontSize: 10, fontWeight: 700, border: `1px solid ${statusTone.border}`, background: statusTone.bg, color: statusTone.text }}>
                                  {getMatrixLabel(matrixStatus)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}
          </main>
        </section>
      )}

      {activeTab === "post-defense" && (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))", gap: 12 }}>
          <section style={cardStyle}>
            <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Tổng quan hậu bảo vệ</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 12 }}>
              {[
                { label: "Yêu cầu mở lại", value: postDefense?.pendingRevisions ?? 0, color: "#ef4444" },
                { label: "Pending approval", value: postDefense?.totalRevisions ?? 0, color: "#f59e0b" },
                { label: "Approved", value: postDefense?.approvedRevisions ?? 0, color: "#16a34a" },
                { label: "Rejected", value: postDefense?.rejectedRevisions ?? 0, color: "#1d4ed8" },
              ].map((item) => (
                <div key={item.label} style={{ border: `1px solid ${item.color}`, borderRadius: 12, padding: 12, background: "#ffffff" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>{item.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: item.color, marginTop: 8 }}>{formatNumber(item.value)}</div>
                </div>
              ))}
            </div>
          </section>

          <section style={cardStyle}>
            <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Đồng bộ trạng thái</div>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {[
                { label: "SIS", status: postDefense?.publishedScores ? "Đã đồng bộ" : "Chờ" },
                { label: "ERP", status: postDefense?.lockedScores ? "Đã đồng bộ" : "Chờ" },
                { label: "LMS", status: (postDefense?.approvedRevisions ?? 0) > 0 ? "Đã đồng bộ" : "Chờ" },
              ].map((item) => (
                <div key={item.label} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>{item.label}</span>
                  <strong style={{ color: item.status === "Đã đồng bộ" ? "#16a34a" : "#f59e0b" }}>{item.status}</strong>
                </div>
              ))}
            </div>
          </section>

          <section style={cardStyle}>
            <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Xác minh cuối cùng</div>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10 }}>Điểm cuối: <strong>{postDefense?.publishedScores ?? 0}</strong></div>
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10 }}>Đã khóa: <strong>{postDefense?.lockedScores ?? 0}</strong></div>
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10 }}>Tài liệu đầy đủ: <strong>{(postDefense?.items ?? []).length > 0 ? "Đạt" : "Chưa đủ"}</strong></div>
            </div>
          </section>

          {/* Revision Queue */}
          <section style={cardStyle}>
            <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Hàng đợi mở lại</div>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {(postDefense?.items ?? []).filter((item) => item.status === "PENDING").length === 0 ? (
                <div style={{ ...emptyStateCardStyle, minHeight: 120 }}>Không có yêu cầu chờ xử lý.</div>
              ) : (
                (postDefense?.items ?? [])
                  .filter((item) => item.status === "PENDING")
                  .map((item, idx) => (
                    <div key={idx} style={{ border: "1px solid #fecaca", borderRadius: 10, padding: 12, background: "#fef2f2" }}>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{item.topicTitle ?? "-"}</div>
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{item.studentName ?? "-"}</div>
                      <div style={{ fontSize: 12, color: "#0f172a", marginTop: 6 }}>{item.note ?? "-"}</div>
                    </div>
                  ))
              )}
            </div>
          </section>

          {/* Approved Revisions */}
          <section style={cardStyle}>
            <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Đã duyệt</div>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {(postDefense?.items ?? []).filter((item) => item.status === "APPROVED").length === 0 ? (
                <div style={{ ...emptyStateCardStyle, minHeight: 120 }}>Không có yêu cầu đã duyệt.</div>
              ) : (
                (postDefense?.items ?? [])
                  .filter((item) => item.status === "APPROVED")
                  .map((item, idx) => (
                    <div key={idx} style={{ border: "1px solid #bbf7d0", borderRadius: 10, padding: 12, background: "#f0fdf4" }}>
                      <div style={{ fontWeight: 700, color: "#166534" }}>{item.topicTitle ?? "-"}</div>
                      <div style={{ fontSize: 12, color: "#166534", marginTop: 4 }}>{item.studentName ?? "-"}</div>
                    </div>
                  ))
              )}
            </div>
          </section>

          <section style={cardStyle}>
            <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Hàng đợi publish</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 12 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Chờ publish</div>
                {(postDefense?.items ?? []).filter((item) => String(item.status ?? "").toUpperCase() === "APPROVED").length === 0 ? (
                  <div style={{ ...emptyStateCardStyle, minHeight: 96 }}>Không có mục chờ publish.</div>
                ) : (
                  (postDefense?.items ?? [])
                    .filter((item) => String(item.status ?? "").toUpperCase() === "APPROVED")
                    .map((item, idx) => (
                      <div key={`publish-wait-${idx}`} style={{ border: "1px solid #f59e0b", borderRadius: 10, padding: 12, background: "#fffbeb" }}>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>{item.topicTitle ?? "-"}</div>
                        <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{item.studentName ?? "-"}</div>
                      </div>
                    ))
                )}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Đã publish</div>
                {(postDefense?.items ?? []).filter((item) => String(item.status ?? "").toUpperCase() === "PUBLISHED").length === 0 ? (
                  <div style={{ ...emptyStateCardStyle, minHeight: 96 }}>Không có bản ghi đã publish.</div>
                ) : (
                  (postDefense?.items ?? [])
                    .filter((item) => String(item.status ?? "").toUpperCase() === "PUBLISHED")
                    .map((item, idx) => (
                      <div key={`publish-done-${idx}`} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 12, background: "#ffffff" }}>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>{item.topicTitle ?? "-"}</div>
                        <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{item.studentName ?? "-"}</div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </section>
        </section>
      )}

      {activeTab === "audit" && (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: 12 }}>
          {/* Audit Timeline */}
          <section style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Lịch trình kiểm toán</div>
              </div>
              <button type="button" onClick={() => setExportModalOpen(true)} style={{ border: "none", background: DEEP_BLUE_PRIMARY, color: "#ffffff", borderRadius: 8, minHeight: 30, padding: "0 10px", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Download size={12} /> Xuất
              </button>
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600 }}>Lọc audit</span>
                <input value={auditKeyword} onChange={(event) => setAuditKeyword(event.target.value)} placeholder="Ai, hành động, mô tả" style={{ minHeight: 38, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 12px" }} />
              </label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {auditActionOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAuditActionFilter(option.value)}
                    style={{
                      border: `1px solid ${auditActionFilter === option.value ? DEEP_BLUE_PRIMARY : "#cbd5e1"}`,
                      background: auditActionFilter === option.value ? LIGHT_BLUE_SOFTEN : "#ffffff",
                      color: auditActionFilter === option.value ? DEEP_BLUE_PRIMARY : "#0f172a",
                      borderRadius: 999,
                      minHeight: 30,
                      padding: "0 10px",
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 12, maxHeight: 500, overflowY: "auto" }}>
              {auditTimelineItems.length === 0 ? (
                <div style={{ fontSize: 12, color: "#64748b" }}>Không có hoạt động.</div>
              ) : (
                auditTimelineItems.map((item) => (
                  <div key={item.key} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 999, background: "#f0f4f8", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 11, color: DEEP_BLUE_PRIMARY }}>
                        {String(item.action ?? "").slice(0, 1).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{item.actor}</div>
                        <div style={{ fontSize: 11, color: "#475569" }}>{item.action} · {item.timestamp}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#0f172a", marginTop: 6, fontWeight: 700 }}>{item.detail}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Export Center */}
          <section style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Trung tâm xuất file</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>PDF · Excel · CSV · Word</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
              {reportFormatOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setReportFormat(opt.value as ReportFormat)}
                  style={{
                    border: `1px solid ${reportFormat === opt.value ? DEEP_BLUE_PRIMARY : "#cbd5e1"}`,
                    borderRadius: 10,
                    background: reportFormat === opt.value ? LIGHT_BLUE_SOFTEN : "#ffffff",
                    color: reportFormat === opt.value ? DEEP_BLUE_PRIMARY : "#0f172a",
                    padding: 10,
                    textAlign: "center",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Gói xuất</div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10 }}>PDF: biên bản, bảng điểm, tổng hợp</div>
                <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10 }}>Excel: tiến độ, thống kê</div>
                <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10 }}>CSV: raw scores</div>
                <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10 }}>Word: nhận xét</div>
                <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10 }}>ZIP: archive</div>
              </div>
            </div>
            <button type="button" onClick={() => setExportModalOpen(true)} style={{ width: "100%", border: "none", background: DEEP_BLUE_PRIMARY, color: "#ffffff", borderRadius: 10, minHeight: 38, marginTop: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Download size={14} /> Xuất ngay
            </button>
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Recent exports</div>
              {recentExports.length === 0 ? (
                <div style={{ fontSize: 12, color: "#64748b" }}>Chưa có export gần đây.</div>
              ) : (
                recentExports.slice(0, 4).map((item, index) => (
                  <div key={`${String(item?.name ?? item?.fileName ?? "export")}-${index}`} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{String(item?.name ?? item?.fileName ?? "Export")}</div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{String(item?.timestamp ?? item?.createdAt ?? "-")}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>
      )}

      {previewModalType && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            zIndex: 4000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
          onClick={() => setPreviewModalType(null)}
        >
          <div
            style={{
              width: "min(980px, calc(100vw - 24px))",
              maxHeight: "calc(100vh - 36px)",
              overflowY: "auto",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 14,
              padding: 16,
              boxShadow: "0 20px 44px rgba(2, 6, 23, 0.24)",
              display: "grid",
              gap: 10,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>
                  {previewModalType === "meeting"
                    ? "BIÊN BẢN HỌP HỘI ĐỒNG CHẤM LUẬN ĐỒ ÁN"
                    : previewModalType === "reviewer"
                      ? "NHẬN XÉT CỦA NGƯỜI PHẢN BIỆN ĐỒ ÁN"
                      : "BẢNG ĐIỂM GHI KẾT QUẢ BẢO VỆ"}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                  {previewModalType === "scoreSheet"
                    ? "Xem trước bảng điểm của toàn bộ đề tài trong hội đồng trước khi tải file."
                    : `Xem trước dữ liệu của đề tài: ${selectedTopic?.topicTitle ?? "-"}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    style={{ border: "1px solid #cbd5e1", background: DEEP_BLUE_PRIMARY, color: "#ffffff", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s" }}
                    disabled={isDownloadingPreviewFile}
                    onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                  >
                    <Download size={14} /> {isDownloadingPreviewFile ? "Đang xử lý..." : "Tải xuống"} <ChevronDown size={14} style={{ transform: showDownloadDropdown ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                  </button>
                  {showDownloadDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        right: 0,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 10,
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                        minWidth: 160,
                        zIndex: 4100,
                        overflow: "hidden",
                        display: "grid",
                        padding: 4,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => { setShowDownloadDropdown(false); void downloadPreviewDocument(previewModalType, "word"); }}
                        style={{ background: "none", border: "none", padding: "10px 12px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#0f172a", cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      >
                        <FileText size={14} color="#2563eb" /> Xuất bản Word (.docx)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowDownloadDropdown(false); void downloadPreviewDocument(previewModalType, "pdf"); }}
                        style={{ background: "none", border: "none", padding: "10px 12px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#0f172a", cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      >
                        <Archive size={14} color="#dc2626" /> Xuất bản PDF (.pdf)
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  style={{ border: "1px solid #cbd5e1", background: "#f8fafc", color: "#64748b", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", height: "fit-content" }}
                  onClick={() => { setPreviewModalType(null); setShowDownloadDropdown(false); }}
                >
                  Đóng
                </button>
              </div>
            </div>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#fcfcfc", minHeight: 400 }}>
              {previewModalType === "scoreSheet" ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 16, marginBottom: 10 }}>BẢNG ĐIỂM CHI TIẾT</div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>STT</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: 8, textAlign: "left" }}>Sinh viên</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: 8, textAlign: "left" }}>Đề tài</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>CT</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>TK</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>PB</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>GVHD</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>Tổng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCommitteeRows.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ border: "1px solid #cbd5e1", padding: 8, textAlign: "center" }}>{idx + 1}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>{row.studentName}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>{row.topicTitle}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: 8, textAlign: "center" }}>{getLockedScoreValue(row, row.scoreCt)}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: 8, textAlign: "center" }}>{getLockedScoreValue(row, row.scoreTk)}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: 8, textAlign: "center" }}>{getLockedScoreValue(row, row.scorePb)}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: 8, textAlign: "center" }}>{getLockedScoreValue(row, row.scoreGvhd ?? row.topicSupervisorScore)}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: 8, textAlign: "center", fontWeight: "bold" }}>{getLockedScoreValue(row, row.finalScore ?? row.currentScore)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : selectedTopic ? (
                <div style={{ display: "grid", gap: 16, fontSize: 14, lineHeight: 1.6 }}>
                  <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 16 }}>
                    {previewModalType === "meeting" ? "BIÊN BẢN HỌP HỘI ĐỒNG" : "NHẬN XÉT PHẢN BIỆN"}
                  </div>
                  
                  <div style={{ display: "grid", gap: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 12 }}>
                    <div>Sinh viên: <strong>{selectedTopic.studentName}</strong> ({selectedTopic.studentCode})</div>
                    <div>Đề tài: <strong>{selectedTopic.topicTitle}</strong></div>
                    <div>Hội đồng: <strong>{selectedCommittee?.code} - {selectedCommittee?.name}</strong></div>
                  </div>

                  {previewModalType === "meeting" ? (
                    <div style={{ display: "grid", gap: 12 }}>
                      <div style={{ fontWeight: "bold" }}>I. Nội dung nhận xét chung:</div>
                      <div style={{ whiteSpace: "pre-wrap", padding: 12, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                        {selectedTopic.commentTk || "Chưa có nội dung biên bản chi tiết."}
                      </div>
                      <div style={{ fontWeight: "bold" }}>II. Điểm thành phần:</div>
                      <div style={{ display: "flex", gap: 20 }}>
                        <span>Chủ tịch: <strong>{getLockedScoreValue(selectedTopic, selectedTopic.scoreCt)}</strong></span>
                        <span>Thư ký: <strong>{getLockedScoreValue(selectedTopic, selectedTopic.scoreTk)}</strong></span>
                        <span>Phản biện: <strong>{getLockedScoreValue(selectedTopic, selectedTopic.scorePb)}</strong></span>
                        <span>GVHD: <strong>{getLockedScoreValue(selectedTopic, selectedTopic.scoreGvhd ?? selectedTopic.topicSupervisorScore)}</strong></span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      <div style={{ fontWeight: "bold" }}>Nội dung nhận xét phản biện:</div>
                      <div style={{ whiteSpace: "pre-wrap", padding: 12, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                        {selectedTopic.commentPb || "Chưa có nội dung nhận xét phản biện chi tiết."}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "#64748b", marginTop: 40 }}>Vui lòng chọn một đề tài để xem trước.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {topicDetailModalOpen && selectedTopic && (
        <div style={{ position: "fixed", inset: 0, zIndex: 4100, background: "rgba(15, 23, 42, 0.56)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }} onClick={() => setTopicDetailModalOpen(false)}>
          <div style={{ background: "#ffffff", borderRadius: 12, maxWidth: 980, width: "100%", maxHeight: "86vh", overflow: "auto", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.12)" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ padding: 20, display: "grid", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Chi tiết đề tài</div>
                  <h3 style={{ margin: "6px 0 0 0", fontSize: 20, color: "#0f172a" }}>{selectedTopic.topicTitle ?? "-"}</h3>
                </div>
                <button type="button" onClick={() => setTopicDetailModalOpen(false)} style={{ border: "none", background: "none", color: "#64748b", cursor: "pointer", fontSize: 20 }}>×</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                <div style={cardStyle}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#475569" }}>Sinh viên</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginTop: 6 }}>{selectedTopic.studentName ?? "-"}</div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{selectedTopic.studentCode ?? "-"}</div>
                </div>
                <div style={cardStyle}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#475569" }}>Hội đồng</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginTop: 6 }}>{selectedCommittee?.name ?? selectedTopic.committeeName ?? selectedTopic.committeeCode ?? "-"}</div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{selectedTopic.committeeCode ?? selectedCommittee?.code ?? "-"}</div>
                </div>
                <div style={cardStyle}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#475569" }}>Điểm cuối</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: DEEP_BLUE_PRIMARY, marginTop: 6 }}>{getTopicScoreDisplay(selectedTopic)}</div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{getTopicGradeDisplay(selectedTopic)}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                <div style={cardStyle}><div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase" }}>Giảng viên hướng dẫn</div><div style={{ marginTop: 6, fontWeight: 700 }}>{selectedTopic.supervisorLecturerName ?? selectedTopic.supervisorName ?? "-"}</div></div>
                <div style={cardStyle}><div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase" }}>Chủ tịch hội đồng</div><div style={{ marginTop: 6, fontWeight: 700 }}>{selectedCommittee?.chair ?? "-"}</div></div>
                <div style={cardStyle}><div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase" }}>Ủy viên thư ký</div><div style={{ marginTop: 6, fontWeight: 700 }}>{selectedCommittee?.secretary ?? "-"}</div></div>
                <div style={cardStyle}><div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase" }}>Ủy viên phản biện</div><div style={{ marginTop: 6, fontWeight: 700 }}>{selectedCommittee?.reviewer ?? "-"}</div></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12 }}>
                <section style={cardStyle}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Thông tin đề tài</div>
                  <div style={{ display: "grid", gap: 8, marginTop: 10, fontSize: 13, color: "#0f172a" }}>
                    <div>Mã đề tài: <strong>{selectedTopic.topicCode ?? "-"}</strong></div>
                    <div>Lớp: <strong>{selectedTopic.className ?? "-"}</strong></div>
                    <div>Khoá: <strong>{selectedTopic.cohortCode ?? "-"}</strong></div>
                    <div>Thời gian: <strong>{selectedTopic.startTime ?? "-"} - {selectedTopic.endTime ?? "-"}</strong></div>
                    <div>Trạng thái: <strong>{getStatusLabel(selectedTopic.status ?? (selectedTopic.isLocked ? "LOCKED" : "ONGOING"))}</strong></div>
                    <div>Đã nộp / cần nộp: <strong>{selectedTopic.submittedCount ?? 0} / {selectedTopic.requiredCount ?? 0}</strong></div>
                  </div>
                </section>

                <section style={cardStyle}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Tệp đính kèm</div>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {(selectedTopic.defenseDocuments ?? []).length > 0 ? (
                      selectedTopic.defenseDocuments!.map((doc, index) => (
                        <div key={`${String(doc.documentId ?? index)}`} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>{String(doc.fileName ?? doc.documentType ?? "File")}</div>
                          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{String(doc.mimeType ?? "-")}</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: 13, color: "#475569" }}>Chưa có tệp đính kèm.</div>
                    )}
                  </div>
                </section>
              </div>

              <section style={cardStyle}>
                <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Bảng điểm thành phần</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10, marginTop: 12 }}>
                  {[
                    { label: "GVHD", value: getLockedScoreValue(selectedTopic, selectedTopic.scoreGvhd ?? selectedTopic.topicSupervisorScore) },
                    { label: "CT", value: getLockedScoreValue(selectedTopic, selectedTopic.scoreCt) },
                    { label: "TK", value: getLockedScoreValue(selectedTopic, selectedTopic.scoreTk) },
                    { label: "PB", value: getLockedScoreValue(selectedTopic, selectedTopic.scorePb) },
                    { label: "Tổng", value: getLockedScoreValue(selectedTopic, selectedTopic.finalScore ?? selectedTopic.currentScore) },
                  ].map((item) => (
                    <div key={item.label} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, background: "#ffffff" }}>
                      <div style={{ fontSize: 11, textTransform: "uppercase", color: "#475569", fontWeight: 700 }}>{item.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: DEEP_BLUE_PRIMARY, marginTop: 6 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </section>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => downloadCommitteeReport(selectedCommittee ?? { code: String(selectedTopic.committeeCode ?? "-"), name: "-", room: "-", chair: "-", secretary: "-", reviewer: "-", totalTopics: 0, scoredTopics: 0, lockedTopics: 0, status: "ONGOING", currentTopic: "-", currentStudent: "-", progressPercent: 0, estimatedCompletion: "-", delayLabel: "On time", key: String(selectedTopic.committeeCode ?? "-") }, "minutes", "pdf")} style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}>Tải biên bản</button>
                <button type="button" onClick={() => downloadCommitteeReport(selectedCommittee ?? { code: String(selectedTopic.committeeCode ?? "-"), name: "-", room: "-", chair: "-", secretary: "-", reviewer: "-", totalTopics: 0, scoredTopics: 0, lockedTopics: 0, status: "ONGOING", currentTopic: "-", currentStudent: "-", progressPercent: 0, estimatedCompletion: "-", delayLabel: "On time", key: String(selectedTopic.committeeCode ?? "-") }, "review", "pdf")} style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}>Tải nhận xét</button>
                <button type="button" onClick={() => setTopicDetailModalOpen(false)} style={{ border: "none", background: DEEP_BLUE_PRIMARY, color: "#ffffff", padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}>Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CommitteeOperationsManagement;
