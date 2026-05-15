import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  Archive,
  Award,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Gavel,
  Hash,
  Lock,
  Maximize2,
  MessageSquare,
  Paperclip,
  Pencil,
  PieChart,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Star,
  Table,
  Trash2,
  TrendingUp,
  Unlock,
  User,
  Users,
  X,
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

type DistributionViewMode = "grade" | "score";

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
  scheduledAt?: string;
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
  revisionReason?: string;
  submissionDeadline?: string;
  secretaryComment?: string;
  documentCount?: number;
  supervisorLecturerCode?: string;
  supervisorOrganization?: string;
  sessionCode?: string;
  isPassed?: boolean;
};

type PostDefenseItem = {
  revisionId?: number;
  assignmentId?: number;
  committeeCode?: string;
  studentCode?: string;
  studentName?: string;
  proposerStudentName?: string;
  proposerStudentCode?: string;
  topicCode?: string;
  topicTitle?: string;
  status?: string;
  revisionStatus?: string;
  finalStatus?: string;
  submittedAt?: string;
  reviewedAt?: string;
  note?: string;
  revisionReason?: string;
  submissionDeadline?: string;
  reviewerName?: string;
  reviewer?: string;
  revisionFileUrl?: string;
  isPassed?: boolean;
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
type ExportScopeMode = "per-period" | "per-council" | "per-topic" | "free-config";
type ExportTemplateMode = "dashboard" | "scoring" | "post-defense" | "councils" | "topics" | "official-transcript" | "council-minutes" | "statistics" | "custom";

type ExportFieldOption = {
  key: string;
  label: string;
};

type ExportFieldGroup = {
  key: string;
  label: string;
  fields: ExportFieldOption[];
};

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
  avgScore?: number;
  defenseDate?: string;
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
  SUBMITTED: { bg: "#f0f9ff", border: "1px solid #bae6fd", text: "#0369a1" },
  REOPENED: { bg: "#fef2f2", border: "1px solid #fecaca", text: "#991b1b" },
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
  STUDENT_SUBMITTED: { bg: "#f0f9ff", border: "1px solid #bae6fd", text: "#0369a1" },
  WAITING_STUDENT: { bg: "#fff7ed", border: "1px solid #ffedd5", text: "#ea580c" },
  EXPIRED: { bg: "#f1f5f9", border: "1px solid #e2e8f0", text: "#64748b" },
  "2": { bg: "#f0f9ff", border: "1px solid #bae6fd", text: "#0369a1" },
  "1": { bg: "#fff7ed", border: "1px solid #ffedd5", text: "#ea580c" },
};

const statusLabelMap: Record<string, string> = {
  APPROVED: "Đã duyệt",
  SUBMITTED: "Đã nộp",
  REOPENED: "Đã mở lại",
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
  STUDENT_SUBMITTED: "Đã nộp lại",
  WAITING_STUDENT: "Chờ sinh viên",
  EXPIRED: "Quá hạn",
  "2": "Đã nộp lại",
  "1": "Chờ sinh viên",
  "3": "Đã duyệt",
  "4": "Từ chối",
  "5": "Quá hạn",
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

const exportScopeOptions: Array<{ value: ExportScopeMode; label: string }> = [
  { value: "per-period", label: "Toàn đợt đồ án tốt nghiệp" },
  { value: "per-council", label: "Theo hội đồng" },
  { value: "per-topic", label: "Theo đề tài" },
  { value: "free-config", label: "Theo sinh viên" },
];



const exportTemplateOptions: Array<{ value: ExportTemplateMode; label: string; description: string; icon: React.ReactNode }> = [
  {
    value: "dashboard",
    label: "Dashboard",
    description: "Báo cáo tổng hợp điều hành",
    icon: <BarChart3 size={16} />,
  },
  {
    value: "scoring",
    label: "Scoring Matrix",
    description: "Bảng điểm chi tiết bảo vệ",
    icon: <FileSpreadsheet size={16} />,
  },
  {
    value: "post-defense",
    label: "Post Defense",
    description: "Danh sách hậu bảo vệ",
    icon: <Archive size={16} />,
  },
  {
    value: "councils",
    label: "Council List",
    description: "Danh sách hội đồng bảo vệ",
    icon: <Users size={16} />,
  },
  {
    value: "topics",
    label: "Topic List",
    description: "Danh sách đề tài bảo vệ",
    icon: <Table size={16} />,
  },
  {
    value: "custom",
    label: "Xuất bảng điểm tùy chọn",
    description: "Tự cấu hình các trường cần xuất",
    icon: <Settings size={16} />,
  },
];

const exportFieldGroups: ExportFieldGroup[] = [
  {
    key: "student",
    label: "Sinh viên",
    fields: [
      { key: "StudentCode", label: "MSSV" },
      { key: "StudentName", label: "Họ tên" },
      { key: "ClassName", label: "Lớp" },
      { key: "CohortCode", label: "Khóa" },
    ],
  },
  {
    key: "topic",
    label: "Đề tài",
    fields: [
      { key: "TopicCode", label: "Mã đề tài" },
      { key: "TopicTitle", label: "Tên đề tài" },
      { key: "TopicTags", label: "Tag chuyên môn" },
      { key: "AssignmentCode", label: "Mã phân công" },
      { key: "AssignmentId", label: "ID Phân công" },
    ],
  },
  {
    key: "supervisor",
    label: "GVHD",
    fields: [
      { key: "SupervisorLecturerName", label: "Tên GVHD" },
      { key: "SupervisorLecturerCode", label: "Mã GVHD" },
      { key: "SupervisorOrganization", label: "Đơn vị GVHD" },
      { key: "ScoreGvhd", label: "Điểm GVHD" },
      { key: "CommentGvhd", label: "Nhận xét GVHD" },
    ],
  },
  {
    key: "committee",
    label: "Hội đồng",
    fields: [
      { key: "CommitteeCode", label: "Mã hội đồng" },
      { key: "CommitteeId", label: "ID Hội đồng" },
      { key: "CommitteeName", label: "Tên hội đồng" },
      { key: "CommitteeChairName", label: "Chủ tịch" },
      { key: "CommitteeChairCode", label: "Mã Chủ tịch" },
      { key: "CommitteeSecretaryName", label: "Thư ký" },
      { key: "CommitteeSecretaryCode", label: "Mã Thư ký" },
      { key: "CommitteeReviewerName", label: "Phản biện" },
      { key: "CommitteeReviewerCode", label: "Mã Phản biện" },
      { key: "Room", label: "Phòng" },
    ],
  },
  {
    key: "score",
    label: "Điểm",
    fields: [
      { key: "ScoreCt", label: "Điểm CT" },
      { key: "ScoreTk", label: "Điểm TK" },
      { key: "ScorePb", label: "Điểm PB" },
      { key: "ScoreGvhd", label: "Điểm GVHD" },
      { key: "Score", label: "Điểm tổng" },
      { key: "Grade", label: "Xếp loại" },
      { key: "Variance", label: "Độ lệch (Variance)" },
      { key: "CommentCt", label: "Nhận xét CT" },
      { key: "CommentTk", label: "Nhận xét TK" },
      { key: "CommentPb", label: "Nhận xét PB" },
      { key: "IsPassed", label: "Kết quả (Đạt/Không)" },
      { key: "FinalGrade", label: "Xếp loại (Text)" },
      { key: "FinalScore", label: "Điểm tổng (Text)" },
      { key: "TopicSupervisorScore", label: "Điểm HD nguyên bản" },
      { key: "VarianceStatus", label: "Trạng thái lệch điểm" },
      { key: "ResultStatus", label: "Trạng thái kết quả" },
    ],
  },
  {
    key: "time",
    label: "Thời gian",
    fields: [
      { key: "DefenseDate", label: "Ngày bảo vệ" },
      { key: "Session", label: "Buổi" },
      { key: "StartTime", label: "Giờ bắt đầu" },
      { key: "EndTime", label: "Giờ kết thúc" },
    ],
  },
  {
    key: "audit",
    label: "Audit / Trạng thái",
    fields: [
      { key: "Status", label: "Trạng thái" },
      { key: "IsLocked", label: "Đã khóa" },
      { key: "SubmittedCount", label: "Số đã nộp" },
      { key: "RequiredCount", label: "Số cần nộp" },
      { key: "RevisionReason", label: "Lý do nộp hậu" },
      { key: "SubmissionDeadline", label: "Hạn nộp hậu" },
      { key: "SecretaryComment", label: "Nhận xét thư ký" },
    ],
  },
  {
    key: "document",
    label: "Tài liệu",
    fields: [{ key: "DocumentCount", label: "Số tài liệu" }],
  },
  {
    key: "system",
    label: "Hệ thống",
    fields: [
      { key: "TopicId", label: "ID Đề tài" },
      { key: "SupervisorLecturerId", label: "ID GVHD" },
      { key: "IsOnline", label: "Trực tuyến" },
      { key: "MeetingUrl", label: "Link họp" },
      { key: "DefenseSessionCode", label: "Mã ca" },
    ],
  },
];

const exportTemplateFieldPresets: Record<ExportTemplateMode, string[]> = {
  dashboard: ["StudentCode", "StudentName", "TopicTitle", "CommitteeCode", "Status", "Score"],
  scoring: ["StudentCode", "StudentName", "TopicTitle", "CommitteeCode", "ScoreCt", "ScoreTk", "ScorePb", "ScoreGvhd", "Score", "Grade", "Variance"],
  "post-defense": [
    "StudentCode",
    "StudentName",
    "TopicTitle",
    "CommitteeCode",
    "RevisionReason",
    "SubmissionDeadline",
    "Status",
    "IsLocked",
  ],
  councils: ["CommitteeCode", "CommitteeChairName", "CommitteeSecretaryName", "CommitteeReviewerName", "Room"],
  topics: ["TopicCode", "TopicTitle", "StudentName", "CommitteeCode", "Status"],
  "official-transcript": [
    "StudentCode",
    "StudentName",
    "TopicTitle",
    "CommitteeCode",
    "ScoreCt",
    "ScoreTk",
    "ScorePb",
    "ScoreGvhd",
    "Score",
    "Grade",
  ],
  "council-minutes": [
    "StudentCode",
    "StudentName",
    "TopicTitle",
    "CommitteeChairName",
    "CommitteeSecretaryName",
    "CommitteeReviewerName",
    "ScoreCt",
    "ScoreTk",
    "ScorePb",
    "ScoreGvhd",
    "Grade",
    "Status",
  ],
  statistics: [
    "CommitteeCode",
    "StudentCode",
    "StudentName",
    "Score",
    "Grade",
    "Variance",
    "Status",
    "IsLocked",
  ],
  custom: ["StudentCode", "StudentName", "TopicTitle", "Score", "Grade"],
};

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

  // Handle D/M/YYYY or DD/MM/YYYY format
  if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/.test(text)) {
    const parts = text.split(/[\/-]/);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!Number.isNaN(d.getTime())) {
      return d;
    }
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
  "A+": "#16a34a",
  A: "#16a34a",
  "B+": "#22c55e",
  B: "#0ea5e9",
  "C+": "#f59e0b",
  C: "#f97316",
  "D+": "#ef4444",
  D: "#dc2626",
  F: "#991b1b",
  "9.0 - 10": "#16a34a",
  "8.5 - < 9.0": "#22c55e",
  "8.0 - < 8.5": "#84cc16",
  "7.0 - < 8.0": "#0ea5e9",
  "6.5 - < 7.0": "#f59e0b",
  "5.5 - < 6.5": "#f97316",
  "5.0 - < 5.5": "#ef4444",
  "4.0 - < 5.0": "#dc2626",
  "< 4.0": "#991b1b",
};

const GRADE_BANDS = [
  { label: "A+", min: 9.0, max: 10.0 },
  { label: "A", min: 8.5, max: 9.0 },
  { label: "B+", min: 8.0, max: 8.5 },
  { label: "B", min: 7.0, max: 8.0 },
  { label: "C+", min: 6.5, max: 7.0 },
  { label: "C", min: 5.5, max: 6.5 },
  { label: "D+", min: 5.0, max: 5.5 },
  { label: "D", min: 4.0, max: 5.0 },
  { label: "F", min: Number.NEGATIVE_INFINITY, max: 4.0 },
] as const;

const SCORE_BANDS = [
  { label: "9.0 - 10", min: 9.0, max: 10.0, inclusiveMax: true },
  { label: "8.5 - < 9.0", min: 8.5, max: 9.0 },
  { label: "8.0 - < 8.5", min: 8.0, max: 8.5 },
  { label: "7.0 - < 8.0", min: 7.0, max: 8.0 },
  { label: "6.5 - < 7.0", min: 6.5, max: 7.0 },
  { label: "5.5 - < 6.5", min: 5.5, max: 6.5 },
  { label: "5.0 - < 5.5", min: 5.0, max: 5.5 },
  { label: "4.0 - < 5.0", min: 4.0, max: 5.0 },
  { label: "< 4.0", min: Number.NEGATIVE_INFINITY, max: 4.0 },
] as const;

const getGradeFromScore = (score: number) => {
  if (!Number.isFinite(score)) {
    return "-";
  }
  if (score >= 9) return "A+";
  if (score >= 8.5) return "A";
  if (score >= 8) return "B+";
  if (score >= 7) return "B";
  if (score >= 6.5) return "C+";
  if (score >= 5.5) return "C";
  if (score >= 5) return "D+";
  if (score >= 4) return "D";
  return "F";
};

const getScoreBandLabel = (score: number): string => {
  if (!Number.isFinite(score)) {
    return "-";
  }

  if (score >= 9) return "9.0 - 10";
  if (score >= 8.5) return "8.5 - < 9.0";
  if (score >= 8) return "8.0 - < 8.5";
  if (score >= 7) return "7.0 - < 8.0";
  if (score >= 6.5) return "6.5 - < 7.0";
  if (score >= 5.5) return "5.5 - < 6.5";
  if (score >= 5) return "5.0 - < 5.5";
  if (score >= 4) return "4.0 - < 5.0";
  return "< 4.0";
};

const sortStudentRows = (
  rows: ScoringMatrixRow[],
  sortField: "studentCode" | "studentName" | "topicTitle" | "finalScore" | "committeeCode",
  sortDir: "asc" | "desc"
): ScoringMatrixRow[] => {
  const sorted = [...rows].sort((a, b) => {
    let aVal: any, bVal: any;
    
    if (sortField === "studentCode") {
      aVal = (a.studentCode || "").toLowerCase();
      bVal = (b.studentCode || "").toLowerCase();
    } else if (sortField === "studentName") {
      aVal = (a.studentName || "").toLowerCase();
      bVal = (b.studentName || "").toLowerCase();
    } else if (sortField === "topicTitle") {
      aVal = (a.topicTitle || "").toLowerCase();
      bVal = (b.topicTitle || "").toLowerCase();
    } else if (sortField === "finalScore") {
      aVal = Number(a.finalScore ?? a.currentScore ?? 0);
      bVal = Number(b.finalScore ?? b.currentScore ?? 0);
    } else if (sortField === "committeeCode") {
      aVal = (a.committeeCode || "").toLowerCase();
      bVal = (b.committeeCode || "").toLowerCase();
    }
    
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
  
  return sorted;
};

const buildDistributionRows = (
  rows: ScoringMatrixRow[],
  mode: DistributionViewMode,
) => {
  const buckets = mode === "grade" ? GRADE_BANDS.map((band) => ({ label: band.label, value: 0 })) : SCORE_BANDS.map((band) => ({ label: band.label, value: 0 }));

  rows.forEach((row) => {
    const score = Number(row.finalScore ?? row.currentScore ?? NaN);
    if (!Number.isFinite(score)) {
      return;
    }

    const label = mode === "grade" ? getGradeFromScore(score) : getScoreBandLabel(score);
    const bucket = buckets.find((item) => item.label === label);
    if (bucket) {
      bucket.value += 1;
    }
  });

  return buckets;
};

const toApiExportFormat = (format: ReportFormat | "word" | "pdf") => {
  if (format === "excel") return "xlsx";
  if (format === "word") return "docx";
  return format;
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
  const [isPassedFilter, setIsPassedFilter] = useState<string>("all");
  const [revisionKeyword, setRevisionKeyword] = useState("");
  const [revisionPage, setRevisionPage] = useState(1);
  const [revisionSize, setRevisionSize] = useState(20);
  const [auditSize, setAuditSize] = useState(50);
  const [auditKeyword, setAuditKeyword] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState<AuditActionFilter>("all");
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [commandBarHeight, setCommandBarHeight] = useState(0);
  const [committeeStatusOverrides, setCommitteeStatusOverrides] = useState<Record<string, string>>({});
  const [showScoringMatrix, setShowScoringMatrix] = useState(false);
  const [analyticsTopics, setAnalyticsTopics] = useState<ScoringMatrixRow[]>([]);
  const [analyticsDistribution, setAnalyticsDistribution] = useState<DistributionOverview | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [distributionViewMode, setDistributionViewMode] = useState<DistributionViewMode>("grade");
  const [distributionChartType, setDistributionChartType] = useState<"pie" | "bar" | "line">("pie");
  const [distributionChartMenuOpen, setDistributionChartMenuOpen] = useState(false);
  const [committeeStatsPage, setCommitteeStatsPage] = useState(1);
  const committeeStatsPageSize = 5;
  const distributionChartMenuRef = useRef<HTMLDivElement | null>(null);
  const exportDownloadMenuRef = useRef<HTMLDivElement | null>(null);

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
  const [exportScopeMode, setExportScopeMode] = useState<ExportScopeMode>("per-period");
  const [exportTemplateMode, setExportTemplateMode] = useState<ExportTemplateMode>("dashboard");
  const [exportFieldSearch, setExportFieldSearch] = useState("");
  const [exportTopicKeyword, setExportTopicKeyword] = useState("");
  const [exportSelectedFields, setExportSelectedFields] = useState<string[]>(() => exportTemplateFieldPresets["dashboard"]);
  const [exportIncludeLogo, setExportIncludeLogo] = useState(true);
  const [exportIncludeSignature, setExportIncludeSignature] = useState(true);
  const [exportPasswordProtect, setExportPasswordProtect] = useState(false);
  const [exportDownloadMenuOpen, setExportDownloadMenuOpen] = useState(false);
  const [exportOnlyLocked, setExportOnlyLocked] = useState(true);
  const [exportOnlyPublished, setExportOnlyPublished] = useState(true);
  const [exportIsPassed, setExportIsPassed] = useState<boolean | null>(null);
  const [exportExpandedGroups, setExportExpandedGroups] = useState<string[]>(() => exportFieldGroups.map((group) => group.key));
  const [committeeExportType, setCommitteeExportType] = useState<CommitteeExportType>("scoreboard");
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [previewModalType, setPreviewModalType] = useState<PreviewModalType | null>(null);
  const [isDownloadingPreviewFile, setIsDownloadingPreviewFile] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "analytics" | "committee" | "post-defense" | "audit">("overview");
  const [studentTableSortField, setStudentTableSortField] = useState<"studentCode" | "studentName" | "topicTitle" | "finalScore" | "committeeCode">("studentCode");
  const [studentTableSortDir, setStudentTableSortDir] = useState<"asc" | "desc">("asc");
  const [studentTableIsPassedFilter, setStudentTableIsPassedFilter] = useState<boolean | "all">("all");
  const [studentTablePage, setStudentTablePage] = useState(1);
  const studentTablePageSize = 10;
  const [hoveredDistributionLabel, setHoveredDistributionLabel] = useState<string | null>(null);
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
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        distributionChartMenuRef.current &&
        !distributionChartMenuRef.current.contains(event.target as Node)
      ) {
        setDistributionChartMenuOpen(false);
      }
    };

    if (distributionChartMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }

    return undefined;
  }, [distributionChartMenuOpen]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        exportDownloadMenuRef.current &&
        !exportDownloadMenuRef.current.contains(event.target as Node)
      ) {
        setExportDownloadMenuOpen(false);
      }
    };

    if (exportDownloadMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }

    return undefined;
  }, [exportDownloadMenuOpen]);

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

  const exportReport = (overrides?: { reportType?: ReportType; format?: ReportFormat; councilId?: string; template?: string }) => {
    if (!periodId) {
      notifyWarning("Chua chon dot bao ve. Vui long chon dot tai module Quan ly dot.");
      return;
    }

    let effectiveReportType: ReportType = overrides?.reportType ?? reportType;
    let effectiveCouncilId = (overrides?.councilId ?? reportCouncilId).trim();
    const effectiveFormat = overrides?.format ?? reportFormat;
    const effectiveTemplate = overrides?.template ?? exportTemplateMode;

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

    const apiFormat = toApiExportFormat(effectiveFormat);
    const extension = effectiveFormat === "pdf" ? "pdf" : effectiveFormat === "word" ? "docx" : effectiveFormat === "excel" ? "xlsx" : effectiveFormat === "zip" ? "zip" : "csv";
    const mimeType =
      effectiveFormat === "pdf"
        ? "application/pdf"
        : effectiveFormat === "word"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : effectiveFormat === "excel"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : effectiveFormat === "zip"
              ? "application/zip"
              : "text/csv;charset=utf-8";

    void (async () => {
      try {
        let data: ArrayBuffer;
        let fileName: string;

        const isModularTemplate = ["dashboard", "scoring", "post-defense", "councils", "topics", "custom"].includes(effectiveTemplate);

        if (activeTab === "audit" || (isModularTemplate && ["pdf", "excel", "xlsx", "csv"].includes(apiFormat))) {
          // Use the new modular export endpoint
          const params = new URLSearchParams();
          params.set("format", apiFormat);
          params.set("template", effectiveTemplate);
          if (exportIsPassed !== null) {
            params.set("isPassed", String(exportIsPassed));
          }
          if (effectiveCouncilId) {
            params.set("committeeId", effectiveCouncilId);
          }
          if (exportTopicKeyword) {
            params.set("revisionKeyword", exportTopicKeyword);
          }
          if (exportSelectedFields.length > 0) {
            exportSelectedFields.forEach(field => params.append("selectedFields", field));
          }

          const endpoint = `${defensePeriodBase}/operations/export?${params.toString()}`;
          data = await fetchData<ArrayBuffer>(endpoint, {
            method: "GET",
            skipAuthRedirect: true,
          });
          fileName = `${effectiveTemplate}_${Date.now()}.${extension}`;
        } else {
          // Use legacy report endpoint for Docx or specific forms
          if (["form-1", "scoreboard", "minutes", "review", "council-summary"].includes(effectiveReportType) && !effectiveCouncilId) {
            notifyError("Báo cáo hội đồng bắt buộc có councilId.");
            return;
          }

          const endpoint = `${defensePeriodBase}/reports/export`;
          data = await fetchData<ArrayBuffer>(endpoint, {
            method: "POST",
            skipAuthRedirect: true,
            body: {
              reportType: effectiveReportType,
              format: apiFormat,
              ...(effectiveCouncilId ? { councilId: Number(effectiveCouncilId) } : {}),
              ...(exportSelectedFields.length > 0 ? { selectedFields: exportSelectedFields } : {}),
            },
          });
          fileName = `${effectiveReportType}_${Date.now()}.${extension}`;
        }

        if (!data || data.byteLength === 0) {
          throw new Error("File export rỗng hoặc không hợp lệ.");
        }

        const blob = new Blob([data], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        notifySuccess("Tải file báo cáo thành công.");
        setExportModalOpen(false);
      } catch (error) {
        if (error instanceof FetchDataError && error.status === 401) {
          notifyError("Bạn chưa có quyền tải báo cáo hoặc phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại hoặc kiểm tra phân quyền.");
          return;
        }
        notifyError("Không thể tải file báo cáo. Vui lòng kiểm tra quyền truy cập hoặc đăng nhập lại.");
      }
    })();
  };

  const downloadCommitteeReport = async (committeeRow: CommitteeSummary, reportTypeValue: CommitteeExportType, format: ReportFormat) => {
    if (!periodId) {
      notifyWarning("Chua chon dot bao ve. Vui long chon dot tai module Quan ly dot.");
      return;
    }

    const councilId = selectedCommitteeRows.find((row) => row.committeeId != null)?.committeeId;
    if (councilId == null) {
      notifyError("Không tìm thấy councilId cho hội đồng hiện tại.");
      return;
    }

    const apiFormat = toApiExportFormat(format);
    const params = new URLSearchParams({
      reportType: reportTypeValue,
      format: apiFormat,
      councilId: String(councilId),
    });

    try {
      const endpoint = `${defensePeriodBase}/reports/export?${params.toString()}`;
      const data = await fetchData<ArrayBuffer>(endpoint, { method: "GET", skipAuthRedirect: true });
      
      if (!data || data.byteLength < 100) {
          throw new Error("Dữ liệu file không hợp lệ hoặc quá nhỏ.");
      }

      const blob = new Blob([data], { 
        type: format === "pdf" ? "application/pdf" : 
              format === "word" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
              format === "excel" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : 
              format === "zip" ? "application/zip" : "text/csv"
      });
      
      const extension = format === "pdf" ? "pdf" : format === "word" ? "docx" : format === "excel" ? "xlsx" : format === "zip" ? "zip" : "csv";
      const fileName = `${reportTypeValue}_${committeeRow.code}_${Date.now()}.${extension}`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      notifySuccess(`Tải file ${reportTypeValue} thành công.`);
    } catch (err: unknown) {
      console.error("Download error:", err);
      if (err instanceof FetchDataError && err.status === 401) {
        notifyError("Bạn chưa có quyền tải file hoặc phiên đăng nhập đã hết hạn. Vui lòng kiểm tra phân quyền.");
        return;
      }
      notifyError(`Không thể tải file ${reportTypeValue}. Vui lòng kiểm tra lại quyền truy cập hoặc kết nối mạng.`);
    }
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

      const reportType = template === "meeting" ? "minutes" : template === "reviewer" ? "review" : "scoreboard";
      const apiFormat = toApiExportFormat(format);
      const params = new URLSearchParams({
        reportType,
        format: apiFormat,
        councilId: String(councilId),
        ...(selectedTopic?.assignmentId ? { assignmentId: String(selectedTopic.assignmentId) } : {}),
        ...(selectedTopic?.studentCode ? { studentCode: selectedTopic.studentCode } : {}),
      });

      const endpoint = `${defensePeriodBase}/reports/export?${params.toString()}`;
      const data = await fetchData<ArrayBuffer>(endpoint, { method: "GET", skipAuthRedirect: true });
      
      if (!data || data.byteLength < 100) {
          throw new Error("Dữ liệu file không hợp lệ hoặc quá nhỏ.");
      }

      const blob = new Blob([data], { 
        type: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
      });
      
      const fileName = `${reportType}_${selectedTopic?.studentCode || "export"}_${Date.now()}.${format === "pdf" ? "pdf" : "docx"}`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      notifySuccess("Tải tài liệu thành công.");
    } catch (error) {
      console.error("Download error:", error);
      if (error instanceof FetchDataError && error.status === 401) {
        notifyError("Bạn chưa có quyền tải tài liệu hoặc phiên đăng nhập đã hết hạn. Vui lòng kiểm tra phân quyền.");
        return;
      }
      notifyError("Không thể tải tài liệu. Vui lòng kiểm tra lại quyền truy cập hoặc kết nối mạng.");
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

  const scoredRowsForDistribution = useMemo(
    () => scoringMatrix.filter((row) => Number.isFinite(Number(row.finalScore ?? row.currentScore ?? NaN))),
    [scoringMatrix],
  );

  const distributionRows = useMemo(
    () => buildDistributionRows(scoredRowsForDistribution, distributionViewMode),
    [distributionViewMode, scoredRowsForDistribution],
  );

  const distributionTotal = useMemo(
    () => distributionRows.reduce((sum, item) => sum + item.value, 0),
    [distributionRows],
  );

  const studentTableSortedData = useMemo(
    () => {
      let filtered = scoredRowsForDistribution;
      if (studentTableIsPassedFilter !== "all") {
        filtered = filtered.filter(row => {
          const effectivePassed = row.isPassed ?? (row.finalScore != null && Number(row.finalScore) >= 5.0);
          return effectivePassed === studentTableIsPassedFilter;
        });
      }
      return sortStudentRows(filtered, studentTableSortField, studentTableSortDir);
    },
    [scoredRowsForDistribution, studentTableIsPassedFilter, studentTableSortField, studentTableSortDir],
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
        avgScore,
        defenseDate: (() => {
          const raw = firstRow?.scheduledAt || firstRow?.startTime || pickText(analyticsRecord, ["startTime", "StartTime", "date", "DefenseDate", "defenseDate", "ngay", "ngayBaoVe"], "");
          const d = parseDateValue(raw);
          return d ? d.toLocaleDateString("vi-VN") : "-";
        })(),
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
    () => (scoringMatrix.filter((row) => row.finalScore != null && Number(row.finalScore) > 0).sort((left, right) => Number(right.finalScore) - Number(left.finalScore))[0] ?? null),
    [scoringMatrix],
  );

  const lowTopic = useMemo(
    () => (scoringMatrix.filter((row) => row.finalScore != null && Number(row.finalScore) > 0).sort((left, right) => Number(left.finalScore) - Number(right.finalScore))[0] ?? null),
    [scoringMatrix],
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
      highest: topTopic
        ? { label: "Điểm cao nhất", title: topTopic.studentName ?? "-", score: String(topTopic.finalScore ?? "-"), committee: `${topTopic.committeeCode ?? "-"} · Phòng ${topTopic.room ?? "-"}`, detail: `${topTopic.scheduledAt ? new Date(topTopic.scheduledAt).toLocaleDateString("vi-VN") : "-"} · ${topTopic.topicTitle ?? "-"}` }
        : null,
      lowest: lowTopic
        ? { label: "Điểm thấp nhất", title: lowTopic.studentName ?? "-", score: String(lowTopic.finalScore ?? "-"), committee: `${lowTopic.committeeCode ?? "-"} · Phòng ${lowTopic.room ?? "-"}`, detail: `${lowTopic.scheduledAt ? new Date(lowTopic.scheduledAt).toLocaleDateString("vi-VN") : "-"} · ${lowTopic.topicTitle ?? "-"}` }
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
    if (scoringMatrix.length === 0) {
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

    const results = Array.from(map.values())
      .map((item) => ({
        code: item.code,
        avgScore: item.count > 0 ? item.total / item.count : 0,
        avgVariance: item.varianceCount > 0 ? item.varianceTotal / item.varianceCount : 0,
        sample: item.count,
      }))
      .sort((left, right) => right.avgScore - left.avgScore);

    return results;
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
  const publishedAnalyticsTopics = useMemo(() => analyticsTopics, [analyticsTopics]);
  const publishedScoringRows = useMemo(() => scoringMatrix.filter((row) => (row.finalScore != null && Number(row.finalScore) > 0) || (row.currentScore != null && Number(row.currentScore) > 0)), [scoringMatrix]);

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

  const topHigh10 = useMemo(() => {
    const source = publishedAnalyticsTopics.length > 0 ? publishedAnalyticsTopics : publishedScoringRows;
    return source.slice().sort((a, b) => Number(b.finalScore ?? b.currentScore ?? 0) - Number(a.finalScore ?? a.currentScore ?? 0)).slice(0, 10);
  }, [publishedAnalyticsTopics, publishedScoringRows]);

  const topStudents = useMemo(() => {
    const source = publishedAnalyticsTopics.length > 0 ? publishedAnalyticsTopics : publishedScoringRows;
    return source.slice().sort((a, b) => Number(b.finalScore ?? b.currentScore ?? 0) - Number(a.finalScore ?? a.currentScore ?? 0)).slice(0, 5);
  }, [publishedAnalyticsTopics, publishedScoringRows]);

  const topLow10 = useMemo(() => {
    const source = publishedAnalyticsTopics.length > 0 ? publishedAnalyticsTopics : publishedScoringRows;
    return source.slice().sort((a, b) => Number(a.finalScore ?? a.currentScore ?? 0) - Number(b.finalScore ?? b.currentScore ?? 0)).slice(0, 10);
  }, [publishedAnalyticsTopics, publishedScoringRows]);

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

  const exportAllFields = useMemo(
    () => exportFieldGroups.flatMap((group) => group.fields),
    [],
  );

  const exportFieldLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    exportAllFields.forEach((field) => {
      map.set(field.key, field.label);
    });
    return map;
  }, [exportAllFields]);

  const exportResolvedReportType = useMemo<ReportType>(() => {
    if (exportTemplateMode === "council-minutes") {
      return "minutes";
    }
    if (exportTemplateMode === "statistics") {
      return exportScopeMode === "per-council" ? "scoreboard" : "final-term";
    }
    if (exportScopeMode === "per-council") {
      return "council-summary";
    }
    return "final-term";
  }, [exportScopeMode, exportTemplateMode]);

  const exportCouncilOptions = useMemo(() => {
    const rows = scoringMatrix.filter((row) => row.committeeId != null || row.committeeCode);
    const map = new Map<string, string>();
    rows.forEach((row) => {
      const key = row.committeeId != null ? String(row.committeeId) : String(row.committeeCode ?? "").trim();
      if (!key || map.has(key)) {
        return;
      }
      const label = row.committeeCode ? `${row.committeeCode}${row.committeeName ? ` - ${row.committeeName}` : ""}` : `Hội đồng ${key}`;
      map.set(key, label);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [scoringMatrix]);

  const exportFilteredGroups = useMemo(() => {
    const keyword = exportFieldSearch.trim().toLowerCase();
    if (!keyword) {
      return exportFieldGroups;
    }
    return exportFieldGroups
      .map((group) => ({
        ...group,
        fields: group.fields.filter((field) => field.label.toLowerCase().includes(keyword) || field.key.toLowerCase().includes(keyword)),
      }))
      .filter((group) => group.fields.length > 0);
  }, [exportFieldSearch]);

  const getExportFieldValue = useCallback(
    (row: ScoringMatrixRow, fieldKey: string, rowNumber: number) => {
      const scoreValue = Number(row.finalScore ?? row.currentScore ?? 0);
      const scoreText = Number.isFinite(scoreValue) && scoreValue > 0 ? scoreValue.toFixed(1) : "-";
      const startDate = parseDateValue(row.startTime);

      switch (fieldKey) {
        case "RowNumber":
          return rowNumber;
        case "StudentCode":
          return row.studentCode ?? "-";
        case "StudentName":
          return row.studentName ?? "-";
        case "ClassName":
          return row.className ?? "-";
        case "CohortCode":
          return row.cohortCode ?? "-";
        case "TopicCode":
          return row.topicCode ?? "-";
        case "TopicTitle":
          return row.topicTitle ?? "-";
        case "TopicTags":
          return "-";
        case "AssignmentCode":
          return row.assignmentCode ?? "-";
        case "SupervisorLecturerName":
          return row.supervisorLecturerName ?? row.supervisorName ?? "-";
        case "CommitteeCode":
          return row.committeeCode ?? "-";
        case "CommitteeChairName":
          return row.committeeChairName ?? row.chairName ?? row.chair ?? "-";
        case "CommitteeSecretaryName":
          return row.committeeSecretaryName ?? row.secretaryName ?? row.secretary ?? "-";
        case "CommitteeReviewerName":
          return row.committeeReviewerName ?? row.reviewerName ?? row.reviewer ?? "-";
        case "Room":
          return row.room ?? "-";
        case "ScoreCt":
          return row.scoreCt != null ? Number(row.scoreCt).toFixed(1) : "-";
        case "ScoreTk":
          return row.scoreTk != null ? Number(row.scoreTk).toFixed(1) : "-";
        case "ScorePb":
          return row.scorePb != null ? Number(row.scorePb).toFixed(1) : "-";
        case "ScoreGvhd":
          return row.scoreGvhd != null ? Number(row.scoreGvhd).toFixed(1) : "-";
        case "Score":
          return scoreText;
        case "Grade":
          return scoreText === "-" ? "-" : getGradeFromScore(scoreValue);
        case "Variance":
          return row.variance != null ? Number(row.variance).toFixed(1) : "-";
        case "DefenseDate":
          return startDate ? startDate.toLocaleDateString("vi-VN") : "-";
        case "Session":
          return startDate ? (startDate.getHours() < 12 ? "Sáng" : "Chiều") : "-";
        case "StartTime":
          return row.startTime ?? "-";
        case "EndTime":
          return row.endTime ?? "-";
        case "Status":
          return row.status ?? "-";
        case "IsLocked":
          return row.isLocked ? "Có" : "Không";
        case "SubmittedCount":
          return row.submittedCount ?? "-";
        case "RequiredCount":
          return row.requiredCount ?? "-";
        case "CommentGvhd":
          return row.commentGvhd ?? "-";
        case "DocumentCount":
          return row.defenseDocuments?.length ?? 0;
        case "RevisionReason":
          return row.revisionReason ?? "-";
        case "SubmissionDeadline":
          return row.submissionDeadline ? new Date(row.submissionDeadline).toLocaleDateString("vi-VN") : "-";
        case "SecretaryComment":
          return row.secretaryComment ?? "-";
        case "CommitteeId":
          return row.committeeId ?? "-";
        case "CommitteeName":
          return row.committeeName ?? "-";
        case "SupervisorLecturerCode":
          return row.supervisorLecturerCode ?? "-";
        case "SupervisorOrganization":
          return row.supervisorOrganization ?? "-";
        case "CommentCt":
          return row.commentCt ?? "-";
        case "CommentTk":
          return row.commentTk ?? "-";
        case "CommentPb":
          return row.commentPb ?? "-";
        case "AssignmentId":
          return row.assignmentId ?? "-";
        case "IsPassed":
          return scoreValue >= 5 ? "Đạt" : "Không đạt";
        case "FinalGrade":
          return row.finalGrade ?? "-";
        case "FinalScore":
          return row.finalScore != null ? Number(row.finalScore).toFixed(1) : "-";
        case "CommitteeChairCode":
          return row.committeeChairCode ?? "-";
        case "CommitteeSecretaryCode":
          return row.committeeSecretaryCode ?? "-";
        case "CommitteeReviewerCode":
          return row.committeeReviewerCode ?? "-";
        case "TopicSupervisorScore":
          return row.topicSupervisorScore != null ? Number(row.topicSupervisorScore).toFixed(1) : "-";
        case "VarianceStatus":
          return row.variance != null && row.variance >= 2 ? "Lệch cao" : "Bình thường";
        case "ResultStatus":
          return scoreValue >= 5 ? "PASSED" : "FAILED";
        case "TopicId":
          return row.topicCode ?? "-";
        case "SupervisorLecturerId":
          return row.supervisorLecturerCode ?? "-";
        case "IsOnline":
          return "Không";
        case "MeetingUrl":
          return "-";
        case "DefenseSessionCode":
          return row.sessionCode ?? "-";
        default:
          return "-";
      }
    },
    [],
  );

  const exportPreviewColumns = useMemo(() => {
    const selected = exportSelectedFields.slice(0, 3);
    if (selected.length > 0) {
      return selected;
    }
    return ["StudentCode", "StudentName", "Score"];
  }, [exportSelectedFields]);

  const exportPreviewRows = useMemo(() => {
    const topicKeyword = exportTopicKeyword.trim().toLowerCase();
    const rows = scoringMatrix
      .filter((row) => (exportOnlyLocked ? row.isLocked : true))
      .filter((row) => (exportOnlyPublished ? row.finalScore != null : true))
      .filter((row) => {
        if (exportScopeMode !== "per-council") {
          return true;
        }
        if (!reportCouncilId.trim()) {
          return true;
        }
        const councilId = String(row.committeeId ?? "").trim();
        const councilCode = String(row.committeeCode ?? "").trim().toLowerCase();
        const keyword = reportCouncilId.trim().toLowerCase();
        return councilId === reportCouncilId.trim() || councilCode.includes(keyword);
      })
      .filter((row) => {
        if (exportScopeMode !== "per-topic" || !topicKeyword) {
          return true;
        }
        const haystack = `${row.topicCode ?? ""} ${row.topicTitle ?? ""} ${row.studentCode ?? ""} ${row.studentName ?? ""}`.toLowerCase();
        return haystack.includes(topicKeyword);
      })
      .slice(0, 6);

    return rows.map((row, index) => ({
      key: `${row.assignmentId ?? row.studentCode ?? index}`,
      values: exportPreviewColumns.map((columnKey) => getExportFieldValue(row, columnKey, index + 1)),
    }));
  }, [
    exportOnlyLocked,
    exportOnlyPublished,
    exportPreviewColumns,
    exportScopeMode,
    exportTopicKeyword,
    getExportFieldValue,
    reportCouncilId,
    scoringMatrix,
  ]);

  const exportPreviewModalColumns = useMemo(() => {
    if (exportSelectedFields.length > 0) {
      return exportSelectedFields;
    }
    return ["StudentCode", "StudentName", "Score"];
  }, [exportSelectedFields]);

  const exportPreviewModalRows = useMemo(() => {
    const topicKeyword = exportTopicKeyword.trim().toLowerCase();
    const rows = scoringMatrix
      .filter((row) => (exportOnlyLocked ? row.isLocked : true))
      .filter((row) => (exportOnlyPublished ? row.finalScore != null : true))
      .filter((row) => {
        if (exportScopeMode !== "per-council") {
          return true;
        }
        if (!reportCouncilId.trim()) {
          return true;
        }
        const councilId = String(row.committeeId ?? "").trim();
        const councilCode = String(row.committeeCode ?? "").trim().toLowerCase();
        const keyword = reportCouncilId.trim().toLowerCase();
        return councilId === reportCouncilId.trim() || councilCode.includes(keyword);
      })
      .filter((row) => {
        if (exportScopeMode !== "per-topic" || !topicKeyword) {
          return true;
        }
        const haystack = `${row.topicCode ?? ""} ${row.topicTitle ?? ""} ${row.studentCode ?? ""} ${row.studentName ?? ""}`.toLowerCase();
        return haystack.includes(topicKeyword);
      })
      .slice(0, 6);

    return rows.map((row, index) => ({
      key: `${row.assignmentId ?? row.studentCode ?? index}`,
      values: exportPreviewModalColumns.map((columnKey) => getExportFieldValue(row, columnKey, index + 1)),
    }));
  }, [
    exportOnlyLocked,
    exportOnlyPublished,
    exportPreviewModalColumns,
    exportScopeMode,
    exportTopicKeyword,
    getExportFieldValue,
    reportCouncilId,
    scoringMatrix,
  ]);

  useEffect(() => {
    if (exportTemplateMode !== "custom") {
      setExportSelectedFields([...exportTemplateFieldPresets[exportTemplateMode]]);
    }
  }, [exportTemplateMode]);

  const toggleExportField = useCallback((fieldKey: string) => {
    setExportSelectedFields((prev) => {
      if (prev.includes(fieldKey)) {
        return prev.filter((key) => key !== fieldKey);
      }
      return [...prev, fieldKey];
    });
  }, []);

  const toggleExportGroup = useCallback((group: ExportFieldGroup) => {
    const groupKeys = group.fields.map((field) => field.key);
    setExportSelectedFields((prev) => {
      const allSelected = groupKeys.every((key) => prev.includes(key));
      if (allSelected) {
        return prev.filter((key) => !groupKeys.includes(key));
      }
      const merged = [...prev];
      groupKeys.forEach((key) => {
        if (!merged.includes(key)) {
          merged.push(key);
        }
      });
      return merged;
    });
  }, []);

  const toggleExportGroupExpand = useCallback((groupKey: string) => {
    setExportExpandedGroups((prev) => (prev.includes(groupKey) ? prev.filter((key) => key !== groupKey) : [...prev, groupKey]));
  }, []);

  const selectAllExportFields = useCallback(() => {
    setExportSelectedFields(exportAllFields.map((field) => field.key));
  }, [exportAllFields]);

  const resetExportFields = useCallback(() => {
    setExportSelectedFields(exportTemplateFieldPresets[exportTemplateMode]);
  }, [exportTemplateMode]);

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
        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>{entry.committee}</div>
        <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{entry.detail}</div>
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
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Phòng {row.room} · {row.defenseDate}</div>
                    <div style={{ fontSize: 12, color: "#0f172a", marginTop: 6, fontWeight: 700 }}>{row.totalTopics} đề tài · {row.chair}</div>
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
          {(!scoresPublished && distributionTotal === 0) && (
            <section style={cardStyle}>
              <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Thống kê điểm</div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 8 }}>
                Số liệu điểm sẽ hiển thị sau khi chủ tịch hội đồng chốt và công bố điểm.
              </div>
            </section>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: 12, alignItems: "start" }}>
            {/* Grade Distribution */}
            <section style={{ ...cardStyle, display: "grid", gap: 16, minHeight: 560 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.08em", color: "#0f172a" }}>Phân bổ xếp loại</div>
                  <div style={{ fontSize: 13, color: "#475569", marginTop: 6, maxWidth: 520 }}>
                    {distributionViewMode === "grade"
                      ? "Theo thang điểm chữ A+/A/B+/B/C+/C/D+/D/F"
                      : "Theo các khoảng điểm hệ 10 tương ứng"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {([
                    { value: "grade" as const, label: "Điểm chữ" },
                    { value: "score" as const, label: "Điểm số" },
                  ]).map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setDistributionViewMode(mode.value)}
                      style={{
                        padding: "6px 10px",
                        fontSize: 11,
                        fontWeight: 800,
                        borderRadius: 8,
                        border: `1px solid ${distributionViewMode === mode.value ? DEEP_BLUE_PRIMARY : "#cbd5e1"}`,
                        background: distributionViewMode === mode.value ? DEEP_BLUE_PRIMARY : "#ffffff",
                        color: distributionViewMode === mode.value ? "#ffffff" : "#0f172a",
                        cursor: "pointer",
                        textTransform: "uppercase",
                      }}
                    >
                      {mode.label}
                    </button>
                  ))}
                  <div ref={distributionChartMenuRef} style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setDistributionChartMenuOpen((value) => !value)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        fontSize: 12,
                        fontWeight: 800,
                        borderRadius: 10,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#0f172a",
                        cursor: "pointer",
                        boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
                      }}
                    >
                      {distributionChartType === "pie" ? <PieChart size={15} /> : distributionChartType === "bar" ? <BarChart3 size={15} /> : <TrendingUp size={15} />}
                      {distributionChartType === "pie" ? "Biểu đồ tròn" : distributionChartType === "bar" ? "Biểu đồ cột" : "Biểu đồ đường"}
                      <ChevronDown size={14} style={{ transform: distributionChartMenuOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s ease" }} />
                    </button>

                    {distributionChartMenuOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 8px)",
                          right: 0,
                          minWidth: 220,
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: 14,
                          boxShadow: "0 14px 30px rgba(15, 23, 42, 0.12)",
                          zIndex: 30,
                          overflow: "hidden",
                        }}
                      >
                        {([
                          { value: "pie" as const, label: "Biểu đồ tròn", icon: PieChart, detail: "Nhìn nhanh tỷ trọng" },
                          { value: "bar" as const, label: "Biểu đồ cột", icon: BarChart3, detail: "So sánh trực quan" },
                          { value: "line" as const, label: "Biểu đồ đường", icon: TrendingUp, detail: "Theo xu hướng" },
                        ]).map((option) => {
                          const Icon = option.icon;
                          const active = distributionChartType === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setDistributionChartType(option.value);
                                setDistributionChartMenuOpen(false);
                              }}
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "12px 14px",
                                border: "none",
                                background: active ? "#eff6ff" : "#ffffff",
                                color: active ? DEEP_BLUE_PRIMARY : "#0f172a",
                                cursor: "pointer",
                                textAlign: "left",
                              }}
                            >
                              <span style={{ width: 32, height: 32, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", background: active ? "#dbeafe" : "#f8fafc", color: active ? DEEP_BLUE_PRIMARY : "#475569", flexShrink: 0 }}>
                                <Icon size={15} />
                              </span>
                              <span style={{ display: "grid", gap: 2 }}>
                                <span style={{ fontSize: 13, fontWeight: 800 }}>{option.label}</span>
                                <span style={{ fontSize: 11, color: "#64748b" }}>{option.detail}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr" }}>
                <div style={{ display: "grid", placeItems: "center", minHeight: 280, padding: 12, borderRadius: 18, background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0", position: "relative" }}>
                  {distributionChartType === "pie" ? (
                    <div
                      style={{
                        width: 190,
                        height: 190,
                        borderRadius: "50%",
                        background: distributionTotal > 0
                          ? `conic-gradient(${distributionStops.map((stop) => `${stop.color} ${stop.start}% ${stop.end}%`).join(", ")})`
                          : "#e2e8f0",
                        position: "relative",
                        boxShadow: hoveredDistributionLabel === "pie" ? "inset 0 0 0 1px rgba(148,163,184,0.35), 0 24px 48px rgba(15, 23, 42, 0.15)" : "inset 0 0 0 1px rgba(148,163,184,0.35), 0 18px 40px rgba(15, 23, 42, 0.08)",
                        cursor: "pointer",
                        transition: "transform 0.15s ease, box-shadow 0.15s ease",
                        transform: hoveredDistributionLabel === "pie" ? "scale(1.02)" : "scale(1)",
                      }}
                      onMouseEnter={() => setHoveredDistributionLabel("pie")}
                      onMouseLeave={() => setHoveredDistributionLabel(null)}
                    >
                      <div
                        style={{
                          position: "absolute",
                          inset: 20,
                          borderRadius: "50%",
                          background: "#ffffff",
                          display: "grid",
                          placeItems: "center",
                          textAlign: "center",
                          gap: 4,
                          boxShadow: "0 10px 20px rgba(15, 23, 42, 0.08)",
                        }}
                      >
                        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>{distributionViewMode === "grade" ? "TỔNG XẾP LOẠI" : "TỔNG ĐIỂM"}</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: DEEP_BLUE_PRIMARY }}>{formatNumber(distributionTotal)}</div>
                        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>{distributionViewMode === "grade" ? "Sinh viên" : "Mẫu"}</div>
                      </div>
                    </div>
                  ) : distributionChartType === "bar" ? (
                    <div style={{ width: "100%", height: 260, display: "flex", alignItems: "flex-end", gap: 8, padding: "16px 4px 6px", position: "relative" }}>
                      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
                        {Array.from({ length: 5 }, (_, i) => (
                          <line key={`grid-${i}`} x1="0" y1={40 - (i * 40) / 4} x2="100" y2={40 - (i * 40) / 4} stroke="#e2e8f0" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                        ))}
                      </svg>
                      {distributionRows.map((item) => (
                        <div key={item.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0, position: "relative", cursor: "pointer" }} onMouseEnter={() => setHoveredDistributionLabel(item.label)} onMouseLeave={() => setHoveredDistributionLabel(null)}>
                          {hoveredDistributionLabel === item.label && <div style={{ position: "absolute", top: -26, left: "50%", transform: "translateX(-50%)", background: "#0f172a", color: "#ffffff", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", zIndex: 20 }}>{item.value}</div>}
                          <div style={{ width: "100%", height: `${Math.max(8, (item.value / distributionPeak) * 200)}px`, borderRadius: "8px 8px 0 0", background: distributionPalette[item.label] ?? "#cbd5e1", transition: "all 0.2s ease", boxShadow: item.value > 0 ? "0 4px 12px rgba(15, 23, 42, 0.1)" : "none", opacity: hoveredDistributionLabel === null || hoveredDistributionLabel === item.label ? 1 : 0.4 }} />
                          <span style={{ fontSize: 9, fontWeight: 800, color: "#475569", textAlign: "center", lineHeight: 1.2 }}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ width: "100%", height: 320, padding: "16px 8px 8px", position: "relative", background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", borderRadius: 8 }}>
                      <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="xMidYMid meet" style={{ position: "relative", zIndex: 1 }}>
                        <defs>
                          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor={DEEP_BLUE_PRIMARY} stopOpacity="0.15" />
                            <stop offset="100%" stopColor={DEEP_BLUE_PRIMARY} stopOpacity="0.02" />
                          </linearGradient>
                        </defs>
                        {Array.from({ length: 5 }, (_, i) => (
                          <line key={`grid-${i}`} x1="0" y1={40 - (i * 40) / 4} x2="100" y2={40 - (i * 40) / 4} stroke="#cbd5e1" strokeWidth="0.4" opacity="0.6" vectorEffect="non-scaling-stroke" />
                        ))}
                        {distributionRows.length > 0 && (
                          <path
                            d={`M ${distributionRows.map((item, idx) => `${(distributionRows.length <= 1 ? 50 : (idx / (distributionRows.length - 1)) * 100)},${40 - (item.value / distributionPeak) * 34}`).join(" L ")} L ${distributionRows.length <= 1 ? 50 : 100},40 L 0,40 Z`}
                            fill="url(#areaGradient)"
                          />
                        )}
                        <path
                          d={`M ${distributionRows.map((item, idx) => `${(distributionRows.length <= 1 ? 50 : (idx / (distributionRows.length - 1)) * 100)},${40 - (item.value / distributionPeak) * 34}`).join(" L ")}`}
                          fill="none"
                          stroke={DEEP_BLUE_PRIMARY}
                          strokeWidth="2.2"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          style={{ filter: "drop-shadow(0 2px 4px rgba(15, 23, 42, 0.1))" }}
                        />
                        {distributionRows.map((item, idx) => (
                          <g key={item.label} onMouseEnter={() => setHoveredDistributionLabel(item.label)} onMouseLeave={() => setHoveredDistributionLabel(null)} style={{ cursor: "pointer" }}>
                            <circle
                              cx={distributionRows.length <= 1 ? 50 : (idx / (distributionRows.length - 1)) * 100}
                              cy={40 - (item.value / distributionPeak) * 34}
                              r={hoveredDistributionLabel === item.label ? "3.5" : "2.8"}
                              fill={distributionPalette[item.label] ?? DEEP_BLUE_PRIMARY}
                              stroke="white"
                              strokeWidth="1.5"
                              style={{ transition: "r 0.2s ease, filter 0.2s ease", filter: hoveredDistributionLabel === item.label ? "drop-shadow(0 2px 8px rgba(15, 23, 42, 0.3))" : "drop-shadow(0 1px 3px rgba(15, 23, 42, 0.1))" }}
                            />
                            {hoveredDistributionLabel === item.label && (
                              <g>
                                <rect
                                  x={distributionRows.length <= 1 ? 50 : (idx / (distributionRows.length - 1)) * 100}
                                  y={40 - (item.value / distributionPeak) * 34 - 8}
                                  width="12"
                                  height="5"
                                  rx="1"
                                  fill="#0f172a"
                                  textAnchor="middle"
                                  transform={`translate(-6, 0)`}
                                />
                                <text
                                  x={distributionRows.length <= 1 ? 50 : (idx / (distributionRows.length - 1)) * 100}
                                  y={40 - (item.value / distributionPeak) * 34 - 4.5}
                                  textAnchor="middle"
                                  fontSize="2.2"
                                  fontWeight="700"
                                  fill="white"
                                  style={{ pointerEvents: "none" }}
                                >
                                  {item.value}
                                </text>
                              </g>
                            )}
                          </g>
                        ))}
                      </svg>
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(70px, 1fr))", gap: 6, marginBottom: 16 }}>
                  {distributionRows.map((item) => (
                    <div key={item.label} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 8, background: "#ffffff", display: "grid", gap: 5, minHeight: 58, cursor: "pointer", transition: "all 0.2s ease", transform: hoveredDistributionLabel === item.label ? "translateY(-2px)" : "translateY(0)", boxShadow: hoveredDistributionLabel === item.label ? "0 4px 16px rgba(15, 23, 42, 0.12)" : "0 2px 8px rgba(15, 23, 42, 0.04)" }} onMouseEnter={() => setHoveredDistributionLabel(item.label)} onMouseLeave={() => setHoveredDistributionLabel(null)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 999, background: distributionPalette[item.label] ?? "#cbd5e1", flexShrink: 0 }} />
                        <div style={{ fontSize: 9, color: "#64748b", fontWeight: 800, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</div>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: distributionPalette[item.label] ?? DEEP_BLUE_PRIMARY, lineHeight: 1 }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, marginBottom: 8 }}>
                  {distributionViewMode === "grade"
                    ? "Phân bổ tính theo kết quả cuối cùng của từng đề tài, quy đổi đúng A+/A/B+/B/C+/C/D+/D/F."
                    : "Phân bổ tính theo điểm hệ 10 và chia đúng theo các khoảng chuẩn tương ứng."}
                </div>
              </div>
            </section>

            {(scoresPublished || distributionTotal > 0) && (
              <section style={cardStyle}>
                <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Top sinh viên</div>
                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  {topStudents.map((r, i) => {
                    const score = Number(r.finalScore ?? r.currentScore ?? 0);
                    const grade = getGradeFromScore(score);
                    const medalColors = ["#fbbf24", "#c0c0c0", "#cd7f32"];
                    const medalBg = i < 3 ? medalColors[i] : DEEP_BLUE_PRIMARY;
                    return (
                      <div key={`top-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: i < 3 ? medalBg + "15" : "#f8fafc", border: `1px solid ${i < 3 ? medalBg + "40" : "#e2e8f0"}` }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: medalBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 900, fontSize: 14, color: "#ffffff" }}>{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.studentName ?? "-"}</div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{r.studentCode ?? "-"} · Phòng {r.room ?? "-"} · {r.scheduledAt ? new Date(r.scheduledAt).toLocaleDateString("vi-VN") : "-"}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 900, color: DEEP_BLUE_PRIMARY }}>{score.toFixed(1)}</div>
                          <div style={{ fontSize: 11, fontWeight: 800, padding: "2px 6px", borderRadius: 6, background: distributionPalette[grade] + "20", color: distributionPalette[grade] ?? DEEP_BLUE_PRIMARY }}>{grade}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {(scoresPublished || distributionTotal > 0) && (
            <section style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Thống kê theo hội đồng</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>Điểm trung bình, biến thiên và trạng thái khóa</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>Điểm trung bình</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {(() => {
                      const totalPages = Math.ceil(committeeScoreStats.length / committeeStatsPageSize);
                      const startIdx = (committeeStatsPage - 1) * committeeStatsPageSize;
                      const endIdx = startIdx + committeeStatsPageSize;
                      const pageData = committeeScoreStats.slice(startIdx, endIdx);
                      return pageData.map((item) => (
                        <div key={item.code}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, marginBottom: 4 }}>
                            <span style={{ fontWeight: 700 }}>{item.code}</span>
                            <strong>{item.avgScore.toFixed(1)}</strong>
                          </div>
                          <div style={{ height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                            <div style={{ width: `${(item.avgScore / scorePeak) * 100}%`, height: "100%", background: DEEP_BLUE_PRIMARY }} />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                  {committeeScoreStats.length > committeeStatsPageSize && (() => {
                    const totalPages = Math.ceil(committeeScoreStats.length / committeeStatsPageSize);
                    return (
                      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12 }}>
                        <button type="button" onClick={() => setCommitteeStatsPage(Math.max(1, committeeStatsPage - 1))} disabled={committeeStatsPage === 1} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: "1px solid #cbd5e1", background: committeeStatsPage === 1 ? "#f1f5f9" : "#ffffff", color: committeeStatsPage === 1 ? "#94a3b8" : "#0f172a", cursor: committeeStatsPage === 1 ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><ChevronLeft size={14} /> Trước</button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (<button key={`cpage-${page}`} type="button" onClick={() => setCommitteeStatsPage(page)} style={{ width: 28, height: 28, padding: 0, fontSize: 10, fontWeight: 800, borderRadius: 4, border: `1px solid ${committeeStatsPage === page ? DEEP_BLUE_PRIMARY : "#cbd5e1"}`, background: committeeStatsPage === page ? DEEP_BLUE_PRIMARY : "#ffffff", color: committeeStatsPage === page ? "#ffffff" : "#0f172a", cursor: "pointer" }}>{page}</button>))}
                        <button type="button" onClick={() => setCommitteeStatsPage(Math.min(totalPages, committeeStatsPage + 1))} disabled={committeeStatsPage === totalPages} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: "1px solid #cbd5e1", background: committeeStatsPage === totalPages ? "#f1f5f9" : "#ffffff", color: committeeStatsPage === totalPages ? "#94a3b8" : "#0f172a", cursor: committeeStatsPage === totalPages ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>Sau <ChevronRight size={14} /></button>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>Biến thiên điểm</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {(() => {
                      const totalPages = Math.ceil(committeeScoreStats.length / committeeStatsPageSize);
                      const startIdx = (committeeStatsPage - 1) * committeeStatsPageSize;
                      const endIdx = startIdx + committeeStatsPageSize;
                      const pageData = committeeScoreStats.slice(startIdx, endIdx);
                      return pageData.map((item) => (
                        <div key={`${item.code}-variance`}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, marginBottom: 4 }}>
                            <span style={{ fontWeight: 700 }}>{item.code}</span>
                            <strong>{item.avgVariance.toFixed(1)}</strong>
                          </div>
                          <div style={{ height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                            <div style={{ width: `${(item.avgVariance / variancePeak) * 100}%`, height: "100%", background: "#f59e0b" }} />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>Trạng thái khóa</div>
                <div style={{ display: "grid", gap: 8 }}>
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
              </div>
            </section>
          )}

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
          {(scoresPublished || distributionTotal > 0) && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                {[leaderboardEntries.highest, leaderboardEntries.lowest, leaderboardEntries.fastest, leaderboardEntries.delayed].map((entry) => renderLeaderboardCard(entry))}
              </div>

              <section style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.08em", color: "#0f172a" }}>Danh sách đề tài theo sinh viên</div>
                    <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>Bấm vào cột tiêu đề để sắp xếp từ A-Z hoặc Z-A</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Kết quả:</span>
                      <select 
                        value={String(studentTableIsPassedFilter)} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setStudentTableIsPassedFilter(val === "all" ? "all" : val === "true");
                          setStudentTablePage(1);
                        }}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          fontSize: 13,
                          fontWeight: 600,
                          background: "#ffffff",
                          color: "#0f172a",
                          cursor: "pointer"
                        }}
                      >
                        <option value="all">Tất cả kết quả</option>
                        <option value="true">ĐẠT</option>
                        <option value="false">TRƯỢT</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div style={{ marginTop: 16, overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                        <th style={{ padding: "12px", textAlign: "left", fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap", borderRight: "1px solid #e2e8f0" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Hash size={14} /> STT</span></th>
                        <th 
                          onClick={() => {
                            setStudentTableSortField("studentCode");
                            setStudentTableSortDir(studentTableSortField === "studentCode" && studentTableSortDir === "asc" ? "desc" : "asc");
                          }}
                          style={{ padding: "12px", textAlign: "left", fontWeight: 800, color: "#0f172a", cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", borderRight: "1px solid #e2e8f0", background: studentTableSortField === "studentCode" ? "#eff6ff" : "transparent", transition: "background 0.15s" }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><User size={14} /> Mã SV</span> {studentTableSortField === "studentCode" && (studentTableSortDir === "asc" ? "↑" : "↓")}
                        </th>
                        <th 
                          onClick={() => {
                            setStudentTableSortField("studentName");
                            setStudentTableSortDir(studentTableSortField === "studentName" && studentTableSortDir === "asc" ? "desc" : "asc");
                          }}
                          style={{ padding: "12px", textAlign: "left", fontWeight: 800, color: "#0f172a", cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", borderRight: "1px solid #e2e8f0", background: studentTableSortField === "studentName" ? "#eff6ff" : "transparent", transition: "background 0.15s" }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Users size={14} /> Họ tên</span> {studentTableSortField === "studentName" && (studentTableSortDir === "asc" ? "↑" : "↓")}
                        </th>
                        <th 
                          onClick={() => {
                            setStudentTableSortField("topicTitle");
                            setStudentTableSortDir(studentTableSortField === "topicTitle" && studentTableSortDir === "asc" ? "desc" : "asc");
                          }}
                          style={{ padding: "12px", textAlign: "left", fontWeight: 800, color: "#0f172a", cursor: "pointer", userSelect: "none", borderRight: "1px solid #e2e8f0", background: studentTableSortField === "topicTitle" ? "#eff6ff" : "transparent", transition: "background 0.15s" }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FileText size={14} /> Tên đề tài</span> {studentTableSortField === "topicTitle" && (studentTableSortDir === "asc" ? "↑" : "↓")}
                        </th>
                        <th 
                          onClick={() => {
                            setStudentTableSortField("finalScore");
                            setStudentTableSortDir(studentTableSortField === "finalScore" && studentTableSortDir === "asc" ? "desc" : "asc");
                          }}
                          style={{ padding: "12px", textAlign: "center", fontWeight: 800, color: "#0f172a", cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", borderRight: "1px solid #e2e8f0", background: studentTableSortField === "finalScore" ? "#eff6ff" : "transparent", transition: "background 0.15s" }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Star size={14} /> Điểm tổng</span> {studentTableSortField === "finalScore" && (studentTableSortDir === "asc" ? "↑" : "↓")}
                        </th>
                        <th style={{ padding: "12px", textAlign: "center", fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap", borderRight: "1px solid #e2e8f0" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={14} /> Điểm chữ</span></th>
                        <th style={{ padding: "12px", textAlign: "center", fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap", borderRight: "1px solid #e2e8f0" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Activity size={14} /> Kết quả</span></th>
                        <th 
                          onClick={() => {
                            setStudentTableSortField("committeeCode");
                            setStudentTableSortDir(studentTableSortField === "committeeCode" && studentTableSortDir === "asc" ? "desc" : "asc");
                          }}
                          style={{ padding: "12px", textAlign: "left", fontWeight: 800, color: "#0f172a", cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", borderRight: "1px solid #e2e8f0", background: studentTableSortField === "committeeCode" ? "#eff6ff" : "transparent", transition: "background 0.15s" }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Gavel size={14} /> Hội đồng</span> {studentTableSortField === "committeeCode" && (studentTableSortDir === "asc" ? "↑" : "↓")}
                        </th>
                        <th style={{ padding: "12px", textAlign: "left", fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap", borderRight: "1px solid #e2e8f0" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Lock size={14} /> Trạng thái</span></th>
                        <th style={{ padding: "12px", textAlign: "center", fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Paperclip size={14} /> Action</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const totalPages = Math.ceil(studentTableSortedData.length / studentTablePageSize);
                        const startIdx = (studentTablePage - 1) * studentTablePageSize;
                        const endIdx = startIdx + studentTablePageSize;
                        const pageData = studentTableSortedData.slice(startIdx, endIdx);
                        
                        return pageData.map((row, pageIdx) => {
                          const score = Number(row.finalScore ?? row.currentScore ?? 0);
                          const grade = getGradeFromScore(score);
                          const statusLabel = (row.submittedCount != null && row.requiredCount != null && row.submittedCount >= row.requiredCount && !row.isLocked)
                            ? "Chờ công bố"
                            : row.finalScore != null || row.currentScore != null
                              ? "Đã chấm"
                              : "Chưa chấm";
                          const statusColor = statusLabel === "Chờ công bố" ? "#b45309" : statusLabel === "Đã chấm" ? "#16a34a" : "#ef4444";
                          const globalIdx = startIdx + pageIdx + 1;
                          
                          return (
                            <tr key={`student-row-${row.assignmentId ?? pageIdx}`} style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <td style={{ padding: "12px", borderRight: "1px solid #e2e8f0", fontWeight: 700, color: "#0f172a" }}>{globalIdx}</td>
                              <td style={{ padding: "12px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#0f172a" }}>{row.studentCode ?? "-"}</td>
                              <td style={{ padding: "12px", borderRight: "1px solid #e2e8f0", color: "#0f172a" }}>{row.studentName ?? "-"}</td>
                              <td style={{ padding: "12px", borderRight: "1px solid #e2e8f0", color: "#0f172a", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.topicTitle}>{row.topicTitle ?? "-"}</td>
                              <td style={{ padding: "12px", borderRight: "1px solid #e2e8f0", textAlign: "center", fontWeight: 900, color: DEEP_BLUE_PRIMARY }}>{score > 0 ? score.toFixed(1) : "-"}</td>
                              <td style={{ padding: "12px", borderRight: "1px solid #e2e8f0", textAlign: "center", fontWeight: 800, fontSize: 14, color: distributionPalette[grade] ?? "#0f172a" }}>{grade}</td>
                              <td style={{ padding: "12px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                                {(() => {
                                  const effectivePassed = row.isPassed ?? (row.finalScore != null && Number(row.finalScore) >= 5.0);
                                  return (
                                    <span style={{ 
                                      display: "inline-flex", 
                                      padding: "4px 10px", 
                                      borderRadius: 999, 
                                      fontSize: 11, 
                                      fontWeight: 800, 
                                      background: effectivePassed ? "#dcfce7" : "#fee2e2", 
                                      color: effectivePassed ? "#16a34a" : "#ef4444",
                                      border: `1px solid ${effectivePassed ? "#86efac" : "#fecaca"}`
                                    }}>
                                      {effectivePassed ? "ĐẠT" : "TRƯỢT"}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td style={{ padding: "12px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#0f172a" }}>{row.committeeCode ?? "-"}</td>
                              <td style={{ padding: "12px", borderRight: "1px solid #e2e8f0" }}>
                                <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: statusColor === "#b45309" ? "#fef3c7" : statusColor === "#16a34a" ? "#dcfce7" : "#fee2e2", color: statusColor }}>{statusLabel}</span>
                              </td>
                              <td style={{ padding: "12px", textAlign: "center" }}>
                                <button type="button" onClick={() => {setSelectedTopic(row); setTopicDetailModalOpen(true);}} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 8px", fontSize: 12, fontWeight: 700, borderRadius: 8, border: "1px solid #cbd5e1", background: "#ffffff", color: DEEP_BLUE_PRIMARY, cursor: "pointer", transition: "all 0.2s ease" }} title="Xem chi tiết"><Eye size={16} /></button>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                  {studentTableSortedData.length === 0 && (<div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b", fontSize: 14 }}>Không có dữ liệu sinh viên</div>)}
                </div>
                
                {studentTableSortedData.length > 0 && (() => {
                  const totalPages = Math.ceil(studentTableSortedData.length / studentTablePageSize);
                  return (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: 12, color: "#475569" }}>Hiển thị {((studentTablePage - 1) * studentTablePageSize) + 1} đến {Math.min(studentTablePage * studentTablePageSize, studentTableSortedData.length)} của {studentTableSortedData.length} đề tài</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button type="button" onClick={() => setStudentTablePage(Math.max(1, studentTablePage - 1))} disabled={studentTablePage === 1} style={{ padding: "6px 12px", fontSize: 12, fontWeight: 700, borderRadius: 8, border: "1px solid #cbd5e1", background: studentTablePage === 1 ? "#f1f5f9" : "#ffffff", color: studentTablePage === 1 ? "#94a3b8" : "#0f172a", cursor: studentTablePage === 1 ? "default" : "pointer", transition: "all 0.2s ease", display: "inline-flex", alignItems: "center", gap: 6 }}><ChevronLeft size={14} /> Trước</button>
                        <div style={{ display: "flex", gap: 4 }}>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (<button key={`page-${page}`} type="button" onClick={() => setStudentTablePage(page)} style={{ width: 32, height: 32, padding: 0, fontSize: 11, fontWeight: 800, borderRadius: 6, border: `1px solid ${studentTablePage === page ? DEEP_BLUE_PRIMARY : "#cbd5e1"}`, background: studentTablePage === page ? DEEP_BLUE_PRIMARY : "#ffffff", color: studentTablePage === page ? "#ffffff" : "#0f172a", cursor: "pointer", transition: "all 0.15s ease" }}>{page}</button>))}
                        </div>
                        <button type="button" onClick={() => setStudentTablePage(Math.min(totalPages, studentTablePage + 1))} disabled={studentTablePage === totalPages} style={{ padding: "6px 12px", fontSize: 12, fontWeight: 700, borderRadius: 8, border: "1px solid #cbd5e1", background: studentTablePage === totalPages ? "#f1f5f9" : "#ffffff", color: studentTablePage === totalPages ? "#94a3b8" : "#0f172a", cursor: studentTablePage === totalPages ? "default" : "pointer", transition: "all 0.2s ease", display: "inline-flex", alignItems: "center", gap: 6 }}>Sau <ChevronRight size={14} /></button>
                      </div>
                    </div>
                  );
                })()}
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
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Phòng {row.room} · {row.defenseDate}</div>
                      <div style={{ fontSize: 13, color: "#0f172a", marginTop: 6, fontWeight: 800 }}>{row.totalTopics} đề tài · {row.chair}</div>
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
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}><Users size={14} /> Chi tiết hội đồng</div>
                      <h2 style={{ margin: "6px 0 0 0", fontSize: 18, color: "#0f172a" }}>{selectedCommittee.name}</h2>
                      <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                        {selectedCommittee.code} · Phòng {selectedCommittee.room} · {selectedCommittee.defenseDate}
                      </div>
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
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{selectedCommittee.avgScore != null && selectedCommittee.avgScore > 0 ? formatNumber(selectedCommittee.avgScore) : "-"}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
                    <div style={cardStyle}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#475569" }}><User size={12} /> Giảng viên hướng dẫn</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 6 }}>{selectedCommitteeSupervisor}</div>
                    </div>
                    <div style={cardStyle}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#475569" }}><Gavel size={12} /> Chủ tịch hội đồng</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 6 }}>{selectedCommittee.chair || "-"}</div>
                    </div>
                    <div style={cardStyle}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#475569" }}><MessageSquare size={12} /> Ủy viên thư ký</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 6 }}>{selectedCommittee.secretary || "-"}</div>
                    </div>
                    <div style={cardStyle}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#475569" }}><Users size={12} /> Ủy viên phản biện</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 6 }}>{selectedCommittee.reviewer || "-"}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button type="button" onClick={() => { setPreviewModalType("scoreSheet"); }} style={{ border: "1px solid #cbd5e1", background: LIGHT_BLUE_SOFTEN, color: DEEP_BLUE_PRIMARY, borderRadius: 8, minHeight: 34, padding: "0 16px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                      <Eye size={14} /> Xem bảng điểm
                    </button>
                  </div>
                </section>


                <section style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}><Table size={14} /> Danh sách đề tài</div>
                      <div style={{ fontSize: 13, color: "#475569", marginTop: 3 }}>{selectedCommitteeRows.length} hàng</div>
                    </div>
                  </div>
                  <div style={{ overflow: "auto", marginTop: 12, border: "1px solid #cbd5e1", borderRadius: 10 }}>
                    <div style={{ minWidth: 800 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "72px 110px 1fr 1fr 1fr 90px 90px 220px", gap: 12, padding: "10px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>
                        <div>STT</div>
                        <div>Mã SV</div>
                        <div>Họ tên</div>
                        <div>Đề tài</div>
                        <div>Giảng viên hướng dẫn</div>
                        <div>Điểm</div>
                        <div>Kết quả</div>
                        <div>Thao tác</div>
                      </div>
                      {selectedCommitteeRows.map((row, idx) => {
                        const statusValue = row.status ?? (row.isLocked ? "LOCKED" : row.finalScore ? "COMPLETED" : "ONGOING");
                        const statusTone = getStatusTone(statusValue);
                        const rowFinalized = selectedCommitteeFinalized || row.isLocked === true || ["LOCKED", "COMPLETED", "PUBLISHED", "FINALIZED", "WAITING_PUBLIC"].includes(normalizeStatusKey(statusValue));
                        return (
                          <div key={`${row.assignmentId ?? idx}`} style={{ display: "grid", gridTemplateColumns: "72px 110px 1fr 1fr 1fr 90px 90px 220px", gap: 12, padding: "10px 12px", borderTop: "1px solid #e2e8f0", fontSize: 12, color: "#0f172a", alignItems: "center" }}>
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
                            <div>
                              {row.isPassed !== undefined ? (
                                <span style={{
                                  display: "inline-flex",
                                  padding: "4px 10px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  background: row.isPassed ? "#f0fdf4" : "#fef2f2",
                                  color: row.isPassed ? "#16a34a" : "#ef4444",
                                  border: `1px solid ${row.isPassed ? "#86efac" : "#fecaca"}`
                                }}>
                                  {row.isPassed ? "ĐẠT" : "TRƯỢT"}
                                </span>
                              ) : "-"}
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

              </>
            )}
          </main>
        </section>
      )}

      {activeTab === "post-defense" && (
        <section style={{ display: "grid", gap: 20 }}>
          {/* Header & Metrics */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: DEEP_BLUE_PRIMARY }}><FileSpreadsheet size={16} /> Điều hành Hậu bảo vệ</div>
              <h2 style={{ margin: "4px 0 0 0", fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Quản lý báo cáo sửa đổi</h2>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ ...cardStyle, padding: "10px 20px", display: "grid", gap: 4, minWidth: 160, background: "linear-gradient(to bottom, #ffffff, #f8fafc)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Chờ nộp báo cáo</span>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{formatNumber((postDefense?.items ?? []).filter(i => !i.submittedAt).length)}</div>
              </div>
              <div style={{ ...cardStyle, padding: "10px 20px", display: "grid", gap: 4, minWidth: 160, background: "linear-gradient(to bottom, #ffffff, #f0f9ff)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", textTransform: "uppercase" }}>Đang chờ duyệt</span>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#0369a1" }}>{formatNumber(postDefense?.pendingRevisions ?? 0)}</div>
              </div>
              <div style={{ ...cardStyle, padding: "10px 20px", display: "grid", gap: 4, minWidth: 160, background: "linear-gradient(to bottom, #ffffff, #f0fdf4)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>Đã hoàn tất</span>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#166534" }}>{formatNumber(postDefense?.approvedRevisions ?? 0)}</div>
              </div>
            </div>
          </div>

          {/* List Section */}
          <section style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 8, flex: 1, maxWidth: 600 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  <input 
                    value={revisionKeyword} 
                    onChange={(e) => setRevisionKeyword(e.target.value)}
                    placeholder="Tìm sinh viên, mã số, đề tài..." 
                    style={{ width: "100%", height: 40, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 12px 0 36px", fontSize: 14 }} 
                  />
                </div>
                <select 
                  value={revisionStatus} 
                  onChange={(e) => setRevisionStatus(e.target.value as RevisionStatus)}
                  style={{ height: 40, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 12px", fontSize: 13, background: "#ffffff", fontWeight: 600, color: "#0f172a", minWidth: 160 }}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="pending">Chờ xử lý</option>
                  <option value="approved">Đã duyệt</option>
                  <option value="rejected">Từ chối</option>
                </select>
                <select 
                  value={isPassedFilter} 
                  onChange={(e) => setIsPassedFilter(e.target.value)}
                  style={{ height: 40, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 12px", fontSize: 13, background: "#ffffff", fontWeight: 600, color: "#0f172a", minWidth: 120 }}
                >
                  <option value="all">Mọi kết quả</option>
                  <option value="passed">Đạt</option>
                  <option value="failed">Trượt</option>
                </select>
              </div>
              <button 
                type="button" 
                onClick={() => void loadOperationsSnapshot()}
                style={{ height: 40, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 10, background: "#ffffff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
              >
                <RotateCcw size={14} /> Làm mới
              </button>
            </div>

            <div style={{ overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 12 }}>
              <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse" }}>
                <thead style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  <tr>
                    <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Hội đồng / Sinh viên</th>
                    <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Đề tài</th>
                    <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Điểm</th>
                    <th style={{ padding: "14px 16px", textAlign: "center", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Kết quả</th>
                    <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Người kiểm duyệt</th>
                    <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Hạn nộp</th>
                    <th style={{ padding: "14px 16px", textAlign: "center", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Trạng thái</th>
                    <th style={{ padding: "14px 16px", textAlign: "center", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {(postDefense?.items ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "60px 20px", textAlign: "center" }}>
                        <div style={{ display: "grid", placeItems: "center", gap: 12 }}>
                          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f1f5f9", display: "grid", placeItems: "center" }}>
                            <Archive size={24} color="#94a3b8" />
                          </div>
                          <div style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>Không tìm thấy dữ liệu hậu bảo vệ nào.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    (postDefense?.items ?? []).filter(item => {
                      if (isPassedFilter === "all") return true;
                      const committeeRow = scoringMatrix?.find(r => r.studentCode === item.studentCode);
                      const effectivePassed = item.isPassed ?? committeeRow?.isPassed ?? (committeeRow?.finalScore != null && Number(committeeRow.finalScore) >= 5.0);
                      return isPassedFilter === "passed" ? effectivePassed : !effectivePassed;
                    }).map((item, idx) => {
                      const effectiveStatus = item.status || item.revisionStatus || item.finalStatus || "";
                      const statusTone = getStatusTone(effectiveStatus);
                      
                      const committeeRow = scoringMatrix?.find(r => r.studentCode === item.studentCode);
                      const effectiveReviewer = item.reviewerName || item.reviewer || committeeRow?.secretaryName || committeeRow?.secretary || "Thư ký HĐ";
                      
                      const effectiveStudentName = item.studentName || item.proposerStudentName || "-";
                      const effectiveStudentCode = item.studentCode || item.proposerStudentCode || "-";
                      const effectiveScore = committeeRow?.finalScore ?? committeeRow?.currentScore;
                      const effectivePassed = item.isPassed ?? committeeRow?.isPassed ?? (effectiveScore != null && Number(effectiveScore) >= 5.0);

                      return (
                        <tr key={item.revisionId ?? idx} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                          <td style={{ padding: "16px" }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: DEEP_BLUE_PRIMARY, marginBottom: 4 }}>{item.committeeCode ?? "-"}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{effectiveStudentName}</div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>{effectiveStudentCode}</div>
                          </td>
                          <td style={{ padding: "16px", maxWidth: 250 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", lineHeight: 1.5 }}>{item.topicTitle ?? "-"}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{item.topicCode ?? "-"}</div>
                          </td>
                          <td style={{ padding: "16px" }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: DEEP_BLUE_PRIMARY }}>{effectiveScore != null ? Number(effectiveScore).toFixed(1) : "-"}</div>
                          </td>
                          <td style={{ padding: "16px", textAlign: "center" }}>
                            <span style={{
                              display: "inline-flex",
                              padding: "4px 10px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 800,
                              background: effectivePassed ? "#dcfce7" : "#fee2e2",
                              color: effectivePassed ? "#16a34a" : "#ef4444",
                              border: `1px solid ${effectivePassed ? "#86efac" : "#fecaca"}`
                            }}>
                              {effectivePassed ? "ĐẠT" : "TRƯỢT"}
                            </span>
                          </td>
                          <td style={{ padding: "16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f0f4f8", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, color: DEEP_BLUE_PRIMARY }}>
                                {String(effectiveReviewer).slice(0, 1).toUpperCase()}
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>{effectiveReviewer}</span>
                            </div>
                          </td>
                          <td style={{ padding: "16px" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: item.submissionDeadline && new Date(item.submissionDeadline) < new Date() ? "#ef4444" : "#475569" }}>
                              <Clock size={14} />
                              <span style={{ fontSize: 12, fontWeight: 700 }}>{item.submissionDeadline ? new Date(item.submissionDeadline).toLocaleDateString("vi-VN") : "-"}</span>
                            </div>
                          </td>
                          <td style={{ padding: "16px", textAlign: "center" }}>
                            <span style={{ 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: 6, 
                              borderRadius: 999, 
                              padding: "5px 12px", 
                              fontSize: 10, 
                              fontWeight: 800, 
                              background: statusTone.bg, 
                              color: statusTone.text,
                              border: statusTone.border !== "none" ? statusTone.border : `1px solid transparent`
                            }}>
                              {getStatusLabel(effectiveStatus)}
                            </span>
                          </td>
                          <td style={{ padding: "16px", textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              <button 
                                type="button" 
                                title="Xem chi tiết"
                                onClick={() => {
                                  const fullRow = scoringMatrix?.find(r => r.studentCode === item.studentCode);
                                  if (fullRow) {
                                    setSelectedTopic(fullRow);
                                    setTopicDetailModalOpen(true);
                                  } else {
                                    notifyInfo("Dữ liệu chi tiết đề tài hiện không khả dụng.");
                                  }
                                }}
                                style={{ ...actionIconButtonStyle, width: 32, height: 32 }}
                              >
                                <Eye size={14} />
                              </button>
                              {item.revisionFileUrl && (
                                <button 
                                  type="button" 
                                  title="Tải báo cáo sửa đổi"
                                  onClick={() => window.open(item.revisionFileUrl, "_blank")}
                                  style={{ ...actionIconButtonStyle, width: 32, height: 32, background: LIGHT_BLUE_BG, color: DEEP_BLUE_PRIMARY, border: "none" }}
                                >
                                  <FileText size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Hiển thị <strong>{(postDefense?.items ?? []).length}</strong> bản ghi trên trang này
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                 <button 
                  disabled={revisionPage <= 1}
                  onClick={() => setRevisionPage(prev => Math.max(1, prev - 1))}
                  style={{ ...actionIconButtonStyle, width: 36, height: 36, opacity: revisionPage <= 1 ? 0.5 : 1 }}
                >
                  <ChevronLeft size={16} />
                </button>
                <div style={{ width: 36, height: 36, display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800, background: DEEP_BLUE_PRIMARY, color: "#ffffff", borderRadius: 8 }}>{revisionPage}</div>
                <button 
                  onClick={() => setRevisionPage(prev => prev + 1)}
                  style={{ ...actionIconButtonStyle, width: 36, height: 36 }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </section>

          {/* Verification Tools */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <section style={{ ...cardStyle, background: "#f8fafc", border: "1px dashed #cbd5e1" }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Quy trình Chốt điểm & Lưu trữ</h3>
              <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: 16 }}>Dành cho quản trị viên thực hiện chốt điểm cuối cùng sau khi tất cả báo cáo sửa đổi đã được duyệt và xác nhận tính hợp lệ.</p>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" style={{ flex: 1, height: 44, border: "none", background: DEEP_BLUE_PRIMARY, color: "#ffffff", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                   <Lock size={16} /> Khóa dữ liệu hậu bảo vệ
                </button>
                <button type="button" style={{ flex: 1, height: 44, border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                   <Download size={16} /> Xuất file tổng hợp
                </button>
              </div>
            </section>
            
            <section style={{ ...cardStyle, background: "#f0f9ff", border: "1px solid #bae6fd" }}>
               <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 800, color: "#0369a1" }}>Kiểm tra Tính đồng nhất</h3>
               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "#ffffff", padding: 12, borderRadius: 10, border: "1px solid #e0f2fe" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Điểm đã khóa</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#0369a1", marginTop: 4 }}>{postDefense?.lockedScores ?? 0}</div>
                  </div>
                  <div style={{ background: "#ffffff", padding: 12, borderRadius: 10, border: "1px solid #e0f2fe" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Tỷ lệ hoàn thành</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#0369a1", marginTop: 4 }}>{Math.round(((postDefense?.approvedRevisions ?? 0) / Math.max(1, (postDefense?.totalRevisions ?? 0))) * 100)}%</div>
                  </div>
               </div>
               <div style={{ marginTop: 12, fontSize: 12, color: "#0369a1", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                 <Activity size={14} /> Hệ thống đang sẵn sàng cho việc đồng bộ điểm cuối cùng.
               </div>
            </section>
          </div>
        </section>
      )}

      {activeTab === "audit" && (
        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }}>
          {/* Audit Timeline */}
          <section style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Lịch trình kiểm toán</div>
              </div>
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
          <section style={{ ...cardStyle, display: "grid", gap: 12, overflowX: "hidden" }}>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Trung tâm xuất bảng điểm</div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Preset + nhóm field, tối ưu cho thao tác nhanh.</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, alignItems: "start" }}>
              <div style={{ border: "1px solid #dbe4ee", borderRadius: 14, padding: 14, background: "#ffffff", display: "grid", gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Phạm vi dữ liệu</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {exportScopeOptions.map((option) => (
                    <label key={option.value} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "#0f172a", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="export-scope"
                        checked={exportScopeMode === option.value}
                        onChange={() => setExportScopeMode(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>

                {exportScopeMode === "per-council" && (
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Hội đồng</span>
                    <select
                      value={reportCouncilId}
                      onChange={(event) => setReportCouncilId(event.target.value)}
                      style={{ minHeight: 36, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 10px", fontSize: 13, color: "#0f172a", background: "#ffffff" }}
                    >
                      <option value="">Chọn hội đồng</option>
                      {exportCouncilOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {exportScopeMode === "per-topic" && (
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Đề tài / Sinh viên</span>
                    <input
                      value={exportTopicKeyword}
                      onChange={(event) => setExportTopicKeyword(event.target.value)}
                      placeholder="Nhập mã đề tài, tên đề tài hoặc MSSV"
                      style={{ minHeight: 36, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 10px", fontSize: 13 }}
                    />
                  </label>
                )}

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Bộ lọc</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setExportOnlyLocked((prev) => !prev)}
                      style={{ border: `1px solid ${exportOnlyLocked ? DEEP_BLUE_PRIMARY : "#cbd5e1"}`, background: exportOnlyLocked ? LIGHT_BLUE_SOFTEN : "#f8fafc", color: exportOnlyLocked ? DEEP_BLUE_PRIMARY : "#334155", borderRadius: 999, minHeight: 28, padding: "0 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      Đã khóa
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportOnlyPublished((prev) => !prev)}
                      style={{ border: `1px solid ${exportOnlyPublished ? DEEP_BLUE_PRIMARY : "#cbd5e1"}`, background: exportOnlyPublished ? LIGHT_BLUE_SOFTEN : "#f8fafc", color: exportOnlyPublished ? DEEP_BLUE_PRIMARY : "#334155", borderRadius: 999, minHeight: 28, padding: "0 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      Đã công bố
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportIsPassed(exportIsPassed === true ? null : true)}
                      style={{ border: `1px solid ${exportIsPassed === true ? "#16a34a" : "#cbd5e1"}`, background: exportIsPassed === true ? "#f0fdf4" : "#f8fafc", color: exportIsPassed === true ? "#166534" : "#334155", borderRadius: 999, minHeight: 28, padding: "0 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      Đạt
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportIsPassed(exportIsPassed === false ? null : false)}
                      style={{ border: `1px solid ${exportIsPassed === false ? "#ef4444" : "#cbd5e1"}`, background: exportIsPassed === false ? "#fef2f2" : "#f8fafc", color: exportIsPassed === false ? "#991b1b" : "#334155", borderRadius: 999, minHeight: 28, padding: "0 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      Trượt
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ border: "1px solid #dbe4ee", borderRadius: 14, padding: 14, background: "#ffffff", display: "grid", gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Template báo cáo</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  {exportTemplateOptions.map((template) => {
                    const isActive = exportTemplateMode === template.value;
                    return (
                      <button
                        key={template.value}
                        type="button"
                        onClick={() => setExportTemplateMode(template.value)}
                        style={{ border: `1.5px solid ${isActive ? DEEP_BLUE_PRIMARY : "#cbd5e1"}`, background: isActive ? "#eff6ff" : "#ffffff", borderRadius: 12, padding: 12, cursor: "pointer", textAlign: "left", display: "grid", gap: 4 }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: isActive ? DEEP_BLUE_PRIMARY : "#0f172a", fontWeight: 800 }}>
                          {template.icon} {template.label}
                        </span>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{template.description}</span>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Fields</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={selectAllExportFields} style={{ border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 8, minHeight: 28, padding: "0 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>All</button>
                    <button type="button" onClick={resetExportFields} style={{ border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 8, minHeight: 28, padding: "0 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Reset</button>
                  </div>
                </div>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Tìm field</span>
                  <div style={{ position: "relative" }}>
                    <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    <input
                      value={exportFieldSearch}
                      onChange={(event) => setExportFieldSearch(event.target.value)}
                      placeholder="Tìm theo tên hoặc key"
                      style={{ width: "100%", minHeight: 36, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 10px 0 30px", fontSize: 13 }}
                    />
                  </div>
                </label>

                <div style={{ display: "grid", gap: 8, maxHeight: 300, overflowY: "auto", paddingRight: 2 }}>
                  {exportFilteredGroups.map((group) => {
                    const selectedCount = group.fields.filter((field) => exportSelectedFields.includes(field.key)).length;
                    const allSelected = group.fields.length > 0 && selectedCount === group.fields.length;
                    const expanded = exportExpandedGroups.includes(group.key);
                    return (
                      <div key={group.key} style={{ border: "1px solid #dbe4ee", borderRadius: 10, background: "#f8fafc" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", padding: 10 }}>
                          <button
                            type="button"
                            onClick={() => toggleExportGroupExpand(group.key)}
                            style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, color: "#0f172a", fontWeight: 800, fontSize: 12 }}
                          >
                            <ChevronDown size={13} style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.18s ease" }} />
                            {group.label}
                            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>({selectedCount}/{group.fields.length})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleExportGroup(group)}
                            style={{ border: `1px solid ${allSelected ? DEEP_BLUE_PRIMARY : "#cbd5e1"}`, background: allSelected ? LIGHT_BLUE_SOFTEN : "#ffffff", color: allSelected ? DEEP_BLUE_PRIMARY : "#0f172a", borderRadius: 999, minHeight: 24, padding: "0 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                          >
                            {allSelected ? "Bỏ nhóm" : "Chọn nhóm"}
                          </button>
                        </div>
                        {expanded && (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, padding: "0 10px 10px" }}>
                            {group.fields.map((field) => (
                              <label key={field.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#0f172a", cursor: "pointer" }}>
                                <input type="checkbox" checked={exportSelectedFields.includes(field.key)} onChange={() => toggleExportField(field.key)} />
                                {field.label}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ border: "1px solid #dbe4ee", borderRadius: 14, padding: 14, background: "#ffffff", display: "grid", gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Preview & Export</div>

                <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, overflowX: "auto", overflowY: "hidden" }}>
                  <table style={{ width: "100%", minWidth: 320, borderCollapse: "collapse", fontSize: 12 }}>
                    <thead style={{ background: "#f1f5f9" }}>
                      <tr>
                        {exportPreviewColumns.map((columnKey) => (
                          <th key={columnKey} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 800, color: "#0f172a", borderBottom: "1px solid #cbd5e1" }}>
                            {exportFieldLabelMap.get(columnKey) ?? columnKey}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {exportPreviewRows.length === 0 ? (
                        <tr>
                          <td colSpan={exportPreviewColumns.length} style={{ padding: "10px", color: "#64748b" }}>
                            Không có dữ liệu phù hợp bộ lọc hiện tại.
                          </td>
                        </tr>
                      ) : (
                        exportPreviewRows.map((row) => (
                          <tr key={row.key}>
                            {row.values.map((value, index) => (
                              <td key={`${row.key}-${index}`} style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0", color: "#0f172a" }}>
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#0f172a", cursor: "pointer" }}><input type="checkbox" checked={exportIncludeLogo} onChange={() => setExportIncludeLogo((prev) => !prev)} /> Bao gồm logo</label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#0f172a", cursor: "pointer" }}><input type="checkbox" checked={exportIncludeSignature} onChange={() => setExportIncludeSignature((prev) => !prev)} /> Bao gồm chữ ký</label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#0f172a", cursor: "pointer" }}><input type="checkbox" checked={exportPasswordProtect} onChange={() => setExportPasswordProtect((prev) => !prev)} /> Bảo vệ bằng mật khẩu</label>
                </div>

                <button
                  type="button"
                  onClick={() => setExportModalOpen(true)}
                  style={{ width: "100%", border: "1px solid #cbd5e1", background: LIGHT_BLUE_SOFTEN, color: DEEP_BLUE_PRIMARY, borderRadius: 12, minHeight: 42, fontSize: 14, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <Eye size={16} /> Xem trước bảng sẽ xuất
                </button>

                <div ref={exportDownloadMenuRef} style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setExportDownloadMenuOpen((prev) => !prev)}
                    style={{ width: "100%", border: "none", background: DEEP_BLUE_PRIMARY, color: "#ffffff", borderRadius: 12, minHeight: 44, fontSize: 18, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    <Download size={16} /> Export Now <ChevronDown size={16} style={{ transform: exportDownloadMenuOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s ease" }} />
                  </button>

                  {exportDownloadMenuOpen && (
                    <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 8px)", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12, boxShadow: "0 12px 28px rgba(15, 23, 42, 0.15)", overflow: "hidden", zIndex: 45 }}>
                      {[
                        { value: "pdf" as ReportFormat, label: "Tải PDF", icon: <FileText size={14} /> },
                        { value: "excel" as ReportFormat, label: "Tải Excel", icon: <FileSpreadsheet size={14} /> },
                        { value: "csv" as ReportFormat, label: "Tải CSV", icon: <Table size={14} /> },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setExportDownloadMenuOpen(false);
                            setReportFormat(option.value);
                            setReportType(exportResolvedReportType);
                            exportReport({
                              reportType: exportResolvedReportType,
                              format: option.value,
                              councilId: exportScopeMode === "per-council" ? reportCouncilId : undefined,
                            });
                          }}
                          style={{ width: "100%", border: "none", borderTop: "1px solid #e2e8f0", background: "#ffffff", minHeight: 42, padding: "0 12px", fontSize: 13, fontWeight: 700, color: "#0f172a", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "flex-start", gap: 8 }}
                        >
                          {option.icon}
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 4, display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Export gần đây</div>
                  {recentExports.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#64748b" }}>Chưa có export gần đây.</div>
                  ) : (
                    recentExports.slice(0, 3).map((item, index) => (
                      <div key={`${String(item?.name ?? item?.fileName ?? "export")}-${index}`} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{String(item?.name ?? item?.fileName ?? "Export")}</div>
                        <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{String(item?.timestamp ?? item?.createdAt ?? "-")}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        </section>
      )}

        {exportModalOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.45)",
              zIndex: 4005,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 18,
            }}
            onClick={() => setExportModalOpen(false)}
          >
            <div
              style={{
                width: "min(1120px, calc(100vw - 24px))",
                maxHeight: "calc(100vh - 36px)",
                overflowY: "auto",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 14,
                padding: 16,
                boxShadow: "0 20px 44px rgba(2, 6, 23, 0.24)",
                display: "grid",
                gap: 12,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>Xem trước bảng sẽ xuất</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                    Kiểm tra phạm vi, template, định dạng và các trường sẽ được đưa vào file trước khi tải xuống.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    style={{ border: "1px solid #cbd5e1", background: "#f8fafc", color: "#64748b", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", height: "fit-content", display: "inline-flex", alignItems: "center", gap: 8 }}
                    onClick={() => setExportModalOpen(false)}
                  >
                    <X size={14} /> Đóng
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#f8fafc" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Phạm vi</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                    {exportScopeOptions.find((option) => option.value === exportScopeMode)?.label ?? exportScopeMode}
                  </div>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#f8fafc" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Template</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                    {exportTemplateOptions.find((template) => template.value === exportTemplateMode)?.label ?? exportTemplateMode}
                  </div>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#f8fafc" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Định dạng</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{reportFormat.toUpperCase()}</div>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#f8fafc" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Số field</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{exportSelectedFields.length}</div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>Các trường sẽ xuất</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {exportPreviewModalColumns.map((fieldKey) => (
                    <span key={fieldKey} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                      {exportFieldLabelMap.get(fieldKey) ?? fieldKey}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#ffffff" }}>
                <div style={{ overflowX: "auto", overflowY: "hidden" }}>
                  <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 12 }}>
                    <thead style={{ background: "#f1f5f9" }}>
                      <tr>
                        {exportPreviewModalColumns.map((columnKey) => (
                          <th key={columnKey} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 800, color: "#0f172a", borderBottom: "1px solid #cbd5e1" }}>
                            {exportFieldLabelMap.get(columnKey) ?? columnKey}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {exportPreviewModalRows.length === 0 ? (
                        <tr>
                          <td colSpan={exportPreviewModalColumns.length} style={{ padding: "10px", color: "#64748b" }}>
                            Không có dữ liệu phù hợp với bộ lọc hiện tại.
                          </td>
                        </tr>
                      ) : (
                        exportPreviewModalRows.map((row) => (
                          <tr key={row.key}>
                            {row.values.map((value, index) => (
                              <td key={`${row.key}-${index}`} style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0", color: "#0f172a" }}>
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
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
                  style={{ border: "1px solid #cbd5e1", background: "#f8fafc", color: "#64748b", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", height: "fit-content", display: "inline-flex", alignItems: "center", gap: 8 }}
                  onClick={() => { setPreviewModalType(null); setShowDownloadDropdown(false); }}
                >
                  <X size={14} /> Đóng
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
                      <div style={{ fontWeight: "bold" }}>I. Thông tin bảo vệ:</div>
                      <div style={{ display: "grid", gap: 8, padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                        <div><strong>Giảng viên hướng dẫn:</strong> {selectedTopic.supervisorName || selectedTopic.supervisorLecturerName || "-"}</div>
                        <div><strong>Chủ tịch hội đồng:</strong> {selectedTopic.chairName || selectedTopic.committeeChairName || "-"}</div>
                        <div><strong>Thư ký hội đồng:</strong> {selectedTopic.secretaryName || selectedTopic.committeeSecretaryName || "-"}</div>
                        <div><strong>Phản biện:</strong> {selectedTopic.reviewerName || selectedTopic.committeeReviewerName || "-"}</div>
                        {selectedTopic.room && <div><strong>Phòng:</strong> {selectedTopic.room}</div>}
                        {selectedTopic.startTime && <div><strong>Thời gian:</strong> {selectedTopic.startTime} {selectedTopic.endTime ? `- ${selectedTopic.endTime}` : ""}</div>}
                      </div>
                      <div style={{ fontWeight: "bold" }}>II. Điểm thành phần:</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                        <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 10, background: "#ffffff" }}>
                          <div style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}>Chủ tịch</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: "#1e3a5f", marginTop: 6 }}>{getLockedScoreValue(selectedTopic, selectedTopic.scoreCt)}</div>
                        </div>
                        <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 10, background: "#ffffff" }}>
                          <div style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}>Thư ký</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: "#1e3a5f", marginTop: 6 }}>{getLockedScoreValue(selectedTopic, selectedTopic.scoreTk)}</div>
                        </div>
                        <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 10, background: "#ffffff" }}>
                          <div style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}>Phản biện</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: "#1e3a5f", marginTop: 6 }}>{getLockedScoreValue(selectedTopic, selectedTopic.scorePb)}</div>
                        </div>
                        <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 10, background: "#ffffff" }}>
                          <div style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}>GVHD</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: "#1e3a5f", marginTop: 6 }}>{getLockedScoreValue(selectedTopic, selectedTopic.scoreGvhd ?? selectedTopic.topicSupervisorScore)}</div>
                        </div>
                      </div>
                      {selectedTopic.commentTk || selectedTopic.commentCt && (
                        <>
                          <div style={{ fontWeight: "bold" }}>III. Nhận xét chung:</div>
                          <div style={{ whiteSpace: "pre-wrap", padding: 12, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                            {selectedTopic.commentTk || selectedTopic.commentCt || "Không có nhận xét"}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      <div style={{ fontWeight: "bold" }}>I. Điểm đánh giá của phản biện:</div>
                      <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 12, background: "#f8fafc" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                          <div><strong>Điểm phản biện:</strong> {getLockedScoreValue(selectedTopic, selectedTopic.scorePb)}</div>
                          <div><strong>Phản biện:</strong> {selectedTopic.reviewerName || selectedTopic.committeeReviewerName || "-"}</div>
                        </div>
                      </div>
                      <div style={{ fontWeight: "bold" }}>II. Nội dung nhận xét phản biện:</div>
                      <div style={{ whiteSpace: "pre-wrap", padding: 12, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                        {selectedTopic.commentPb || "Không có nhận xét phản biện chi tiết. Vui lòng tải file PDF để xem đầy đủ."}
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
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <User size={14} color="#0f172a" />
                    <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#475569" }}>Sinh viên</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginTop: 6 }}>{selectedTopic.studentName ?? "-"}</div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{selectedTopic.studentCode ?? "-"}</div>
                </div>
                <div style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Users size={14} color="#0f172a" />
                    <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#475569" }}>Hội đồng</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginTop: 6 }}>{selectedCommittee?.name ?? selectedTopic.committeeName ?? selectedTopic.committeeCode ?? "-"}</div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{selectedTopic.committeeCode ?? selectedCommittee?.code ?? "-"}</div>
                </div>
                <div style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Star size={14} color="#f59e0b" fill="#f59e0b" />
                    <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#475569" }}>Điểm cuối</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: DEEP_BLUE_PRIMARY, marginTop: 6 }}>{getTopicScoreDisplay(selectedTopic)}</div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{getTopicGradeDisplay(selectedTopic)}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                <div style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <FileText size={13} color="#0f172a" />
                    <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase" }}>Giảng viên hướng dẫn</div>
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 700 }}>{selectedTopic.supervisorLecturerName ?? selectedTopic.supervisorName ?? "-"}</div>
                </div>
                <div style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <User size={13} color="#0f172a" />
                    <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase" }}>Chủ tịch hội đồng</div>
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 700 }}>{selectedCommittee?.chair ?? "-"}</div>
                </div>
                <div style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <FileText size={13} color="#0f172a" />
                    <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase" }}>Ủy viên thư ký</div>
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 700 }}>{selectedCommittee?.secretary ?? "-"}</div>
                </div>
                <div style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <MessageSquare size={13} color="#0f172a" />
                    <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase" }}>Ủy viên phản biện</div>
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 700 }}>{selectedCommittee?.reviewer ?? "-"}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12 }}>
                <section style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <FileText size={14} color="#0f172a" />
                    <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Thông tin đề tài</div>
                  </div>
                  <div style={{ display: "grid", gap: 8, marginTop: 10, fontSize: 13, color: "#0f172a" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: "#475569", fontWeight: 600, minWidth: 90 }}>Mã:</span> <strong>{selectedTopic.topicCode ?? "-"}</strong></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: "#475569", fontWeight: 600, minWidth: 90 }}>Lớp:</span> <strong>{selectedTopic.className ?? "-"}</strong></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: "#475569", fontWeight: 600, minWidth: 90 }}>Khoá:</span> <strong>{selectedTopic.cohortCode ?? "-"}</strong></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: "#475569", fontWeight: 600, minWidth: 90 }}>Thời gian:</span> <strong>{selectedTopic.startTime ?? "-"} - {selectedTopic.endTime ?? "-"}</strong></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: "#475569", fontWeight: 600, minWidth: 90 }}>Trạng thái:</span> <strong>{getStatusLabel(selectedTopic.status ?? (selectedTopic.isLocked ? "LOCKED" : "ONGOING"))}</strong></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: "#475569", fontWeight: 600, minWidth: 90 }}>Đã nộp:</span> <strong>{selectedTopic.submittedCount ?? 0} / {selectedTopic.requiredCount ?? 0}</strong></div>
                  </div>
                </section>

                <section style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <Paperclip size={14} color="#0f172a" />
                    <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Tệp đính kèm</div>
                  </div>
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
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <BarChart3 size={14} color="#0f172a" />
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>Bảng điểm thành phần</div>
                </div>
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
                <button type="button" onClick={() => downloadCommitteeReport(selectedCommittee ?? { code: String(selectedTopic.committeeCode ?? "-"), name: "-", room: "-", chair: "-", secretary: "-", reviewer: "-", totalTopics: 0, scoredTopics: 0, lockedTopics: 0, status: "ONGOING", currentTopic: "-", currentStudent: "-", progressPercent: 0, estimatedCompletion: "-", delayLabel: "On time", key: String(selectedTopic.committeeCode ?? "-") }, "minutes", "pdf")} style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", padding: "8px 14px", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><Download size={14} /> Tải biên bản</button>
                <button type="button" onClick={() => downloadCommitteeReport(selectedCommittee ?? { code: String(selectedTopic.committeeCode ?? "-"), name: "-", room: "-", chair: "-", secretary: "-", reviewer: "-", totalTopics: 0, scoredTopics: 0, lockedTopics: 0, status: "ONGOING", currentTopic: "-", currentStudent: "-", progressPercent: 0, estimatedCompletion: "-", delayLabel: "On time", key: String(selectedTopic.committeeCode ?? "-") }, "review", "pdf")} style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", padding: "8px 14px", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><Download size={14} /> Tải nhận xét</button>
                <button type="button" onClick={() => setTopicDetailModalOpen(false)} style={{ border: "none", background: DEEP_BLUE_PRIMARY, color: "#ffffff", padding: "8px 14px", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><X size={14} /> Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CommitteeOperationsManagement;
