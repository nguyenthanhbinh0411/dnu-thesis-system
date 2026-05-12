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
  BookOpen,
  User,
  Mail,
  Phone,
  Calendar,
  Building,
  Info,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
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

const getMilestoneDisplayName = (code: string | null, ordinal: number | null): string => {
  if (code === "MS_REG") return "Đăng ký đề tài";
  if (code === "MS_PROG1" || ordinal === 2) return "Báo cáo tiến độ 1";
  if (code === "MS_PROG2" || ordinal === 3) return "Báo cáo tiến độ 2";
  if (code === "MS_FULL" || ordinal === 4) return "Hoàn thiện khóa luận";
  if (code === "MS_DEFENSE" || ordinal === 5) return "Bảo vệ luận văn";
  return code || `Mốc ${ordinal || "không xác định"}`;
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
    score: item.topic.score ?? null,
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
  const [filterStatus, setFilterStatus] = useState<string>("all");
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
  const [score, setScore] = useState<string>("");
  // New evaluation fields state
  const [reviewQuality, setReviewQuality] = useState("");
  const [reviewAttitude, setReviewAttitude] = useState("");
  const [reviewCapability, setReviewCapability] = useState("");
  const [reviewResultProcessing, setReviewResultProcessing] = useState("");
  const [reviewAchievements, setReviewAchievements] = useState("");
  const [reviewLimitations, setReviewLimitations] = useState("");
  const [reviewConclusion, setReviewConclusion] = useState("");
  const [scoreInWords, setScoreInWords] = useState("");
  const [numChapters, setNumChapters] = useState<string>("");
  const [numPages, setNumPages] = useState<string>("");
  const [numTables, setNumTables] = useState<string>("");
  const [numFigures, setNumFigures] = useState<string>("");
  const [numReferences, setNumReferences] = useState<string>("");
  const [numVnReferences, setNumVnReferences] = useState<string>("");
  const [numForeignReferences, setNumForeignReferences] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [activeLecturerCode, setActiveLecturerCode] = useState<string>(
    () => getLecturerCode() || "",
  );
  const [aiLoadingId, setAiLoadingId] = useState<number | null>(null);
  const [aiResults, setAiResults] = useState<Record<number, any>>({});

  const handleAiAnalysis = async (sub: ProgressSubmission) => {
    if (!sub.reportDescription && !sub.reportTitle) return;

    setAiLoadingId(sub.submissionID);
    try {
      const mName = getMilestoneDisplayName(sub.milestoneCode, sub.ordinal);

      const subFiles = submissionFiles[sub.submissionCode] || [];
      const firstFileUrl = subFiles.length > 0 ? normalizeUrl(subFiles[0].fileURL) : null;

      const response = await fetchData<{ data: any }>("/thesis-ai/analyze-progress", {
        method: "POST",
        body: JSON.stringify({
          milestoneCode: sub.milestoneCode,
          milestoneName: mName,
          reportTitle: sub.reportTitle,
          reportDescription: sub.reportDescription,
          fileUrl: firstFileUrl
        })
      });

      if (response?.data) {
        setAiResults(prev => ({
          ...prev,
          [sub.submissionID]: response.data
        }));
      }
    } catch (err) {
      console.error("AI analysis failed:", err);
    } finally {
      setAiLoadingId(null);
    }
  };

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
        filterStatus === "all" || filterStatus === "reviewed" || filterStatus === "evaluation"
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
      const count = response.data.totalCount || response.totalCount || submissions.length;
      setTotalCount(count);
      if (filterStatus === "all" && !searchTerm) {
        setGrandTotal(count);
      }
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

  const filteredReports = reports
    .filter((report) => {
      const studentProfile = studentProfiles[report.studentUserCode];
      const topic = topics[report.studentUserCode];
      const normalized = normalizeLecturerState(report.lecturerState);

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "pending" && normalized === "PENDING") ||
        (filterStatus === "reviewed" && normalized !== "PENDING") ||
        (filterStatus === "approved" && normalized === "APPROVED") ||
        (filterStatus === "rejected" && normalized === "REVISION_REQUIRED") ||
        (filterStatus === "evaluation" &&
          (report.ordinal === 4 || report.milestoneCode === "MS_FULL"));

      const matchesSearch =
        !searchTerm ||
        studentProfile?.fullName
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        report.studentUserCode
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        topic?.title?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      const stateA = normalizeLecturerState(a.lecturerState);
      const stateB = normalizeLecturerState(b.lecturerState);

      // Prioritize PENDING status
      if (stateA === "PENDING" && stateB !== "PENDING") return -1;
      if (stateA !== "PENDING" && stateB === "PENDING") return 1;

      // Then sort by submission date (newest first)
      return (
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );
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

  const getMilestoneDisplayName = (
    milestoneCode: string,
    ordinal: number | null,
  ) => {
    if (milestoneCode === "MS_REG") return "Đăng ký đề tài";
    if (milestoneCode === "MS_PROG1") return "Báo cáo tiến độ lần 1";
    if (milestoneCode === "MS_PROG2") return "Báo cáo tiến độ lần 2";
    if (milestoneCode === "MS_FULL" || ordinal === 4) return "Báo cáo hoàn thiện";

    // Fallback for generated codes or unexpected ordinals
    if (ordinal === 1) return "Đăng ký đề tài";
    if (ordinal === 2) return "Báo cáo tiến độ lần 1";
    if (ordinal === 3) return "Báo cáo tiến độ lần 2";
    if (ordinal === 4) return "Báo cáo hoàn thiện";

    return milestoneCode;
  };

  const getReportTypeText = (milestoneCode: string) => {
    if (milestoneCode.includes("MS_TOP") || milestoneCode.includes("MS_PROG")) return "Báo cáo tiến độ";
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
            score:
              selectedReportForComment.ordinal === 4 ||
              selectedReportForComment.milestoneCode === "MS_FULL"
                ? parseFloat(score) || null
                : null,
            // Evaluation review fields
            reviewQuality,
            reviewAttitude,
            reviewCapability,
            reviewResultProcessing,
            reviewAchievements,
            reviewLimitations,
            reviewConclusion,
            scoreInWords,
            // structural fields
            numChapters: parseInt(numChapters) || null,
            numPages: parseInt(numPages) || null,
            numTables: parseInt(numTables) || null,
            numFigures: parseInt(numFigures) || null,
            numReferences: parseInt(numReferences) || null,
            numVietnameseReferences: parseInt(numVnReferences) || null,
            numForeignReferences: parseInt(numForeignReferences) || null,
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
      setScore("");
      setReviewQuality("");
      setReviewAttitude("");
      setReviewCapability("");
      setReviewResultProcessing("");
      setReviewAchievements("");
      setReviewLimitations("");
      setReviewConclusion("");
      setScoreInWords("");
      setNumChapters("");
      setNumPages("");
      setNumTables("");
      setNumFigures("");
      setNumReferences("");
      setNumVnReferences("");
      setNumForeignReferences("");
    } catch (err) {
      console.error("Error submitting comment:", err);
      setError("Không thể gửi nhận xét");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadFile = async (fileID: number, fileName: string) => {
    try {
      const downloadUrl = `/api/SubmissionFiles/download/${fileID}`;
      const url = normalizeUrl(downloadUrl);
      const token = getAccessToken();
      const resp = await fetch(url, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 302 || resp.status === 403) {
          navigate("/login");
          return;
        }
        throw new Error(`Download failed with status ${resp.status}`);
      }

      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
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
      addToast(
        "Không thể tải file. Vui lòng thử lại hoặc đăng nhập lại.",
        "error",
      );
    }
  };

  const handleExportEvaluation = async (topicCode: string) => {
    try {
      const url = normalizeUrl(
        `/api/reports/topics/${topicCode}/export-evaluation`,
      );
      const token = getAccessToken();
      const resp = await fetch(url, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!resp.ok) throw new Error("Export failed");

      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Phieu_Danh_Gia_${topicCode}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error exporting evaluation:", err);
      addToast("Không thể xuất phiếu đánh giá", "error");
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
                  {grandTotal || totalCount}
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
                  Báo cáo có phiếu đánh giá
                </div>
                <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
                  {reports.filter((r) => r.ordinal === 4 || r.milestoneCode === "MS_FULL").length}
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
                                  background:
                                    report.ordinal === 4 ||
                                    report.milestoneCode === "MS_FULL"
                                      ? "#F37021"
                                      : "#10B981",
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
                                  e.currentTarget.style.background =
                                    report.ordinal === 4 ||
                                    report.milestoneCode === "MS_FULL"
                                      ? "#E55A1B"
                                      : "#059669";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background =
                                    report.ordinal === 4 ||
                                    report.milestoneCode === "MS_FULL"
                                      ? "#F37021"
                                      : "#10B981";
                                }}
                                onClick={() =>
                                  setSelectedReportForComment(report)
                                }
                                title={
                                  report.ordinal === 4 ||
                                  report.milestoneCode === "MS_FULL"
                                    ? "Chấm điểm / Đánh giá"
                                    : "Đánh giá / chỉnh sửa"
                                }
                              >
                                {report.ordinal === 4 ||
                                report.milestoneCode === "MS_FULL" ? (
                                  <>
                                    <CheckCircle size={12} />
                                    <span>Chấm điểm</span>
                                  </>
                                ) : (
                                  <MessageSquare size={12} />
                                )}
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
                                {(report.ordinal === 4 ||
                                  report.milestoneCode === "MS_FULL") && (
                                  <span>Đã chấm điểm</span>
                                )}
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
          {/* Report Detail Modal */}
          {selectedReport && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(15, 23, 42, 0.75)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: "20px",
                animation: "fadeIn 0.3s ease-out",
              }}
              onClick={() => setSelectedReport(null)}
            >
              <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
              `}</style>
              <div
                style={{
                  background: "white",
                  width: "100%",
                  maxWidth: "1200px",
                  maxHeight: "90vh",
                  borderRadius: "32px",
                  overflow: "hidden",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                  display: "flex",
                  flexDirection: "column",
                  animation: "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                  position: "relative",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button X */}
                <button
                  onClick={() => setSelectedReport(null)}
                  style={{
                    position: "absolute",
                    top: "24px",
                    right: "24px",
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#64748b",
                    cursor: "pointer",
                    zIndex: 100,
                    transition: "all 0.2s ease",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#f1f5f9";
                    e.currentTarget.style.color = "#0f172a";
                    e.currentTarget.style.transform = "scale(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "white";
                    e.currentTarget.style.color = "#64748b";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  <X size={20} />
                </button>

                {/* Modal Content */}
                <div
                  className="custom-scrollbar"
                  style={{
                    overflowY: "auto",
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(10, 1fr)",
                      minHeight: "100%",
                    }}
                  >
                    {/* --- LEFT: REPORT DOSSIER (7 cols) --- */}
                    <div
                      style={{
                        gridColumn: "span 7",
                        padding: "48px",
                        borderRight: "1px solid #f1f5f9",
                      }}
                    >
                      {/* Header */}
                      <div style={{ marginBottom: "40px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "24px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              color: "#94a3b8",
                            }}
                          >
                            <BookOpen size={20} />
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: "900",
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                              }}
                            >
                              Chi tiết báo cáo tiến độ
                            </span>
                          </div>

                          {/* Status Badge */}
                          <div
                            style={{
                              padding: "6px 16px",
                              borderRadius: "12px",
                              border: "1px solid",
                              fontWeight: "900",
                              fontSize: "11px",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              backgroundColor:
                                normalizeLecturerState(
                                  selectedReport.lecturerState,
                                ) === "APPROVED"
                                  ? "#ecfdf5"
                                  : normalizeLecturerState(
                                        selectedReport.lecturerState,
                                      ) === "REVISION_REQUIRED"
                                    ? "#fff1f2"
                                    : "#fff7ed",
                              color:
                                normalizeLecturerState(
                                  selectedReport.lecturerState,
                                ) === "APPROVED"
                                  ? "#059669"
                                  : normalizeLecturerState(
                                        selectedReport.lecturerState,
                                      ) === "REVISION_REQUIRED"
                                    ? "#e11d48"
                                    : "#f37021",
                              borderColor:
                                normalizeLecturerState(
                                  selectedReport.lecturerState,
                                ) === "APPROVED"
                                  ? "#d1fae5"
                                  : normalizeLecturerState(
                                        selectedReport.lecturerState,
                                      ) === "REVISION_REQUIRED"
                                    ? "#ffe4e6"
                                    : "#ffedd5",
                            }}
                          >
                            <div
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                backgroundColor:
                                  normalizeLecturerState(
                                    selectedReport.lecturerState,
                                  ) === "APPROVED"
                                    ? "#10b981"
                                    : normalizeLecturerState(
                                          selectedReport.lecturerState,
                                        ) === "REVISION_REQUIRED"
                                      ? "#f43f5e"
                                      : "#f59e0b",
                              }}
                            />
                            {getStatusText(selectedReport.lecturerState)}
                          </div>
                        </div>

                        <h1
                          style={{
                            fontSize: "32px",
                            fontWeight: "900",
                            color: "#0f172a",
                            lineHeight: "1.2",
                            marginBottom: "24px",
                          }}
                        >
                          {topics[selectedReport.studentUserCode]?.title ||
                            "Tiêu đề đề tài đang cập nhật"}
                        </h1>

                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          <span
                            style={{
                              padding: "4px 12px",
                              background: "#0f172a",
                              color: "white",
                              borderRadius: "8px",
                              fontSize: "11px",
                              fontWeight: "900",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                             Mốc: {getMilestoneDisplayName(selectedReport.milestoneCode, selectedReport.ordinal)}
                          </span>
                          <span
                            style={{
                              padding: "4px 12px",
                              background: "#eff6ff",
                              color: "#1e40af",
                              borderRadius: "8px",
                              fontSize: "11px",
                              fontWeight: "900",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              border: "1px solid #dbeafe",
                            }}
                          >
                            Mã: {selectedReport.submissionCode}
                          </span>
                          <span
                            style={{
                              padding: "4px 12px",
                              background: "#fff7ed",
                              color: "#c2410c",
                              borderRadius: "8px",
                              fontSize: "11px",
                              fontWeight: "900",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              border: "1px solid #ffedd5",
                            }}
                          >
                            Lần nộp: {selectedReport.attemptNumber}
                          </span>
                        </div>
                      </div>
                      {/* Report Description */}
                      <div style={{ marginBottom: "32px" }}>
                        <h3
                          style={{
                            fontSize: "11px",
                            fontWeight: "900",
                            color: "#94a3b8",
                            textTransform: "uppercase",
                            letterSpacing: "0.2em",
                            marginBottom: "16px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <FileText size={14} /> Nội dung báo cáo
                        </h3>
                        <div
                          style={{
                            backgroundColor: "white",
                            borderRadius: "24px",
                            padding: "32px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                          }}
                        >
                          <p
                            style={{
                              color: "#1e293b",
                              fontWeight: "500",
                              lineHeight: "1.8",
                              fontSize: "15px",
                              margin: 0,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {selectedReport.reportDescription ||
                              "Sinh viên không cung cấp mô tả chi tiết cho lần nộp này."}
                          </p>
                        </div>
                      </div>

                      {/* AI Analysis Section */}
                      <div style={{ marginBottom: "32px" }}>
                        <h3
                          style={{
                            fontSize: "11px",
                            fontWeight: "900",
                            color: "#f37021",
                            textTransform: "uppercase",
                            letterSpacing: "0.2em",
                            marginBottom: "16px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <Sparkles size={14} /> Phân tích thông minh (AI)
                        </h3>
                        
                        {!aiResults[selectedReport.submissionID] ? (
                          <div style={{ 
                            padding: "24px", 
                            background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)", 
                            borderRadius: "24px", 
                            border: "1px dashed #fed7aa",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "12px",
                            textAlign: "center"
                          }}>
                            <p style={{ fontSize: "13px", color: "#c2410c", fontWeight: "600", margin: 0 }}>
                              Sử dụng AI để tóm tắt nhanh nội dung và nhận diện rủi ro từ báo cáo của sinh viên.
                            </p>
                            <button
                              onClick={() => void handleAiAnalysis(selectedReport)}
                              disabled={aiLoadingId === selectedReport.submissionID}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "10px 20px",
                                borderRadius: "12px",
                                border: "none",
                                background: "linear-gradient(135deg, #f37021 0%, #ff8838 100%)",
                                color: "white",
                                fontSize: "13px",
                                fontWeight: "800",
                                cursor: "pointer",
                                boxShadow: "0 4px 12px rgba(243, 112, 33, 0.2)",
                                transition: "all 0.2s ease"
                              }}
                            >
                              <Sparkles size={16} />
                              {aiLoadingId === selectedReport.submissionID ? "Đang phân tích..." : "Phân tích ngay với AI"}
                            </button>
                          </div>
                        ) : (
                          <div style={{ 
                            background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)", 
                            padding: "24px", 
                            borderRadius: "24px", 
                            border: "1px solid #fed7aa",
                            boxShadow: "0 4px 6px -1px rgba(243, 112, 33, 0.05)"
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                              <Sparkles size={18} color="#f37021" />
                              <span style={{ fontWeight: "900", fontSize: "12px", textTransform: "uppercase", color: "#c2410c", letterSpacing: "0.1em" }}>AI Insight</span>
                              <span style={{ 
                                marginLeft: "auto", 
                                padding: "4px 12px", 
                                borderRadius: "8px", 
                                fontSize: "11px", 
                                fontWeight: "800",
                                background: aiResults[selectedReport.submissionID].riskLevel === "Cao" ? "#fee2e2" : aiResults[selectedReport.submissionID].riskLevel === "Trung bình" ? "#fef3c7" : "#dcfce7",
                                color: aiResults[selectedReport.submissionID].riskLevel === "Cao" ? "#dc2626" : aiResults[selectedReport.submissionID].riskLevel === "Trung bình" ? "#d97706" : "#16a34a"
                              }}>
                                Rủi ro: {aiResults[selectedReport.submissionID].riskLevel}
                              </span>
                            </div>
                            
                            <p style={{ fontSize: "15px", color: "#334155", lineHeight: "1.8", margin: "0 0 20px 0", fontWeight: "500" }}>
                              {aiResults[selectedReport.submissionID].summary}
                            </p>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                              <div style={{ background: "rgba(22, 163, 74, 0.05)", padding: "16px", borderRadius: "16px", border: "1px solid rgba(22, 163, 74, 0.1)" }}>
                                <div style={{ fontSize: "11px", fontWeight: "900", color: "#166534", textTransform: "uppercase", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                                  <CheckCircle size={14} /> Kết quả chính
                                </div>
                                <div style={{ display: "grid", gap: "8px" }}>
                                  {aiResults[selectedReport.submissionID].keyAchievements?.map((ach: string, i: number) => (
                                    <div key={i} style={{ fontSize: "13px", color: "#166534", lineHeight: "1.4" }}>• {ach}</div>
                                  ))}
                                </div>
                              </div>
                              <div style={{ background: "rgba(220, 38, 38, 0.05)", padding: "16px", borderRadius: "16px", border: "1px solid rgba(220, 38, 38, 0.1)" }}>
                                <div style={{ fontSize: "11px", fontWeight: "900", color: "#991b1b", textTransform: "uppercase", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                                  <AlertCircle size={14} /> Vấn đề cần lưu ý
                                </div>
                                <div style={{ display: "grid", gap: "8px" }}>
                                  {aiResults[selectedReport.submissionID].identifiedRisks?.map((risk: string, i: number) => (
                                    <div key={i} style={{ fontSize: "13px", color: "#991b1b", lineHeight: "1.4" }}>• {risk}</div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div style={{ borderTop: "1px dashed #fed7aa", paddingTop: "20px" }}>
                              <div style={{ fontSize: "11px", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px" }}>Gợi ý phản hồi cho sinh viên:</div>
                              <div style={{ fontSize: "14px", color: "#475569", fontStyle: "italic", background: "white", padding: "16px", borderRadius: "12px", border: "1px solid #fff7ed", lineHeight: "1.6" }}>
                                "{aiResults[selectedReport.submissionID].suggestedFeedback}"
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                                            {/* Export Button if graded */}
                      {(selectedReport.ordinal === 4 ||
                        selectedReport.milestoneCode === "MS_FULL") &&
                        (topics[selectedReport.studentUserCode]?.status ===
                          "WAITING_FOR_DEFENSE" ||
                          topics[selectedReport.studentUserCode]?.status ===
                            "Đủ điều kiện bảo vệ") && (
                          <div
                            style={{
                              padding: "24px",
                              background: "#ecfdf5",
                              borderRadius: "24px",
                              border: "1px solid #d1fae5",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: "32px",
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
                                  padding: "10px",
                                  background: "white",
                                  borderRadius: "12px",
                                  color: "#10b981",
                                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                                }}
                              >
                                <CheckCircle size={20} />
                              </div>
                              <div>
                                <h4
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: "900",
                                    color: "#065f46",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    marginBottom: "2px",
                                  }}
                                >
                                  Báo cáo đã có điểm
                                </h4>
                                <p
                                  style={{
                                    fontSize: "13px",
                                    color: "#047857",
                                    fontWeight: "600",
                                  }}
                                >
                                  Đề tài đã đủ điều kiện bảo vệ. Bạn có thể xuất
                                  phiếu đánh giá ngay.
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                handleExportEvaluation(
                                  topics[selectedReport.studentUserCode]
                                    ?.topicCode || "",
                                )
                              }
                              style={{
                                padding: "10px 20px",
                                backgroundColor: "#10b981",
                                color: "white",
                                border: "none",
                                borderRadius: "12px",
                                fontSize: "13px",
                                fontWeight: "900",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
                              }}
                            >
                              <Download size={16} /> Xuất phiếu (Word)
                            </button>
                          </div>
                        )}

                      {/* Files Section */}
                      <div style={{ marginBottom: "32px" }}>
                        <h3
                          style={{
                            fontSize: "11px",
                            fontWeight: "900",
                            color: "#94a3b8",
                            textTransform: "uppercase",
                            letterSpacing: "0.2em",
                            marginBottom: "16px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <Download size={14} /> Tệp đính kèm
                        </h3>
                        <div style={{ display: "grid", gap: "12px" }}>
                          {submissionFiles[selectedReport.submissionCode]
                            ?.length > 0 ? (
                            submissionFiles[selectedReport.submissionCode].map(
                              (file) => (
                                <div
                                  key={file.fileID}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    background: "white",
                                    border: "1px solid #f1f5f9",
                                    borderRadius: "16px",
                                    padding: "16px",
                                    transition: "all 0.2s ease",
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
                                        width: "40px",
                                        height: "40px",
                                        backgroundColor: "#eff6ff",
                                        borderRadius: "12px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#3b82f6",
                                      }}
                                    >
                                      <FileText size={20} />
                                    </div>
                                    <div>
                                      <p
                                        style={{
                                          fontSize: "14px",
                                          fontWeight: "700",
                                          color: "#1e293b",
                                          margin: "0 0 2px 0",
                                        }}
                                      >
                                        {file.fileName}
                                      </p>
                                      <p
                                        style={{
                                          fontSize: "11px",
                                          fontWeight: "600",
                                          color: "#94a3b8",
                                          margin: 0,
                                        }}
                                      >
                                        {formatBytes(file.fileSizeBytes)}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() =>
                                      handleDownloadFile(
                                        file.fileID,
                                        file.fileName,
                                      )
                                    }
                                    style={{
                                      padding: "8px 16px",
                                      backgroundColor: "#f8fafc",
                                      color: "#64748b",
                                      border: "1px solid #e2e8f0",
                                      borderRadius: "10px",
                                      fontSize: "12px",
                                      fontWeight: "800",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                    }}
                                  >
                                    <Download size={14} /> Tải về
                                  </button>
                                </div>
                              ),
                            )
                          ) : (
                            <div
                              style={{
                                padding: "24px",
                                textAlign: "center",
                                background: "#f8fafc",
                                borderRadius: "16px",
                                color: "#94a3b8",
                                border: "1px dashed #e2e8f0",
                              }}
                            >
                              <Info size={24} style={{ marginBottom: "8px" }} />
                              <p style={{ margin: 0, fontSize: "13px" }}>
                                Không có tệp đính kèm nào
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Feedback Section */}
                      {selectedReport.lecturerComment && (
                        <div style={{ marginTop: "40px" }}>
                          <h3
                            style={{
                              fontSize: "11px",
                              fontWeight: "900",
                              color: "#f43f5e",
                              textTransform: "uppercase",
                              letterSpacing: "0.2em",
                              marginBottom: "16px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <MessageCircle size={14} /> Phản hồi từ giảng viên
                          </h3>
                          <div
                            style={{
                              backgroundColor: "#fff1f2",
                              borderRadius: "24px",
                              padding: "24px",
                              border: "1px solid #ffe4e6",
                            }}
                          >
                            <p
                              style={{
                                color: "#be123c",
                                fontWeight: "700",
                                fontSize: "14px",
                                lineHeight: "1.6",
                                margin: "0 0 16px 0",
                              }}
                            >
                              {selectedReport.lecturerComment}
                            </p>
                            <div
                              style={{
                                display: "flex",
                                gap: "24px",
                                paddingTop: "16px",
                                borderTop: "1px solid rgba(225, 29, 72, 0.1)",
                              }}
                            >
                              <div>
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: "900",
                                    color: "#fb7185",
                                    textTransform: "uppercase",
                                    display: "block",
                                    marginBottom: "4px",
                                  }}
                                >
                                  Cấp độ
                                </span>
                                <span
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: "800",
                                    color: "#9f1239",
                                  }}
                                >
                                  {selectedReport.feedbackLevel ||
                                    "Chưa đánh giá"}
                                </span>
                              </div>
                              {(selectedReport.ordinal === 4 ||
                                selectedReport.milestoneCode === "MS_FULL") && (
                                <div>
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: "900",
                                      color: "#fb7185",
                                      textTransform: "uppercase",
                                      display: "block",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    Điểm số
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "16px",
                                      fontWeight: "900",
                                      color: "#f43f5e",
                                    }}
                                  >
                                    {topics[selectedReport.studentUserCode]
                                      ?.score ?? "---"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      
                    </div>

                    {/* --- RIGHT: STUDENT PROFILE (3 cols) --- */}
                    <div
                      style={{
                        gridColumn: "span 3",
                        backgroundColor: "#f8fafc",
                        padding: "40px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ textAlign: "center", marginBottom: "40px" }}>
                          <div
                            style={{
                              position: "relative",
                              display: "inline-block",
                              marginBottom: "24px",
                            }}
                          >
                            <div
                              style={{
                                width: "128px",
                                height: "128px",
                                borderRadius: "32px",
                                border: "4px solid white",
                                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                                overflow: "hidden",
                                backgroundColor: "#003D82",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {studentProfiles[selectedReport.studentUserCode]
                                ?.studentImage ? (
                                <img
                                  src={normalizeUrl(
                                    studentProfiles[selectedReport.studentUserCode]
                                      .studentImage,
                                  )}
                                  alt="Student Avatar"
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                />
                              ) : (
                                <User size={56} color="white" />
                              )}
                            </div>
                          </div>
                          <h3
                            style={{
                              fontSize: "22px",
                              fontWeight: "900",
                              color: "#0f172a",
                              lineHeight: "1.2",
                              marginBottom: "6px",
                            }}
                          >
                            {studentProfiles[selectedReport.studentUserCode]
                              ?.fullName || "Tên sinh viên"}
                          </h3>
                          <div
                            style={{
                              display: "inline-block",
                              padding: "4px 12px",
                              backgroundColor: "rgba(243, 112, 33, 0.1)",
                              borderRadius: "8px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: "900",
                                color: "#f37021",
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                              }}
                            >
                              Mã SV: {selectedReport.studentUserCode}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "grid", gap: "12px" }}>
                          {[
                            {
                              icon: <Mail size={16} />,
                              label: "Email",
                              value:
                                studentProfiles[selectedReport.studentUserCode]
                                  ?.studentEmail || "---",
                            },
                            {
                              icon: <Phone size={16} />,
                              label: "SĐT",
                              value:
                                studentProfiles[selectedReport.studentUserCode]
                                  ?.phoneNumber || "---",
                            },
                            {
                              icon: <Calendar size={16} />,
                              label: "Ngày nộp",
                              value: new Date(
                                selectedReport.submittedAt,
                              ).toLocaleDateString("vi-VN"),
                            },
                          ].map((item, idx) => (
                            <div
                              key={idx}
                              style={{
                                padding: "16px",
                                backgroundColor: "white",
                                borderRadius: "16px",
                                border: "1px solid #f1f5f9",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  color: "#94a3b8",
                                }}
                              >
                                {item.icon}
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: "900",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                  }}
                                >
                                  {item.label}
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: "13px",
                                  fontWeight: "700",
                                  color: "#334155",
                                  wordBreak: "break-all",
                                }}
                              >
                                {item.value}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div
                          style={{
                            marginTop: "32px",
                            padding: "20px",
                            backgroundColor: "white",
                            borderRadius: "20px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                            display: "flex",
                            gap: "16px",
                            alignItems: "flex-start",
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: "4px",
                              backgroundColor: "#3b82f6",
                            }}
                          />
                          <div
                            style={{
                              width: "40px",
                              height: "40px",
                              backgroundColor: "#eff6ff",
                              borderRadius: "12px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#3b82f6",
                              flexShrink: 0,
                            }}
                          >
                            <Info size={20} />
                          </div>
                          <div>
                            <h4
                              style={{
                                fontSize: "11px",
                                fontWeight: "800",
                                color: "#64748b",
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                                marginBottom: "4px",
                              }}
                            >
                              Ghi chú tiến độ
                            </h4>
                            <p
                              style={{
                                fontSize: "13px",
                                color: "#1e293b",
                                fontWeight: "600",
                                lineHeight: "1.6",
                                margin: 0,
                              }}
                            >
                              Lần nộp thứ{" "}
                              <span style={{ color: "#3b82f6" }}>
                                {selectedReport.attemptNumber}
                              </span>{" "}
                              cho mốc{" "}
                              <span style={{ color: "#3b82f6" }}>
                               {getMilestoneDisplayName(selectedReport.milestoneCode, selectedReport.ordinal)}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
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
                  {/* AI Analysis Integration in Comment Modal */}
                  <div style={{ 
                    background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)", 
                    padding: "16px", 
                    borderRadius: "16px", 
                    border: "1px solid #fed7aa",
                    marginBottom: "8px"
                  }}>
                    {!aiResults[selectedReportForComment.submissionID] ? (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Sparkles size={16} color="#f37021" />
                          <span style={{ fontSize: "12px", fontWeight: "800", color: "#c2410c" }}>AI Hỗ trợ nhận xét</span>
                        </div>
                        <button
                          onClick={() => void handleAiAnalysis(selectedReportForComment)}
                          disabled={aiLoadingId === selectedReportForComment.submissionID}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#f37021",
                            color: "white",
                            fontSize: "11px",
                            fontWeight: "800",
                            cursor: "pointer"
                          }}
                        >
                          {aiLoadingId === selectedReportForComment.submissionID ? "Đang phân tích..." : "Tóm tắt & Gợi ý"}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                          <Sparkles size={16} color="#f37021" />
                          <span style={{ fontSize: "11px", fontWeight: "900", color: "#c2410c", textTransform: "uppercase" }}>AI Insight</span>
                          <span style={{ 
                            marginLeft: "auto", 
                            fontSize: "10px", 
                            fontWeight: "800",
                            color: aiResults[selectedReportForComment.submissionID].riskLevel === "Cao" ? "#dc2626" : "#d97706"
                          }}>
                            Rủi ro: {aiResults[selectedReportForComment.submissionID].riskLevel}
                          </span>
                        </div>
                        <p style={{ fontSize: "12px", color: "#475569", lineHeight: "1.5", marginBottom: "12px" }}>
                          {aiResults[selectedReportForComment.submissionID].summary}
                        </p>
                        <div style={{ background: "white", padding: "10px", borderRadius: "8px", border: "1px solid #fff7ed" }}>
                          <div style={{ fontSize: "10px", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase", marginBottom: "4px" }}>Gợi ý:</div>
                          <div style={{ fontSize: "12px", color: "#334155", fontStyle: "italic" }}>
                            "{aiResults[selectedReportForComment.submissionID].suggestedFeedback}"
                          </div>
                          <button
                            onClick={() => setLecturerComment(aiResults[selectedReportForComment.submissionID].suggestedFeedback)}
                            style={{
                              marginTop: "8px",
                              padding: "4px 8px",
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: "700",
                              color: "#64748b",
                              cursor: "pointer"
                            }}
                          >
                            Dùng gợi ý này
                          </button>
                        </div>
                      </div>
                    )}
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

                  {(selectedReportForComment.ordinal === 4 ||
                    selectedReportForComment.milestoneCode === "MS_FULL") && (
                    <div
                      style={{
                        background: "#FFF7ED",
                        border: "1px solid #FFEDD5",
                        borderRadius: "10px",
                        padding: "20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "20px",
                      }}
                    >
                      <h4
                        style={{
                          fontSize: "14px",
                          fontWeight: "700",
                          color: "#9A3412",
                          textTransform: "uppercase",
                          margin: 0,
                          borderBottom: "1px solid #FED7AA",
                          paddingBottom: "8px",
                        }}
                      >
                        Phiếu đánh giá chi tiết (Mốc 4)
                      </h4>

                      {/* Score Section */}
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
                              color: "#C2410C",
                              display: "block",
                              marginBottom: "4px",
                            }}
                          >
                            Điểm hướng dẫn (0-10)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="10"
                            value={score}
                            onChange={(e) => setScore(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "10px",
                              border: "1px solid #FDBA74",
                              borderRadius: "6px",
                              fontSize: "14px",
                              fontWeight: "600",
                            }}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#C2410C",
                              display: "block",
                              marginBottom: "4px",
                            }}
                          >
                            Điểm bằng chữ
                          </label>
                          <input
                            type="text"
                            value={scoreInWords}
                            onChange={(e) => setScoreInWords(e.target.value)}
                            placeholder="Ví dụ: Tám phẩy không"
                            style={{
                              width: "100%",
                              padding: "10px",
                              border: "1px solid #FDBA74",
                              borderRadius: "6px",
                              fontSize: "14px",
                            }}
                          />
                        </div>
                      </div>

                      {/* Reviews Section */}
                      <div
                        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
                      >
                        {[
                          {
                            label: "Về chất lượng đề tài",
                            value: reviewQuality,
                            setter: setReviewQuality,
                          },
                          {
                            label: "Về thái độ, ý thức của sinh viên",
                            value: reviewAttitude,
                            setter: setReviewAttitude,
                          },
                          {
                            label: "Về năng lực làm việc độc lập...",
                            value: reviewCapability,
                            setter: setReviewCapability,
                          },
                          {
                            label: "Về năng lực xử lý/biện luận kết quả",
                            value: reviewResultProcessing,
                            setter: setReviewResultProcessing,
                          },
                          {
                            label: "Những thành công đạt được",
                            value: reviewAchievements,
                            setter: setReviewAchievements,
                          },
                          {
                            label: "Những hạn chế của đồ án",
                            value: reviewLimitations,
                            setter: setReviewLimitations,
                          },
                          {
                            label: "Kết luận (Đồng ý bảo vệ hay không)",
                            value: reviewConclusion,
                            setter: setReviewConclusion,
                          },
                        ].map((item) => (
                          <div key={item.label}>
                            <label
                              style={{
                                fontSize: "12px",
                                fontWeight: "600",
                                color: "#C2410C",
                                display: "block",
                                marginBottom: "4px",
                              }}
                            >
                              {item.label}
                            </label>
                            <textarea
                              value={item.value}
                              onChange={(e) => item.setter(e.target.value)}
                              style={{
                                width: "100%",
                                padding: "8px",
                                border: "1px solid #FDBA74",
                                borderRadius: "6px",
                                fontSize: "13px",
                                minHeight: "60px",
                              }}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Stats Section */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, 1fr)",
                          gap: "12px",
                        }}
                      >
                        {[
                          {
                            label: "Số chương",
                            value: numChapters,
                            setter: setNumChapters,
                          },
                          { label: "Số trang", value: numPages, setter: setNumPages },
                          { label: "Số bảng", value: numTables, setter: setNumTables },
                          { label: "Số hình", value: numFigures, setter: setNumFigures },
                          {
                            label: "Tổng TL tham khảo",
                            value: numReferences,
                            setter: setNumReferences,
                          },
                          {
                            label: "TL Tiếng Việt",
                            value: numVnReferences,
                            setter: setNumVnReferences,
                          },
                          {
                            label: "TL Nước ngoài",
                            value: numForeignReferences,
                            setter: setNumForeignReferences,
                          },
                        ].map((item) => (
                          <div key={item.label}>
                            <label
                              style={{
                                fontSize: "11px",
                                fontWeight: "600",
                                color: "#C2410C",
                                display: "block",
                                marginBottom: "2px",
                              }}
                            >
                              {item.label}
                            </label>
                            <input
                              type="number"
                              value={item.value}
                              onChange={(e) => item.setter(e.target.value)}
                              style={{
                                width: "100%",
                                padding: "6px",
                                border: "1px solid #FDBA74",
                                borderRadius: "4px",
                                fontSize: "12px",
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
                        <option value="APPROVED">Duyệt</option>
                        <option value="REVISION_REQUIRED">Yêu cầu sửa đổi</option>
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
                        setScore("");
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
