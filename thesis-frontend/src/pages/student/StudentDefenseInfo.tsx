import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createIdempotencyKey } from "../../types/defense-workflow-contract";
import { useToast } from "../../context/useToast";
import { FetchDataError, fetchData } from "../../api/fetchData";
import type { ApiResponse } from "../../types/api";
import {
  pickCaseInsensitiveValue,
  readEnvelopeAllowedActions,
  readEnvelopeData,
  readEnvelopeErrorMessages,
  readEnvelopeIdempotencyReplay,
  readEnvelopeMessage,
  readEnvelopeSuccess,
  readEnvelopeWarningMessages,
} from "../../utils/api-envelope";
import {
  getActiveDefensePeriodId,
  normalizeDefensePeriodId,
  setActiveDefensePeriodId,
} from "../../utils/defensePeriod";
import {
  AlertCircle,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  Hash,
  MapPin,
  User,
  Upload,
  Users,
} from "lucide-react";

type SessionCode = "MORNING" | "AFTERNOON";
type StudentPanel = "overview" | "notifications" | "revision";
type RevisionStatusCode = 1 | 2 | 3;

type DefenseInfoView = {
  studentCode: string;
  studentName: string;
  topicCode: string;
  topicTitle: string;
  committeeCode: string | null;
  room: string | null;
  scheduledAt: string | null;
  session: number | null;
  sessionCode: SessionCode | null;
  finalScore: number | null;
  grade: string | null;
  councilListLocked: boolean;
  councilLockStatus: "LOCKED" | "UNLOCKED";
};

type StudentNotification = {
  type: string;
  message: string;
  timestamp: string;
};

type NotificationScheduleHint = {
  committeeCode: string | null;
  room: string | null;
  scheduledAt: string | null;
};

type RevisionHistoryView = {
  id: number;
  assignmentId: number | null;
  revisionFileUrl: string | null;
  finalStatus: RevisionStatusCode;
  isCtApproved: boolean;
  isUvtkApproved: boolean;
  isGvhdApproved: boolean;
  createdAt: string;
  lastUpdated: string;
};

type CurrentDefensePeriodView = {
  periodId: number;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

const DEFAULT_DEFENSE_INFO: DefenseInfoView = {
  studentCode: "",
  studentName: "",
  topicCode: "",
  topicTitle: "",
  committeeCode: null,
  room: null,
  scheduledAt: null,
  session: null,
  sessionCode: null,
  finalScore: null,
  grade: null,
  councilListLocked: false,
  councilLockStatus: "UNLOCKED",
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toRecordArray = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => toRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
};

const toStringOrNull = (value: unknown): string | null => {
  const text = String(value ?? "").trim();
  return text ? text : null;
};

const toDisplayText = (value: unknown, fallback = ""): string => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const readBooleanLike = (value: unknown, fallback = false): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
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

  return fallback;
};

const readNumberLike = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseRevisionStatus = (value: unknown): RevisionStatusCode => {
  const asNumber = readNumberLike(value);
  if (asNumber === 2) {
    return 2;
  }
  if (asNumber === 3) {
    return 3;
  }

  const text = String(value ?? "").trim().toUpperCase();
  if (text.includes("APPROVED") || text.includes("PASSED")) {
    return 2;
  }
  if (text.includes("REJECTED") || text.includes("FAILED")) {
    return 3;
  }

  return 1;
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
    name: toDisplayText(
      pickCaseInsensitiveValue(periodRecord, ["name", "Name", "title", "Title"], ""),
      `Đợt ${periodId}`,
    ),
    status: toDisplayText(
      pickCaseInsensitiveValue(periodRecord, ["status", "Status", "state", "State"], "UNKNOWN"),
      "UNKNOWN",
    ),
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

const hasSnapshotKeys = (record: Record<string, unknown>): boolean => {
  const keyGroups: string[][] = [
    ["defenseInfo", "DefenseInfo"],
    ["studentDefenseInfo", "StudentDefenseInfo"],
    ["committeeAssignment", "CommitteeAssignment"],
    ["assignment", "Assignment"],
    ["committee", "Committee"],
    ["notifications", "Notifications"],
    ["alerts", "Alerts"],
    ["messages", "Messages"],
    ["revisionHistory", "RevisionHistory"],
    ["revisionQueue", "RevisionQueue"],
    ["revisions", "Revisions"],
  ];

  return keyGroups.some(
    (keys) => pickCaseInsensitiveValue(record, keys, undefined) !== undefined,
  );
};

const extractSnapshotRecord = (payload: unknown): Record<string, unknown> | null => {
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (current == null || seen.has(current)) {
      continue;
    }
    seen.add(current);

    if (Array.isArray(current)) {
      for (const item of current) {
        queue.push(item);
      }
      continue;
    }

    const record = toRecord(current);
    if (!record) {
      continue;
    }

    if (hasSnapshotKeys(record)) {
      return record;
    }

    const nestedKeys = [
      "snapshot",
      "Snapshot",
      "data",
      "Data",
      "result",
      "Result",
      "payload",
      "Payload",
      "item",
      "Item",
      "value",
      "Value",
    ];

    for (const key of nestedKeys) {
      if (record[key] !== undefined) {
        queue.push(record[key]);
      }
    }
  }

  return toRecord(payload);
};

const pickFirstRecord = (
  source: Record<string, unknown>,
  keyGroups: string[][],
): Record<string, unknown> | null => {
  for (const keys of keyGroups) {
    const value = pickCaseInsensitiveValue(source, keys, undefined);
    const record = toRecord(value);
    if (record) {
      return record;
    }
  }
  return null;
};

const pickFirstRecordArray = (
  source: Record<string, unknown>,
  keyGroups: string[][],
): Array<Record<string, unknown>> => {
  for (const keys of keyGroups) {
    const value = pickCaseInsensitiveValue(source, keys, undefined);
    if (value === undefined) {
      continue;
    }
    return toRecordArray(value);
  }
  return [];
};

const hasMeaningfulDefenseInfo = (value: DefenseInfoView): boolean => {
  return Boolean(
    value.studentCode ||
    value.studentName ||
    value.topicCode ||
    value.topicTitle ||
    value.committeeCode ||
    value.room ||
    value.scheduledAt ||
    value.finalScore != null ||
    value.grade,
  );
};

const normalizeSessionCode = (
  sessionCodeValue: unknown,
  sessionValue: unknown,
): SessionCode | null => {
  const normalizedCode = String(sessionCodeValue ?? "").trim().toUpperCase();
  if (normalizedCode === "MORNING" || normalizedCode === "AFTERNOON") {
    return normalizedCode;
  }

  const session = readNumberLike(sessionValue);
  if (session === 1) {
    return "MORNING";
  }
  if (session !== null) {
    return "AFTERNOON";
  }

  return null;
};

const formatSessionLabel = (sessionCode: SessionCode | null): string => {
  if (sessionCode === "MORNING") {
    return "Sáng";
  }

  if (sessionCode === "AFTERNOON") {
    return "Chiều";
  }

  return "Đang cập nhật";
};

const formatDateTime = (value: string | null, includeTime = true): string => {
  if (!value) {
    return "Chưa có lịch cụ thể";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const dateText = parsed.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  if (!includeTime) {
    return dateText;
  }

  const timeText = parsed.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (timeText === "00:00") {
    return `${dateText} (giờ cụ thể sẽ được thông báo sau)`;
  }

  return `${dateText} lúc ${timeText}`;
};

const getDefaultTimeBySessionCode = (sessionCode: SessionCode | null): string | null => {
  if (sessionCode === "MORNING") {
    return "07:30";
  }

  if (sessionCode === "AFTERNOON") {
    return "13:30";
  }

  return null;
};

const applySessionDefaultTime = (
  value: string | null,
  sessionCode: SessionCode | null,
): string | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  if (parsed.getHours() !== 0 || parsed.getMinutes() !== 0) {
    return value;
  }

  const fallbackTime = getDefaultTimeBySessionCode(sessionCode);
  if (!fallbackTime) {
    return value;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T${fallbackTime}:00`;
};

const buildIsoDateTimeFromVnDate = (
  dateValue: string,
  timeValue: string,
): string | null => {
  const chunks = dateValue.split("/").map((item) => item.trim());
  if (chunks.length !== 3) {
    return null;
  }

  const [day, month, year] = chunks;
  if (
    day.length !== 2 ||
    month.length !== 2 ||
    year.length !== 4 ||
    !/^\d{2}$/.test(day) ||
    !/^\d{2}$/.test(month) ||
    !/^\d{4}$/.test(year)
  ) {
    return null;
  }

  return `${year}-${month}-${day}T${timeValue}:00`;
};

const parseNotificationScheduleHint = (
  message: string,
  sessionCode: SessionCode | null,
): NotificationScheduleHint | null => {
  const normalizedMessage = String(message ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalizedMessage) {
    return null;
  }

  const schedulePattern =
    /Hội đồng\s+([A-Za-z0-9._\/-]+)\s*-\s*[^|]*\|\s*Phòng:\s*([^|]+)\|\s*[^,]+,\s*(\d{2}\/\d{2}\/\d{4})\s*lúc\s*([0-2]?\d:[0-5]\d|Chưa xác định|Đang cập nhật)/i;

  const matches = normalizedMessage.match(schedulePattern);
  if (!matches) {
    return null;
  }

  const committeeCode = toStringOrNull(matches[1]);
  const room = toStringOrNull(matches[2]);
  const vnDate = toStringOrNull(matches[3]);
  const rawTime = toStringOrNull(matches[4]);

  if (!vnDate) {
    return {
      committeeCode,
      room,
      scheduledAt: null,
    };
  }

  const explicitTime = rawTime && /^([01]?\d|2[0-3]):([0-5]\d)$/.test(rawTime)
    ? rawTime
    : null;
  const fallbackTime = explicitTime ?? getDefaultTimeBySessionCode(sessionCode);
  const scheduledAt = fallbackTime
    ? buildIsoDateTimeFromVnDate(vnDate, fallbackTime)
    : null;

  return {
    committeeCode,
    room,
    scheduledAt,
  };
};

const mergeDefenseInfoFromNotifications = (
  source: DefenseInfoView,
  notifications: StudentNotification[],
): DefenseInfoView => {
  let merged: DefenseInfoView = {
    ...source,
    scheduledAt: applySessionDefaultTime(source.scheduledAt, source.sessionCode),
  };

  if (merged.committeeCode && merged.room && merged.scheduledAt) {
    return merged;
  }

  for (const item of notifications) {
    const hint = parseNotificationScheduleHint(item.message, merged.sessionCode);
    if (!hint) {
      continue;
    }

    merged = {
      ...merged,
      committeeCode: merged.committeeCode ?? hint.committeeCode,
      room: merged.room ?? hint.room,
      scheduledAt: merged.scheduledAt ?? hint.scheduledAt,
    };

    if (merged.committeeCode && merged.room && merged.scheduledAt) {
      break;
    }
  }

  merged = {
    ...merged,
    scheduledAt: applySessionDefaultTime(merged.scheduledAt, merged.sessionCode),
  };

  return merged;
};

const formatRevisionStatus = (status: RevisionStatusCode) => {
  switch (status) {
    case 2:
      return { label: "Đã duyệt", className: "sd-status sd-status--approved" };
    case 3:
      return { label: "Từ chối", className: "sd-status sd-status--rejected" };
    default:
      return { label: "Chờ duyệt", className: "sd-status sd-status--pending" };
  }
};

const formatNotificationType = (type: string): string => {
  const normalized = String(type ?? "").trim().toUpperCase();
  if (normalized.includes("ERROR") || normalized.includes("FAIL")) {
    return "Lỗi";
  }
  if (normalized.includes("WARN")) {
    return "Cảnh báo";
  }
  if (normalized.includes("SUCCESS") || normalized.includes("OK")) {
    return "Thành công";
  }
  if (normalized.includes("INFO")) {
    return "Thông tin";
  }
  return normalized || "Thông tin";
};

const StudentDefenseInfo: React.FC = () => {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [periodId, setPeriodId] = useState<number | null>(() => getActiveDefensePeriodId());

  const [activePanel, setActivePanel] = useState<StudentPanel>("overview");
  const [currentPeriod, setCurrentPeriod] = useState<CurrentDefensePeriodView | null>(null);
  const [currentSnapshotError, setCurrentSnapshotError] = useState<string | null>(null);
  const [defenseInfo, setDefenseInfo] = useState<DefenseInfoView>(DEFAULT_DEFENSE_INFO);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [revisionHistory, setRevisionHistory] = useState<RevisionHistoryView[]>([]);
  const [backendAllowedActions, setBackendAllowedActions] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [revisedContent, setRevisedContent] = useState("");
  const [snapshotFetchedAt, setSnapshotFetchedAt] = useState<string>("Chưa có");
  const [latestTrace, setLatestTrace] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const notifyError = useCallback(
    (message: string) => addToast(message, "error"),
    [addToast],
  );
  const notifySuccess = useCallback(
    (message: string) => addToast(message, "success"),
    [addToast],
  );
  const notifyInfo = useCallback(
    (message: string) => addToast(message, "info"),
    [addToast],
  );
  const notifyWarning = useCallback(
    (message: string) => addToast(message, "warning"),
    [addToast],
  );

  const syncPeriodToUrl = useCallback(
    (nextPeriodId: number | null) => {
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
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    setActiveDefensePeriodId(periodId);
  }, [periodId]);

  const parseApiEnvelope = useCallback(
    <T,>(
      response: ApiResponse<T> | null | undefined,
      fallback: string,
      options: { emitSuccessMessage?: boolean } = {},
    ) => {
      const allowedActions = readEnvelopeAllowedActions(response)
        .map((action) => String(action ?? "").trim())
        .filter(Boolean);
      setBackendAllowedActions(allowedActions);

      const warningMessages = readEnvelopeWarningMessages(response);
      if (warningMessages.length) {
        notifyInfo(warningMessages.join(" | "));
      }

      if (!readEnvelopeSuccess(response)) {
        const message =
          readEnvelopeErrorMessages(response)[0] ||
          readEnvelopeMessage(response) ||
          fallback;
        notifyError(message);
        return { ok: false, data: null as T | null };
      }

      if (options.emitSuccessMessage) {
        const message = readEnvelopeMessage(response);
        if (message) {
          notifyInfo(message);
        }
      }

      return {
        ok: true,
        data: readEnvelopeData<T>(response),
      };
    },
    [notifyError, notifyInfo],
  );

  const mapDefenseInfo = useCallback((raw: Record<string, unknown> | null): DefenseInfoView => {
    if (!raw) {
      return DEFAULT_DEFENSE_INFO;
    }

    const committeeRecord = pickFirstRecord(raw, [
      ["committee", "Committee"],
      ["council", "Council"],
    ]);
    const assignmentRecord = pickFirstRecord(raw, [
      ["committeeAssignment", "CommitteeAssignment"],
      ["assignment", "Assignment"],
      ["defenseInfo", "DefenseInfo"],
      ["studentDefenseInfo", "StudentDefenseInfo"],
    ]);
    const source = assignmentRecord ?? raw;

    const committeeCode = toStringOrNull(
      pickCaseInsensitiveValue(
        source,
        ["committeeCode", "CommitteeCode", "councilCode", "CouncilCode"],
        pickCaseInsensitiveValue(
          committeeRecord ?? {},
          ["committeeCode", "CommitteeCode", "councilCode", "CouncilCode", "name", "Name"],
          null,
        ),
      ),
    );

    const room = toStringOrNull(
      pickCaseInsensitiveValue(
        source,
        ["room", "Room", "location", "Location"],
        pickCaseInsensitiveValue(committeeRecord ?? {}, ["room", "Room", "location", "Location"], null),
      ),
    );

    const defenseDate = pickCaseInsensitiveValue(
      committeeRecord ?? {},
      ["defenseDate", "DefenseDate", "scheduledAt", "ScheduledAt"],
      null,
    );
    const startTime = toStringOrNull(
      pickCaseInsensitiveValue(committeeRecord ?? {}, ["startTime", "StartTime"], null),
    );

    let scheduledAt = toStringOrNull(
      pickCaseInsensitiveValue(
        source,
        ["scheduledAt", "ScheduledAt", "defenseDate", "DefenseDate", "defenseAt", "DefenseAt"],
        defenseDate,
      ),
    );
    if (scheduledAt && startTime && !scheduledAt.includes("T")) {
      scheduledAt = `${scheduledAt}T${startTime}`;
    }

    const councilLockStatusRaw = toDisplayText(
      pickCaseInsensitiveValue(
        source,
        ["councilLockStatus", "CouncilLockStatus", "lockStatus", "LockStatus"],
        pickCaseInsensitiveValue(
          raw,
          ["councilLockStatus", "CouncilLockStatus", "lockStatus", "LockStatus"],
          "",
        ),
      ),
      "",
    )
      .trim()
      .toUpperCase();

    const explicitLockValue = pickCaseInsensitiveValue(
      source,
      [
        "councilListLocked",
        "CouncilListLocked",
        "isCouncilListLocked",
        "IsCouncilListLocked",
      ],
      pickCaseInsensitiveValue(
        raw,
        [
          "councilListLocked",
          "CouncilListLocked",
          "isCouncilListLocked",
          "IsCouncilListLocked",
        ],
        undefined,
      ),
    );
    const inferredLocked =
      councilLockStatusRaw === "LOCKED" ||
      Boolean(committeeCode) ||
      Boolean(scheduledAt);

    const councilListLocked =
      explicitLockValue === undefined
        ? inferredLocked
        : readBooleanLike(explicitLockValue, inferredLocked);

    const sessionCode = normalizeSessionCode(
      pickCaseInsensitiveValue(source, ["sessionCode", "SessionCode"], null),
      pickCaseInsensitiveValue(
        source,
        ["session", "Session", "sessionIndex", "SessionIndex"],
        pickCaseInsensitiveValue(committeeRecord ?? {}, ["session", "Session"], null),
      ),
    );

    const session = readNumberLike(
      pickCaseInsensitiveValue(
        source,
        ["session", "Session", "sessionIndex", "SessionIndex"],
        pickCaseInsensitiveValue(committeeRecord ?? {}, ["session", "Session"], null),
      ),
    );


    scheduledAt = applySessionDefaultTime(scheduledAt, sessionCode);
    const finalScore = readNumberLike(
      pickCaseInsensitiveValue(
        source,
        ["finalScore", "FinalScore", "score", "Score"],
        pickCaseInsensitiveValue(raw, ["finalScore", "FinalScore", "score", "Score"], null),
      ),
    );

    return {
      studentCode: String(
        pickCaseInsensitiveValue(
          source,
          ["studentCode", "StudentCode", "studentId", "StudentId", "proposerStudentCode", "ProposerStudentCode"],
          pickCaseInsensitiveValue(
            raw,
            ["studentCode", "StudentCode", "studentId", "StudentId", "proposerStudentCode", "ProposerStudentCode"],
            "",
          ),
        ),
      ).trim(),
      studentName: String(
        pickCaseInsensitiveValue(
          source,
          ["studentName", "StudentName", "fullName", "FullName", "proposerStudentName", "ProposerStudentName"],
          pickCaseInsensitiveValue(
            raw,
            ["studentName", "StudentName", "fullName", "FullName", "proposerStudentName", "ProposerStudentName"],
            "",
          ),
        ),
      ).trim(),
      topicCode: String(
        pickCaseInsensitiveValue(
          source,
          ["topicCode", "TopicCode", "assignmentCode", "AssignmentCode"],
          pickCaseInsensitiveValue(raw, ["topicCode", "TopicCode", "assignmentCode", "AssignmentCode"], ""),
        ),
      ).trim(),
      topicTitle: String(
        pickCaseInsensitiveValue(
          source,
          ["topicTitle", "TopicTitle", "topicName", "TopicName", "title", "Title"],
          pickCaseInsensitiveValue(
            raw,
            ["topicTitle", "TopicTitle", "topicName", "TopicName", "title", "Title"],
            "",
          ),
        ),
      ).trim(),
      committeeCode,
      room,
      scheduledAt,
      session,
      sessionCode,
      finalScore,
      grade: toStringOrNull(
        pickCaseInsensitiveValue(
          source,
          ["grade", "Grade", "finalGrade", "FinalGrade"],
          pickCaseInsensitiveValue(raw, ["grade", "Grade", "finalGrade", "FinalGrade"], null),
        ),
      ),
      councilListLocked,
      councilLockStatus:
        councilLockStatusRaw === "LOCKED" || councilListLocked ? "LOCKED" : "UNLOCKED",
    };
  }, []);

  const mapNotifications = useCallback(
    (rows: Array<Record<string, unknown>>): StudentNotification[] =>
      rows
        .map((item) => {
          const type = String(
            pickCaseInsensitiveValue(
              item,
              ["type", "Type", "notifCategory", "NotifCategory", "category", "Category"],
              "INFO",
            ),
          )
            .trim()
            .toUpperCase();
          const title = toDisplayText(
            pickCaseInsensitiveValue(
              item,
              ["title", "Title", "notifTitle", "NotifTitle", "subject", "Subject"],
              "",
            ),
            "",
          );
          const body = toDisplayText(
            pickCaseInsensitiveValue(
              item,
              ["message", "Message", "notifBody", "NotifBody", "body", "Body", "content", "Content"],
              "",
            ),
            "",
          );
          const message =
            title && body && !body.startsWith(title) ? `${title}: ${body}` : body || title;

          return {
            type,
            message: message || "Thông báo hệ thống",
            timestamp: toDisplayText(
              pickCaseInsensitiveValue(
                item,
                [
                  "timestamp",
                  "Timestamp",
                  "createdAt",
                  "CreatedAt",
                  "createdDate",
                  "CreatedDate",
                  "sentAt",
                  "SentAt",
                ],
                new Date().toISOString(),
              ),
              new Date().toISOString(),
            ),
          };
        })
        .filter((item) => item.message.length > 0)
        .sort((a, b) => {
          const left = new Date(a.timestamp).getTime();
          const right = new Date(b.timestamp).getTime();
          return right - left;
        }),
    [],
  );

  const mapRevisionHistory = useCallback(
    (rows: Array<Record<string, unknown>>): RevisionHistoryView[] =>
      rows
        .map((item, index) => {
          const finalStatus = parseRevisionStatus(
            pickCaseInsensitiveValue(item, ["finalStatus", "FinalStatus", "status", "Status"], 1),
          );

          return {
            id:
              readNumberLike(
                pickCaseInsensitiveValue(item, ["id", "Id", "revisionId", "RevisionId"], 0),
              ) ??
              Date.now() + index,
            assignmentId: readNumberLike(
              pickCaseInsensitiveValue(item, ["assignmentId", "AssignmentId", "thesisAssignmentId", "ThesisAssignmentId"], null),
            ),
            revisionFileUrl: toStringOrNull(
              pickCaseInsensitiveValue(
                item,
                [
                  "revisionFileUrl",
                  "RevisionFileUrl",
                  "fileUrl",
                  "FileUrl",
                  "documentUrl",
                  "DocumentUrl",
                ],
                null,
              ),
            ),
            finalStatus,
            isCtApproved: readBooleanLike(
              pickCaseInsensitiveValue(item, ["isCtApproved", "IsCtApproved"], false),
            ),
            isUvtkApproved: readBooleanLike(
              pickCaseInsensitiveValue(
                item,
                ["isUvtkApproved", "IsUvtkApproved"],
                false,
              ),
            ),
            isGvhdApproved: readBooleanLike(
              pickCaseInsensitiveValue(
                item,
                ["isGvhdApproved", "IsGvhdApproved"],
                false,
              ),
            ),
            createdAt: String(
              pickCaseInsensitiveValue(
                item,
                ["createdAt", "CreatedAt", "submittedAt", "SubmittedAt", "createdDate", "CreatedDate"],
                "",
              ),
            ).trim(),
            lastUpdated: String(
              pickCaseInsensitiveValue(
                item,
                ["lastUpdated", "LastUpdated", "updatedAt", "UpdatedAt", "modifiedAt", "ModifiedAt"],
                "",
              ),
            ).trim(),
          };
        })
        .sort((a, b) => {
          const left = new Date(a.lastUpdated || a.createdAt).getTime();
          const right = new Date(b.lastUpdated || b.createdAt).getTime();
          return right - left;
        }),
    [],
  );

  const hydrateSnapshot = useCallback(
    (payload: unknown): boolean => {
      const snapshot = extractSnapshotRecord(payload);
      if (!snapshot) {
        setDefenseInfo(DEFAULT_DEFENSE_INFO);
        setNotifications([]);
        setRevisionHistory([]);
        return false;
      }

      const defenseInfoRaw =
        pickFirstRecord(snapshot, [
          ["defenseInfo", "DefenseInfo"],
          ["studentDefenseInfo", "StudentDefenseInfo"],
          ["committeeAssignment", "CommitteeAssignment"],
          ["assignment", "Assignment"],
        ]) ?? snapshot;

      const notificationsRaw = pickFirstRecordArray(snapshot, [
        ["notifications", "Notifications"],
        ["alerts", "Alerts"],
        ["messages", "Messages"],
        ["notificationFeed", "NotificationFeed"],
      ]);

      const revisionHistoryRaw = pickFirstRecordArray(snapshot, [
        ["revisionHistory", "RevisionHistory"],
        ["revisionQueue", "RevisionQueue"],
        ["revisions", "Revisions"],
      ]);

      const mappedDefenseInfo = mapDefenseInfo(defenseInfoRaw);
      const mappedNotifications = mapNotifications(notificationsRaw);
      const mappedRevisionHistory = mapRevisionHistory(revisionHistoryRaw);

      setDefenseInfo(mappedDefenseInfo);
      setNotifications(mappedNotifications);
      setRevisionHistory(mappedRevisionHistory);
      setSnapshotFetchedAt(new Date().toLocaleString("vi-VN"));

      return (
        hasMeaningfulDefenseInfo(mappedDefenseInfo) ||
        mappedNotifications.length > 0 ||
        mappedRevisionHistory.length > 0
      );
    },
    [mapDefenseInfo, mapNotifications, mapRevisionHistory],
  );

  const clearSnapshotData = useCallback(() => {
    setDefenseInfo(DEFAULT_DEFENSE_INFO);
    setNotifications([]);
    setRevisionHistory([]);
  }, []);

  const loadSnapshot = useCallback(async () => {
    setLoadingData(true);

    try {
      const response = await fetchData<ApiResponse<Record<string, unknown>>>(
        "/student-defense/current/snapshot",
        {
          method: "GET",
        },
      );

      const parsed = parseApiEnvelope(
        response,
        "Không tải được thông tin bảo vệ của sinh viên.",
      );
      if (!parsed.ok || !parsed.data) {
        setCurrentPeriod(null);
        setCurrentSnapshotError("Không tải được thông tin bảo vệ của sinh viên.");
        clearSnapshotData();
        return;
      }

      const payload = toRecord(parsed.data) ?? {};
      const periodView = mapCurrentPeriodView(
        toRecord(
          pickCaseInsensitiveValue(payload, ["period", "Period"], null),
        ),
      );

      if (!periodView) {
        const message = "Dữ liệu snapshot không có thông tin đợt bảo vệ hợp lệ.";
        setCurrentPeriod(null);
        setCurrentSnapshotError(message);
        clearSnapshotData();
        notifyError(message);
        return;
      }

      const resolvedPeriodId = periodView.periodId;
      setPeriodId(resolvedPeriodId);
      setActiveDefensePeriodId(resolvedPeriodId);
      syncPeriodToUrl(resolvedPeriodId);
      setCurrentPeriod(periodView);
      setCurrentSnapshotError(null);

      const snapshotPayload = pickCaseInsensitiveValue(
        payload,
        ["snapshot", "Snapshot"],
        parsed.data,
      );

      let hasMeaningfulData = hydrateSnapshot(snapshotPayload);

      if (!hasMeaningfulData) {
        try {
          const scopedResponse = await fetchData<ApiResponse<Record<string, unknown>>>(
            `/defense-periods/${resolvedPeriodId}/student/snapshot`,
            {
              method: "GET",
            },
          );

          if (readEnvelopeSuccess(scopedResponse)) {
            const scopedPayload = readEnvelopeData<Record<string, unknown>>(scopedResponse);
            hasMeaningfulData = hydrateSnapshot(scopedPayload);
          }
        } catch {
          // Keep current snapshot view if period-scoped fallback fails.
        }
      }

      if (!hasMeaningfulData) {
        clearSnapshotData();
      }
    } catch (error) {
      clearSnapshotData();

      if (error instanceof FetchDataError) {
        const apiMessage = readApiErrorMessage(error.data);

        if (error.status === 404) {
          const message =
            apiMessage ??
            "Bạn chưa được gán vào đợt bảo vệ đang hoạt động. Vui lòng liên hệ quản trị viên.";
          setCurrentSnapshotError(message);
          setCurrentPeriod(null);
          notifyWarning(message);
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

      setCurrentSnapshotError("Không thể kết nối đến hệ thống để lấy dữ liệu bảo vệ.");
      setCurrentPeriod(null);
      notifyError("Không thể kết nối đến hệ thống để lấy dữ liệu bảo vệ.");
    } finally {
      setLoadingData(false);
    }
  }, [
    clearSnapshotData,
    hydrateSnapshot,
    notifyError,
    notifyWarning,
    parseApiEnvelope,
    syncPeriodToUrl,
  ]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const hasAllowedAction = useCallback(
    (...actions: string[]) => {
      if (backendAllowedActions.length === 0) {
        return true;
      }

      return actions.some((action) => backendAllowedActions.includes(action));
    },
    [backendAllowedActions],
  );

  const assignmentIdForRevision = useMemo(() => {
    for (const item of revisionHistory) {
      if (item.assignmentId && item.assignmentId > 0) {
        return item.assignmentId;
      }
    }
    return null;
  }, [revisionHistory]);

  const latestSubmission = useMemo(
    () => revisionHistory[0] ?? null,
    [revisionHistory],
  );

  const completionRate = useMemo(() => {
    if (!defenseInfo.councilListLocked) {
      return 20;
    }

    if (!latestSubmission) {
      return 65;
    }

    if (latestSubmission.finalStatus === 2) {
      return 100;
    }

    if (latestSubmission.finalStatus === 3) {
      return 70;
    }

    return 85;
  }, [defenseInfo.councilListLocked, latestSubmission]);

  const scoreText =
    defenseInfo.finalScore == null ? "Đang chấm" : defenseInfo.finalScore.toFixed(2);
  const gradeText = defenseInfo.grade ?? "Đang chấm";
  const waitingState = !currentSnapshotError && !defenseInfo.councilListLocked;
  const periodDisplay = currentPeriod
    ? `${currentPeriod.name} (#${currentPeriod.periodId})`
    : periodId
      ? `Đợt #${periodId}`
      : "Chưa xác định";
  const latestNotice = notifications[0] ?? null;
  const displayDefenseInfo = useMemo(
    () => mergeDefenseInfoFromNotifications(defenseInfo, notifications),
    [defenseInfo, notifications],
  );

  const submitRevision = async () => {
    if (!periodId) {
      notifyError("Chưa chọn đợt bảo vệ. Vui lòng chọn đợt trước khi nộp chỉnh sửa.");
      return;
    }

    if (!defenseInfo.councilListLocked) {
      notifyWarning("Danh sách hội đồng chưa chốt. Tạm thời chưa thể nộp bản chỉnh sửa.");
      return;
    }

    if (!assignmentIdForRevision) {
      notifyWarning(
        "Chưa tìm thấy mã phân công để nộp chỉnh sửa. Vui lòng thử lại sau hoặc liên hệ giảng viên.",
      );
      return;
    }

    if (!selectedFile || !selectedFileName) {
      notifyError("Vui lòng chọn tệp PDF để nộp chỉnh sửa.");
      return;
    }

    if (!selectedFileName.toLowerCase().endsWith(".pdf")) {
      notifyWarning("Tệp nộp chỉnh sửa bắt buộc phải là định dạng PDF.");
      return;
    }

    if (!hasAllowedAction("SUBMIT_REVISION", "UC4.1.SUBMIT")) {
      notifyWarning("Bạn hiện chưa có quyền nộp chỉnh sửa ở trạng thái hiện tại.");
      return;
    }

    const formData = new FormData();
    formData.append("assignmentId", String(assignmentIdForRevision));
    if (revisedContent.trim()) {
      formData.append("revisedContent", revisedContent.trim());
    }
    formData.append("file", selectedFile);

    const idempotencyKey = createIdempotencyKey(String(periodId), "submit-revision");

    try {
      setSubmittingRevision(true);
      const response = await fetchData<ApiResponse<boolean>>(
        `/defense-periods/${periodId}/student/revisions`,
        {
          method: "POST",
          body: formData,
          headers: {
            "Idempotency-Key": idempotencyKey,
          },
        },
      );

      const parsed = parseApiEnvelope(response, "Nộp bản chỉnh sửa thất bại.", {
        emitSuccessMessage: false,
      });
      if (!parsed.ok) {
        return;
      }

      if (readEnvelopeIdempotencyReplay(response)) {
        notifyInfo("Yêu cầu nộp chỉnh sửa đã được xử lý trước đó.");
      } else {
        notifySuccess("Đã nộp bản chỉnh sửa. Hệ thống đang chờ duyệt.");
      }

      setLatestTrace(`[UC4.1] submit-revision at ${new Date().toLocaleString("vi-VN")}`);
      setSelectedFile(null);
      setSelectedFileName("");
      setRevisedContent("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await loadSnapshot();
    } catch {
      notifyError("Nộp bản chỉnh sửa thất bại. Vui lòng thử lại.");
    } finally {
      setSubmittingRevision(false);
    }
  };

  return (
    <div className="sd-root">
      <style>
        {`
          .sd-root {
            max-width: 1360px;
            padding: 20px;
            color: #0f172a;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
          }
          .sd-card {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 18px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          }
          .sd-header {
            margin-bottom: 16px;
            background: #ffffff;
          }
          .sd-hero-head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 14px;
            flex-wrap: wrap;
          }
          .sd-title {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 0;
            font-size: 26px;
            font-weight: 700;
            color: #0f172a;
            line-height: 1.25;
          }
          .sd-sub {
            margin: 8px 0 0;
            color: #475569;
            font-size: 14px;
            line-height: 1.6;
            max-width: 760px;
          }
          .sd-top-actions {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            flex-wrap: wrap;
          }
          .sd-period-wrap {
            display: grid;
            gap: 5px;
            min-width: 290px;
          }
          .sd-period-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #64748b;
            font-weight: 700;
          }
          .sd-period-select {
            min-height: 40px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 0 12px;
            font-size: 13px;
            color: #0f172a;
            background: #ffffff;
          }
          .sd-refresh {
            min-height: 40px;
            border-radius: 10px;
            border: 1px solid #f37021;
            background: #f37021;
            color: #fff;
            font-size: 13px;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 0 12px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .sd-refresh:hover:enabled {
            background: #ea580c;
            border-color: #ea580c;
          }
          .sd-refresh:disabled {
            border-color: #cbd5e1;
            background: #f8fafc;
            color: #94a3b8;
            cursor: not-allowed;
          }
          .sd-refresh--loading svg {
            animation: sd-spin 1s linear infinite;
          }
          @keyframes sd-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .sd-chip-row {
            margin-top: 14px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          .sd-chip {
            border: 1px solid #cbd5e1;
            border-radius: 999px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 700;
            background: #ffffff;
            color: #0f172a;
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .sd-chip--locked {
            border-color: #bbf7d0;
            color: #166534;
            background: #f0fdf4;
          }
          .sd-chip--waiting {
            border-color: #fde68a;
            color: #92400e;
            background: #fffbeb;
          }
          .sd-grid-4 {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
            gap: 14px;
            margin-bottom: 16px;
          }
          .sd-kicker {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            color: #64748b;
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .sd-value {
            font-size: 21px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 4px;
            line-height: 1.3;
          }
          .sd-meta {
            font-size: 13px;
            color: #475569;
            line-height: 1.5;
            margin-top: 6px;
          }
          .sd-progress {
            margin-top: 8px;
            height: 8px;
            border-radius: 999px;
            background: #e2e8f0;
            overflow: hidden;
          }
          .sd-progress > div {
            height: 100%;
            background: linear-gradient(90deg, #f37021 0%, #fb923c 100%);
          }
          .sd-toolbar {
            margin-bottom: 14px;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            background: #ffffff;
            padding: 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          .sd-pill {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            background: #ffffff;
            padding: 8px 13px;
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .sd-pill:hover {
            border-color: #94a3b8;
          }
          .sd-pill.active {
            border-color: #f37021;
            background: #fff7ed;
            color: #9a3412;
          }
          .sd-grid-2 {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 14px;
          }
          .sd-panel-title {
            margin: 0 0 10px;
            font-size: 20px;
            line-height: 1.3;
            display: flex;
            align-items: center;
            gap: 8px;
            color: #0f172a;
          }
          .sd-list {
            display: grid;
            gap: 10px;
          }
          .sd-list-item {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 12px;
            background: #ffffff;
          }
          .sd-list-title {
            font-weight: 700;
            line-height: 1.4;
            font-size: 15px;
            color: #0f172a;
          }
          .sd-list-sub {
            margin-top: 4px;
            color: #475569;
            font-size: 13px;
            line-height: 1.5;
          }
          .sd-empty {
            border: 1px dashed #cbd5e1;
            border-radius: 10px;
            padding: 14px;
            font-size: 13px;
            color: #64748b;
            background: #f8fafc;
          }
          .sd-warning-card {
            border-color: #fde68a;
            background: #fffbeb;
          }
          .sd-note-list {
            display: grid;
            gap: 8px;
            margin: 0;
            padding-left: 18px;
            color: #0f172a;
            line-height: 1.55;
            font-size: 14px;
          }
          .sd-upload {
            margin-top: 10px;
            border: 1px dashed #cbd5e1;
            border-radius: 10px;
            padding: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            background: #ffffff;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s ease;
          }
          .sd-upload:hover {
            border-color: #f37021;
            background: #fff7ed;
          }
          .sd-textarea {
            width: 100%;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 10px 12px;
            font-size: 14px;
            background: #ffffff;
            resize: vertical;
            min-height: 110px;
            font-family: inherit;
            color: #0f172a;
          }
          .sd-textarea:focus {
            outline: none;
            border-color: #f37021;
            box-shadow: 0 0 0 3px rgba(243, 112, 33, 0.16);
          }
          .sd-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 12px;
          }
          .sd-btn-primary,
          .sd-btn-soft {
            border-radius: 10px;
            min-height: 40px;
            padding: 8px 14px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
          }
          .sd-btn-primary {
            border: 1px solid #f37021;
            background: #f37021;
            color: #ffffff;
          }
          .sd-btn-primary:hover:enabled {
            border-color: #ea580c;
            background: #ea580c;
          }
          .sd-btn-primary:disabled {
            border-color: #cbd5e1;
            background: #f8fafc;
            color: #94a3b8;
            cursor: not-allowed;
          }
          .sd-btn-soft {
            border: 1px solid #cbd5e1;
            background: #ffffff;
            color: #0f172a;
          }
          .sd-btn-soft:hover {
            background: #f8fafc;
          }
          .sd-status {
            display: inline-flex;
            align-items: center;
            border: 1px solid #cbd5e1;
            border-radius: 999px;
            padding: 5px 10px;
            font-size: 11px;
            font-weight: 700;
          }
          .sd-status--approved {
            border-color: #bbf7d0;
            color: #166534;
            background: #f0fdf4;
          }
          .sd-status--rejected {
            border-color: #fecaca;
            color: #991b1b;
            background: #fef2f2;
          }
          .sd-status--pending {
            border-color: #fde68a;
            color: #92400e;
            background: #fffbeb;
          }
          .sd-approval-row {
            margin-top: 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          .sd-approval {
            border: 1px solid #cbd5e1;
            border-radius: 999px;
            padding: 4px 8px;
            font-size: 12px;
            font-weight: 600;
            background: #ffffff;
            color: #475569;
          }
          .sd-approval.done {
            border-color: #bbf7d0;
            color: #166534;
            background: #f0fdf4;
          }
          @media (max-width: 1080px) {
            .sd-root {
              padding: 20px;
            }
            .sd-top-actions {
              width: 100%;
              min-width: 100%;
            }
            .sd-period-wrap {
              min-width: 100%;
            }
          }
          @media (max-width: 760px) {
            .sd-root {
              padding: 14px;
            }
            .sd-title {
              font-size: 24px;
            }
            .sd-card {
              padding: 14px;
            }
            .sd-panel-title {
              font-size: 18px;
            }
          }
        `}
      </style>

      <section className="sd-card sd-header">
        <div className="sd-hero-head">
          <div>
            <h1 className="sd-title">
              <GraduationCap size={26} /> Thông tin bảo vệ
            </h1>
            <p className="sd-sub">
              Theo dõi lịch bảo vệ, kết quả và hồ sơ chỉnh sửa trong cùng một màn hình.
            </p>
          </div>

          <div className="sd-top-actions">
            <div className="sd-period-wrap">
              <span className="sd-period-label">Đợt bảo vệ hiện tại</span>
              <div
                className="sd-period-select"
                style={{ display: "flex", alignItems: "center", fontWeight: 700 }}
              >
                {periodDisplay}
              </div>
            </div>
          </div>
        </div>

        <div className="sd-chip-row">
          <span className="sd-chip">
            <CalendarClock size={14} /> Đợt: {periodDisplay}
          </span>
          <span className={`sd-chip ${waitingState ? "sd-chip--waiting" : "sd-chip--locked"}`}>
            <Users size={14} /> {waitingState ? "Hội đồng: Chưa chốt" : "Hội đồng: Đã chốt"}
          </span>
          <span className="sd-chip">
            <AlertCircle size={14} /> Trạng thái khóa: {defenseInfo.councilLockStatus === "LOCKED" ? "Đã khóa" : "Chưa khóa"}
          </span>
          {currentPeriod && (
            <span className="sd-chip">
              <Bell size={14} /> Trạng thái đợt: {currentPeriod.status}
            </span>
          )}
          {defenseInfo.councilListLocked && (
            <span className="sd-chip">
              <Clock3 size={14} /> Buổi: {formatSessionLabel(displayDefenseInfo.sessionCode)}
            </span>
          )}
        </div>

        <div className="sd-meta">
          {loadingData
            ? "Đang tải dữ liệu mới nhất..."
            : `Cập nhật lần gần nhất: ${snapshotFetchedAt}${latestTrace ? ` · ${latestTrace}` : ""}`}
        </div>
      </section>

      <section className="sd-card sd-grid-4">
        <div>
          <div className="sd-kicker">
            <User size={14} /> Mã sinh viên
          </div>
          <div className="sd-value">{defenseInfo.studentCode || "Đang cập nhật"}</div>
          <div className="sd-meta">Sinh viên: {defenseInfo.studentName || "Đang cập nhật"}</div>
        </div>

        <div>
          <div className="sd-kicker">
            <FileText size={14} /> Đề tài
          </div>
          <div className="sd-value" style={{ fontSize: 18 }}>
            {defenseInfo.topicCode || "Đang cập nhật"}
          </div>
          <div className="sd-meta">
            {defenseInfo.topicTitle || "Thông tin đề tài sẽ hiển thị đầy đủ sau khi hội đồng chốt."}
          </div>
        </div>

        <div>
          <div className="sd-kicker">
            <CheckCircle2 size={14} /> Kết quả hiện tại
          </div>
          <div className="sd-value">{scoreText}</div>
          <div className="sd-meta">Xếp loại: {gradeText}</div>
        </div>

        <div>
          <div className="sd-kicker">
            <Hash size={14} /> Tiến độ hồ sơ
          </div>
          <div className="sd-progress">
            <div style={{ width: `${completionRate}%` }} />
          </div>
          <div className="sd-meta" style={{ fontWeight: 700 }}>
            {completionRate}%
          </div>
        </div>
      </section>

      {currentSnapshotError ? (
        <section className="sd-card sd-warning-card">
          <h2 className="sd-panel-title">
            <AlertCircle size={18} /> Trạng thái dữ liệu đợt bảo vệ
          </h2>
          <div className="sd-list">
            <div className="sd-list-item">
              <div className="sd-list-title">Không thể xác định snapshot hiện tại</div>
              <div className="sd-list-sub">{currentSnapshotError}</div>
            </div>
            <div className="sd-list-item">
              <div className="sd-list-title">Gợi ý xử lý</div>
              <div className="sd-list-sub">
                Nếu thông tin mapping vừa được cập nhật, vui lòng tải lại trang. Nếu lỗi tiếp diễn,
                vui lòng liên hệ quản trị viên để kiểm tra mapping đợt bảo vệ.
              </div>
            </div>
          </div>
        </section>
      ) : waitingState ? (
        <>
          <div className="sd-grid-2">
            <section className="sd-card sd-warning-card">
              <h2 className="sd-panel-title">
                <AlertCircle size={18} /> Trạng thái chờ chốt hội đồng
              </h2>
              <div className="sd-list">
                <div className="sd-list-item">
                  <div className="sd-list-title">Thông tin lịch bảo vệ đang được cập nhật</div>
                  <div className="sd-list-sub">
                    Khi hội đồng chưa chốt, phòng và lịch có thể chưa xuất hiện đầy đủ.
                  </div>
                </div>
                <div className="sd-list-item">
                  <div className="sd-list-title">Nếu hệ thống đã gửi thông báo chốt hội đồng</div>
                  <div className="sd-list-sub">
                    Vui lòng tải lại trang để đồng bộ dữ liệu mới nhất.
                  </div>
                </div>
              </div>
            </section>

            <section className="sd-card">
              <h2 className="sd-panel-title">
                <Bell size={18} /> Lưu ý trước ngày bảo vệ
              </h2>
              <ul className="sd-note-list">
                <li>Nên có mặt trước giờ hẹn khoảng 20-30 phút để ổn định tâm lý và kiểm tra thiết bị.</li>
                <li>Trang phục gọn gàng, lịch sự; ưu tiên sự thoải mái để tự tin khi trình bày.</li>
                <li>Khi hồi hộp, hãy thở chậm 3-5 nhịp trước khi vào phòng và tập trung vào ý chính.</li>
                <li>Mang theo bản dự phòng tệp PDF trong USB hoặc cloud để phòng sự cố kỹ thuật.</li>
              </ul>
            </section>
          </div>

          <section className="sd-card" style={{ marginTop: 14 }}>
            <h2 className="sd-panel-title">
              <Clock3 size={18} /> Thông báo gần đây
            </h2>
            <div className="sd-list">
              {notifications.slice(0, 3).map((item, index) => (
                <div key={`${item.timestamp}-${index}`} className="sd-list-item">
                  <div className="sd-kicker" style={{ textTransform: "none", letterSpacing: 0 }}>
                    {formatDateTime(item.timestamp, true)}
                  </div>
                  <div className="sd-list-title">{item.message}</div>
                  <div className="sd-list-sub">Loại: {formatNotificationType(item.type)}</div>
                </div>
              ))}
              {!latestNotice && (
                <div className="sd-empty">Chưa có thông báo nghiệp vụ trong đợt hiện tại.</div>
              )}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="sd-toolbar">
            <button
              type="button"
              className={`sd-pill ${activePanel === "overview" ? "active" : ""}`}
              onClick={() => setActivePanel("overview")}
            >
              <CalendarClock size={15} /> Lịch và hội đồng
            </button>
            <button
              type="button"
              className={`sd-pill ${activePanel === "notifications" ? "active" : ""}`}
              onClick={() => setActivePanel("notifications")}
            >
              <Bell size={15} /> Thông báo
            </button>
            <button
              type="button"
              className={`sd-pill ${activePanel === "revision" ? "active" : ""}`}
              onClick={() => setActivePanel("revision")}
            >
              <Upload size={15} /> Nộp chỉnh sửa
            </button>
          </section>

          {activePanel === "overview" && (
            <div className="sd-grid-2">
              <section className="sd-card">
                <h2 className="sd-panel-title">
                  <CalendarClock size={18} /> Lịch bảo vệ
                </h2>
                <div className="sd-list">
                  <div className="sd-list-item">
                    <div className="sd-kicker">
                      <Users size={14} /> Hội đồng
                    </div>
                    <div className="sd-list-title">{displayDefenseInfo.committeeCode || "Đang cập nhật"}</div>
                  </div>
                  <div className="sd-list-item">
                    <div className="sd-kicker">
                      <MapPin size={14} /> Phòng bảo vệ
                    </div>
                    <div className="sd-list-title">{displayDefenseInfo.room || "Đang cập nhật"}</div>
                  </div>
                  <div className="sd-list-item">
                    <div className="sd-kicker">
                      <CalendarClock size={14} /> Ngày giờ
                    </div>
                    <div className="sd-list-title">{formatDateTime(displayDefenseInfo.scheduledAt, true)}</div>
                    <div className="sd-list-sub">Buổi: {formatSessionLabel(displayDefenseInfo.sessionCode)}</div>
                  </div>
                  <div className="sd-list-item">
                    <div className="sd-kicker">
                      <FileText size={14} /> Đề tài
                    </div>
                    <div className="sd-list-title">{defenseInfo.topicTitle || "Đang cập nhật"}</div>
                    <div className="sd-list-sub">Mã đề tài: {defenseInfo.topicCode || "-"}</div>
                  </div>
                </div>
              </section>

              <section className="sd-card">
                <h2 className="sd-panel-title">
                  <FileText size={18} /> Kết quả và nhắc nhở
                </h2>
                <div className="sd-list">
                  <div className="sd-list-item">
                    <div className="sd-kicker">Điểm tổng kết</div>
                    <div className="sd-list-title" style={{ fontSize: 20 }}>{scoreText}</div>
                    <div className="sd-list-sub">Xếp loại: {gradeText}</div>
                  </div>
                  <div className="sd-list-item">
                    <div className="sd-kicker">Gợi ý trình bày hiệu quả</div>
                    <ul className="sd-note-list" style={{ marginTop: 8 }}>
                      <li>Mở đầu ngắn gọn, nêu ngay mục tiêu và kết quả chính trong 1-2 phút đầu.</li>
                      <li>Dùng slide tối giản, tập trung dữ liệu chứng minh thay vì chữ quá dài.</li>
                      <li>Khi nhận câu hỏi khó, xin 5-10 giây suy nghĩ để trả lời mạch lạc hơn.</li>
                      <li>Giữ thái độ cầu thị và bình tĩnh, đó là điểm cộng lớn trong buổi bảo vệ.</li>
                    </ul>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activePanel === "notifications" && (
            <section className="sd-card">
              <h2 className="sd-panel-title">
                <Clock3 size={18} /> Dòng thông báo
              </h2>
              <div className="sd-list">
                {notifications.map((item, index) => (
                  <div key={`${item.timestamp}-${item.message}-${index}`} className="sd-list-item">
                    <div className="sd-kicker" style={{ textTransform: "none", letterSpacing: 0 }}>
                      {formatDateTime(item.timestamp, true)}
                    </div>
                    <div className="sd-list-title">{item.message}</div>
                    <div className="sd-list-sub">Loại sự kiện: {formatNotificationType(item.type)}</div>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div className="sd-empty">Chưa có thông báo nghiệp vụ trong đợt hiện tại.</div>
                )}
              </div>
            </section>
          )}

          {activePanel === "revision" && (
            <div className="sd-grid-2">
              <section className="sd-card">
                <h2 className="sd-panel-title">
                  <Upload size={18} /> Nộp bản chỉnh sửa
                </h2>
                <div className="sd-list">
                  <div className="sd-list-item">
                    <div className="sd-kicker">
                      <Hash size={14} /> Mã phân công
                    </div>
                    <div className="sd-list-title">
                      {assignmentIdForRevision ? `Phân công #${assignmentIdForRevision}` : "Chưa có mã phân công"}
                    </div>
                    <div className="sd-list-sub">
                      Hệ thống đang tự động lấy mã phân công từ lịch sử chỉnh sửa gần nhất.
                    </div>
                  </div>
                </div>

                <label style={{ display: "grid", gap: 6, marginTop: 12 }}>
                  <span className="sd-kicker" style={{ fontSize: 11 }}>Nội dung chỉnh sửa (không bắt buộc)</span>
                  <textarea
                    className="sd-textarea"
                    value={revisedContent}
                    onChange={(event) => setRevisedContent(event.target.value)}
                    placeholder="Mô tả ngắn gọn những phần đã cập nhật..."
                  />
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    const fileName = file?.name ?? "";
                    setSelectedFile(file);
                    setSelectedFileName(fileName);
                    if (fileName) {
                      notifyInfo(`Đã chọn tệp: ${fileName}`);
                    }
                  }}
                />

                <button
                  type="button"
                  className="sd-upload"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Upload size={15} /> Chọn tệp PDF
                  </span>
                  <span style={{ fontSize: 13, color: "#475569" }}>
                    {selectedFileName || "Chưa có tệp nào được chọn"}
                  </span>
                </button>

                <div className="sd-actions">
                  <button
                    type="button"
                    className="sd-btn-primary"
                    onClick={submitRevision}
                    disabled={
                      submittingRevision ||
                      !selectedFile ||
                      !assignmentIdForRevision ||
                      !hasAllowedAction("SUBMIT_REVISION", "UC4.1.SUBMIT") ||
                      latestSubmission?.finalStatus === 2
                    }
                  >
                    {submittingRevision ? "Đang nộp..." : "Nộp bản chỉnh sửa"}
                  </button>
                  <button
                    type="button"
                    className="sd-btn-soft"
                    onClick={() => {
                      setSelectedFile(null);
                      setSelectedFileName("");
                      setRevisedContent("");
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    Xóa nội dung
                  </button>
                </div>
              </section>

              <section className="sd-card">
                <h2 className="sd-panel-title">
                  <CheckCircle2 size={18} /> Lịch sử chỉnh sửa
                </h2>
                <div className="sd-list">
                  {revisionHistory.map((item) => {
                    const statusMeta = formatRevisionStatus(item.finalStatus);
                    return (
                      <div key={`revision-${item.id}`} className="sd-list-item">
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <div className="sd-list-title">Lần chỉnh sửa #{item.id}</div>
                          <span className={statusMeta.className}>{statusMeta.label}</span>
                        </div>
                        <div className="sd-list-sub">
                          Phân công: {item.assignmentId ?? "-"} · Tạo lúc: {formatDateTime(item.createdAt, true)}
                        </div>
                        <div className="sd-list-sub">
                          Cập nhật cuối: {formatDateTime(item.lastUpdated || item.createdAt, true)}
                        </div>
                        {item.revisionFileUrl && (
                          <div className="sd-list-sub">Tệp: {item.revisionFileUrl}</div>
                        )}
                        <div className="sd-approval-row">
                          <span className={`sd-approval ${item.isCtApproved ? "done" : ""}`}>
                            CT: {item.isCtApproved ? "Đã duyệt" : "Chưa duyệt"}
                          </span>
                          <span className={`sd-approval ${item.isUvtkApproved ? "done" : ""}`}>
                            UV/TK: {item.isUvtkApproved ? "Đã duyệt" : "Chưa duyệt"}
                          </span>
                          <span className={`sd-approval ${item.isGvhdApproved ? "done" : ""}`}>
                            GVHD: {item.isGvhdApproved ? "Đã duyệt" : "Chưa duyệt"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {revisionHistory.length === 0 && (
                    <div className="sd-empty">Chưa có lịch sử nộp bản chỉnh sửa.</div>
                  )}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StudentDefenseInfo;
