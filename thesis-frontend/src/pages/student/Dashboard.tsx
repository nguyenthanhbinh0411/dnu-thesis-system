import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Flame,
  LayoutGrid,
  ListChecks,
  MapPin,
  MessageCircle,
  Target,
  User,
  Users,
} from "lucide-react";
import { fetchData } from "../../api/fetchData";
import { useAuth } from "../../hooks/useAuth";
import type { ApiResponse } from "../../types/api";
import type { MilestoneTemplate } from "../../types/milestoneTemplate";
import type {
  ReportAggregateTag,
  StudentDashboardPayload,
} from "../../types/report-aggregate";
import type { StudentProfile } from "../../types/studentProfile";
import {
  pickCaseInsensitiveValue,
  readEnvelopeData,
  readEnvelopeSuccess,
} from "../../utils/api-envelope";
import {
  extractDefensePeriodId,
  getActiveDefensePeriodId,
  setActiveDefensePeriodId,
} from "../../utils/defensePeriod";

type SchedulePreview = {
  title: string;
  room: string;
  timeLabel: string;
  committeeLabel: string;
  note: string;
  memberCount: number;
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const getString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();
  return text || fallback;
};

const parseSafeDate = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateLabel = (value: string | null | undefined): string => {
  const text = getString(value, "");
  if (!text) return "Đang cập nhật";
  const parsed = parseSafeDate(text);
  return parsed ? parsed.toLocaleDateString("vi-VN") : text;
};

const formatShortDateTime = (value: string | null | undefined): string => {
  const text = getString(value, "");
  if (!text) return "Đang cập nhật";
  const parsed = parseSafeDate(text);
  if (!parsed) return text;
  return parsed.toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const formatCountdown = (value: string | null | undefined): string => {
  const parsed = parseSafeDate(getString(value, ""));
  if (!parsed) return "Đang cập nhật";

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const target = new Date(parsed);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil(
    (target.getTime() - startOfToday.getTime()) / 86400000,
  );
  if (diffDays > 1) return `Còn ${diffDays} ngày`;
  if (diffDays === 1) return "Còn 1 ngày";
  if (diffDays === 0) return "Hôm nay";
  return `Quá hạn ${Math.abs(diffDays)} ngày`;
};

const getDeadlineProgressPercent = (value: string | null | undefined): number => {
  const parsed = parseSafeDate(getString(value, ""));
  if (!parsed) return 0;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const target = new Date(parsed);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((target.getTime() - startOfToday.getTime()) / 86400000);
  const normalizedDays = Math.max(0, Math.min(30, diffDays));
  return Math.round(((30 - normalizedDays) / 30) * 100);
};

const truncateText = (
  value: string | null | undefined,
  maxLength: number,
): string => {
  const text = getString(value, "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
};

const readBooleanLike = (value: unknown, fallback = false): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
};

const normalizeSessionCode = (
  sessionCode: unknown,
  session: unknown,
): "MORNING" | "AFTERNOON" | null => {
  const normalizedCode = getString(sessionCode, "").toUpperCase();
  if (normalizedCode === "MORNING" || normalizedCode === "AFTERNOON") {
    return normalizedCode;
  }

  const sessionNumber = Number(session);
  if (Number.isFinite(sessionNumber)) {
    return sessionNumber === 1 ? "MORNING" : "AFTERNOON";
  }

  return null;
};

const sessionToLabel = (
  sessionCode: "MORNING" | "AFTERNOON" | null,
): string => {
  if (sessionCode === "MORNING") return "Buổi sáng";
  if (sessionCode === "AFTERNOON") return "Buổi chiều";
  return "Theo thông báo";
};

const getConversationTimeLabel = (value: string | null | undefined): string => {
  const parsed = parseSafeDate(getString(value, ""));
  if (!parsed) return "";

  const now = new Date();
  const sameDay =
    parsed.getDate() === now.getDate() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getFullYear() === now.getFullYear();

  if (sameDay) {
    return parsed.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    parsed.getDate() === yesterday.getDate() &&
    parsed.getMonth() === yesterday.getMonth() &&
    parsed.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Hôm qua";
  return parsed.toLocaleDateString("vi-VN");
};

const getMilestoneStatusTone = (statusLabel: string) => {
  const normalized = (statusLabel || "").toLowerCase().trim();
  if (normalized === "hoàn thành") {
    return { bg: "#ecfdf5", color: "#059669", border: "#10b981" };
  }
  if (normalized === "đang thực hiện" || normalized === "đang tiến hành") {
    return { bg: "#fff7ed", color: "#F37021", border: "#fdba74" };
  }
  return { bg: "#f8fafc", color: "#64748b", border: "#cbd5e1" };
};

// Removed unused helper functions

const mapSchedulePreview = (
  snapshot: Record<string, unknown>,
): SchedulePreview | null => {
  const defenseInfo = toRecord(
    pickCaseInsensitiveValue(snapshot, ["defenseInfo", "DefenseInfo"], null),
  );
  if (!defenseInfo) return null;

  const councilListLocked = readBooleanLike(
    pickCaseInsensitiveValue(
      defenseInfo,
      ["councilListLocked", "CouncilListLocked"],
      false,
    ),
    false,
  );
  const studentName = getString(
    pickCaseInsensitiveValue(
      defenseInfo,
      ["studentName", "StudentName"],
      "Sinh viên",
    ),
    "Sinh viên",
  );
  const topicTitle = getString(
    pickCaseInsensitiveValue(
      defenseInfo,
      ["topicTitle", "TopicTitle"],
      "Đề tài khóa luận",
    ),
    "Đề tài khóa luận",
  );
  const room = getString(
    pickCaseInsensitiveValue(defenseInfo, ["room", "Room"], ""),
    "",
  );
  const scheduledAt = getString(
    pickCaseInsensitiveValue(defenseInfo, ["scheduledAt", "ScheduledAt"], ""),
    "",
  );
  const committeeCode = getString(
    pickCaseInsensitiveValue(
      defenseInfo,
      ["committeeCode", "CommitteeCode"],
      "",
    ),
    "",
  );
  const sessionCode = normalizeSessionCode(
    pickCaseInsensitiveValue(defenseInfo, ["sessionCode", "SessionCode"], null),
    pickCaseInsensitiveValue(defenseInfo, ["session", "Session"], null),
  );

  const timeLabel = scheduledAt
    ? `${formatDateLabel(scheduledAt)} • ${getConversationTimeLabel(scheduledAt)} - ${sessionToLabel(sessionCode)}`
    : "Theo thông báo";

  return {
    title: councilListLocked
      ? "Lịch bảo vệ (dự kiến)"
      : "Đang chờ chốt hội đồng",
    room: room || "Đang cập nhật",
    timeLabel,
    committeeLabel: committeeCode
      ? `Hội đồng ${committeeCode}`
      : "Hội đồng đang cập nhật",
    note: councilListLocked
      ? `${studentName} bảo vệ đề tài "${truncateText(topicTitle, 54)}".`
      : "Lịch sẽ hiển thị đầy đủ sau khi hội đồng được chốt.",
    memberCount: councilListLocked ? 5 : 0,
  };
};

const Dashboard: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<StudentDashboardPayload | null>(
    null,
  );
  const [milestoneTemplates, setMilestoneTemplates] = useState<
    MilestoneTemplate[]
  >([]);
  const [schedulePreview, setSchedulePreview] =
    useState<SchedulePreview | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [studentProfileLoading, setStudentProfileLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const openChatWidget = useCallback(() => {
    const button = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Mở tin nhắn"]',
    );
    button?.click();
  }, []);

  const openNotificationBell = useCallback(() => {
    const button = document.querySelector<HTMLButtonElement>(
      'button[title="Thông báo"]',
    );
    button?.click();
  }, []);

  useEffect(() => {
    const userCode = auth.user?.userCode;
    if (!userCode) {
      setError("Không tìm thấy mã người dùng");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const [dashboardResult, milestoneResult] = await Promise.allSettled([
          fetchData<ApiResponse<StudentDashboardPayload>>(
            `/reports/student/dashboard?userCode=${encodeURIComponent(userCode)}`,
          ),
          fetchData<{ data?: MilestoneTemplate[] }>(
            "/MilestoneTemplates/get-list?Page=0&PageSize=10",
          ),
        ]);

        if (cancelled) return;

        if (
          dashboardResult.status === "fulfilled" &&
          dashboardResult.value.success &&
          dashboardResult.value.data
        ) {
          setDashboard(dashboardResult.value.data);
        } else {
          setDashboard(null);
          setError("Không tải được dữ liệu dashboard sinh viên.");
        }

        if (milestoneResult.status === "fulfilled") {
          setMilestoneTemplates(milestoneResult.value.data || []);
        } else {
          setMilestoneTemplates([]);
        }
      } catch (fetchError) {
        if (!cancelled) {
          console.error("Error loading student dashboard:", fetchError);
          setError("Lỗi khi tải dữ liệu dashboard.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    // Removed obsolete loaders

    const loadSchedulePreview = async () => {
      setScheduleLoading(true);
      try {
        let periodId = getActiveDefensePeriodId();
        if (!periodId) {
          const periodResponse = await fetchData<ApiResponse<unknown>>(
            "/defense-periods",
            {
              method: "GET",
            },
          );
          const payload = readEnvelopeData<unknown>(periodResponse);
          const fallbackPeriodId = extractDefensePeriodId(payload);
          if (fallbackPeriodId != null) {
            periodId = fallbackPeriodId;
            setActiveDefensePeriodId(fallbackPeriodId);
          }
        }

        if (!periodId) {
          if (!cancelled) {
            setSchedulePreview(null);
          }
          return;
        }

        const response = await fetchData<ApiResponse<Record<string, unknown>>>(
          `/defense-periods/${periodId}/student/snapshot`,
          {
            method: "GET",
          },
        );

        if (!readEnvelopeSuccess(response)) {
          if (!cancelled) {
            setSchedulePreview(null);
          }
          return;
        }

        const snapshot = toRecord(
          readEnvelopeData<Record<string, unknown>>(response),
        );
        if (!snapshot) {
          if (!cancelled) {
            setSchedulePreview(null);
          }
          return;
        }

        const preview = mapSchedulePreview(snapshot);
        if (!cancelled) {
          setSchedulePreview(preview);
        }
      } catch {
        if (!cancelled) {
          setSchedulePreview(null);
        }
      } finally {
        if (!cancelled) {
          setScheduleLoading(false);
        }
      }
    };

    const loadStudentProfile = async () => {
      setStudentProfileLoading(true);
      try {
        const response = await fetchData<ApiResponse<StudentProfile[]>>(
          `/StudentProfiles/get-list?UserCode=${encodeURIComponent(userCode)}&Page=0&PageSize=1`,
        );
        if (
          !cancelled &&
          response.success &&
          response.data &&
          response.data.length > 0
        ) {
          setStudentProfile(response.data[0]);
        }
      } catch (e) {
        console.error("Error loading student profile:", e);
      } finally {
        if (!cancelled) setStudentProfileLoading(false);
      }
    };

    void loadDashboard();
    void loadSchedulePreview();
    void loadStudentProfile();

    return () => {
      cancelled = true;
    };
  }, [auth.user?.userCode]);

  const currentMilestoneOrdinal = dashboard?.currentMilestone?.ordinal ?? null;
  const sortedMilestones = useMemo(
    () =>
      [...milestoneTemplates].sort(
        (left, right) => left.ordinal - right.ordinal,
      ),
    [milestoneTemplates],
  );

  const currentMilestoneTemplate = useMemo(
    () =>
      sortedMilestones.find(
        (item) => item.ordinal === currentMilestoneOrdinal,
      ) || null,
    [currentMilestoneOrdinal, sortedMilestones],
  );

  const nextMilestone = useMemo(() => {
    if (!sortedMilestones.length) return null;
    const next = sortedMilestones.find(
      (item) => item.ordinal >= (currentMilestoneOrdinal ?? 0),
    );
    return next || sortedMilestones[sortedMilestones.length - 1];
  }, [currentMilestoneOrdinal, sortedMilestones]);

  const milestoneViews = useMemo(() => {
    let hasFoundNext = false;
    const currentOrdinal = dashboard?.currentMilestone?.ordinal ?? -1;
    const currentState = dashboard?.currentMilestone?.state;

    return sortedMilestones.map((m) => {
      const isCompleted =
        m.ordinal < currentOrdinal ||
        (m.ordinal === currentOrdinal && currentState === "COMPLETED");
      const isCurrent =
        m.ordinal === currentOrdinal && currentState !== "COMPLETED";

      let displayState = isCompleted
        ? "Hoàn thành"
        : isCurrent
          ? currentState || "Đang thực hiện"
          : "Sắp tới";
      let isNext = false;

      if (!isCompleted && !isCurrent && !hasFoundNext) {
        displayState = "Đang tiến hành";
        isNext = true;
        hasFoundNext = true;
      }

      return {
        ...m,
        isCompleted,
        isCurrent,
        isNext,
        displayState,
      };
    });
  }, [dashboard?.currentMilestone, sortedMilestones]);

  const deadlineProgressPercent = useMemo(() => {
    return getDeadlineProgressPercent(nextMilestone?.deadline || null);
  }, [nextMilestone?.deadline]);

  // Unused hooks for removed cards removed

  const topic = dashboard?.topic ?? null;
  const supervisor = dashboard?.supervisor ?? null;
  const topicTags = dashboard?.topicTags ?? [];
  const supervisorTags = dashboard?.supervisorTags ?? [];
  const topicStatus =
    topic?.status || dashboard?.currentMilestone?.state || "Đang cập nhật";
  const expectedComplete =
    nextMilestone?.deadline || currentMilestoneTemplate?.deadline || null;

  if (loading) {
    return (
      <div className="stu-dashboard-page stu-dashboard-page--loading">
        <style>{dashboardStyles}</style>
        <div className="stu-loading-card">Đang tải dashboard sinh viên...</div>
      </div>
    );
  }

  return (
    <div className="stu-dashboard-page">
      <style>{dashboardStyles}</style>

      {error && <div className="stu-error-banner">{error}</div>}

      <section className="stu-grid stu-grid--top">
        <article className="stu-card stu-card--profile">
          <div className="stu-card-head">
            <span className="stu-card-icon stu-card-icon--blue">
              <User size={18} />
            </span>
            <p className="stu-card-kicker">Thông tin cá nhân</p>
          </div>

          {studentProfileLoading ? (
            <div className="stu-empty-box">Đang tải thông tin...</div>
          ) : studentProfile ? (
            <div className="stu-profile-layout">
              <div className="stu-profile-left">
                <div className="stu-profile-avatar">
                  <img
                    src={
                      studentProfile.studentImage ||
                      "https://ui-avatars.com/api/?name=" +
                        encodeURIComponent(studentProfile.fullName)
                    }
                    alt={studentProfile.fullName}
                  />
                </div>
              </div>
              <div className="stu-profile-right">
                <div className="stu-profile-header">
                  <h2 className="stu-profile-name">
                    {studentProfile.fullName}
                  </h2>
                  <span className="stu-status-pill stu-status-pill--profile">
                    {studentProfile.status}
                  </span>
                </div>
                <div className="stu-profile-grid">
                  <div className="stu-profile-item">
                    <span className="stu-meta-label">Mã sinh viên</span>
                    <p className="stu-meta-value">
                      {studentProfile.studentCode}
                    </p>
                  </div>
                  <div className="stu-profile-item">
                    <span className="stu-meta-label">Lớp</span>
                    <p className="stu-meta-value">{studentProfile.classCode}</p>
                  </div>
                  <div className="stu-profile-item">
                    <span className="stu-meta-label">Khoa / Bộ môn</span>
                    <p className="stu-meta-value">
                      {studentProfile.facultyCode} -{" "}
                      {studentProfile.departmentCode}
                    </p>
                  </div>
                  <div className="stu-profile-item">
                    <span className="stu-meta-label">GPA / Xếp loại</span>
                    <p className="stu-meta-value">
                      {studentProfile.gpa} - {studentProfile.academicStanding}
                    </p>
                  </div>
                  <div className="stu-profile-item">
                    <span className="stu-meta-label">Ngày sinh</span>
                    <p className="stu-meta-value">
                      {formatDateLabel(studentProfile.dateOfBirth)}
                    </p>
                  </div>
                  <div className="stu-profile-item">
                    <span className="stu-meta-label">Giới tính</span>
                    <p className="stu-meta-value">{studentProfile.gender}</p>
                  </div>
                  <div className="stu-profile-item">
                    <span className="stu-meta-label">Số điện thoại</span>
                    <p className="stu-meta-value">
                      {studentProfile.phoneNumber}
                    </p>
                  </div>
                  <div className="stu-profile-item">
                    <span className="stu-meta-label">Địa chỉ</span>
                    <p className="stu-meta-value">{studentProfile.address}</p>
                  </div>
                  <div className="stu-profile-item">
                    <span className="stu-meta-label">Email</span>
                    <p
                      className="stu-meta-value"
                      style={{ wordBreak: "break-all" }}
                    >
                      {studentProfile.studentEmail}
                    </p>
                  </div>
                  <div className="stu-profile-item">
                    <span className="stu-meta-label">Khóa / Năm nhập học</span>
                    <p className="stu-meta-value">
                      {studentProfile.enrollmentYear}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="stu-empty-box">
              Không tìm thấy thông tin cá nhân.
            </div>
          )}
        </article>

        <article className="stu-card stu-card--progress">
          <div className="stu-card-head stu-card-head--split">
            <div className="stu-card-title-group">
              <span className="stu-card-icon stu-card-icon--indigo">
                <LayoutGrid size={18} />
              </span>
              <p className="stu-card-kicker">Tiến độ đề tài</p>
            </div>

            <button
              type="button"
              className="stu-card-link"
              onClick={() => navigate("/student/progress")}
            >
              Xem chi tiết <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="stu-progress-list">
            {milestoneViews.map((m, idx) => {
              const tone = getMilestoneStatusTone(m.displayState);
              const nextMilestone = milestoneViews[idx + 1] || null;
              const lineClass = nextMilestone
                ? nextMilestone.isCompleted
                  ? "is-completed"
                  : "is-pending"
                : "";
              return (
                <div key={m.milestoneTemplateID} className="stu-progress-item">
                  <div className="stu-progress-marker">
                    <div
                      className={`stu-progress-dot ${
                        m.isCompleted
                          ? "is-completed"
                          : m.isCurrent
                            ? "is-current"
                            : ""
                      }`}
                    >
                      {m.isCompleted ? <CheckCircle size={12} /> : idx + 1}
                    </div>
                    {idx < milestoneViews.length - 1 && (
                      <div className={`stu-progress-line ${lineClass}`} />
                    )}
                  </div>
                  <div className="stu-progress-body">
                    <div className="stu-progress-row">
                      <p className="stu-progress-title">{m.name}</p>
                      <span className="stu-progress-date">
                        {formatDateLabel(m.deadline)}
                      </span>
                    </div>
                    <span
                      className="stu-progress-state"
                      style={{
                        background: tone.bg,
                        color: tone.color,
                        border: `1px solid ${tone.border}`,
                      }}
                    >
                      {m.displayState}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="stu-grid stu-grid--bottom">
        <article className="stu-card stu-card--topic">
          <div className="stu-card-head stu-card-head--split">
            <div className="stu-card-title-group">
              <span className="stu-card-icon stu-card-icon--blue">
                <BookOpen size={18} />
              </span>
              <div>
                <p className="stu-card-kicker">Đề tài của bạn</p>
              </div>
            </div>

            <button
              type="button"
              className="stu-card-link"
              onClick={() => navigate("/student/topics")}
            >
              Chi tiết <ArrowUpRight size={14} />
            </button>
          </div>

          {topic ? (
            <div className="stu-topic-layout">
              <h2 className="stu-topic-title">{topic.title}</h2>

              <div className="stu-topic-meta-row">
                <div>
                  <span className="stu-meta-label">GVHD</span>
                  <p className="stu-meta-value">
                    {supervisor
                      ? supervisor.fullName
                      : topic.supervisorLecturerCode || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="stu-meta-label">Trạng thái</span>
                  <span className="stu-status-pill stu-status-pill--topic">
                    {topicStatus}
                  </span>
                </div>
                <div>
                  <span className="stu-meta-label">Mã đề tài</span>
                  <p className="stu-meta-value">{topic.topicCode || "N/A"}</p>
                </div>
                <div>
                  <span className="stu-meta-label">Loại đề tài</span>
                  <p className="stu-meta-value">{topic.type || "Chính thức"}</p>
                </div>
                <div>
                  <span className="stu-meta-label">Bắt đầu</span>
                  <p className="stu-meta-value">
                    {formatDateLabel(topic.createdAt)}
                  </p>
                </div>
                <div>
                  <span className="stu-meta-label">Dự kiến</span>
                  <p className="stu-meta-value">
                    {formatDateLabel(expectedComplete)}
                  </p>
                </div>
                {supervisor?.email && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span className="stu-meta-label">Email GV</span>
                    <p
                      className="stu-meta-value"
                      style={{ wordBreak: "break-all" }}
                    >
                      {supervisor.email}
                    </p>
                  </div>
                )}
                {supervisor?.phoneNumber && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span className="stu-meta-label">SĐT GV</span>
                    <p className="stu-meta-value">{supervisor.phoneNumber}</p>
                  </div>
                )}
              </div>

              <div className="stu-chip-row">
                {topicTags.length > 0 ? (
                  topicTags.map((tag: ReportAggregateTag) => (
                    <span key={tag.tagCode} className="stu-chip">
                      {tag.tagName}
                    </span>
                  ))
                ) : (
                  <span className="stu-chip stu-chip--soft">
                    Chưa có thẻ đề tài
                  </span>
                )}
                {supervisorTags.map((tag: ReportAggregateTag) => (
                  <span key={tag.tagCode} className="stu-chip stu-chip--soft">
                    {tag.tagName}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="stu-empty-box">Chưa có thông tin đề tài.</div>
          )}
        </article>
        <article className="stu-card stu-card--deadline">
          <div className="stu-card-head stu-card-head--split">
            <div className="stu-card-title-group">
              <span className="stu-card-icon stu-card-icon--red">
                <Flame size={18} />
              </span>
              <div>
                <p className="stu-card-kicker">Sắp đến hạn</p>
              </div>
            </div>

            <button
              type="button"
              className="stu-card-link stu-card-link--danger"
              onClick={() => navigate("/student/schedule")}
            >
              Lịch trình <ArrowRight size={14} />
            </button>
          </div>

          <div className="stu-deadline-hero-wrapper">
            <div className="stu-deadline-hero">
              <div className="stu-deadline-icon">
                <Flame size={28} />
              </div>
              <div className="stu-deadline-copy">
                <h3 className="stu-deadline-title">
                  {nextMilestone?.name || "Chưa có hạn nộp"}
                </h3>
                <p className="stu-deadline-countdown">
                  {nextMilestone?.deadline
                    ? formatCountdown(nextMilestone.deadline)
                    : "Đang cập nhật"}
                </p>
                <p className="stu-deadline-meta">
                  Hạn nộp:{" "}
                  {nextMilestone?.deadline
                    ? formatShortDateTime(nextMilestone.deadline)
                    : "Đang cập nhật"}
                </p>
              </div>
            </div>

            <div className="stu-progress-bar">
              <div
                className="stu-progress-bar__fill"
                style={{ width: `${deadlineProgressPercent}%` }}
              />
            </div>
          </div>

          <div className="stu-deadline-task-list">
            <div className="stu-deadline-task">
              <div className="stu-deadline-task__left">
                <ListChecks size={16} className="stu-deadline-task__icon" />
                <span>Hoàn thiện nội dung báo cáo</span>
              </div>
              <CheckCircle
                size={16}
                className="stu-deadline-task__check is-done"
              />
            </div>
            <div className="stu-deadline-task">
              <div className="stu-deadline-task__left">
                <FileText size={16} className="stu-deadline-task__icon" />
                <span>Nộp file báo cáo</span>
              </div>
              {dashboard?.blockReason ? (
                <CheckCircle
                  size={16}
                  className="stu-deadline-task__check is-done"
                />
              ) : (
                <div className="stu-deadline-task__circle" />
              )}
            </div>
            <div className="stu-deadline-task">
              <div className="stu-deadline-task__left">
                <Clock size={16} className="stu-deadline-task__icon" />
                <span>Chờ GVHD phản hồi</span>
              </div>
              <div className="stu-deadline-task__circle" />
            </div>
          </div>

          {dashboard?.blockReason && (
            <div className="stu-warning-box stu-warning-box--deadline">
              <AlertCircle size={14} />
              <span>{dashboard.blockReason}</span>
            </div>
          )}
        </article>

        <article className="stu-card stu-card--schedule">
          <div className="stu-card-head stu-card-head--split">
            <div className="stu-card-title-group">
              <span className="stu-card-icon stu-card-icon--blue">
                <Calendar size={18} />
              </span>
              <div>
                <p className="stu-card-kicker">Lịch sắp tới</p>
              </div>
            </div>

            <button
              type="button"
              className="stu-card-link"
              onClick={() => navigate("/student/schedule")}
            >
              Xem chi tiết <ArrowUpRight size={14} />
            </button>
          </div>

          {scheduleLoading ? (
            <div className="stu-feed-empty">Đang tải lịch sắp tới...</div>
          ) : schedulePreview ? (
            <div className="stu-schedule-card">
              <div className="stu-schedule-top">
                <div className="stu-schedule-badge">
                  {schedulePreview.title}
                </div>
                <div className="stu-schedule-row">
                  <MapPin size={14} />
                  <span className="stu-schedule-room">
                    {schedulePreview.room}
                  </span>
                </div>
                <div className="stu-schedule-row">
                  <Clock size={14} />
                  <span className="stu-schedule-time">
                    {schedulePreview.timeLabel}
                  </span>
                </div>
                <div className="stu-schedule-committee">
                  {schedulePreview.committeeLabel}
                </div>
              </div>

              <div className="stu-schedule-participants">
                <div className="stu-avatar-stack">
                  {Array.from({
                    length: Math.min(schedulePreview.memberCount || 5, 5),
                  }).map((_, index) => (
                    <span key={index} className="stu-avatar-circle">
                      <User size={12} />
                    </span>
                  ))}
                  <span className="stu-avatar-circle stu-avatar-circle--more">
                    +1
                  </span>
                </div>
                <span className="stu-schedule-note">
                  <Users size={12} />
                  {schedulePreview.memberCount || 5} thành viên dự kiến
                </span>
                <span className="stu-schedule-note">
                  {truncateText(schedulePreview.note, 66)}
                </span>
              </div>

              <div className="stu-schedule-footer">
                <Calendar size={16} />
                <span>Bạn sẽ nhận thông báo khi lịch được xác nhận.</span>
              </div>
            </div>
          ) : (
            <div className="stu-feed-empty">Chưa có lịch bảo vệ dự kiến.</div>
          )}
        </article>
      </section>

      <section className="stu-quick-actions">
        <button
          type="button"
          className="stu-quick-action stu-quick-action--blue"
          onClick={() => navigate("/student/reports")}
        >
          <span className="stu-quick-action__icon">
            <ArrowRight size={16} />
          </span>
          <span>
            <strong>Nộp báo cáo</strong>
            <small>Upload báo cáo mới</small>
          </span>
        </button>

        <button
          type="button"
          className="stu-quick-action stu-quick-action--green"
          onClick={openChatWidget}
        >
          <span className="stu-quick-action__icon">
            <MessageCircle size={16} />
          </span>
          <span>
            <strong>Nhắn với GVHD</strong>
            <small>Trao đổi với giảng viên</small>
          </span>
        </button>

        <button
          type="button"
          className="stu-quick-action stu-quick-action--amber"
          onClick={() => navigate("/student/topics")}
        >
          <span className="stu-quick-action__icon">
            <Target size={16} />
          </span>
          <span>
            <strong>Đổi đề tài</strong>
            <small>Gửi yêu cầu đổi đề tài</small>
          </span>
        </button>

        <button
          type="button"
          className="stu-quick-action stu-quick-action--violet"
          onClick={() => navigate("/student/progress")}
        >
          <span className="stu-quick-action__icon">
            <BookOpen size={16} />
          </span>
          <span>
            <strong>Xem tài liệu</strong>
            <small>Tài liệu và biểu mẫu</small>
          </span>
        </button>

        <button
          type="button"
          className="stu-quick-action stu-quick-action--pink"
          onClick={openNotificationBell}
        >
          <span className="stu-quick-action__icon">
            <Calendar size={16} />
          </span>
          <span>
            <strong>Xem lịch</strong>
            <small>Lịch trình tổng quan</small>
          </span>
        </button>
      </section>
    </div>
  );
};

const dashboardStyles = `
  .stu-dashboard-page {
    max-width: 1440px;
    margin: 0 auto;
    padding: 24px;
    color: #111827;
    font-family: "Be Vietnam Pro", "Segoe UI", Tahoma, sans-serif;
  }

  .stu-dashboard-page--loading {
    min-height: 100vh;
  }

  .stu-loading-card {
    border: 1px solid #e5e7eb;
    border-radius: 22px;
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    padding: 40px;
    text-align: center;
    font-size: 16px;
    font-weight: 700;
    color: #003D82;
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
  }

  .stu-error-banner {
    margin-bottom: 18px;
    padding: 14px 16px;
    border-radius: 16px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
    font-weight: 600;
  }

  .stu-grid {
    display: grid;
    gap: 16px;
  }

  .stu-grid--top {
    grid-template-columns: 1.05fr 1.05fr 0.95fr;
    margin-bottom: 16px;
  }

  .stu-grid--bottom {
    grid-template-columns: 1.05fr 1.05fr 0.95fr;
    margin-bottom: 18px;
  }

  .stu-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 22px;
    padding: 14px;
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04);
    min-height: 0;
  }

  .stu-card-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }

  .stu-card-head--split {
    justify-content: space-between;
  }

  .stu-card-title-group {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .stu-card-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    flex-shrink: 0;
  }

  .stu-card-icon--blue { background: linear-gradient(135deg, #003D82, #1e40af); }
  .stu-card-icon--indigo { background: linear-gradient(135deg, #003D82, #1e3a8a); }
  .stu-card-icon--cyan { background: linear-gradient(135deg, #0ea5e9, #0284c7); }
  .stu-card-icon--red { background: linear-gradient(135deg, #F37021, #ea580c); }

  .stu-card-kicker {
    margin: 0;
    font-size: 13px;
    font-weight: 800;
    color: #1e293b;
  }

  .stu-card-link {
    border: 0;
    background: transparent;
    color: #003D82;
    font-size: 12px;
    font-weight: 800;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    white-space: nowrap;
    padding: 2px 0;
  }

  .stu-card-link--danger { color: #ef4444; }

  .stu-card--profile {
    grid-column: span 2;
  }

  .stu-profile-layout {
    display: flex;
    gap: 20px;
    align-items: flex-start;
  }

  .stu-profile-left {
    width: 30%;
    flex-shrink: 0;
    display: flex;
    justify-content: center;
  }

  .stu-profile-avatar {
    width: 200px;
    height: 260px;
    border-radius: 28px;
    overflow: hidden;
    border: 4px solid #f1f5f9;
    box-shadow: 0 20px 40px rgba(0,0,0,0.12);
  }

  .stu-profile-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .stu-profile-right {
    width: 70%;
    min-width: 0;
  }

  .stu-profile-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .stu-profile-name {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    color: #111827;
    letter-spacing: -0.02em;
  }

  .stu-status-pill--profile {
    font-size: 11px;
    padding: 2px 10px;
    background: #f0fdf4;
    color: #15803d;
    border: 1px solid #bbf7d0;
  }

  .stu-profile-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px 24px;
  }

  .stu-profile-item {
    min-width: 0;
  }

  .stu-card--topic {
    grid-column: span 1;
  }

  .stu-topic-title {
    margin: 4px 0 8px;
    font-size: 16px;
    line-height: 1.25;
    font-weight: 800;
    color: #111827;
  }

  .stu-topic-meta-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 12px;
    margin-bottom: 12px;
  }

  .stu-meta-label {
    display: block;
    margin-bottom: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
  }

  .stu-meta-value {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    color: #1e293b;
  }

  .stu-status-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 800;
  }

  .stu-status-pill--topic {
    background: #fff7ed;
    color: #F37021;
    border: 1px solid #fdba74;
  }

  .stu-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .stu-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid #fed7aa;
    background: #fff7ed;
    color: #9a3412;
    font-size: 11px;
    font-weight: 700;
  }

  .stu-chip--soft {
    border-color: #e2e8f0;
    background: #f8fafc;
    color: #475569;
  }

  .stu-schedule-card {
    display: grid;
    gap: 12px;
  }

  .stu-schedule-top {
    display: grid;
    gap: 8px;
  }

  .stu-schedule-row {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #475569;
    font-weight: 700;
    font-size: 13px;
  }

  .stu-schedule-badge {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    padding: 6px 10px;
    border-radius: 999px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #1d4ed8;
    font-size: 12px;
    font-weight: 800;
  }

  .stu-schedule-room {
    font-size: 18px;
    font-weight: 900;
    color: #111827;
  }

  .stu-schedule-time,
  .stu-schedule-committee {
    font-size: 13px;
    color: #475569;
    font-weight: 600;
  }

  .stu-schedule-participants {
    margin-top: 10px;
    padding-top: 12px;
    border-top: 1px dashed #dbeafe;
    display: grid;
    gap: 10px;
  }

  .stu-avatar-stack {
    display: flex;
    align-items: center;
  }

  .stu-avatar-circle {
    width: 30px;
    height: 30px;
    border-radius: 999px;
    background: linear-gradient(135deg, #ffffff, #e2e8f0);
    border: 2px solid #ffffff;
    margin-left: -8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #475569;
    font-size: 10px;
    font-weight: 800;
    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
  }

  .stu-avatar-circle:first-child {
    margin-left: 0;
  }

  .stu-avatar-circle--more {
    background: #dbeafe;
    color: #1d4ed8;
  }

  .stu-schedule-note {
    font-size: 12px;
    color: #3b82f6;
    line-height: 1.5;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .stu-schedule-footer {
    margin-top: 4px;
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 10px 12px;
    border-radius: 14px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #1d4ed8;
    font-size: 12px;
    font-weight: 700;
  }

  .stu-progress-list {
    display: grid;
    gap: 10px;
  }

  .stu-progress-item {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    gap: 12px;
    align-items: flex-start;
  }

  .stu-progress-marker {
    position: relative;
    display: flex;
    justify-content: center;
  }

  .stu-progress-dot {
    width: 24px;
    height: 24px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    font-size: 10px;
    font-weight: 800;
    z-index: 1;
    background: #cbd5e1;
  }

  .stu-progress-dot.is-completed { background: #10b981; }
  .stu-progress-dot.is-current { background: #F37021; }

  .stu-progress-line {
    position: absolute;
    top: 14px;
    bottom: -38px;
    width: 2px;
    background: #e2e8f0;
    border-radius: 999px;
  }

  .stu-progress-line.is-completed {
    background: linear-gradient(180deg, #10b981 0%, #059669 100%);
  }

  .stu-progress-line.is-pending {
    background: linear-gradient(180deg, #fb923c 0%, #F37021 100%);
  }

  .stu-progress-body {
    min-width: 0;
    padding-bottom: 2px;
  }

  .stu-progress-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: flex-start;
  }

  .stu-progress-title {
    margin: 0;
    font-size: 13px;
    font-weight: 800;
    color: #1e293b;
    flex: 1;
  }

  .stu-progress-date {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    white-space: nowrap;
  }

  .stu-progress-state {
    display: inline-flex;
    margin-top: 6px;
    border-radius: 999px;
    padding: 3px 9px;
    font-size: 11px;
    font-weight: 800;
  }

  .stu-deadline-hero-wrapper {
    background: linear-gradient(135deg, #fff1f2 0%, #fff7ed 100%);
    border: 1px solid #fecaca;
    border-radius: 18px;
    padding: 14px;
    margin-bottom: 16px;
  }

  .stu-deadline-hero {
    display: flex;
    gap: 14px;
    align-items: center;
    margin-bottom: 16px;
  }

  .stu-deadline-icon {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: linear-gradient(135deg, #003D82, #F37021);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 12px 24px rgba(239, 68, 68, 0.18);
    flex-shrink: 0;
  }

  .stu-deadline-title {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
    color: #ef4444;
    line-height: 1.25;
  }

  .stu-deadline-countdown {
    margin: 4px 0 6px;
    font-size: 18px;
    font-weight: 900;
    color: #dc2626;
  }

  .stu-deadline-meta {
    margin: 0;
    font-size: 12px;
    color: #7c2d12;
    font-weight: 600;
  }

  .stu-progress-bar {
    height: 6px;
    border-radius: 999px;
    background: #fee2e2;
    overflow: hidden;
  }

  .stu-progress-bar__fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #f87171, #ef4444);
    transition: width 0.35s ease;
  }

  .stu-deadline-task-list {
    display: grid;
    gap: 14px;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid #f1f5f9;
    background: #ffffff;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.02);
  }

  .stu-deadline-task {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .stu-deadline-task__left {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: #475569;
    font-weight: 600;
  }

  .stu-deadline-task__icon {
    color: #64748b;
  }

  .stu-deadline-task__check.is-done {
    color: #22c55e;
  }

  .stu-deadline-task__circle {
    width: 16px;
    height: 16px;
    border-radius: 999px;
    border: 2px solid #e2e8f0;
  }

  .stu-feed-list { display: grid; gap: 8px; }
  .stu-feed-empty {
    min-height: 120px;
    border-radius: 18px;
    border: 1px dashed #cbd5e1;
    background: #f8fafc;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
    padding: 18px;
  }

  .stu-feed-item {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 10px;
    align-items: flex-start;
  }

  .stu-feed-icon {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .stu-feed-content {
    min-width: 0;
    padding-bottom: 8px;
    border-bottom: 1px solid #f1f5f9;
  }

  .stu-feed-item:last-child .stu-feed-content { border-bottom: 0; }

  .stu-feed-title-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: flex-start;
  }

  .stu-feed-title {
    margin: 0;
    font-size: 12px;
    font-weight: 800;
    color: #111827;
  }

  .stu-feed-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #3b82f6;
    margin-top: 4px;
    flex-shrink: 0;
  }

  .stu-feed-desc {
    margin: 3px 0 0;
    font-size: 11px;
    color: #6b7280;
  }

  .stu-feed-time {
    display: inline-flex;
    margin-top: 4px;
    font-size: 10px;
    color: #94a3b8;
    font-weight: 700;
  }

  .stu-report-item {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid #f1f5f9;
  }

  .stu-report-item:last-child { border-bottom: 0; }

  .stu-report-icon {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #eff6ff;
    color: #2563eb;
    flex-shrink: 0;
  }

  .stu-report-content {
    min-width: 0;
  }

  .stu-report-title-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: flex-start;
  }

  .stu-report-title {
    margin: 0;
    font-size: 12px;
    font-weight: 800;
    color: #111827;
  }

  .stu-report-time {
    font-size: 10px;
    color: #94a3b8;
    font-weight: 700;
    white-space: nowrap;
  }

  .stu-report-desc {
    margin: 3px 0 0;
    font-size: 11px;
    color: #64748b;
    line-height: 1.45;
  }

  .stu-report-status {
    border-radius: 999px;
    padding: 3px 8px;
    font-size: 10px;
    font-weight: 800;
  }

  .stu-quick-actions {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
  }

  .stu-quick-action {
    border: 1px solid #e5e7eb;
    border-radius: 18px;
    background: #ffffff;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    text-align: left;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
    transition: transform 0.18s ease, box-shadow 0.18s ease;
  }

  .stu-quick-action:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
  }

  .stu-quick-action strong {
    display: block;
    font-size: 13px;
    font-weight: 800;
    color: #111827;
  }

  .stu-quick-action small {
    display: block;
    margin-top: 3px;
    font-size: 11px;
    color: #64748b;
    font-weight: 600;
  }

  .stu-quick-action__icon {
    width: 38px;
    height: 38px;
    border-radius: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    flex-shrink: 0;
  }

  .stu-quick-action--blue .stu-quick-action__icon { background: linear-gradient(135deg, #003D82, #1e40af); }
  .stu-quick-action--green .stu-quick-action__icon { background: linear-gradient(135deg, #10b981, #059669); }
  .stu-quick-action--amber .stu-quick-action__icon { background: linear-gradient(135deg, #F37021, #ea580c); }
  .stu-quick-action--violet .stu-quick-action__icon { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
  .stu-quick-action--pink .stu-quick-action__icon { background: linear-gradient(135deg, #ec4899, #db2777); }

  .stu-empty-box {
    border-radius: 16px;
    border: 1px dashed #cbd5e1;
    background: #f8fafc;
    padding: 16px;
    color: #64748b;
    font-size: 13px;
    font-weight: 600;
  }

  .stu-badge {
    border-radius: 999px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #1d4ed8;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
  }

  .stu-badge--alert {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
  }

  .stu-warning-box {
    margin-top: 14px;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 14px;
    border-radius: 14px;
    background: #fff7ed;
    border: 1px solid #fed7aa;
    color: #9a3412;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.4;
  }

  .stu-warning-box--deadline {
    background: #fff1f2;
    border-color: #fecaca;
    color: #b91c1c;
  }

  @media (max-width: 1280px) {
    .stu-grid--top,
    .stu-grid--bottom,
    .stu-quick-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 860px) {
    .stu-grid--top,
    .stu-grid--bottom,
    .stu-quick-actions {
      grid-template-columns: 1fr;
    }
  }
\`;`;

export default Dashboard;
