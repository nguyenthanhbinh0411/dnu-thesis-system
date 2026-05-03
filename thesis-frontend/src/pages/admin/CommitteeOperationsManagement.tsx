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
  MessageSquare,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Table,
  Trash2,
  Unlock,
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
type ReportType = "council-summary" | "form-1" | "final-term" | "sync-errors";
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
  pipeline?: PipelineOverview;
  period?: Record<string, unknown>;
  analytics?: {
    overview?: AnalyticsOverview;
    byCouncil?: Array<Record<string, unknown>>;
    distribution?: DistributionOverview;
  };
  scoring?: {
    progress?: Array<Record<string, unknown>>;
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
  finalScore?: number;
  finalGrade?: string;
  variance?: number;
  status?: string;
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

const statusToneMap: Record<string, ToneStyle> = {
  APPROVED: { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  PENDING: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
  REJECTED: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
  LOCKED: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  IN_PROGRESS: { bg: "#fff7ed", border: "#fed7aa", text: "#c2410c" },
  DRAFT: { bg: "#f8fafc", border: "#cbd5e1", text: "#475569" },
  READY: { bg: "#111827", border: "#111827", text: "#ffffff" },
  FINALIZED: { bg: "#fff7ed", border: "#fed7aa", text: "#c2410c" },
  PUBLISHED: { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  ARCHIVED: { bg: "#f8fafc", border: "#cbd5e1", text: "#475569" },
  WARNING: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
};

const statusLabelMap: Record<string, string> = {
  APPROVED: "Đã duyệt",
  PENDING: "Chờ xử lý",
  REJECTED: "Từ chối",
  LOCKED: "Đã khóa",
  IN_PROGRESS: "Đang xử lý",
  DRAFT: "Nháp",
  READY: "Ready",
  FINALIZED: "Đã chốt",
  PUBLISHED: "Đã công bố",
  ARCHIVED: "Đã lưu trữ",
  WARNING: "Cảnh báo",
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

const toText = (value: unknown, fallback = "-") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const pickText = (record: Record<string, unknown> | null | undefined, keys: string[], fallback = "-") => {
  if (!record) {
    return fallback;
  }

  for (const key of keys) {
    const value = record[key];
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
    const value = Number(record[key]);
    if (Number.isFinite(value)) {
      return value;
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
    value: "form-1",
    label: "Form-1",
    description: "Xuất theo một hội đồng cụ thể khi cần kiểm tra chi tiết.",
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
  const [revisionStatus, setRevisionStatus] = useState<RevisionStatus>("all");
  const [revisionKeyword, setRevisionKeyword] = useState("");
  const [revisionPage, setRevisionPage] = useState(1);
  const [revisionSize, setRevisionSize] = useState(20);
  const [auditSize, setAuditSize] = useState(50);

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
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [previewModalType, setPreviewModalType] = useState<PreviewModalType | null>(null);
  const [activePanel, setActivePanel] =
    useState<OperationsPanelKey>("snapshot");

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

    if (reportType === "form-1" && !reportCouncilId.trim()) {
      notifyError("Báo cáo form-1 bắt buộc nhập councilId.");
      return;
    }

    const params = new URLSearchParams({
      reportType,
      format: reportFormat,
    });
    if (reportType === "form-1") {
      params.set("councilId", reportCouncilId.trim());
    }

    window.open(
      `${defensePeriodBase}/reports/export?${params.toString()}`,
      "_blank",
      "noopener,noreferrer",
    );
    notifyInfo("Đã gửi yêu cầu mở file báo cáo.");
    setExportModalOpen(false);
  };

  const pipeline = snapshot?.monitoring?.pipeline;
  const analytics = snapshot?.monitoring?.analytics;
  const scoringMatrix = snapshot?.scoringMatrix ?? [];
  const postDefense = snapshot?.postDefense;
  const audit = snapshot?.audit;

  const distributionRows = useMemo(() => {
    const distribution = analytics?.distribution;
    return [
      { label: "A", value: Number(distribution?.excellent ?? 0) },
      { label: "B", value: Number(distribution?.good ?? 0) },
      { label: "C", value: Number(distribution?.fair ?? 0) },
      { label: "D", value: Number(distribution?.weak ?? 0) },
      { label: "F", value: 0 },
    ];
  }, [analytics?.distribution]);

  const distributionTotal = useMemo(
    () => distributionRows.reduce((sum, item) => sum + item.value, 0),
    [distributionRows],
  );

  const distributionPeak = useMemo(
    () => Math.max(1, ...distributionRows.map((item) => item.value)),
    [distributionRows],
  );

  const committeeOperationalRows = useMemo(() => {
    const councilRecords = Array.isArray(analytics?.byCouncil) ? analytics.byCouncil : [];

    if (councilRecords.length > 0) {
      return councilRecords.map((item, index) => {
        const record = toRecord(item);
        const totalTopics = pickNumber(record, ["totalTopics", "topicCount", "assignmentCount", "total"], 0);
        const scoredTopics = pickNumber(record, ["scoredTopics", "completedTopics", "scored", "doneTopics"], 0);
        const lockedTopics = pickNumber(record, ["lockedTopics", "locked", "publishedTopics"], 0);

        return {
          key: toText(pickText(record, ["committeeCode", "committeeId", "code", "id"], `HĐ ${index + 1}`)),
          code: pickText(record, ["committeeCode", "code", "id"], `HĐ ${index + 1}`),
          name: pickText(record, ["committeeName", "name", "title"], `Hội đồng ${index + 1}`),
          room: pickText(record, ["room", "roomName", "location"], "-"),
          chair: pickText(record, ["chair", "chairName", "president", "chairman"], "-"),
          secretary: pickText(record, ["secretary", "secretaryName", "clerk"], "-"),
          reviewer: pickText(record, ["reviewer", "reviewerName", "critic"], "-"),
          totalTopics,
          scoredTopics,
          lockedTopics,
          status: pickText(record, ["status", "state"], scoredTopics >= totalTopics && totalTopics > 0 ? "Completed" : "Ongoing"),
        };
      });
    }

    const grouped = new Map<
      string,
      {
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
      }
    >();

    scoringMatrix.forEach((row, index) => {
      const code = toText(row.committeeCode, `HĐ-${index + 1}`);
      const key = code.toUpperCase();
      const current = grouped.get(key) ?? {
        key,
        code,
        name: toText(row.committeeName, code),
        room: "-",
        chair: "-",
        secretary: "-",
        reviewer: "-",
        totalTopics: 0,
        scoredTopics: 0,
        lockedTopics: 0,
        status: "Ongoing",
      };

      current.totalTopics += 1;
      if (row.finalScore != null && Number(row.finalScore) > 0) {
        current.scoredTopics += 1;
      }
      if (row.isLocked) {
        current.lockedTopics += 1;
      }
      grouped.set(key, current);
    });

    return Array.from(grouped.values());
  }, [analytics?.byCouncil, scoringMatrix]);

  const dashboardMetrics = useMemo(() => {
    const totalTopics = pipeline?.totalTopics ?? scoringMatrix.length;
    const scoredTopics = pipeline?.scoredTopics ?? scoringMatrix.filter((row) => row.finalScore != null && Number(row.finalScore) > 0).length;
    const activeCouncils = committeeOperationalRows.filter((row) => row.status !== "Completed" && row.status !== "Locked").length;
    const pendingTopics = Math.max(0, totalTopics - scoredTopics);
    const waitingTopics = scoringMatrix.filter((row) => !row.submittedCount || Number(row.submittedCount) === 0).length;
    const warnings = (postDefense?.items ?? []).filter((item) => String(item.status ?? "").toLowerCase() !== "approved").length;
    const completionRate = totalTopics > 0 ? Math.round((scoredTopics / totalTopics) * 100) : 0;

    return {
      totalCouncils: committeeOperationalRows.length,
      totalTopics,
      scoredTopics,
      pendingTopics,
      waitingTopics,
      activeCouncils,
      warnings,
      completionRate,
    };
  }, [committeeOperationalRows, pipeline?.scoredTopics, pipeline?.totalTopics, postDefense?.items, scoringMatrix]);

  const topTopic = useMemo(
    () => scoringMatrix.filter((row) => row.finalScore != null && Number(row.finalScore) > 0).sort((left, right) => Number(right.finalScore) - Number(left.finalScore))[0] ?? null,
    [scoringMatrix],
  );

  const lowTopic = useMemo(
    () => scoringMatrix.filter((row) => row.finalScore != null && Number(row.finalScore) > 0).sort((left, right) => Number(left.finalScore) - Number(right.finalScore))[0] ?? null,
    [scoringMatrix],
  );

  const keyAlerts = useMemo(() => {
    return [
      ...scoringMatrix.filter((row) => row.finalScore == null || Number(row.finalScore) <= 0).slice(0, 3).map((row) => ({
        label: "Đề tài chưa đủ điểm",
        title: row.topicTitle ?? "-",
        detail: `${row.studentCode ?? "-"} · ${row.studentName ?? "-"}`,
        committee: row.committeeCode ?? "-",
      })),
      ...scoringMatrix.filter((row) => row.isLocked !== true && Number(row.submittedCount ?? 0) >= Number(row.requiredCount ?? 0) && Number(row.requiredCount ?? 0) > 0).slice(0, 3).map((row) => ({
        label: "Chưa khóa ca",
        title: row.topicTitle ?? "-",
        detail: `${row.committeeCode ?? "-"}`,
        committee: row.committeeCode ?? "-",
      })),
      ...scoringMatrix.filter((row) => row.variance != null && Math.abs(Number(row.variance)) >= 2).slice(0, 3).map((row) => ({
        label: "Điểm lệch bất thường",
        title: row.topicTitle ?? "-",
        detail: `Độ lệch ${row.variance}`,
        committee: row.committeeCode ?? "-",
      })),
    ].slice(0, 6);
  }, [scoringMatrix]);

  const periodInfo = useMemo(() => {
    const record = toRecord(snapshot?.monitoring?.period ?? snapshot?.monitoring?.tags ?? null);
    const startDateText = pickText(record, ["startDate", "StartDate", "startedAt", "StartedAt"], "-");
    const endDateText = pickText(record, ["endDate", "EndDate", "endedAt", "EndedAt"], "-");
    const statusValue = pickText(record, ["status", "Status", "state", "State"], pipeline?.overallCompletionPercent && pipeline.overallCompletionPercent >= 100 ? "Published" : "In progress");

    const daysRemaining = (() => {
      const rawEnd = String(endDateText ?? "").trim();
      const parsed = rawEnd && rawEnd !== "-" ? new Date(rawEnd) : null;
      if (!parsed || Number.isNaN(parsed.getTime())) {
        return null;
      }
      const diff = Math.ceil((parsed.getTime() - Date.now()) / 86400000);
      return diff;
    })();

    return {
      name: pickText(record, ["name", "Name", "title", "Title"], periodId ? `Đợt ${periodId}` : "Chưa xác định"),
      status: statusValue,
      startDate: startDateText,
      endDate: endDateText,
      daysRemaining,
    };
  }, [periodId, pipeline?.overallCompletionPercent, snapshot?.monitoring?.period, snapshot?.monitoring?.tags]);

  const visibleCommitteeRows = useMemo(() => {
    const query = committeeIdFilter.trim().toUpperCase();
    if (!query) {
      return committeeOperationalRows;
    }

    return committeeOperationalRows.filter((row) => {
      const haystack = `${row.code} ${row.name} ${row.room} ${row.chair} ${row.secretary} ${row.reviewer}`.toUpperCase();
      return haystack.includes(query);
    });
  }, [committeeIdFilter, committeeOperationalRows]);

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

  return (
    <div
      style={{
        maxWidth: 1360,
        margin: "0 auto",
        padding: 20,
        fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
      }}
    >
      <section
        style={{
          ...cardStyle,

          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#0f172a",
                fontWeight: 700,
              }}
            >
              FIT DNU · Điều hành chấm điểm
            </div>
            <h1
              style={{
                margin: "6px 0 0 0",
                fontSize: 26,
                lineHeight: 1.25,
                color: "#0f172a",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <Gavel size={22} color="#f37021" /> Điều hành chấm điểm - Hậu bảo vệ
            </h1>
            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                color: "#0f172a",
                lineHeight: 1.6,
              }}
            >
              Theo dõi scoring matrix, revision queue, audit trail và điều phối lifecycle hậu bảo vệ.
            </div>
          </div>

          <div
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: 12,
              background: "#ffffff",
              minWidth: 320,
            }}
          >
            <div style={{ fontSize: 11, color: "#0f172a", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
              Control Panel
            </div>
            <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {(() => {
                const statusTone = getStatusTone(periodInfo.status);
                return (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 700, border: `1px solid ${statusTone.border}`, background: statusTone.bg, color: statusTone.text }}>
                    {getStatusLabel(periodInfo.status)}
                  </span>
                );
              })()}
              <span style={{ fontSize: 12, color: "#0f172a" }}>
                {periodInfo.name}
              </span>
            </div>
            <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 12, color: "#0f172a" }}>
              <div>Bắt đầu: <strong>{periodInfo.startDate}</strong></div>
              <div>Kết thúc: <strong>{periodInfo.endDate}</strong></div>
              <div>Số ngày còn lại: <strong style={{ color: periodInfo.daysRemaining != null && periodInfo.daysRemaining <= 3 ? "#dc2626" : "#0f172a" }}>{periodInfo.daysRemaining != null ? `${periodInfo.daysRemaining} ngày` : "-"}</strong></div>
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => void loadOperationsSnapshot()}
                style={{ border: "none", background: "#f37021", color: "#ffffff", borderRadius: 10, minHeight: 36, padding: "0 12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}
              >
                <RefreshCw size={14} /> Refresh realtime
              </button>
              <button
                type="button"
                onClick={exportReport}
                style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 10, minHeight: 36, padding: "0 12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}
              >
                <Download size={14} /> Export nhanh
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#0f172a" }}>
              {loadingSnapshot ? "Đang tải dữ liệu..." : `Lần tải: ${lastLoadedAt || "Chưa có"}`}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: "#0f172a" }}>
              Action: {actionInFlight ?? "Idle"}
            </div>
          </div>
        </div>
      </section>

      {/* Module navigation buttons removed (Phân công / Điều hành) */}

      <section style={{ ...cardStyle, marginBottom: 14, borderColor: "#cbd5e1" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {panelTabs.map((tab) => {
            const isActive = activePanel === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActivePanel(tab.key)}
                style={{
                  border: `1px solid ${isActive ? "#f37021" : "#cbd5e1"}`,
                  borderRadius: 10,
                  background: "#ffffff",
                  color: isActive ? "#f37021" : "#0f172a",
                  minHeight: 38,
                  padding: "0 12px",
                  fontWeight: 700,
                  fontSize: 13,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  transition: "all .2s ease",
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ ...cardStyle, marginBottom: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
          }}
        >
          <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, background: "#ffffff" }}>
            <div style={{ fontSize: 11, color: "#0f172a", textTransform: "uppercase", fontWeight: 700 }}>Tổng hội đồng</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{formatNumber(dashboardMetrics.totalCouncils)}</div>
            <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
              <div style={{ width: "100%", height: "100%", background: "#f37021" }} />
            </div>
          </div>
          <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, background: "#ffffff" }}>
            <div style={{ fontSize: 11, color: "#0f172a", textTransform: "uppercase", fontWeight: 700 }}>Tổng đề tài</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{formatNumber(dashboardMetrics.totalTopics)}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Đang xử lý: {formatNumber(dashboardMetrics.pendingTopics)}</div>
          </div>
          <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, background: "#ffffff" }}>
            <div style={{ fontSize: 11, color: "#0f172a", textTransform: "uppercase", fontWeight: 700 }}>Đề tài đã chấm</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{formatNumber(dashboardMetrics.scoredTopics)}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{formatNumber(dashboardMetrics.completionRate)}% hoàn thành</div>
          </div>
          <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, background: "#ffffff" }}>
            <div style={{ fontSize: 11, color: "#0f172a", textTransform: "uppercase", fontWeight: 700 }}>Đang bảo vệ</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{formatNumber(dashboardMetrics.activeCouncils)}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Đang mở phiên hoặc còn xử lý</div>
          </div>
          <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, background: "#ffffff" }}>
            <div style={{ fontSize: 11, color: "#0f172a", textTransform: "uppercase", fontWeight: 700 }}>Chưa bắt đầu</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{formatNumber(dashboardMetrics.waitingTopics)}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Chưa submit lần nào</div>
          </div>
          <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, background: "#ffffff" }}>
            <div style={{ fontSize: 11, color: "#0f172a", textTransform: "uppercase", fontWeight: 700 }}>Tỷ lệ hoàn thành</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{formatNumber(dashboardMetrics.completionRate)}%</div>
            <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, dashboardMetrics.completionRate)}%`, height: "100%", background: dashboardMetrics.completionRate >= 80 ? "#16a34a" : dashboardMetrics.completionRate >= 50 ? "#f59e0b" : "#ef4444" }} />
            </div>
          </div>
          <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, background: "#ffffff" }}>
            <div style={{ fontSize: 11, color: "#0f172a", textTransform: "uppercase", fontWeight: 700 }}>Revision chờ</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{formatNumber(pipeline?.pendingRevisionCount)}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Cần kiểm tra / xác nhận</div>
          </div>
          <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, background: "#ffffff" }}>
            <div style={{ fontSize: 11, color: "#0f172a", textTransform: "uppercase", fontWeight: 700 }}>Cảnh báo</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{formatNumber(dashboardMetrics.warnings)}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Cần điều phối ngay</div>
          </div>
          <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, background: "#ffffff" }}>
            <div style={{ fontSize: 11, color: "#0f172a", textTransform: "uppercase", fontWeight: 700 }}>Điểm TB</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{formatNumber(analytics?.overview?.average)}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Tỷ lệ đạt: {formatNumber(analytics?.overview?.passRate)}%</div>
          </div>
        </div>
      </section>

      {!loadingSnapshot && !hasSnapshotContent && (
        <section style={{ ...emptyStateCardStyle, marginBottom: 16 }}>
          Chưa có dữ liệu để hiển thị.
        </section>
      )}

      {activePanel === "snapshot" && (
        <section style={{ ...cardStyle, marginBottom: 16 }}>
          <h2
            style={{
              marginTop: 0,
              fontSize: 17,
              color: "#0f172a",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Search size={16} color="#f37021" /> Bộ lọc snapshot vận hành
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 10,
            }}
          >
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600 }}>
                Committee ID
              </span>
              <input
                value={committeeIdFilter}
                onChange={(event) => setCommitteeIdFilter(event.target.value)}
                placeholder="Ví dụ: 3"
                style={{
                  minHeight: 36,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "0 10px",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600 }}>
                Revision status
              </span>
              <select
                value={revisionStatus}
                onChange={(event) =>
                  setRevisionStatus(event.target.value as RevisionStatus)
                }
                style={selectControlStyle}
              >
                <option value="all">all</option>
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600 }}>
                Từ khóa revision
              </span>
              <input
                value={revisionKeyword}
                onChange={(event) => setRevisionKeyword(event.target.value)}
                placeholder="MSSV / tên / đề tài"
                style={{
                  minHeight: 36,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "0 10px",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600 }}>
                Revision page
              </span>
              <input
                type="number"
                min={1}
                max={200}
                value={revisionPage}
                onChange={(event) =>
                  setRevisionPage(Number(event.target.value) || 1)
                }
                style={{
                  minHeight: 36,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "0 10px",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600 }}>
                Revision size
              </span>
              <input
                type="number"
                min={1}
                max={200}
                value={revisionSize}
                onChange={(event) =>
                  setRevisionSize(Number(event.target.value) || 20)
                }
                style={{
                  minHeight: 36,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "0 10px",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600 }}>
                Audit size
              </span>
              <input
                type="number"
                min={1}
                max={500}
                value={auditSize}
                onChange={(event) => setAuditSize(Number(event.target.value) || 50)}
                style={{
                  minHeight: 36,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "0 10px",
                }}
              />
            </label>
          </div>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={() => void loadOperationsSnapshot()}
              style={{
                border: "none",
                background: "#f37021",
                color: "#ffffff",
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
              <RefreshCw size={14} /> Tải snapshot
            </button>
            <span style={{ fontSize: 12, color: "#0f172a" }}>
              Áp dụng bộ lọc trước khi truy xuất snapshot để giảm tải dữ liệu.
            </span>
          </div>

          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(320px, 0.7fr)", gap: 16 }}>
            <section style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "#0f172a" }}>Khối điều hành hội đồng</h3>
                <span style={{ fontSize: 12, color: "#0f172a" }}>Bấm vào hội đồng để lọc nhanh</span>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {visibleCommitteeRows.slice(0, 8).map((row) => {
                  const totalTopics = Math.max(1, row.totalTopics);
                  const completion = Math.min(100, Math.round((row.scoredTopics / totalTopics) * 100));
                  const statusTone = getStatusTone(row.status);

                  return (
                    <div key={row.key} style={{ width: "100%" }}>
                      <button
                        type="button"
                        onClick={() => setCommitteeIdFilter(row.code)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          border: "1px solid #cbd5e1",
                          borderRadius: 12,
                          background: "#ffffff",
                          padding: 12,
                          cursor: "pointer",
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{row.code}</div>
                            <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{row.name}</div>
                          </div>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 700, border: `1px solid ${statusTone.border}`, background: statusTone.bg, color: statusTone.text }}>
                            {getStatusLabel(row.status)}
                          </span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, fontSize: 12, color: "#0f172a" }}>
                          <div>Phòng: <strong>{row.room}</strong></div>
                          <div>Chủ tịch: <strong>{row.chair}</strong></div>
                          <div>Thư ký: <strong>{row.secretary}</strong></div>
                          <div>Phản biện: <strong>{row.reviewer}</strong></div>
                        </div>

                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "#475569" }}>
                            <span>{row.scoredTopics}/{row.totalTopics} đề tài đã chấm</span>
                            <strong>{completion}%</strong>
                          </div>
                          <div style={{ height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                            <div style={{ width: `${completion}%`, height: "100%", background: completion >= 80 ? "#16a34a" : completion >= 50 ? "#f59e0b" : "#ef4444" }} />
                          </div>
                        </div>
                      </button>

                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCouncilRow(row);
                            setSelectedCouncilCode(String(row.code ?? "").toUpperCase());
                            // Try to extract numeric ID from code (e.g., "HĐ-1" or "1" -> 1)
                            const numericMatch = String(row.code ?? "").match(/\d+/);
                            if (numericMatch) {
                              setSelectedCouncilNumericId(Number(numericMatch[0]));
                            }
                            setScoringModalOpen(true);
                          }}
                          style={{
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            color: "#0f172a",
                            padding: "8px 12px",
                            borderRadius: 8,
                            fontSize: 13,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Eye size={14} /> Xem chấm điểm
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section style={{ display: "grid", gap: 16 }}>
              <section style={cardStyle}>
                <h3 style={{ marginTop: 0, fontSize: 16, color: "#0f172a" }}>Highlight nhanh</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, background: "#ffffff" }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Đề tài điểm cao nhất</div>
                    <div style={{ fontWeight: 700, marginTop: 6 }}>{topTopic?.topicTitle ?? "-"}</div>
                    <div style={{ fontSize: 12, color: "#475569" }}>{topTopic?.studentName ?? "-"} · {topTopic?.committeeCode ?? "-"}</div>
                    <div style={{ fontSize: 12, marginTop: 6 }}>Điểm: <strong>{topTopic?.finalScore ?? "-"}</strong>{topTopic?.finalGrade ? ` · ${topTopic.finalGrade}` : ""}</div>
                  </div>
                  <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10, background: "#ffffff" }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Đề tài điểm thấp nhất</div>
                    <div style={{ fontWeight: 700, marginTop: 6 }}>{lowTopic?.topicTitle ?? "-"}</div>
                    <div style={{ fontSize: 12, color: "#475569" }}>{lowTopic?.studentName ?? "-"} · {lowTopic?.committeeCode ?? "-"}</div>
                    <div style={{ fontSize: 12, marginTop: 6 }}>Điểm: <strong>{lowTopic?.finalScore ?? "-"}</strong>{lowTopic?.finalGrade ? ` · ${lowTopic.finalGrade}` : ""}</div>
                  </div>
                </div>
              </section>

              <section style={cardStyle}>
                <h3 style={{ marginTop: 0, fontSize: 16, color: "#0f172a" }}>Cảnh báo realtime</h3>
                <div style={{ display: "grid", gap: 8 }}>
                  {keyAlerts.length === 0 ? (
                    <div style={{ fontSize: 13, color: "#64748b" }}>Không có cảnh báo nổi bật.</div>
                  ) : keyAlerts.map((alert, index) => (
                    <button
                      key={`${alert.label}-${index}`}
                      type="button"
                      onClick={() => setCommitteeIdFilter(alert.committee)}
                      style={{
                        textAlign: "left",
                        border: "1px solid #fed7aa",
                        borderRadius: 10,
                        background: "#fff7ed",
                        padding: 10,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#c2410c" }}>{alert.label}</div>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>{alert.title}</div>
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>{alert.detail}</div>
                    </button>
                  ))}
                </div>
              </section>

              <section style={cardStyle}>
                <h3 style={{ marginTop: 0, fontSize: 16, color: "#0f172a" }}>Export center</h3>
                <div style={{ display: "grid", gap: 8, fontSize: 13, color: "#0f172a" }}>
                  <div>Loại xuất hiện tại: <strong>{reportTypeOptions.find((item) => item.value === reportType)?.label ?? reportType}</strong></div>
                  <div>Format hiện tại: <strong>{reportFormatOptions.find((item) => item.value === reportFormat)?.label ?? reportFormat}</strong></div>
                  <div>Hội đồng lọc nhanh: <strong>{reportCouncilId || committeeIdFilter || "Tất cả"}</strong></div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => setExportModalOpen(true)} style={{ border: "none", background: "#f37021", color: "#ffffff", borderRadius: 10, minHeight: 36, padding: "0 12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <Download size={14} /> Xuất file
                    </button>
                    <button type="button" onClick={() => setActivePanel("audit-report")} style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 10, minHeight: 36, padding: "0 12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <Activity size={14} /> Mở audit timeline
                    </button>
                  </div>
                </div>
              </section>
            </section>
          </div>
        </section>
      )}

      {activePanel === "lifecycle" && (
        <section style={{ ...cardStyle, marginBottom: 16 }}>
          <h2
            style={{
              marginTop: 0,
              fontSize: 17,
              color: "#0f172a",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Activity size={16} color="#f37021" /> Lifecycle hậu bảo vệ
          </h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void triggerLifecycle("PUBLISH")}
              disabled={Boolean(actionInFlight) || !canPublish}
              style={{
                border: "none",
                background: "#f37021",
                color: "#ffffff",
                borderRadius: 10,
                minHeight: 36,
                padding: "0 12px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: Boolean(actionInFlight) || !canPublish ? "not-allowed" : "pointer",
                opacity: Boolean(actionInFlight) || !canPublish ? 0.6 : 1,
              }}
            >
              <CheckCircle2 size={14} /> Publish điểm
            </button>
            <button
              type="button"
              onClick={() => void triggerLifecycle("ROLLBACK")}
              disabled={Boolean(actionInFlight) || !canRollback}
              style={{
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                borderRadius: 10,
                minHeight: 36,
                padding: "0 12px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: Boolean(actionInFlight) || !canRollback ? "not-allowed" : "pointer",
                opacity: Boolean(actionInFlight) || !canRollback ? 0.6 : 1,
              }}
            >
              <RotateCcw size={14} /> Rollback
            </button>
            <button
              type="button"
              onClick={() => void triggerLifecycle("ARCHIVE")}
              disabled={Boolean(actionInFlight) || !canArchive}
              style={{
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                borderRadius: 10,
                minHeight: 36,
                padding: "0 12px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: Boolean(actionInFlight) || !canArchive ? "not-allowed" : "pointer",
                opacity: Boolean(actionInFlight) || !canArchive ? 0.6 : 1,
              }}
            >
              <Archive size={14} /> Archive đợt
            </button>
            <button
              type="button"
              onClick={() => void triggerLifecycle("REOPEN")}
              disabled={Boolean(actionInFlight) || !canReopen}
              style={{
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                borderRadius: 10,
                minHeight: 36,
                padding: "0 12px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: Boolean(actionInFlight) || !canReopen ? "not-allowed" : "pointer",
                opacity: Boolean(actionInFlight) || !canReopen ? 0.6 : 1,
              }}
            >
              <Unlock size={14} /> Reopen
            </button>
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              color: "#0f172a",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              background: "#ffffff",
              padding: "8px 10px",
            }}
          >
            Khuyến nghị: luôn tải lại snapshot sau mỗi lifecycle để đối soát trạng thái mới nhất.
          </div>
        </section>
      )}

      {activePanel === "scoring" && (
        <section style={{ ...cardStyle, marginBottom: 16 }}>
          <h2
            style={{
              marginTop: 0,
              fontSize: 17,
              color: "#0f172a",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <BarChart3 size={16} color="#f37021" /> Scoring matrix
          </h2>
          <div
            style={{
              overflowX: "auto",
              border: "1px solid #cbd5e1",
              borderRadius: 12,
            }}
          >
            <table
              style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
            >
              <thead>
                <tr>
                  <th style={tableHeadCellStyle}>
                    Hội đồng
                  </th>
                  <th style={tableHeadCellStyle}>
                    SV
                  </th>
                  <th style={tableHeadCellStyle}>
                    Đề tài
                  </th>
                  <th style={tableHeadCellStyle}>
                    Tiến độ
                  </th>
                  <th style={tableHeadCellStyle}>
                    Điểm
                  </th>
                  <th style={tableHeadCellStyle}>Trạng thái</th>
                  <th style={tableHeadCellStyle}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {scoringMatrix.map((row, index) => (
                  <tr key={`${row.assignmentId ?? index}-${row.studentCode ?? ""}`}>
                    <td style={tableCellStyle}>
                      {row.committeeCode ?? row.committeeId ?? "-"}
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: 700 }}>{row.studentCode ?? "-"}</div>
                      <div style={{ color: "#0f172a", fontSize: 12 }}>
                        {row.studentName ?? "-"}
                      </div>
                      <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                        Lớp: <strong>{row.className ?? "-"}</strong> · Khóa: <strong>{row.cohortCode ?? "-"}</strong>
                      </div>
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: 700 }}>{row.topicCode ?? "-"}</div>
                      <div style={{ color: "#0f172a", fontSize: 12 }}>
                        {row.topicTitle ?? "-"}
                      </div>
                      <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                        {row.startTime ?? "-"} · {row.endTime ?? "-"}
                      </div>
                    </td>
                    <td style={tableCellStyle}>
                      {formatNumber(row.submittedCount)}/
                      {formatNumber(row.requiredCount)}
                    </td>
                    <td style={tableCellStyle}>
                      {row.finalScore != null
                        ? `${row.finalScore} (${row.finalGrade ?? "-"})`
                        : "-"}
                    </td>
                    <td style={tableCellStyle}>
                      {(() => {
                        const statusValue = row.status ?? (row.isLocked ? "LOCKED" : "IN_PROGRESS");
                        const statusTone = getStatusTone(statusValue);
                        return (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              borderRadius: 999,
                              border: `1px solid ${statusTone.border}`,
                              background: statusTone.bg,
                              color: statusTone.text,
                              padding: "5px 10px",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {getStatusLabel(statusValue)}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button type="button" style={actionIconButtonStyle} title="Xem chi tiết">
                          <Eye size={14} />
                        </button>
                        <button type="button" style={actionIconButtonStyle} title="Chỉnh sửa">
                          <Pencil size={14} />
                        </button>
                        <button type="button" style={dangerActionIconButtonStyle} title="Xóa">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {scoringMatrix.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: 12,
                        textAlign: "center",
                        color: "#0f172a",
                      }}
                    >
                      Chưa có dữ liệu để hiển thị.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              marginTop: 14,
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              padding: 12,
              background: "#ffffff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#0f172a",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                }}
              >
                Phân bố chất lượng
              </div>
              <div style={{ fontSize: 12, color: "#0f172a" }}>
                Tổng số: {formatNumber(distributionTotal)}
              </div>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {distributionRows.map((item) => {
                const percent = Math.round((item.value / distributionPeak) * 100);
                const barColor = distributionPalette[item.label] ?? "#f37021";

                return (
                  <div key={item.label} style={{ display: "grid", gap: 6 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        fontSize: 13,
                        color: "#0f172a",
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{item.label}</span>
                      <strong>{formatNumber(item.value)}</strong>
                    </div>
                    <div
                      style={{
                        height: 10,
                        borderRadius: 999,
                        background: "#e2e8f0",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${percent}%`,
                          minWidth: item.value > 0 ? 8 : 0,
                          height: "100%",
                          background: barColor,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {activePanel === "post-defense" && (
        <section style={{ ...cardStyle, marginBottom: 16 }}>
          <h2
            style={{
              marginTop: 0,
              fontSize: 17,
              color: "#0f172a",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <FileSpreadsheet size={16} color="#f37021" /> Hậu bảo vệ - revision queue
          </h2>
          <div
            style={{ marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <div style={{ fontSize: 12, color: "#0f172a" }}>
              Total: {formatNumber(postDefense?.totalRevisions)}
            </div>
            <div style={{ fontSize: 12, color: "#f37021" }}>
              Pending: {formatNumber(postDefense?.pendingRevisions)}
            </div>
            <div style={{ fontSize: 12, color: "#0f172a" }}>
              Approved: {formatNumber(postDefense?.approvedRevisions)}
            </div>
            <div style={{ fontSize: 12, color: "#0f172a" }}>
              Rejected: {formatNumber(postDefense?.rejectedRevisions)}
            </div>
          </div>
          <div
            style={{
              overflowX: "auto",
              border: "1px solid #cbd5e1",
              borderRadius: 12,
            }}
          >
            <table
              style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
            >
              <thead>
                <tr>
                  <th style={tableHeadCellStyle}>
                    Revision
                  </th>
                  <th style={tableHeadCellStyle}>
                    Sinh viên
                  </th>
                  <th style={tableHeadCellStyle}>
                    Đề tài
                  </th>
                  <th style={tableHeadCellStyle}>
                    Trạng thái
                  </th>
                  <th style={tableHeadCellStyle}>
                    Thời gian
                  </th>
                  <th style={tableHeadCellStyle}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {(postDefense?.items ?? []).map((item, index) => (
                  <tr key={`${item.revisionId ?? index}-${item.assignmentId ?? ""}`}>
                    <td style={tableCellStyle}>
                      #{String(item.revisionId ?? "-")}
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: 700 }}>{item.studentCode ?? "-"}</div>
                      <div style={{ color: "#0f172a", fontSize: 12 }}>
                        {item.studentName ?? "-"}
                      </div>
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: 700 }}>{item.topicCode ?? "-"}</div>
                      <div style={{ color: "#0f172a", fontSize: 12 }}>
                        {item.topicTitle ?? "-"}
                      </div>
                    </td>
                    <td style={tableCellStyle}>
                      {(() => {
                        const statusValue = item.status ?? "PENDING";
                        const statusTone = getStatusTone(statusValue);
                        return (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              borderRadius: 999,
                              border: `1px solid ${statusTone.border}`,
                              background: statusTone.bg,
                              color: statusTone.text,
                              padding: "5px 10px",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {getStatusLabel(statusValue)}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={tableCellStyle}>
                      <div>{item.submittedAt ?? "-"}</div>
                      <div style={{ color: "#0f172a", fontSize: 12 }}>
                        Review: {item.reviewedAt ?? "-"}
                      </div>
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button type="button" style={actionIconButtonStyle} title="Xem chi tiết">
                          <Eye size={14} />
                        </button>
                        <button type="button" style={actionIconButtonStyle} title="Chỉnh sửa">
                          <Pencil size={14} />
                        </button>
                        <button type="button" style={dangerActionIconButtonStyle} title="Xóa">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(postDefense?.items ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: 12,
                        textAlign: "center",
                        color: "#0f172a",
                      }}
                    >
                      Chưa có dữ liệu để hiển thị.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activePanel === "audit-report" && (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          <section style={cardStyle}>
            <h2
              style={{
                marginTop: 0,
                fontSize: 17,
                color: "#0f172a",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Activity size={16} color="#f37021" /> Audit trail
            </h2>
            <div style={{ display: "grid", gap: 10 }}>
              {renderAuditRows(
                "Sync history",
                audit?.syncHistory ?? [],
                "timestamp",
                "action",
              )}
              {renderAuditRows(
                "Publish history",
                audit?.publishHistory ?? [],
                "publishedAt",
                "status",
              )}
              {renderAuditRows(
                "Council audit",
                audit?.councilAuditHistory ?? [],
                "action",
                "timestamp",
              )}
              {renderAuditRows(
                "Revision audit",
                audit?.revisionAuditTrail ?? [],
                "revisionId",
                "action",
              )}
            </div>
          </section>

          <section style={cardStyle}>
            <h2
              style={{
                marginTop: 0,
                fontSize: 17,
                color: "#0f172a",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Download size={16} color="#f37021" /> Xuất báo cáo
            </h2>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, color: "#0f172a", lineHeight: 1.5 }}>
                Bấm <strong>Xuất file</strong> để mở modal chọn định dạng và xem đầy đủ thông tin trước khi xuất.
              </div>
              <div style={{ display: "grid", gap: 6, fontSize: 13, color: "#0f172a" }}>
                <div>Loại đang chọn: <strong>{reportTypeOptions.find((item) => item.value === reportType)?.label ?? reportType}</strong></div>
                <div>Định dạng đang chọn: <strong>{reportFormatOptions.find((item) => item.value === reportFormat)?.label ?? reportFormat}</strong></div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setPreviewModalType("meeting")}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    padding: "8px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  <FileText size={14} style={{ marginRight: 4 }} /> Biên bản
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModalType("scoreSheet")}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    padding: "8px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  <Table size={14} style={{ marginRight: 4 }} /> Bảng điểm
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModalType("reviewer")}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    padding: "8px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  <MessageSquare size={14} style={{ marginRight: 4 }} /> Nhận xét
                </button>
              </div>
              <button
                type="button"
                onClick={() => setExportModalOpen(true)}
                style={{
                  border: "none",
                  background: "#f37021",
                  color: "#ffffff",
                  borderRadius: 10,
                  minHeight: 36,
                  padding: "0 12px",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                <Download size={14} /> Xuất file
              </button>
            </div>
          </section>
        </section>
      )}

      {previewModalType && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 4000,
            background: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
          onClick={() => setPreviewModalType(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              maxWidth: 800,
              maxHeight: "80vh",
              overflow: "auto",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>
                  {previewModalType === "meeting" && "Biên bản họp"}
                  {previewModalType === "scoreSheet" && "Bảng điểm chi tiết"}
                  {previewModalType === "reviewer" && "Nhận xét phản biện"}
                </h3>
                <button
                  type="button"
                  onClick={() => setPreviewModalType(null)}
                  style={{
                    border: "none",
                    background: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    fontSize: 20,
                  }}
                >
                  ×
                </button>
              </div>

              {previewModalType === "meeting" && (
                <div style={{ display: "grid", gap: 16 }}>
                  <div style={{ fontSize: 14, color: "#0f172a" }}>
                    <strong>Kỳ bảo vệ:</strong> {snapshot?.defenseTermId ?? "N/A"}
                  </div>
                  <div style={{ fontSize: 14, color: "#0f172a" }}>
                    <strong>Trạng thái:</strong> {pickText(snapshot?.state, ["status", "Status"], "N/A")}
                  </div>
                  <div style={{ fontSize: 14, color: "#0f172a" }}>
                    <strong>Tổng đề tài:</strong> {pipeline?.totalTopics ?? 0}
                  </div>
                  <div style={{ fontSize: 14, color: "#0f172a" }}>
                    <strong>Đề tài đã chấm:</strong> {pipeline?.scoredTopics ?? 0}
                  </div>
                  {/* Add more meeting details from snapshot */}
                </div>
              )}

              {previewModalType === "scoreSheet" && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={tableHeadCellStyle}>Mã đề tài</th>
                        <th style={tableHeadCellStyle}>Tên đề tài</th>
                        <th style={tableHeadCellStyle}>Sinh viên</th>
                        <th style={tableHeadCellStyle}>Điểm cuối</th>
                        <th style={tableHeadCellStyle}>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoringMatrix.slice(0, 20).map((row, index) => (
                        <tr key={index}>
                          <td style={tableCellStyle}>{row.topicCode ?? "-"}</td>
                          <td style={tableCellStyle}>{row.topicTitle ?? "-"}</td>
                          <td style={tableCellStyle}>{row.studentName ?? "-"}</td>
                          <td style={tableCellStyle}>{row.finalScore ?? "-"}</td>
                          <td style={tableCellStyle}>{row.status ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {previewModalType === "reviewer" && (
                <div style={{ display: "grid", gap: 16 }}>
                  {(postDefense?.items ?? []).slice(0, 10).map((item, index) => (
                    <div key={index} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 600 }}>
                        {item.topicTitle ?? "-"}
                      </div>
                      <div style={{ fontSize: 13, color: "#64748b" }}>
                        Sinh viên: {item.studentName ?? "-"} | Trạng thái: {item.status ?? "-"}
                      </div>
                      <div style={{ fontSize: 13, color: "#0f172a", marginTop: 8 }}>
                        {item.note ?? "Không có nhận xét"}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => setPreviewModalType(null)}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    padding: "8px 16px",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // TODO: Implement download for the specific type
                    notifyInfo("Tính năng tải file sẽ được triển khai.");
                  }}
                  style={{
                    border: "none",
                    background: "#f37021",
                    color: "#ffffff",
                    padding: "8px 16px",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  <Download size={14} style={{ marginRight: 4 }} /> Tải file
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {scoringModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 4200,
            background: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
          onClick={() => setScoringModalOpen(false)}
        >
          <div
            style={{
              width: "min(1080px, calc(100vw - 24px))",
              maxHeight: "calc(100vh - 36px)",
              overflowY: "auto",
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              boxShadow: "0 20px 40px rgba(2, 6, 23, 0.12)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Danh sách đề tài - {toText(selectedCouncilRow?.code, String(selectedCouncilCode ?? "Hội đồng"))}</div>
                  <div style={{ fontSize: 14, color: "#475569" }}>{toText(selectedCouncilRow?.name, "-")} · Phòng: {toText(selectedCouncilRow?.room, "-")}</div>
                </div>
                <button type="button" onClick={() => setScoringModalOpen(false)} style={{ border: "none", background: "none", fontSize: 20, color: "#64748b", cursor: "pointer" }}>×</button>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={tableHeadCellStyle}>Mã đề tài</th>
                      <th style={tableHeadCellStyle}>Tên đề tài</th>
                      <th style={tableHeadCellStyle}>Sinh viên</th>
                      <th style={tableHeadCellStyle}>Lớp</th>
                      <th style={tableHeadCellStyle}>Điểm</th>
                      <th style={tableHeadCellStyle}>Trạng thái</th>
                      <th style={tableHeadCellStyle}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = scoringMatrix.filter((r) => {
                        if (!selectedCouncilCode && !selectedCouncilNumericId) return false;
                        // Try matching by committee code (string)
                        const code = String(r.committeeCode ?? r.committeeName ?? "").toUpperCase().trim();
                        const selectedNorm = String(selectedCouncilCode ?? "").toUpperCase().trim();
                        // Extract numeric parts and compare
                        const codeNumeric = code.replace(/[^\d]/g, "");
                        const selectedNumeric = String(selectedCouncilNumericId ?? "");
                        
                        // Match by code contains, exact code, or numeric ID
                        const matchByCode = selectedNorm && (code.includes(selectedNorm) || code === selectedNorm);
                        const matchByNumeric = selectedNumeric && codeNumeric === selectedNumeric;
                        
                        return matchByCode || matchByNumeric;
                      }).sort((a, b) => String(a.topicCode ?? "").localeCompare(String(b.topicCode ?? "")));
                      
                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} style={{ ...tableCellStyle, textAlign: "center", color: "#64748b" }}>
                              ⚠️ Chưa có dữ liệu tương ứng. (Code: {selectedCouncilCode} | ID: {selectedCouncilNumericId} | Total rows: {scoringMatrix.length})
                            </td>
                          </tr>
                        );
                      }
                      
                      return filtered.map((r, idx) => (
                        <tr key={idx}>
                          <td style={tableCellStyle}>{r.topicCode ?? "-"}</td>
                          <td style={tableCellStyle}>{r.topicTitle ?? "-"}</td>
                          <td style={tableCellStyle}>{r.studentName ?? "-"}</td>
                          <td style={tableCellStyle}>{r.className ?? "-"}</td>
                          <td style={tableCellStyle}>{r.finalScore ?? "-"}</td>
                          <td style={tableCellStyle}>{r.status ?? "-"}</td>
                          <td style={tableCellStyle}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTopic(r);
                                setTopicDetailModalOpen(true);
                              }}
                              style={{ border: "1px solid #cbd5e1", background: "#ffffff", padding: "6px 10px", borderRadius: 8, cursor: "pointer" }}
                            >
                              Xem chi tiết
                            </button>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <button type="button" onClick={() => setScoringModalOpen(false)} style={{ border: "1px solid #cbd5e1", background: "#ffffff", padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}>Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {topicDetailModalOpen && selectedTopic && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 4300, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}
          onClick={() => setTopicDetailModalOpen(false)}
        >
          <div style={{ width: "min(820px, calc(100vw - 24px))", borderRadius: 12, background: "#ffffff", border: "1px solid #cbd5e1", padding: 18 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{selectedTopic.topicTitle ?? "-"}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{selectedTopic.topicCode ?? "-"} · {selectedTopic.committeeCode ?? "-"}</div>
              </div>
              <button type="button" onClick={() => setTopicDetailModalOpen(false)} style={{ border: "none", background: "none", fontSize: 20, color: "#64748b", cursor: "pointer" }}>×</button>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div><strong>Sinh viên:</strong> {selectedTopic.studentName ?? "-"} ({selectedTopic.studentCode ?? "-"})</div>
              <div><strong>Lớp / Cohort:</strong> {selectedTopic.className ?? "-"} / {selectedTopic.cohortCode ?? "-"}</div>
              <div><strong>Điểm:</strong> {selectedTopic.finalScore ?? "-"} {selectedTopic.finalGrade ? `· ${selectedTopic.finalGrade}` : ""}</div>
              <div><strong>Trạng thái:</strong> {selectedTopic.status ?? "-"} {selectedTopic.isLocked ? "· Locked" : ""}</div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                <strong>Chi tiết row:</strong>
              </div>
              <pre style={{ background: "#f8fafc", padding: 12, borderRadius: 8, overflowX: "auto", fontSize: 12 }}>{JSON.stringify(selectedTopic, null, 2)}</pre>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => setTopicDetailModalOpen(false)} style={{ border: "1px solid #cbd5e1", background: "#ffffff", padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {exportModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 4000,
            background: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
          onClick={() => setExportModalOpen(false)}
        >
          <div
            style={{
              width: "min(1040px, calc(100vw - 24px))",
              maxHeight: "calc(100vh - 36px)",
              overflowY: "auto",
              borderRadius: 16,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              boxShadow: "0 24px 60px rgba(2, 6, 23, 0.28)",
              padding: 18,
              display: "grid",
              gap: 14,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>
                  Export center
                </div>
                <h2 style={{ margin: "6px 0 0 0", fontSize: 22, color: "#0f172a" }}>
                  Chọn định dạng và xem toàn bộ thông tin trước khi xuất
                </h2>
                <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>
                  Modal này hiển thị cấu hình xuất, phạm vi dữ liệu và định dạng đầu ra để người vận hành kiểm tra trước khi mở file.
                </div>
              </div>
              <button type="button" className="lec-ghost" onClick={() => setExportModalOpen(false)}>
                Đóng
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 12, background: "#ffffff" }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Đợt bảo vệ</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{periodInfo.name}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Trạng thái: {getStatusLabel(periodInfo.status)}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Bắt đầu: {periodInfo.startDate}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Kết thúc: {periodInfo.endDate}</div>
              </div>
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 12, background: "#ffffff" }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Phạm vi xuất</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{reportTypeOptions.find((item) => item.value === reportType)?.label ?? reportType}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{reportTypeOptions.find((item) => item.value === reportType)?.description ?? ""}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Hội đồng lọc nhanh: <strong>{reportCouncilId || committeeIdFilter || "Tất cả"}</strong></div>
              </div>
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 12, background: "#ffffff" }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Thông tin đầu ra</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{reportFormatOptions.find((item) => item.value === reportFormat)?.label ?? reportFormat}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{reportFormatOptions.find((item) => item.value === reportFormat)?.description ?? ""}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Dạng mở file hiện tại: <strong>{reportFormat.toUpperCase()}</strong></div>
              </div>
            </div>

            <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 12, background: "#ffffff" }}>
              <div style={{ fontSize: 12, color: "#0f172a", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>Chọn định dạng xuất</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginTop: 10 }}>
                {reportFormatOptions.map((option) => {
                  const isActive = reportFormat === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setReportFormat(option.value)}
                      style={{
                        border: `1px solid ${isActive ? "#f37021" : "#cbd5e1"}`,
                        borderRadius: 12,
                        background: isActive ? "#fff7ed" : "#ffffff",
                        color: isActive ? "#9a3412" : "#0f172a",
                        padding: 12,
                        textAlign: "left",
                        cursor: "pointer",
                        display: "grid",
                        gap: 4,
                      }}
                    >
                      <span style={{ fontWeight: 800 }}>{option.label}</span>
                      <span style={{ fontSize: 11, lineHeight: 1.45, fontWeight: 500 }}>{option.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {reportType === "form-1" && (
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600 }}>Council ID (bắt buộc khi form-1)</span>
                <input
                  value={reportCouncilId}
                  onChange={(event) => setReportCouncilId(event.target.value)}
                  placeholder="Ví dụ: 3"
                  style={{ minHeight: 40, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 12px" }}
                />
              </label>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 12, color: "#475569" }}>
                Kiểm tra lại phạm vi, định dạng và thông tin đầu ra trước khi xuất file.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="lec-ghost" onClick={() => setExportModalOpen(false)}>
                  Hủy
                </button>
                <button type="button" className="lec-primary" onClick={exportReport}>
                  <Download size={14} /> Xuất file
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommitteeOperationsManagement;
