import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Info,
  MapPin,
  UsersRound,
} from "lucide-react";
import { FetchDataError, fetchData } from "../../api/fetchData";
import { useAuth } from "../../hooks/useAuth";
import {
  pickCaseInsensitiveValue,
  readEnvelopeData,
  readEnvelopeErrorMessages,
  readEnvelopeMessage,
  readEnvelopeSuccess,
} from "../../utils/api-envelope";
import {
  getActiveDefensePeriodId,
  normalizeDefensePeriodId,
  setActiveDefensePeriodId,
} from "../../utils/defensePeriod";
import type { ApiResponse } from "../../types/api";
import type { SessionCode } from "../../types/defense-workflow-contract";

type ScheduleStatus = "scheduled" | "completed" | "locked" | "cancelled";

type DefenseSchedule = {
  id: string;
  assignmentId: number | null;
  topicTitle: string;
  studentCode: string;
  studentName: string;
  committeeCode: string;
  committeeName: string;
  room: string;
  scheduledAt: string | null;
  session: SessionCode;
  startTime: string | null;
  endTime: string | null;
  status: ScheduleStatus;
  lecturerRole: string;
};

type CommitteeView = {
  numericId: number;
  committeeCode: string;
  committeeName: string;
  room: string;
  scheduledAt: string | null;
  session: SessionCode;
  startTime: string | null;
  endTime: string | null;
  statusRaw: string;
  lecturerRole: string;
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
  return value.filter((item): item is Record<string, unknown> => Boolean(toRecord(item)));
};

const toNumberOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toText = (value: unknown, fallback = ""): string => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const toIsoDateOrNull = (value: unknown): string | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const toBooleanOrNull = (value: unknown): boolean | null => {
  if (value === true) {
    return true;
  }
  if (value === false) {
    return false;
  }
  return null;
};

const normalizeTime = (value: unknown): string | null => {
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
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const inferSessionFromTime = (timeValue: string | null): SessionCode | null => {
  if (!timeValue) {
    return null;
  }
  const hour = Number(timeValue.split(":")[0]);
  if (!Number.isFinite(hour)) {
    return null;
  }
  return hour >= 12 ? "AFTERNOON" : "MORNING";
};

const normalizeSession = (value: unknown, fallback: SessionCode = "MORNING"): SessionCode => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (
    normalized.includes("AFTER") ||
    normalized.includes("PM") ||
    normalized.includes("CHIỀU") ||
    normalized.includes("CHIEU")
  ) {
    return "AFTERNOON";
  }
  if (
    normalized.includes("MORNING") ||
    normalized.includes("AM") ||
    normalized.includes("SÁNG") ||
    normalized.includes("SANG")
  ) {
    return "MORNING";
  }
  return fallback;
};

const mergeDateAndTime = (dateIso: string | null, timeValue: string | null): string | null => {
  if (!dateIso) {
    return null;
  }
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  if (timeValue) {
    const [hourText, minuteText] = timeValue.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (Number.isFinite(hour) && Number.isFinite(minute)) {
      parsed.setHours(hour, minute, 0, 0);
    }
  }
  return parsed.toISOString();
};

const mapRoleLabel = (value: unknown): string => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized.includes("CHAIR") || normalized.includes("CHU TICH") || normalized === "CT") {
    return "Chủ tịch hội đồng";
  }
  if (
    normalized.includes("SECRETARY") ||
    normalized.includes("THU KY") ||
    normalized === "UVTK" ||
    normalized === "TK"
  ) {
    return "Ủy viên thư ký hội đồng";
  }
  if (
    normalized.includes("REVIEW") ||
    normalized.includes("PHAN BIEN") ||
    normalized === "UVPB" ||
    normalized === "PB"
  ) {
    return "Ủy viên phản biện hội đồng";
  }
  if (normalized.includes("SUPERVISOR") || normalized.includes("GVHD")) {
    return "Giảng viên hướng dẫn";
  }
  return "Không xác định";
};

const resolveLecturerRole = (
  members: Array<Record<string, unknown>>,
  userCode: string | null,
): string => {
  if (!userCode) {
    return "Thành viên hội đồng";
  }
  const normalizedUserCode = userCode.trim().toUpperCase();
  const matched = members.find((member) => {
    const memberCode = toText(
      pickCaseInsensitiveValue(member, ["lecturerCode", "LecturerCode", "code", "Code"], ""),
      "",
    ).toUpperCase();
    return memberCode === normalizedUserCode;
  });

  if (!matched) {
    return "Thành viên hội đồng";
  }

  const roleRaw = pickCaseInsensitiveValue(
    matched,
    ["role", "Role", "roleCode", "RoleCode"],
    "",
  );
  return mapRoleLabel(roleRaw);
};

const toScheduleStatus = (
  rawStatus: string,
  isLocked: boolean,
  scheduledAt: string | null,
): ScheduleStatus => {
  const normalized = rawStatus.toUpperCase();
  if (normalized.includes("CANCEL")) {
    return "cancelled";
  }
  if (isLocked || normalized.includes("LOCK") || normalized.includes("FINAL")) {
    return "locked";
  }
  if (normalized.includes("COMPLETE") || normalized.includes("DONE")) {
    return "completed";
  }

  if (scheduledAt) {
    const scheduleTime = new Date(scheduledAt).getTime();
    if (Number.isFinite(scheduleTime) && scheduleTime < Date.now()) {
      return "completed";
    }
  }

  return "scheduled";
};

const extractCommitteeRowsFromSnapshot = (
  snapshot: Record<string, unknown>,
): Array<Record<string, unknown>> => {
  const committeesSource = pickCaseInsensitiveValue(snapshot, ["committees", "Committees"], []);

  if (Array.isArray(committeesSource)) {
    return toRecordArray(committeesSource);
  }

  const committeesContainer = toRecord(committeesSource) ?? {};
  return toRecordArray(
    pickCaseInsensitiveValue(committeesContainer, ["committees", "Committees", "items", "Items"], []),
  );
};

const mapSnapshotToSchedules = (
  snapshot: Record<string, unknown>,
  userCode: string | null,
): DefenseSchedule[] => {
  const committeeItems = extractCommitteeRowsFromSnapshot(snapshot);

  const scoringObject =
    toRecord(pickCaseInsensitiveValue(snapshot, ["scoring", "Scoring"], {})) ?? {};
  const matrixItems = toRecordArray(
    pickCaseInsensitiveValue(scoringObject, ["matrix", "Matrix"], []),
  );

  const committeeCodeMap = new Map<string, CommitteeView>();
  const committeeNumericMap = new Map<number, CommitteeView>();

  committeeItems.forEach((item, index) => {
    const numericId =
      toNumberOrNull(pickCaseInsensitiveValue(item, ["committeeId", "CommitteeId", "id", "Id"], null)) ??
      index + 1;

    const committeeCode = toText(
      pickCaseInsensitiveValue(item, ["committeeCode", "CommitteeCode", "code", "Code"], `HD${numericId}`),
      `HD${numericId}`,
    );
    const committeeName = toText(
      pickCaseInsensitiveValue(item, ["name", "Name", "committeeName", "CommitteeName"], committeeCode),
      committeeCode,
    );

    const room = toText(pickCaseInsensitiveValue(item, ["room", "Room", "location", "Location"], ""), "-");
    const startTime = normalizeTime(
      pickCaseInsensitiveValue(item, ["startTime", "StartTime", "slotStart", "SlotStart"], null),
    );
    const endTime = normalizeTime(
      pickCaseInsensitiveValue(item, ["endTime", "EndTime", "slotEnd", "SlotEnd"], null),
    );
    const committeeDate = toIsoDateOrNull(
      pickCaseInsensitiveValue(item, ["defenseDate", "DefenseDate", "date", "Date", "scheduledAt", "ScheduledAt"], null),
    );

    const session = normalizeSession(
      pickCaseInsensitiveValue(item, ["session", "Session", "sessionCode", "SessionCode"], null),
      inferSessionFromTime(startTime) ?? "MORNING",
    );

    const statusRaw = toText(pickCaseInsensitiveValue(item, ["status", "Status"], ""), "");

    const members = toRecordArray(
      pickCaseInsensitiveValue(item, ["members", "Members"], []),
    );

    const committee: CommitteeView = {
      numericId,
      committeeCode,
      committeeName,
      room,
      scheduledAt: mergeDateAndTime(committeeDate, startTime) ?? committeeDate,
      session,
      startTime,
      endTime,
      statusRaw,
      lecturerRole: resolveLecturerRole(members, userCode),
    };

    committeeCodeMap.set(committeeCode.trim().toUpperCase(), committee);
    committeeNumericMap.set(numericId, committee);
  });

  const scheduleRows: DefenseSchedule[] = [];

  matrixItems.forEach((item, index) => {
    const committeeCodeFromRow = toText(
      pickCaseInsensitiveValue(item, ["committeeCode", "CommitteeCode"], ""),
      "",
    );
    const committeeIdFromRow = toNumberOrNull(
      pickCaseInsensitiveValue(item, ["committeeId", "CommitteeId"], null),
    );

    const matchedCommittee =
      (committeeCodeFromRow ? committeeCodeMap.get(committeeCodeFromRow.toUpperCase()) : undefined) ??
      (committeeIdFromRow != null ? committeeNumericMap.get(committeeIdFromRow) : undefined);

    const assignmentId = toNumberOrNull(
      pickCaseInsensitiveValue(item, ["assignmentId", "AssignmentId"], null),
    );

    const startTime =
      normalizeTime(
        pickCaseInsensitiveValue(item, ["startTime", "StartTime", "slotStart", "SlotStart"], null),
      ) ?? matchedCommittee?.startTime ?? null;
    const endTime =
      normalizeTime(
        pickCaseInsensitiveValue(item, ["endTime", "EndTime", "slotEnd", "SlotEnd"], null),
      ) ?? matchedCommittee?.endTime ?? null;

    const rowDate = toIsoDateOrNull(
      pickCaseInsensitiveValue(item, ["scheduledAt", "ScheduledAt", "defenseDate", "DefenseDate"], null),
    );
    const baseDate = rowDate ?? matchedCommittee?.scheduledAt ?? null;
    const scheduledAt = mergeDateAndTime(baseDate, startTime) ?? baseDate;

    const session = normalizeSession(
      pickCaseInsensitiveValue(item, ["session", "Session", "sessionCode", "SessionCode"], null),
      inferSessionFromTime(startTime) ?? matchedCommittee?.session ?? "MORNING",
    );

    const topicTitle = toText(
      pickCaseInsensitiveValue(item, ["topicTitle", "TopicTitle", "title", "Title"], ""),
      "",
    );

    const topicFallback = toText(
      pickCaseInsensitiveValue(item, ["topicCode", "TopicCode", "assignmentCode", "AssignmentCode"], "Đề tài chưa cập nhật"),
      "Đề tài chưa cập nhật",
    );

    const statusRaw = toText(
      pickCaseInsensitiveValue(item, ["status", "Status"], matchedCommittee?.statusRaw ?? ""),
      "",
    );

    const status = toScheduleStatus(
      statusRaw,
      Boolean(pickCaseInsensitiveValue(item, ["isLocked", "IsLocked"], false)),
      scheduledAt,
    );

    const committeeCode = matchedCommittee?.committeeCode || committeeCodeFromRow || `HD-${committeeIdFromRow ?? index + 1}`;

    scheduleRows.push({
      id: `${committeeCode}-${assignmentId ?? index + 1}`,
      assignmentId,
      topicTitle: topicTitle || topicFallback,
      studentCode: toText(pickCaseInsensitiveValue(item, ["studentCode", "StudentCode"], "-"), "-"),
      studentName: toText(pickCaseInsensitiveValue(item, ["studentName", "StudentName"], "Chưa cập nhật"), "Chưa cập nhật"),
      committeeCode,
      committeeName: matchedCommittee?.committeeName || committeeCode,
      room:
        toText(pickCaseInsensitiveValue(item, ["room", "Room"], matchedCommittee?.room ?? ""), "-") ||
        matchedCommittee?.room ||
        "-",
      scheduledAt,
      session,
      startTime,
      endTime,
      status,
      lecturerRole: matchedCommittee?.lecturerRole ?? "Thành viên hội đồng",
    });
  });

  if (scheduleRows.length === 0) {
    committeeCodeMap.forEach((committee, index) => {
      scheduleRows.push({
        id: `${committee.committeeCode}-${index + 1}`,
        assignmentId: null,
        topicTitle: `Phiên bảo vệ của ${committee.committeeName}`,
        studentCode: "-",
        studentName: "Chưa có danh sách đề tài",
        committeeCode: committee.committeeCode,
        committeeName: committee.committeeName,
        room: committee.room,
        scheduledAt: committee.scheduledAt,
        session: committee.session,
        startTime: committee.startTime,
        endTime: committee.endTime,
        status: toScheduleStatus(committee.statusRaw, false, committee.scheduledAt),
        lecturerRole: committee.lecturerRole,
      });
    });
  }

  return scheduleRows.sort((left, right) => {
    const leftTime = new Date(left.scheduledAt ?? 0).getTime();
    const rightTime = new Date(right.scheduledAt ?? 0).getTime();
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    if ((left.startTime ?? "") !== (right.startTime ?? "")) {
      return (left.startTime ?? "").localeCompare(right.startTime ?? "");
    }
    return left.committeeCode.localeCompare(right.committeeCode);
  });
};

const formatDate = (value: string | null): string => {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleDateString("vi-VN");
};

const formatMonthLabel = (date: Date): string => {
  const label = date.toLocaleDateString("vi-VN", {
    month: "long",
    year: "numeric",
  });

  return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatSession = (session: SessionCode): string =>
  session === "MORNING" ? "Buổi sáng" : "Buổi chiều";

const getStatusText = (status: ScheduleStatus): string => {
  switch (status) {
    case "scheduled":
      return "Đã lên lịch";
    case "completed":
      return "Đã hoàn thành";
    case "locked":
      return "Đã khóa";
    case "cancelled":
      return "Đã hủy";
    default:
      return "Không xác định";
  }
};

const getScheduleTheme = (status: ScheduleStatus) => {
  switch (status) {
    case "scheduled":
      return { bg: "#FFF7ED", border: "#F37021", text: "#9A3412" };
    case "completed":
      return { bg: "#DCFCE7", border: "#22C55E", text: "#166534" };
    case "locked":
      return { bg: "#DBEAFE", border: "#3B82F6", text: "#1E40AF" };
    case "cancelled":
      return { bg: "#FEE2E2", border: "#EF4444", text: "#991B1B" };
    default:
      return { bg: "#F3F4F6", border: "#9CA3AF", text: "#374151" };
  }
};

const getDateKey = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildCalendarDays = (date: Date): Array<Date | null> => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const result: Array<Date | null> = [];
  for (let index = 0; index < firstDay.getDay(); index += 1) {
    result.push(null);
  }
  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    result.push(new Date(year, month, day));
  }
  return result;
};

const parseSafeDate = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const LecturerSchedule: React.FC = () => {
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventPopup, setShowEventPopup] = useState(false);
  const [selectedSchedulesForPopup, setSelectedSchedulesForPopup] = useState<DefenseSchedule[]>([]);
  const [schedules, setSchedules] = useState<DefenseSchedule[]>([]);
  const [periodLabel, setPeriodLabel] = useState<string>("Đợt đang hoạt động");
  const [councilListLocked, setCouncilListLocked] = useState<boolean | null>(null);
  const [hasCommitteeAccess, setHasCommitteeAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Đang tải lịch bảo vệ...");
  const [error, setError] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState<number | null>(() => {
    const fromQuery = normalizeDefensePeriodId(searchParams.get("periodId"));
    return fromQuery ?? getActiveDefensePeriodId();
  });

  useEffect(() => {
    const fromQuery = normalizeDefensePeriodId(searchParams.get("periodId"));
    const nextPeriod = fromQuery ?? getActiveDefensePeriodId();
    if (nextPeriod !== periodId) {
      setPeriodId(nextPeriod);
    }
  }, [periodId, searchParams]);

  useEffect(() => {
    const hydrateSchedule = async () => {
      setLoading(true);
      setLoadingMessage("Đang đồng bộ lịch từ snapshot giảng viên...");
      setError(null);

      try {
        const endpoint = periodId
          ? `/defense-periods/${periodId}/lecturer/snapshot`
          : "/lecturer-defense/current/snapshot";

        const response = await fetchData<Record<string, unknown>>(endpoint);
        const envelopeResponse = response as unknown as ApiResponse<Record<string, unknown>>;

        if (!readEnvelopeSuccess(envelopeResponse)) {
          const apiError =
            readEnvelopeErrorMessages(envelopeResponse)[0] ||
            readEnvelopeMessage(envelopeResponse) ||
            "Không tải được lịch hội đồng từ API snapshot.";
          setLoadingMessage(apiError);
          setError(apiError);
          setSchedules([]);
          return;
        }

        const rootData =
          toRecord(readEnvelopeData(envelopeResponse)) ||
          toRecord(response.data) ||
          {};

        const periodObject = toRecord(
          pickCaseInsensitiveValue(rootData, ["period", "Period", "currentPeriod", "CurrentPeriod"], null),
        );

        const resolvedPeriodId = toNumberOrNull(
          periodObject
            ? pickCaseInsensitiveValue(periodObject, ["periodId", "PeriodId", "id", "Id"], null)
            : periodId,
        );

        if (resolvedPeriodId != null) {
          setActiveDefensePeriodId(resolvedPeriodId);
          if (periodId == null) {
            setPeriodId(resolvedPeriodId);
          }
        }

        const periodName = periodObject
          ? toText(
              pickCaseInsensitiveValue(
                periodObject,
                ["name", "Name"],
                resolvedPeriodId ? `Đợt #${resolvedPeriodId}` : "Đợt đang hoạt động",
              ),
              resolvedPeriodId ? `Đợt #${resolvedPeriodId}` : "Đợt đang hoạt động",
            )
          : resolvedPeriodId
            ? `Đợt #${resolvedPeriodId}`
            : "Đợt đang hoạt động";

        setPeriodLabel(periodName);

        const snapshot =
          toRecord(pickCaseInsensitiveValue(rootData, ["snapshot", "Snapshot"], rootData)) ||
          {};

        const committeeRows = extractCommitteeRowsFromSnapshot(snapshot);
        const lockFlag = toBooleanOrNull(
          pickCaseInsensitiveValue(
            snapshot,
            ["councilListLocked", "CouncilListLocked"],
            pickCaseInsensitiveValue(rootData, ["councilListLocked", "CouncilListLocked"], null),
          ),
        );
        const hasAccessFlagFromApi = toBooleanOrNull(
          pickCaseInsensitiveValue(
            snapshot,
            ["hasCommitteeAccess", "HasCommitteeAccess"],
            pickCaseInsensitiveValue(rootData, ["hasCommitteeAccess", "HasCommitteeAccess"], null),
          ),
        );

        setCouncilListLocked(lockFlag);
        setHasCommitteeAccess(hasAccessFlagFromApi ?? (lockFlag === true && committeeRows.length > 0));

        const mappedSchedules = mapSnapshotToSchedules(snapshot, auth.user?.userCode ?? null);
        setSchedules(mappedSchedules);
      } catch (caughtError) {
        if (caughtError instanceof FetchDataError) {
          const message = caughtError.message || "Không tải được lịch bảo vệ. Vui lòng kiểm tra kết nối API.";
          setLoadingMessage(message);
          setError(message);
        } else {
          const message = "Không tải được lịch bảo vệ. Vui lòng thử lại.";
          setLoadingMessage(message);
          setError(message);
        }
        setSchedules([]);
      } finally {
        setLoading(false);
      }
    };

    void hydrateSchedule();
  }, [auth.user?.userCode, periodId]);

  const schedulesByDay = useMemo(() => {
    const map = new Map<string, DefenseSchedule[]>();
    schedules.forEach((schedule) => {
      const key = getDateKey(schedule.scheduledAt);
      if (!key) {
        return;
      }
      const currentRows = map.get(key) ?? [];
      currentRows.push(schedule);
      currentRows.sort((left, right) => {
        const leftTime = new Date(left.scheduledAt ?? 0).getTime();
        const rightTime = new Date(right.scheduledAt ?? 0).getTime();
        return leftTime - rightTime;
      });
      map.set(key, currentRows);
    });
    return map;
  }, [schedules]);

  const upcomingSchedules = useMemo(
    () =>
      schedules
        .filter((schedule) => {
          const eventDate = parseSafeDate(`${schedule.scheduledAt ?? ""}T00:00:00`);
          if (!eventDate) {
            return false;
          }
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return eventDate >= today;
        })
        .sort((left, right) => {
          const leftTime = parseSafeDate(`${left.scheduledAt ?? ""}T00:00:00`)?.getTime() ?? 0;
          const rightTime = parseSafeDate(`${right.scheduledAt ?? ""}T00:00:00`)?.getTime() ?? 0;
          return leftTime - rightTime;
        }),
    [schedules],
  );

  const calendarDays = useMemo(() => buildCalendarDays(currentDate), [currentDate]);

  const getEventsForDate = (date: Date): DefenseSchedule[] => {
    const key = getDateKey(date.toISOString());
    return key ? schedulesByDay.get(key) ?? [] : [];
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((previous) => {
      const next = new Date(previous);
      next.setMonth(previous.getMonth() + (direction === "next" ? 1 : -1));
      return next;
    });
  };

  const handleScheduleClick = (schedule: DefenseSchedule) => {
    const eventDate = parseSafeDate(`${schedule.scheduledAt ?? ""}T00:00:00`);
    if (!eventDate) {
      return;
    }
    setCurrentDate(new Date(eventDate.getFullYear(), eventDate.getMonth(), 1));
  };

  const handleDateClick = (date: Date) => {
    const eventsForDate = getEventsForDate(date);
    if (eventsForDate.length > 0) {
      setSelectedSchedulesForPopup(eventsForDate);
      setShowEventPopup(true);
    }
  };

  if (loading) {
    return (
      <div className="sch-page">
        <style>
          {`
            .sch-page {
              max-width: 1200px;
              margin: 0 auto;
              padding: 32px;
              font-family: "Be Vietnam Pro", "Segoe UI", Tahoma, sans-serif;
            }
            .sch-card {
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 16px;
            }
            .sch-loading-card {
              padding: 42px;
              text-align: center;
              color: #374151;
              font-size: 16px;
              font-weight: 500;
            }
          `}
        </style>
        <section className="sch-card sch-loading-card">{loadingMessage}</section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sch-page">
        <style>
          {`
            .sch-page {
              max-width: 1200px;
              margin: 0 auto;
              padding: 32px;
              font-family: "Be Vietnam Pro", "Segoe UI", Tahoma, sans-serif;
            }
            .sch-card {
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 16px;
            }
            .sch-error-card {
              padding: 42px;
              background: #fff7ed;
              border-color: #fdba74;
              color: #9a3412;
              font-size: 15px;
              line-height: 1.6;
            }
          `}
        </style>
        <section className="sch-card sch-error-card">{error}</section>
      </div>
    );
  }

  if (hasCommitteeAccess !== true) {
    const accessMessage =
      councilListLocked === false
        ? "Danh sách hội đồng chưa được chốt. Lịch chấm bảo vệ sẽ chỉ hiện sau khi hội đồng đã khóa."
        : councilListLocked === true
          ? "Giảng viên hiện không thuộc hội đồng nào trong đợt bảo vệ này."
          : "Không xác định được quyền xem lịch hội đồng hiện tại.";

    return (
      <div className="sch-page">
        <style>
          {`
            .sch-page {
              max-width: 1200px;
              margin: 0 auto;
              padding: 32px;
              font-family: "Be Vietnam Pro", "Segoe UI", Tahoma, sans-serif;
            }
            .sch-card {
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 16px;
            }
            .sch-locked-card {
              padding: 28px;
              background: linear-gradient(135deg, #ffffff 0%, #fff7ed 100%);
              border-color: #fdba74;
              box-shadow: 0 14px 36px rgba(15, 23, 42, 0.09);
              color: #9a3412;
            }
            .sch-locked-title {
              margin: 0 0 8px;
              font-size: 18px;
              font-weight: 800;
            }
            .sch-locked-text {
              font-size: 14px;
              line-height: 1.7;
            }
          `}
        </style>
        <section className="sch-card sch-locked-card">
          <div className="sch-locked-title">Lịch hội đồng chưa khả dụng</div>
          <div className="sch-locked-text">{accessMessage}</div>
        </section>
      </div>
    );
  }

  return (
    <div className="sch-page">
      <style>
        {`
          .sch-page {
            max-width: 1200px;
            margin: 0 auto;
            padding: 32px;
            font-family: "Inter", "Segoe UI", Tahoma, sans-serif;
            color: #111827;
          }
          .sch-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
          }
          .sch-hero {
            padding: 24px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: flex-start;
            flex-wrap: wrap;
            background: linear-gradient(135deg, #ffffff 0%, #fff7ed 100%);
          }
          .sch-title {
            margin: 0;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 30px;
            font-weight: 700;
            color: #111827;
          }
          .sch-subtitle {
            margin: 10px 0 0;
            color: #4b5563;
            font-size: 15px;
            line-height: 1.6;
          }
          .sch-hero-meta {
            display: grid;
            gap: 10px;
            min-width: 320px;
          }
          .sch-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            border: 1px solid #f37021;
            background: #fff7ed;
            color: #9a3412;
            border-radius: 999px;
            padding: 8px 14px;
            font-size: 13px;
            font-weight: 700;
          }
          .sch-pill--soft {
            border-color: #d1d5db;
            background: #f9fafb;
            color: #374151;
            font-weight: 600;
          }
          .sch-layout {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 20px;
          }
          .sch-calendar-card {
            padding: 24px;
          }
          .sch-calendar-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
          }
          .sch-month-title {
            margin: 0;
            font-size: 22px;
            font-weight: 700;
            color: #111827;
            text-transform: capitalize;
          }
          .sch-nav-btn {
            height: 36px;
            width: 36px;
            border-radius: 8px;
            border: 1px solid #f37021;
            background: #f37021;
            color: #ffffff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .sch-nav-btn:hover {
            background: #ea580c;
            border-color: #ea580c;
          }
          .sch-week-row,
          .sch-grid {
            display: grid;
            grid-template-columns: repeat(7, minmax(0, 1fr));
            gap: 8px;
          }
          .sch-week-cell {
            text-align: center;
            font-size: 13px;
            font-weight: 700;
            color: #6b7280;
            padding: 6px 0;
          }
          .sch-day {
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            min-height: 90px;
            padding: 8px;
            background: #ffffff;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            gap: 6px;
            position: relative;
            align-items: flex-start;
          }
          .sch-day.empty {
            border-color: transparent;
            background: transparent;
            cursor: default;
          }
          .sch-day.has-event {
            background: #f0fdf4;
            border-color: #86efac;
          }
          .sch-day.is-today {
            background: #fff7ed;
            border-color: #fdba74;
          }
          .sch-day:hover:not(.empty) {
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
            transform: translateY(-1px);
          }
          .sch-day-number {
            font-size: 14px;
            font-weight: 700;
            color: #1f2937;
            align-self: center;
          }
          .sch-day.is-today .sch-day-number {
            color: #c2410c;
          }
          .sch-day-dot {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 7px;
            height: 7px;
            border-radius: 999px;
            background: #22c55e;
          }
          .sch-day-committees {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-top: 2px;
            width: 100%;
          }
          .sch-day-committee-chip {
            font-size: 11px;
            font-weight: 600;
            padding: 3px 6px;
            border-radius: 4px;
            background: rgba(255,255,255,0.8);
            color: #166534;
            border: 1px solid #bbf7d0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: left;
            width: 100%;
            display: block;
          }
          .sch-side-stack {
            display: grid;
            gap: 14px;
            align-content: start;
          }
          .sch-note-card {
            padding: 16px;
            background: #f9fafb;
          }
          .sch-note-head {
            margin: 0 0 8px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 15px;
            font-weight: 700;
            color: #111827;
          }
          .sch-note-text {
            margin: 0;
            font-size: 13px;
            color: #4b5563;
            line-height: 1.55;
          }
          .sch-upcoming-card {
            padding: 18px;
          }
          .sch-section-title {
            margin: 0 0 14px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 19px;
            font-weight: 700;
            color: #111827;
          }
          .sch-event-list {
            display: grid;
            gap: 12px;
            max-height: 650px;
            overflow-y: auto;
            padding-right: 4px;
          }
          .sch-event-card {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .sch-event-card:hover {
            box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
            transform: translateY(-1px);
          }
          .sch-event-badge {
            display: inline-flex;
            align-items: center;
            border-radius: 999px;
            padding: 4px 9px;
            font-size: 11px;
            font-weight: 700;
            margin-bottom: 8px;
          }
          .sch-event-title-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }
          .sch-event-title {
            margin: 0;
            font-size: 15px;
            font-weight: 700;
            color: #111827;
          }
          .sch-event-hint {
            font-size: 11px;
            font-weight: 700;
          }
          .sch-event-description {
            margin: 8px 0 10px;
            font-size: 13px;
            line-height: 1.55;
            color: #374151;
          }
          .sch-event-meta {
            display: grid;
            gap: 6px;
          }
          .sch-event-meta-item {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            font-size: 13px;
            color: #4b5563;
          }
          .sch-event-participants {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px dashed #d1d5db;
            font-size: 12px;
            color: #374151;
          }
          .sch-empty {
            border: 1px dashed #cbd5e1;
            border-radius: 12px;
            padding: 14px;
            background: #f8fafc;
            color: #64748b;
            font-size: 13px;
            line-height: 1.5;
          }
          .sch-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.42);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1100;
            padding: 16px;
          }
          .sch-modal {
            width: min(760px, 100%);
            max-height: 84vh;
            overflow-y: auto;
            background: #ffffff;
            border-radius: 16px;
            border: 1px solid #e5e7eb;
            padding: 20px;
          }
          .sch-modal-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 14px;
          }
          .sch-modal-title {
            margin: 0;
            font-size: 22px;
            font-weight: 700;
            color: #111827;
          }
          .sch-close-btn {
            border: 1px solid #d1d5db;
            border-radius: 8px;
            background: #ffffff;
            color: #4b5563;
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
            width: 32px;
            height: 32px;
          }
          .sch-close-btn:hover {
            background: #f3f4f6;
            color: #111827;
          }
          .sch-modal-list {
            display: grid;
            gap: 12px;
          }
          @media (max-width: 1100px) {
            .sch-page {
              padding: 20px;
            }
            .sch-layout {
              grid-template-columns: 1fr;
            }
            .sch-hero-meta {
              min-width: 100%;
            }
          }
          @media (max-width: 760px) {
            .sch-page {
              padding: 14px;
            }
            .sch-title {
              font-size: 24px;
            }
            .sch-calendar-card,
            .sch-upcoming-card {
              padding: 14px;
            }
            .sch-month-title {
              font-size: 18px;
            }
            .sch-day {
              min-height: 66px;
              padding: 6px;
            }
          }
        `}
      </style>

      <section className="sch-card sch-hero">
        <div>
          <h1 className="sch-title">
            <Calendar size={30} color="#f37021" />
            Lịch tham gia hội đồng
          </h1>
          <p className="sch-subtitle">
            Quản lý ngày bảo vệ và các thông tin cơ bản về hội đồng chấm mà bạn tham gia.
          </p>
        </div>

        <div className="sch-hero-meta">
          <div className="sch-pill">
            <Calendar size={14} />
            {periodLabel}
          </div>
          <div className="sch-pill sch-pill--soft">
            <Bell size={14} />
            {loadingMessage || "Cập nhật dữ liệu hội đồng trực tiếp từ snapshot."}
          </div>
        </div>
      </section>

      <div className="sch-layout">
        <section className="sch-card sch-calendar-card">
          <div className="sch-calendar-head">
            <button type="button" onClick={() => navigateMonth("prev")} className="sch-nav-btn" aria-label="Tháng trước">
              <ChevronLeft size={20} />
            </button>

            <h2 className="sch-month-title">{formatMonthLabel(currentDate)}</h2>

            <button type="button" onClick={() => navigateMonth("next")} className="sch-nav-btn" aria-label="Tháng sau">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="sch-week-row">
            {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((day) => (
              <div key={day} className="sch-week-cell">
                {day}
              </div>
            ))}
          </div>

          <div className="sch-grid">
            {calendarDays.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="sch-day empty" />;
              }

              const dateKey = getDateKey(date.toISOString());
              const daySchedules = dateKey ? schedulesByDay.get(dateKey) ?? [] : [];
              const dayHasEvent = daySchedules.length > 0;
              const isToday = date.toDateString() === new Date().toDateString();

              // Get unique committees for this day
              const committeesToday = Array.from(new Set(daySchedules.map((s) => s.committeeCode)));

              const dayClasses = [
                "sch-day",
                dayHasEvent ? "has-event" : "",
                isToday ? "is-today" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  className={dayClasses}
                  onClick={() => handleDateClick(date)}
                >
                  <span className="sch-day-number">{date.getDate()}</span>
                  {dayHasEvent && <span className="sch-day-dot" />}
                  
                  {dayHasEvent && (
                    <div className="sch-day-committees">
                      {committeesToday.map(code => (
                        <div key={code} className="sch-day-committee-chip">
                          {code}
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="sch-side-stack">
          <section className="sch-card sch-note-card">
            <h3 className="sch-note-head">
              <Info size={16} color="#f37021" />
              Ghi chú nhỏ
            </h3>
            <p className="sch-note-text">
              Lịch hiển thị danh sách các hội đồng mà bạn được phân công. Các ngày được tô xanh là ngày có diễn ra buổi bảo vệ.
            </p>
          </section>

          <section className="sch-card sch-upcoming-card">
            <h2 className="sch-section-title">
              <Clock3 size={20} color="#f37021" />
              Sự kiện sắp tới
            </h2>

            <div className="sch-event-list">
              {Array.from(new Set(upcomingSchedules.map(s => s.committeeCode))).map((committeeCode) => {
                const schedule = upcomingSchedules.find(s => s.committeeCode === committeeCode)!;
                const theme = getScheduleTheme(schedule.status);

                return (
                  <article
                    key={schedule.id}
                    className="sch-event-card"
                    style={{ background: theme.bg, borderColor: theme.border }}
                    onClick={() => handleScheduleClick(schedule)}
                  >
                    <span className="sch-event-badge" style={{ background: theme.border, color: "#ffffff" }}>
                      {getStatusText(schedule.status)}
                    </span>

                    <div className="sch-event-title-row">
                      <h3 className="sch-event-title">Hội đồng {schedule.committeeCode}</h3>
                      <span className="sch-event-hint" style={{ color: theme.text }}>
                        Nhấn để xem
                      </span>
                    </div>

                    <p className="sch-event-description">
                      {schedule.committeeName}
                    </p>

                    <div className="sch-event-meta">
                      <div className="sch-event-meta-item">
                        <Calendar size={14} />
                        {formatDate(schedule.scheduledAt)}
                      </div>
                      <div className="sch-event-meta-item">
                        <Clock3 size={14} />
                        {formatSession(schedule.session)}
                      </div>
                      <div className="sch-event-meta-item">
                        <MapPin size={14} />
                        {schedule.room}
                      </div>
                    </div>

                    <div className="sch-event-participants">
                      <div className="sch-event-meta-item" style={{ marginBottom: 4 }}>
                        <UsersRound size={14} />
                        Vai trò của bạn:
                      </div>
                      <div>
                        {schedule.lecturerRole}
                      </div>
                    </div>
                  </article>
                );
              })}

              {upcomingSchedules.length === 0 && (
                <div className="sch-empty">{loadingMessage || "Chưa có sự kiện lịch sắp tới."}</div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {showEventPopup && selectedSchedulesForPopup.length > 0 && (
        <div className="sch-overlay" onClick={() => {
          setShowEventPopup(false);
          setSelectedSchedulesForPopup([]);
        }} role="presentation">
          <div
            className="sch-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết lịch hội đồng"
          >
            <div className="sch-modal-head">
              <h2 className="sch-modal-title">Lịch hội đồng ngày {formatDate(selectedSchedulesForPopup[0].scheduledAt)}</h2>
              <button
                type="button"
                onClick={() => {
                  setShowEventPopup(false);
                  setSelectedSchedulesForPopup([]);
                }}
                className="sch-close-btn"
                aria-label="Đóng"
              >
                x
              </button>
            </div>

            <div className="sch-modal-list">
              {Array.from(new Set(selectedSchedulesForPopup.map(s => s.committeeCode))).map((committeeCode) => {
                const schedule = selectedSchedulesForPopup.find(s => s.committeeCode === committeeCode)!;
                const theme = getScheduleTheme(schedule.status);

                return (
                  <article
                    key={schedule.id}
                    className="sch-event-card"
                    style={{ background: theme.bg, borderColor: theme.border }}
                  >
                    <div className="sch-event-title-row">
                      <h3 className="sch-event-title">Hội đồng {schedule.committeeCode}</h3>
                      <span className="sch-event-badge" style={{ background: theme.border, color: "#ffffff", margin: 0 }}>
                        {getStatusText(schedule.status)}
                      </span>
                    </div>

                    <p className="sch-event-description">
                      {schedule.committeeName}
                    </p>

                    <div className="sch-event-meta">
                      <div className="sch-event-meta-item">
                        <Clock3 size={14} />
                        {formatSession(schedule.session)}
                      </div>
                      <div className="sch-event-meta-item">
                        <MapPin size={14} />
                        {schedule.room}
                      </div>
                    </div>

                    <div className="sch-event-participants">
                      <div className="sch-event-meta-item" style={{ marginBottom: 4 }}>
                        <UsersRound size={14} />
                        Vai trò của bạn:
                      </div>
                      <div>
                        {schedule.lecturerRole}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerSchedule;
