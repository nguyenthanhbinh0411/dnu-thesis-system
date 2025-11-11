import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  BookOpen,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit,
  User,
  FileText,
  Loader2,
  Filter,
  Eye,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  Tag as TagIcon,
} from "lucide-react";
import { fetchData, getAvatarUrl } from "../../api/fetchData";
import { useToast } from "../../context/useToast";
import type { Topic } from "../../types/topic";
import type { StudentProfile } from "../../types/studentProfile";
import type { LecturerProfile } from "../../types/lecturer-profile";
import type { ProgressMilestone } from "../../types/progressMilestone";
import type { Tag, CatalogTopicTag, TopicTag } from "../../types/tag";
import type { ApiResponse } from "../../types/api";
import { useAuth } from "../../hooks/useAuth";

interface TopicDisplay {
  topicID: number;
  topicCode: string;
  title: string;
  description: string;
  studentCode: string;
  studentName: string;
  submissionDate: string;
  status: "Chờ duyệt" | "Đã duyệt" | "Từ chối" | "Cần sửa đổi";
  category: string;
  comments?: string;
  studentProfile?: StudentProfile;
  supervisorLecturerProfileID?: number | null;
  supervisorLecturerCode?: string | null;
  lecturerProfile?: LecturerProfile | null;
}

const LecturerTopicReview: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [topics, setTopics] = useState<TopicDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const [commentModal, setCommentModal] = useState<{
    isOpen: boolean;
    action: "reject" | "revision" | null;
    topicID: number | null;
    topicTitle: string;
  }>({
    isOpen: false,
    action: null,
    topicID: null,
    topicTitle: "",
  });
  const [commentText, setCommentText] = useState("");

  const [viewCommentModal, setViewCommentModal] = useState<{
    isOpen: boolean;
    comments: string;
    topicTitle: string;
  }>({
    isOpen: false,
    comments: "",
    topicTitle: "",
  });
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    topic: TopicDisplay | null;
  }>({
    isOpen: false,
    topic: null,
  });
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    action: "approve" | "reject" | "revision" | null;
    topicTitle: string;
  }>({
    isOpen: false,
    action: null,
    topicTitle: "",
  });

  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    topic: TopicDisplay | null;
  }>({
    isOpen: false,
    topic: null,
  });

  const [topicTags, setTopicTags] = useState<Tag[]>([]);

  const [statusFilter, setStatusFilter] = useState<string>("Chờ duyệt");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchTrigger, setSearchTrigger] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10; // Fixed page size for now
  const [totalCount, setTotalCount] = useState<number>(0);
  const [stats, setStats] = useState<{
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    revision: number;
  }>({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    revision: 0,
  });

  // Fetch stats for all topics (not filtered)
  const fetchStats = useCallback(async () => {
    try {
      const statsResponse = await fetchData<{
        data: Topic[];
        totalCount: number;
      }>(`/Topics/get-list?Page=1&PageSize=1000`); // Get a large number to count all

      const allTopics = statsResponse.data;
      const statsData = {
        total: statsResponse.totalCount,
        approved: allTopics.filter(
          (t) => mapApiStatusToDisplay(t.status) === "Đã duyệt"
        ).length,
        pending: allTopics.filter(
          (t) => mapApiStatusToDisplay(t.status) === "Chờ duyệt"
        ).length,
        rejected: allTopics.filter(
          (t) => mapApiStatusToDisplay(t.status) === "Từ chối"
        ).length,
        revision: allTopics.filter(
          (t) => mapApiStatusToDisplay(t.status) === "Cần sửa đổi"
        ).length,
      };

      setStats(statsData);
    } catch (err) {
      console.warn("Failed to fetch stats:", err);
      // Keep existing stats or set to 0
    }
  }, []);

  // Build API URL based on status filter
  const buildApiUrl = (
    status: string,
    search: string,
    page: number,
    size: number
  ): string => {
    let url = `/Topics/get-list?Page=${page}&PageSize=${size}&SortBy=createdAt&SortOrder=desc`;

    if (search.trim()) {
      url += `&Search=${encodeURIComponent(search.trim())}`;
    }

    if (status !== "all") {
      const statusMap: { [key: string]: string } = {
        "Chờ duyệt": "Đang chờ",
        "Đã duyệt": "Đã duyệt",
        "Cần sửa đổi": "Cần sửa đổi",
        "Từ chối": "Từ chối",
      };

      const encodedStatus = encodeURIComponent(statusMap[status] || status);
      url += `&Status=${encodedStatus}`;
    }

    return url;
  };

  // Fetch topics for the lecturer
  useEffect(() => {
    const fetchTopics = async () => {
      if (!user?.userCode) return;

      try {
        setLoading(true);
        setError(null);

        const apiUrl = buildApiUrl(
          statusFilter,
          searchTerm,
          currentPage,
          pageSize
        );
        const topicsResponse = await fetchData<{
          data: Topic[];
          totalCount: number;
        }>(apiUrl);

        setTotalCount(topicsResponse.totalCount);

        // Collect all unique student codes and lecturer codes
        const studentCodes = [
          ...new Set(
            topicsResponse.data
              .map((topic) => topic.proposerStudentCode)
              .filter((code) => code)
          ),
        ];
        const lecturerCodes = [
          ...new Set(
            topicsResponse.data
              .map((topic) => topic.supervisorLecturerCode)
              .filter((code) => code)
          ),
        ];

        // Fetch all student profiles in one request
        const studentProfilesMap: { [key: string]: StudentProfile } = {};
        if (studentCodes.length > 0) {
          try {
            const studentCodesParam = studentCodes
              .map((code) => `StudentCodes=${encodeURIComponent(code)}`)
              .join("&");
            const studentResponse = await fetchData<{
              data: StudentProfile[];
            }>(`/StudentProfiles/get-list?${studentCodesParam}`);
            studentResponse.data.forEach((profile) => {
              studentProfilesMap[profile.studentCode] = profile;
            });
          } catch (err) {
            console.warn("Failed to fetch student profiles:", err);
          }
        }

        // Fetch all lecturer profiles in one request
        const lecturerProfilesMap: { [key: string]: LecturerProfile } = {};
        if (lecturerCodes.length > 0) {
          try {
            const lecturerCodesParam = lecturerCodes
              .filter((code) => code) // Filter out null/undefined values
              .map((code) => `LecturerCodes=${encodeURIComponent(code!)}`)
              .join("&");
            const lecturerResponse = await fetchData<{
              data: LecturerProfile[];
            }>(`/LecturerProfiles/get-list?${lecturerCodesParam}`);
            lecturerResponse.data.forEach((profile) => {
              lecturerProfilesMap[profile.lecturerCode] = profile;
            });
          } catch (err) {
            console.warn("Failed to fetch lecturer profiles:", err);
          }
        }

        // Transform topics to display format
        const displayTopics: TopicDisplay[] = topicsResponse.data.map(
          (topic) => {
            const studentProfile =
              studentProfilesMap[topic.proposerStudentCode || ""];
            const lecturerProfile =
              lecturerProfilesMap[topic.supervisorLecturerCode || ""] || null;

            return {
              topicID: topic.topicID,
              topicCode: topic.topicCode,
              title: topic.title,
              description: topic.summary, // Using summary as description
              studentCode: topic.proposerStudentCode || "",
              studentName: studentProfile?.fullName || "Unknown",
              submissionDate: topic.createdAt,
              status: mapApiStatusToDisplay(topic.status),
              category:
                topic.type === "CATALOG" ? "Đề tài catalog" : "Đề tài tự chọn",
              comments: topic.lecturerComment || "", // Include lecturer comments from API
              studentProfile,
              supervisorLecturerProfileID: topic.supervisorLecturerProfileID,
              supervisorLecturerCode: topic.supervisorLecturerCode,
              lecturerProfile,
            };
          }
        );

        setTopics(displayTopics);
      } catch (err) {
        console.error("Failed to fetch topics:", err);
        setError("Không thể tải danh sách đề tài. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    };

    fetchTopics();
    fetchStats(); // Fetch stats whenever topics change
  }, [
    user?.userCode,
    statusFilter,
    searchTerm,
    searchTrigger,
    currentPage,
    pageSize,
    fetchStats,
  ]);

  // Map API status to display status
  const mapApiStatusToDisplay = (apiStatus: string): TopicDisplay["status"] => {
    const status = apiStatus.toLowerCase();
    switch (status) {
      case "approved":
      case "đã duyệt":
        return "Đã duyệt";
      case "rejected":
      case "từ chối":
        return "Từ chối";
      case "revision":
      case "cần sửa đổi":
        return "Cần sửa đổi";
      case "pending":
      case "đang chờ":
      case "chờ duyệt":
      default:
        return "Chờ duyệt";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Đã duyệt":
        return <CheckCircle size={16} color="#22C55E" />;
      case "Chờ duyệt":
        return <Clock size={16} color="#F59E0B" />;
      case "Từ chối":
        return <AlertCircle size={16} color="#EF4444" />;
      case "Cần sửa đổi":
        return <Edit size={16} color="#F59E0B" />;
      default:
        return <Clock size={16} color="#6B7280" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "Đã duyệt":
        return "Đã duyệt";
      case "Chờ duyệt":
        return "Chờ duyệt";
      case "Từ chối":
        return "Từ chối";
      case "Cần sửa đổi":
        return "Cần sửa đổi";
      default:
        return "Không xác định";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Đã duyệt":
        return "#22C55E";
      case "Chờ duyệt":
        return "#F59E0B";
      case "Từ chối":
        return "#EF4444";
      case "Cần sửa đổi":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  const handleApprove = async (topicID: number) => {
    try {
      setUpdatingStatus(`approve-${topicID}`);

      // First, approve the topic
      await fetchData(`/Topics/update/${topicID}`, {
        method: "PUT",
        body: {
          status: "Đã duyệt",
          lecturerComment: "",
        },
      });

      // Get the topic details to get topicCode
      const topic = topics.find((t) => t.topicID === topicID);
      if (!topic || !topic.supervisorLecturerCode) {
        throw new Error("Missing topic or lecturer information");
      }

      // Create TopicLecturer association
      try {
        // First get-create to ensure data structure (GET request)
        await fetchData(`/TopicLecturers/get-create`);

        // Then create the actual association
        await fetchData(`/TopicLecturers/create`, {
          method: "POST",
          body: {
            topicID: topicID,
            topicCode: topic.topicCode,
            lecturerProfileID: topic.supervisorLecturerProfileID || 0,
            lecturerCode: topic.supervisorLecturerCode,
            isPrimary: true,
            createdAt: new Date().toISOString(),
          },
        });
      } catch (lecturerErr) {
        console.warn(
          "Failed to create topic-lecturer association:",
          lecturerErr
        );
        // Continue with approval even if lecturer association fails
      }

      // Update progress milestone
      try {
        // First get current milestone data
        const currentMilestoneResponse = await fetchData<{
          data: ProgressMilestone;
        }>(`/ProgressMilestones/get-update/${topicID}`);
        const currentMilestone = currentMilestoneResponse.data;

        // Update only the specified fields
        const updatedMilestone = {
          ...currentMilestone,
          milestoneTemplateCode: "MS_PROG1",
          ordinal: 2,
          state: "Đang thực hiện",
          completedAt1: new Date().toISOString(),
        };

        // Update the milestone by topic ID (PUT request)
        await fetchData(`/ProgressMilestones/update/${topicID}`, {
          method: "PUT",
          body: updatedMilestone,
        });
      } catch (progressErr) {
        console.warn("Failed to update progress milestone:", progressErr);
        // Continue with approval even if progress update fails
      }

      // Update local state
      setTopics(
        topics.map((t) =>
          t.topicID === topicID ? { ...t, status: "Đã duyệt" as const } : t
        )
      );

      showSuccessModal(
        "approve",
        topics.find((t) => t.topicID === topicID)?.title || ""
      );

      // Reload page after successful approval
      window.location.reload();
    } catch (err) {
      console.error("Failed to approve topic:", err);
      addToast("Không thể duyệt đề tài. Vui lòng thử lại.", "error");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleReject = async (topicID: number, comment: string) => {
    try {
      setUpdatingStatus(`reject-${topicID}`);

      await fetchData(`/Topics/update/${topicID}`, {
        method: "PUT",
        body: {
          status: "Từ chối",
          lecturerComment: comment,
        },
      });

      // Update local state
      setTopics(
        topics.map((topic) =>
          topic.topicID === topicID
            ? { ...topic, status: "Từ chối" as const, comments: comment }
            : topic
        )
      );
      showSuccessModal(
        "reject",
        topics.find((t) => t.topicID === topicID)?.title || ""
      );

      // Reload page after successful rejection
      window.location.reload();
    } catch (err) {
      console.error("Failed to reject topic:", err);
      addToast("Không thể từ chối đề tài. Vui lòng thử lại.", "error");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleRequestRevision = async (topicID: number, comment: string) => {
    try {
      setUpdatingStatus(`revision-${topicID}`);

      await fetchData(`/Topics/update/${topicID}`, {
        method: "PUT",
        body: {
          status: "Cần sửa đổi",
          lecturerComment: comment,
        },
      });

      // Update local state
      setTopics(
        topics.map((topic) =>
          topic.topicID === topicID
            ? { ...topic, status: "Cần sửa đổi" as const, comments: comment }
            : topic
        )
      );
      showSuccessModal(
        "revision",
        topics.find((t) => t.topicID === topicID)?.title || ""
      );

      // Reload page after successful revision request
      window.location.reload();
    } catch (err) {
      console.error("Failed to request revision:", err);
      addToast("Không thể yêu cầu sửa đổi đề tài. Vui lòng thử lại.", "error");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const openCommentModal = (
    action: "reject" | "revision",
    topicID: number,
    topicTitle: string
  ) => {
    setCommentModal({
      isOpen: true,
      action,
      topicID,
      topicTitle,
    });
    setCommentText("");
  };

  const closeCommentModal = () => {
    setCommentModal({
      isOpen: false,
      action: null,
      topicID: null,
      topicTitle: "",
    });
    setCommentText("");
  };

  const openViewCommentModal = (comments: string, topicTitle: string) => {
    setViewCommentModal({
      isOpen: true,
      comments,
      topicTitle,
    });
  };

  const closeViewCommentModal = () => {
    setViewCommentModal({
      isOpen: false,
      comments: "",
      topicTitle: "",
    });
  };

  const handleCommentSubmit = async () => {
    if (!commentModal.topicID || !commentModal.action || !commentText.trim())
      return;

    try {
      if (commentModal.action === "reject") {
        await handleReject(commentModal.topicID, commentText.trim());
      } else if (commentModal.action === "revision") {
        await handleRequestRevision(commentModal.topicID, commentText.trim());
      }
      closeCommentModal();
    } catch {
      // Error handling is done in the individual functions
    }
  };

  const openConfirmationModal = (topic: TopicDisplay) => {
    setConfirmationModal({
      isOpen: true,
      topic,
    });
  };

  const closeConfirmationModal = () => {
    setConfirmationModal({
      isOpen: false,
      topic: null,
    });
  };

  const handleConfirmApprove = async () => {
    if (!confirmationModal.topic) return;

    try {
      await handleApprove(confirmationModal.topic.topicID);
      closeConfirmationModal();
      showSuccessModal("approve", confirmationModal.topic.title);
    } catch {
      // Error handling is done in handleApprove
    }
  };

  const showSuccessModal = (
    action: "approve" | "reject" | "revision",
    topicTitle: string
  ) => {
    setSuccessModal({
      isOpen: true,
      action,
      topicTitle,
    });
  };

  const closeSuccessModal = () => {
    setSuccessModal({
      isOpen: false,
      action: null,
      topicTitle: "",
    });
  };

  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setCurrentPage(1); // Reset to first page when changing filter
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const openDetailModal = async (topic: TopicDisplay) => {
    // Fetch topic tags
    try {
      let tags: Tag[] = [];

      if (topic.category === "Đề tài catalog") {
        // For catalog topics, get tags from CatalogTopicTags
        const catalogTopicTagsRes = await fetchData(
          `/CatalogTopicTags/list?CatalogTopicCode=${topic.topicCode}`
        );
        const catalogTopicTags =
          (catalogTopicTagsRes as ApiResponse<CatalogTopicTag[]>)?.data || [];

        if (catalogTopicTags.length > 0) {
          // Get tag details
          const tagCode = catalogTopicTags[0].tagCode;
          const tagRes = await fetchData(`/Tags/list?TagCode=${tagCode}`);
          const tagData = (tagRes as ApiResponse<Tag[]>)?.data || [];
          tags = tagData;
        }
      } else if (topic.category === "Đề tài tự chọn") {
        // For self-proposed topics, get tags from TopicTags
        const topicTagsRes = await fetchData(
          `/TopicTags/by-topic/${topic.topicCode}`
        );
        const topicTagRecords =
          (topicTagsRes as ApiResponse<TopicTag[]>)?.data || [];

        if (topicTagRecords.length > 0) {
          // Get tag details for each tag
          const tagPromises = topicTagRecords.map(async (record) => {
            try {
              const tagRes = await fetchData(
                `/Tags/get-by-code/${record.tagCode}`
              );
              return (tagRes as ApiResponse<Tag>)?.data;
            } catch {
              return null;
            }
          });

          const tagResults = await Promise.all(tagPromises);
          tags = tagResults.filter((tag): tag is Tag => tag !== null);
        }
      }

      setTopicTags(tags);
    } catch (error) {
      console.error("Error fetching topic tags:", error);
      setTopicTags([]);
    }

    setDetailModal({
      isOpen: true,
      topic,
    });
  };

  const closeDetailModal = () => {
    setDetailModal({
      isOpen: false,
      topic: null,
    });
    setTopicTags([]);
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
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
          <BookOpen size={32} color="#F59E0B" />
          Quản lý đề tài
        </h1>
        <p style={{ fontSize: "14px", color: "#666" }}>
          Xem và duyệt các đề tài luận văn của sinh viên
        </p>
      </div>

      {/* Filter Section */}
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="text"
              ref={searchInputRef}
              placeholder="Tìm theo tên đề tài, mã đề tài, tên sinh viên..."
              style={{
                padding: "8px 12px",
                border: "1px solid #D1D5DB",
                borderRadius: "8px",
                fontSize: "14px",
                background: "white",
                minWidth: "300px",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#F59E0B";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#D1D5DB";
              }}
            />
            <button
              onClick={() => {
                const searchValue = searchInputRef.current?.value || "";
                setSearchTerm(searchValue);
                setCurrentPage(1); // Reset to first page when searching
                setSearchTrigger((prev) => prev + 1); // Trigger re-fetch
              }}
              style={{
                padding: "8px 16px",
                background: "#F59E0B",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#D97706";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#F59E0B";
              }}
            >
              <Search size={16} />
              Tìm kiếm
            </button>
          </div>

          <label
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#374151",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Filter size={16} />
            Lọc theo trạng thái:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #D1D5DB",
              borderRadius: "8px",
              fontSize: "14px",
              background: "white",
              cursor: "pointer",
              minWidth: "160px",
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="Chờ duyệt">Chờ duyệt</option>
            <option value="Đã duyệt">Đã duyệt</option>
            <option value="Cần sửa đổi">Cần sửa đổi</option>
            <option value="Từ chối">Từ chối</option>
          </select>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#FEE2E2",
            border: "1px solid #EF4444",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "24px",
            color: "#DC2626",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "48px" }}>
          <Loader2
            size={32}
            color="#F59E0B"
            style={{ animation: "spin 1s linear infinite" }}
          />
          <p style={{ marginTop: "16px", color: "#666" }}>
            Đang tải danh sách đề tài...
          </p>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "20px",
              marginBottom: "32px",
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
                border: "1px solid #F59E0B",
                borderRadius: "12px",
                padding: "20px",
                textAlign: "center",
              }}
            >
              <BookOpen
                size={24}
                color="#F59E0B"
                style={{ marginBottom: "8px" }}
              />
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "700",
                  color: "#F59E0B",
                  marginBottom: "4px",
                }}
              >
                {stats.total}
              </div>
              <div style={{ fontSize: "12px", color: "#666" }}>Tổng đề tài</div>
            </div>

            <div
              style={{
                background: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
                border: "1px solid #22C55E",
                borderRadius: "12px",
                padding: "20px",
                textAlign: "center",
              }}
            >
              <CheckCircle
                size={24}
                color="#22C55E"
                style={{ marginBottom: "8px" }}
              />
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "700",
                  color: "#22C55E",
                  marginBottom: "4px",
                }}
              >
                {stats.approved}
              </div>
              <div style={{ fontSize: "12px", color: "#666" }}>Đã duyệt</div>
            </div>

            <div
              style={{
                background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
                border: "1px solid #F59E0B",
                borderRadius: "12px",
                padding: "20px",
                textAlign: "center",
              }}
            >
              <Clock
                size={24}
                color="#F59E0B"
                style={{ marginBottom: "8px" }}
              />
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "700",
                  color: "#F59E0B",
                  marginBottom: "4px",
                }}
              >
                {stats.pending}
              </div>
              <div style={{ fontSize: "12px", color: "#666" }}>Chờ duyệt</div>
            </div>

            <div
              style={{
                background: "linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)",
                border: "1px solid #EF4444",
                borderRadius: "12px",
                padding: "20px",
                textAlign: "center",
              }}
            >
              <AlertCircle
                size={24}
                color="#EF4444"
                style={{ marginBottom: "8px" }}
              />
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "700",
                  color: "#EF4444",
                  marginBottom: "4px",
                }}
              >
                {stats.rejected}
              </div>
              <div style={{ fontSize: "12px", color: "#666" }}>Từ chối</div>
            </div>

            <div
              style={{
                background: "linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%)",
                border: "1px solid #8B5CF6",
                borderRadius: "12px",
                padding: "20px",
                textAlign: "center",
              }}
            >
              <Edit size={24} color="#8B5CF6" style={{ marginBottom: "8px" }} />
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "700",
                  color: "#8B5CF6",
                  marginBottom: "4px",
                }}
              >
                {stats.revision}
              </div>
              <div style={{ fontSize: "12px", color: "#666" }}>Cần sửa đổi</div>
            </div>
          </div>

          {/* Topics Table */}
          <div
            style={{
              background: "white",
              borderRadius: "24px",
              border: "1px solid #D9E1F2",
              padding: "20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: "14px" }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid #E5ECFB",
                      background: "#F8FAFF",
                    }}
                  >
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#1F3C88",
                      }}
                    >
                      Mã đề tài
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#1F3C88",
                      }}
                    >
                      Tên đề tài
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#1F3C88",
                        minWidth: "140px",
                      }}
                    >
                      Sinh viên
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#1F3C88",
                        minWidth: "140px",
                      }}
                    >
                      Loại đề tài
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#1F3C88",
                      }}
                    >
                      Ngày nộp
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#1F3C88",
                        minWidth: "150px",
                      }}
                    >
                      Trạng thái
                    </th>
                    <th
                      style={{
                        padding: "12px 8px",
                        textAlign: "center",
                        fontWeight: "600",
                        color: "#1F3C88",
                        width: "120px",
                      }}
                    >
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topics.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          padding: "32px",
                          textAlign: "center",
                          color: "#4A5775",
                        }}
                      >
                        Không có đề tài nào
                      </td>
                    </tr>
                  ) : (
                    topics
                      .sort((a, b) => {
                        const priorityOrder = {
                          "Chờ duyệt": 1,
                          "Cần sửa đổi": 2,
                          "Đã duyệt": 3,
                          "Từ chối": 4,
                        };

                        const aPriority =
                          priorityOrder[
                            a.status as keyof typeof priorityOrder
                          ] || 5;
                        const bPriority =
                          priorityOrder[
                            b.status as keyof typeof priorityOrder
                          ] || 5;

                        return aPriority - bPriority;
                      })
                      .map((topic) => (
                        <tr
                          key={topic.topicID}
                          style={{
                            borderBottom: "1px solid #E5ECFB",
                            cursor: "pointer",
                            transition: "background 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#F8FAFF";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "white";
                          }}
                        >
                          {/* Mã đề tài */}
                          <td
                            style={{
                              padding: "12px 16px",
                              fontWeight: "600",
                              color: "#1F3C88",
                            }}
                          >
                            {topic.topicCode}
                          </td>

                          {/* Tên đề tài */}
                          <td
                            style={{
                              padding: "12px 16px",
                              color: "#1a1a1a",
                              maxWidth: "300px",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: "500",
                                marginBottom: "4px",
                              }}
                            >
                              {topic.title}
                            </div>
                            {topic.lecturerProfile && (
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "#666",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  marginTop: "4px",
                                }}
                              >
                                <User size={12} />
                                GVHD: {topic.lecturerProfile.fullName}
                              </div>
                            )}
                          </td>

                          {/* Sinh viên */}
                          <td
                            style={{
                              padding: "12px 16px",
                              color: "#4A5775",
                              minWidth: "140px",
                            }}
                          >
                            <div style={{ fontWeight: "500" }}>
                              {topic.studentName}
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#666",
                                marginTop: "2px",
                              }}
                            >
                              {topic.studentCode}
                            </div>
                          </td>

                          {/* Loại đề tài */}
                          <td
                            style={{
                              padding: "12px 16px",
                              color: "#4A5775",
                              minWidth: "150px",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-block",
                                padding: "4px 8px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                fontWeight: "500",
                                background:
                                  topic.category === "Đề tài catalog"
                                    ? "#E0F2FE"
                                    : "#FEF3C7",
                                color:
                                  topic.category === "Đề tài catalog"
                                    ? "#0369A1"
                                    : "#92400E",
                              }}
                            >
                              {topic.category}
                            </span>
                          </td>

                          {/* Ngày nộp */}
                          <td
                            style={{
                              padding: "12px 16px",
                              color: "#4A5775",
                              fontSize: "13px",
                            }}
                          >
                            {new Date(topic.submissionDate).toLocaleDateString(
                              "vi-VN"
                            )}
                          </td>

                          {/* Trạng thái */}
                          <td
                            style={{
                              padding: "12px 16px",
                              minWidth: "140px",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px 12px",
                                borderRadius: "20px",
                                fontSize: "12px",
                                fontWeight: "600",
                                background:
                                  topic.status === "Đã duyệt"
                                    ? "#DCFCE7"
                                    : topic.status === "Từ chối"
                                    ? "#FEE2E2"
                                    : topic.status === "Cần sửa đổi"
                                    ? "#FEF3C7"
                                    : "#FEF3C7",
                                color:
                                  topic.status === "Đã duyệt"
                                    ? "#166534"
                                    : topic.status === "Từ chối"
                                    ? "#991B1B"
                                    : topic.status === "Cần sửa đổi"
                                    ? "#92400E"
                                    : "#92400E",
                              }}
                            >
                              {getStatusIcon(topic.status)}
                              {getStatusText(topic.status)}
                            </span>
                          </td>

                          {/* Hành động */}
                          <td
                            style={{
                              padding: "12px 16px",
                              textAlign: "center",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "8px",
                                flexWrap: "wrap",
                              }}
                            >
                              {/* Nút xem chi tiết */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDetailModal(topic);
                                }}
                                title="Xem chi tiết đề tài"
                                style={{
                                  padding: "8px",
                                  background: "#1F3C88",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "6px",
                                  fontSize: "14px",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "32px",
                                  height: "32px",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "#162B61";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "#1F3C88";
                                }}
                              >
                                <Eye size={16} />
                              </button>

                              {/* Nút hành động theo trạng thái */}
                              {topic.status === "Chờ duyệt" && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openConfirmationModal(topic);
                                    }}
                                    title="Duyệt đề tài"
                                    disabled={
                                      updatingStatus ===
                                      `approve-${topic.topicID}`
                                    }
                                    style={{
                                      padding: "8px",
                                      background:
                                        updatingStatus ===
                                        `approve-${topic.topicID}`
                                          ? "#9CA3AF"
                                          : "#22C55E",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "6px",
                                      cursor:
                                        updatingStatus ===
                                        `approve-${topic.topicID}`
                                          ? "not-allowed"
                                          : "pointer",
                                      transition: "all 0.2s ease",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: "32px",
                                      height: "32px",
                                    }}
                                    onMouseEnter={(e) => {
                                      if (
                                        updatingStatus !==
                                        `approve-${topic.topicID}`
                                      ) {
                                        e.currentTarget.style.background =
                                          "#16A34A";
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (
                                        updatingStatus !==
                                        `approve-${topic.topicID}`
                                      ) {
                                        e.currentTarget.style.background =
                                          "#22C55E";
                                      }
                                    }}
                                  >
                                    {updatingStatus ===
                                    `approve-${topic.topicID}` ? (
                                      <Loader2
                                        size={16}
                                        style={{
                                          animation: "spin 1s linear infinite",
                                        }}
                                      />
                                    ) : (
                                      <CheckCircle size={16} />
                                    )}
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openCommentModal(
                                        "revision",
                                        topic.topicID,
                                        topic.title
                                      );
                                    }}
                                    title="Yêu cầu sửa đổi đề tài"
                                    disabled={
                                      updatingStatus ===
                                      `revision-${topic.topicID}`
                                    }
                                    style={{
                                      padding: "8px",
                                      background:
                                        updatingStatus ===
                                        `revision-${topic.topicID}`
                                          ? "#9CA3AF"
                                          : "#F59E0B",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "6px",
                                      cursor:
                                        updatingStatus ===
                                        `revision-${topic.topicID}`
                                          ? "not-allowed"
                                          : "pointer",
                                      transition: "all 0.2s ease",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: "32px",
                                      height: "32px",
                                    }}
                                    onMouseEnter={(e) => {
                                      if (
                                        updatingStatus !==
                                        `revision-${topic.topicID}`
                                      ) {
                                        e.currentTarget.style.background =
                                          "#D97706";
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (
                                        updatingStatus !==
                                        `revision-${topic.topicID}`
                                      ) {
                                        e.currentTarget.style.background =
                                          "#F59E0B";
                                      }
                                    }}
                                  >
                                    {updatingStatus ===
                                    `revision-${topic.topicID}` ? (
                                      <Loader2
                                        size={16}
                                        style={{
                                          animation: "spin 1s linear infinite",
                                        }}
                                      />
                                    ) : (
                                      <Edit size={16} />
                                    )}
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openCommentModal(
                                        "reject",
                                        topic.topicID,
                                        topic.title
                                      );
                                    }}
                                    title="Từ chối đề tài"
                                    disabled={
                                      updatingStatus ===
                                      `reject-${topic.topicID}`
                                    }
                                    style={{
                                      padding: "8px",
                                      background:
                                        updatingStatus ===
                                        `reject-${topic.topicID}`
                                          ? "#9CA3AF"
                                          : "#EF4444",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "6px",
                                      cursor:
                                        updatingStatus ===
                                        `reject-${topic.topicID}`
                                          ? "not-allowed"
                                          : "pointer",
                                      transition: "all 0.2s ease",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: "32px",
                                      height: "32px",
                                    }}
                                    onMouseEnter={(e) => {
                                      if (
                                        updatingStatus !==
                                        `reject-${topic.topicID}`
                                      ) {
                                        e.currentTarget.style.background =
                                          "#DC2626";
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (
                                        updatingStatus !==
                                        `reject-${topic.topicID}`
                                      ) {
                                        e.currentTarget.style.background =
                                          "#EF4444";
                                      }
                                    }}
                                  >
                                    {updatingStatus ===
                                    `reject-${topic.topicID}` ? (
                                      <Loader2
                                        size={16}
                                        style={{
                                          animation: "spin 1s linear infinite",
                                        }}
                                      />
                                    ) : (
                                      <AlertCircle size={16} />
                                    )}
                                  </button>
                                </>
                              )}

                              {topic.status !== "Chờ duyệt" &&
                                topic.comments && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openViewCommentModal(
                                        topic.comments || "Không có nhận xét",
                                        topic.title
                                      );
                                    }}
                                    title="Xem nhận xét của giảng viên"
                                    style={{
                                      padding: "8px",
                                      background: "#8B5CF6",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "6px",
                                      cursor: "pointer",
                                      transition: "all 0.2s ease",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: "32px",
                                      height: "32px",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background =
                                        "#7C3AED";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background =
                                        "#8B5CF6";
                                    }}
                                  >
                                    <MessageCircle size={16} />
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px",
                marginTop: "24px",
                padding: "16px",
              }}
            >
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                title="Trang trước"
                style={{
                  padding: "8px 12px",
                  background: currentPage === 1 ? "#F3F4F6" : "#FFFFFF",
                  color: currentPage === 1 ? "#9CA3AF" : "#374151",
                  border: "1px solid #D1D5DB",
                  borderRadius: "6px",
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <ChevronLeft size={16} />
                Trước
              </button>

              <div style={{ display: "flex", gap: "4px" }}>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      title={`Đến trang ${pageNum}`}
                      style={{
                        padding: "8px 12px",
                        background:
                          currentPage === pageNum ? "#1F3C88" : "#FFFFFF",
                        color: currentPage === pageNum ? "white" : "#374151",
                        border: "1px solid #D1D5DB",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "14px",
                        minWidth: "40px",
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                title="Trang sau"
                style={{
                  padding: "8px 12px",
                  background:
                    currentPage === totalPages ? "#F3F4F6" : "#FFFFFF",
                  color: currentPage === totalPages ? "#9CA3AF" : "#374151",
                  border: "1px solid #D1D5DB",
                  borderRadius: "6px",
                  cursor:
                    currentPage === totalPages ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                Sau
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Page info */}
          <div
            style={{
              textAlign: "center",
              marginTop: "16px",
              fontSize: "14px",
              color: "#6B7280",
            }}
          >
            Hiển thị {topics.length} đề tài trên tổng số {totalCount} đề tài
            {totalPages > 1 && ` (Trang ${currentPage}/${totalPages})`}
          </div>
        </>
      )}
      {/* Comment Modal */}
      {commentModal.isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={closeCommentModal}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#1a1a1a",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {commentModal.action === "reject" ? (
                <AlertCircle size={20} color="#EF4444" />
              ) : (
                <Edit size={20} color="#8B5CF6" />
              )}
              {commentModal.action === "reject"
                ? "Từ chối đề tài"
                : "Yêu cầu sửa đổi"}
            </h3>

            <div style={{ marginBottom: "16px" }}>
              <p
                style={{
                  fontSize: "14px",
                  color: "#666",
                  marginBottom: "8px",
                }}
              >
                <strong>Đề tài:</strong> {commentModal.topicTitle}
              </p>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                {commentModal.action === "reject"
                  ? "Lý do từ chối:"
                  : "Yêu cầu sửa đổi:"}
              </label>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={
                  commentModal.action === "reject"
                    ? "Nhập lý do từ chối đề tài..."
                    : "Nhập yêu cầu sửa đổi cho sinh viên..."
                }
                style={{
                  width: "100%",
                  minHeight: "100px",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  resize: "vertical",
                  outline: "none",
                  transition: "border-color 0.2s ease",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#F59E0B";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#D1D5DB";
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={closeCommentModal}
                style={{
                  padding: "8px 16px",
                  background: "#F3F4F6",
                  color: "#374151",
                  border: "1px solid #D1D5DB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#E5E7EB";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#F3F4F6";
                }}
              >
                Hủy
              </button>
              <button
                onClick={handleCommentSubmit}
                disabled={!commentText.trim() || updatingStatus !== null}
                style={{
                  padding: "8px 16px",
                  background:
                    commentText.trim() && updatingStatus === null
                      ? commentModal.action === "reject"
                        ? "#EF4444"
                        : "#8B5CF6"
                      : "#9CA3AF",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor:
                    commentText.trim() && updatingStatus === null
                      ? "pointer"
                      : "not-allowed",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                onMouseEnter={(e) => {
                  if (commentText.trim() && updatingStatus === null) {
                    e.currentTarget.style.opacity = "0.9";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                {updatingStatus ? (
                  <>
                    <Loader2
                      size={14}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    Đang xử lý...
                  </>
                ) : commentModal.action === "reject" ? (
                  "Từ chối"
                ) : (
                  "Yêu cầu sửa đổi"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Comment Modal */}
      {viewCommentModal.isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={closeViewCommentModal}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#1F2937",
                  margin: 0,
                }}
              >
                Nhận xét của giảng viên
              </h3>
              <button
                onClick={closeViewCommentModal}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#6B7280",
                  padding: "4px",
                  borderRadius: "4px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#F3F4F6";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <strong style={{ color: "#374151" }}>Đề tài:</strong>{" "}
              <span style={{ color: "#6B7280" }}>
                {viewCommentModal.topicTitle}
              </span>
            </div>

            <div
              style={{
                background: "#F9FAFB",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "20px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#374151",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                }}
              >
                {viewCommentModal.comments}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={closeViewCommentModal}
                style={{
                  padding: "8px 16px",
                  background: "#6B7280",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#4B5563";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#6B7280";
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmationModal.isOpen && confirmationModal.topic && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={closeConfirmationModal}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "680px",
              width: "90%",
              maxHeight: "90vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: "20px",
                fontWeight: "600",
                color: "#1a1a1a",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <CheckCircle size={24} color="#22C55E" />
              Xác nhận duyệt đề tài
            </h3>

            <div style={{ marginBottom: "24px" }}>
              <div
                style={{
                  background: "#F0FDF4",
                  border: "1px solid #22C55E",
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "16px",
                }}
              >
                <h4
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#1a1a1a",
                    marginBottom: "8px",
                  }}
                >
                  {confirmationModal.topic.title}
                </h4>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#666",
                    margin: 0,
                    lineHeight: "1.5",
                  }}
                >
                  {confirmationModal.topic.description}
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      fontWeight: "600",
                      textTransform: "uppercase",
                    }}
                  >
                    Sinh viên
                  </span>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#1a1a1a",
                      margin: "4px 0",
                      fontWeight: "500",
                    }}
                  >
                    {confirmationModal.topic.studentName}
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      margin: 0,
                    }}
                  >
                    {confirmationModal.topic.studentCode}
                  </p>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      fontWeight: "600",
                      textTransform: "uppercase",
                    }}
                  >
                    Danh mục
                  </span>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#1a1a1a",
                      margin: "4px 0",
                      fontWeight: "500",
                    }}
                  >
                    {confirmationModal.topic.category}
                  </p>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      fontWeight: "600",
                      textTransform: "uppercase",
                    }}
                  >
                    Ngày nộp
                  </span>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#1a1a1a",
                      margin: "4px 0",
                      fontWeight: "500",
                    }}
                  >
                    {new Date(
                      confirmationModal.topic.submissionDate
                    ).toLocaleDateString("vi-VN")}
                  </p>
                </div>
              </div>

              {confirmationModal.topic.studentProfile && (
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    padding: "16px",
                    marginTop: "16px",
                  }}
                >
                  <h5
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#002855",
                      marginBottom: "12px",
                    }}
                  >
                    Thông tin sinh viên
                  </h5>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#666",
                          fontWeight: "600",
                        }}
                      >
                        Email:
                      </span>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#1a1a1a",
                          margin: "2px 0",
                        }}
                      >
                        {confirmationModal.topic.studentProfile.studentEmail}
                      </p>
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#666",
                          fontWeight: "600",
                        }}
                      >
                        GPA:
                      </span>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#1a1a1a",
                          margin: "2px 0",
                        }}
                      >
                        {confirmationModal.topic.studentProfile.gpa}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                background: "#FEF3C7",
                border: "1px solid #FCD34D",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <AlertCircle size={16} color="#92400E" />
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#92400E",
                  }}
                >
                  Lưu ý quan trọng
                </span>
              </div>
              <p
                style={{
                  fontSize: "13px",
                  color: "#92400E",
                  margin: 0,
                  lineHeight: "1.5",
                }}
              >
                Khi duyệt đề tài, bạn sẽ trở thành giảng viên hướng dẫn chính
                của sinh viên này và tiến độ luận văn sẽ được cập nhật tự động.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={closeConfirmationModal}
                style={{
                  padding: "10px 20px",
                  background: "#F3F4F6",
                  color: "#374151",
                  border: "1px solid #D1D5DB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#E5E7EB";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#F3F4F6";
                }}
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmApprove}
                disabled={updatingStatus !== null}
                style={{
                  padding: "10px 20px",
                  background: updatingStatus === null ? "#22C55E" : "#9CA3AF",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: updatingStatus === null ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                onMouseEnter={(e) => {
                  if (updatingStatus === null) {
                    e.currentTarget.style.background = "#16A34A";
                  }
                }}
                onMouseLeave={(e) => {
                  if (updatingStatus === null) {
                    e.currentTarget.style.background = "#22C55E";
                  }
                }}
              >
                {updatingStatus ? (
                  <>
                    <Loader2
                      size={16}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Xác nhận duyệt
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successModal.isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={closeSuccessModal}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "400px",
              width: "90%",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#F0FDF4",
                border: "4px solid #22C55E",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <CheckCircle size={32} color="#22C55E" />
            </div>

            <h3
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#1a1a1a",
                marginBottom: "8px",
              }}
            >
              {successModal.action === "approve" && "Duyệt đề tài thành công"}
              {successModal.action === "reject" && "Từ chối đề tài thành công"}
              {successModal.action === "revision" &&
                "Yêu cầu sửa đổi thành công"}
            </h3>

            <p
              style={{
                fontSize: "14px",
                color: "#666",
                marginBottom: "24px",
                lineHeight: "1.5",
              }}
            >
              Đề tài <strong>"{successModal.topicTitle}"</strong> đã được{" "}
              {successModal.action === "approve" && "duyệt"}
              {successModal.action === "reject" && "từ chối"}
              {successModal.action === "revision" && "yêu cầu sửa đổi"} thành
              công.
            </p>

            <button
              onClick={closeSuccessModal}
              style={{
                padding: "10px 24px",
                background: "#22C55E",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#16A34A";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#22C55E";
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal.isOpen && detailModal.topic && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={closeDetailModal}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "12px",
              padding: "0",
              maxWidth: "900px",
              width: "100%",
              maxHeight: "85vh",
              overflow: "hidden",
              boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                background: "#FFF8F0",
                borderBottom: "1px solid #F59E0B",
                borderRadius: "12px 12px 0 0",
                padding: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "8px",
                    background: "#F59E0B",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <BookOpen size={20} color="white" />
                </div>
                <div>
                  <h2
                    style={{
                      fontSize: "20px",
                      fontWeight: "600",
                      color: "#92400E",
                      margin: 0,
                    }}
                  >
                    Chi tiết đề tài
                  </h2>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#A16207",
                      margin: "2px 0 0 0",
                      fontWeight: "500",
                    }}
                  >
                    {detailModal.topic.topicCode}
                  </p>
                </div>
              </div>
              <button
                onClick={closeDetailModal}
                style={{
                  background: "#F3F4F6",
                  border: "1px solid #D1D5DB",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#6B7280",
                  padding: "8px",
                  borderRadius: "6px",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#E5E7EB";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#F3F4F6";
                }}
              >
                ×
              </button>
            </div>

            {/* Scrollable Content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px",
              }}
            >
              {/* Student and Lecturer Information - 2 Column Layout */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "24px",
                  marginBottom: "24px",
                }}
              >
                {/* Student Information - Left Column */}
                {detailModal.topic.studentProfile && (
                  <div
                    style={{
                      background: "#FEF3C7",
                      borderRadius: "12px",
                      padding: "24px",
                      border: "1px solid #F59E0B",
                      boxShadow: "0 2px 8px rgba(245, 158, 11, 0.1)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        marginBottom: "20px",
                      }}
                    >
                      <img
                        src={
                          getAvatarUrl(
                            detailModal.topic.studentProfile.studentImage
                          ) || "https://via.placeholder.com/80x80?text=No+Image"
                        }
                        alt="Student Avatar"
                        style={{
                          width: "80px",
                          height: "80px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "3px solid #F59E0B",
                          boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
                        }}
                      />
                      <div>
                        <h3
                          style={{
                            fontSize: "20px",
                            fontWeight: "600",
                            color: "#92400e",
                            margin: "0 0 4px 0",
                          }}
                        >
                          {detailModal.topic.studentName}
                        </h3>
                        <p
                          style={{
                            fontSize: "14px",
                            color: "#D97706",
                            margin: 0,
                            fontWeight: "500",
                          }}
                        >
                          Sinh viên
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: "16px" }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "16px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#92400e",
                              fontWeight: "500",
                              marginBottom: "4px",
                            }}
                          >
                            Mã sinh viên
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#92400e",
                              fontWeight: "600",
                            }}
                          >
                            {detailModal.topic.studentCode}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#92400e",
                              fontWeight: "500",
                              marginBottom: "4px",
                            }}
                          >
                            Email
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#92400e",
                              fontWeight: "600",
                            }}
                          >
                            {detailModal.topic.studentProfile.studentEmail}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: "16px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#92400e",
                              fontWeight: "500",
                              marginBottom: "4px",
                            }}
                          >
                            Số điện thoại
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#92400e",
                              fontWeight: "600",
                            }}
                          >
                            {detailModal.topic.studentProfile.phoneNumber}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#92400e",
                              fontWeight: "500",
                              marginBottom: "4px",
                            }}
                          >
                            GPA
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#92400e",
                              fontWeight: "600",
                            }}
                          >
                            {detailModal.topic.studentProfile.gpa}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#92400e",
                              fontWeight: "500",
                              marginBottom: "4px",
                            }}
                          >
                            Học lực
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#92400e",
                              fontWeight: "600",
                            }}
                          >
                            {detailModal.topic.studentProfile.academicStanding}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lecturer Information - Right Column */}
                {detailModal.topic.lecturerProfile && (
                  <div
                    style={{
                      background: "#F0F9FF",
                      borderRadius: "12px",
                      padding: "24px",
                      border: "1px solid #0EA5E9",
                      boxShadow: "0 2px 8px rgba(14, 165, 233, 0.1)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        marginBottom: "20px",
                      }}
                    >
                      <img
                        src={
                          getAvatarUrl(
                            detailModal.topic.lecturerProfile.profileImage
                          ) || "https://via.placeholder.com/80x80?text=No+Image"
                        }
                        alt="Lecturer Avatar"
                        style={{
                          width: "80px",
                          height: "80px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "3px solid #0EA5E9",
                          boxShadow: "0 2px 8px rgba(14, 165, 233, 0.3)",
                        }}
                      />
                      <div>
                        <h3
                          style={{
                            fontSize: "20px",
                            fontWeight: "600",
                            color: "#0C4A6E",
                            margin: "0 0 4px 0",
                          }}
                        >
                          {detailModal.topic.lecturerProfile.fullName}
                        </h3>
                        <p
                          style={{
                            fontSize: "14px",
                            color: "#0369A1",
                            margin: 0,
                            fontWeight: "500",
                          }}
                        >
                          Giảng viên hướng dẫn
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: "16px" }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "16px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#64748B",
                              fontWeight: "500",
                              marginBottom: "4px",
                            }}
                          >
                            Mã giảng viên
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#0C4A6E",
                              fontWeight: "600",
                            }}
                          >
                            {detailModal.topic.supervisorLecturerCode}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#64748B",
                              fontWeight: "500",
                              marginBottom: "4px",
                            }}
                          >
                            Email
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#0C4A6E",
                              fontWeight: "600",
                            }}
                          >
                            {detailModal.topic.lecturerProfile.email}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: "16px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#64748B",
                              fontWeight: "500",
                              marginBottom: "4px",
                            }}
                          >
                            Số điện thoại
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#0C4A6E",
                              fontWeight: "600",
                            }}
                          >
                            {detailModal.topic.lecturerProfile.phoneNumber ||
                              "Chưa cập nhật"}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#64748B",
                              fontWeight: "500",
                              marginBottom: "4px",
                            }}
                          >
                            Khoa
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#0C4A6E",
                              fontWeight: "600",
                            }}
                          >
                            {detailModal.topic.lecturerProfile.departmentCode ||
                              "Chưa cập nhật"}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#64748B",
                              fontWeight: "500",
                              marginBottom: "4px",
                            }}
                          >
                            Học vị
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#0C4A6E",
                              fontWeight: "600",
                            }}
                          >
                            {detailModal.topic.lecturerProfile.degree ||
                              "Chưa cập nhật"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Topic Information - Full Width Below */}
              <div
                style={{
                  background: "#F8FAFC",
                  borderRadius: "12px",
                  padding: "24px",
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "4px",
                    background:
                      "linear-gradient(90deg, #3B82F6, #6366F1, #8B5CF6)",
                    borderRadius: "12px 12px 0 0",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "20px",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #3B82F6, #6366F1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
                    }}
                  >
                    <FileText size={20} color="white" />
                  </div>
                  <h3
                    style={{
                      fontSize: "20px",
                      fontWeight: "600",
                      color: "#1e293b",
                      margin: 0,
                    }}
                  >
                    Thông tin đề tài
                  </h3>
                </div>

                <div style={{ display: "grid", gap: "20px" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "20px",
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
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          background: "rgba(59, 130, 246, 0.1)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <BookOpen size={18} color="#3B82F6" />
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#64748b",
                            fontWeight: "500",
                            marginBottom: "2px",
                          }}
                        >
                          Mã đề tài
                        </div>
                        <div
                          style={{
                            fontSize: "16px",
                            color: "#1e293b",
                            fontWeight: "600",
                          }}
                        >
                          {detailModal.topic.topicCode}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          background: "rgba(168, 85, 247, 0.1)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <TagIcon size={18} color="#A855F7" />
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#64748b",
                            fontWeight: "500",
                            marginBottom: "2px",
                          }}
                        >
                          Chuyên ngành
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#1e293b",
                            fontWeight: "500",
                          }}
                        >
                          {topicTags.length > 0
                            ? topicTags.map((tag) => tag.tagName).join(", ")
                            : "Chưa có thông tin"}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          background: "rgba(34, 197, 94, 0.1)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <CheckCircle size={18} color="#22C55E" />
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#64748b",
                            fontWeight: "500",
                            marginBottom: "2px",
                          }}
                        >
                          Trạng thái
                        </div>
                        <div
                          style={{
                            padding: "6px 16px",
                            borderRadius: "20px",
                            fontSize: "14px",
                            fontWeight: "600",
                            background:
                              getStatusColor(detailModal.topic.status) + "20",
                            color: getStatusColor(detailModal.topic.status),
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            border: `1px solid ${getStatusColor(
                              detailModal.topic.status
                            )}30`,
                          }}
                        >
                          {getStatusIcon(detailModal.topic.status)}
                          {detailModal.topic.status}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        fontWeight: "500",
                        marginBottom: "6px",
                      }}
                    >
                      Tên đề tài
                    </div>
                    <div
                      style={{
                        fontSize: "18px",
                        color: "#1e293b",
                        fontWeight: "600",
                        lineHeight: "1.4",
                      }}
                    >
                      {detailModal.topic.title}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        fontWeight: "500",
                        marginBottom: "6px",
                      }}
                    >
                      Mô tả
                    </div>
                    <div
                      style={{
                        fontSize: "15px",
                        color: "#475569",
                        lineHeight: "1.6",
                      }}
                    >
                      {detailModal.topic.description}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "20px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          fontWeight: "500",
                          marginBottom: "4px",
                        }}
                      >
                        Danh mục
                      </div>
                      <div
                        style={{
                          fontSize: "15px",
                          color: "#1e293b",
                          fontWeight: "500",
                        }}
                      >
                        {detailModal.topic.category}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          fontWeight: "500",
                          marginBottom: "4px",
                        }}
                      >
                        Ngày đăng ký
                      </div>
                      <div
                        style={{
                          fontSize: "15px",
                          color: "#1e293b",
                          fontWeight: "500",
                        }}
                      >
                        {new Date(
                          detailModal.topic.submissionDate
                        ).toLocaleDateString("vi-VN")}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          fontWeight: "500",
                          marginBottom: "4px",
                        }}
                      >
                        Ngày tạo
                      </div>
                      <div
                        style={{
                          fontSize: "15px",
                          color: "#1e293b",
                          fontWeight: "500",
                        }}
                      >
                        {new Date(
                          detailModal.topic.submissionDate
                        ).toLocaleDateString("vi-VN")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comments */}
              {detailModal.topic.comments && (
                <div
                  style={{
                    background: "#FEF3C7",
                    borderRadius: "8px",
                    padding: "16px",
                    border: "1px solid #F59E0B",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#92400E",
                      marginBottom: "8px",
                    }}
                  >
                    Nhận xét của giảng viên
                  </h3>
                  <p style={{ color: "#92400E", margin: 0 }}>
                    {detailModal.topic.comments}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerTopicReview;
