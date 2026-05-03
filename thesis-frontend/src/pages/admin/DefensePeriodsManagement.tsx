import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle,
  Clock3,
  Columns3,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  History,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Shield,
  Trash2,
  Rows3,
  Workflow,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchData } from "../../api/fetchData";
import { useToast } from "../../context/useToast";
import type { ApiResponse } from "../../types/api";
import {
  pickCaseInsensitiveValue,
  readEnvelopeData,
  readEnvelopeErrorMessages,
  readEnvelopeMessage,
  readEnvelopeSuccess,
  readEnvelopeWarningMessages,
} from "../../utils/api-envelope";
import {
  getActiveDefensePeriodId,
  setActiveDefensePeriodId,
} from "../../utils/defensePeriod";
import DefenseTermLecturersSection, {
  type DefenseTermLecturersSectionHandle,
} from "../../components/admin/DefenseTermLecturersSection";
import DefenseTermStudentsSection, {
  type DefenseTermStudentsSectionHandle,
} from "../../components/admin/DefenseTermStudentsSection";
import "./Dashboard.css";

type DefenseTermStatus =
  | "Draft"
  | "Preparing"
  | "Finalized"
  | "Published"
  | "Archived";

type DetailTab = "overview" | "state" | "workflow" | "history";

type RoadmapLayout = "horizontal" | "vertical";

type RoadmapStepStatus = "completed" | "in-progress" | "pending";

type LifecycleAction =
  | "SYNC"
  | "FINALIZE"
  | "PUBLISH"
  | "ROLLBACK"
  | "ARCHIVE"
  | "REOPEN";

interface DefensePeriodRow {
  periodId: number;
  code: string;
  name: string;
  roundIndex: number;
  startDate: string;
  endDate: string;
  status: DefenseTermStatus;
  createdAt: string;
  updatedAt: string;
}

interface DefensePeriodSnapshot {
  detail: Record<string, unknown>;
  dashboard: Record<string, unknown>;
  config: Record<string, unknown>;
  state: Record<string, unknown>;
  workflow: Record<string, unknown>;
}

const statusOptions: DefenseTermStatus[] = [
  "Draft",
  "Preparing",
  "Finalized",
  "Published",
  "Archived",
];

const badgeStyles: Record<DefenseTermStatus, { bg: string; text: string }> = {
  Draft: { bg: "#f8fafc", text: "#64748b" },
  Preparing: { bg: "#fffbeb", text: "#b45309" },
  Finalized: { bg: "#fff7ed", text: "#c2410c" },
  Published: { bg: "#f0fdf4", text: "#166534" },
  Archived: { bg: "#f8fafc", text: "#64748b" },
};

const workflowBlueprint = [
  {
    key: "TOPIC_REGISTRATION",
    title: "Đăng ký đề tài",
    description: "Tiếp nhận và khóa danh sách đề tài cho đợt bảo vệ.",
  },
  {
    key: "PROGRESS_MANAGEMENT",
    title: "Quản lý tiến độ",
    description: "Theo dõi milestone học thuật và hồ sơ trước bảo vệ.",
  },
  {
    key: "ELIGIBILITY_GATE",
    title: "Hoàn tất đủ điều kiện bảo vệ",
    description: "Xác nhận danh sách sinh viên, giảng viên đủ điều kiện.",
  },
  {
    key: "COUNCIL_SETUP",
    title: "Thiết lập hội đồng",
    description: "Thực hiện tại module Quản lý hội đồng.",
  },
  {
    key: "DEFENSE_SCORING",
    title: "Bảo vệ x Chấm điểm",
    description: "Theo dõi tiến độ chấm điểm ở dashboard giám sát.",
  },
  {
    key: "POST_DEFENSE",
    title: "Hậu bảo vệ",
    description: "Publish điểm, revision và báo cáo hậu kỳ.",
  },
];

const pageStyles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 20,
    background: "#ffffff",
    overflowX: "hidden",
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    color: "#0f172a",
  },
  shell: {
    maxWidth: 1360,
    width: "100%",
    margin: "0 auto",
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: 18,
    marginBottom: 16,
    background: "#ffffff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  heroGlow: {
    display: "none",
  },
  sectionCard: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    background: "#ffffff",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
  },
  statCard: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: 14,
    background: "#ffffff",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
    minHeight: 96,
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 700,
  },
  toolbar: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 2fr) minmax(0, 1.05fr) minmax(150px, 1fr) minmax(150px, 1fr)",
    gap: 12,
    alignItems: "center",
    padding: 14,
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.8fr) minmax(340px, 1fr)",
    gap: 16,
  },
  panel: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    background: "#ffffff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    overflow: "hidden",
  },
  detailPanel: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    background: "#ffffff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    padding: 16,
    position: "sticky",
    top: 14,
    height: "fit-content",
  },
  primaryButton: {
    border: "none",
    borderRadius: 10,
    padding: "10px 14px",
    minHeight: 40,
    fontWeight: 700,
    fontSize: 14,
    color: "#ffffff",
    cursor: "pointer",
    background: "#f37021",
    boxShadow: "0 2px 8px rgba(243,112,33,0.2)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    whiteSpace: "nowrap",
    lineHeight: 1.2,
    flexShrink: 0,
  },
  ghostButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 14px",
    minHeight: 40,
    fontWeight: 700,
    fontSize: 14,
    color: "#0f172a",
    cursor: "pointer",
    background: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    whiteSpace: "nowrap",
    lineHeight: 1.2,
    flexShrink: 0,
  },
  dangerButton: {
    border: "1px solid #fecaca",
    borderRadius: 10,
    padding: "10px 14px",
    minHeight: 40,
    fontWeight: 700,
    fontSize: 14,
    color: "#b91c1c",
    cursor: "pointer",
    background: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    whiteSpace: "nowrap",
    lineHeight: 1.2,
    flexShrink: 0,
  },
  iconActionButton: {
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
  },
  iconDangerButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#ef4444",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
};

const selectControlStyle: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "13px 40px 13px 12px",
  backgroundColor: "#ffffff",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  backgroundSize: "14px",
  color: "#0f172a",
};

const tableHeadCellStyle: React.CSSProperties = {
  borderBottom: "1px solid #e2e8f0",
  padding: "12px 14px",
  fontSize: 12,
  color: "#0f172a",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  background: "#ffffff",
};

const tableCellStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
};

const roadmapStatusTheme: Record<
  RoadmapStepStatus,
  {
    dotBorder: string;
    dotBg: string;
    cardBorder: string;
    cardBg: string;
    text: string;
    line: string;
  }
> = {
  completed: {
    dotBorder: "#bbf7d0",
    dotBg: "#f0fdf4",
    cardBorder: "#bbf7d0",
    cardBg: "#ffffff",
    text: "#166534",
    line: "#bbf7d0",
  },
  "in-progress": {
    dotBorder: "#f37021",
    dotBg: "#fff7ed",
    cardBorder: "#f37021",
    cardBg: "#ffffff",
    text: "#c2410c",
    line: "#f37021",
  },
  pending: {
    dotBorder: "#cbd5e1",
    dotBg: "#ffffff",
    cardBorder: "#cbd5e1",
    cardBg: "#ffffff",
    text: "#475569",
    line: "#cbd5e1",
  },
};

const roadmapStatusLabel: Record<RoadmapStepStatus, string> = {
  completed: "Hoàn thành",
  "in-progress": "Đang thực hiện",
  pending: "Chờ xử lý",
};

const asString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return fallback;
};

const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const asBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n"].includes(normalized)) {
      return false;
    }
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return fallback;
};

const toIsoDate = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
};

const toLocalDateTime = (value: unknown): string => {
  if (typeof value !== "string") {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return asString(value, "-");
  }
  return parsed.toLocaleString("vi-VN");
};

const pickValue = pickCaseInsensitiveValue;

const readEnvelopeWarnings = readEnvelopeWarningMessages;

const readEnvelopeErrors = readEnvelopeErrorMessages;

const normalizeStatus = (value: unknown): DefenseTermStatus => {
  const normalized = asString(value).toUpperCase();
  if (normalized.includes("ARCHIVE")) return "Archived";
  if (normalized.includes("PUBLISH")) return "Published";
  if (normalized.includes("FINAL")) return "Finalized";
  if (normalized.includes("PREPAR") || normalized.includes("ACTIVE")) {
    return "Preparing";
  }
  return "Draft";
};

const parseRoundIndex = (code: string, fallback: number): number => {
  const parts = code.split(".");
  if (parts.length >= 2) {
    const round = Number(parts[1]);
    if (Number.isFinite(round) && round > 0) {
      return round;
    }
  }
  return fallback;
};

const makeIdempotencyKey = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

const isNoDataMessage = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes("không có dữ liệu") ||
    normalized.includes("khong co du lieu") ||
    normalized.includes("no data") ||
    normalized.includes("empty") ||
    normalized.includes("not found")
  );
};

const isNoDataEnvelope = (
  response: ApiResponse<unknown> | null | undefined,
): boolean => {
  if (!response) {
    return false;
  }

  const message = asString(readEnvelopeMessage(response));
  if (message && isNoDataMessage(message)) {
    return true;
  }

  const errors = readEnvelopeErrors(response);
  return errors.some((error) => isNoDataMessage(error));
};

const defensePeriodApi = {
  list: () =>
    fetchData<ApiResponse<unknown>>("/defense-periods", {
      method: "GET",
    }),
  create: (payload: {
    name: string;
    startDate: string;
    endDate?: string | null;
    status: DefenseTermStatus;
  }) =>
    fetchData<ApiResponse<unknown>>("/defense-periods", {
      method: "POST",
      body: payload,
    }),
  update: (
    periodId: number,
    payload: {
      name: string;
      startDate: string;
      endDate?: string | null;
      status: DefenseTermStatus;
    },
  ) =>
    fetchData<ApiResponse<unknown>>(`/defense-periods/${periodId}`, {
      method: "PATCH",
      body: payload,
    }),
  remove: (periodId: number) =>
    fetchData<ApiResponse<unknown>>(`/defense-periods/${periodId}`, {
      method: "DELETE",
    }),
  snapshot: (periodId: number) =>
    fetchData<ApiResponse<Record<string, unknown>>>(
      `/defense-periods/${periodId}/snapshot`,
      {
        method: "GET",
      },
    ),
  lifecycle: (
    periodId: number,
    action: LifecycleAction,
    payload?: Record<string, unknown>,
    idempotencyKey?: string,
  ) =>
    fetchData<ApiResponse<unknown>>(`/defense-periods/${periodId}/lifecycle`, {
      method: "POST",
      body: {
        action,
        ...(payload ?? {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
      headers: idempotencyKey
        ? { "Idempotency-Key": idempotencyKey }
        : undefined,
    }),
};

const DefensePeriodsManagement: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

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

  const [rows, setRows] = useState<DefensePeriodRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(() =>
    getActiveDefensePeriodId(),
  );
  const [snapshotMap, setSnapshotMap] = useState<
    Record<number, DefensePeriodSnapshot>
  >({});
  const studentsSectionRef = useRef<DefenseTermStudentsSectionHandle | null>(
    null,
  );
  const lecturersSectionRef = useRef<DefenseTermLecturersSectionHandle | null>(
    null,
  );

  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [showForm, setShowForm] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState<number | null>(null);
  const [allowFinalizeAfterWarning, setAllowFinalizeAfterWarning] =
    useState(false);
  const [roadmapLayout, setRoadmapLayout] = useState<RoadmapLayout>("vertical");
  const [roadmapAnimated, setRoadmapAnimated] = useState(false);
  const roadmapTrackRef = useRef<HTMLDivElement | null>(null);

  const [formState, setFormState] = useState({
    name: "",
    startDate: "",
    endDate: "",
    status: "Draft" as DefenseTermStatus,
  });

  const normalizePeriodRow = useCallback(
    (item: Record<string, unknown>, index: number): DefensePeriodRow => {
      const periodId = asNumber(
        pickValue(item, ["defenseTermId", "DefenseTermId", "id", "Id"], 0),
        0,
      );

      const rawCode = asString(
        pickValue(
          item,
          ["defenseTermCode", "DefenseTermCode", "code", "Code"],
          "",
        ),
      );

      const startDate = toIsoDate(
        pickValue(item, ["startDate", "StartDate"], ""),
      );
      const endDate = toIsoDate(pickValue(item, ["endDate", "EndDate"], ""));

      const code =
        rawCode ||
        (startDate
          ? `${startDate.slice(0, 4)}.${index + 1}`
          : `PERIOD-${periodId || index + 1}`);

      return {
        periodId,
        code,
        name: asString(pickValue(item, ["name", "Name"], "Đợt bảo vệ")),
        roundIndex: parseRoundIndex(code, index + 1),
        startDate,
        endDate,
        status: normalizeStatus(pickValue(item, ["status", "Status"], "Draft")),
        createdAt: toLocalDateTime(
          pickValue(item, ["createdAt", "CreatedAt"], ""),
        ),
        updatedAt: toLocalDateTime(
          pickValue(
            item,
            ["lastUpdated", "LastUpdated", "updatedAt", "UpdatedAt"],
            "",
          ),
        ),
      };
    },
    [],
  );

  const notifyApiFailures = useCallback(
    (response: ApiResponse<unknown> | null | undefined, fallback: string) => {
      const warnings = readEnvelopeWarnings(response);
      if (warnings.length > 0) {
        notifyWarning(warnings.join(" | "));
      }

      if (!readEnvelopeSuccess(response)) {
        const errors = readEnvelopeErrors(response);
        const message = asString(readEnvelopeMessage(response), fallback);
        notifyError(errors[0] || message || fallback);
        return true;
      }

      const message = asString(readEnvelopeMessage(response));
      if (message) {
        notifyInfo(message);
      }
      return false;
    },
    [notifyError, notifyInfo, notifyWarning],
  );

  const loadRows = useCallback(async () => {
    setLoadingRows(true);
    try {
      const response = await defensePeriodApi.list();

      if (!readEnvelopeSuccess(response) && isNoDataEnvelope(response)) {
        setRows([]);
        setSelectedPeriodId(null);
        return;
      }

      if (notifyApiFailures(response, "Không tải được danh sách đợt bảo vệ.")) {
        return;
      }

      const payload = readEnvelopeData<unknown>(response);
      const list = Array.isArray(payload)
        ? payload
        : payload && typeof payload === "object"
          ? ((payload as { items?: unknown[]; Items?: unknown[] }).items ??
            (payload as { Items?: unknown[] }).Items ??
            [])
          : [];

      const mapped = list
        .filter((item) => item && typeof item === "object")
        .map((item, index) =>
          normalizePeriodRow(item as Record<string, unknown>, index),
        )
        .filter((item) => item.periodId > 0)
        .sort((a, b) => b.startDate.localeCompare(a.startDate));

      setRows(mapped);
      setSelectedPeriodId((prev) => {
        if (prev && mapped.some((item) => item.periodId === prev)) {
          return prev;
        }
        return mapped[0]?.periodId ?? null;
      });
    } catch {
      notifyError("Không thể kết nối API danh sách đợt.");
    } finally {
      setLoadingRows(false);
    }
  }, [normalizePeriodRow, notifyApiFailures, notifyError]);

  const loadSnapshot = useCallback(
    async (periodId: number, force = false) => {
      if (!force && snapshotMap[periodId]) {
        return;
      }

      setLoadingSnapshot(true);
      try {
        const response = await defensePeriodApi.snapshot(periodId);

        if (!readEnvelopeSuccess(response) && isNoDataEnvelope(response)) {
          setSnapshotMap((prev) => ({
            ...prev,
            [periodId]: {
              detail: {},
              dashboard: {},
              config: {},
              state: {},
              workflow: {},
            },
          }));
          return;
        }

        if (notifyApiFailures(response, "Không tải được snapshot đợt.")) {
          return;
        }

        const payload =
          readEnvelopeData<Record<string, unknown>>(response) ?? {};
        const snapshot: DefensePeriodSnapshot = {
          detail: pickValue(payload, ["detail", "Detail"], {}),
          dashboard: pickValue(payload, ["dashboard", "Dashboard"], {}),
          config: pickValue(payload, ["config", "Config"], {}),
          state: pickValue(payload, ["state", "State"], {}),
          workflow: pickValue(payload, ["workflow", "Workflow"], {}),
        };

        setSnapshotMap((prev) => ({
          ...prev,
          [periodId]: snapshot,
        }));
      } catch {
        notifyError("Lỗi kết nối khi tải snapshot đợt bảo vệ.");
      } finally {
        setLoadingSnapshot(false);
      }
    },
    [notifyApiFailures, notifyError, snapshotMap],
  );

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (selectedPeriodId == null) {
      return;
    }
    void loadSnapshot(selectedPeriodId);
  }, [selectedPeriodId, loadSnapshot]);

  useEffect(() => {
    setActiveDefensePeriodId(selectedPeriodId);
  }, [selectedPeriodId]);

  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      const normalizedKeyword = keyword.trim().toLowerCase();
      const hitKeyword =
        normalizedKeyword.length === 0 ||
        item.code.toLowerCase().includes(normalizedKeyword) ||
        item.name.toLowerCase().includes(normalizedKeyword);
      const hitStatus = statusFilter === "all" || item.status === statusFilter;
      const hitFrom =
        !dateFrom || !item.startDate || item.startDate >= dateFrom;
      const hitTo = !dateTo || !item.endDate || item.endDate <= dateTo;
      return hitKeyword && hitStatus && hitFrom && hitTo;
    });
  }, [rows, keyword, statusFilter, dateFrom, dateTo]);

  const selectedRow = useMemo(
    () => rows.find((item) => item.periodId === selectedPeriodId) ?? null,
    [rows, selectedPeriodId],
  );

  const selectedSnapshot =
    selectedPeriodId != null ? snapshotMap[selectedPeriodId] : undefined;

  const statePayload = useMemo(
    () => selectedSnapshot?.state ?? {},
    [selectedSnapshot],
  );
  const dashboardPayload = useMemo(
    () => selectedSnapshot?.dashboard ?? {},
    [selectedSnapshot],
  );
  const configPayload = useMemo(
    () => selectedSnapshot?.config ?? {},
    [selectedSnapshot],
  );
  const workflowPayload = useMemo(
    () => selectedSnapshot?.workflow ?? {},
    [selectedSnapshot],
  );

  const configRooms = useMemo(() => {
    const rooms = pickValue(configPayload, ["rooms", "Rooms"], [] as unknown[]);
    if (!Array.isArray(rooms)) {
      return [] as string[];
    }
    return rooms.map((item) => asString(item)).filter(Boolean);
  }, [configPayload]);

  const allowedActions = useMemo(() => {
    const raw = pickValue(
      statePayload,
      ["allowedActions", "AllowedActions"],
      [] as unknown[],
    );
    if (!Array.isArray(raw)) {
      return [] as string[];
    }
    return raw.map((item) => asString(item).toUpperCase()).filter(Boolean);
  }, [statePayload]);

  const canRunAction = useCallback(
    (action: string) => {
      if (allowedActions.length === 0) {
        return true;
      }
      return allowedActions.includes(action.toUpperCase());
    },
    [allowedActions],
  );

  const openCommitteeManagement = useCallback(() => {
    if (selectedPeriodId == null) {
      notifyWarning("Vui long chon mot dot truoc khi mo module hoi dong.");
      return;
    }

    setActiveDefensePeriodId(selectedPeriodId);
    navigate(`/admin/committees/management?periodId=${selectedPeriodId}`);
  }, [navigate, notifyWarning, selectedPeriodId]);

  const heroStats = useMemo(
    () => [
      {
        label: "Tổng đợt",
        value: rows.length,
        note: "Tất cả trạng thái",
      },
      {
        label: "Đang vận hành",
        value: rows.filter((item) => item.status === "Preparing").length,
        note: "Đang chuẩn bị bảo vệ",
      },
      {
        label: "Đã finalize",
        value: rows.filter((item) =>
          ["Finalized", "Published", "Archived"].includes(item.status),
        ).length,
        note: "Danh sách đã chốt",
      },
      {
        label: "Đã publish",
        value: rows.filter((item) =>
          ["Published", "Archived"].includes(item.status),
        ).length,
        note: "Đã công bố kết quả",
      },
    ],
    [rows],
  );

  const openCreate = () => {
    setEditingPeriodId(null);
    setFormState({
      name: "",
      startDate: "",
      endDate: "",
      status: "Draft",
    });
    setShowForm(true);
  };

  const openEdit = (row: DefensePeriodRow) => {
    setEditingPeriodId(row.periodId);
    setFormState({
      name: row.name,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
    });
    setShowForm(true);
  };

  const resetFilters = () => {
    setKeyword("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const saveForm = async () => {
    const name = formState.name.trim();
    if (!name || !formState.startDate) {
      notifyError("Tên đợt và ngày bắt đầu là bắt buộc.");
      return;
    }

    const payload = {
      name,
      startDate: formState.startDate,
      endDate: formState.endDate || null,
      status: formState.status,
    };

    setActiveAction(editingPeriodId ? "Cập nhật đợt" : "Tạo đợt");
    try {
      const response = editingPeriodId
        ? await defensePeriodApi.update(editingPeriodId, payload)
        : await defensePeriodApi.create(payload);

      if (notifyApiFailures(response, "Không lưu được đợt bảo vệ.")) {
        return;
      }

      const data = readEnvelopeData<Record<string, unknown>>(response);
      const periodIdFromResponse = asNumber(
        pickValue(data, ["defenseTermId", "DefenseTermId", "id", "Id"], 0),
      );

      notifySuccess(
        editingPeriodId ? "Đã cập nhật đợt bảo vệ." : "Đã tạo đợt bảo vệ.",
      );
      setShowForm(false);
      await loadRows();

      if (periodIdFromResponse > 0) {
        setSelectedPeriodId(periodIdFromResponse);
        await loadSnapshot(periodIdFromResponse, true);
      }
    } catch {
      notifyError("Lỗi kết nối khi lưu đợt bảo vệ.");
    } finally {
      setActiveAction(null);
    }
  };

  const removePeriod = async (row: DefensePeriodRow) => {
    if (!window.confirm(`Xóa đợt ${row.code}?`)) {
      return;
    }

    setActiveAction("Xóa đợt");
    try {
      const response = await defensePeriodApi.remove(row.periodId);
      if (notifyApiFailures(response, "Không xóa được đợt bảo vệ.")) {
        return;
      }

      notifySuccess("Đã xóa đợt bảo vệ.");
      await loadRows();
      setSnapshotMap((prev) => {
        const next = { ...prev };
        delete next[row.periodId];
        return next;
      });
    } catch {
      notifyError("Lỗi kết nối khi xóa đợt bảo vệ.");
    } finally {
      setActiveAction(null);
    }
  };

  const executeLifecycle = async (
    action: LifecycleAction,
    payload: Record<string, unknown> = {},
  ) => {
    if (selectedPeriodId == null) {
      notifyWarning("Vui lòng chọn một đợt trước khi thao tác.");
      return;
    }

    setActiveAction(action);
    const idempotencyKey = makeIdempotencyKey(action);

    try {
      const response = await defensePeriodApi.lifecycle(
        selectedPeriodId,
        action,
        payload,
        idempotencyKey,
      );

      if (notifyApiFailures(response, `Thao tác ${action} thất bại.`)) {
        return;
      }

      const replay = asBoolean(
        (response?.idempotencyReplay ?? response?.IdempotencyReplay) as unknown,
      );

      if (replay) {
        notifyInfo(`Yêu cầu ${action} đã xử lý trước đó (idempotency replay).`);
      } else {
        notifySuccess(`Thao tác ${action} thành công.`);
      }

      await loadRows();
      await loadSnapshot(selectedPeriodId, true);
    } catch {
      notifyError(`Lỗi kết nối khi thực hiện ${action}.`);
    } finally {
      setActiveAction(null);
    }
  };

  const handleSync = () =>
    void executeLifecycle("SYNC", {
      retryOnFailure: true,
    });

  const handleFinalize = () => {
    if (!window.confirm("Xác nhận finalize đợt bảo vệ?")) {
      return;
    }
    void executeLifecycle("FINALIZE", {
      allowFinalizeAfterWarning,
    });
  };

  const handlePublish = () => {
    if (!window.confirm("Xác nhận publish kết quả toàn đợt?")) {
      return;
    }
    void executeLifecycle("PUBLISH");
  };

  const handleRollback = () => {
    const target = window.prompt(
      "Nhập target rollback: PUBLISH | FINALIZE | ALL",
      "PUBLISH",
    );
    if (!target) {
      return;
    }

    const normalizedTarget = target.trim().toUpperCase();
    if (!["PUBLISH", "FINALIZE", "ALL"].includes(normalizedTarget)) {
      notifyWarning("Target rollback không hợp lệ.");
      return;
    }

    const reason = window.prompt("Nhập lý do rollback", "Điều chỉnh nghiệp vụ");
    if (!reason || !reason.trim()) {
      notifyWarning("Rollback yêu cầu lý do.");
      return;
    }

    if (!window.confirm(`Xác nhận rollback ${normalizedTarget}?`)) {
      return;
    }

    void executeLifecycle("ROLLBACK", {
      target: normalizedTarget,
      reason: reason.trim(),
      forceUnlockScores: true,
    });
  };

  const handleArchive = () => {
    if (!window.confirm("Xác nhận archive đợt bảo vệ này?")) {
      return;
    }
    void executeLifecycle("ARCHIVE", {
      reason: "Archive từ module Quản lý đợt",
    });
  };

  const handleReopen = () => {
    if (!window.confirm("Xác nhận mở lại đợt bảo vệ?")) {
      return;
    }
    void executeLifecycle("REOPEN", {
      reason: "Reopen từ module Quản lý đợt",
    });
  };

  const dashboardNumbers = useMemo(() => {
    return {
      councilCount: asNumber(
        pickValue(dashboardPayload, ["councilCount", "CouncilCount"], 0),
      ),
      assignmentCount: asNumber(
        pickValue(dashboardPayload, ["assignmentCount", "AssignmentCount"], 0),
      ),
      resultCount: asNumber(
        pickValue(dashboardPayload, ["resultCount", "ResultCount"], 0),
      ),
      revisionCount: asNumber(
        pickValue(dashboardPayload, ["revisionCount", "RevisionCount"], 0),
      ),
      eligibleStudentCount: asNumber(
        pickValue(
          dashboardPayload,
          ["eligibleStudentCount", "EligibleStudentCount"],
          0,
        ),
      ),
      capabilityLecturerCount: asNumber(
        pickValue(
          dashboardPayload,
          ["capabilityLecturerCount", "CapabilityLecturerCount"],
          0,
        ),
      ),
      assignmentCoveragePercent: asNumber(
        pickValue(
          dashboardPayload,
          ["assignmentCoveragePercent", "AssignmentCoveragePercent"],
          0,
        ),
      ),
    };
  }, [dashboardPayload]);

  const stateFlags = useMemo(() => {
    return {
      lecturerCapabilitiesLocked: asBoolean(
        pickValue(
          statePayload,
          ["lecturerCapabilitiesLocked", "LecturerCapabilitiesLocked"],
          false,
        ),
      ),
      councilConfigConfirmed: asBoolean(
        pickValue(
          statePayload,
          ["councilConfigConfirmed", "CouncilConfigConfirmed"],
          false,
        ),
      ),
      finalized: asBoolean(
        pickValue(statePayload, ["finalized", "Finalized"], false),
      ),
      scoresPublished: asBoolean(
        pickValue(statePayload, ["scoresPublished", "ScoresPublished"], false),
      ),
      warnings: pickValue(
        statePayload,
        ["warnings", "Warnings"],
        [] as unknown[],
      )
        .map((item) => asString(item))
        .filter(Boolean),
    };
  }, [statePayload]);

  const workflowSteps = useMemo(() => {
    const raw = pickValue(workflowPayload, ["steps", "Steps"], [] as unknown[]);
    if (!Array.isArray(raw) || raw.length === 0) {
      const fallbackIndex = selectedRow
        ? selectedRow.status === "Archived"
          ? workflowBlueprint.length - 1
          : selectedRow.status === "Published"
            ? workflowBlueprint.length - 1
            : selectedRow.status === "Finalized"
              ? 4
              : selectedRow.status === "Preparing"
                ? 2
                : 0
        : 0;

      return workflowBlueprint.map((step, index) => {
        const completed = index < fallbackIndex;
        const inProgress = index === fallbackIndex;
        return {
          key: step.key,
          title: step.title,
          description: step.description,
          status: completed
            ? "completed"
            : inProgress
              ? "in-progress"
              : "pending",
          blockedReason: "",
        };
      });
    }

    return raw
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const row = item as Record<string, unknown>;
        const completed = asBoolean(
          pickValue(row, ["completed", "Completed"], false),
        );
        const enabled = asBoolean(
          pickValue(row, ["enabled", "Enabled"], false),
        );

        return {
          key: asString(pickValue(row, ["stepKey", "StepKey"], "")),
          title: asString(pickValue(row, ["stepName", "StepName"], "Bước")),
          description: "",
          status: completed ? "completed" : enabled ? "in-progress" : "pending",
          blockedReason: asString(
            pickValue(row, ["blockedReason", "BlockedReason"], ""),
          ),
        };
      });
  }, [selectedRow, workflowPayload]);

  const workflowCompletionPercent = useMemo(() => {
    const fromSnapshot = asNumber(
      pickValue(
        workflowPayload,
        ["completionPercent", "CompletionPercent"],
        -1,
      ),
      -1,
    );

    if (fromSnapshot >= 0) {
      return Math.min(100, fromSnapshot);
    }

    const completed = workflowSteps.filter(
      (step) => step.status === "completed",
    ).length;
    const hasInProgress = workflowSteps.some(
      (step) => step.status === "in-progress",
    );
    const fallback =
      ((completed + (hasInProgress ? 0.5 : 0)) /
        Math.max(1, workflowBlueprint.length)) *
      100;
    return Math.round(fallback * 10) / 10;
  }, [workflowPayload, workflowSteps]);

  const roadmapSteps = useMemo(() => {
    const statusIndex = selectedRow
      ? selectedRow.status === "Archived" || selectedRow.status === "Published"
        ? workflowBlueprint.length - 1
        : selectedRow.status === "Finalized"
          ? 4
          : selectedRow.status === "Preparing"
            ? 2
            : 0
      : 0;

    const workflowIndex = Math.min(
      workflowBlueprint.length - 1,
      workflowSteps.filter((step) => step.status === "completed").length,
    );

    const percentIndex = Math.min(
      workflowBlueprint.length - 1,
      Math.floor((workflowCompletionPercent / 100) * workflowBlueprint.length),
    );

    const activeIndex = Math.max(statusIndex, workflowIndex, percentIndex);
    const closeAll =
      selectedRow?.status === "Published" || selectedRow?.status === "Archived";

    return workflowBlueprint.map((step, index) => {
      let status: RoadmapStepStatus = "pending";
      if (closeAll || index < activeIndex) {
        status = "completed";
      } else if (index === activeIndex) {
        status = "in-progress";
      }

      return {
        ...step,
        status,
      };
    });
  }, [selectedRow, workflowCompletionPercent, workflowSteps]);

  const roadmapCompletionPercent = useMemo(() => {
    if (roadmapSteps.length === 0) {
      return 0;
    }

    const completed = roadmapSteps.filter(
      (step) => step.status === "completed",
    ).length;
    const hasInProgress = roadmapSteps.some(
      (step) => step.status === "in-progress",
    );
    const rawPercent =
      ((completed + (hasInProgress ? 0.5 : 0)) / roadmapSteps.length) * 100;
    return Math.min(100, Math.round(rawPercent * 10) / 10);
  }, [roadmapSteps]);

  const activeRoadmapStep = useMemo(
    () =>
      roadmapSteps.find((step) => step.status === "in-progress") ??
      roadmapSteps[roadmapSteps.length - 1] ??
      null,
    [roadmapSteps],
  );

  useEffect(() => {
    setRoadmapAnimated(false);
    const timer = window.setTimeout(() => setRoadmapAnimated(true), 120);
    return () => window.clearTimeout(timer);
  }, [selectedPeriodId, roadmapLayout, selectedRow?.status]);

  const selectedBadge = selectedRow
    ? badgeStyles[selectedRow.status]
    : badgeStyles.Draft;

  const isActionBusy = activeAction != null;

  const scrollRoadmap = useCallback((direction: number) => {
    roadmapTrackRef.current?.scrollBy({
      left: direction * 320,
      behavior: "smooth",
    });
  }, []);

  return (
    <div style={pageStyles.page}>
      <style>
        {`
          @keyframes dpRoadmapFadeInUp {
            from {
              opacity: 0;
              transform: translateY(16px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes dpRoadmapPulse {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 0 0 0 rgba(243, 112, 33, 0.28);
            }
            50% {
              transform: scale(1.06);
              box-shadow: 0 0 0 10px rgba(243, 112, 33, 0);
            }
          }

          @keyframes dpRoadmapProgressFill {
            from {
              width: 0%;
            }
            to {
              width: var(--dp-progress-width);
            }
          }

          .dp-roadmap-scroll {
            scrollbar-width: thin;
            scrollbar-color: #0f172a #ffffff;
          }

          .dp-roadmap-track {
            scroll-snap-type: x mandatory;
            scroll-behavior: smooth;
          }

          .dp-roadmap-track > div {
            scroll-snap-align: start;
          }

          .dp-roadmap-scroll::-webkit-scrollbar {
            height: 8px;
          }

          .dp-roadmap-scroll::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 999px;
          }

          .dp-roadmap-scroll::-webkit-scrollbar-track {
            background: #ffffff;
            border-radius: 999px;
          }

          .dp-roadmap-pulse {
            animation: dpRoadmapPulse 2s infinite;
          }

          .dp-roadmap-progress-fill {
            animation: dpRoadmapProgressFill 1.4s ease-out both;
          }

          .dp-period-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          .dp-period-table th,
          .dp-period-table td {
            word-break: break-word;
            vertical-align: top;
          }

          @media (max-width: 1480px) {
            .dp-layout-grid {
              grid-template-columns: 1fr !important;
            }

            .dp-toolbar-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
          }

          @media (max-width: 1280px) {
            .dp-toolbar-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }

            .dp-toolbar-actions {
              grid-column: 1 / -1;
              justify-content: flex-start !important;
            }

            .dp-roadmap-header {
              align-items: flex-start !important;
            }

            .dp-period-table th:nth-child(6),
            .dp-period-table td:nth-child(6),
            .dp-period-table th:nth-child(7),
            .dp-period-table td:nth-child(7) {
              display: none;
            }

            .dp-stats-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
          }

          @media (max-width: 980px) {
            .dp-period-table th:nth-child(4),
            .dp-period-table td:nth-child(4) {
              display: none;
            }
          }

          @media (max-width: 760px) {
            .dp-page {
              padding: 14px;
            }

            .dp-toolbar-grid {
              grid-template-columns: 1fr !important;
            }

            .dp-stats-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
      <div className="dp-page" style={pageStyles.shell}>
        <section style={pageStyles.hero}>
          <div style={pageStyles.heroGlow} />
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 720px", maxWidth: 980, minWidth: 0 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  color: "#f37021",
                  fontWeight: 800,
                  fontSize: 12,
                  marginBottom: 12,
                }}
              >
                <Workflow size={14} /> FIT DNU · Quản lý đợt
              </div>
              <h1
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  color: "#0f172a",
                  fontSize: "clamp(26px, 2.6vw, 32px)",
                  lineHeight: 1.25,
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    color: "#f37021",
                  }}
                >
                  <Workflow size={20} />
                </span>
                Quản lý đợt bảo vệ
              </h1>
              <p
                style={{
                  margin: "12px 0 0",
                  color: "#0f172a",
                  fontSize: 14,
                  maxWidth: 900,
                  lineHeight: 1.6,
                }}
              >
                Màn hình này chỉ quản lý thông tin đợt và vòng đời đợt (CRUD +
                lifecycle). Các thao tác setup, generate và chỉnh sửa hội đồng
                được tách riêng sang module Quản lý hội đồng.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                width: "100%",
                maxWidth: 320,
                marginLeft: "auto",
              }}
            >
              <div style={{ ...pageStyles.sectionCard, padding: 14 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: "#0f172a",
                    fontWeight: 800,
                    letterSpacing: 0.5,
                  }}
                >
                  ĐỢT ĐANG CHỌN
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#0f172a",
                    marginTop: 4,
                  }}
                >
                  {selectedRow?.name ?? "Chưa có đợt"}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      ...pageStyles.chip,
                      background: selectedBadge.bg,
                      color: selectedBadge.text,
                    }}
                  >
                    {selectedRow?.status ?? "Draft"}
                  </span>
                  <span
                    style={{
                      ...pageStyles.chip,
                      background: "#ffffff",
                      color: "#0f172a",
                    }}
                  >
                    Mã: {selectedRow?.code ?? "--"}
                  </span>
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: "#0f172a" }}>
                  Đợt thứ {selectedRow?.roundIndex ?? 0} -{" "}
                  {selectedRow?.startDate ?? "--"} đến{" "}
                  {selectedRow?.endDate ?? "--"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="dp-stats-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 14,
            marginBottom: 16,
          }}
        >
          {heroStats.map((item, index) => (
            <div
              key={item.label}
              style={{
                ...pageStyles.statCard,
                borderTop:
                  index === 0 ? "3px solid #f37021" : "3px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#0f172a",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 30,
                  fontWeight: 900,
                  color: "#0f172a",
                }}
              >
                {item.value}
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: "#0f172a" }}>
                {item.note}
              </div>
            </div>
          ))}
        </section>

        <section style={{ ...pageStyles.sectionCard, marginBottom: 18 }}>
          <div className="dp-toolbar-grid" style={pageStyles.toolbar}>
            <div style={{ position: "relative" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: 14,
                  top: 14,
                  color: "#f37021",
                }}
              />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Từ khóa: mã đợt, tên đợt"
                style={{
                  width: "100%",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "13px 14px 13px 38px",
                  background: "#ffffff",
                  outline: "none",
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              style={selectControlStyle}
            >
              <option value="all">Tất cả trạng thái</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "13px 12px",
                background: "#ffffff",
              }}
            />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "13px 12px",
                background: "#ffffff",
              }}
            />
            <div
              className="dp-toolbar-actions"
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "flex-start",
              }}
            >
              <button
                type="button"
                style={pageStyles.ghostButton}
                onClick={() => studentsSectionRef.current?.openAdd()}
              >
                <Plus size={15} /> Thêm sinh viên vào đợt
              </button>
              <button
                type="button"
                style={pageStyles.ghostButton}
                onClick={() => lecturersSectionRef.current?.openAdd()}
              >
                <Plus size={15} /> Thêm giảng viên vào đợt
              </button>
              <button
                type="button"
                style={pageStyles.primaryButton}
                onClick={() => void loadRows()}
                disabled={loadingRows}
              >
                <Filter size={15} /> {loadingRows ? "Đang tải" : "Tải dữ liệu"}
              </button>
              <button
                type="button"
                style={pageStyles.ghostButton}
                onClick={resetFilters}
              >
                <RefreshCw size={15} /> Làm mới bộ lọc
              </button>
            </div>
          </div>
        </section>

        <section className="dp-layout-grid" style={pageStyles.contentGrid}>
          <div style={pageStyles.panel}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 18,
                borderBottom: "1px solid #e2e8f0",
                background: "#ffffff",
              }}
            >
              <div>
                <div
                  style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}
                >
                  Danh sách đợt
                </div>
                <div style={{ color: "#0f172a", fontSize: 13, marginTop: 4 }}>
                  Quản lý thông tin đợt bảo vệ, không thao tác chi tiết hội đồng
                  tại đây.
                </div>
              </div>
              <button
                type="button"
                style={pageStyles.primaryButton}
                onClick={openCreate}
              >
                <Plus size={15} /> Tạo đợt mới
              </button>
            </div>

            <div style={{ width: "100%", overflowX: "hidden" }}>
              <table className="dp-period-table">
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    {[
                      "Mã đợt",
                      "Tên đợt",
                      "Bắt đầu",
                      "Kết thúc",
                      "Trạng thái",
                      "Tạo lúc",
                      "Cập nhật",
                      "Hành động",
                    ].map((label) => (
                      <th key={label} style={tableHeadCellStyle}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((item) => {
                    const badge = badgeStyles[item.status];
                    return (
                      <tr
                        key={item.periodId}
                        style={{
                          background:
                            selectedPeriodId === item.periodId
                              ? "#ffffff"
                              : "#ffffff",
                        }}
                      >
                        <td
                          style={{
                            ...tableCellStyle,
                            fontWeight: 900,
                            color: "#0f172a",
                          }}
                        >
                          {item.code}
                        </td>
                        <td style={{ ...tableCellStyle, minWidth: 170 }}>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>
                            {item.name}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#0f172a",
                              marginTop: 4,
                            }}
                          >
                            Đợt thứ {item.roundIndex}
                          </div>
                        </td>
                        <td style={tableCellStyle}>{item.startDate || "-"}</td>
                        <td style={tableCellStyle}>{item.endDate || "-"}</td>
                        <td style={tableCellStyle}>
                          <span
                            style={{
                              ...pageStyles.chip,
                              background: badge.bg,
                              color: badge.text,
                            }}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td
                          style={{
                            ...tableCellStyle,
                            fontSize: 12,
                            color: "#0f172a",
                          }}
                        >
                          {item.createdAt}
                        </td>
                        <td
                          style={{
                            ...tableCellStyle,
                            fontSize: 12,
                            color: "#0f172a",
                          }}
                        >
                          {item.updatedAt}
                        </td>
                        <td style={tableCellStyle}>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              style={pageStyles.iconActionButton}
                              onClick={() => setSelectedPeriodId(item.periodId)}
                              title="Xem chi tiết"
                              aria-label="Xem chi tiết"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              style={pageStyles.iconActionButton}
                              onClick={() => openEdit(item)}
                              title="Sửa đợt"
                              aria-label="Sửa đợt"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              style={pageStyles.iconDangerButton}
                              onClick={() => void removePeriod(item)}
                              title="Xóa đợt"
                              aria-label="Xóa đợt"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        style={{
                          padding: "24px 14px",
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
          </div>

          <div style={pageStyles.detailPanel}>
            {!selectedRow ? (
              <div style={{ color: "#0f172a" }}>
                {rows.length === 0
                  ? "Chưa có dữ liệu để hiển thị."
                  : "Vui lòng chọn một đợt để xem chi tiết."}
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: "#ffffff",
                        color: "#0f172a",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      <CalendarDays size={14} /> {selectedRow.code}
                    </div>
                    <div
                      style={{
                        fontWeight: 900,
                        color: "#0f172a",
                        fontSize: 20,
                        lineHeight: 1.2,
                      }}
                    >
                      {selectedRow.name}
                    </div>
                    <div
                      style={{ color: "#0f172a", fontSize: 13, marginTop: 6 }}
                    >
                      Đợt thứ {selectedRow.roundIndex} -{" "}
                      {selectedRow.startDate || "-"} đến{" "}
                      {selectedRow.endDate || "-"}
                    </div>
                  </div>
                  <span
                    style={{
                      ...pageStyles.chip,
                      background: selectedBadge.bg,
                      color: selectedBadge.text,
                    }}
                  >
                    {selectedRow.status}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  {[
                    { label: "Hội đồng", value: dashboardNumbers.councilCount },
                    {
                      label: "Assignment",
                      value: dashboardNumbers.assignmentCount,
                    },
                    { label: "Kết quả", value: dashboardNumbers.resultCount },
                    {
                      label: "Revision",
                      value: dashboardNumbers.revisionCount,
                    },
                    {
                      label: "SV đủ điều kiện",
                      value: dashboardNumbers.eligibleStudentCount,
                    },
                    {
                      label: "GV pool",
                      value: dashboardNumbers.capabilityLecturerCount,
                    },
                  ].map((card) => (
                    <div
                      key={card.label}
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 12,
                        padding: 12,
                        background:
                          "linear-gradient(180deg, #ffffff 0%, #ffffff 100%)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: "#0f172a",
                          fontWeight: 800,
                          textTransform: "uppercase",
                        }}
                      >
                        {card.label}
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          fontWeight: 900,
                          color: "#0f172a",
                          fontSize: 22,
                        }}
                      >
                        {card.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 14,
                    background: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 900,
                      color: "#0f172a",
                      marginBottom: 10,
                    }}
                  >
                    Thao tác vòng đời (module Quản lý đợt)
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <button
                      type="button"
                      style={pageStyles.primaryButton}
                      onClick={handleSync}
                      disabled={isActionBusy || !canRunAction("SYNC")}
                    >
                      <RefreshCw size={14} /> Đồng bộ
                    </button>
                    <button
                      type="button"
                      style={pageStyles.ghostButton}
                      onClick={handleFinalize}
                      disabled={isActionBusy || !canRunAction("FINALIZE")}
                    >
                      <Shield size={14} /> Chốt đợt
                    </button>
                    <button
                      type="button"
                      style={pageStyles.ghostButton}
                      onClick={handlePublish}
                      disabled={isActionBusy || !canRunAction("PUBLISH")}
                    >
                      <Send size={14} /> Công bố
                    </button>
                    <button
                      type="button"
                      style={pageStyles.ghostButton}
                      onClick={handleRollback}
                      disabled={isActionBusy || !canRunAction("ROLLBACK")}
                    >
                      <RotateCcw size={14} /> Hoàn tác
                    </button>
                    <button
                      type="button"
                      style={pageStyles.dangerButton}
                      onClick={handleArchive}
                      disabled={isActionBusy || !canRunAction("ARCHIVE")}
                    >
                      Lưu trữ
                    </button>
                    <button
                      type="button"
                      style={pageStyles.ghostButton}
                      onClick={handleReopen}
                      disabled={isActionBusy || !canRunAction("REOPEN")}
                    >
                      Mở lại
                    </button>
                  </div>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      color: "#0f172a",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={allowFinalizeAfterWarning}
                      onChange={(event) =>
                        setAllowFinalizeAfterWarning(event.target.checked)
                      }
                    />
                    Cho phép chốt đợt khi có cảnh báo
                  </label>

                  <div style={{ marginTop: 8, fontSize: 12, color: "#0f172a" }}>
                    {activeAction
                      ? `Đang thực hiện: ${activeAction}`
                      : "Sẵn sàng thao tác"}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 12,
                  }}
                >
                  {[
                    { key: "overview", label: "Tổng quan" },
                    { key: "state", label: "Trạng thái" },
                    { key: "workflow", label: "Quy trình" },
                    { key: "history", label: "Lịch sử" },
                  ].map((item) => {
                    const active = activeTab === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveTab(item.key as DetailTab)}
                        style={{
                          ...pageStyles.ghostButton,
                          padding: "9px 12px",
                          background: active ? "#f37021" : "#ffffff",
                          color: active ? "#ffffff" : "#0f172a",
                          borderColor: active ? "#f37021" : "#cbd5e1",
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <div
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 16,
                    padding: 14,
                    background: "#ffffff",
                  }}
                >
                  {activeTab === "overview" && (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          color: "#0f172a",
                        }}
                      >
                        <CalendarDays size={14} color="#0f172a" />
                        {selectedRow.startDate || "-"} -{" "}
                        {selectedRow.endDate || "-"}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          color: "#0f172a",
                        }}
                      >
                        <Clock3 size={14} color="#0f172a" />
                        Tạo lúc {selectedRow.createdAt}, cập nhật{" "}
                        {selectedRow.updatedAt}
                      </div>
                      <div style={{ color: "#0f172a" }}>
                        Tỷ lệ phân công:{" "}
                        <strong>
                          {dashboardNumbers.assignmentCoveragePercent.toFixed(
                            2,
                          )}
                          %
                        </strong>
                      </div>
                      <div style={{ color: "#0f172a" }}>
                        Số phòng cấu hình: <strong>{configRooms.length}</strong>
                      </div>
                      <div style={{ color: "#0f172a", fontSize: 12 }}>
                        Snapshot:{" "}
                        <strong>
                          /api/defense-periods/{"{"}periodId{"}"}/snapshot
                        </strong>
                      </div>
                      <div style={{ color: "#0f172a" }}>
                        Lưu ý: Setup và chỉnh sửa hội đồng thực hiện tại module
                        Quản lý hội đồng.
                      </div>
                    </div>
                  )}

                  {activeTab === "state" && (
                    <div
                      style={{
                        display: "grid",
                        gap: 8,
                        color: "#0f172a",
                        fontSize: 13,
                      }}
                    >
                      <div>
                        Trạng thái khóa giảng viên:{" "}
                        <strong>
                          {stateFlags.lecturerCapabilitiesLocked
                            ? "Đã khóa"
                            : "Chưa khóa"}
                        </strong>
                      </div>
                      <div>
                        Trạng thái xác nhận cấu hình:{" "}
                        <strong>
                          {stateFlags.councilConfigConfirmed
                            ? "Đã xác nhận"
                            : "Chưa xác nhận"}
                        </strong>
                      </div>
                      <div>
                        Trạng thái chốt đợt:{" "}
                        <strong>
                          {stateFlags.finalized ? "Đã chốt" : "Chưa chốt"}
                        </strong>
                      </div>
                      <div>
                        Trạng thái công bố:{" "}
                        <strong>
                          {stateFlags.scoresPublished
                            ? "Đã công bố"
                            : "Chưa công bố"}
                        </strong>
                      </div>
                      <div>
                        Hành động cho phép:{" "}
                        <strong>
                          {allowedActions.length
                            ? allowedActions.join(", ")
                            : "Không giới hạn"}
                        </strong>
                      </div>
                      {stateFlags.warnings.length > 0 && (
                        <div style={{ color: "#0f172a" }}>
                          Cảnh báo: {stateFlags.warnings.join(" | ")}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "workflow" && (
                    <div style={{ display: "grid", gap: 10 }}>
                      {workflowSteps.map((step, index) => (
                        <div
                          key={`${step.key}-${index}`}
                          style={{
                            border: "1px solid #cbd5e1",
                            borderRadius: 12,
                            padding: 10,
                            background:
                              step.status === "completed"
                                ? "#ffffff"
                                : step.status === "in-progress"
                                  ? "#ffffff"
                                  : "#ffffff",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            {step.status === "completed" ? (
                              <CheckCircle size={16} color="#0f172a" />
                            ) : step.status === "in-progress" ? (
                              <Clock3 size={16} color="#0f172a" />
                            ) : (
                              <AlertCircle size={16} color="#0f172a" />
                            )}
                            <strong style={{ color: "#0f172a" }}>
                              {step.title}
                            </strong>
                          </div>
                          {step.description && (
                            <div
                              style={{
                                marginTop: 6,
                                fontSize: 12,
                                color: "#0f172a",
                              }}
                            >
                              {step.description}
                            </div>
                          )}
                          {step.blockedReason && (
                            <div
                              style={{
                                marginTop: 6,
                                fontSize: 12,
                                color: "#f37021",
                              }}
                            >
                              Đang chặn: {step.blockedReason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === "history" && (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          color: "#0f172a",
                        }}
                      >
                        <History size={14} color="#0f172a" />
                        Bản ghi dành cho module Quản lý đợt tập trung vào vòng
                        đời đợt.
                      </div>
                      <div style={{ color: "#0f172a", fontSize: 13 }}>
                        Nếu cần thao tác danh sách hội đồng, hãy chuyển sang
                        module Quản lý hội đồng.
                      </div>
                      <button
                        type="button"
                        style={pageStyles.ghostButton}
                        onClick={openCommitteeManagement}
                      >
                        <Workflow size={14} /> Mở module Quản lý hội đồng
                      </button>
                    </div>
                  )}

                  {loadingSnapshot && (
                    <div
                      style={{ marginTop: 12, fontSize: 12, color: "#0f172a" }}
                    >
                      Đang đồng bộ snapshot mới nhất...
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        <section
          style={{
            ...pageStyles.sectionCard,
            marginTop: 16,
            padding: 18,
            borderRadius: 14,
            background: "#ffffff",
          }}
        >
          <div
            className="dp-roadmap-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "#0f172a",
                  fontWeight: 800,
                }}
              >
                <Workflow size={16} /> Timeline roadmap theo đợt
              </div>
              <div style={{ marginTop: 4, color: "#0f172a", fontSize: 13 }}>
                Shell quản trị đợt giữ tab nội bộ
                (overview/state/workflow/history), không tách route con khi
                snapshot tổng đã đủ.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                style={{
                  ...pageStyles.ghostButton,
                  width: 42,
                  height: 42,
                  padding: 0,
                  background:
                    roadmapLayout === "horizontal" ? "#ffffff" : "#ffffff",
                  borderColor:
                    roadmapLayout === "horizontal" ? "#f37021" : "#cbd5e1",
                  color: roadmapLayout === "horizontal" ? "#f37021" : "#0f172a",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={() =>
                  setRoadmapLayout((prev) =>
                    prev === "horizontal" ? "vertical" : "horizontal",
                  )
                }
                title={
                  roadmapLayout === "horizontal"
                    ? "Chuyển sang chế độ dọc"
                    : "Chuyển sang chế độ slide"
                }
                aria-label={
                  roadmapLayout === "horizontal"
                    ? "Chuyển sang chế độ dọc"
                    : "Chuyển sang chế độ slide"
                }
              >
                {roadmapLayout === "horizontal" ? (
                  <Columns3 size={16} />
                ) : (
                  <Rows3 size={16} />
                )}
              </button>
              <span
                style={{
                  ...pageStyles.chip,
                  background:
                    roadmapLayout === "horizontal" ? "#ffffff" : "#ffffff",
                  color: roadmapLayout === "horizontal" ? "#f37021" : "#0f172a",
                  border: "1px solid #cbd5e1",
                }}
              >
                {roadmapLayout === "horizontal" ? "Chế độ slide" : "Chế độ dọc"}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  ...pageStyles.chip,
                  background: "#ffffff",
                  color: "#0f172a",
                  fontWeight: 800,
                }}
              >
                Hoàn thành: {roadmapCompletionPercent.toFixed(1)}%
              </span>
              <span
                style={{
                  ...pageStyles.chip,
                  background: "#ffffff",
                  color: "#0f172a",
                  fontWeight: 800,
                }}
              >
                {activeRoadmapStep
                  ? `Đang xử lý: ${activeRoadmapStep.title}`
                  : "Chưa có dữ liệu bước"}
              </span>
              <span
                style={{
                  ...pageStyles.chip,
                  background: "#ffffff",
                  color: "#0f172a",
                }}
              >
                API rút gọn: /api/defense-periods
              </span>
            </div>

            <div
              style={{
                width: "100%",
                height: 8,
                borderRadius: 999,
                background: "#f8fafc",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${roadmapCompletionPercent}%`,
                  height: "100%",
                  background: "#f37021",
                  transition: "width 0.8s ease",
                }}
              />
            </div>
          </div>

          {roadmapLayout === "horizontal" ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
              >
                <button
                  type="button"
                  style={{ ...pageStyles.ghostButton, padding: "7px 10px" }}
                  onClick={() => scrollRoadmap(-1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  style={{ ...pageStyles.ghostButton, padding: "7px 10px" }}
                  onClick={() => scrollRoadmap(1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div
                ref={roadmapTrackRef}
                className="dp-roadmap-scroll dp-roadmap-track"
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "stretch",
                  overflowX: "auto",
                  paddingBottom: 8,
                }}
              >
                {roadmapSteps.map((step, index) => {
                  const theme = roadmapStatusTheme[step.status];
                  return (
                    <div
                      key={step.key}
                      style={{
                        flex: "0 0 260px",
                        opacity: roadmapAnimated ? undefined : 0,
                        animation: roadmapAnimated
                          ? `dpRoadmapFadeInUp 0.45s ease ${index * 0.08}s forwards`
                          : undefined,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <span
                          className={
                            step.status === "in-progress"
                              ? "dp-roadmap-pulse"
                              : undefined
                          }
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            border: `2px solid ${theme.dotBorder}`,
                            background: theme.dotBg,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {step.status === "completed" ? (
                            <CheckCircle size={14} color="#0f172a" />
                          ) : step.status === "in-progress" ? (
                            <Clock3 size={14} color="#f37021" />
                          ) : (
                            <AlertCircle size={14} color="#0f172a" />
                          )}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: "#0f172a",
                          }}
                        >
                          Bước {String(index + 1).padStart(2, "0")}
                        </span>
                      </div>

                      <div
                        style={{
                          border: `1px solid ${theme.cardBorder}`,
                          borderRadius: 12,
                          background: theme.cardBg,
                          padding: 12,
                          minHeight: 130,
                        }}
                      >
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>
                          {step.title}
                        </div>
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 12,
                            color: "#0f172a",
                            lineHeight: 1.5,
                          }}
                        >
                          {step.description}
                        </div>
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 11,
                            color: theme.text,
                            fontWeight: 700,
                          }}
                        >
                          {roadmapStatusLabel[step.status]}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {roadmapSteps.map((step, index) => {
                const theme = roadmapStatusTheme[step.status];
                const isLast = index === roadmapSteps.length - 1;
                return (
                  <div
                    key={step.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "34px minmax(0, 1fr)",
                      gap: 10,
                      opacity: roadmapAnimated ? undefined : 0,
                      animation: roadmapAnimated
                        ? `dpRoadmapFadeInUp 0.45s ease ${index * 0.08}s forwards`
                        : undefined,
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <span
                        className={
                          step.status === "in-progress"
                            ? "dp-roadmap-pulse"
                            : undefined
                        }
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          border: `2px solid ${theme.dotBorder}`,
                          background: theme.dotBg,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 1,
                        }}
                      >
                        {step.status === "completed" ? (
                          <CheckCircle size={14} color="#0f172a" />
                        ) : step.status === "in-progress" ? (
                          <Clock3 size={14} color="#0f172a" />
                        ) : (
                          <AlertCircle size={14} color="#0f172a" />
                        )}
                      </span>

                      {!isLast && (
                        <span
                          style={{
                            position: "absolute",
                            top: 28,
                            bottom: -12,
                            width: 2,
                            background: theme.line,
                          }}
                        />
                      )}
                    </div>

                    <div
                      style={{
                        border: `1px solid ${theme.cardBorder}`,
                        borderRadius: 12,
                        background: theme.cardBg,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>
                          {step.title}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#0f172a",
                            fontWeight: 700,
                          }}
                        >
                          Bước {String(index + 1).padStart(2, "0")}
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          color: "#0f172a",
                          lineHeight: 1.5,
                        }}
                      >
                        {step.description}
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 11,
                          color: theme.text,
                          fontWeight: 700,
                        }}
                      >
                        {roadmapStatusLabel[step.status]}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 12, color: "#0f172a" }}>
            Roadmap này chỉ điều hành tổng của đợt; tác vụ chi tiết hội đồng vẫn
            xử lý tại module Quản lý hội đồng.
          </div>
        </section>

        <section style={{ marginTop: 16, display: "grid", gap: 16 }}>
          <DefenseTermStudentsSection
            ref={studentsSectionRef}
            defenseTermId={selectedPeriodId}
          />
          <DefenseTermLecturersSection
            ref={lecturersSectionRef}
            defenseTermId={selectedPeriodId}
          />
        </section>

        {showForm && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
              background: "rgba(0, 0, 0, 0.38)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              style={{
                width: "min(720px, 100%)",
                maxHeight: "90vh",
                overflowY: "auto",
                background: "#ffffff",
                borderRadius: 18,
                border: "1px solid #cbd5e1",
                boxShadow: "0 24px 80px rgba(0, 0, 0, 0.18)",
                padding: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <div>
                  <div
                    style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}
                  >
                    {editingPeriodId ? "Sửa đợt bảo vệ" : "Tạo đợt bảo vệ"}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: "#0f172a" }}>
                    Nhập thông tin đợt theo chuẩn quản trị, ưu tiên bố cục gọn
                    và dễ kiểm tra.
                  </div>
                </div>
                <button
                  type="button"
                  style={pageStyles.ghostButton}
                  onClick={() => setShowForm(false)}
                  disabled={isActionBusy}
                >
                  Đóng
                </button>
              </div>

              <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>
                    Tên đợt *
                  </span>
                  <input
                    type="text"
                    value={formState.name}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Ví dụ: Đợt bảo vệ học kỳ 1 - 2026"
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 12,
                      padding: "12px 14px",
                      background: "#ffffff",
                    }}
                  />
                </label>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 12,
                  }}
                >
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>
                      Ngày bắt đầu *
                    </span>
                    <input
                      type="date"
                      value={formState.startDate}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          startDate: event.target.value,
                        }))
                      }
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 12,
                        padding: "12px 14px",
                        background: "#ffffff",
                      }}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>
                      Ngày kết thúc
                    </span>
                    <input
                      type="date"
                      value={formState.endDate}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          endDate: event.target.value,
                        }))
                      }
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 12,
                        padding: "12px 14px",
                        background: "#ffffff",
                      }}
                    />
                  </label>
                </div>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>
                    Trạng thái
                  </span>
                  <select
                    value={formState.status}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        status: event.target.value as DefenseTermStatus,
                      }))
                    }
                    style={selectControlStyle}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 18,
                }}
              >
                <button
                  type="button"
                  style={pageStyles.ghostButton}
                  onClick={() => setShowForm(false)}
                  disabled={isActionBusy}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  style={pageStyles.primaryButton}
                  onClick={() => void saveForm()}
                  disabled={isActionBusy}
                >
                  <Save size={14} /> {isActionBusy ? "Đang lưu" : "Lưu đợt"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DefensePeriodsManagement;
