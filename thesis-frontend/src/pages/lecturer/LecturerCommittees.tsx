import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  createConcurrencyToken,
  createIdempotencyKey,
  ucError,
  type SessionCode,
  type WorkflowActionTrace,
} from "../../types/defense-workflow-contract";
import { useToast } from "../../context/useToast";
import { FetchDataError, fetchData, normalizeUrl } from "../../api/fetchData";
import type { ApiResponse } from "../../types/api";
import {
  pickCaseInsensitiveValue,
  readEnvelopeAllowedActions,
  readEnvelopeData,
  readEnvelopeErrorMessages,
  readEnvelopeMessage,
  readEnvelopeSuccess,
  readEnvelopeWarningMessages,
  toCompatResponse,
} from "../../utils/api-envelope";
import {
  getActiveDefensePeriodId,
  normalizeDefensePeriodId,
  setActiveDefensePeriodId,
} from "../../utils/defensePeriod";

import {
  ArrowRight,
  Building2,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  ClipboardPen,
  Clock3,
  Download,
  Eraser,
  Eye,
  ExternalLink,
  FileText,
  Gavel,
  Info,
  LayoutDashboard,
  Lock,
  MapPin,
  MessageSquareText,
  PencilRuler,
  Plus,
  Save,
  Star,
  Trash2,
  Undo2,
  Users2,
  XCircle,
} from "lucide-react";
import { getAccessToken } from "../../services/auth-session.service";

type Committee = {
  id: string;
  name: string;
  numericId: number;
  room: string;
  session: SessionCode | null;
  date: string | null;
  slot: string | null;
  studentCount: number;
  status: "Sắp diễn ra" | "Đang họp" | "Đã chốt" | "Đã đóng";
  normalizedRole: CommitteeRoleCode;
  roleCode: CommitteeRoleCode;
  roleLabel: string;
  roleRaw: string;
  allowedScoringActions: string[];
  allowedMinuteActions: string[];
  allowedRevisionActions: string[];
  members: CommitteeMemberView[];
};

type CommitteeRoleCode = "CT" | "UVTK" | "UVPB" | "UNKNOWN";

type CommitteeMemberView = {
  memberId: string;
  lecturerCode: string;
  lecturerName: string;
  degree: string | null;
  organization: string | null;
  roleRaw: string;
  roleCode: CommitteeRoleCode;
  roleLabel: string;
};

type RevisionRequest = {
  revisionId: number;
  assignmentId: number | null;
  studentCode: string;
  topicCode: string | null;
  topicTitle: string;
  revisionFileUrl: string | null;
  lastUpdated: string | null;
  status: "pending" | "approved" | "rejected";
  reason?: string;
};

type PanelKey = "councils" | "grading";

type CommitteeDetailTabKey = "overview" | "members" | "topics";

type WorkspaceTabKey = "scoring" | "minutes" | "review";

type PreviewModalType = "meeting" | "reviewer";

type CurrentDefensePeriodView = {
  periodId: number;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

const EMPTY_REVISION: RevisionRequest = {
  revisionId: 0,
  assignmentId: null,
  studentCode: "",
  topicCode: null,
  topicTitle: "",
  revisionFileUrl: null,
  lastUpdated: null,
  status: "pending",
};

type ScoringOverview = {
  variance: number | null;
  varianceThreshold: number | null;
  finalScore: number | null;
  finalLetter: string | null;
};

type DefenseDocument = {
  documentId: number;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  uploadedAt: string | null;
};

type ScoringMatrixRow = {
  committeeId: number;
  committeeCode: string;
  committeeName: string;
  assignmentId: number;
  assignmentCode: string;
  topicCode: string | null;
  topicTitle: string;
  studentCode: string;
  studentName: string;
  supervisorLecturerName: string | null;
  topicTags: string[];
  session: SessionCode | null;
  scheduledAt: string | null;
  startTime: string | null;
  endTime: string | null;
  topicSupervisorScore: number | null;
  scoreGvhd: number | null;
  scoreCt: number | null;
  scoreTk: number | null;
  scorePb: number | null;
  finalScore: number | null;
  finalGrade: string | null;
  variance: number | null;
  isLocked: boolean;
  status: string;
  submittedCount: number;
  requiredCount: number;
  defenseDocuments: DefenseDocument[];
};

type ScoringAlertRow = {
  assignmentId: number;
  message: string;
  value: number | null;
  threshold: number | null;
};



type TopicFinalProgressRow = {
  committeeId: number;
  committeeCode: string;
  totalTopics: number;
  scoredTopics: number;
  progressPercent: number;
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: 18,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const normalizeCommitteeRole = (value: unknown): CommitteeRoleCode => {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) {
    return "UNKNOWN";
  }

  if (
    raw === "CT" ||
    raw === "CHAIR" ||
    raw.includes("CHU TICH") ||
    raw.includes("CHỦ TỊCH")
  ) {
    return "CT";
  }

  if (
    raw === "UVTK" ||
    raw === "TK" ||
    raw === "SECRETARY" ||
    raw.includes("THU KY") ||
    raw.includes("THƯ KÝ")
  ) {
    return "UVTK";
  }

  if (
    raw === "UVPB" ||
    raw === "PB" ||
    raw === "REVIEWER" ||
    raw.includes("PHAN BIEN") ||
    raw.includes("PHẢN BIỆN")
  ) {
    return "UVPB";
  }

  return "UNKNOWN";
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toStringOrNull = (value: unknown): string | null => {
  const text = String(value ?? "").trim();
  return text ? text : null;
};

const toBooleanOrNull = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value !== 0 : null;
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

  return null;
};

const toIsoDateOrNull = (value: unknown): string | null => {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const toNumberOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const toRomanNumeral = (value: number): string => {
  const numerals: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let remaining = Math.max(1, Math.floor(value));
  let result = "";
  for (const [amount, numeral] of numerals) {
    while (remaining >= amount) {
      result += numeral;
      remaining -= amount;
    }
  }
  return result;
};

const normalizeTopicTagNames = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }
        const record = toRecord(item);
        if (!record) {
          return "";
        }
        return (
          toStringOrNull(
            pickCaseInsensitiveValue(
              record,
              ["tagName", "TagName", "name", "Name", "tagCode", "TagCode", "code", "Code"],
              null,
            ),
          ) ?? ""
        );
      })
      .map((item) => item.trim())
      .filter(Boolean);

    return Array.from(new Set(normalized));
  }

  if (typeof value === "string") {
    const fromText = value
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return Array.from(new Set(fromText));
  }

  return [];
};

const normalizeTimeText = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const matched = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!matched) {
    return null;
  }

  const hour = Number(matched[1]);
  const minute = Number(matched[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const inferSessionFromTime = (timeValue: string | null): SessionCode | null => {
  if (!timeValue) {
    return null;
  }
  const [hourText] = timeValue.split(":");
  const hour = Number(hourText);
  if (!Number.isFinite(hour)) {
    return null;
  }
  return hour >= 12 ? "AFTERNOON" : "MORNING";
};

const normalizeSessionCode = (value: unknown): SessionCode => {
  const raw = String(value ?? "").trim().toUpperCase();
  if (
    raw === "AFTERNOON" ||
    raw === "2" ||
    raw.includes("CHIEU") ||
    raw.includes("PM")
  ) {
    return "AFTERNOON";
  }
  return "MORNING";
};

const mapCurrentPeriodView = (
  periodRecord: Record<string, unknown> | null,
): CurrentDefensePeriodView | null => {
  if (!periodRecord) {
    return null;
  }

  const periodId = normalizeDefensePeriodId(
    pickCaseInsensitiveValue(
      periodRecord,
      ["defenseTermId", "DefenseTermId", "periodId", "PeriodId", "id", "Id"],
      null,
    ),
  );

  if (periodId == null || periodId <= 0) {
    return null;
  }

  return {
    periodId,
    name:
      String(
        pickCaseInsensitiveValue(periodRecord, ["name", "Name", "title", "Title"], ""),
      ).trim() || `Đợt ${periodId}`,
    status:
      String(
        pickCaseInsensitiveValue(periodRecord, ["status", "Status", "state", "State"], "UNKNOWN"),
      ).trim() || "UNKNOWN",
    startDate: toIsoDateOrNull(
      pickCaseInsensitiveValue(periodRecord, ["startDate", "StartDate", "startedAt", "StartedAt"], null),
    ),
    endDate: toIsoDateOrNull(
      pickCaseInsensitiveValue(periodRecord, ["endDate", "EndDate", "endedAt", "EndedAt"], null),
    ),
  };
};

const readApiErrorMessage = (payload: unknown): string | null => {
  const record = toRecord(payload);
  if (!record) {
    return null;
  }

  const directMessage = toStringOrNull(
    pickCaseInsensitiveValue(record, ["message", "Message", "title", "Title"], null),
  );
  if (directMessage) {
    return directMessage;
  }

  const errorRecord = toRecord(
    pickCaseInsensitiveValue(record, ["errors", "Errors"], null),
  );
  if (!errorRecord) {
    return null;
  }

  for (const value of Object.values(errorRecord)) {
    if (Array.isArray(value) && value.length > 0) {
      const first = toStringOrNull(value[0]);
      if (first) {
        return first;
      }
    }
  }

  return null;
};

const getRoleLabel = (roleCode: CommitteeRoleCode): string => {
  switch (roleCode) {
    case "CT":
      return "Chủ tịch hội đồng";
    case "UVTK":
      return "Ủy viên thư ký hội đồng";
    case "UVPB":
      return "Ủy viên phản biện hội đồng";
    default:
      return "Không xác định";
  }
};

const getCommitteeMemberParticipation = (
  member: CommitteeMemberView,
  scoringRows: ScoringMatrixRow[],
  context?: {
    isCurrentUser: boolean;
    hasJoinedCurrentCommittee: boolean;
    isCommitteeLive: boolean;
  },
) => {
  const onlineByScore = scoringRows.some((row) => {
    if (member.roleCode === "CT") {
      return row.scoreCt != null;
    }

    if (member.roleCode === "UVTK") {
      return row.scoreTk != null;
    }

    if (member.roleCode === "UVPB") {
      return row.scorePb != null;
    }

    return false;
  });

  const onlineByPresence = Boolean(
    context?.isCurrentUser && context?.hasJoinedCurrentCommittee && context?.isCommitteeLive,
  );

  const online = onlineByPresence || onlineByScore;

  return {
    online,
    emoji: online ? "🟢" : "⚫",
    label: online ? "Online" : "Offline",
    bg: online ? "#ecfdf5" : "#f8fafc",
    border: online ? "#22c55e" : "#cbd5e1",
    text: online ? "#166534" : "#475569",
  };
};

const normalizeCommitteeKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

const extractDigits = (value: unknown) => String(value ?? "").replace(/\D+/g, "");

type CommitteeStatusVisual = {
  emoji: string;
  label: string;
  cardBorder: string;
  cardGlow: string;
  chipBg: string;
  chipBorder: string;
  chipText: string;
};

const getCommitteeStatusVisual = (status: Committee["status"]): CommitteeStatusVisual => {
  switch (status) {
    case "Đang họp":
      return {
        emoji: "🔴",
        label: "Đang họp",
        cardBorder: "#f97316",
        cardGlow: "rgba(249, 115, 22, 0.20)",
        chipBg: "#fff7ed",
        chipBorder: "#f97316",
        chipText: "#c2410c",
      };
    case "Đã chốt":
      return {
        emoji: "🔒",
        label: "Đã chốt điểm",
        cardBorder: "#cbd5e1",
        cardGlow: "rgba(148, 163, 184, 0.18)",
        chipBg: "#f8fafc",
        chipBorder: "#cbd5e1",
        chipText: "#475569",
      };
    case "Đã đóng":
      return {
        emoji: "🏁",
        label: "Đã đóng phiên",
        cardBorder: "#64748b",
        cardGlow: "rgba(100, 116, 139, 0.1)",
        chipBg: "#f1f5f9",
        chipBorder: "#94a3b8",
        chipText: "#475569",
      };
    default:
      return {
        emoji: "🟢",
        label: "Sắp diễn ra",
        cardBorder: "#86efac",
        cardGlow: "rgba(34, 197, 94, 0.18)",
        chipBg: "#f0fdf4",
        chipBorder: "#86efac",
        chipText: "#166534",
      };
  }
};

const getCommitteeScheduleLabel = (committee: Committee): string => {
  if (!committee.date) {
    return "Chưa cập nhật";
  }

  return "Cả ngày";
};

const mapCommitteeStatus = (value: unknown): Committee["status"] => {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "FINALIZED") {
    return "Đã đóng";
  }
  if (raw === "LOCKED" || raw === "COMPLETED") {
    return "Đã chốt";
  }
  if (raw === "LIVE" || raw === "ONGOING") {
    return "Đang họp";
  }
  return "Sắp diễn ra";
};

const normalizeAllowedActions = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim().toUpperCase())
        .filter(Boolean),
    ),
  );
};

const includesAnyAction = (allowedActions: string[], ...targets: string[]): boolean => {
  if (allowedActions.length === 0) {
    return false;
  }

  const normalizedTargets = targets
    .map((item) => String(item ?? "").trim().toUpperCase())
    .filter(Boolean);

  if (normalizedTargets.length === 0) {
    return false;
  }

  return normalizedTargets.some((action) => allowedActions.includes(action));
};

const LecturerCommittees: React.FC = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isGradingScreen = false;
  const committeeIdParam = String(searchParams.get("committeeId") ?? "").trim();
  const [periodId, setPeriodId] = useState<number | null>(() => getActiveDefensePeriodId());
  const [currentPeriod, setCurrentPeriod] = useState<CurrentDefensePeriodView | null>(null);
  const [currentSnapshotError, setCurrentSnapshotError] = useState<string | null>(null);
  const [councilListLocked, setCouncilListLocked] = useState<boolean | null>(null);
  const [councilLockStatus, setCouncilLockStatus] = useState<string>("UNKNOWN");
  const periodBase = periodId ? `/defense-periods/${periodId}` : "";
  const lecturerBase = `${periodBase}/lecturer`;
  const periodIdText = String(periodId ?? "");
  const pickSnapshotSection = pickCaseInsensitiveValue;

  const syncPeriodToUrl = (nextPeriodId: number | null) => {
    const currentPeriodId = normalizeDefensePeriodId(searchParams.get("periodId"));
    if (currentPeriodId === nextPeriodId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    if (nextPeriodId != null) {
      nextParams.set("periodId", String(nextPeriodId));
    } else {
      nextParams.delete("periodId");
    }
    setSearchParams(nextParams, { replace: true });
  };

  const getLecturerSnapshot = async (committeeId?: string | number) => {
    const committeeQuery =
      committeeId == null || String(committeeId).trim() === ""
        ? ""
        : `?committeeId=${encodeURIComponent(String(committeeId))}`;

    let envelope: ApiResponse<Record<string, unknown>>;
    try {
      envelope = await fetchData<ApiResponse<Record<string, unknown>>>(
        `/lecturer-defense/current/snapshot${committeeQuery}`,
        {
          method: "GET",
        },
      );
    } catch (error) {
      if (periodId == null || periodId <= 0) {
        throw error;
      }

      envelope = await fetchData<ApiResponse<Record<string, unknown>>>(
        `${lecturerBase}/snapshot${committeeQuery}`,
        {
          method: "GET",
        },
      );
    }

    const payloadRecord =
      toRecord(readEnvelopeData<Record<string, unknown>>(envelope)) ?? {};
    const periodView = mapCurrentPeriodView(
      toRecord(
        pickSnapshotSection(payloadRecord, ["period", "Period"], null),
      ),
    );

    if (periodView) {
      setPeriodId(periodView.periodId);
      setActiveDefensePeriodId(periodView.periodId);
      syncPeriodToUrl(periodView.periodId);
      setCurrentPeriod(periodView);
    } else if (periodId != null && periodId > 0) {
      syncPeriodToUrl(periodId);
      setCurrentPeriod((prev) =>
        prev ?? {
          periodId,
          name: `Đợt #${periodId}`,
          status: "UNKNOWN",
          startDate: null,
          endDate: null,
        },
      );
    } else {
      throw new Error("CURRENT_PERIOD_CONTRACT_INVALID");
    }
    setCurrentSnapshotError(null);

    const snapshot =
      toRecord(
        pickSnapshotSection(payloadRecord, ["snapshot", "Snapshot"], payloadRecord),
      ) ?? {};

    return toCompatResponse(envelope, snapshot);
  };

  const lecturerApi = {
    getCommittees: async () => {
      const snapshotRes = await getLecturerSnapshot();
      const snapshot = readEnvelopeData<Record<string, unknown>>(snapshotRes);
      const committeesSource = pickSnapshotSection<unknown>(
        snapshot,
        ["committees", "Committees"],
        [],
      );

      const committeeContainer = toRecord(committeesSource);
      const rowsSource =
        Array.isArray(committeesSource)
          ? committeesSource
          : pickSnapshotSection<unknown[]>(
            committeeContainer ?? {},
            ["committees", "Committees", "items", "Items"],
            [],
          );

      const rows = Array.isArray(rowsSource)
        ? rowsSource
          .map((item) => toRecord(item))
          .filter((item): item is Record<string, unknown> => Boolean(item))
        : [];

      const lockFlag = toBooleanOrNull(
        pickSnapshotSection<unknown>(
          committeeContainer ?? {},
          ["councilListLocked", "CouncilListLocked"],
          null,
        ),
      );
      const lockStatus = toStringOrNull(
        pickSnapshotSection<unknown>(
          committeeContainer ?? {},
          ["councilLockStatus", "CouncilLockStatus"],
          null,
        ),
      );

      return toCompatResponse(snapshotRes, {
        items: rows,
        councilListLocked: lockFlag,
        councilLockStatus: lockStatus,
      });
    },
    getCommitteeMinutes: async (id: string | number) => {
      const snapshotRes = await getLecturerSnapshot(id);
      const snapshot = readEnvelopeData<Record<string, unknown>>(snapshotRes);
      const minutesRows = pickSnapshotSection<Array<Record<string, unknown>>>(
        snapshot,
        ["minutes", "Minutes"],
        [],
      );
      const committeeId = Number(id);
      const committeeCode = String(id).trim().toUpperCase();
      const filtered = (Array.isArray(minutesRows) ? minutesRows : []).filter(
        (item) => {
          const row = toRecord(item) ?? {};
          const rowCommitteeId = Number(
            pickSnapshotSection<unknown>(
              row,
              ["committeeId", "CommitteeId", "councilId", "CouncilId"],
              0,
            ),
          );
          const rowCommitteeCode = String(
            pickSnapshotSection<unknown>(
              row,
              ["committeeCode", "CommitteeCode", "councilCode", "CouncilCode"],
              "",
            ),
          )
            .trim()
            .toUpperCase();

          return rowCommitteeId === committeeId || (committeeCode && rowCommitteeCode === committeeCode);
        },
      );

      return toCompatResponse(snapshotRes, filtered);
    },
    updateCommitteeMinutes: (id: string | number, payload: Record<string, unknown>, idempotencyKey?: string) =>
      fetchData<ApiResponse<boolean>>(`${lecturerBase}/minutes/upsert`, {
        method: "POST",
        body: {
          committeeId: Number(id),
          data: payload,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      }),
    submitIndependentScore: (id: string | number, payload: Record<string, unknown>, idempotencyKey?: string) =>
      fetchData<ApiResponse<boolean>>(`${lecturerBase}/scoring/actions`, {
        method: "POST",
        body: {
          action: "SUBMIT",
          committeeId: Number(id),
          score: payload,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      }),
    openSessionByCommittee: (id: string | number, idempotencyKey?: string) =>
      fetchData<ApiResponse<boolean>>(`${lecturerBase}/scoring/actions`, {
        method: "POST",
        body: {
          action: "OPEN_SESSION",
          committeeId: Number(id),
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      }),
    reopenRequestByCommittee: (id: string | number, payload: Record<string, unknown>, idempotencyKey?: string) =>
      fetchData<ApiResponse<boolean>>(`${lecturerBase}/scoring/actions`, {
        method: "POST",
        body: {
          action: "REOPEN_REQUEST",
          committeeId: Number(id),
          reopen: payload,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      }),
    lockSessionByCommittee: (id: string | number, idempotencyKey?: string) =>
      fetchData<ApiResponse<boolean>>(`${lecturerBase}/scoring/actions`, {
        method: "POST",
        body: {
          action: "LOCK_SESSION",
          committeeId: Number(id),
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      }),
    getRevisionQueue: async () => {
      const snapshotRes = await getLecturerSnapshot();
      const snapshot = readEnvelopeData<Record<string, unknown>>(snapshotRes);
      const queue = pickSnapshotSection<Array<Record<string, unknown>>>(
        snapshot,
        ["revisionQueue", "RevisionQueue"],
        [],
      );
      return toCompatResponse(snapshotRes, Array.isArray(queue) ? queue : []);
    },
    getScoringMatrix: async (committeeId?: string | number) => {
      const snapshotRes = await getLecturerSnapshot();
      const snapshot = readEnvelopeData<Record<string, unknown>>(snapshotRes);
      const scoring = pickSnapshotSection<Record<string, unknown>>(
        snapshot,
        ["scoring", "Scoring"],
        {},
      );
      const matrixRows = pickSnapshotSection<Array<Record<string, unknown>>>(
        scoring,
        ["matrix", "Matrix"],
        [],
      );
      const normalizedRows = Array.isArray(matrixRows) ? matrixRows : [];
      const filtered =
        committeeId == null
          ? normalizedRows
          : normalizedRows.filter(
            (item) =>
              Number(item.committeeId ?? item.councilId ?? 0) ===
              Number(committeeId) ||
              String(item.committeeCode ?? "") === String(committeeId),
          );
      return toCompatResponse(snapshotRes, filtered);
    },
    getScoringAlerts: async (committeeId?: string | number) => {
      const snapshotRes = await getLecturerSnapshot();
      const snapshot = readEnvelopeData<Record<string, unknown>>(snapshotRes);
      const scoring = pickSnapshotSection<Record<string, unknown>>(
        snapshot,
        ["scoring", "Scoring"],
        {},
      );
      const alertRows = pickSnapshotSection<Array<Record<string, unknown>>>(
        scoring,
        ["alerts", "Alerts"],
        [],
      );
      const normalizedRows = Array.isArray(alertRows) ? alertRows : [];
      const filtered =
        committeeId == null
          ? normalizedRows
          : normalizedRows.filter(
            (item) =>
              Number(item.committeeId ?? item.councilId ?? 0) ===
              Number(committeeId) ||
              String(item.committeeCode ?? "") === String(committeeId),
          );
      return toCompatResponse(snapshotRes, filtered);
    },
    getTopicFinalProgress: async (committeeId?: string | number) => {
      const snapshotRes = await getLecturerSnapshot();
      const snapshot = readEnvelopeData<Record<string, unknown>>(snapshotRes);
      const scoring = pickSnapshotSection<Record<string, unknown>>(
        snapshot,
        ["scoring", "Scoring"],
        {},
      );
      const rows = pickSnapshotSection<Array<Record<string, unknown>>>(
        scoring,
        ["topicFinalProgress", "TopicFinalProgress"],
        [],
      );
      const normalizedRows = Array.isArray(rows) ? rows : [];
      const filtered =
        committeeId == null
          ? normalizedRows
          : normalizedRows.filter(
            (item) =>
              Number(item.committeeId ?? item.councilId ?? 0) ===
              Number(committeeId) ||
              String(item.committeeCode ?? "") === String(committeeId),
          );

      return toCompatResponse(snapshotRes, filtered);
    },
    approveRevision: (revisionId: number, idempotencyKey?: string) =>
      fetchData<ApiResponse<boolean>>(`${lecturerBase}/revisions/actions`, {
        method: "POST",
        body: {
          action: "APPROVE",
          revisionId,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      }),
    rejectRevision: (revisionId: number, reason: string, idempotencyKey?: string) =>
      fetchData<ApiResponse<boolean>>(`${lecturerBase}/revisions/actions`, {
        method: "POST",
        body: {
          action: "REJECT",
          revisionId,
          reject: {
            reason,
          },
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      }),
  };
  const notifyError = (message: string) => addToast(message, "error");
  const notifySuccess = (message: string) => addToast(message, "success");
  const notifyInfo = (message: string) => addToast(message, "info");

  useEffect(() => {
    setActiveDefensePeriodId(periodId);
  }, [periodId]);

  const [activePanel, setActivePanel] = useState<PanelKey>(isGradingScreen ? "grading" : "councils");
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [detailCommitteeId, setDetailCommitteeId] = useState<string>("");
  const [detailTab, setDetailTab] = useState<CommitteeDetailTabKey>("overview");
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<string>("");
  const [joinedCommitteeId, setJoinedCommitteeId] = useState<string>("");
  const [loadingData, setLoadingData] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [revisionQueue, setRevisionQueue] = useState<RevisionRequest[]>([]);
  const [revision, setRevision] = useState<RevisionRequest>(EMPTY_REVISION);
  const [assignmentConcurrencyToken, setAssignmentConcurrencyToken] = useState(
    createConcurrencyToken("lecturer-assignment")
  );
  const [latestActionTrace, setLatestActionTrace] = useState<WorkflowActionTrace | null>(null);
  const [scoringOverview, setScoringOverview] = useState<ScoringOverview>({
    variance: null,
    varianceThreshold: null,
    finalScore: null,
    finalLetter: null,
  });


  const [allScoringRows, setAllScoringRows] = useState<ScoringMatrixRow[]>([]);
  const [scoringMatrix, setScoringMatrix] = useState<ScoringMatrixRow[]>([]);
  const [scoringAlerts, setScoringAlerts] = useState<ScoringAlertRow[]>([]);
  const [topicFinalProgressRows, setTopicFinalProgressRows] = useState<TopicFinalProgressRow[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number>(0);
  const [fallbackAllowedActions, setFallbackAllowedActions] = useState<string[]>([]);
  const [roomNow, setRoomNow] = useState<Date>(() => new Date());


  useEffect(() => {
    setActivePanel(isGradingScreen ? "grading" : "councils");
  }, [isGradingScreen]);

  useEffect(() => {
    if (!isGradingScreen || committees.length === 0) {
      return;
    }

    const fallbackCommittee = committees.find((item) => item.status === "Đang họp") ?? committees[0] ?? null;
    const targetCommittee = committees.find((item) => item.id === committeeIdParam) ?? fallbackCommittee;

    if (!targetCommittee) {
      return;
    }

    if (selectedCommitteeId !== targetCommittee.id) {
      setSelectedCommitteeId(targetCommittee.id);
    }

    if (joinedCommitteeId !== targetCommittee.id) {
      setJoinedCommitteeId(targetCommittee.id);
    }
  }, [
    committees,
    committeeIdParam,
    isGradingScreen,
    joinedCommitteeId,
    selectedCommitteeId,
  ]);

  const normalizedFallbackAllowedActions = useMemo(
    () => normalizeAllowedActions(fallbackAllowedActions),
    [fallbackAllowedActions],
  );

  const hasAllowedAction = (scopedActions: string[], ...actions: string[]) => {
    const normalizedScopedActions = normalizeAllowedActions(scopedActions);
    if (normalizedScopedActions.length > 0) {
      return includesAnyAction(normalizedScopedActions, ...actions);
    }
    if (normalizedFallbackAllowedActions.length > 0) {
      return includesAnyAction(normalizedFallbackAllowedActions, ...actions);
    }
    return false;
  };

  const notifyApiFailure = (response: ApiResponse<unknown> | null | undefined, fallback: string) => {
    const allowedActions = readEnvelopeAllowedActions(response);
    if (allowedActions.length > 0) {
      setFallbackAllowedActions(normalizeAllowedActions(allowedActions));
    }

    const warnings = readEnvelopeWarningMessages(response);
    if (warnings.length) {
      notifyInfo(warnings.join(" | "));
    }

    const success = readEnvelopeSuccess(response);
    const messages = readEnvelopeErrorMessages(response);
    const message = readEnvelopeMessage(response);
    if (!success) {
      notifyError(messages[0] || message || fallback);
      return true;
    }
    if (message) {
      notifyInfo(message);
    }

    return false;
  };

  const extractMissingMemberCodes = (error: unknown): string[] => {
    const record = toRecord(error);
    if (!record) {
      return [];
    }

    const candidateValues: unknown[] = [
      pickCaseInsensitiveValue<unknown>(record, ["missingMembers", "MissingMembers"], null),
      pickCaseInsensitiveValue<unknown>(record, ["missingMemberCodes", "MissingMemberCodes"], null),
      pickCaseInsensitiveValue<unknown>(record, ["members", "Members"], null),
      pickCaseInsensitiveValue<unknown>(record, ["errors", "Errors"], null),
    ];

    for (const candidate of candidateValues) {
      if (Array.isArray(candidate)) {
        return candidate
          .map((item) => String(item ?? "").trim())
          .filter(Boolean);
      }

      if (typeof candidate === "string") {
        return candidate
          .split(/[;,|]/)
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    return [];
  };

  const mapRevisionQueueRows = (rows: unknown): RevisionRequest[] => {
    if (!Array.isArray(rows)) {
      return [];
    }

    return rows
      .map((item, index): RevisionRequest => {
        const revisionId = Number(
          pickSnapshotSection<unknown>(item, ["revisionId", "RevisionId", "id", "Id"], 0),
        );
        const assignmentIdValue = Number(
          pickSnapshotSection<unknown>(item, ["assignmentId", "AssignmentId"], 0),
        );
        const statusRaw = String(
          pickSnapshotSection<unknown>(item, ["finalStatus", "FinalStatus", "status", "Status"], "PENDING"),
        )
          .trim()
          .toUpperCase();

        const status: RevisionRequest["status"] =
          statusRaw === "2" || statusRaw === "APPROVED"
            ? "approved"
            : statusRaw === "3" || statusRaw === "REJECTED"
              ? "rejected"
              : "pending";

        const topicCode = toStringOrNull(
          pickSnapshotSection<unknown>(item, ["topicCode", "TopicCode"], null),
        );
        const topicTitle =
          toStringOrNull(
            pickSnapshotSection<unknown>(item, ["topicTitle", "TopicTitle", "title", "Title"], null),
          ) ??
          topicCode ??
          "-";

        const studentCode =
          toStringOrNull(
            pickSnapshotSection<unknown>(
              item,
              ["studentCode", "StudentCode", "proposerStudentCode", "ProposerStudentCode"],
              null,
            ),
          ) ?? "-";
        const reason = toStringOrNull(
          pickSnapshotSection<unknown>(item, ["reason", "Reason", "rejectReason", "RejectReason"], null),
        );

        return {
          revisionId:
            Number.isFinite(revisionId) && revisionId > 0
              ? revisionId
              : Number.isFinite(assignmentIdValue) && assignmentIdValue > 0
                ? assignmentIdValue
                : index + 1,
          assignmentId:
            Number.isFinite(assignmentIdValue) && assignmentIdValue > 0
              ? assignmentIdValue
              : null,
          studentCode,
          topicCode,
          topicTitle,
          revisionFileUrl: toStringOrNull(
            pickSnapshotSection<unknown>(
              item,
              ["revisionFileUrl", "RevisionFileUrl", "fileUrl", "FileUrl"],
              null,
            ),
          ),
          lastUpdated: toStringOrNull(
            pickSnapshotSection<unknown>(item, ["lastUpdated", "LastUpdated", "updatedAt", "UpdatedAt"], null),
          ),
          status,
          ...(reason ? { reason } : {}),
        };
      })
      ;
  };

  const mapDefenseDocuments = (documents: unknown): DefenseDocument[] => {
    if (!Array.isArray(documents)) {
      return [];
    }

    return documents
      .map((entry, index) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const record = entry as Record<string, unknown>;
        const fileId = Number(
          pickSnapshotSection<unknown>(
            record,
            ["fileID", "FileID", "fileId", "FileId", "documentId", "DocumentId", "id", "Id"],
            0,
          ),
        );
        const rawFileUrl = String(
          pickSnapshotSection<unknown>(
            record,
            ["fileURL", "FileURL", "fileUrl", "FileUrl", "downloadUrl", "DownloadUrl", "url", "Url"],
            "",
          ),
        ).trim();

        const fallbackDownloadUrl =
          Number.isFinite(fileId) && fileId > 0
            ? `/api/SubmissionFiles/download/${fileId}`
            : "";
        const resolvedUrl = rawFileUrl || fallbackDownloadUrl;
        const normalizedFileUrl = normalizeUrl(resolvedUrl);

        const rawName = String(
          pickSnapshotSection<unknown>(
            record,
            ["fileName", "FileName", "documentName", "DocumentName", "name", "Name", "documentType", "DocumentType"],
            "",
          ),
        ).trim();

        const documentType = String(
          pickSnapshotSection<unknown>(record, ["documentType", "DocumentType"], ""),
        ).trim();

        const fallbackName =
          resolvedUrl
            .split("?")[0]
            .split("#")[0]
            .split("/")
            .pop() || documentType || `Bao-cao-${index + 1}`;

        const uploadedAt = String(
          pickSnapshotSection<unknown>(record, ["uploadedAt", "UploadedAt", "generatedAt", "GeneratedAt"], ""),
        ).trim();

        const fileName = rawName || decodeURIComponent(fallbackName);
        if (!fileName && !normalizedFileUrl) {
          return null;
        }

        return {
          documentId:
            Number.isFinite(fileId) && fileId > 0
              ? fileId
              : index + 1,
          fileName,
          fileUrl: normalizedFileUrl,
          mimeType:
            String(
              pickSnapshotSection<unknown>(
                record,
                ["mimeType", "MimeType", "contentType", "ContentType", "fileType", "FileType"],
                "",
              ),
            ).trim() || null,
          uploadedAt: uploadedAt || null,
        };
      })
      .filter((item): item is DefenseDocument => Boolean(item));
  };

  const mapCommitteeMembers = (rawMembers: unknown): CommitteeMemberView[] => {
    if (!Array.isArray(rawMembers)) {
      return [];
    }

    return rawMembers
      .map((member, index) => {
        const record = toRecord(member);
        if (!record) {
          return null;
        }

        const roleRaw = String(
          pickSnapshotSection<unknown>(record, ["role", "Role", "roleCode", "RoleCode"], ""),
        ).trim();
        const roleCode = normalizeCommitteeRole(roleRaw);
        const lecturerCode =
          toStringOrNull(
            pickSnapshotSection<unknown>(
              record,
              ["lecturerCode", "LecturerCode", "memberCode", "MemberCode"],
              null,
            ),
          ) ?? "";
        const lecturerName =
          toStringOrNull(
            pickSnapshotSection<unknown>(
              record,
              ["lecturerName", "LecturerName", "fullName", "FullName", "name", "Name"],
              null,
            ),
          ) ??
          (lecturerCode ? `GV ${lecturerCode}` : "Chưa cập nhật");

        return {
          memberId:
            toStringOrNull(
              pickSnapshotSection<unknown>(record, ["memberId", "MemberId", "id", "Id"], null),
            ) ?? `${lecturerCode || "member"}-${index + 1}`,
          lecturerCode,
          lecturerName,
          degree: toStringOrNull(
            pickSnapshotSection<unknown>(record, ["degree", "Degree"], null),
          ),
          organization: toStringOrNull(
            pickSnapshotSection<unknown>(record, ["organization", "Organization"], null),
          ),
          roleRaw,
          roleCode,
          roleLabel: getRoleLabel(roleCode),
        };
      })
      .filter((member): member is CommitteeMemberView => Boolean(member));
  };

  const mapScoringMatrixRows = (
    items: Array<Record<string, unknown>>,
    committeeIdFallback = 0,
    committeeCodeFallback = "",
    defaultSession: SessionCode | null = null,
    committeeNameFallback = "",
  ): ScoringMatrixRow[] =>
    items.map((item) => {
      const topicRecord = toRecord(
        pickSnapshotSection<unknown>(item, ["topic", "Topic"], null),
      );
      const rawDocuments = pickSnapshotSection<unknown>(
        item,
        [
          "defenseDocuments",
          "DefenseDocuments",
          "reportDocuments",
          "ReportDocuments",
          "documents",
          "Documents",
          "files",
          "Files",
        ],
        [],
      );

      const topicCode =
        toStringOrNull(
          pickSnapshotSection<unknown>(item, ["topicCode", "TopicCode"], null),
        ) ?? null;
      const assignmentCode =
        toStringOrNull(
          pickSnapshotSection<unknown>(item, ["assignmentCode", "AssignmentCode"], null),
        ) ?? topicCode ?? "-";

      const supervisorNameFromRow = toStringOrNull(
        pickSnapshotSection<unknown>(
          item,
          [
            "supervisorLecturerName",
            "SupervisorLecturerName",
            "supervisorName",
            "SupervisorName",
            "gvhdName",
            "GvhdName",
          ],
          null,
        ),
      );
      const supervisorNameFromTopic = topicRecord
        ? toStringOrNull(
          pickSnapshotSection<unknown>(
            topicRecord,
            [
              "supervisorLecturerName",
              "SupervisorLecturerName",
              "supervisorName",
              "SupervisorName",
              "lecturerName",
              "LecturerName",
              "supervisorFullName",
              "SupervisorFullName",
            ],
            null,
          ),
        )
        : null;
      const supervisorCode =
        toStringOrNull(
          pickSnapshotSection<unknown>(
            item,
            ["supervisorLecturerCode", "SupervisorLecturerCode", "supervisorCode", "SupervisorCode"],
            null,
          ),
        ) ??
        (topicRecord
          ? toStringOrNull(
            pickSnapshotSection<unknown>(
              topicRecord,
              ["supervisorLecturerCode", "SupervisorLecturerCode", "supervisorCode", "SupervisorCode"],
              null,
            ),
          )
          : null);

      const rowTagNames = normalizeTopicTagNames(
        pickSnapshotSection<unknown>(
          item,
          ["topicTags", "TopicTags", "tags", "Tags", "tagNames", "TagNames", "tagCodes", "TagCodes"],
          [],
        ),
      );
      const topicTagNames = topicRecord
        ? normalizeTopicTagNames(
          pickSnapshotSection<unknown>(
            topicRecord,
            ["topicTags", "TopicTags", "tags", "Tags", "tagNames", "TagNames", "tagCodes", "TagCodes"],
            [],
          ),
        )
        : [];
      const topicTags = Array.from(new Set([...rowTagNames, ...topicTagNames]));

      const startTime = normalizeTimeText(
        pickSnapshotSection<unknown>(
          item,
          ["startTime", "StartTime", "slotStart", "SlotStart"],
          null,
        ),
      );
      const endTime = normalizeTimeText(
        pickSnapshotSection<unknown>(
          item,
          ["endTime", "EndTime", "slotEnd", "SlotEnd"],
          null,
        ),
      );

      const rawSession = toStringOrNull(
        pickSnapshotSection<unknown>(
          item,
          ["session", "Session", "sessionCode", "SessionCode"],
          null,
        ),
      );

      const scheduledAt = toIsoDateOrNull(
        pickSnapshotSection<unknown>(item, ["scheduledAt", "ScheduledAt", "defenseDate", "DefenseDate"], null),
      );

      const resolvedSession = rawSession
        ? normalizeSessionCode(rawSession)
        : inferSessionFromTime(startTime) ?? defaultSession ?? null;

      return {
        committeeId:
          Number(
            pickSnapshotSection<unknown>(item, ["committeeId", "CommitteeId", "councilId", "CouncilId"], committeeIdFallback),
          ) || committeeIdFallback,
        committeeCode:
          String(
            pickSnapshotSection<unknown>(item, ["committeeCode", "CommitteeCode", "councilCode", "CouncilCode"], committeeCodeFallback),
          ) || committeeCodeFallback,
        committeeName:
          toStringOrNull(
            pickSnapshotSection<unknown>(item, ["committeeName", "CommitteeName", "councilName", "CouncilName", "name", "Name"], null),
          ) ?? committeeNameFallback ?? committeeCodeFallback,
        assignmentId: Number(pickSnapshotSection<unknown>(item, ["assignmentId", "AssignmentId"], 0)),
        assignmentCode,
        topicCode,
        topicTitle:
          toStringOrNull(
            pickSnapshotSection<unknown>(item, ["topicTitle", "TopicTitle", "title", "Title"], null),
          ) ?? assignmentCode,
        studentCode: String(pickSnapshotSection<unknown>(item, ["studentCode", "StudentCode"], "-")),
        studentName: String(pickSnapshotSection<unknown>(item, ["studentName", "StudentName"], "-")),
        supervisorLecturerName:
          supervisorNameFromRow ??
          supervisorNameFromTopic ??
          (supervisorCode ? `GV ${supervisorCode}` : null),
        topicTags,
        session: resolvedSession,
        scheduledAt,
        startTime,
        endTime,
        topicSupervisorScore: toNumberOrNull(
          pickSnapshotSection<unknown>(item, ["topicSupervisorScore", "TopicSupervisorScore", "scoreGvhd", "ScoreGvhd"], null),
        ),
        scoreGvhd: toNumberOrNull(
          pickSnapshotSection<unknown>(item, ["scoreGvhd", "ScoreGvhd", "topicSupervisorScore", "TopicSupervisorScore"], null),
        ),
        scoreCt: toNumberOrNull(
          pickSnapshotSection<unknown>(item, ["scoreCt", "ScoreCt"], null),
        ),
        scoreTk: toNumberOrNull(
          pickSnapshotSection<unknown>(item, ["scoreTk", "ScoreTk", "scoreUvtk", "ScoreUvtk"], null),
        ),
        scorePb: toNumberOrNull(
          pickSnapshotSection<unknown>(item, ["scorePb", "ScorePb", "scoreUvpb", "ScoreUvpb"], null),
        ),
        finalScore: toNumberOrNull(pickSnapshotSection<unknown>(item, ["finalScore", "FinalScore"], null)),
        finalGrade:
          toStringOrNull(
            pickSnapshotSection<unknown>(item, ["finalGrade", "FinalGrade", "finalLetter", "FinalLetter"], null),
          ) ?? null,
        variance: toNumberOrNull(pickSnapshotSection<unknown>(item, ["variance", "Variance"], null)),
        isLocked: Boolean(pickSnapshotSection<unknown>(item, ["isLocked", "IsLocked"], false)),
        status: String(pickSnapshotSection<unknown>(item, ["status", "Status"], "PENDING")),
        submittedCount: Number(pickSnapshotSection<unknown>(item, ["submittedCount", "SubmittedCount"], 0)),
        requiredCount: Number(pickSnapshotSection<unknown>(item, ["requiredCount", "RequiredCount"], 0)),
        defenseDocuments: mapDefenseDocuments(rawDocuments),
      };
    });

  const refreshAllScoringRows = async () => {
    const [allMatrixResponse, topicProgressResponse] = await Promise.all([
      lecturerApi.getScoringMatrix(),
      lecturerApi.getTopicFinalProgress(),
    ]);
    if (notifyApiFailure(allMatrixResponse as ApiResponse<unknown>, "Không tải được danh sách đề tài chấm điểm.")) {
      return;
    }

    const matrixItems = (allMatrixResponse?.data ?? []) as Array<Record<string, unknown>>;
    setAllScoringRows(mapScoringMatrixRows(matrixItems));

    if (!notifyApiFailure(topicProgressResponse as ApiResponse<unknown>, "Không tải được tiến độ điểm tổng theo đề tài.")) {
      const rows = (topicProgressResponse?.data ?? []) as Array<Record<string, unknown>>;
      setTopicFinalProgressRows(
        rows.map((item) => ({
          committeeId: Number(item.committeeId ?? 0),
          committeeCode: String(item.committeeCode ?? ""),
          totalTopics: Number(item.totalTopics ?? 0),
          scoredTopics: Number(item.scoredTopics ?? 0),
          progressPercent: Number(item.progressPercent ?? 0),
        })),
      );
    }
  };

  const refreshRevisionQueue = async () => {
    const response = await lecturerApi.getRevisionQueue();
    if (notifyApiFailure(response as ApiResponse<unknown>, "Không tải được hàng chờ chỉnh sửa.")) {
      return;
    }
    const mapped = mapRevisionQueueRows((response?.data ?? []) as Array<Record<string, unknown>>);
    setRevisionQueue(mapped);
    setRevision((prev) => mapped.find((item) => item.revisionId === prev.revisionId) ?? mapped[0] ?? EMPTY_REVISION);
  };

  const refreshScoringData = async (committeeId: number) => {
    const [matrixRes, alertsRes, topicProgressRes] = await Promise.all([
      lecturerApi.getScoringMatrix(committeeId),
      lecturerApi.getScoringAlerts(committeeId),
      lecturerApi.getTopicFinalProgress(),
    ]);

    if (notifyApiFailure(matrixRes as ApiResponse<unknown>, "Không tải được bảng chấm điểm.")) {
      return;
    }

    const matrixItems = (matrixRes?.data ?? []) as Array<Record<string, unknown>>;
    const committeeSessionFallback = committees.find((item) => item.id === selectedCommitteeId)?.session ?? null;
    const committeeNameFallback = committees.find((item) => item.id === selectedCommitteeId)?.name ?? selectedCommitteeId;
    const mappedMatrix = mapScoringMatrixRows(
      matrixItems,
      committeeId,
      selectedCommitteeId,
      committeeSessionFallback,
      committeeNameFallback,
    );
    setScoringMatrix(mappedMatrix);
    setSelectedAssignmentId((prev) => {
      if (prev > 0 && mappedMatrix.some((row) => row.assignmentId === prev)) {
        return prev;
      }
      return mappedMatrix[0]?.assignmentId ?? 0;
    });

    const alertItems = (alertsRes?.data ?? []) as Array<Record<string, unknown>>;
    setScoringAlerts(
      alertItems.map((item) => ({
        assignmentId: Number(item.assignmentId ?? 0),
        message: String(item.message ?? ""),
        value: Number.isFinite(Number(item.value)) ? Number(item.value) : null,
        threshold: Number.isFinite(Number(item.threshold)) ? Number(item.threshold) : null,
      }))
    );

    if (!notifyApiFailure(topicProgressRes as ApiResponse<unknown>, "Không tải được tiến độ điểm tổng theo đề tài.")) {
      const rows = (topicProgressRes?.data ?? []) as Array<Record<string, unknown>>;
      setTopicFinalProgressRows(
        rows.map((item) => ({
          committeeId: Number(item.committeeId ?? 0),
          committeeCode: String(item.committeeCode ?? ""),
          totalTopics: Number(item.totalTopics ?? 0),
          scoredTopics: Number(item.scoredTopics ?? 0),
          progressPercent: Number(item.progressPercent ?? 0),
        })),
      );
    }
  };



  useEffect(() => {
    const hydrateLecturerData = async () => {
      setLoadingData(true);
      try {
        const [committeeRes, revisionRes] = await Promise.all([
          lecturerApi.getCommittees() as Promise<
            ApiResponse<{
              items?: Array<Record<string, unknown>>;
              councilListLocked?: boolean | null;
              councilLockStatus?: string | null;
            }>
          >,
          lecturerApi.getRevisionQueue(),
        ]);
        setCurrentSnapshotError(null);

        const allowedActions =
          committeeRes?.allowedActions ?? committeeRes?.AllowedActions;
        if (allowedActions) {
          setFallbackAllowedActions(normalizeAllowedActions(allowedActions));
        }

        const committeePayload =
          (committeeRes?.data as {
            items?: Array<Record<string, unknown>>;
            councilListLocked?: boolean | null;
            councilLockStatus?: string | null;
          } | null) ?? null;

        const lockStatusText = String(committeePayload?.councilLockStatus ?? "")
          .trim()
          .toUpperCase();
        if (typeof committeePayload?.councilListLocked === "boolean") {
          setCouncilListLocked(committeePayload.councilListLocked);
          setCouncilLockStatus(
            lockStatusText || (committeePayload.councilListLocked ? "LOCKED" : "UNLOCKED"),
          );
        } else if (lockStatusText) {
          setCouncilListLocked(lockStatusText === "LOCKED");
          setCouncilLockStatus(lockStatusText);
        } else {
          setCouncilListLocked(null);
          setCouncilLockStatus("UNKNOWN");
        }

        const committeeItems =
          (committeePayload?.items ?? []) as Array<Record<string, unknown>>;

        if (committeeItems.length) {
          const mapped = committeeItems.map((item, index) => {
            const roleValue = pickSnapshotSection<unknown>(
              item,
              ["normalizedRole", "NormalizedRole", "role", "Role"],
              "",
            );
            const roleCode = normalizeCommitteeRole(roleValue);
            const numericIdRaw = Number(
              pickSnapshotSection<unknown>(
                item,
                ["committeeId", "CommitteeId", "councilId", "CouncilId", "id", "Id"],
                0,
              ),
            );
            const committeeCode = String(
              pickSnapshotSection<unknown>(
                item,
                ["committeeCode", "CommitteeCode", "councilCode", "CouncilCode"],
                `HD-${index + 1}`,
              ),
            ).trim() || `HD-${index + 1}`;
            const fallbackNumeric = Number(String(committeeCode).replace(/\D+/g, ""));
            const numericId =
              Number.isFinite(numericIdRaw) && numericIdRaw > 0
                ? numericIdRaw
                : Number.isFinite(fallbackNumeric) && fallbackNumeric > 0
                  ? fallbackNumeric
                  : index + 1;

            const allowedScoringActions = normalizeAllowedActions(
              pickSnapshotSection<unknown>(
                item,
                ["allowedScoringActions", "AllowedScoringActions"],
                [],
              ),
            );
            const allowedMinuteActions = normalizeAllowedActions(
              pickSnapshotSection<unknown>(
                item,
                ["allowedMinuteActions", "AllowedMinuteActions"],
                [],
              ),
            );
            const allowedRevisionActions = normalizeAllowedActions(
              pickSnapshotSection<unknown>(
                item,
                ["allowedRevisionActions", "AllowedRevisionActions"],
                [],
              ),
            );

            const sessionRaw = toStringOrNull(
              pickSnapshotSection<unknown>(
                item,
                ["sessionCode", "SessionCode", "session", "Session"],
                null,
              ),
            );

            const committeeName =
              toStringOrNull(
                pickSnapshotSection<unknown>(
                  item,
                  ["name", "Name", "committeeName", "CommitteeName"],
                  null,
                ),
              ) ?? `Hội đồng ${committeeCode}`;

            const startTime = normalizeTimeText(
              pickSnapshotSection<unknown>(
                item,
                ["startTime", "StartTime", "slotStart", "SlotStart"],
                null,
              ),
            );
            const endTime = normalizeTimeText(
              pickSnapshotSection<unknown>(
                item,
                ["endTime", "EndTime", "slotEnd", "SlotEnd"],
                null,
              ),
            );

            const scheduledAt = toIsoDateOrNull(
              pickSnapshotSection<unknown>(
                item,
                ["scheduledAt", "ScheduledAt", "defenseDate", "DefenseDate"],
                null,
              ),
            );

            const resolvedSession = sessionRaw
              ? normalizeSessionCode(sessionRaw)
              : inferSessionFromTime(startTime);

            const slot =
              startTime && endTime
                ? `${startTime} - ${endTime}`
                : startTime
                  ? `Từ ${startTime}`
                  : endTime
                    ? `Đến ${endTime}`
                    : null;

            const defenseDate = scheduledAt ? scheduledAt.slice(0, 10) : null;

            const members = mapCommitteeMembers(
              pickSnapshotSection<unknown>(
                item,
                ["members", "Members", "committeeMembers", "CommitteeMembers"],
                [],
              ),
            );

            return {
              id: committeeCode,
              name: committeeName,
              numericId,
              room: String(pickSnapshotSection<unknown>(item, ["room", "Room"], "-") ?? "-") || "-",
              session: resolvedSession,
              date: defenseDate,
              slot,
              studentCount: Number(
                pickSnapshotSection<unknown>(
                  item,
                  ["studentCount", "StudentCount", "topicCount", "TopicCount", "assignmentCount", "AssignmentCount"],
                  0,
                ) ?? 0,
              ),
              status: mapCommitteeStatus(pickSnapshotSection<unknown>(item, ["status", "Status"], "")),
              normalizedRole: roleCode,
              roleCode,
              roleLabel: getRoleLabel(roleCode),
              roleRaw: String(pickSnapshotSection<unknown>(item, ["role", "Role"], "")).trim(),
              allowedScoringActions,
              allowedMinuteActions,
              allowedRevisionActions,
              members,
            };
          }) satisfies Committee[];
          setCommittees(mapped);
          setSelectedCommitteeId((prev) => (mapped.some((item) => item.id === prev) ? prev : mapped[0]?.id ?? ""));
          setDetailCommitteeId((prev) => (mapped.some((item) => item.id === prev) ? prev : ""));
          await refreshAllScoringRows();
        } else {
          setCommittees([]);
          setSelectedCommitteeId("");
          setDetailCommitteeId("");
        }

        if (!notifyApiFailure(revisionRes as ApiResponse<unknown>, "Không tải được hàng chờ chỉnh sửa.")) {
          const mappedRevisions = mapRevisionQueueRows((revisionRes?.data ?? []) as Array<Record<string, unknown>>);
          setRevisionQueue(mappedRevisions);
          setRevision(mappedRevisions[0] ?? EMPTY_REVISION);
        }
      } catch (error) {
        setCommittees([]);
        setAllScoringRows([]);
        setRevisionQueue([]);
        setRevision(EMPTY_REVISION);
        setSelectedCommitteeId("");
        setDetailCommitteeId("");
        setCouncilListLocked(null);
        setCouncilLockStatus("UNKNOWN");

        if (error instanceof FetchDataError) {
          const apiMessage = readApiErrorMessage(error.data);

          if (error.status === 404) {
            const message =
              apiMessage ??
              "Bạn chưa được gán vào đợt bảo vệ đang hoạt động. Vui lòng liên hệ quản trị viên.";
            setCurrentSnapshotError(message);
            setCurrentPeriod(null);
            notifyInfo(message);
            return;
          }

          if (error.status === 409) {
            const message =
              apiMessage ??
              "Tài khoản hiện tại đang gắn với nhiều đợt bảo vệ hoạt động. Vui lòng liên hệ quản trị viên để xử lý dữ liệu.";
            setCurrentSnapshotError(message);
            setCurrentPeriod(null);
            notifyError(message);
            return;
          }
        }

        if (error instanceof Error && error.message === "CURRENT_PERIOD_CONTRACT_INVALID") {
          const message = "Dữ liệu snapshot hiện tại không chứa thông tin đợt bảo vệ hợp lệ.";
          setCurrentSnapshotError(message);
          setCurrentPeriod(null);
          notifyError(message);
          return;
        }

        setCurrentSnapshotError("Không tải được dữ liệu giảng viên từ API.");
        notifyError("Không tải được dữ liệu giảng viên từ API.");
      } finally {
        setLoadingData(false);
      }
    };

    void hydrateLecturerData();
  }, [periodId]);

  const committeeStats = useMemo(() => {
    const live = committees.filter((item) => item.status === "Đang họp").length;
    const upcoming = committees.filter((item) => item.status === "Sắp diễn ra").length;
    const locked = committees.filter((item) => item.status === "Đã chốt" || item.status === "Đã đóng").length;
    const pendingRevision = revisionQueue.filter((item) => item.status === "pending").length;
    return { live, upcoming, locked, pendingRevision };
  }, [committees, revisionQueue]);

  const periodDisplay = currentPeriod
    ? `${currentPeriod.name} (#${currentPeriod.periodId})`
    : periodId
      ? `Đợt #${periodId}`
      : "Chưa xác định";
  const waitingCouncilLock = !currentSnapshotError && councilListLocked === false;
  const hasCommitteeAccess = councilListLocked === true && committees.length > 0;
  const accessDeniedMessage =
    councilListLocked === false
      ? "Danh sách hội đồng chưa được chốt. Giảng viên chỉ có thể xem khi hội đồng đã khóa."
      : councilListLocked === true
        ? "Giảng viên hiện không thuộc hội đồng nào trong đợt bảo vệ này."
        : "Không xác định được quyền xem hội đồng hiện tại.";

  const selectedCommittee = useMemo(
    () => committees.find((item) => item.id === selectedCommitteeId) ?? null,
    [committees, selectedCommitteeId]
  );
  const joinedCommittee = useMemo(
    () => committees.find((item) => item.id === joinedCommitteeId) ?? null,
    [committees, joinedCommitteeId],
  );
  const detailCommittee = useMemo(
    () => committees.find((item) => item.id === detailCommitteeId) ?? null,
    [committees, detailCommitteeId],
  );
  const selectedCommitteeNumericId = useMemo(() => {
    if (selectedCommittee?.numericId && selectedCommittee.numericId > 0) {
      return selectedCommittee.numericId;
    }
    const parsed = Number(String(selectedCommitteeId).replace(/\D+/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }, [selectedCommittee, selectedCommitteeId]);

  const selectedMatrixRow = useMemo(
    () => scoringMatrix.find((row) => row.assignmentId === selectedAssignmentId) ?? null,
    [scoringMatrix, selectedAssignmentId]
  );

  const isRowInCommittee = (row: ScoringMatrixRow, committee: Committee | null) => {
    if (!committee) {
      return false;
    }

    const committeeCode = normalizeCommitteeKey(committee.id);
    const rowCommitteeCode = normalizeCommitteeKey(row.committeeCode);
    const committeeDigits = extractDigits(committee.id);
    const rowCommitteeDigits = extractDigits(row.committeeCode);
    const rowCommitteeIdDigits = extractDigits(row.committeeId);

    return (
      row.committeeId === committee.numericId ||
      rowCommitteeCode === committeeCode ||
      (committeeDigits.length > 0 && (rowCommitteeDigits === committeeDigits || rowCommitteeIdDigits === committeeDigits)) ||
      normalizeCommitteeKey(row.committeeName) === normalizeCommitteeKey(committee.name)
    );
  };

  const committeeBadgeStats = useMemo(() => {
    const statsMap = new Map<string, { total: number; scored: number; locked: number }>();

    committees.forEach((committee) => {
      statsMap.set(committee.id, { total: 0, scored: 0, locked: 0 });
    });

    allScoringRows.forEach((row) => {
      const matched = committees.find((committee) => isRowInCommittee(row, committee));
      if (!matched) {
        return;
      }

      const current = statsMap.get(matched.id) ?? { total: 0, scored: 0, locked: 0 };
      current.total += 1;
      if (row.finalScore != null && Number(row.finalScore) > 0) {
        current.scored += 1;
      }
      if (row.isLocked) {
        current.locked += 1;
      }
      statsMap.set(matched.id, current);
    });

    committees.forEach((committee) => {
      const fromTopicProgress =
        topicFinalProgressRows.find(
          (row) =>
            row.committeeId === committee.numericId ||
            String(row.committeeCode).trim().toUpperCase() === committee.id.trim().toUpperCase(),
        ) ?? null;

      const current = statsMap.get(committee.id) ?? { total: 0, scored: 0, locked: 0 };
      current.total = Math.max(current.total, fromTopicProgress?.totalTopics ?? 0, committee.studentCount);
      current.scored = Math.max(current.scored, fromTopicProgress?.scoredTopics ?? 0);
      statsMap.set(committee.id, current);
    });

    return statsMap;
  }, [allScoringRows, committees, topicFinalProgressRows]);

  const detailCommitteeRows = useMemo(
    () => allScoringRows.filter((row) => isRowInCommittee(row, detailCommittee)),
    [allScoringRows, detailCommittee],
  );

  const selectedRevisionItem = useMemo(
    () =>
      revisionQueue.find((item) => item.assignmentId != null && item.assignmentId === selectedAssignmentId) ??
      revision,
    [revision, revisionQueue, selectedAssignmentId],
  );

  const getSessionSortOrder = (session: SessionCode | null): number => {
    if (session === "MORNING") {
      return 0;
    }
    if (session === "AFTERNOON") {
      return 1;
    }
    return 2;
  };

  const sortedScoringRows = useMemo(
    () =>
      [...scoringMatrix].sort((left, right) => {
        const leftSessionOrder = getSessionSortOrder(left.session);
        const rightSessionOrder = getSessionSortOrder(right.session);
        if (leftSessionOrder !== rightSessionOrder) {
          return leftSessionOrder - rightSessionOrder;
        }
        const leftTime = new Date(left.scheduledAt ?? 0).getTime();
        const rightTime = new Date(right.scheduledAt ?? 0).getTime();
        if (leftTime !== rightTime) {
          return leftTime - rightTime;
        }
        if ((left.startTime ?? "") !== (right.startTime ?? "")) {
          return (left.startTime ?? "").localeCompare(right.startTime ?? "");
        }
        return left.assignmentId - right.assignmentId;
      }),
    [scoringMatrix],
  );

  const morningRows = useMemo(
    () => sortedScoringRows.filter((row) => row.session === "MORNING"),
    [sortedScoringRows],
  );

  const afternoonRows = useMemo(
    () => sortedScoringRows.filter((row) => row.session === "AFTERNOON"),
    [sortedScoringRows],
  );

  const unscheduledRows = useMemo(
    () => sortedScoringRows.filter((row) => row.session == null),
    [sortedScoringRows],
  );

  const scoreGvhdDisplay =
    selectedMatrixRow?.topicSupervisorScore ??
    selectedMatrixRow?.scoreGvhd ??
    null;

  const selectedScoringActions = selectedCommittee?.allowedScoringActions ?? [];
  const selectedMinuteActions = selectedCommittee?.allowedMinuteActions ?? [];
  const selectedRevisionActions = selectedCommittee?.allowedRevisionActions ?? [];

  const hasScoringPermissionSource =
    selectedScoringActions.length > 0 || normalizedFallbackAllowedActions.length > 0;
  const hasMinutePermissionSource =
    selectedMinuteActions.length > 0 || normalizedFallbackAllowedActions.length > 0;
  const hasRevisionPermissionSource =
    selectedRevisionActions.length > 0 || normalizedFallbackAllowedActions.length > 0;

  const canOpenSessionByActions = hasAllowedAction(
    selectedScoringActions,
    "OPEN_SESSION",
    "UC3.1.OPEN",
  );
  const canSubmitScoreByActions = hasAllowedAction(
    selectedScoringActions,
    "SUBMIT",
    "SUBMIT_SCORE",
    "UC3.2.SUBMIT",
  );
  const canRequestReopenByActions = hasAllowedAction(
    selectedScoringActions,
    "REOPEN_REQUEST",
    "REOPEN_SCORE",
    "UC3.3.REOPEN",
  );
  const canLockSessionByActions = hasAllowedAction(
    selectedScoringActions,
    "LOCK_SESSION",
    "LOCK_SCORE",
    "UC3.5.LOCK",
  );

  const isSessionOpened = selectedCommittee?.status === "Đang họp";
  const isSessionClosed = selectedCommittee?.status === "Đã đóng" || selectedCommittee?.status === "Đã chốt";

  const permissionSourceMissing =
    !hasScoringPermissionSource && !hasMinutePermissionSource && !hasRevisionPermissionSource;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRoomNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (detailCommitteeId) {
      setDetailTab("overview");
    }
  }, [detailCommitteeId]);

  useEffect(() => {
    if (!joinedCommitteeId) {
      return;
    }
    const exists = committees.some((item) => item.id === joinedCommitteeId);
    if (!exists) {
      setJoinedCommitteeId("");
      if (activePanel === "grading") {
        setActivePanel("councils");
      }
    }
  }, [activePanel, committees, joinedCommitteeId]);

  useEffect(() => {
    if (!joinedCommitteeId) {
      return;
    }
    if (selectedCommitteeId !== joinedCommitteeId) {
      setSelectedCommitteeId(joinedCommitteeId);
    }
  }, [joinedCommitteeId, selectedCommitteeId]);




  const formatSession = (session: SessionCode | null) => {
    if (session === "MORNING") {
      return "Buổi sáng";
    }
    if (session === "AFTERNOON") {
      return "Buổi chiều";
    }
    return "Chưa phân ca";
  };

  const formatRowTimeRange = (row: ScoringMatrixRow) => {
    if (row.startTime && row.endTime) {
      return `${row.startTime} - ${row.endTime}`;
    }
    if (row.startTime) {
      return `Từ ${row.startTime}`;
    }
    if (row.scheduledAt) {
      return formatDateTime(row.scheduledAt);
    }
    return "Chưa có khung giờ";
  };

  const openRoleWorkspace = (committee: Committee) => {
    const isChair = committee.normalizedRole === "CT";
    if (!isChair && committee.status !== "Đang họp") {
      notifyInfo("Phòng chấm chỉ mở khi Chủ tịch đã mở phiên.");
      return;
    }
    setJoinedCommitteeId(committee.id);
    setSelectedCommitteeId(committee.id);
    setActivePanel("grading");
    navigate(`/lecturer/committees/grading?committeeId=${encodeURIComponent(committee.id)}`);
  };

  const syncCommitteeSessionStatus = (committeeId: string, nextStatus: Committee["status"]) => {
    setCommittees((prev) =>
      prev.map((committee) =>
        committee.id === committeeId ? { ...committee, status: nextStatus } : committee,
      ),
    );
  };

  const handleChairOpenSession = async (committee: Committee) => {
    if (committee.normalizedRole !== "CT") {
      notifyInfo("Chỉ Chủ tịch hội đồng mới có thể mở phiên.");
      return;
    }
    if (committee.status === "Đang họp") {
      notifyInfo("Phiên của hội đồng này đang mở sẵn.");
      return;
    }
    if (committee.status === "Đã chốt" || committee.status === "Đã đóng") {
      notifyInfo("Phiên đã chốt/đóng, không thể mở lại từ danh sách này.");
      return;
    }

    try {
      const idempotencyKey = createIdempotencyKey(periodIdText || "NA", `chair-open-${committee.id}`);
      const response = await lecturerApi.openSessionByCommittee(committee.numericId, idempotencyKey);
      if (notifyApiFailure(response as ApiResponse<unknown>, "Mở phiên hội đồng thất bại.")) {
        return;
      }

      syncCommitteeSessionStatus(committee.id, "Đang họp");
      pushTrace("open-session", `[Chair] Mở phiên hội đồng ${committee.id}.`);

      if (selectedCommitteeId === committee.id) {
        await refreshScoringData(committee.numericId);
      }

      notifySuccess(`Đã mở phiên hội đồng ${committee.id}.`);
    } catch {
      notifyError("Mở phiên hội đồng thất bại.");
    }
  };

  const handleChairCloseSession = async (committee: Committee) => {
    if (committee.normalizedRole !== "CT") {
      notifyInfo("Chỉ Chủ tịch hội đồng mới có thể đóng phiên.");
      return;
    }
    if (committee.status !== "Đang họp") {
      notifyInfo("Chỉ phiên đang họp mới có thể đóng.");
      return;
    }

    try {
      const idempotencyKey = createIdempotencyKey(periodIdText || "NA", `chair-close-${committee.id}`);
      const response = await lecturerApi.lockSessionByCommittee(committee.numericId, idempotencyKey);
      if (notifyApiFailure(response as ApiResponse<unknown>, "Đóng phiên hội đồng thất bại.")) {
        return;
      }

      syncCommitteeSessionStatus(committee.id, "Đã chốt");
      pushTrace("lock-session", `[Chair] Đóng phiên hội đồng ${committee.id}.`);

      if (selectedCommitteeId === committee.id) {
        await refreshScoringData(committee.numericId);
      }

      notifySuccess(`Đã đóng phiên hội đồng ${committee.id}.`);
    } catch (error) {
      const missingMembers = extractMissingMemberCodes(error);
      if (missingMembers.length > 0) {
        notifyError(`Thiếu điểm từ thành viên: ${missingMembers.join(", ")}`);
        return;
      }
      notifyError("Đóng phiên hội đồng thất bại.");
    }
  };

  const pushTrace = (action: string, note?: string) => {
    const idempotencyKey = createIdempotencyKey(periodIdText || "NA", action);
    setLatestActionTrace({
      action,
      periodId: periodIdText || "NA",
      idempotencyKey,
      concurrencyToken: assignmentConcurrencyToken,
      note,
      at: new Date().toLocaleString("vi-VN"),
    });
    return idempotencyKey;
  };




  const formatDate = (value: string | null) => {
    if (!value) {
      return "-";
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("vi-VN");
  };

  const formatDateTime = (value: string | null) => {
    if (!value) {
      return "-";
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("vi-VN");
  };

  const formatScore = (value: number | null) =>
    value == null ? "-" : value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

  const detailTabs: Array<{
    key: CommitteeDetailTabKey;
    label: string;
    icon: React.ReactNode;
  }> = [
      { key: "overview", label: "Tổng quan", icon: <Info size={14} /> },
      { key: "members", label: "Thành viên", icon: <Users2 size={14} /> },
      { key: "topics", label: "Đề tài", icon: <ClipboardPen size={14} /> },
    ];



  if (!loadingData && councilListLocked !== null && !currentSnapshotError && !hasCommitteeAccess) {
    return (
      <div
        style={{
          maxWidth: 1460,
          margin: "0 auto",
          padding: 24,
          position: "relative",
          fontFamily: '"Be Vietnam Pro", "Segoe UI", Tahoma, sans-serif',
        }}
        className="lecturer-revamp-root"
      >
        <div
          style={{
            border: "1px solid #fed7aa",
            borderRadius: 16,
            padding: 28,
            background: "linear-gradient(145deg, #ffffff 0%, #fff7ed 100%)",
            boxShadow: "0 14px 36px rgba(15, 23, 42, 0.09)",
            color: "#9a3412",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
            Hội đồng giảng viên chưa khả dụng
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>{accessDeniedMessage}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 1360,
        margin: "0 auto",
        padding: 20,
        position: "relative",
        fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
      }}
      className="lecturer-revamp-root"
    >
      <style>
        {`
          .lecturer-revamp-root {
            --lec-accent: #f37021;
            --lec-accent-strong: #d85f1a;
            --lec-ink: #111111;
            --lec-muted: #475569;
            --lec-line: #cbd5e1;
            --lec-bg-soft: #f8fafc;
            color: var(--lec-ink);
            background: #ffffff;
          }
          .lecturer-revamp-root .content {
            position: relative;
            z-index: 1;
            display: grid;
            gap: 14px;
          }
          .lecturer-revamp-root h1,
          .lecturer-revamp-root h2,
          .lecturer-revamp-root h3 {
            line-height: 1.2;
            letter-spacing: -0.01em;
            margin: 0;
            color: #111111;
          }
          .lecturer-revamp-root .lec-heading {
            font-size: 30px;
            font-weight: 800;
            color: #111111;
          }
          .lecturer-revamp-root .lec-kicker {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #475569;
            font-weight: 700;
          }
          .lecturer-revamp-root .lec-value {
            font-size: 24px;
            font-weight: 800;
            color: #111111;
          }
          .lecturer-revamp-root .lec-tag-live {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: 1px solid #cbd5e1;
            border-radius: 999px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 600;
            background: #ffffff;
            color: #111111;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          }
          .lecturer-revamp-root .lec-pill {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            background: #ffffff;
            padding: 8px 14px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            font-weight: 600;
            color: #0f172a;
            cursor: pointer;
            transition: all .2s ease;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          }
          .lecturer-revamp-root .lec-pill:hover {
            border-color: #f37021;
            background: #fffaf5;
            color: #d85f1a;
          }
          .lecturer-revamp-root .lec-pill.active {
            border-color: #f37021;
            color: #f37021;
            background: #fff7ed;
          }
          .lecturer-revamp-root .lec-pill:disabled {
            cursor: not-allowed;
            background: #f8fafc;
            border-color: #e2e8f0;
            color: #94a3b8;
            box-shadow: none;
          }
          .lecturer-revamp-root .lec-primary,
          .lecturer-revamp-root .lec-accent {
            border-radius: 10px;
            min-height: 40px;
            padding: 0 14px;
            font-weight: 700;
            cursor: pointer;
            border: 1px solid #f37021;
            background: #f37021;
            color: #ffffff;
            font-size: 13px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all .2s ease;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
          }
          .lecturer-revamp-root .lec-soft,
          .lecturer-revamp-root .lec-ghost {
            border-radius: 10px;
            min-height: 40px;
            padding: 0 14px;
            font-weight: 700;
            cursor: pointer;
            border: 1px solid #cbd5e1;
            background: #ffffff;
            color: #0f172a;
            font-size: 13px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all .2s ease;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          }
          .lecturer-revamp-root .lec-primary:hover,
          .lecturer-revamp-root .lec-accent:hover {
            background: #d85f1a;
            border-color: #d85f1a;
          }
          .lecturer-revamp-root .lec-soft:hover,
          .lecturer-revamp-root .lec-ghost:hover {
            border-color: #f37021;
            background: #fffaf5;
            color: #d85f1a;
          }
          .lecturer-revamp-root .lec-primary:disabled,
          .lecturer-revamp-root .lec-accent:disabled,
          .lecturer-revamp-root .lec-soft:disabled,
          .lecturer-revamp-root .lec-ghost:disabled {
            cursor: not-allowed;
            background: #f8fafc;
            border-color: #e2e8f0;
            color: #94a3b8;
            box-shadow: none;
          }
          .lecturer-revamp-root .lec-input,
          .lecturer-revamp-root select,
          .lecturer-revamp-root textarea {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 10px 12px;
            font-size: 14px;
            width: 100%;
            background: #ffffff;
            color: #111111;
          }
          .lecturer-revamp-root textarea {
            min-height: 100px;
            resize: vertical;
          }
          .lecturer-revamp-root .lec-input:focus,
          .lecturer-revamp-root select:focus,
          .lecturer-revamp-root textarea:focus {
            outline: none;
            border-color: #f37021;
            box-shadow: 0 0 0 3px rgba(243, 112, 33, 0.12);
          }
          .lecturer-revamp-root .content > section {
            background: #ffffff !important;
            border: 1px solid #dbe4ef !important;
            border-radius: 20px !important;
            padding: 20px !important;
            box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06) !important;
          }
          .lecturer-revamp-root .lec-committee-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 14px;
          }
          .lecturer-revamp-root .lec-committee-card {
            border: 1px solid #dbe4ef;
            border-radius: 20px;
            padding: 18px;
            background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
            display: grid;
            gap: 14px;
            box-shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
            transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
            position: relative;
            overflow: hidden;
          }
          .lecturer-revamp-root .lec-committee-card:hover {
            transform: translateY(-3px);
            border-color: #f37021;
            box-shadow: 0 18px 38px rgba(15, 23, 42, 0.10);
          }
          .lecturer-revamp-root .lec-committee-card::before {
            content: "";
            position: absolute;
            inset: 0 0 auto 0;
            height: 4px;
            background: linear-gradient(90deg, #f37021 0%, #fb923c 100%);
          }
          .lecturer-revamp-root .lec-committee-main {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 228px;
            gap: 14px;
            align-items: start;
          }
          .lecturer-revamp-root .lec-committee-info {
            display: grid;
            gap: 12px;
          }
          .lecturer-revamp-root .lec-committee-head {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            align-items: flex-start;
            flex-wrap: wrap;
          }
          .lecturer-revamp-root .lec-status-pill {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 100px;
            padding: 8px 12px;
            border-radius: 999px;
            border: 1px solid transparent;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.02em;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
          }
          .lecturer-revamp-root .lec-progress-block {
            display: grid;
            gap: 6px;
            padding: 12px;
            border: 1px solid #dbe4ef;
            border-radius: 16px;
            background: linear-gradient(135deg, #fff7ed 0%, #ffffff 82%);
          }
          .lecturer-revamp-root .lec-progress-head {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            align-items: center;
            font-size: 13px;
            color: #334155;
          }
          .lecturer-revamp-root .lec-progress-track {
            height: 9px;
            border-radius: 999px;
            background: #e2e8f0;
            overflow: hidden;
          }
          .lecturer-revamp-root .lec-progress-fill {
            height: 100%;
            border-radius: 999px;
            background: linear-gradient(90deg, #f37021 0%, #fb923c 100%);
          }
          .lecturer-revamp-root .lec-progress-foot {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            flex-wrap: wrap;
            font-size: 12px;
            color: #64748b;
          }
          .lecturer-revamp-root .lec-committee-side {
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            background: linear-gradient(180deg, #ffffff 0%, #fffaf5 100%);
            padding: 14px;
            display: grid;
            gap: 10px;
            align-content: start;
          }
          .lecturer-revamp-root .lec-side-title {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: #7c2d12;
          }
          .lecturer-revamp-root .lec-badge-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }
          .lecturer-revamp-root .lec-count-badge {
            display: inline-flex;
            gap: 6px;
            align-items: center;
            border: 1px solid #e2e8f0;
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 12px;
            font-weight: 600;
            color: #0f172a;
            background: #ffffff;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
          }
          .lecturer-revamp-root .lec-info-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #0f172a;
            line-height: 1.4;
          }
          .lecturer-revamp-root .lec-info-row svg {
            color: #f37021;
          }
          .lecturer-revamp-root .lec-workspace {
            display: grid;
            grid-template-columns: 340px minmax(0, 1fr);
            gap: 16px;
            align-items: start;
          }
          .lecturer-revamp-root .lec-left-pane,
          .lecturer-revamp-root .lec-right-pane {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            background: #ffffff;
            padding: 16px;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
          }
          .lecturer-revamp-root .lec-assign-list {
            display: grid;
            gap: 8px;
          }
          .lecturer-revamp-root .lec-assign-btn {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 12px;
            text-align: left;
            background: #ffffff;
            cursor: pointer;
            color: #111111;
            transition: border-color .2s ease, background .2s ease, box-shadow .2s ease;
          }
          .lecturer-revamp-root .lec-assign-btn:hover {
            border-color: #f37021;
            background: #fffaf5;
          }
          .lecturer-revamp-root .lec-assign-btn.active {
            border-color: #f37021;
            background: #fff7ed;
          }
          .lecturer-revamp-root .lec-room-header {
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            background: #ffffff;
            padding: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            flex-wrap: wrap;
          }
          .lecturer-revamp-root .lec-clock-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            border-radius: 999px;
            border: 1px solid #cbd5e1;
            background: #ffffff;
            color: #111111;
            font-size: 12px;
            font-weight: 700;
          }
          .lecturer-revamp-root .lec-room-switch {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            align-items: center;
          }
          .lecturer-revamp-root .lec-tab-bar {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 10px;
            margin-bottom: 10px;
          }
          .lecturer-revamp-root .lec-score-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
            gap: 10px;
          }
          .lecturer-revamp-root .lec-score-item {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 12px;
            background: #ffffff;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          }
          .lecturer-revamp-root button svg,
          .lecturer-revamp-root a svg {
            margin: 0 !important;
            vertical-align: middle !important;
            flex: 0 0 auto;
          }
          .lecturer-revamp-root .lec-committee-actions {
            display: grid;
            gap: 8px;
            grid-template-columns: 1fr;
          }
          .lecturer-revamp-root .lec-report-screen {
            border: 1px solid #dbe4ef;
            border-radius: 20px;
            background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
            padding: 18px;
            display: grid;
            gap: 10px;
            box-shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
          }
          .lecturer-revamp-root .lec-alert-card {
            border: 1px solid #fecaca;
            border-left: 4px solid #f37021;
            border-radius: 16px;
            padding: 18px;
            background: linear-gradient(135deg, #fff7ed 0%, #fff1f2 100%);
            box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
            color: #9f1239;
          }
          .lecturer-revamp-root .lec-detail-modal {
            width: min(960px, calc(100vw - 24px));
            max-height: calc(100vh - 36px);
            overflow-y: auto;
            background: #ffffff;
            border: 1px solid #dbe4ef;
            border-radius: 24px;
            box-shadow: 0 24px 54px rgba(2, 6, 23, 0.24);
            display: grid;
            gap: 14px;
            position: relative;
          }
          .lecturer-revamp-root .lec-detail-modal::before {
            content: "";
            position: absolute;
            inset: 0 0 auto 0;
            height: 6px;
            background: linear-gradient(90deg, #003d82 0%, #2563eb 48%, #f37021 100%);
          }
          .lecturer-revamp-root .lec-detail-modal-shell {
            padding: 20px;
            display: grid;
            gap: 14px;
          }
          .lecturer-revamp-root .lec-detail-header {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            align-items: flex-start;
            padding: 12px 14px;
            border: 1px solid #e2e8f0;
            border-radius: 18px;
            background: linear-gradient(135deg, #ffffff 0%, #fff7ed 100%);
          }
          .lecturer-revamp-root .lec-detail-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
          }
          .lecturer-revamp-root .lec-detail-subtitle {
            margin-top: 4px;
            font-size: 13px;
            color: #475569;
          }
          .lecturer-revamp-root .lec-detail-chip-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          .lecturer-revamp-root .lec-detail-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: 1px solid #e2e8f0;
            border-radius: 999px;
            padding: 6px 10px;
            background: #ffffff;
            font-size: 12px;
            font-weight: 700;
            color: #334155;
          }
          .lecturer-revamp-root .lec-detail-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
          }
          .lecturer-revamp-root .lec-detail-stat {
            border: 1px solid #dbe4ef;
            border-radius: 16px;
            padding: 12px 14px;
            background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
            box-shadow: 0 10px 22px rgba(15, 23, 42, 0.05);
          }
          .lecturer-revamp-root .lec-detail-stat-label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: #64748b;
            font-weight: 800;
            margin-bottom: 6px;
          }
          .lecturer-revamp-root .lec-detail-stat-value {
            font-size: 14px;
            font-weight: 700;
            color: #111827;
            line-height: 1.45;
          }
          .lecturer-revamp-root .lec-detail-panel {
            border: 1px solid #dbe4ef;
            border-radius: 18px;
            background: #ffffff;
            padding: 14px;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
          }
          .lecturer-revamp-root .lec-detail-panel--topics {
            background: linear-gradient(180deg, #ffffff 0%, #fffaf4 100%);
          }
          .lecturer-revamp-root .lec-detail-member {
            padding: 12px 0;
            display: grid;
            grid-template-columns: minmax(120px, 180px) minmax(0, 1fr);
            gap: 10px;
            border-bottom: 1px dashed #e2e8f0;
          }
          .lecturer-revamp-root .lec-detail-topic {
            display: grid;
            gap: 6px;
            padding: 12px 0;
            border-bottom: 1px dashed #e2e8f0;
            padding-left: 12px;
            border-left: 3px solid transparent;
            border-radius: 12px;
          }
          @media (max-width: 1060px) {
            .lecturer-revamp-root .lec-committee-main {
              grid-template-columns: 1fr;
            }
            .lecturer-revamp-root .lec-workspace {
              grid-template-columns: 1fr;
            }
            .lecturer-revamp-root .lec-committee-actions {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>

      <div className="content">
        {!isGradingScreen && (
          <section
            style={{
              ...cardStyle,
              marginBottom: 14,
              background: "linear-gradient(145deg, #ffffff 0%, #fff7ed 100%)",
            }}
          >
            <h1 className="lec-heading" style={{ color: "#f37021", display: "flex", alignItems: "center", gap: 10 }}>
              <Gavel size={30} color="#f37021" /> Danh sách Hội đồng bảo vệ
            </h1>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="lec-tag-live">Đợt: {periodDisplay}</span>
              {currentPeriod && <span className="lec-tag-live">Trạng thái đợt: {currentPeriod.status}</span>}
              <span className="lec-tag-live">
                Danh sách hội đồng: {councilListLocked === true ? "Đã chốt" : councilListLocked === false ? "Đang mở" : councilLockStatus}
              </span>
              <span className="lec-tag-live">Phòng chấm: {joinedCommittee ? `Đang tham gia ${joinedCommittee.id}` : "Chưa tham gia"}</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: "#334155" }}>
              Cập nhật gần nhất: {latestActionTrace?.at ?? "Chưa có"}
            </div>
          </section>
        )}

        {!isGradingScreen && currentSnapshotError && (
          <section
            style={{
              ...cardStyle,
              marginBottom: 14,
              borderColor: "#fecaca",
              background: "#fff7ed",
              color: "#9a3412",
            }}
          >
            <div style={{ fontWeight: 700 }}>Không thể tải snapshot giảng viên</div>
            <div style={{ marginTop: 6, fontSize: 13 }}>{currentSnapshotError}</div>
          </section>
        )}

        {!isGradingScreen && (
          <section style={{ ...cardStyle, marginBottom: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 12 }}>
                <div className="lec-kicker">Đang họp</div>
                <div className="lec-value">{committeeStats.live}</div>
              </div>
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 12 }}>
                <div className="lec-kicker">Sắp diễn ra</div>
                <div className="lec-value">{committeeStats.upcoming}</div>
              </div>
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 12 }}>
                <div className="lec-kicker">Đã chốt</div>
                <div className="lec-value">{committeeStats.locked}</div>
              </div>
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 12 }}>
                <div className="lec-kicker">Chờ duyệt chỉnh sửa</div>
                <div className="lec-value" style={{ color: "#f37021" }}>{committeeStats.pendingRevision}</div>
              </div>
            </div>
          </section>
        )}

        {!isGradingScreen && activePanel === "councils" && (
          <section style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CalendarClock size={18} /> Danh sách hội đồng của tôi
              </h2>
              {permissionSourceMissing && (
                <span className="lec-tag-live" style={{ borderColor: "#fecaca", color: "#9a3412", background: "#fff7ed" }}>
                  API chưa trả AllowedActions, hệ thống sẽ khóa thao tác ghi.
                </span>
              )}
            </div>

            <div className="lec-committee-grid">
              {!loadingData && committees.length === 0 && (
                <div style={{ fontSize: 13, color: "#475569" }}>
                  {waitingCouncilLock
                    ? "Danh sách hội đồng đang chờ chốt. Vui lòng quay lại sau khi hội đồng được khóa."
                    : "Chưa có hội đồng trong snapshot hiện tại."}
                </div>
              )}

              {committees.map((committee) => {
                const metric = committeeBadgeStats.get(committee.id) ?? {
                  total: committee.studentCount,
                  scored: 0,
                  locked: 0,
                };
                const progressPercent = metric.total > 0 ? Math.min(100, Math.round((metric.scored / metric.total) * 100)) : 0;
                const statusVisual = getCommitteeStatusVisual(committee.status);
                const canJoin = committee.status === "Đang họp";
                const isChairCommittee = committee.normalizedRole === "CT";

                return (
                  <article
                    key={committee.id}
                    className="lec-committee-card"
                    style={{
                      borderColor: statusVisual.cardBorder,
                      boxShadow: `0 2px 8px rgba(15, 23, 42, 0.08), 0 0 18px ${statusVisual.cardGlow}`,
                    }}
                  >
                    <div className="lec-committee-main">
                      <div className="lec-committee-info">
                        <div className="lec-committee-head">
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                              <Building2 size={17} color="#f37021" /> {committee.id}
                            </div>
                            <div style={{ fontSize: 14, color: "#111111", marginTop: 2, fontWeight: 700 }}>{committee.name}</div>
                          </div>
                          <button
                            type="button"
                            className="lec-status-pill"
                            style={{
                              background: statusVisual.chipBg,
                              borderColor: statusVisual.chipBorder,
                              color: statusVisual.chipText,
                            }}
                            disabled
                          >
                            {statusVisual.label}
                          </button>
                        </div>

                        {joinedCommitteeId === committee.id && (
                          <span className="lec-tag-live" style={{ borderColor: "#f37021", color: "#111111", background: "#fff7ed", width: "fit-content" }}>
                            Đang tham gia
                          </span>
                        )}

                        <div className="lec-progress-block">
                          <div className="lec-progress-head">
                            <span style={{ fontWeight: 700 }}>Tiến độ chấm đề tài</span>
                            <strong>{metric.scored}/{metric.total}</strong>
                          </div>
                          <div className="lec-progress-track">
                            <div className="lec-progress-fill" style={{ width: `${progressPercent}%` }} />
                          </div>
                          <div className="lec-progress-foot">
                            <span>Đã chấm {metric.scored} đề tài</span>
                            <span>{progressPercent}% hoàn thành</span>
                          </div>
                        </div>

                        <div className="lec-badge-row">
                          <span className="lec-count-badge"><FileText size={12} /> Tổng đề tài: {metric.total}</span>
                          <span className="lec-count-badge"><CheckCircle2 size={12} /> Đã có điểm: {metric.scored}</span>
                        </div>

                        <div style={{ display: "grid", gap: 6 }}>
                          <div className="lec-info-row">
                            <Users2 size={14} />
                            <span>Vai trò của tôi: <strong>{committee.roleLabel}</strong></span>
                          </div>
                          <div className="lec-info-row">
                            <CalendarDays size={14} />
                            <span>Ngày bảo vệ: <strong>{formatDate(committee.date)}</strong></span>
                          </div>
                          <div className="lec-info-row">
                            <MapPin size={14} />
                            <span>Phòng: <strong>{committee.room}</strong></span>
                          </div>
                          <div className="lec-info-row">
                            <Clock3 size={14} />
                            <span>Khung giờ: <strong>{getCommitteeScheduleLabel(committee)}</strong></span>
                          </div>
                        </div>
                      </div>

                      <aside className="lec-committee-side">
                        <div className="lec-side-title">Thao tác</div>
                        <div className="lec-committee-actions">
                          <button
                            type="button"
                            className="lec-ghost"
                            onClick={() => {
                              setDetailCommitteeId(committee.id);
                              setSelectedCommitteeId(committee.id);
                              setDetailTab("topics");
                            }}
                          >
                            <Eye size={14} /> Xem chi tiết
                          </button>
                          <button
                            type="button"
                            className="lec-primary"
                            onClick={() => openRoleWorkspace(committee)}
                            disabled={!canJoin && !isChairCommittee}
                            title={!canJoin && !isChairCommittee ? "Nút Tham gia chỉ mở khi Chủ tịch đã mở phiên (Đang họp)." : undefined}
                          >
                            <ArrowRight size={14} /> {isChairCommittee ? "Vào phòng điều hành" : "Tham gia hội đồng"}
                          </button>
                        </div>
                      </aside>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}




      </div>

      

      {detailCommittee && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            zIndex: 3200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
          onClick={() => setDetailCommitteeId("")}
        >
          <div className="lec-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="lec-detail-modal-shell">
              <div className="lec-detail-header">
                <div>
                  <h3 className="lec-detail-title">
                    <Info size={18} /> Chi tiết hội đồng {detailCommittee.id}
                  </h3>
                  <div className="lec-detail-subtitle">{detailCommittee.name}</div>
                  <div className="lec-detail-chip-row" style={{ marginTop: 10 }}>
                    <span className="lec-detail-chip">
                      <Users2 size={13} color="#f37021" /> {detailCommittee.roleLabel}
                    </span>
                    <span className="lec-detail-chip">
                      <CalendarDays size={13} color="#2563eb" /> {formatDate(detailCommittee.date)}
                    </span>
                    <span className="lec-detail-chip">
                      <MapPin size={13} color="#0f766e" /> Phòng {detailCommittee.room}
                    </span>
                    {(() => {
                      const statusVisual = getCommitteeStatusVisual(detailCommittee.status);
                      return (
                        <span
                          className="lec-detail-chip"
                          style={{
                            borderColor: statusVisual.chipBorder,
                            background: statusVisual.chipBg,
                            color: statusVisual.chipText,
                          }}
                        >
                          {statusVisual.emoji} {statusVisual.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <button type="button" className="lec-ghost" onClick={() => setDetailCommitteeId("")}>Đóng</button>
              </div>

              <div className="lec-tab-bar">
                {detailTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`lec-pill ${detailTab === tab.key ? "active" : ""}`}
                    onClick={() => setDetailTab(tab.key)}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {detailTab === "overview" && (
                <div className="lec-detail-grid">
                  <div className="lec-detail-stat">
                    <div className="lec-detail-stat-label">Mã hội đồng</div>
                    <div className="lec-detail-stat-value">{detailCommittee.id}</div>
                  </div>
                  <div className="lec-detail-stat">
                    <div className="lec-detail-stat-label">Vai trò của tôi</div>
                    <div className="lec-detail-stat-value">{detailCommittee.roleLabel}</div>
                  </div>
                  <div className="lec-detail-stat">
                    <div className="lec-detail-stat-label">Ngày bảo vệ</div>
                    <div className="lec-detail-stat-value">{formatDate(detailCommittee.date)} · Cả ngày</div>
                  </div>
                  <div className="lec-detail-stat">
                    <div className="lec-detail-stat-label">Phòng</div>
                    <div className="lec-detail-stat-value">{detailCommittee.room}</div>
                  </div>
                  <div className="lec-detail-stat">
                    <div className="lec-detail-stat-label">Trạng thái phiên</div>
                    <div className="lec-detail-stat-value">
                      {(() => {
                        const statusVisual = getCommitteeStatusVisual(detailCommittee.status);
                        return `${statusVisual.emoji} ${statusVisual.label}`;
                      })()}
                    </div>
                  </div>
                  <div className="lec-detail-stat">
                    <div className="lec-detail-stat-label">Số đề tài</div>
                    <div className="lec-detail-stat-value">{committeeBadgeStats.get(detailCommittee.id)?.total ?? detailCommittee.studentCount}</div>
                  </div>
                </div>
              )}

              {detailTab === "members" && (
                <div className="lec-detail-panel">
                  {detailCommittee.members.length === 0 && (
                    <div style={{ fontSize: 13, color: "#64748b" }}>Snapshot chưa có danh sách thành viên cho hội đồng này.</div>
                  )}
                  {detailCommittee.members.map((member) => {
                    return (
                      <div key={member.memberId} className="lec-detail-member">
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>{member.roleLabel}</div>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
                            {member.lecturerCode ? `${member.lecturerCode}` : ""}
                            {member.degree ? ` - ${member.degree}` : ""}
                            {member.lecturerCode || member.degree ? " - " : ""}
                            {member.lecturerName}
                            {member.organization ? ` (${member.organization})` : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {detailTab === "topics" && (
                <div className="lec-detail-panel lec-detail-panel--topics">
                  {detailCommitteeRows.length === 0 && (
                    <div style={{ fontSize: 13, color: "#64748b" }}>Chưa có assignment trong scoring matrix cho hội đồng này.</div>
                  )}
                  {detailCommitteeRows.map((row) => {
                    const isScored = row.finalScore != null && Number(row.finalScore) > 0;
                    return (
                      <div
                        key={`detail-topic-${row.assignmentId}`}
                        className="lec-detail-topic"
                        style={{ borderLeftColor: isScored ? "#22c55e" : "#cbd5e1", background: isScored ? "#f0fdf4" : "transparent" }}
                      >
                        <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8, color: "#0f172a" }}>
                          {row.topicTitle}
                          {isScored && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 700,
                                background: "#22c55e",
                                color: "#ffffff",
                              }}
                            >
                              ✓ Đã chấm
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: "#475569" }}>
                          {row.studentCode} - {row.studentName} · {formatSession(row.session)} · {formatRowTimeRange(row)}
                        </div>
                        <div style={{ fontSize: 13, color: "#475569" }}>
                          GVHD: <strong>{row.supervisorLecturerName ?? "Chưa cập nhật"}</strong> · Hội đồng: <strong>{row.committeeCode} - {row.committeeName}</strong>
                        </div>
                        {isScored && (
                          <div style={{ fontSize: 13, color: "#166534", fontWeight: 700 }}>
                            Điểm cuối cùng: <strong>{row.finalScore?.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}</strong>
                            {row.finalGrade ? ` - ${row.finalGrade}` : ""}
                          </div>
                        )}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {row.topicTags.length > 0 ? (
                            row.topicTags.map((tag) => (
                              <span
                                key={`detail-tag-${row.assignmentId}-${tag}`}
                                className="lec-detail-chip"
                                style={{ borderColor: "#fdba74", background: "#fff7ed", color: "#9a3412" }}
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>Chưa có tags đề tài</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", paddingTop: 2 }}>
                <button type="button" className="lec-ghost" onClick={() => setDetailCommitteeId("")}>Đóng</button>
                <button
                  type="button"
                  className="lec-primary"
                  onClick={() => {
                    openRoleWorkspace(detailCommittee);
                    setDetailCommitteeId("");
                  }}
                  disabled={detailCommittee.status !== "Đang họp"}
                >
                  <ArrowRight size={14} /> Tham gia
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerCommittees;
