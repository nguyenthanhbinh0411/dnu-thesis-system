import React, { useEffect, useMemo, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";
import {
  Bell,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  UserCheck,
  Users,
  AlertTriangle,
} from "lucide-react";
import { fetchData } from "../../api/fetchData";
import { useAuth } from "../../hooks/useAuth";
import {
  getLecturerCode,
  setLecturerCode,
} from "../../services/auth-session.service";
import {
  getLecturerDeadlineRisk,
  getLecturerDefenseSchedule,
  getLecturerOverview,
  getLecturerOverdueTrend,
  getLecturerProgressStatusBreakdown,
  getLecturerReviewQueue,
  getLecturerReviewStatusBreakdown,
  getLecturerScoringProgress,
  getLecturerTopicTypeBreakdown,
  getLecturerWorkloadSnapshot,
  normalizeDashboardItems,
  normalizeDashboardResponse,
  readDashboardNumber,
  readDashboardString,
  type DashboardRecord,
  type DefenseScheduleRecord,
} from "../../services/dashboard.service";
import type { ApiResponse } from "../../types/api";
import type { LecturerProfile } from "../../types/lecturer";

Chart.register(...registerables);

interface DashboardStats {
  totalStudents: number;
  defenseParticipations: number;
  pendingReviews: number;
  upcomingDefenses: number;
  completedReports: number;
}

interface RecentActivity {
  id: string;
  type:
    | "topic_submission"
    | "report_review"
    | "defense_scheduled"
    | "committee_meeting";
  title: string;
  description: string;
  timestamp: string;
  status: "pending" | "completed" | "urgent";
  reportTitle?: string;
  reportDescription?: string;
}

interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  type: "defense" | "meeting" | "deadline" | "risk";
  location?: string;
  studentName?: string;
  studentCode?: string;
  riskLevel?: string;
  riskType?: string;
  itemCode?: string;
  topicCode?: string;
}

type ChartTab = "progress" | "overdue" | "topicType" | "reviewStatus";

function getChartStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    NOT_SUBMITTED: "#94a3b8",
    SUBMITTED: "#3b82f6",
    PENDING_REVIEW: "#f59e0b",
    APPROVED: "#22c55e",
    REJECTED: "#ef4444",
    PENDING: "#f59e0b",
    NEEDS_REVISION: "#f97316",
    RESEARCH: "#2563eb",
    DEVELOPMENT: "#8b5cf6",
    ACTIVE: "#10b981",
    CLOSED: "#64748b",
    OTHER: "#64748b",
  };
  return colorMap[status] || "#334155";
}

function translateStatus(status: string): string {
  const map: Record<string, string> = {
    NOT_SUBMITTED: "Chưa nộp",
    SUBMITTED: "Đã nộp",
    PENDING_REVIEW: "Chờ đánh giá",
    APPROVED: "Đã duyệt",
    REJECTED: "Đã từ chối",
    PENDING: "Chờ xử lý",
    NEEDS_REVISION: "Cần chỉnh sửa",
    RESEARCH: "Đang nghiên cứu",
    DEVELOPMENT: "Đang phát triển",
    ACTIVE: "Đang hoạt động",
    CLOSED: "Đã đóng",
    OTHER: "Khác",
  };
  const normalized = String(status || "").toUpperCase();
  return map[normalized] || status;
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

async function resolveLecturerCodeFromSession(
  userCode: string,
): Promise<string> {
  const cachedLecturerCode = normalizeText(getLecturerCode());
  if (cachedLecturerCode) {
    return cachedLecturerCode;
  }

  if (!userCode) {
    return "";
  }

  const lecturerProfileResponse = (await fetchData(
    `/LecturerProfiles/get-list?UserCode=${encodeURIComponent(userCode)}`,
  )) as ApiResponse<LecturerProfile[]>;
  const lecturerCode = normalizeText(
    lecturerProfileResponse.data?.[0]?.lecturerCode,
  );
  setLecturerCode(lecturerCode || null);
  return lecturerCode;
}

function formatTimestamp(value: unknown): string {
  const text = normalizeText(value);
  if (!text) return "--";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleString("vi-VN");
}

function formatDate(value: unknown): string {
  const text = normalizeText(value);
  if (!text) return "--";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString("vi-VN");
}

function getActivityIcon(type: string) {
  switch (type) {
    case "topic_submission":
      return <FileText size={16} color="#F37021" />;
    case "report_review":
      return <CheckCircle size={16} color="#22C55E" />;
    case "defense_scheduled":
      return <Calendar size={16} color="#F59E0B" />;
    case "committee_meeting":
      return <Users size={16} color="#8B5CF6" />;
    default:
      return <Bell size={16} color="#6B7280" />;
  }
}

function getActivityStatusColor(status: string) {
  switch (status) {
    case "pending":
      return "#F59E0B";
    case "completed":
      return "#22C55E";
    case "urgent":
      return "#EF4444";
    default:
      return "#6B7280";
  }
}

function resolveActivityType(row: DashboardRecord): RecentActivity["type"] {
  const value = normalizeText(
    readDashboardString(row, ["type", "category", "kind", "status"], ""),
  ).toLowerCase();
  if (value.includes("meeting") || value.includes("committee")) {
    return "committee_meeting";
  }
  if (value.includes("defense") || value.includes("schedule")) {
    return "defense_scheduled";
  }
  if (value.includes("review") || value.includes("report")) {
    return "report_review";
  }
  return "topic_submission";
}

function resolveActivityStatus(row: DashboardRecord): RecentActivity["status"] {
  const value = normalizeText(
    readDashboardString(row, ["status", "state", "activityStatus"], ""),
  ).toLowerCase();
  if (
    value.includes("urgent") ||
    value.includes("late") ||
    value.includes("overdue")
  ) {
    return "urgent";
  }
  if (
    value.includes("done") ||
    value.includes("complete") ||
    value.includes("approved")
  ) {
    return "completed";
  }
  return "pending";
}

function resolveActivityTitle(row: DashboardRecord): string {
  return (
    readDashboardString(row, ["reporttitle", "reportTitle"], "") ||
    readDashboardString(row, ["topictitle", "topicTitle"], "") ||
    "Hoạt động mới"
  );
}

function resolveActivityDescription(row: DashboardRecord): string {
  const student = readDashboardString(
    row,
    ["studentfullname", "studentFullName", "studentcode", "studentCode"],
    "",
  );
  const milestone = readDashboardString(
    row,
    ["milestonename", "milestoneName", "category"],
    "",
  );

  if (student && milestone) return `${student} - ${milestone}`;
  return student || milestone || "Hoạt động mới";
}

function resolveActivityTimestamp(row: DashboardRecord): string {
  return formatTimestamp(
    readDashboardString(
      row,
      ["submittedAt", "createdAt", "lastUpdated", "updatedAt"],
      "",
    ),
  );
}

function resolveEventType(row: DashboardRecord): UpcomingEvent["type"] {
  if (readDashboardString(row, ["risK_TYPE", "riskType", "risK_LEVEL"], ""))
    return "risk";
  const value = normalizeText(
    readDashboardString(row, ["type", "category", "kind", "status"], ""),
  ).toLowerCase();
  if (value.includes("meeting")) return "meeting";
  if (value.includes("deadline") || value.includes("due")) return "deadline";
  return "defense";
}

function resolveEventTitle(row: DashboardRecord): string {
  return (
    readDashboardString(row, ["topictitle", "topicTitle"], "") ||
    readDashboardString(
      row,
      ["itemCode", "iteM_CODE", "topicCode", "riskType"],
      "",
    ) ||
    readDashboardString(row, ["title", "name", "eventTitle"], "") ||
    "Sự kiện"
  );
}

function resolveEventTime(row: DashboardRecord): string {
  const value = readDashboardString(
    row,
    ["hourS_OVERDUE", "hours_overdue", "hoursOverdue", "time", "eventTime"],
    "",
  );
  if (value) {
    return value;
  }
  const timestamp = readDashboardString(
    row,
    ["deadline", "date", "defenseDate", "scheduledAt"],
    "",
  );
  if (!timestamp) return "--";
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildActivities(rows: DashboardRecord[]): RecentActivity[] {
  return rows.slice(0, 5).map((row, index) => ({
    id: `${index}-${resolveActivityTitle(row)}`,
    type: resolveActivityType(row),
    title: resolveActivityTitle(row),
    description: resolveActivityDescription(row),
    timestamp: resolveActivityTimestamp(row),
    status: resolveActivityStatus(row),
    reportTitle: readDashboardString(row, ["reporttitle", "reportTitle"], ""),
    reportDescription: readDashboardString(
      row,
      ["reportdescription", "reportDescription"],
      "",
    ),
  }));
}

function buildEvents(rows: DashboardRecord[]): UpcomingEvent[] {
  return rows.slice(0, 5).map((row, index) => ({
    id: `${index}-${resolveEventTitle(row)}`,
    title: resolveEventTitle(row),
    date: formatDate(
      readDashboardString(row, ["date", "defenseDate", "scheduledAt"], ""),
    ),
    time: resolveEventTime(row),
    type: resolveEventType(row),
    studentName: readDashboardString(
      row,
      ["studentfullname", "studentFullName"],
      "",
    ),
    studentCode: readDashboardString(row, ["studentcode", "studentCode"], ""),
    riskLevel: readDashboardString(row, ["risK_LEVEL", "riskLevel"], ""),
    riskType: readDashboardString(row, ["risK_TYPE", "riskType"], ""),
    itemCode: readDashboardString(
      row,
      ["iteM_CODE", "itemCode", "submissionCode"],
      "",
    ),
    topicCode: readDashboardString(row, ["topiccode", "topicCode"], ""),
  }));
}

const Dashboard: React.FC = () => {
  const auth = useAuth();
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const [lecturerCode, setLecturerCodeState] = useState("");
  const [overviewRows, setOverviewRows] = useState<DashboardRecord[]>([]);
  const [reviewRows, setReviewRows] = useState<DashboardRecord[]>([]);
  const [scoringRows, setScoringRows] = useState<DashboardRecord[]>([]);
  const [riskRows, setRiskRows] = useState<DashboardRecord[]>([]);
  const [workloadRows, setWorkloadRows] = useState<DashboardRecord[]>([]);
  const [defenseRows, setDefenseRows] = useState<DefenseScheduleRecord[]>([]);
  const [progressStatusRows, setProgressStatusRows] = useState<
    DashboardRecord[]
  >([]);
  const [overdueTrendRows, setOverdueTrendRows] = useState<DashboardRecord[]>(
    [],
  );
  const [topicTypeRows, setTopicTypeRows] = useState<DashboardRecord[]>([]);
  const [reviewStatusRows, setReviewStatusRows] = useState<DashboardRecord[]>(
    [],
  );
  const [activeChartTab, setActiveChartTab] = useState<ChartTab>("progress");
  const [daysRange, setDaysRange] = useState(30);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const lecturerCode = await resolveLecturerCodeFromSession(
          normalizeText(auth.user?.userCode),
        );
        const overviewQuery = lecturerCode ? { lecturerCode } : {};
        const listQuery = lecturerCode
          ? { lecturerCode, limit: 10 }
          : { limit: 10 };
        const workloadQuery = lecturerCode
          ? { lecturerCode, days: 30 }
          : { days: 30 };
        const chartQuery = lecturerCode ? { lecturerCode } : {};
        const overdueQuery = lecturerCode
          ? { lecturerCode, days: 30 }
          : { days: 30 };

        const [
          overviewResponse,
          reviewQueueResponse,
          scoringResponse,
          riskResponse,
          workloadResponse,
          defenseResponse,
          progressStatusResponse,
          overdueTrendResponse,
          topicTypeResponse,
          reviewStatusResponse,
        ] = await Promise.all([
          getLecturerOverview(overviewQuery),
          getLecturerReviewQueue(listQuery),
          getLecturerScoringProgress(listQuery),
          getLecturerDeadlineRisk(listQuery),
          getLecturerWorkloadSnapshot(workloadQuery),
          getLecturerDefenseSchedule(listQuery),
          getLecturerProgressStatusBreakdown(chartQuery),
          getLecturerOverdueTrend(overdueQuery),
          getLecturerTopicTypeBreakdown(chartQuery),
          getLecturerReviewStatusBreakdown(chartQuery),
        ]);

        if (cancelled) {
          return;
        }

        setLecturerCodeState(lecturerCode);
        setOverviewRows(
          normalizeDashboardItems<DashboardRecord>(
            normalizeDashboardResponse(overviewResponse),
          ),
        );
        setReviewRows(
          normalizeDashboardItems<DashboardRecord>(
            normalizeDashboardResponse(reviewQueueResponse),
          ),
        );
        setScoringRows(
          normalizeDashboardItems<DashboardRecord>(
            normalizeDashboardResponse(scoringResponse),
          ),
        );
        setRiskRows(
          normalizeDashboardItems<DashboardRecord>(
            normalizeDashboardResponse(riskResponse),
          ),
        );
        setWorkloadRows(
          normalizeDashboardItems<DashboardRecord>(
            normalizeDashboardResponse(workloadResponse),
          ),
        );
        setDefenseRows(
          normalizeDashboardItems<DefenseScheduleRecord>(
            normalizeDashboardResponse(defenseResponse),
          ),
        );
        setProgressStatusRows(
          normalizeDashboardItems<DashboardRecord>(
            normalizeDashboardResponse(progressStatusResponse),
          ),
        );
        setOverdueTrendRows(
          normalizeDashboardItems<DashboardRecord>(
            normalizeDashboardResponse(overdueTrendResponse),
          ),
        );
        setTopicTypeRows(
          normalizeDashboardItems<DashboardRecord>(
            normalizeDashboardResponse(topicTypeResponse),
          ),
        );
        setReviewStatusRows(
          normalizeDashboardItems<DashboardRecord>(
            normalizeDashboardResponse(reviewStatusResponse),
          ),
        );
      } catch (loadError) {
        if (!cancelled) {
          const errMsg =
            loadError instanceof Error
              ? loadError.message
              : "Không thể tải dữ liệu dashboard giảng viên.";
          console.error("[Lecturer Dashboard] Load error:", errMsg, loadError);
          setError(errMsg);
          setOverviewRows([]);
          setReviewRows([]);
          setScoringRows([]);
          setRiskRows([]);
          setWorkloadRows([]);
          setDefenseRows([]);
          setProgressStatusRows([]);
          setOverdueTrendRows([]);
          setTopicTypeRows([]);
          setReviewStatusRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [auth.user?.userCode]);

  useEffect(() => {
    let cancelled = false;
    console.log("[Dashboard] auth.user:", auth.user);
    console.log("[Dashboard] lecturerCode resolved:", lecturerCode);
    if (!lecturerCode) return;

    const refreshOverdueTrend = async () => {
      setChartLoading(true);
      setChartError(null);
      try {
        const response = await getLecturerOverdueTrend({
          lecturerCode,
          days: daysRange,
        });
        if (cancelled) return;
        setOverdueTrendRows(
          normalizeDashboardItems<DashboardRecord>(
            normalizeDashboardResponse(response),
          ),
        );
      } catch (fetchError) {
        if (!cancelled) {
          setChartError(
            fetchError instanceof Error
              ? fetchError.message
              : "Không thể tải dữ liệu xu hướng quá hạn.",
          );
        }
      } finally {
        if (!cancelled) {
          setChartLoading(false);
        }
      }
    };

    void refreshOverdueTrend();

    return () => {
      cancelled = true;
    };
  }, [daysRange, lecturerCode]);

  const stats = useMemo<DashboardStats>(() => {
    const overviewRow = overviewRows[0] ?? {};
    const scoringRow = scoringRows[0] ?? {};
    const workloadRow = workloadRows[0] ?? {};

    return {
      totalStudents: readDashboardNumber(
        overviewRow,
        ["currentguidingcount", "CURRENTGUIDINGCOUNT", "currentGuidingCount"],
        0,
      ),
      defenseParticipations: readDashboardNumber(
        overviewRow,
        ["currenT_DEFENSE_COUNT", "CURRENT_DEFENSE_COUNT"],
        0,
      ),
      pendingReviews: readDashboardNumber(
        overviewRow,
        [
          "progresS_PENDING_REVIEW",
          "PROGRESS_PENDING_REVIEW",
          "progressPendingReview",
        ],
        0,
      ),
      upcomingDefenses: readDashboardNumber(
        overviewRow,
        ["upcominG_DEFENSE_7D", "UPCOMING_DEFENSE_7D", "upcomingDefense7d"],
        0,
      ),
      completedReports:
        readDashboardNumber(
          overviewRow,
          ["HIGH_RISK_ITEMS", "highRiskItems"],
          readDashboardNumber(scoringRow, ["OVERDUE_COUNT", "overdueCount"], 0),
        ) ||
        readDashboardNumber(
          workloadRow,
          ["HIGH_RISK_ITEMS", "highRiskItems"],
          0,
        ),
    };
  }, [overviewRows, scoringRows, workloadRows]);

  const recentActivities = useMemo(
    () => buildActivities(reviewRows),
    [reviewRows],
  );
  const upcomingEvents = useMemo(() => buildEvents(riskRows), [riskRows]);

  const topicSummary = useMemo(() => {
    const grouped = new Map<string, { status: string; count: number }[]>();
    topicTypeRows.forEach((row) => {
      const topicType = readDashboardString(
        row,
        ["TOPIC_TYPE", "topicType"],
        "OTHER",
      );
      const topicStatus = readDashboardString(
        row,
        ["TOPIC_STATUS", "topicStatus"],
        "OTHER",
      );
      const count = readDashboardNumber(row, ["COUNT", "count"], 0);
      const current = grouped.get(topicType) ?? [];
      current.push({ status: topicStatus, count });
      grouped.set(topicType, current);
    });
    return [...grouped.entries()];
  }, [topicTypeRows]);

  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (activeChartTab === "progress") {
      const rawLabels = progressStatusRows.map((row) =>
        readDashboardString(row, ["STATUS", "status"], "OTHER"),
      );
      const translatedLabels = rawLabels.map((l) => translateStatus(l));
      const values = progressStatusRows.map((row) =>
        readDashboardNumber(row, ["COUNT", "count"], 0),
      );
      chartInstanceRef.current = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: translatedLabels,
          datasets: [
            {
              data: values,
              backgroundColor: rawLabels.map((label) =>
                getChartStatusColor(label),
              ),
              borderWidth: 2,
              borderColor: "#ffffff",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
        },
      });
      return;
    }

    if (activeChartTab === "overdue") {
      const labels = overdueTrendRows.map((row) =>
        formatDate(readDashboardString(row, ["DATE", "date"], "")),
      );
      const overdueData = overdueTrendRows.map((row) =>
        readDashboardNumber(row, ["OVERDUE_COUNT", "overdueCount"], 0),
      );
      const totalData = overdueTrendRows.map((row) =>
        readDashboardNumber(row, ["TOTAL_COUNT", "totalCount"], 0),
      );
      chartInstanceRef.current = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Quá hạn",
              data: overdueData,
              borderColor: "#ef4444",
              backgroundColor: "rgba(239, 68, 68, 0.2)",
              fill: true,
              tension: 0.3,
            },
            {
              label: "Tổng nộp",
              data: totalData,
              borderColor: "#2563eb",
              backgroundColor: "rgba(37, 99, 235, 0.15)",
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
          scales: { y: { beginAtZero: true } },
        },
      });
      return;
    }

    if (activeChartTab === "topicType") {
      const types = [
        ...new Set(
          topicTypeRows.map((row) =>
            readDashboardString(row, ["TOPIC_TYPE", "topicType"], "OTHER"),
          ),
        ),
      ];
      const rawStatuses = [
        ...new Set(
          topicTypeRows.map((row) =>
            readDashboardString(row, ["TOPIC_STATUS", "topicStatus"], "OTHER"),
          ),
        ),
      ];

      const datasets = rawStatuses.map((status) => ({
        label: translateStatus(status),
        data: types.map((type) => {
          const found = topicTypeRows.find(
            (row) =>
              readDashboardString(row, ["TOPIC_TYPE", "topicType"], "") ===
                type &&
              readDashboardString(row, ["TOPIC_STATUS", "topicStatus"], "") ===
                status,
          );
          return found ? readDashboardNumber(found, ["COUNT", "count"], 0) : 0;
        }),
        backgroundColor: getChartStatusColor(status),
      }));

      chartInstanceRef.current = new Chart(ctx, {
        type: "bar",
        data: { labels: types, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
          scales: { y: { beginAtZero: true } },
        },
      });
      return;
    }

    const rawReviewLabels = reviewStatusRows.map((row) =>
      readDashboardString(row, ["REVIEW_STATUS", "reviewStatus"], "OTHER"),
    );
    const translatedReviewLabels = rawReviewLabels.map((l) => translateStatus(l));
    const reviewCounts = reviewStatusRows.map((row) =>
      readDashboardNumber(row, ["COUNT", "count"], 0),
    );

    chartInstanceRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: translatedReviewLabels,
        datasets: [
          {
            label: "Số lượng",
            data: reviewCounts,
            backgroundColor: rawReviewLabels.map((status) =>
              getChartStatusColor(status),
            ),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: { y: { beginAtZero: true } },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [
    activeChartTab,
    progressStatusRows,
    overdueTrendRows,
    topicTypeRows,
    reviewStatusRows,
  ]);

  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return <div style={{ textAlign: "center", padding: 20 }}>Đang tải...</div>;
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: 20, color: "red" }}>
        {error}
      </div>
    );
  }

  return (
    <div
      className="dashboard-root"
      style={{
        padding: "32px",
        maxWidth: "1600px",
        margin: "0 auto",
        backgroundColor: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <style>{`
        :root {
          --primary: #F37021;
          --primary-light: #fff7ed;
          --secondary: #1e3a8a;
          --text-main: #0f172a;
          --text-muted: #64748b;
          --bg-card: #ffffff;
          --radius-lg: 24px;
          --radius-md: 16px;
          --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
          --shadow-md: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05);
          --shadow-lg: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
          --glass: rgba(255, 255, 255, 0.7);
          --glass-border: rgba(255, 255, 255, 0.4);
        }

        .dashboard-root {
          font-family: 'Be Vietnam Pro', sans-serif;
          color: var(--text-main);
        }

        .bento-grid {
          display: grid;
          grid-template-columns: repeat(20, 1fr);
          gap: 24px;
        }

        .premium-card {
          background: var(--bg-card);
          border-radius: var(--radius-md);
          padding: 24px;
          border: 1px solid rgba(226, 232, 240, 0.8);
          box-shadow: var(--shadow-md);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .premium-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
          border-color: var(--primary);
        }


        .stat-box {
          grid-column: span 5;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 180px;
        }

        .stat-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }

        .activity-section {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .event-section {
          flex: 0.8; /* Reduced height as requested */
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .right-stack {
          grid-column: span 8;
          display: flex;
          flex-direction: column;
          gap: 24px;
          height: 600px;
        }

        .defense-section {
          grid-column: span 20;
        }

        .scroll-container {
          flex: 1;
          overflow-y: auto;
          padding-right: 4px;
        }

        .scroll-container::-webkit-scrollbar {
          width: 5px;
        }
        .scroll-container::-webkit-scrollbar-track {
          background: transparent;
        }
        .scroll-container::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }


        .activity-item {
          padding: 16px;
          border-radius: var(--radius-md);
          background: #f8fafc;
          border: 1px solid transparent;
          transition: all 0.2s ease;
          display: flex;
          gap: 16px;
          margin-bottom: 12px;
        }

        .activity-item:hover {
          background: white;
          border-color: #e2e8f0;
          box-shadow: var(--shadow-sm);
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .btn-action {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: white;
          color: var(--text-main);
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-action:hover {
          background: var(--primary-light);
          border-color: var(--primary);
          color: var(--primary);
        }

        .chart-tab-section {
          grid-column: span 12;
          height: 600px;
          display: flex;
          flex-direction: column;
        }

        .chart-tabs {
          display: flex;
          border-bottom: 1px solid #e2e8f0;
          overflow-x: auto;
          margin-bottom: 16px;
        }

        .chart-tab-btn {
          border: none;
          background: transparent;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          white-space: nowrap;
        }

        .chart-tab-btn.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
          background: #fff7ed;
        }

        .chart-panel {
          background: #fff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 16px;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .chart-canvas-wrap {
          height: 360px;
          margin-top: 8px;
        }

        .chart-meta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
          margin-top: 14px;
          max-height: 120px;
          overflow-y: auto;
        }
        .chart-meta-grid::-webkit-scrollbar { width: 4px; }
        .chart-meta-grid::-webkit-scrollbar-thumb { background: #f1f5f9; border-radius: 4px; }

        .chart-meta-item {
          padding: 10px 12px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          font-size: 13px;
          color: #334155;
        }

        .days-input {
          width: 88px;
          padding: 6px 8px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          font-size: 13px;
          margin-left: 8px;
        }

        @media (max-width: 1280px) {
          .bento-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .stat-box, .chart-tab-section, .right-stack, .defense-section { grid-column: span 2; }
          .stat-box { grid-column: span 1; }
          .chart-tab-section, .right-stack { height: auto; }
        }

        @media (max-width: 768px) {
          .bento-grid {
            grid-template-columns: 1fr;
          }
          .activity-section, .stat-box, .event-section, .chart-tab-section, .defense-section, .right-stack { grid-column: span 1; }
          .chart-canvas-wrap { height: 300px; }
        }
      `}</style>

      {/* Bento Grid */}
      <div className="bento-grid">
        {/* Stats Cards */}
        <div className="premium-card stat-box">
          <div
            className="stat-icon-wrapper"
            style={{ background: "#eff6ff", color: "#3b82f6" }}
          >
            <Users size={24} />
          </div>
          <div>
            <div
              style={{ fontSize: "36px", fontWeight: "800", color: "#1e293b" }}
            >
              {stats.totalStudents}
            </div>
            <div
              style={{
                color: "var(--text-muted)",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              Sinh viên hướng dẫn
            </div>
          </div>
          <div
            style={{
              height: "4px",
              background: "#3b82f6",
              borderRadius: "2px",
              width: "60%",
            }}
          />
        </div>

        <div className="premium-card stat-box">
          <div
            className="stat-icon-wrapper"
            style={{ background: "#f0fdf4", color: "#22c55e" }}
          >
            <CheckCircle size={24} />
          </div>
          <div>
            <div
              style={{ fontSize: "36px", fontWeight: "800", color: "#1e293b" }}
            >
              {stats.defenseParticipations}
            </div>
            <div
              style={{
                color: "var(--text-muted)",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              Tham gia bảo vệ
            </div>
          </div>
          <div
            style={{
              height: "4px",
              background: "#22c55e",
              borderRadius: "2px",
              width: "40%",
            }}
          />
        </div>

        <div className="premium-card stat-box">
          <div
            className="stat-icon-wrapper"
            style={{ background: "#fffbeb", color: "#f59e0b" }}
          >
            <Clock size={24} />
          </div>
          <div>
            <div
              style={{ fontSize: "36px", fontWeight: "800", color: "#1e293b" }}
            >
              {stats.pendingReviews}
            </div>
            <div
              style={{
                color: "var(--text-muted)",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              Chờ đánh giá
            </div>
          </div>
          <div
            style={{
              height: "4px",
              background: "#f59e0b",
              borderRadius: "2px",
              width: "80%",
            }}
          />
        </div>

        <div className="premium-card stat-box">
          <div
            className="stat-icon-wrapper"
            style={{ background: "#f5f3ff", color: "#8b5cf6" }}
          >
            <Calendar size={24} />
          </div>
          <div>
            <div
              style={{ fontSize: "36px", fontWeight: "800", color: "#1e293b" }}
            >
              {stats.upcomingDefenses}
            </div>
            <div
              style={{
                color: "var(--text-muted)",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              Lịch bảo vệ (7n)
            </div>
          </div>
          <div
            style={{
              height: "4px",
              background: "#8b5cf6",
              borderRadius: "2px",
              width: "30%",
            }}
          />
        </div>

        <div className="premium-card chart-tab-section">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "700",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <FileText size={20} color="var(--primary)" />
              Biểu đồ phân tích
            </h2>
            {activeChartTab === "overdue" && (
              <label
                style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}
              >
                Số ngày:
                <input
                  className="days-input"
                  type="number"
                  min={1}
                  max={365}
                  value={daysRange}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    if (!Number.isFinite(parsed)) return;
                    setDaysRange(Math.min(365, Math.max(1, parsed)));
                  }}
                />
              </label>
            )}
          </div>

          <div
            className="chart-tabs"
            role="tablist"
            aria-label="Dashboard chart tabs"
          >
            {[
              { id: "progress" as const, label: "Trạng thái báo cáo" },
              { id: "overdue" as const, label: "Xu hướng quá hạn" },
              { id: "topicType" as const, label: "Loại đề tài" },
              { id: "reviewStatus" as const, label: "Trạng thái chấm" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`chart-tab-btn ${activeChartTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveChartTab(tab.id)}
                role="tab"
                aria-selected={activeChartTab === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="chart-panel">
            {chartError && (
              <div style={{ marginBottom: 8, color: "#dc2626", fontSize: 13 }}>
                {chartError}
              </div>
            )}
            {chartLoading && activeChartTab === "overdue" && (
              <div style={{ marginBottom: 8, color: "#334155", fontSize: 13 }}>
                Đang tải dữ liệu xu hướng quá hạn...
              </div>
            )}

            <div className="chart-canvas-wrap">
              <canvas ref={chartCanvasRef} />
            </div>

            {activeChartTab === "progress" && (
              <div className="chart-meta-grid">
                {progressStatusRows.map((row, index) => {
                  const status = readDashboardString(
                    row,
                    ["STATUS", "status"],
                    "OTHER",
                  );
                  const count = readDashboardNumber(row, ["COUNT", "count"], 0);
                  return (
                    <div key={`${status}-${index}`} className="chart-meta-item">
                      <span
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: getChartStatusColor(status),
                          marginRight: 8,
                        }}
                      />
                      {translateStatus(status)}: {count}
                    </div>
                  );
                })}
              </div>
            )}

            {activeChartTab === "topicType" && (
              <div className="chart-meta-grid">
                {topicSummary.map(([type, entries]) => (
                  <div key={type} className="chart-meta-item">
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      {type}
                    </div>
                    {entries.map((entry) => (
                      <div
                        key={`${type}-${entry.status}`}
                        style={{ fontSize: 12, color: "#475569" }}
                      >
                        {translateStatus(entry.status)}: {entry.count}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {activeChartTab === "reviewStatus" && (
              <div className="chart-meta-grid">
                {reviewStatusRows.map((row, index) => {
                  const status = readDashboardString(
                    row,
                    ["REVIEW_STATUS", "reviewStatus"],
                    "OTHER",
                  );
                  const count = readDashboardNumber(row, ["COUNT", "count"], 0);
                  const avgDays = readDashboardNumber(
                    row,
                    ["AVG_DAYS_WAITING", "avgDaysWaiting"],
                    0,
                  );
                  return (
                    <div key={`${status}-${index}`} className="chart-meta-item">
                      <div style={{ fontWeight: 700 }}>{translateStatus(status)}</div>
                      <div>Số lượng: {count}</div>
                      <div>Chờ TB: {avgDays} ngày</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="right-stack">
          <div className="premium-card event-section">
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "700",
                marginBottom: "16px",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <AlertTriangle size={20} color="#EF4444" />
              Cảnh báo
            </h2>

            <div className="scroll-container">
              {upcomingEvents.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                  Không có cảnh báo nào
                </p>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      style={{
                        position: "relative",
                        background: "white",
                        padding: "12px",
                        borderRadius: "12px",
                        border: "1px solid #f1f5f9",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                        overflow: "hidden",
                      }}
                    >
                      {/* Status Indicator Bar */}
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: "4px",
                          background:
                            event.riskLevel === "HIGH" ? "#EF4444" : "#F59E0B",
                        }}
                      />

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: "8px",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: "700",
                            fontSize: "13px",
                            color: "#1e293b",
                            lineHeight: "1.4",
                            flex: 1,
                            paddingRight: "8px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {event.title}
                        </div>
                        <div
                          style={{
                            fontSize: "9px",
                            fontWeight: "800",
                            color:
                              event.riskLevel === "HIGH"
                                ? "#EF4444"
                                : "#B45309",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            background:
                              event.riskLevel === "HIGH"
                                ? "#FEF2F2"
                                : "#FFFBEB",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {event.riskLevel === "HIGH" ? "Rủi ro" : "Chú ý"}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <div
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "50%",
                              background: "#f1f5f9",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              color: "#64748b",
                              fontWeight: "700",
                            }}
                          >
                            {event.studentName?.charAt(0)}
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#475569",
                              fontWeight: "600",
                            }}
                          >
                            {event.studentName}
                          </div>
                        </div>

                        {event.time && (
                          <div
                            style={{
                              fontSize: "10px",
                              color:
                                event.riskLevel === "HIGH"
                                  ? "#EF4444"
                                  : "#D97706",
                              fontWeight: "700",
                            }}
                          >
                            Trễ: {event.time}h
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Activities Section */}
          <div className="premium-card activity-section">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: "700",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <FileText size={20} color="var(--primary)" />
                Báo cáo gần đây
              </h2>
              <button
                style={{
                  border: "none",
                  background: "none",
                  color: "var(--primary)",
                  fontWeight: "600",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Xem tất cả
              </button>
            </div>

            <div className="scroll-container">
              {recentActivities.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px",
                    color: "var(--text-muted)",
                  }}
                >
                  <FileText
                    size={32}
                    style={{ opacity: 0.2, marginBottom: "12px" }}
                  />
                  <p style={{ fontSize: "13px" }}>Chưa có báo cáo mới.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {recentActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="activity-item"
                      style={{ padding: "12px", gap: "12px" }}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          background: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                        }}
                      >
                        {getActivityIcon(activity.type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "2px",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: "600",
                              fontSize: "14px",
                              color: "var(--text-main)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "70%",
                            }}
                          >
                            {activity.title}
                          </span>
                          <span
                            className="status-badge"
                            style={{
                              padding: "2px 8px",
                              fontSize: "10px",
                              background: `${getActivityStatusColor(activity.status)}15`,
                              color: getActivityStatusColor(activity.status),
                            }}
                          >
                            {activity.status}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "13px",
                            color: "var(--text-muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {activity.description}
                        </p>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#94a3b8",
                            marginTop: "4px",
                          }}
                        >
                          {activity.timestamp}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Defense Schedule Table Section */}
        <div
          className="premium-card defense-section"
          style={{ background: "white", padding: "24px" }}
        >
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "700",
              marginBottom: "20px",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <UserCheck size={20} color="var(--primary)" />
            Lịch bảo vệ hội đồng
          </h2>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: "10px",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "2px solid #f1f5f9",
                    textAlign: "left",
                  }}
                >
                  <th
                    style={{
                      padding: "12px 8px",
                      fontSize: "13px",
                      color: "#64748b",
                      fontWeight: "600",
                    }}
                  >
                    SINH VIÊN
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      fontSize: "13px",
                      color: "#64748b",
                      fontWeight: "600",
                    }}
                  >
                    ĐỀ TÀI
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      fontSize: "13px",
                      color: "#64748b",
                      fontWeight: "600",
                    }}
                  >
                    HỘI ĐỒNG
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      fontSize: "13px",
                      color: "#64748b",
                      fontWeight: "600",
                    }}
                  >
                    THỜI GIAN
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      fontSize: "13px",
                      color: "#64748b",
                      fontWeight: "600",
                    }}
                  >
                    VAI TRÒ
                  </th>
                </tr>
              </thead>
              <tbody>
                {defenseRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: "40px",
                        textAlign: "center",
                        color: "#94a3b8",
                        fontSize: "14px",
                      }}
                    >
                      Chưa có lịch bảo vệ nào được sắp xếp
                    </td>
                  </tr>
                ) : (
                  defenseRows.slice(0, 5).map((row, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background 0.2s",
                      }}
                      onMouseOver={(e) =>
                        (e.currentTarget.style.background = "#f8fafc")
                      }
                      onMouseOut={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td
                        style={{
                          padding: "16px 8px",
                          fontSize: "14px",
                          fontWeight: "600",
                          color: "#1e293b",
                        }}
                      >
                        {readDashboardString(
                          row,
                          ["studentfullname", "studentFullName", "studentName"],
                          "N/A",
                        )}
                      </td>
                      <td
                        style={{
                          padding: "16px 8px",
                          fontSize: "13px",
                          color: "#475569",
                          maxWidth: "250px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {readDashboardString(
                          row,
                          ["topictitle", "topicTitle", "title"],
                          "N/A",
                        )}
                      </td>
                      <td
                        style={{
                          padding: "16px 8px",
                          fontSize: "13px",
                          color: "#64748b",
                        }}
                      >
                        <div
                          style={{ fontWeight: "600", color: "var(--primary)" }}
                        >
                          {readDashboardString(
                            row,
                            ["committeename", "committeeName", "name"],
                            "Hội đồng",
                          )}
                        </div>
                        <div style={{ fontSize: "11px" }}>
                          Phòng:{" "}
                          {readDashboardString(
                            row,
                            ["roomcode", "roomCode", "location"],
                            "N/A",
                          )}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "16px 8px",
                          fontSize: "13px",
                          color: "#1e293b",
                        }}
                      >
                        {formatDate(
                          readDashboardString(
                            row,
                            ["defensedate", "defenseDate", "date"],
                            "",
                          ),
                        )}
                      </td>
                      <td style={{ padding: "16px 8px" }}>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: "700",
                            background: "#eff6ff",
                            color: "#3b82f6",
                          }}
                        >
                          {readDashboardString(
                            row,
                            ["lecturerrole", "lecturerRole", "role"],
                            "UV",
                          )}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
