import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Eye,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  MessageSquare,
  X,
  Search,
  Filter,
} from "lucide-react";
import { fetchData, normalizeUrl } from "../../api/fetchData";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/useToast";
import {
  getAccessToken,
  getLecturerCode,
  setLecturerCode,
} from "../../services/auth-session.service";
import type { ApiResponse } from "../../types/api";
import type { ProgressSubmission } from "../../types/progressSubmission";
import type { SubmissionFile } from "../../types/submissionFile";
import type { StudentProfile } from "../../types/studentProfile";
import type { Topic } from "../../types/topic";
import type { LecturerProfile } from "../../types/lecturer";
import type {
  LecturerSubmissionAggregateItem,
  LecturerSubmissionAggregatePayload,
} from "../../types/report-aggregate";

// Helper function to format file size
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const normalizeLecturerState = (state: string | null | undefined): string => {
  const normalized = (state || "").toUpperCase();
  if (!normalized) return "PENDING";
  if (["APPROVED", "ACCEPTED"].includes(normalized)) return "APPROVED";
  if (["REVISION_REQUIRED", "REVISION", "REJECTED"].includes(normalized)) {
    return "REVISION_REQUIRED";
  }
  if (normalized === "PENDING") return "PENDING";
  return normalized;
};

const mapAggregateSubmission = (
  item: LecturerSubmissionAggregateItem,
): ProgressSubmission => {
  const submission = item.submission;
  return {
    submissionID: submission.submissionID,
    submissionCode: submission.submissionCode,
    milestoneID: submission.milestoneID,
    milestoneCode: submission.milestoneCode,
    ordinal: submission.ordinal ?? null,
    studentUserID: 0,
    studentUserCode: submission.studentUserCode,
    studentProfileID: null,
    studentProfileCode: submission.studentProfileCode,
    lecturerProfileID: null,
    lecturerCode: submission.lecturerCode,
    submittedAt: submission.submittedAt,
    attemptNumber: submission.attemptNumber,
    lecturerComment: submission.lecturerComment,
    lecturerState: normalizeLecturerState(submission.lecturerState),
    feedbackLevel: submission.feedbackLevel,
    reportTitle: submission.reportTitle,
    reportDescription: submission.reportDescription,
    lastUpdated: submission.lastUpdated,
  };
};

const mapAggregateStudent = (
  item: LecturerSubmissionAggregateItem,
): StudentProfile | null => {
  if (!item.student) return null;
  return {
    studentProfileID: item.student.studentProfileID,
    studentCode: item.student.studentCode,
    userCode: item.student.userCode,
    departmentCode: item.student.departmentCode,
    classCode: item.student.classCode,
    facultyCode: "",
    studentImage: "",
    gpa: 0,
    academicStanding: "",
    gender: "",
    dateOfBirth: "",
    phoneNumber: item.student.phoneNumber,
    studentEmail: item.student.studentEmail,
    address: "",
    enrollmentYear: 0,
    status: "",
    graduationYear: 0,
    notes: "",
    fullName: item.student.fullName,
    createdAt: "",
    lastUpdated: "",
  };
};

const mapAggregateTopic = (
  item: LecturerSubmissionAggregateItem,
): Topic | null => {
  if (!item.topic) return null;
  return {
    topicID: item.topic.topicID,
    topicCode: item.topic.topicCode,
    title: item.topic.title,
    summary: item.topic.summary,
    type: item.topic.type,
    proposerUserID: 0,
    proposerUserCode: item.submission.studentUserCode,
    proposerStudentProfileID: 0,
    proposerStudentCode: item.submission.studentProfileCode || "",
    supervisorUserID: null,
    supervisorUserCode: item.topic.supervisorLecturerCode,
    supervisorLecturerProfileID: null,
    supervisorLecturerCode: item.topic.supervisorLecturerCode,
    catalogTopicID: null,
    catalogTopicCode: item.topic.catalogTopicCode,
    departmentID: null,
    departmentCode: item.supervisor?.departmentCode || null,
    status: item.topic.status,
    resubmitCount: null,
    createdAt: item.topic.createdAt,
    lastUpdated: item.topic.lastUpdated,
    tagID: null,
    tagCode: null,
  };
};

const mapAggregateSupervisor = (
  item: LecturerSubmissionAggregateItem,
): LecturerProfile | null => {
  if (!item.supervisor) return null;
  return {
    lecturerProfileID: item.supervisor.lecturerProfileID,
    lecturerCode: item.supervisor.lecturerCode,
    userCode: "",
    departmentCode: item.supervisor.departmentCode,
    degree: item.supervisor.degree,
    guideQuota: 0,
    defenseQuota: 0,
    currentGuidingCount: 0,
    gender: "",
    dateOfBirth: "",
    email: item.supervisor.email,
    phoneNumber: item.supervisor.phoneNumber,
    profileImage: "",
    address: "",
    notes: "",
    fullName: item.supervisor.fullName,
    createdAt: "",
    lastUpdated: null,
  };
};

const LecturerReports: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [reports, setReports] = useState<ProgressSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] =
    useState<ProgressSubmission | null>(null);
  const [selectedReportForComment, setSelectedReportForComment] =
    useState<ProgressSubmission | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [studentProfiles, setStudentProfiles] = useState<{
    [key: string]: StudentProfile;
  }>({});
  const [topics, setTopics] = useState<{ [key: string]: Topic }>({});
  const [supervisorLecturers, setSupervisorLecturers] = useState<{
    [key: string]: LecturerProfile;
  }>({});
  const [submissionFiles, setSubmissionFiles] = useState<{
    [key: string]: SubmissionFile[];
  }>({});
  const [lecturerComment, setLecturerComment] = useState("");
  const [lecturerState, setLecturerState] = useState("");
  const [feedbackLevel, setFeedbackLevel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [activeLecturerCode, setActiveLecturerCode] = useState<string>(
    () => getLecturerCode() || "",
  );

  useEffect(() => {
    const resolveLecturerCode = async () => {
      if (!auth.user?.userCode) {
        setActiveLecturerCode("");
        return;
      }

      const cachedLecturerCode = getLecturerCode();
      if (cachedLecturerCode) {
        setActiveLecturerCode(cachedLecturerCode);
        return;
      }

      try {
        const lecturerProfileResponse = (await fetchData(
          `/LecturerProfiles/get-list?UserCode=${encodeURIComponent(auth.user.userCode)}`,
        )) as ApiResponse<LecturerProfile[]>;
        const lecturerCode =
          lecturerProfileResponse.data?.[0]?.lecturerCode?.trim() || "";
        setActiveLecturerCode(lecturerCode);
        setLecturerCode(lecturerCode || null);
      } catch (resolveError) {
        console.error("Error resolving lecturerCode:", resolveError);
        setActiveLecturerCode("");
      }
    };

    void resolveLecturerCode();
  }, [auth.user?.userCode]);

  const loadReports = useCallback(async () => {
    const lecturerCode = activeLecturerCode;
    if (!lecturerCode) return;

    try {
      setLoading(true);
      setError(null);

      const stateParam =
        filterStatus === "all" || filterStatus === "reviewed"
          ? ""
          : `&state=${encodeURIComponent(
              filterStatus === "approved"
                ? "APPROVED"
                : filterStatus === "rejected"
                  ? "REVISION_REQUIRED"
                  : "PENDING",
            )}`;
      const response = (await fetchData(
        `/reports/lecturer/submissions?lecturerCode=${encodeURIComponent(lecturerCode)}&page=${currentPage}&pageSize=${pageSize}${stateParam}`,
      )) as ApiResponse<LecturerSubmissionAggregatePayload>;

      if (!response.success || !response.data) {
        throw new Error(response.message || "Không thể tải danh sách báo cáo");
      }

      const items = response.data.items || [];
      const submissions = items.map(mapAggregateSubmission);
      const nextStudentProfiles: { [key: string]: StudentProfile } = {};
      const nextTopics: { [key: string]: Topic } = {};
      const nextSupervisors: { [key: string]: LecturerProfile } = {};
      const nextSubmissionFiles: { [key: string]: SubmissionFile[] } = {};

      items.forEach((item, index) => {
        const studentKey = item.submission.studentUserCode;
        const submission = submissions[index];
        const student = mapAggregateStudent(item);
        const topic = mapAggregateTopic(item);
        const supervisor = mapAggregateSupervisor(item);

        if (student) nextStudentProfiles[studentKey] = student;
        if (topic) nextTopics[studentKey] = topic;
        if (supervisor) nextSupervisors[supervisor.lecturerCode] = supervisor;
        nextSubmissionFiles[submission.submissionCode] =
          item.submission.files || [];
      });

      setReports(submissions);
      setStudentProfiles(nextStudentProfiles);
      setTopics(nextTopics);
      setSupervisorLecturers(nextSupervisors);
      setSubmissionFiles(nextSubmissionFiles);
      setTotalCount(
        response.data.totalCount || response.totalCount || submissions.length,
      );
    } catch (err) {
      setError("Không thể tải danh sách báo cáo");
      console.error("Error loading reports:", err);
    } finally {
      setLoading(false);
    }
  }, [activeLecturerCode, filterStatus, currentPage, pageSize]);

  useEffect(() => {
    if (activeLecturerCode) {
      loadReports();
    }
  }, [activeLecturerCode, loadReports]);

  const filteredReports = reports.filter((report) => {
    const studentProfile = studentProfiles[report.studentUserCode];
    const topic = topics[report.studentUserCode];
    const normalized = normalizeLecturerState(report.lecturerState);

    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "pending" && normalized === "PENDING") ||
      (filterStatus === "reviewed" && normalized !== "PENDING") ||
      (filterStatus === "approved" && normalized === "APPROVED") ||
      (filterStatus === "rejected" && normalized === "REVISION_REQUIRED");

    const matchesSearch =
      !searchTerm ||
      studentProfile?.fullName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      report.studentUserCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      topic?.title?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const getStatusIcon = (lecturerState: string | null) => {
    switch (normalizeLecturerState(lecturerState)) {
      case "APPROVED":
        return <CheckCircle size={16} color="#22C55E" />;
      case "REVISION_REQUIRED":
        return <AlertCircle size={16} color="#EF4444" />;
      case "PENDING":
        return <Clock size={16} color="#F59E0B" />;
      default:
        return <Clock size={16} color="#6B7280" />;
    }
  };

  const getStatusText = (lecturerState: string | null) => {
    switch (normalizeLecturerState(lecturerState)) {
      case "APPROVED":
        return "Đã duyệt";
      case "REVISION_REQUIRED":
        return "Yêu cầu sửa đổi";
      case "PENDING":
        return "Đang chờ đánh giá";
      default:
        return "Không xác định";
    }
  };

  const getStatusColor = (lecturerState: string | null) => {
    switch (normalizeLecturerState(lecturerState)) {
      case "APPROVED":
        return "#22C55E";
      case "REVISION_REQUIRED":
        return "#EF4444";
      case "PENDING":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  const getReportTypeText = (milestoneCode: string) => {
    if (milestoneCode.includes("MS_TOP")) return "Báo cáo tiến độ";
    return "Báo cáo";
  };

  const handleSubmitComment = async () => {
    if (!selectedReportForComment) return;

    try {
      setSubmitting(true);
      const normalizedState = normalizeLecturerState(lecturerState);
      const reviewRes = (await fetchData(
        `/reports/lecturer/submissions/${selectedReportForComment.submissionID}/review`,
        {
          method: "PUT",
          body: {
            lecturerComment,
            lecturerState: normalizedState,
            feedbackLevel: (feedbackLevel || "").toUpperCase() || null,
          },
        },
      )) as ApiResponse<unknown>;

      if (!reviewRes.success) {
        throw new Error(reviewRes.message || "Không thể gửi nhận xét");
      }

      // Reload reports to show updated data
      await loadReports();
      setSelectedReportForComment(null);
      setLecturerComment("");
      setLecturerState("");
      setFeedbackLevel("");
    } catch (err) {
      console.error("Error submitting comment:", err);
      setError("Không thể gửi nhận xét");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadFile = async (fileID: number, fileName: string) => {
    try {
      // Use the correct API endpoint for downloading files
      const downloadUrl = `/api/SubmissionFiles/download/${fileID}`;
      const url = normalizeUrl(downloadUrl);

      const token = getAccessToken();
      const resp = await fetch(url, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!resp.ok) {
        // If server responds with unauthorized or redirect to login, send user to login
        if (resp.status === 401 || resp.status === 302 || resp.status === 403) {
          navigate("/login");
          return;
        }
        throw new Error(`Download failed with status ${resp.status}`);
      }

      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        // Probably redirected to login page
        navigate("/login");
        return;
      }

      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error downloading file:", err);
      // Show simple feedback to user
      addToast(
        "Không thể tải file. Vui lòng thử lại hoặc đăng nhập lại.",
        "error",
      );
    }
  };

  return (
    <div className="dashboard-root" style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
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
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 160px;
        }

        .premium-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
          border-color: var(--primary);
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
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: "700",
            color: "#1a1a1a",
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <FileText size={32} color="#F37021" />
          Nhận xét báo cáo
        </h1>
        <p style={{ fontSize: "14px", color: "#666" }}>
          Xem và nhận xét các báo cáo của sinh viên
        </p>
      </div>

      {loading && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "200px",
            color: "#f37021",
          }}
        >
          <div>Đang tải...</div>
        </div>
      )}

      {error && (
        <div
          style={{
            backgroundColor: "#ffebee",
            border: "1px solid #f44336",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "24px",
            color: "#d32f2f",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Toolbar */}
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              border: "1px solid #E5E7EB",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "16px",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {/* Search Box */}
              <div style={{ flex: "1 1 400px", position: "relative" }}>
                <Search
                  size={18}
                  color="#9CA3AF"
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                />
                <input
                  type="text"
                  placeholder="Tìm kiếm sinh viên, mã SV, đề tài..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 40px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "8px",
                    fontSize: "14px",
                    outline: "none",
                    transition: "all 0.2s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#F37021";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 3px rgba(243, 112, 33, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#D1D5DB";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* Filter Section */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Filter size={16} color="#6B7280" />
                  <select
                    value={filterStatus}
                    onChange={(e) => {
                      setFilterStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #D1D5DB",
                      borderRadius: "8px",
                      fontSize: "14px",
                      cursor: "pointer",
                      outline: "none",
                      background: "white",
                      minWidth: "180px",
                    }}
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="pending">Chờ duyệt</option>
                    <option value="reviewed">Đang xem xét</option>
                    <option value="approved">Đã duyệt</option>
                    <option value="rejected">Yêu cầu sửa đổi</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "24px",
              marginBottom: "32px",
            }}
          >
            <div className="premium-card">
              <div>
                <div className="stat-icon-wrapper" style={{ background: "rgba(243, 112, 33, 0.1)" }}>
                  <FileText size={24} color="#F37021" />
                </div>
                <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                  Tổng báo cáo
                </div>
                <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
                  {reports.length}
                </div>
              </div>
              <div style={{ height: "4px", background: "#F37021", borderRadius: "2px", width: "40%", marginTop: "12px" }} />
            </div>

            <div className="premium-card">
              <div>
                <div className="stat-icon-wrapper" style={{ background: "rgba(245, 158, 11, 0.1)" }}>
                  <Clock size={24} color="#F59E0B" />
                </div>
                <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                  Chờ nhận xét
                </div>
                <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
                  {reports.filter((r) => normalizeLecturerState(r.lecturerState) === "PENDING").length}
                </div>
              </div>
              <div style={{ height: "4px", background: "#F59E0B", borderRadius: "2px", width: "40%", marginTop: "12px" }} />
            </div>

            <div className="premium-card">
              <div>
                <div className="stat-icon-wrapper" style={{ background: "rgba(34, 197, 94, 0.1)" }}>
                  <CheckCircle size={24} color="#22C55E" />
                </div>
                <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                  Đã duyệt
                </div>
                <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
                  {reports.filter((r) => normalizeLecturerState(r.lecturerState) === "APPROVED").length}
                </div>
              </div>
              <div style={{ height: "4px", background: "#22C55E", borderRadius: "2px", width: "40%", marginTop: "12px" }} />
            </div>

            <div className="premium-card">
              <div>
                <div className="stat-icon-wrapper" style={{ background: "rgba(239, 68, 68, 0.1)" }}>
                  <AlertCircle size={24} color="#EF4444" />
                </div>
                <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                  Yêu cầu sửa đổi
                </div>
                <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
                  {reports.filter((r) => normalizeLecturerState(r.lecturerState) === "REVISION_REQUIRED").length}
                </div>
              </div>
              <div style={{ height: "4px", background: "#EF4444", borderRadius: "2px", width: "40%", marginTop: "12px" }} />
            </div>
          </div>

          {/* Reports Table */}
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      background: "#F9FAFB",
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    <th
                      style={{
                        padding: "16px",
                        textAlign: "left",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      Báo cáo
                    </th>
                    <th
                      style={{
                        padding: "16px",
                        textAlign: "left",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      Sinh viên
                    </th>
                    <th
                      style={{
                        padding: "16px",
                        textAlign: "left",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      Đề tài
                    </th>
                    <th
                      style={{
                        padding: "16px",
                        textAlign: "left",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      Ngày nộp
                    </th>
                    <th
                      style={{
                        padding: "16px",
                        textAlign: "left",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      Trạng thái
                    </th>
                    <th
                      style={{
                        padding: "16px",
                        textAlign: "center",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => {
                    const studentProfile =
                      studentProfiles[report.studentUserCode];
                    const topic = topics[report.studentUserCode];
                    const files = submissionFiles[report.submissionCode] || [];

                    return (
                      <tr
                        key={report.submissionID}
                        style={{
                          borderBottom: "1px solid #F3F4F6",
                          transition: "background 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#F9FAFB";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "white";
                        }}
                      >
                        <td style={{ padding: "16px" }}>
                          <div>
                            <div
                              style={{
                                fontSize: "14px",
                                fontWeight: "600",
                                color: "#1a1a1a",
                                marginBottom: "4px",
                              }}
                            >
                              {report.reportTitle || "Báo cáo chưa có tiêu đề"}
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#666",
                                marginBottom: "4px",
                              }}
                            >
                              {getReportTypeText(report.milestoneCode)}
                            </div>
                            {report.lecturerComment && (
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: "#92400E",
                                  background: "#FEF3C7",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  display: "inline-block",
                                }}
                              >
                                Có nhận xét
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "16px" }}>
                          <div>
                            <div
                              style={{
                                fontSize: "14px",
                                fontWeight: "600",
                                color: "#1a1a1a",
                              }}
                            >
                              {studentProfile?.fullName ||
                                report.studentUserCode}
                            </div>
                            <div style={{ fontSize: "12px", color: "#666" }}>
                              {studentProfile?.studentCode ||
                                report.studentUserCode}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "16px", maxWidth: "250px" }}>
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#1a1a1a",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {topic?.title || "N/A"}
                          </div>
                          <div style={{ fontSize: "12px", color: "#666" }}>
                            {topic?.topicCode || "N/A"}
                          </div>
                        </td>
                        <td style={{ padding: "16px" }}>
                          <div style={{ fontSize: "14px", color: "#1a1a1a" }}>
                            {new Date(report.submittedAt).toLocaleDateString(
                              "vi-VN",
                            )}
                          </div>
                          <div style={{ fontSize: "12px", color: "#666" }}>
                            {new Date(report.submittedAt).toLocaleTimeString(
                              "vi-VN",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "16px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            {getStatusIcon(report.lecturerState)}
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: "600",
                                color: getStatusColor(report.lecturerState),
                              }}
                            >
                              {getStatusText(report.lecturerState)}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "16px" }}>
                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              justifyContent: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            {files.map((file) => (
                              <button
                                key={file.fileID}
                                style={{
                                  padding: "6px 10px",
                                  background: "#F37021",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                  fontWeight: "600",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "#E55A1B";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "#F37021";
                                }}
                                onClick={() =>
                                  handleDownloadFile(file.fileID, file.fileName)
                                }
                                title={file.fileName}
                              >
                                <Download size={12} />
                              </button>
                            ))}
                            <button
                              style={{
                                padding: "6px 10px",
                                background: "#6B7280",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: "600",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#4B5563";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "#6B7280";
                              }}
                              onClick={() => setSelectedReport(report)}
                              title="Xem chi tiết"
                            >
                              <Eye size={12} />
                            </button>
                            {normalizeLecturerState(report.lecturerState) ===
                            "PENDING" ? (
                              <button
                                style={{
                                  padding: "6px 10px",
                                  background: "#10B981",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                  fontWeight: "600",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "#059669";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "#10B981";
                                }}
                                onClick={() =>
                                  setSelectedReportForComment(report)
                                }
                                title="Đánh giá / chỉnh sửa"
                              >
                                <MessageSquare size={12} />
                              </button>
                            ) : (
                              <div
                                style={{
                                  padding: "6px 10px",
                                  background: "#E5E7EB",
                                  color: "#6B7280",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                  fontWeight: "600",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title="Đã nhận xét"
                              >
                                <CheckCircle size={12} />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalCount > pageSize && (
              <div
                style={{
                  padding: "16px",
                  borderTop: "1px solid #E5E7EB",
                  background: "#F9FAFB",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: "14px", color: "#666" }}>
                  Hiển thị{" "}
                  {Math.min((currentPage - 1) * pageSize + 1, totalCount)} -{" "}
                  {Math.min(currentPage * pageSize, totalCount)} của{" "}
                  {totalCount} báo cáo
                </div>
                <div
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <button
                    style={{
                      padding: "8px 12px",
                      background: currentPage === 1 ? "#E5E7EB" : "#F37021",
                      color: currentPage === 1 ? "#9CA3AF" : "white",
                      border: "none",
                      borderRadius: "4px",
                      fontSize: "14px",
                      cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    }}
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => prev - 1)}
                  >
                    Trước
                  </button>

                  <span
                    style={{
                      fontSize: "14px",
                      color: "#666",
                      margin: "0 12px",
                    }}
                  >
                    Trang {currentPage} / {Math.ceil(totalCount / pageSize)}
                  </span>

                  <button
                    style={{
                      padding: "8px 12px",
                      background:
                        currentPage >= Math.ceil(totalCount / pageSize)
                          ? "#E5E7EB"
                          : "#F37021",
                      color:
                        currentPage >= Math.ceil(totalCount / pageSize)
                          ? "#9CA3AF"
                          : "white",
                      border: "none",
                      borderRadius: "4px",
                      fontSize: "14px",
                      cursor:
                        currentPage >= Math.ceil(totalCount / pageSize)
                          ? "not-allowed"
                          : "pointer",
                    }}
                    disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Report Detail Modal */}
          {selectedReport && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: "20px",
              }}
              onClick={() => setSelectedReport(null)}
            >
              <div
                style={{
                  background: "white",
                  borderRadius: "16px",
                  maxWidth: "900px",
                  width: "100%",
                  maxHeight: "90vh",
                  overflow: "hidden",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div
                  style={{
                    background:
                      "linear-gradient(135deg, #F37021 0%, #E55A1B 100%)",
                    color: "white",
                    padding: "24px 32px",
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    position: "relative",
                  }}
                >
                  <FileText size={28} />
                  <div>
                    <h2
                      style={{
                        fontSize: "24px",
                        fontWeight: "700",
                        margin: "0 0 4px 0",
                      }}
                    >
                      Chi tiết báo cáo
                    </h2>
                    <p style={{ fontSize: "14px", margin: 0, opacity: 0.9 }}>
                      {getReportTypeText(selectedReport.milestoneCode)} •{" "}
                      {new Date(selectedReport.submittedAt).toLocaleDateString(
                        "vi-VN",
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedReport(null)}
                    style={{
                      position: "absolute",
                      top: "16px",
                      right: "16px",
                      background: "transparent",
                      border: "none",
                      color: "white",
                      cursor: "pointer",
                      padding: "8px",
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background-color 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "rgba(255, 255, 255, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div
                  style={{
                    padding: "32px",
                    maxHeight: "calc(90vh - 120px)",
                    overflow: "auto",
                  }}
                >
                  {/* Report Overview */}
                  <div style={{ marginBottom: "32px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "16px",
                      }}
                    >
                      <h3
                        style={{
                          fontSize: "18px",
                          fontWeight: "600",
                          color: "#1a1a1a",
                          margin: 0,
                        }}
                      >
                        {selectedReport.reportTitle ||
                          "Báo cáo chưa có tiêu đề"}
                      </h3>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          background:
                            getStatusColor(selectedReport.lecturerState) + "20",
                          color: getStatusColor(selectedReport.lecturerState),
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: "600",
                        }}
                      >
                        {getStatusIcon(selectedReport.lecturerState)}
                        {getStatusText(selectedReport.lecturerState)}
                      </span>
                    </div>

                    <div
                      style={{
                        background: "#F9FAFB",
                        borderRadius: "12px",
                        padding: "20px",
                        border: "1px solid #E5E7EB",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "15px",
                          color: "#374151",
                          margin: 0,
                          lineHeight: "1.6",
                        }}
                      >
                        {selectedReport.reportDescription ||
                          "Chưa có mô tả chi tiết từ sinh viên"}
                      </p>
                    </div>
                  </div>

                  {/* Student & Supervisor Info */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "24px",
                      marginBottom: "32px",
                    }}
                  >
                    {/* Student Info */}
                    <div
                      style={{
                        background:
                          "linear-gradient(135deg, #EBF8FF 0%, #DBEAFE 100%)",
                        border: "1px solid #BFDBFE",
                        borderRadius: "12px",
                        padding: "20px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          marginBottom: "16px",
                        }}
                      >
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            overflow: "hidden",
                            border: "2px solid #3B82F6",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#3B82F6",
                          }}
                        >
                          {studentProfiles[selectedReport.studentUserCode]
                            ?.studentImage ? (
                            <img
                              src={
                                studentProfiles[selectedReport.studentUserCode]
                                  .studentImage
                              }
                              alt="Avatar sinh viên"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                              onError={(e) => {
                                // Fallback to initial if image fails to load
                                e.currentTarget.style.display = "none";
                                e.currentTarget.parentElement!.innerHTML =
                                  studentProfiles[
                                    selectedReport.studentUserCode
                                  ]?.fullName
                                    ?.charAt(0)
                                    ?.toUpperCase() || "S";
                                e.currentTarget.parentElement!.style.color =
                                  "white";
                                e.currentTarget.parentElement!.style.fontSize =
                                  "18px";
                                e.currentTarget.parentElement!.style.fontWeight =
                                  "600";
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                color: "white",
                                fontSize: "18px",
                                fontWeight: "600",
                              }}
                            >
                              {studentProfiles[
                                selectedReport.studentUserCode
                              ]?.fullName
                                ?.charAt(0)
                                ?.toUpperCase() || "S"}
                            </span>
                          )}
                        </div>
                        <div>
                          <h4
                            style={{
                              fontSize: "16px",
                              fontWeight: "600",
                              color: "#1a1a1a",
                              margin: "0 0 4px 0",
                            }}
                          >
                            Sinh viên
                          </h4>
                          <p
                            style={{
                              fontSize: "12px",
                              color: "#6B7280",
                              margin: 0,
                            }}
                          >
                            Thông tin cá nhân
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: "12px" }}>
                        <div>
                          <label
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#6B7280",
                              textTransform: "uppercase",
                            }}
                          >
                            Họ và tên
                          </label>
                          <p
                            style={{
                              fontSize: "14px",
                              fontWeight: "500",
                              color: "#1a1a1a",
                              margin: "4px 0",
                            }}
                          >
                            {studentProfiles[selectedReport.studentUserCode]
                              ?.fullName || selectedReport.studentUserCode}
                          </p>
                        </div>

                        <div>
                          <label
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#6B7280",
                              textTransform: "uppercase",
                            }}
                          >
                            Mã sinh viên
                          </label>
                          <p
                            style={{
                              fontSize: "14px",
                              fontWeight: "500",
                              color: "#1a1a1a",
                              margin: "4px 0",
                            }}
                          >
                            {studentProfiles[selectedReport.studentUserCode]
                              ?.studentCode || selectedReport.studentUserCode}
                          </p>
                        </div>

                        <div>
                          <label
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#6B7280",
                              textTransform: "uppercase",
                            }}
                          >
                            Email
                          </label>
                          <p
                            style={{
                              fontSize: "14px",
                              color: "#374151",
                              margin: "4px 0",
                            }}
                          >
                            {studentProfiles[selectedReport.studentUserCode]
                              ?.studentEmail || "Chưa cập nhật"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Supervisor Info */}
                    <div
                      style={{
                        background:
                          "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
                        border: "1px solid #BBF7D0",
                        borderRadius: "12px",
                        padding: "20px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          marginBottom: "16px",
                        }}
                      >
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            overflow: "hidden",
                            border: "2px solid #10B981",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#10B981",
                          }}
                        >
                          {(() => {
                            const supCode =
                              topics[selectedReport.studentUserCode]
                                ?.supervisorLecturerCode;
                            const sup = supCode
                              ? supervisorLecturers[supCode]
                              : null;
                            return sup?.profileImage ? (
                              <img
                                src={normalizeUrl(sup.profileImage)}
                                alt="Avatar giảng viên"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                                onError={(e) => {
                                  // Fallback to initial if image fails to load
                                  e.currentTarget.style.display = "none";
                                  e.currentTarget.parentElement!.innerHTML =
                                    sup?.fullName?.charAt(0)?.toUpperCase() ||
                                    "G";
                                  e.currentTarget.parentElement!.style.color =
                                    "white";
                                  e.currentTarget.parentElement!.style.fontSize =
                                    "18px";
                                  e.currentTarget.parentElement!.style.fontWeight =
                                    "600";
                                }}
                              />
                            ) : (
                              <span
                                style={{
                                  color: "white",
                                  fontSize: "18px",
                                  fontWeight: "600",
                                }}
                              >
                                {sup?.fullName?.charAt(0)?.toUpperCase() || "G"}
                              </span>
                            );
                          })()}
                        </div>
                        <div>
                          <h4
                            style={{
                              fontSize: "16px",
                              fontWeight: "600",
                              color: "#1a1a1a",
                              margin: "0 0 4px 0",
                            }}
                          >
                            Giảng viên hướng dẫn
                          </h4>
                          <p
                            style={{
                              fontSize: "12px",
                              color: "#6B7280",
                              margin: 0,
                            }}
                          >
                            Người hướng dẫn đề tài
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: "12px" }}>
                        <div>
                          <label
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#6B7280",
                              textTransform: "uppercase",
                            }}
                          >
                            Họ và tên
                          </label>
                          <p
                            style={{
                              fontSize: "14px",
                              fontWeight: "500",
                              color: "#1a1a1a",
                              margin: "4px 0",
                            }}
                          >
                            {(() => {
                              const supCode =
                                topics[selectedReport.studentUserCode]
                                  ?.supervisorLecturerCode;
                              const sup = supCode
                                ? supervisorLecturers[supCode]
                                : null;
                              return sup?.fullName || "N/A";
                            })()}
                          </p>
                        </div>

                        <div>
                          <label
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#6B7280",
                              textTransform: "uppercase",
                            }}
                          >
                            Email
                          </label>
                          <p
                            style={{
                              fontSize: "14px",
                              color: "#374151",
                              margin: "4px 0",
                            }}
                          >
                            {(() => {
                              const supCode =
                                topics[selectedReport.studentUserCode]
                                  ?.supervisorLecturerCode;
                              const sup = supCode
                                ? supervisorLecturers[supCode]
                                : null;
                              return sup?.email || "N/A";
                            })()}
                          </p>
                        </div>

                        <div>
                          <label
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#6B7280",
                              textTransform: "uppercase",
                            }}
                          >
                            Số điện thoại
                          </label>
                          <p
                            style={{
                              fontSize: "14px",
                              color: "#374151",
                              margin: "4px 0",
                            }}
                          >
                            {(() => {
                              const supCode =
                                topics[selectedReport.studentUserCode]
                                  ?.supervisorLecturerCode;
                              const sup = supCode
                                ? supervisorLecturers[supCode]
                                : null;
                              return sup?.phoneNumber || "N/A";
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Topic Information */}
                  <div style={{ marginBottom: "32px" }}>
                    <h4
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#1a1a1a",
                        margin: "0 0 16px 0",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <FileText size={18} color="#F37021" />
                      Thông tin đề tài
                    </h4>

                    <div
                      style={{
                        background: "#FEF3C7",
                        border: "1px solid #FCD34D",
                        borderRadius: "12px",
                        padding: "20px",
                      }}
                    >
                      <div style={{ display: "grid", gap: "12px" }}>
                        <div>
                          <label
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#92400E",
                              textTransform: "uppercase",
                            }}
                          >
                            Tên đề tài
                          </label>
                          <p
                            style={{
                              fontSize: "16px",
                              fontWeight: "600",
                              color: "#92400E",
                              margin: "4px 0",
                            }}
                          >
                            {topics[selectedReport.studentUserCode]?.title ||
                              "N/A"}
                          </p>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "16px",
                          }}
                        >
                          <div>
                            <label
                              style={{
                                fontSize: "12px",
                                fontWeight: "600",
                                color: "#92400E",
                                textTransform: "uppercase",
                              }}
                            >
                              Mã đề tài
                            </label>
                            <p
                              style={{
                                fontSize: "14px",
                                color: "#92400E",
                                margin: "4px 0",
                              }}
                            >
                              {topics[selectedReport.studentUserCode]
                                ?.topicCode || "N/A"}
                            </p>
                          </div>

                          <div>
                            <label
                              style={{
                                fontSize: "12px",
                                fontWeight: "600",
                                color: "#92400E",
                                textTransform: "uppercase",
                              }}
                            >
                              Trạng thái đề tài
                            </label>
                            <p
                              style={{
                                fontSize: "14px",
                                color: "#92400E",
                                margin: "4px 0",
                              }}
                            >
                              {topics[selectedReport.studentUserCode]?.status ||
                                "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submission Details */}
                  <div style={{ marginBottom: "32px" }}>
                    <h4
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#1a1a1a",
                        margin: "0 0 16px 0",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <Clock size={18} color="#6B7280" />
                      Chi tiết nộp bài
                    </h4>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: "16px",
                      }}
                    >
                      <div
                        style={{
                          background: "#F9FAFB",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                          padding: "16px",
                        }}
                      >
                        <label
                          style={{
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "#6B7280",
                            textTransform: "uppercase",
                          }}
                        >
                          Ngày nộp
                        </label>
                        <p
                          style={{
                            fontSize: "16px",
                            fontWeight: "600",
                            color: "#1a1a1a",
                            margin: "4px 0",
                          }}
                        >
                          {new Date(
                            selectedReport.submittedAt,
                          ).toLocaleDateString("vi-VN")}
                        </p>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#6B7280",
                            margin: "4px 0",
                          }}
                        >
                          {new Date(
                            selectedReport.submittedAt,
                          ).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </p>
                      </div>

                      <div
                        style={{
                          background: "#F9FAFB",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                          padding: "16px",
                        }}
                      >
                        <label
                          style={{
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "#6B7280",
                            textTransform: "uppercase",
                          }}
                        >
                          Mã báo cáo
                        </label>
                        <p
                          style={{
                            fontSize: "14px",
                            fontWeight: "500",
                            color: "#1a1a1a",
                            margin: "4px 0",
                          }}
                        >
                          {selectedReport.submissionCode}
                        </p>
                      </div>

                      <div
                        style={{
                          background: "#F9FAFB",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                          padding: "16px",
                        }}
                      >
                        <label
                          style={{
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "#6B7280",
                            textTransform: "uppercase",
                          }}
                        >
                          Lần nộp
                        </label>
                        <p
                          style={{
                            fontSize: "16px",
                            fontWeight: "600",
                            color: "#1a1a1a",
                            margin: "4px 0",
                          }}
                        >
                          {selectedReport.attemptNumber}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Files Section */}
                  <div style={{ marginBottom: "32px" }}>
                    <h4
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#1a1a1a",
                        margin: "0 0 16px 0",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <Download size={18} color="#6B7280" />
                      File đính kèm (
                      {submissionFiles[selectedReport.submissionCode]?.length ||
                        0}{" "}
                      file)
                    </h4>

                    <div style={{ display: "grid", gap: "12px" }}>
                      {submissionFiles[selectedReport.submissionCode]?.length >
                      0 ? (
                        submissionFiles[selectedReport.submissionCode].map(
                          (file) => (
                            <div
                              key={file.fileID}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                background: "#F9FAFB",
                                border: "1px solid #E5E7EB",
                                borderRadius: "8px",
                                padding: "16px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                }}
                              >
                                <div
                                  style={{
                                    width: "32px",
                                    height: "32px",
                                    background: "#F37021",
                                    borderRadius: "6px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "white",
                                  }}
                                >
                                  <FileText size={16} />
                                </div>
                                <div>
                                  <p
                                    style={{
                                      fontSize: "14px",
                                      fontWeight: "500",
                                      color: "#1a1a1a",
                                      margin: "0 0 2px 0",
                                    }}
                                  >
                                    {file.fileName}
                                  </p>
                                  <p
                                    style={{
                                      fontSize: "12px",
                                      color: "#6B7280",
                                      margin: 0,
                                    }}
                                  >
                                    Kích thước:{" "}
                                    {formatBytes(file.fileSizeBytes)}
                                  </p>
                                </div>
                              </div>

                              <button
                                style={{
                                  padding: "8px 16px",
                                  background: "#F37021",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "#E55A1B";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "#F37021";
                                }}
                                onClick={() =>
                                  handleDownloadFile(file.fileID, file.fileName)
                                }
                              >
                                <Download size={14} />
                                Tải xuống
                              </button>
                            </div>
                          ),
                        )
                      ) : (
                        <div
                          style={{
                            background: "#F9FAFB",
                            border: "1px solid #E5E7EB",
                            borderRadius: "8px",
                            padding: "24px",
                            textAlign: "center",
                            color: "#6B7280",
                          }}
                        >
                          <FileText size={24} style={{ marginBottom: "8px" }} />
                          <p style={{ margin: 0, fontSize: "14px" }}>
                            Không có file đính kèm
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lecturer Comments */}
                  {selectedReport.lecturerComment && (
                    <div>
                      <h4
                        style={{
                          fontSize: "16px",
                          fontWeight: "600",
                          color: "#1a1a1a",
                          margin: "0 0 16px 0",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <MessageSquare size={18} color="#92400E" />
                        Nhận xét của giảng viên
                      </h4>

                      <div
                        style={{
                          background: "#FEF3C7",
                          border: "1px solid #FCD34D",
                          borderRadius: "12px",
                          padding: "20px",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "15px",
                            color: "#92400E",
                            margin: "0 0 12px 0",
                            lineHeight: "1.6",
                          }}
                        >
                          {selectedReport.lecturerComment}
                        </p>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "16px",
                          }}
                        >
                          <div>
                            <label
                              style={{
                                fontSize: "12px",
                                fontWeight: "600",
                                color: "#92400E",
                                textTransform: "uppercase",
                              }}
                            >
                              Trạng thái
                            </label>
                            <p
                              style={{
                                fontSize: "14px",
                                fontWeight: "500",
                                color: "#92400E",
                                margin: "4px 0",
                              }}
                            >
                              {getStatusText(selectedReport.lecturerState)}
                            </p>
                          </div>

                          <div>
                            <label
                              style={{
                                fontSize: "12px",
                                fontWeight: "600",
                                color: "#92400E",
                                textTransform: "uppercase",
                              }}
                            >
                              Cấp độ phản hồi
                            </label>
                            <p
                              style={{
                                fontSize: "14px",
                                fontWeight: "500",
                                color: "#92400E",
                                margin: "4px 0",
                              }}
                            >
                              {selectedReport.feedbackLevel || "Chưa đánh giá"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div
                  style={{
                    padding: "24px 32px",
                    borderTop: "1px solid #E5E7EB",
                    background: "#F9FAFB",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "12px",
                  }}
                >
                  <button
                    style={{
                      padding: "10px 20px",
                      background: "#6B7280",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#4B5563";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#6B7280";
                    }}
                    onClick={() => {
                      setSelectedReport(null);
                      setLecturerComment("");
                      setLecturerState("");
                      setFeedbackLevel("");
                    }}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Comment Modal */}
          {selectedReportForComment && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
              onClick={() => setSelectedReportForComment(null)}
            >
              <div
                style={{
                  background: "white",
                  borderRadius: "12px",
                  padding: "32px",
                  maxWidth: "600px",
                  width: "90%",
                  maxHeight: "80vh",
                  overflow: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2
                  style={{
                    fontSize: "20px",
                    fontWeight: "600",
                    color: "#1a1a1a",
                    marginBottom: "16px",
                  }}
                >
                  Nhận xét báo cáo
                </h2>

                {/* Report Info */}
                <div style={{ marginBottom: "24px" }}>
                  <div
                    style={{
                      background: "#F9FAFB",
                      borderRadius: "8px",
                      padding: "16px",
                      marginBottom: "16px",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#1a1a1a",
                        marginBottom: "8px",
                      }}
                    >
                      {selectedReportForComment.reportTitle ||
                        "Báo cáo chưa có tiêu đề"}
                    </h3>
                    <div style={{ fontSize: "14px", color: "#666" }}>
                      <strong>Sinh viên:</strong>{" "}
                      {studentProfiles[selectedReportForComment.studentUserCode]
                        ?.fullName ||
                        selectedReportForComment.studentUserCode}{" "}
                      (
                      {studentProfiles[selectedReportForComment.studentUserCode]
                        ?.studentCode ||
                        selectedReportForComment.studentUserCode}
                      )
                      <br />
                      <strong>Đề tài:</strong>{" "}
                      {topics[selectedReportForComment.studentUserCode]
                        ?.title || "N/A"}
                    </div>
                  </div>
                </div>

                {/* Comment Form */}
                <div style={{ display: "grid", gap: "16px" }}>
                  <div>
                    <label
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#666",
                        textTransform: "uppercase",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Nhận xét
                    </label>
                    <textarea
                      value={lecturerComment}
                      onChange={(e) => setLecturerComment(e.target.value)}
                      placeholder="Nhập nhận xét của bạn..."
                      style={{
                        width: "100%",
                        padding: "12px",
                        border: "1px solid #D1D5DB",
                        borderRadius: "6px",
                        fontSize: "14px",
                        minHeight: "100px",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#666",
                          textTransform: "uppercase",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Trạng thái
                      </label>
                      <select
                        value={lecturerState}
                        onChange={(e) => setLecturerState(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "12px",
                          border: "1px solid #D1D5DB",
                          borderRadius: "6px",
                          fontSize: "14px",
                          background: "white",
                        }}
                      >
                        <option value="">Chọn trạng thái</option>
                        <option value="Accepted">Duyệt</option>
                        <option value="Revision">Yêu cầu sửa đổi</option>
                        <option value="Pending">Đang xem xét</option>
                      </select>
                    </div>

                    <div>
                      <label
                        style={{
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#666",
                          textTransform: "uppercase",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Cấp độ phản hồi
                      </label>
                      <select
                        value={feedbackLevel}
                        onChange={(e) => setFeedbackLevel(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "12px",
                          border: "1px solid #D1D5DB",
                          borderRadius: "6px",
                          fontSize: "14px",
                          background: "white",
                        }}
                      >
                        <option value="">Chọn cấp độ</option>
                        <option value="High">Cao</option>
                        <option value="Normal">Bình thường</option>
                        <option value="Moderate">Trung bình</option>
                        <option value="Low">Thấp</option>
                      </select>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      justifyContent: "flex-end",
                      marginTop: "24px",
                    }}
                  >
                    <button
                      onClick={() => {
                        setSelectedReportForComment(null);
                        setLecturerComment("");
                        setLecturerState("");
                        setFeedbackLevel("");
                      }}
                      style={{
                        padding: "12px 24px",
                        background: "#6B7280",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleSubmitComment}
                      disabled={submitting || !lecturerState}
                      style={{
                        padding: "12px 24px",
                        background: "#F37021",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor: submitting ? "not-allowed" : "pointer",
                        opacity: submitting ? 0.6 : 1,
                      }}
                    >
                      {submitting ? "Đang gửi..." : "Gửi nhận xét"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LecturerReports;
