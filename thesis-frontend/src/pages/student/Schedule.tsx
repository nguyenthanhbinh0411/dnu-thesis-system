import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  MapPin,
  Users,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { fetchData } from "../../api/fetchData";
import type { ApiResponse } from "../../types/api";
import {
  pickCaseInsensitiveValue,
  readEnvelopeData,
  readEnvelopeMessage,
  readEnvelopeSuccess,
} from "../../utils/api-envelope";
import {
  extractDefensePeriodId,
  getActiveDefensePeriodId,
  normalizeDefensePeriodId,
  setActiveDefensePeriodId,
} from "../../utils/defensePeriod";

interface ScheduleEvent {
  id: number;
  title: string;
  date: string;
  time: string;
  location: string;
  type: "defense" | "meeting" | "presentation";
  description: string;
  participants?: string[];
}

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
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

const toDateOnly = (value: string | null | undefined): string => {
  const text = String(value ?? "").trim();
  if (!text) {
    return new Date().toISOString().slice(0, 10);
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
};

const toTimeLabel = (value: string | null | undefined): string => {
  const text = String(value ?? "").trim();
  if (!text) {
    return "Theo thông báo";
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return "Theo thông báo";
  }

  const timeText = parsed.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return timeText === "00:00" ? "Theo thông báo" : timeText;
};

const normalizeSessionCode = (
  sessionCode: unknown,
  session: unknown,
): "MORNING" | "AFTERNOON" | null => {
  const normalizedCode = String(sessionCode ?? "").trim().toUpperCase();
  if (normalizedCode === "MORNING" || normalizedCode === "AFTERNOON") {
    return normalizedCode;
  }

  const sessionNumber = Number(session);
  if (Number.isFinite(sessionNumber)) {
    return sessionNumber === 1 ? "MORNING" : "AFTERNOON";
  }

  return null;
};

const sessionToLabel = (sessionCode: "MORNING" | "AFTERNOON" | null): string => {
  if (sessionCode === "MORNING") {
    return "Buổi sáng";
  }
  if (sessionCode === "AFTERNOON") {
    return "Buổi chiều";
  }
  return "Theo thông báo";
};

const defaultTimeBySession = (
  sessionCode: "MORNING" | "AFTERNOON" | null,
): string | null => {
  if (sessionCode === "MORNING") {
    return "07:30";
  }
  if (sessionCode === "AFTERNOON") {
    return "13:30";
  }
  return null;
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

const parseNotificationScheduleFallback = (
  notifications: unknown[],
  sessionCode: "MORNING" | "AFTERNOON" | null,
): { committeeCode: string | null; room: string | null; scheduledAt: string | null } | null => {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return null;
  }

  const pattern =
    /Hội đồng\s+([A-Za-z0-9._\/-]+)\s*-\s*[^|]*\|\s*Phòng:\s*([^|]+)\|\s*[^,]+,\s*(\d{2}\/\d{2}\/\d{4})\s*lúc\s*([0-2]?\d:[0-5]\d|Chưa xác định|Đang cập nhật)/i;

  for (const entry of notifications) {
    const row = toRecord(entry);
    if (!row) {
      continue;
    }

    const message = String(
      pickCaseInsensitiveValue(row, ["message", "Message", "body", "Body"], ""),
    )
      .replace(/\s+/g, " ")
      .trim();
    if (!message) {
      continue;
    }

    const matches = message.match(pattern);
    if (!matches) {
      continue;
    }

    const committeeCode = String(matches[1] ?? "").trim() || null;
    const room = String(matches[2] ?? "").trim() || null;
    const dateValue = String(matches[3] ?? "").trim();
    const timeToken = String(matches[4] ?? "").trim();
    const explicitTime = /^([01]?\d|2[0-3]):([0-5]\d)$/.test(timeToken)
      ? timeToken
      : null;
    const fallbackTime = explicitTime ?? defaultTimeBySession(sessionCode);
    const scheduledAt = fallbackTime
      ? buildIsoDateTimeFromVnDate(dateValue, fallbackTime)
      : null;

    return {
      committeeCode,
      room,
      scheduledAt,
    };
  }

  return null;
};

const parseSafeDate = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatEventDate = (value: string): string => {
  const parsed = parseSafeDate(`${value}T00:00:00`);
  if (!parsed) {
    return value;
  }
  return parsed.toLocaleDateString("vi-VN");
};

const formatMonthLabel = (date: Date): string => {
  const monthLabel = date.toLocaleDateString("vi-VN", {
    month: "long",
    year: "numeric",
  });
  return monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
};

const mapSnapshotToEvents = (
  snapshot: Record<string, unknown>,
): ScheduleEvent[] => {
  const events: ScheduleEvent[] = [];
  let nextId = 1;

  const defenseInfo = toRecord(
    pickCaseInsensitiveValue(snapshot, ["defenseInfo", "DefenseInfo"], null),
  );
  const notifications = pickCaseInsensitiveValue<unknown[]>(
    snapshot,
    ["notifications", "Notifications"],
    [],
  );
  const revisionHistory = pickCaseInsensitiveValue<unknown[]>(
    snapshot,
    ["revisionHistory", "RevisionHistory"],
    [],
  );

  if (defenseInfo) {
    const councilListLocked = readBooleanLike(
      pickCaseInsensitiveValue(
        defenseInfo,
        ["councilListLocked", "CouncilListLocked"],
        false,
      ),
      false,
    );
    const studentName = String(
      pickCaseInsensitiveValue(defenseInfo, ["studentName", "StudentName"], "Sinh viên"),
    ).trim();
    const topicTitle = String(
      pickCaseInsensitiveValue(defenseInfo, ["topicTitle", "TopicTitle"], "Đề tài khóa luận"),
    ).trim();
    const scheduledAt = String(
      pickCaseInsensitiveValue(defenseInfo, ["scheduledAt", "ScheduledAt"], ""),
    ).trim();
    const room = String(
      pickCaseInsensitiveValue(defenseInfo, ["room", "Room"], ""),
    ).trim();
    const committeeCode = String(
      pickCaseInsensitiveValue(defenseInfo, ["committeeCode", "CommitteeCode"], ""),
    ).trim();
    const sessionCode = normalizeSessionCode(
      pickCaseInsensitiveValue(defenseInfo, ["sessionCode", "SessionCode"], null),
      pickCaseInsensitiveValue(defenseInfo, ["session", "Session"], null),
    );
    const notificationFallback = parseNotificationScheduleFallback(notifications, sessionCode);
    const effectiveScheduledAt = scheduledAt || notificationFallback?.scheduledAt || "";
    const effectiveRoom = room || notificationFallback?.room || "";
    const effectiveCommitteeCode = committeeCode || notificationFallback?.committeeCode || "";

    if (councilListLocked && effectiveScheduledAt) {
      events.push({
        id: nextId,
        title: "Lịch bảo vệ khóa luận",
        date: toDateOnly(effectiveScheduledAt),
        time: `${toTimeLabel(effectiveScheduledAt)} - ${sessionToLabel(sessionCode)}`,
        location: effectiveRoom || "Phòng sẽ được cập nhật",
        type: "defense",
        description: `${studentName} bảo vệ đề tài "${topicTitle || "Đang cập nhật"}" trước hội đồng ${effectiveCommitteeCode || "đang cập nhật"}.`,
        participants: effectiveCommitteeCode ? [`Hội đồng ${effectiveCommitteeCode}`] : undefined,
      });
      nextId += 1;
    } else if (councilListLocked) {
      events.push({
        id: nextId,
        title: "Đã chốt hội đồng, chờ lịch cụ thể",
        date: new Date().toISOString().slice(0, 10),
        time: "Theo thông báo",
        location: "Hệ thống",
        type: "meeting",
        description:
          "Danh sách hội đồng đã được chốt, hệ thống đang cập nhật ngày, phòng và khung giờ bảo vệ.",
      });
      nextId += 1;
    } else {
      events.push({
        id: nextId,
        title: "Đang chờ chốt danh sách hội đồng",
        date: new Date().toISOString().slice(0, 10),
        time: "Theo thông báo",
        location: "Hệ thống",
        type: "meeting",
        description:
          "Khi councilListLocked = false, lịch bảo vệ có thể chưa hiển thị đầy đủ. Bạn vui lòng theo dõi thông báo tiếp theo.",
      });
      nextId += 1;
    }
  }

  if (Array.isArray(notifications)) {
    notifications.forEach((entry) => {
      const row = toRecord(entry);
      if (!row) {
        return;
      }

      const message = String(
        pickCaseInsensitiveValue(row, ["message", "Message"], "Thông báo hệ thống"),
      ).trim();
      const timestamp = String(
        pickCaseInsensitiveValue(row, ["timestamp", "Timestamp"], ""),
      ).trim();
      const typeRaw = String(
        pickCaseInsensitiveValue(row, ["type", "Type"], "INFO"),
      ).toLowerCase();

      const eventType: "defense" | "meeting" | "presentation" =
        typeRaw.includes("revision")
          ? "presentation"
          : typeRaw.includes("committee") || typeRaw.includes("lock")
            ? "defense"
            : "meeting";

      events.push({
        id: nextId,
        title: "Thông báo nghiệp vụ",
        date: toDateOnly(timestamp || new Date().toISOString()),
        time: toTimeLabel(timestamp || new Date().toISOString()),
        location: "Hệ thống thông báo",
        type: eventType,
        description: message || "Thông báo hệ thống",
      });
      nextId += 1;
    });
  }

  if (Array.isArray(revisionHistory) && revisionHistory.length > 0) {
    const latest = toRecord(revisionHistory[0]);
    if (latest) {
      const finalStatus = Number(
        pickCaseInsensitiveValue(latest, ["finalStatus", "FinalStatus"], 1),
      );
      const statusLabel =
        finalStatus === 2 ? "Đã duyệt" : finalStatus === 3 ? "Từ chối" : "Đang chờ";
      const updatedAt = String(
        pickCaseInsensitiveValue(
          latest,
          ["lastUpdated", "LastUpdated", "createdAt", "CreatedAt"],
          new Date().toISOString(),
        ),
      ).trim();
      const assignmentId = Number(
        pickCaseInsensitiveValue(latest, ["assignmentId", "AssignmentId"], 0),
      );

      events.push({
        id: nextId,
        title: "Cập nhật bản chỉnh sửa mới nhất",
        date: toDateOnly(updatedAt),
        time: toTimeLabel(updatedAt),
        location: "Hồ sơ chỉnh sửa",
        type: "presentation",
        description: `Bản chỉnh sửa #${assignmentId || "-"} đang ở trạng thái ${statusLabel}.`,
      });
    }
  }

  return events
    .filter((event) => Boolean(event.title && event.date))
    .sort((a, b) => {
      const left = parseSafeDate(`${a.date}T00:00:00`)?.getTime() ?? 0;
      const right = parseSafeDate(`${b.date}T00:00:00`)?.getTime() ?? 0;
      return left - right;
    });
};

const Schedule: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryPeriodId = normalizeDefensePeriodId(searchParams.get("periodId"));

  const [periodId, setPeriodId] = useState<number | null>(
    () => queryPeriodId ?? getActiveDefensePeriodId(),
  );
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventPopup, setShowEventPopup] = useState(false);
  const [selectedEventsForPopup, setSelectedEventsForPopup] = useState<
    ScheduleEvent[]
  >([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Đang tải lịch bảo vệ...");

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
        // Giữ trạng thái chờ và hiển thị thông báo trong loadingMessage.
      }
    };

    void resolvePeriod();

    return () => {
      cancelled = true;
    };
  }, [periodId]);

  useEffect(() => {
    const fetchSnapshot = async () => {
      if (!periodId) {
        setLoading(false);
        setLoadingMessage("Bạn chưa chọn đợt đồ án tốt nghiệp nào hết. Mình đang chờ bạn nè.");
        setEvents([]);
        return;
      }

      setLoading(true);
      setLoadingMessage("Đang đồng bộ lịch từ snapshot sinh viên...");

      try {
        const response = await fetchData<ApiResponse<Record<string, unknown>>>(
          `/defense-periods/${periodId}/student/snapshot`,
          {
            method: "GET",
          },
        );

        if (!readEnvelopeSuccess(response)) {
          setEvents([]);
          setLoadingMessage(
            readEnvelopeMessage(response) || "Chưa lấy được lịch bảo vệ, mình thử lại sau nhé.",
          );
          return;
        }

        const payload = readEnvelopeData<Record<string, unknown>>(response);
        const snapshot = toRecord(payload);
        if (!snapshot) {
          setEvents([]);
          setLoadingMessage("Chưa có dữ liệu lịch bảo vệ để hiển thị đâu. Bạn ghé lại sau nhé.");
          return;
        }

        const mappedEvents = mapSnapshotToEvents(snapshot);
        setEvents(mappedEvents);
        setLoadingMessage(
          mappedEvents.length > 0
            ? "Đã cập nhật lịch bảo vệ rồi nè."
            : "Hiện chưa có lịch bảo vệ trong đợt này. Mình chờ thêm nhé.",
        );
      } catch {
        setEvents([]);
        setLoadingMessage("Chưa tải được lịch bảo vệ, nhưng mình sẽ thử lại sớm thôi.");
      } finally {
        setLoading(false);
      }
    };

    void fetchSnapshot();
  }, [periodId]);

  const getEventTypeColor = (type: ScheduleEvent["type"]) => {
    switch (type) {
      case "defense":
        return { bg: "#DCFCE7", border: "#22C55E", text: "#166534" };
      case "meeting":
        return { bg: "#FFF7ED", border: "#F37021", text: "#9A3412" };
      case "presentation":
        return { bg: "#DBEAFE", border: "#3B82F6", text: "#1E40AF" };
      default:
        return { bg: "#F3F4F6", border: "#9CA3AF", text: "#374151" };
    }
  };

  const getEventTypeText = (type: ScheduleEvent["type"]) => {
    switch (type) {
      case "defense":
        return "Bảo vệ";
      case "meeting":
        return "Thông báo";
      case "presentation":
        return "Chỉnh sửa";
      default:
        return "Khác";
    }
  };

  const getDaysInMonth = (date: Date): Array<Date | null> => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Array<Date | null> = [];
    for (let i = 0; i < startingDayOfWeek; i += 1) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i += 1) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const hasEvent = (date: Date): boolean => {
    return events.some((event) => {
      const eventDate = parseSafeDate(`${event.date}T00:00:00`);
      if (!eventDate) {
        return false;
      }
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const getEventsForDate = (date: Date): ScheduleEvent[] => {
    return events.filter((event) => {
      const eventDate = parseSafeDate(`${event.date}T00:00:00`);
      if (!eventDate) {
        return false;
      }
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const previousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
  };

  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );
  };

  const handleEventClick = (event: ScheduleEvent) => {
    const eventDate = parseSafeDate(`${event.date}T00:00:00`);
    if (!eventDate) {
      return;
    }
    setCurrentDate(new Date(eventDate.getFullYear(), eventDate.getMonth(), 1));
  };

  const handleDateClick = (date: Date) => {
    const eventsForDate = getEventsForDate(date);
    if (eventsForDate.length > 0) {
      setSelectedEventsForPopup(eventsForDate);
      setShowEventPopup(true);
    }
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const days = useMemo(() => getDaysInMonth(currentDate), [currentDate]);

  const upcomingEvents = useMemo(
    () =>
      events
        .filter((event) => {
          const eventDate = parseSafeDate(`${event.date}T00:00:00`);
          if (!eventDate) {
            return false;
          }
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return eventDate >= today;
        })
        .sort((a, b) => {
          const left = parseSafeDate(`${a.date}T00:00:00`)?.getTime() ?? 0;
          const right = parseSafeDate(`${b.date}T00:00:00`)?.getTime() ?? 0;
          return left - right;
        }),
    [events],
  );

  if (loading) {
    return (
      <div className="sch-page">
        <style>
          {`
            .sch-page {
              max-width: 1440px;
              margin: 0 auto;
              padding: 24px;
              font-family: "Be Vietnam Pro", "Segoe UI", Tahoma, sans-serif;
              color: #111827;
            }
            .sch-card {
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 22px;
              box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04);
            }
            .sch-loading-card {
              padding: 48px;
              text-align: center;
              color: #475569;
              font-size: 16px;
              font-weight: 700;
              background: linear-gradient(135deg, #ffffff 0%, #fff7ed 100%);
            }
          `}
        </style>
        <section className="sch-card sch-loading-card">{loadingMessage}</section>
      </div>
    );
  }

  return (
    <div className="sch-page">
      <style>
        {`
          .sch-page {
            max-width: 1440px;
            margin: 0 auto;
            padding: 24px;
            font-family: "Be Vietnam Pro", "Segoe UI", Tahoma, sans-serif;
            color: #111827;
          }
          .sch-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 22px;
            box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04);
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
            height: 40px;
            width: 40px;
            border-radius: 999px;
            border: 1px solid #f37021;
            background: #f37021;
            color: #ffffff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 10px 24px rgba(243, 112, 33, 0.16);
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
            min-height: 74px;
            padding: 8px;
            background: #ffffff;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            gap: 6px;
            position: relative;
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
          }
          .sch-day.is-today .sch-day-number {
            color: #c2410c;
          }
          .sch-day-dot {
            width: 7px;
            height: 7px;
            border-radius: 999px;
            background: #22c55e;
          }
          .sch-day-count {
            position: absolute;
            right: 6px;
            bottom: 6px;
            font-size: 11px;
            font-weight: 700;
            color: #166534;
            background: #dcfce7;
            border-radius: 999px;
            padding: 2px 6px;
          }
          .sch-side-stack {
            display: grid;
            gap: 14px;
            align-content: start;
          }
          .sch-note-card {
            padding: 16px;
            background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
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
            line-height: 1.65;
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
            border-radius: 16px;
            padding: 16px;
            background: #f8fafc;
            color: #64748b;
            font-size: 13px;
            line-height: 1.55;
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
            <CalendarIcon size={30} color="#f37021" />
            Lịch bảo vệ
          </h1>
          <p className="sch-subtitle">
            Theo dõi lịch bảo vệ và các mốc thông báo quan trọng theo từng đợt, gọn gàng và dễ nhìn.
          </p>
        </div>

        <div className="sch-hero-meta">
          <div className="sch-pill">
            <CalendarIcon size={14} />
            {periodId ? `Đợt #${periodId}` : "Chưa xác định đợt đồ án tốt nghiệp"}
          </div>
          <div className="sch-pill sch-pill--soft">
            <Bell size={14} />
            {loadingMessage}
          </div>
        </div>
      </section>

      <div className="sch-layout">
        <section className="sch-card sch-calendar-card">
          <div className="sch-calendar-head">
            <button
              type="button"
              onClick={previousMonth}
              className="sch-nav-btn"
              aria-label="Tháng trước"
            >
              <ChevronLeft size={20} />
            </button>

            <h2 className="sch-month-title">{formatMonthLabel(currentDate)}</h2>

            <button
              type="button"
              onClick={nextMonth}
              className="sch-nav-btn"
              aria-label="Tháng sau"
            >
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
            {days.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="sch-day empty" />;
              }

              const dayHasEvent = hasEvent(date);
              const eventsInDay = getEventsForDate(date).length;
              const dayClasses = [
                "sch-day",
                dayHasEvent ? "has-event" : "",
                isToday(date) ? "is-today" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={`day-${date.toISOString()}`}
                  type="button"
                  onClick={() => handleDateClick(date)}
                  className={dayClasses}
                >
                  <span className="sch-day-number">{date.getDate()}</span>
                  {dayHasEvent && <span className="sch-day-dot" />}
                  {eventsInDay > 0 && <span className="sch-day-count">{eventsInDay}</span>}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="sch-side-stack">
          <section className="sch-card sch-note-card">
            <h3 className="sch-note-head">
              <Info size={16} color="#f37021" />
              Một chút nhắc nhở dễ thương
            </h3>
            <p className="sch-note-text">
              Khi hội đồng chưa chốt, lịch ngày giờ có thể chưa hiện đủ. Bạn cứ ghé lại mỗi ngày một
              chút nhé, hệ thống sẽ cập nhật ngay khi có tin mới.
            </p>
          </section>

          <section className="sch-card sch-upcoming-card">
            <h2 className="sch-section-title">
              <Clock size={20} color="#f37021" />
              Sự kiện sắp tới
            </h2>

            <div className="sch-event-list">
              {upcomingEvents.map((event) => {
                const colors = getEventTypeColor(event.type);
                return (
                  <article
                    key={event.id}
                    className="sch-event-card"
                    style={{ background: colors.bg, borderColor: colors.border }}
                    onClick={() => handleEventClick(event)}
                  >
                    <span
                      className="sch-event-badge"
                      style={{ background: colors.border, color: "#ffffff" }}
                    >
                      {getEventTypeText(event.type)}
                    </span>

                    <div className="sch-event-title-row">
                      <h3 className="sch-event-title">{event.title}</h3>
                      <span className="sch-event-hint" style={{ color: colors.text }}>
                        Nhấn để xem
                      </span>
                    </div>

                    <p className="sch-event-description">{event.description}</p>

                    <div className="sch-event-meta">
                      <div className="sch-event-meta-item">
                        <CalendarIcon size={14} />
                        {formatEventDate(event.date)}
                      </div>
                      <div className="sch-event-meta-item">
                        <Clock size={14} />
                        {event.time}
                      </div>
                      <div className="sch-event-meta-item">
                        <MapPin size={14} />
                        {event.location}
                      </div>
                    </div>

                    {event.participants && event.participants.length > 0 && (
                      <div className="sch-event-participants">
                        <div className="sch-event-meta-item" style={{ marginBottom: 4 }}>
                          <Users size={14} />
                          Thành phần:
                        </div>
                        <div>{event.participants.join(", ")}</div>
                      </div>
                    )}
                  </article>
                );
              })}

              {upcomingEvents.length === 0 && (
                <div className="sch-empty">
                  {loadingMessage || "Hiện tại chưa có lịch bảo vệ nào cả. Bạn quay lại sau nha."}
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {showEventPopup && selectedEventsForPopup.length > 0 && (
        <div
          className="sch-overlay"
          onClick={() => setShowEventPopup(false)}
          role="presentation"
        >
          <div
            className="sch-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết sự kiện"
          >
            <div className="sch-modal-head">
              <h2 className="sch-modal-title">Chi tiết sự kiện</h2>
              <button
                type="button"
                onClick={() => setShowEventPopup(false)}
                className="sch-close-btn"
                aria-label="Đóng"
              >
                x
              </button>
            </div>

            <div className="sch-modal-list">
              {selectedEventsForPopup.map((event) => {
                const colors = getEventTypeColor(event.type);
                return (
                  <article
                    key={`popup-${event.id}`}
                    className="sch-event-card"
                    style={{ background: colors.bg, borderColor: colors.border }}
                  >
                    <div className="sch-event-title-row">
                      <h3 className="sch-event-title">{event.title}</h3>
                      <span
                        className="sch-event-badge"
                        style={{ background: colors.border, color: "#ffffff", marginBottom: 0 }}
                      >
                        {getEventTypeText(event.type)}
                      </span>
                    </div>

                    <p className="sch-event-description">{event.description}</p>

                    <div className="sch-event-meta">
                      <div className="sch-event-meta-item">
                        <CalendarIcon size={14} />
                        {formatEventDate(event.date)}
                      </div>
                      <div className="sch-event-meta-item">
                        <Clock size={14} />
                        {event.time}
                      </div>
                      <div className="sch-event-meta-item">
                        <MapPin size={14} />
                        {event.location}
                      </div>
                    </div>

                    {event.participants && event.participants.length > 0 && (
                      <div className="sch-event-participants">
                        <div className="sch-event-meta-item" style={{ marginBottom: 4 }}>
                          <Users size={14} />
                          Thành phần:
                        </div>
                        <div>{event.participants.join(", ")}</div>
                      </div>
                    )}
                  </article>
                );
              })}

              {selectedEventsForPopup.length === 0 && (
                <div className="sch-empty" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <AlertCircle size={16} />
                  Hiện chưa có sự kiện nào để xem đâu. Bạn thử lại sau nhé.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;
