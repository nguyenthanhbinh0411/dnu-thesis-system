/*
import React from "react";
import {
  Users,
  BookOpen,
  FileText,
  CalendarDays,
  Bell,
  TrendingUp,
  Shield,
} from "lucide-react";
import DefenseTermQuickInfo from "../../components/admin/DefenseTermQuickInfo";
import "./Dashboard.css";

// ==========================================
// MOCK DATA - Dữ liệu mẫu để minh họa
// Sau này thay bằng API thực từ backend
// ==========================================

interface StatCard {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "orange" | "blue" | "green" | "purple";
}

interface ChartData {
  label: string;
  value: number;
  color: string;
  colorLight: string;
}

interface RecentTopic {
  title: string;
  student: string;
  lecturer: string;
  status: "in-progress" | "pending" | "approved";
  statusText: string;
}

interface Notification {
  title: string;
  desc: string;
  date: string;
}

// Mock Stats Data - Nâng cấp với số liệu nghiêm túc hơn
const mockStats: StatCard[] = [
  {
    label: "TỔNG SỐ SINH VIÊN",
    value: 487,
    icon: <Users size={28} />,
    color: "orange",
  },
  {
    label: "ĐỀ TÀI ĐANG THỰC HIỆN",
    value: 67,
    icon: <BookOpen size={28} />,
    color: "blue",
  },
  {
    label: "BÁO CÁO TUẦN NÀY",
    value: 189,
    icon: <FileText size={28} />,
    color: "green",
  },
  {
    label: "LỊCH BẢO VỆ SẮP TỚI",
    value: 12,
    icon: <CalendarDays size={28} />,
    color: "purple",
  },
];

// Mock Chart Data - Tiến độ hoàn thành đồ án (Nghiêm túc hơn)
const mockChartData: ChartData[] = [
  {
    label: "ĐANG THỰC HIỆN",
    value: 67,
    color: "#f37021",
    colorLight: "#ff9a56",
  },
  {
    label: "ĐÃ HOÀN THÀNH",
    value: 42,
    color: "#2e7d32",
    colorLight: "#4caf50",
  },
  {
    label: "QUÁ HẠN",
    value: 23,
    color: "#ef4444",
    colorLight: "#f87171",
  },
  {
    label: "CHỜ DUYỆT",
    value: 18,
    color: "#f59e0b",
    colorLight: "#fbbf24",
  },
];

// Mock Recent Topics Data - Dữ liệu nghiêm túc hơn
const mockRecentTopics: RecentTopic[] = [
  {
    title: "HỆ THỐNG QUẢN LÝ AN NINH MẠNG DOANH NGHIỆP",
    student: "Nguyễn Văn Đức (SV2024001)",
    lecturer: "PGS.TS Trần Minh Hòa",
    status: "in-progress",
    statusText: "ĐANG THỰC HIỆN",
  },
  {
    title: "ỨNG DỤNG AI TRONG PHÂN TÍCH DỮ LIỆU LỚN",
    student: "Trần Thị Lan (SV2024002)",
    lecturer: "TS. Nguyễn Thu Hà",
    status: "pending",
    statusText: "CHỜ DUYỆT",
  },
  {
    title: "TỐI ƯU HÓA CƠ SỞ DỮ LIỆU PHÂN TÁN",
    student: "Lê Văn Tùng (SV2024003)",
    lecturer: "ThS. Phạm Anh Dũng",
    status: "approved",
    statusText: "ĐÃ DUYỆT",
  },
  {
    title: "HỆ THỐNG IOT CHO NHÀ THÔNG MINH",
    student: "Hoàng Thị Mai (SV2024004)",
    lecturer: "TS. Trần Minh Hòa",
    status: "in-progress",
    statusText: "ĐANG THỰC HIỆN",
  },
  {
    title: "PHÁT TRIỂN ỨNG DỤNG DI ĐỘNG CHO GIÁO DỤC",
    student: "Phạm Văn Hùng (SV2024005)",
    lecturer: "ThS. Lê Thanh Tùng",
    status: "pending",
    statusText: "CHỜ DUYỆT",
  },
];

// Mock Notifications Data - Thông báo nghiêm túc hơn
const mockNotifications: Notification[] = [
  {
    title: "HỘI ĐỒNG BẢO VỆ KỲ 2025.2",
    desc: "Dự kiến tổ chức từ 15/12/2025 - 20/12/2025",
    date: "07/10/2025",
  },
  {
    title: "HẠN NỘP BÁO CÁO TIẾN ĐỘ THÁNG 10",
    desc: "Tất cả sinh viên phải nộp báo cáo trước 23:59 ngày 25/10/2025",
    date: "06/10/2025",
  },
  {
    title: "CUỘC HỌP HỘI ĐỒNG XÉT DUYỆT ĐỀ TÀI",
    desc: "Lịch họp ngày 12/10/2025 tại phòng A101",
    date: "05/10/2025",
  },
  {
    title: "THÔNG BÁO VỀ QUY TRÌNH BẢO VỆ",
    desc: "Cập nhật quy trình bảo vệ luận văn tốt nghiệp 2025",
    date: "04/10/2025",
  },
  {
    title: "HẠN CUỐI ĐĂNG KÝ ĐỀ TÀI",
    desc: "Sinh viên chưa đăng ký đề tài vui lòng hoàn thành trước 15/10/2025",
    date: "03/10/2025",
  },
];

const Dashboard: React.FC = () => {
  // Calculate max value for chart scaling
  const maxChartValue = Math.max(...mockChartData.map((d) => d.value));

  return (
    <div className="admin-dashboard">
      {/* Dashboard Header * /}
      <div className="dashboard-header">
        <h1>
          <Shield size={40} style={{ marginRight: 16 }} />
          BẢNG ĐIỀU KHIỂN QUẢN TRỊ VIÊN
        </h1>
        <p>TỔNG QUAN HOẠT ĐỘNG VÀ DỮ LIỆU HỆ THỐNG ĐỒ ÁN TỐT NGHIỆP</p>
      </div>

      <DefenseTermQuickInfo
        roleLabel="Quản trị viên"
        termCode="2026.1"
        termName="Đợt đồ án tốt nghiệp HK2 năm học 2025-2026"
        roundIndex={1}
        status="Preparing"
      />

      {/* Stats Cards Grid * /}
      <div className="stats-grid">
        {mockStats.map((stat, index) => (
          <div key={index} className={`stat-card ${stat.color}`}>
            <div className="stat-card-header">
              <div className={`stat-card-icon ${stat.color}`}>{stat.icon}</div>
            </div>
            <div className="stat-card-label">{stat.label}</div>
            <div className="stat-card-value">{stat.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Content Grid: Chart + Notifications * /}
      <div className="dashboard-content">
        {/* Progress Chart Section * /}
        <div className="chart-section">
          <h2>
            <TrendingUp
              size={24}
              style={{ marginRight: 12, color: "#f37021" }}
            />
            TIẾN ĐỘ HOÀN THÀNH ĐỒ ÁN
          </h2>
          <div className="chart-container">
            <div className="bar-chart">
              {mockChartData.map((item, index) => {
                const barHeight = (item.value / maxChartValue) * 250; // 250px max height
                return (
                  <div key={index} className="bar-item">
                    <div
                      className="bar"
                      style={{
                        height: `${Math.max(barHeight, 20)}px`,
                        background: `linear-gradient(to top, ${item.color}, ${item.colorLight})`,
                        minHeight: "20px",
                      }}
                    >
                      <div className="bar-value">{item.value}</div>
                    </div>
                    <div className="bar-label">{item.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Notifications Section * /}
        <div className="notifications-section">
          <h2>
            <Bell size={24} style={{ color: "#f37021" }} />
            THÔNG BÁO HỆ THỐNG
          </h2>
          <div className="notifications-list">
            {mockNotifications.map((notif, index) => (
              <div key={index} className="notification-item">
                <div className="notification-title">{notif.title}</div>
                <div className="notification-desc">{notif.desc}</div>
                <div className="notification-date">📅 {notif.date}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Topics Table * /}
      <div className="recent-topics-section">
        <h2>ĐỀ TÀI MỚI NHẤT</h2>
        <table className="topics-table">
          <thead>
            <tr>
              <th>TÊN ĐỀ TÀI</th>
              <th>SINH VIÊN</th>
              <th>GIẢNG VIÊN HƯỚNG DẪN</th>
              <th>TRẠNG THÁI</th>
            </tr>
          </thead>
          <tbody>
            {mockRecentTopics.map((topic, index) => (
              <tr key={index}>
                <td style={{ maxWidth: "350px", fontWeight: "600" }}>
                  {topic.title}
                </td>
                <td style={{ fontWeight: "500" }}>{topic.student}</td>
                <td style={{ fontWeight: "500" }}>{topic.lecturer}</td>
                <td>
                  <span className={`status-badge ${topic.status}`}>
                    {topic.statusText}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
*/

import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Bell,
  FileText,
  Shield,
  TrendingUp,
  CalendarDays,
  Users,
} from "lucide-react";
import {
  getAdminCouncilCapacity,
  getAdminOverview,
  getAdminPeriodFunnel,
  getAdminPeriodSnapshot,
  getAdminScoreQuality,
  getAdminSecurityAudit,
  getAdminSlaBottleneck,
  getDailyKpiByRole,
  getSlaBreachDaily,
  normalizeDashboardItems,
  normalizeDashboardResponse,
  readDashboardNumber,
  readDashboardString,
  type DashboardRecord,
} from "../../services/dashboard.service";
import "./Dashboard.css";

type StatCardColor = "orange" | "blue" | "green" | "purple";

interface StatCard {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: StatCardColor;
}

interface ChartData {
  label: string;
  value: number;
  color: string;
  colorLight: string;
}

interface RecentTopic {
  title: string;
  student: string;
  lecturer: string;
  status: "in-progress" | "pending" | "approved" | "overdue";
  statusText: string;
}

interface NotificationItem {
  title: string;
  desc: string;
  date: string;
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getStatusBucket(value: unknown): RecentTopic["status"] {
  const normalized = normalizeText(value).toLowerCase();
  if (
    normalized.includes("done") ||
    normalized.includes("approved") ||
    normalized.includes("complete")
  ) {
    return "approved";
  }
  if (normalized.includes("overdue") || normalized.includes("late")) {
    return "overdue";
  }
  if (normalized.includes("pending") || normalized.includes("review")) {
    return "pending";
  }
  return "in-progress";
}

function getStatusText(status: RecentTopic["status"]): string {
  switch (status) {
    case "approved":
      return "ĐÃ DUYỆT";
    case "overdue":
      return "QUÁ HẠN";
    case "pending":
      return "CHỜ DUYỆT";
    default:
      return "ĐANG THỰC HIỆN";
  }
}

function getStatusColor(status: RecentTopic["status"]): string {
  switch (status) {
    case "approved":
      return "approved";
    case "overdue":
      return "pending";
    case "pending":
      return "pending";
    default:
      return "in-progress";
  }
}

function formatDisplayDate(value: unknown): string {
  const text = normalizeText(value);
  if (!text) return "--";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }
  return parsed.toLocaleDateString("vi-VN");
}

function resolveTitle(row: DashboardRecord): string {
  return (
    readDashboardString(
      row,
      ["defenseTermName", "committeeName", "moduleName", "kpiName"],
      "",
    ) ||
    readDashboardString(row, ["title", "topicTitle", "topicName"], "") ||
    "--"
  );
}

function resolveStudent(row: DashboardRecord): string {
  const fullName = readDashboardString(
    row,
    ["room", "metricDate", "snapDate", "date"],
    "",
  );
  const code = readDashboardString(
    row,
    ["assignmentCount", "breachCount", "failedCount", "totalCount"],
    "",
  );
  if (fullName && code) {
    return `${fullName} (${code})`;
  }
  return fullName || code || "--";
}

function resolveLecturer(row: DashboardRecord): string {
  const fullName = readDashboardString(
    row,
    ["committeeCode", "moduleName", "roleName", "committeeName"],
    "",
  );
  const code = readDashboardString(
    row,
    ["loadRatio", "kpiValue", "memberCount"],
    "",
  );
  if (fullName && code) {
    return `${fullName} (${code})`;
  }
  return fullName || code || "--";
}

function resolveNotificationTitle(row: DashboardRecord): string {
  return (
    readDashboardString(
      row,
      ["moduleName", "actionType", "userCode", "kpiName"],
      "",
    ) ||
    readDashboardString(row, ["title", "notifTitle", "name", "message"], "") ||
    "Thông báo"
  );
}

function resolveNotificationDesc(row: DashboardRecord): string {
  return (
    readDashboardString(
      row,
      [
        "failedCount",
        "breachCount",
        "totalCount",
        "assignmentCount",
        "kpiValue",
      ],
      "",
    ) ||
    readDashboardString(
      row,
      ["desc", "description", "message", "content"],
      "",
    ) ||
    "--"
  );
}

function resolveNotificationDate(row: DashboardRecord): string {
  return formatDisplayDate(
    readDashboardString(
      row,
      ["metricDate", "snapDate", "date", "createdAt", "lastUpdated"],
      "",
    ),
  );
}

function buildChartData(rows: DashboardRecord[]): ChartData[] {
  type StatusBuckets = {
    "in-progress": number;
    pending: number;
    approved: number;
    overdue: number;
  };

  const buckets = rows.reduce<StatusBuckets>(
    (acc, row) => {
      const status = getStatusBucket(
        readDashboardString(row, ["status", "topicStatus", "state"], ""),
      );
      acc[status] += 1;
      return acc;
    },
    {
      "in-progress": 0,
      pending: 0,
      approved: 0,
      overdue: 0,
    } as Record<RecentTopic["status"], number>,
  );

  return [
    {
      label: "ĐANG THỰC HIỆN",
      value: buckets["in-progress"],
      color: "#f37021",
      colorLight: "#ff9a56",
    },
    {
      label: "ĐÃ HOÀN THÀNH",
      value: buckets.approved,
      color: "#2e7d32",
      colorLight: "#4caf50",
    },
    {
      label: "QUÁ HẠN",
      value: buckets.overdue,
      color: "#ef4444",
      colorLight: "#f87171",
    },
    {
      label: "CHỜ DUYỆT",
      value: buckets.pending,
      color: "#f59e0b",
      colorLight: "#fbbf24",
    },
  ];
}

function toRecentTopics(rows: DashboardRecord[]): RecentTopic[] {
  return rows.slice(0, 5).map((row) => {
    const status = getStatusBucket(
      readDashboardString(row, ["status", "topicStatus", "state"], ""),
    );
    return {
      title: resolveTitle(row),
      student: resolveStudent(row),
      lecturer: resolveLecturer(row),
      status,
      statusText: getStatusText(status),
    };
  });
}

function toNotifications(rows: DashboardRecord[]): NotificationItem[] {
  return rows.slice(0, 5).map((row) => ({
    title: resolveNotificationTitle(row),
    desc: resolveNotificationDesc(row),
    date: resolveNotificationDate(row),
  }));
}

const Dashboard: React.FC = () => {
  const [overviewRows, setOverviewRows] = useState<DashboardRecord[]>([]);
  const [funnelRows, setFunnelRows] = useState<DashboardRecord[]>([]);
  const [capacityRows, setCapacityRows] = useState<DashboardRecord[]>([]);
  const [qualityRows, setQualityRows] = useState<DashboardRecord[]>([]);
  const [bottleneckRows, setBottleneckRows] = useState<DashboardRecord[]>([]);
  const [auditRows, setAuditRows] = useState<DashboardRecord[]>([]);
  const [dailyKpiRows, setDailyKpiRows] = useState<DashboardRecord[]>([]);
  const [periodRows, setPeriodRows] = useState<DashboardRecord[]>([]);
  const [breachRows, setBreachRows] = useState<DashboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const [
          overviewResponse,
          funnelResponse,
          capacityResponse,
          qualityResponse,
          bottleneckResponse,
          auditResponse,
          dailyKpiResponse,
          periodResponse,
          breachResponse,
        ] = await Promise.all([
          getAdminOverview(),
          getAdminPeriodFunnel({ limit: 8 }),
          getAdminCouncilCapacity({ limit: 8 }),
          getAdminScoreQuality(),
          getAdminSlaBottleneck({ days: 30 }),
          getAdminSecurityAudit({ days: 30, limit: 8 }),
          getDailyKpiByRole({ days: 30 }),
          getAdminPeriodSnapshot({ days: 30 }),
          getSlaBreachDaily({ days: 30 }),
        ]);

        if (cancelled) {
          return;
        }

        const overviewEnvelope = normalizeDashboardResponse(overviewResponse);
        const funnelEnvelope = normalizeDashboardResponse(funnelResponse);
        const capacityEnvelope = normalizeDashboardResponse(capacityResponse);
        const qualityEnvelope = normalizeDashboardResponse(qualityResponse);
        const bottleneckEnvelope =
          normalizeDashboardResponse(bottleneckResponse);
        const auditEnvelope = normalizeDashboardResponse(auditResponse);
        const dailyKpiEnvelope = normalizeDashboardResponse(dailyKpiResponse);
        const periodEnvelope = normalizeDashboardResponse(periodResponse);
        const breachEnvelope = normalizeDashboardResponse(breachResponse);

        setOverviewRows(
          normalizeDashboardItems<DashboardRecord>(overviewEnvelope),
        );
        setFunnelRows(normalizeDashboardItems<DashboardRecord>(funnelEnvelope));
        setCapacityRows(
          normalizeDashboardItems<DashboardRecord>(capacityEnvelope),
        );
        setQualityRows(
          normalizeDashboardItems<DashboardRecord>(qualityEnvelope),
        );
        setBottleneckRows(
          normalizeDashboardItems<DashboardRecord>(bottleneckEnvelope),
        );
        setAuditRows(normalizeDashboardItems<DashboardRecord>(auditEnvelope));
        setDailyKpiRows(
          normalizeDashboardItems<DashboardRecord>(dailyKpiEnvelope),
        );
        setPeriodRows(normalizeDashboardItems<DashboardRecord>(periodEnvelope));
        setBreachRows(normalizeDashboardItems<DashboardRecord>(breachEnvelope));
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Không thể tải dữ liệu dashboard quản trị.",
          );
          setOverviewRows([]);
          setFunnelRows([]);
          setCapacityRows([]);
          setQualityRows([]);
          setBottleneckRows([]);
          setAuditRows([]);
          setDailyKpiRows([]);
          setPeriodRows([]);
          setBreachRows([]);
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
  }, []);

  const recentTopics = useMemo(
    () => toRecentTopics(capacityRows),
    [capacityRows],
  );
  const notifications = useMemo(() => toNotifications(auditRows), [auditRows]);
  const chartData = useMemo(
    () => buildChartData(funnelRows.length > 0 ? funnelRows : breachRows),
    [breachRows, funnelRows],
  );
  const maxChartValue = Math.max(1, ...chartData.map((item) => item.value));

  const insights = useMemo(() => {
    const qualityRow = qualityRows[0] ?? {};
    const kpiRow = dailyKpiRows[0] ?? {};
    const periodRow = periodRows[0] ?? {};
    const bottleneckRow = bottleneckRows[0] ?? {};

    return [
      {
        label: "Chất lượng chấm",
        value:
          readDashboardString(
            qualityRow,
            ["AVG_FINAL_SCORE", "avgFinalScore"],
            "--",
          ) || "--",
        detail: `Khóa: ${readDashboardNumber(qualityRow, ["LOCKED_RESULT_COUNT", "lockedResultCount"], 0)}`,
      },
      {
        label: "KPI gần nhất",
        value:
          readDashboardString(
            kpiRow,
            ["KPI_NAME", "kpiName", "ROLE_NAME", "roleName"],
            "--",
          ) || "--",
        detail: `Giá trị: ${readDashboardString(kpiRow, ["KPI_VALUE", "kpiValue"], "--") || "--"}`,
      },
      {
        label: "Kỳ gần nhất",
        value:
          readDashboardString(
            periodRow,
            ["DEFENSE_TERM_NAME", "defenseTermName", "SNAP_DATE"],
            "--",
          ) || "--",
        detail: `Phân bổ: ${readDashboardNumber(periodRow, ["ASSIGNMENT_COUNT", "assignmentCount"], 0)}`,
      },
      {
        label: "Điểm nghẽn SLA",
        value:
          readDashboardString(
            bottleneckRow,
            ["MODULE_NAME", "moduleName"],
            "--",
          ) || "--",
        detail: `Vi phạm: ${readDashboardNumber(bottleneckRow, ["BREACH_COUNT", "breachCount"], 0)}`,
      },
    ];
  }, [bottleneckRows, dailyKpiRows, periodRows, qualityRows]);

  const stats = useMemo<StatCard[]>(() => {
    const overviewRow = overviewRows[0] ?? {};

    return [
      {
        label: "TỔNG ĐỀ TÀI",
        value: readDashboardNumber(
          overviewRow,
          ["TOTAL_TOPICS", "totalTopics"],
          0,
        ),
        icon: <Users size={28} />,
        color: "orange",
      },
      {
        label: "ĐỀ TÀI CHỜ DUYỆT",
        value: readDashboardNumber(
          overviewRow,
          ["TOPICS_PENDING", "topicsPending"],
          0,
        ),
        icon: <BookOpen size={28} />,
        color: "blue",
      },
      {
        label: "TỔNG BÀI NỘP",
        value: readDashboardNumber(
          overviewRow,
          ["TOTAL_SUBMISSIONS", "totalSubmissions"],
          0,
        ),
        icon: <FileText size={28} />,
        color: "green",
      },
      {
        label: "VƯỢT SLA",
        value: readDashboardNumber(
          overviewRow,
          ["SUBMISSION_SLA_BREACHES", "totalSlaBreaches"],
          0,
        ),
        icon: <CalendarDays size={28} />,
        color: "purple",
      },
    ];
  }, [overviewRows]);

  if (loading) {
    return (
      <div className="admin-dashboard" style={{ padding: 24 }}>
        <div className="dashboard-header">
          <h1>
            <Shield size={40} style={{ marginRight: 16 }} />
            BẢNG ĐIỀU KHIỂN QUẢN TRỊ VIÊN
          </h1>
          <p>TỔNG QUAN HOẠT ĐỘNG VÀ DỮ LIỆU HỆ THỐNG ĐỒ ÁN TỐT NGHIỆP</p>
        </div>
        <div className="recent-topics-section" style={{ padding: 24 }}>
          Đang tải dữ liệu dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard" style={{ padding: 24 }}>
        <div className="dashboard-header">
          <h1>
            <Shield size={40} style={{ marginRight: 16 }} />
            BẢNG ĐIỀU KHIỂN QUẢN TRỊ VIÊN
          </h1>
          <p>TỔNG QUAN HOẠT ĐỘNG VÀ DỮ LIỆU HỆ THỐNG ĐỒ ÁN TỐT NGHIỆP</p>
        </div>
        <div className="recent-topics-section" style={{ padding: 24 }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>
          <Shield size={40} style={{ marginRight: 16 }} />
          BẢNG ĐIỀU KHIỂN QUẢN TRỊ VIÊN
        </h1>
        <p>TỔNG QUAN HOẠT ĐỘNG VÀ DỮ LIỆU HỆ THỐNG ĐỒ ÁN TỐT NGHIỆP</p>
      </div>

      <div className="stats-grid">
        {stats.map((stat, index) => (
          <div key={index} className={`stat-card ${stat.color}`}>
            <div className="stat-card-header">
              <div className={`stat-card-icon ${stat.color}`}>{stat.icon}</div>
            </div>
            <div className="stat-card-label">{stat.label}</div>
            <div className="stat-card-value">{stat.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-content">
        <div className="chart-section">
          <h2>
            <TrendingUp
              size={24}
              style={{ marginRight: 12, color: "#f37021" }}
            />
            TIẾN ĐỘ HOÀN THÀNH ĐỒ ÁN
          </h2>
          <div className="chart-container">
            <div className="bar-chart">
              {chartData.map((item, index) => {
                const barHeight = (item.value / maxChartValue) * 250;
                return (
                  <div key={index} className="bar-item">
                    <div
                      className="bar"
                      style={{
                        height: `${Math.max(barHeight, 20)}px`,
                        background: `linear-gradient(to top, ${item.color}, ${item.colorLight})`,
                        minHeight: "20px",
                      }}
                    >
                      <div className="bar-value">{item.value}</div>
                    </div>
                    <div className="bar-label">{item.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="notifications-section">
          <h2>
            <Bell size={24} style={{ color: "#f37021" }} />
            THÔNG BÁO HỆ THỐNG
          </h2>
          <div className="notifications-list">
            {notifications.length === 0 ? (
              <div className="notification-item">
                <div className="notification-title">Không có dữ liệu</div>
                <div className="notification-desc">
                  Hệ thống chưa trả về danh sách thông báo.
                </div>
                <div className="notification-date">--</div>
              </div>
            ) : (
              notifications.map((notif, index) => (
                <div key={index} className="notification-item">
                  <div className="notification-title">{notif.title}</div>
                  <div className="notification-desc">{notif.desc}</div>
                  <div className="notification-date">📅 {notif.date}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="recent-topics-section">
        <h2>ĐỀ TÀI MỚI NHẤT</h2>
        <table className="topics-table">
          <thead>
            <tr>
              <th>TÊN ĐỀ TÀI</th>
              <th>SINH VIÊN</th>
              <th>GIẢNG VIÊN HƯỚNG DẪN</th>
              <th>TRẠNG THÁI</th>
            </tr>
          </thead>
          <tbody>
            {recentTopics.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: 24 }}>
                  Chưa có dữ liệu đề tài.
                </td>
              </tr>
            ) : (
              recentTopics.map((topic, index) => (
                <tr key={index}>
                  <td style={{ maxWidth: "350px", fontWeight: 600 }}>
                    {topic.title}
                  </td>
                  <td style={{ fontWeight: 500 }}>{topic.student}</td>
                  <td style={{ fontWeight: 500 }}>{topic.lecturer}</td>
                  <td>
                    <span
                      className={`status-badge ${getStatusColor(topic.status)}`}
                    >
                      {topic.statusText}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="recent-topics-section">
        <h2>CHỈ SỐ HỖ TRỢ</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {insights.map((item) => (
            <div
              key={item.label}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: 16,
                boxShadow: "0 6px 16px rgba(15, 23, 42, 0.06)",
              }}
            >
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
                {item.value}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
                {item.detail}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
