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
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
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
  if (value === true) return true;
  if (value === false) return false;
  return null;
};

const normalizeTime = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const matched = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!matched) return null;
  const hour = Number(matched[1]);
  const minute = Number(matched[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const inferSessionFromTime = (timeValue: string | null): SessionCode | null => {
  if (!timeValue) return null;
  const hour = Number(timeValue.split(":")[0]);
  if (!Number.isFinite(hour)) return null;
  return hour >= 12 ? "AFTERNOON" : "MORNING";
};

const normalizeSession = (value: unknown, fallback: SessionCode = "MORNING"): SessionCode => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized.includes("AFTER") || normalized.includes("PM") || normalized.includes("CHIỀU") || normalized.includes("CHIEU")) {
    return "AFTERNOON";
  }
  if (normalized.includes("MORNING") || normalized.includes("AM") || normalized.includes("SÁNG") || normalized.includes("SANG")) {
    return "MORNING";
  }
  return fallback;
};

const mergeDateAndTime = (dateIso: string | null, timeValue: string | null): string | null => {
  if (!dateIso) return null;
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return null;
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
  if (normalized.includes("CHAIR") || normalized.includes("CHU TICH") || normalized === "CT") return "Chủ tịch hội đồng";
  if (normalized.includes("SECRETARY") || normalized.includes("THU KY") || normalized === "UVTK" || normalized === "TK") return "Ủy viên thư ký hội đồng";
  if (normalized.includes("REVIEW") || normalized.includes("PHAN BIEN") || normalized === "UVPB" || normalized === "PB") return "Ủy viên phản biện hội đồng";
  if (normalized.includes("SUPERVISOR") || normalized.includes("GVHD")) return "Giảng viên hướng dẫn";
  return "Thành viên hội đồng";
};

const resolveLecturerRole = (members: Array<Record<string, unknown>>, userCode: string | null): string => {
  if (!userCode) return "Thành viên hội đồng";
  const normalizedUserCode = userCode.trim().toUpperCase();
  const matched = members.find((member) => {
    const memberCode = toText(pickCaseInsensitiveValue(member, ["lecturerCode", "LecturerCode", "code", "Code"], ""), "").toUpperCase();
    return memberCode === normalizedUserCode;
  });
  if (!matched) return "Thành viên hội đồng";
  const roleRaw = pickCaseInsensitiveValue(matched, ["role", "Role", "roleCode", "RoleCode"], "");
  return mapRoleLabel(roleRaw);
};

const toScheduleStatus = (rawStatus: string, isLocked: boolean, scheduledAt: string | null): ScheduleStatus => {
  const normalized = rawStatus.toUpperCase();
  if (normalized.includes("CANCEL")) return "cancelled";
  if (isLocked || normalized.includes("LOCK") || normalized.includes("FINAL")) return "locked";
  if (normalized.includes("COMPLETE") || normalized.includes("DONE")) return "completed";
  if (scheduledAt) {
    const scheduleTime = new Date(scheduledAt).getTime();
    if (Number.isFinite(scheduleTime) && scheduleTime < Date.now()) return "completed";
  }
  return "scheduled";
};

const extractCommitteeRowsFromSnapshot = (snapshot: Record<string, unknown>): Array<Record<string, unknown>> => {
  const committeesSource = pickCaseInsensitiveValue(snapshot, ["committees", "Committees"], []);
  if (Array.isArray(committeesSource)) return toRecordArray(committeesSource);
  const committeesContainer = toRecord(committeesSource) ?? {};
  return toRecordArray(pickCaseInsensitiveValue(committeesContainer, ["committees", "Committees", "items", "Items"], []));
};

const mapSnapshotToSchedules = (snapshot: Record<string, unknown>, userCode: string | null): DefenseSchedule[] => {
  const committeeItems = extractCommitteeRowsFromSnapshot(snapshot);
  const scoringObject = toRecord(pickCaseInsensitiveValue(snapshot, ["scoring", "Scoring"], {})) ?? {};
  const matrixItems = toRecordArray(pickCaseInsensitiveValue(scoringObject, ["matrix", "Matrix"], []));

  const committeeCodeMap = new Map<string, CommitteeView>();
  const committeeNumericMap = new Map<number, CommitteeView>();

  committeeItems.forEach((item, index) => {
    const numericId = toNumberOrNull(pickCaseInsensitiveValue(item, ["committeeId", "CommitteeId", "id", "Id"], null)) ?? index + 1;
    const committeeCode = toText(pickCaseInsensitiveValue(item, ["committeeCode", "CommitteeCode", "code", "Code"], `HD${numericId}`), `HD${numericId}`);
    const committeeName = toText(pickCaseInsensitiveValue(item, ["name", "Name", "committeeName", "CommitteeName"], committeeCode), committeeCode);
    const room = toText(pickCaseInsensitiveValue(item, ["room", "Room", "location", "Location"], ""), "-");
    const startTime = normalizeTime(pickCaseInsensitiveValue(item, ["startTime", "StartTime", "slotStart", "SlotStart"], null));
    const endTime = normalizeTime(pickCaseInsensitiveValue(item, ["endTime", "EndTime", "slotEnd", "SlotEnd"], null));
    const committeeDate = toIsoDateOrNull(pickCaseInsensitiveValue(item, ["defenseDate", "DefenseDate", "date", "Date", "scheduledAt", "ScheduledAt"], null));
    const session = normalizeSession(pickCaseInsensitiveValue(item, ["session", "Session", "sessionCode", "SessionCode"], null), inferSessionFromTime(startTime) ?? "MORNING");
    const statusRaw = toText(pickCaseInsensitiveValue(item, ["status", "Status"], ""), "");
    const members = toRecordArray(pickCaseInsensitiveValue(item, ["members", "Members"], []));

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
    const committeeCodeFromRow = toText(pickCaseInsensitiveValue(item, ["committeeCode", "CommitteeCode"], ""), "");
    const committeeIdFromRow = toNumberOrNull(pickCaseInsensitiveValue(item, ["committeeId", "CommitteeId"], null));
    const matchedCommittee = (committeeCodeFromRow ? committeeCodeMap.get(committeeCodeFromRow.toUpperCase()) : undefined) ?? (committeeIdFromRow != null ? committeeNumericMap.get(committeeIdFromRow) : undefined);
    const assignmentId = toNumberOrNull(pickCaseInsensitiveValue(item, ["assignmentId", "AssignmentId"], null));
    const startTime = normalizeTime(pickCaseInsensitiveValue(item, ["startTime", "StartTime", "slotStart", "SlotStart"], null)) ?? matchedCommittee?.startTime ?? null;
    const endTime = normalizeTime(pickCaseInsensitiveValue(item, ["endTime", "EndTime", "slotEnd", "SlotEnd"], null)) ?? matchedCommittee?.endTime ?? null;
    const rowDate = toIsoDateOrNull(pickCaseInsensitiveValue(item, ["scheduledAt", "ScheduledAt", "defenseDate", "DefenseDate"], null));
    const baseDate = rowDate ?? matchedCommittee?.scheduledAt ?? null;
    const scheduledAt = mergeDateAndTime(baseDate, startTime) ?? baseDate;
    const session = normalizeSession(pickCaseInsensitiveValue(item, ["session", "Session", "sessionCode", "SessionCode"], null), inferSessionFromTime(startTime) ?? matchedCommittee?.session ?? "MORNING");
    const topicTitle = toText(pickCaseInsensitiveValue(item, ["topicTitle", "TopicTitle", "title", "Title"], ""), "");
    const topicFallback = toText(pickCaseInsensitiveValue(item, ["topicCode", "TopicCode", "assignmentCode", "AssignmentCode"], "Đề tài chưa cập nhật"), "Đề tài chưa cập nhật");
    const statusRaw = toText(pickCaseInsensitiveValue(item, ["status", "Status"], matchedCommittee?.statusRaw ?? ""), "");
    const status = toScheduleStatus(statusRaw, Boolean(pickCaseInsensitiveValue(item, ["isLocked", "IsLocked"], false)), scheduledAt);
    const committeeCode = matchedCommittee?.committeeCode || committeeCodeFromRow || `HD-${committeeIdFromRow ?? index + 1}`;

    scheduleRows.push({
      id: `${committeeCode}-${assignmentId ?? index + 1}`,
      assignmentId,
      topicTitle: topicTitle || topicFallback,
      studentCode: toText(pickCaseInsensitiveValue(item, ["studentCode", "StudentCode"], "-"), "-"),
      studentName: toText(pickCaseInsensitiveValue(item, ["studentName", "StudentName"], "Chưa cập nhật"), "Chưa cập nhật"),
      committeeCode,
      committeeName: matchedCommittee?.committeeName || committeeCode,
      room: toText(pickCaseInsensitiveValue(item, ["room", "Room"], matchedCommittee?.room ?? ""), "-") || matchedCommittee?.room || "-",
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
    return leftTime !== rightTime ? leftTime - rightTime : (left.startTime ?? "").localeCompare(right.startTime ?? "");
  });
};

const formatDate = (value: string | null): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString("vi-VN");
};

const formatMonthLabel = (date: Date): string => {
  const label = date.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatSession = (session: SessionCode): string => session === "MORNING" ? "Buổi sáng" : "Buổi chiều";

const getStatusText = (status: ScheduleStatus): string => {
  switch (status) {
    case "scheduled": return "Đã lên lịch";
    case "completed": return "Đã hoàn thành";
    case "locked": return "Đã khóa";
    case "cancelled": return "Đã hủy";
    default: return "Không xác định";
  }
};

const getScheduleTheme = (status: ScheduleStatus) => {
  switch (status) {
    case "scheduled": return { bg: "#FFF7ED", border: "#F37021", text: "#9A3412" };
    case "completed": return { bg: "#DCFCE7", border: "#22C55E", text: "#166534" };
    case "locked": return { bg: "#DBEAFE", border: "#3B82F6", text: "#1E40AF" };
    case "cancelled": return { bg: "#FEE2E2", border: "#EF4444", text: "#991B1B" };
    default: return { bg: "#F3F4F6", border: "#9CA3AF", text: "#374151" };
  }
};

const getDateKey = (value: string | null): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};

const buildCalendarDays = (date: Date): Array<Date | null> => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const result: Array<Date | null> = [];
  for (let i = 0; i < firstDay.getDay(); i++) result.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) result.push(new Date(year, month, d));
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
  const [periodId, setPeriodId] = useState<number | null>(() => normalizeDefensePeriodId(searchParams.get("periodId")) ?? getActiveDefensePeriodId());

  const hydrateSchedule = async () => {
    setLoading(true);
    setLoadingMessage("Đang đồng bộ lịch từ snapshot...");
    setError(null);
    try {
      const endpoint = periodId ? `/defense-periods/${periodId}/lecturer/snapshot` : "/lecturer-defense/current/snapshot";
      const response = await fetchData<Record<string, unknown>>(endpoint);
      const envelopeResponse = response as unknown as ApiResponse<Record<string, unknown>>;
      if (!readEnvelopeSuccess(envelopeResponse)) {
        const apiError = readEnvelopeErrorMessages(envelopeResponse)[0] || readEnvelopeMessage(envelopeResponse) || "Không tải được lịch từ API.";
        setLoadingMessage(apiError);
        setError(apiError);
        return;
      }
      const rootData = toRecord(readEnvelopeData(envelopeResponse)) || toRecord(response.data) || {};
      const periodObject = toRecord(pickCaseInsensitiveValue(rootData, ["period", "Period", "currentPeriod", "CurrentPeriod"], null));
      const resolvedPeriodId = toNumberOrNull(periodObject ? pickCaseInsensitiveValue(periodObject, ["periodId", "PeriodId", "id", "Id"], null) : periodId);
      if (resolvedPeriodId != null) {
        setActiveDefensePeriodId(resolvedPeriodId);
        if (periodId == null) setPeriodId(resolvedPeriodId);
      }
      setPeriodLabel(periodObject ? toText(pickCaseInsensitiveValue(periodObject, ["name", "Name"], resolvedPeriodId ? `Đợt #${resolvedPeriodId}` : "Đợt đang hoạt động")) : (resolvedPeriodId ? `Đợt #${resolvedPeriodId}` : "Đợt đang hoạt động"));
      const snapshot = toRecord(pickCaseInsensitiveValue(rootData, ["snapshot", "Snapshot"], rootData)) || {};
      const committeeRows = extractCommitteeRowsFromSnapshot(snapshot);
      const lockFlag = toBooleanOrNull(pickCaseInsensitiveValue(snapshot, ["councilListLocked", "CouncilListLocked"], pickCaseInsensitiveValue(rootData, ["councilListLocked", "CouncilListLocked"], null)));
      setCouncilListLocked(lockFlag);
      setHasCommitteeAccess(toBooleanOrNull(pickCaseInsensitiveValue(snapshot, ["hasCommitteeAccess", "HasCommitteeAccess"], pickCaseInsensitiveValue(rootData, ["hasCommitteeAccess", "HasCommitteeAccess"], null))) ?? (lockFlag === true && committeeRows.length > 0));
      setSchedules(mapSnapshotToSchedules(snapshot, auth.user?.userCode ?? null));
    } catch (e) {
      const msg = e instanceof FetchDataError ? e.message : "Lỗi tải lịch.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void hydrateSchedule(); }, [auth.user?.userCode, periodId]);

  const schedulesByDay = useMemo(() => {
    const map = new Map<string, DefenseSchedule[]>();
    schedules.forEach(s => {
      const k = getDateKey(s.scheduledAt);
      if (!k) return;
      const rows = map.get(k) ?? [];
      rows.push(s);
      rows.sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime());
      map.set(k, rows);
    });
    return map;
  }, [schedules]);

  const upcomingSchedules = useMemo(() => schedules.filter(s => {
    const d = parseSafeDate(`${s.scheduledAt ?? ""}T00:00:00`);
    if (!d) return false;
    const t = new Date(); t.setHours(0,0,0,0);
    return d >= t;
  }).sort((a,b) => (parseSafeDate(`${a.scheduledAt ?? ""}T00:00:00`)?.getTime() ?? 0) - (parseSafeDate(`${b.scheduledAt ?? ""}T00:00:00`)?.getTime() ?? 0)), [schedules]);

  const calendarDays = useMemo(() => buildCalendarDays(currentDate), [currentDate]);
  const navigateMonth = (dir: "prev" | "next") => setCurrentDate(prev => {
    const n = new Date(prev); n.setMonth(prev.getMonth() + (dir === "next" ? 1 : -1)); return n;
  });
  const handleDateClick = (d: Date) => {
    const k = getDateKey(d.toISOString());
    const evts = k ? schedulesByDay.get(k) ?? [] : [];
    if (evts.length > 0) { setSelectedSchedulesForPopup(evts); setShowEventPopup(true); }
  };

  if (loading) return (
    <div className="dashboard-root" style={{ height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
      <Loader2 className="spin" size={48} color="#f37021" />
      <p style={{ color: '#64748b', fontWeight: 500 }}>{loadingMessage}</p>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error || hasCommitteeAccess !== true) {
    const msg = error || (councilListLocked === false ? "Danh sách hội đồng chưa được chốt. Lịch sẽ hiện sau khi hội đồng khóa." : "Giảng viên không thuộc hội đồng nào trong đợt này.");
    return (
      <div className="dashboard-root" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '24px', padding: '40px', textAlign: 'center', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
          <AlertTriangle size={48} color="#f37021" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#9a3412', marginBottom: '12px' }}>Thông báo quan trọng</h2>
          <p style={{ color: '#c2410c', fontSize: '16px', lineHeight: 1.6 }}>{msg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-root" style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      <style>{`
        :root {
          --primary: #F37021;
          --primary-light: #fff7ed;
          --secondary: #1e3a8a;
          --text-main: #0f172a;
          --text-muted: #64748b;
          --radius-lg: 24px;
          --radius-md: 16px;
          --shadow-md: 0 10px 25px -5px rgba(0,0,0,0.05);
        }
        .sch-calendar { background: white; border-radius: var(--radius-lg); padding: 32px; border: 1px solid #e2e8f0; box-shadow: var(--shadow-md); }
        .sch-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 12px; margin-top: 20px; }
        .sch-day { border: 1px solid #f1f5f9; border-radius: 12px; min-height: 110px; padding: 12px; transition: all 0.2s; display: flex; flex-direction: column; gap: 8px; cursor: pointer; text-align: left; background: white; width: 100%; border: 1px solid #e2e8f0; }
        .sch-day:hover:not(.empty) { transform: translateY(-3px); box-shadow: 0 12px 20px -5px rgba(0,0,0,0.1); border-color: var(--primary); }
        .sch-day.empty { border: none; background: transparent; cursor: default; }
        .sch-day.has-event { background: #f0fdf4; border-color: #86efac; }
        .sch-day.is-today { background: var(--primary-light); border-color: #fdba74; }
        .sch-day-num { font-size: 16px; font-weight: 800; color: var(--text-main); }
        .sch-event-chip { font-size: 11px; font-weight: 700; background: white; color: #166534; border: 1px solid #bbf7d0; padding: 3px 6px; borderRadius: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sch-upcoming-card { background: white; border-radius: var(--radius-md); border: 1px solid #e2e8f0; padding: 20px; transition: all 0.3s; cursor: pointer; }
        .sch-upcoming-card:hover { border-color: var(--primary); transform: translateX(4px); box-shadow: var(--shadow-md); }
        .sch-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(8px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .sch-modal { background: white; border-radius: 24px; width: 100%; max-width: 600px; max-height: 80vh; overflow-y: auto; padding: 32px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
        .spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", borderRadius: "24px", padding: "40px", color: "white", marginBottom: "32px", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(243, 112, 33, 0.2)", color: "#fb923c", padding: "6px 14px", borderRadius: "99px", fontSize: "13px", fontWeight: "700", marginBottom: "16px", border: "1px solid rgba(243, 112, 33, 0.3)" }}>
            <ShieldCheck size={14} /> LỊCH CÔNG TÁC HỘI ĐỒNG
          </div>
          <h1 style={{ fontSize: "32px", fontWeight: "900", margin: "0 0 12px 0", letterSpacing: "-0.02em" }}>Quản lý <span style={{ color: '#f37021' }}>Lịch bảo vệ</span></h1>
          <p style={{ fontSize: "16px", color: "#cbd5e1", maxWidth: "600px", lineHeight: "1.6" }}>
            Theo dõi thời gian, địa điểm và danh sách các hội đồng mà bạn tham gia chấm bảo vệ khóa luận.
          </p>
          <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
            <button onClick={hydrateSchedule} style={{ background: 'white', color: '#1e293b', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={16} /> Làm mới lịch
            </button>
            <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '10px 20px', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} /> {periodLabel}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "32px", alignItems: "start" }}>
        {/* Calendar Section */}
        <section className="sch-calendar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0 }}>{formatMonthLabel(currentDate)}</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => navigateMonth("prev")} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft size={20} />
              </button>
              <button onClick={() => navigateMonth("next")} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px', textAlign: 'center', fontWeight: 700, color: '#94a3b8', fontSize: '13px', textTransform: 'uppercase', marginBottom: '12px' }}>
            {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map(d => <div key={d}>{d}</div>)}
          </div>

          <div className="sch-grid">
            {calendarDays.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} className="sch-day empty" />;
              const k = getDateKey(date.toISOString());
              const evts = k ? schedulesByDay.get(k) ?? [] : [];
              const hasEvt = evts.length > 0;
              const isToday = date.toDateString() === new Date().toDateString();
              const uniqueCodes = Array.from(new Set(evts.map(e => e.committeeCode)));

              return (
                <button key={date.toISOString()} className={`sch-day ${hasEvt ? 'has-event' : ''} ${isToday ? 'is-today' : ''}`} onClick={() => handleDateClick(date)}>
                  <span className="sch-day-num">{date.getDate()}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                    {uniqueCodes.map(c => <div key={c} className="sch-event-chip">{c}</div>)}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Sidebar */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ background: '#f8fafc', borderRadius: '24px', padding: '24px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={18} color="#f37021" /> Ghi chú
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: 1.6 }}>
              Lịch hiển thị các phiên bảo vệ mà bạn là thành viên hội đồng. Nhấn vào từng ngày hoặc thẻ bên dưới để xem chi tiết địa điểm và vai trò.
            </p>
          </div>

          <div>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock3 size={24} color="#f37021" /> Sắp diễn ra
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '600px', overflowY: 'auto', paddingRight: '8px' }}>
              {upcomingSchedules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '24px', border: '1px dashed #cbd5e1', color: '#94a3b8' }}>
                  Không có lịch sắp tới
                </div>
              ) : (
                upcomingSchedules.map(s => {
                  const theme = getScheduleTheme(s.status);
                  return (
                    <div key={s.id} className="sch-upcoming-card" onClick={() => handleDateClick(new Date(s.scheduledAt!))}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ background: theme.bg, color: theme.text, padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 800, border: `1px solid ${theme.border}` }}>
                          {getStatusText(s.status)}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>{formatDate(s.scheduledAt)}</span>
                      </div>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 800 }}>Hội đồng {s.committeeCode}</h4>
                      <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.committeeName}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
                          <MapPin size={14} /> {s.room}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
                          <Clock3 size={14} /> {formatSession(s.session)}
                        </div>
                      </div>
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0', fontSize: '12px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UsersRound size={14} color="#f37021" /> {s.lecturerRole}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Detail Modal */}
      {showEventPopup && (
        <div className="sch-modal-overlay">
          <div className="sch-modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900 }}>Chi tiết lịch bảo vệ</h3>
              <button onClick={() => setShowEventPopup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={24} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {selectedSchedulesForPopup.map(s => {
                const theme = getScheduleTheme(s.status);
                return (
                  <div key={s.id} style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: '20px', padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Hội đồng {s.committeeCode}</h4>
                      <span style={{ background: theme.border, color: 'white', padding: '4px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 700 }}>
                        {getStatusText(s.status)}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 20px 0', fontSize: '14px', fontWeight: 600, color: '#475569' }}>{s.committeeName}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Địa điểm</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700 }}>
                          <MapPin size={16} color="#f37021" /> {s.room}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Thời gian</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700 }}>
                          <Clock3 size={16} color="#f37021" /> {formatSession(s.session)}
                        </div>
                      </div>
                    </div>
                    <div style={{ background: 'white', borderRadius: '12px', padding: '16px', border: '1px solid rgba(0,0,0,0.05)' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Vai trò của bạn</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                        <UsersRound size={18} color="#f37021" /> {s.lecturerRole}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: '32px', textAlign: 'right' }}>
              <button onClick={() => setShowEventPopup(false)} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '12px 32px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerSchedule;
