import React, { useState, useEffect } from "react";
import {
  Users,
  User,
  Mail,
  Phone,
  Calendar,
  BookOpen,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit,
  LayoutGrid,
  List,
  Search,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { fetchData, getAvatarUrl } from "../../api/fetchData";
import type { Topic } from "../../types/topic";
import type { StudentProfile } from "../../types/studentProfile";
import type { ProgressMilestone } from "../../types/progressMilestone";
import { useAuth } from "../../hooks/useAuth";

interface Student {
  studentCode: string;
  studentName: string;
  email: string;
  phone: string;
  topicTitle: string;
  topicCode: string;
  registrationDate: string;
  status: "approved" | "pending" | "rejected" | "revision";
  progress: number;
  lastActivity: string;
  topic: Topic;
  studentProfile?: StudentProfile;
  milestones?: ProgressMilestone[];
}

const LecturerStudents: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    student?: Student;
  }>({ isOpen: false });
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "progress" | "date">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const openDetailModal = (student: Student) => {
    setDetailModal({ isOpen: true, student });
  };

  const closeDetailModal = () => {
    setDetailModal({ isOpen: false });
  };

  const getCurrentMilestone = (milestones: ProgressMilestone[]) => {
    if (milestones.length === 0) return null;

    // Sort milestones by ordinal
    const sortedMilestones = milestones.sort(
      (a, b) => (a.ordinal || 0) - (b.ordinal || 0)
    );

    // Find the first milestone that is not completed
    const currentMilestone = sortedMilestones.find(
      (m) => m.state !== "completed"
    );
    return currentMilestone || sortedMilestones[sortedMilestones.length - 1];
  };

  // Map API status to display status
  const mapApiStatusToDisplay = (apiStatus: string): Student["status"] => {
    const status = apiStatus.toLowerCase();
    switch (status) {
      case "đã duyệt":
        return "approved";
      case "đang chờ":
      case "chờ duyệt":
        return "pending";
      case "từ chối":
        return "rejected";
      case "cần sửa đổi":
        return "revision";
      default:
        return "pending";
    }
  };

  // Calculate progress based on milestones
  const calculateProgress = (milestones: ProgressMilestone[]): number => {
    if (milestones.length === 0) return 0;

    const milestoneOrder = [
      "MS_REG",
      "MS_PROG1",
      "MS_PROG2",
      "MS_FULL",
      "MS_DEF",
    ];
    const completedMilestones = milestones.filter(
      (m) =>
        m.state.toLowerCase().includes("hoàn thành") ||
        m.completedAt1 ||
        m.completedAt2 ||
        m.completedAt3 ||
        m.completedAt4 ||
        m.completedAt5
    ).length;

    return Math.round((completedMilestones / milestoneOrder.length) * 100);
  };

  useEffect(() => {
    const fetchStudentsData = async () => {
      if (!user?.userCode) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch topics supervised by lecturer
        const topicsResponse: { data: Topic[] } = await fetchData(
          `/Topics/get-list?SupervisorUserCode=${user.userCode}`
        );
        const topics: Topic[] = topicsResponse.data || [];

        // Process each topic to get student data and progress
        const studentsData: Student[] = await Promise.all(
          topics.map(async (topic) => {
            try {
              // Fetch student profile
              const studentResponse: { data: StudentProfile[] } =
                await fetchData(
                  `/StudentProfiles/get-list?StudentCode=${topic.proposerStudentCode}`
                );
              const studentProfile: StudentProfile = studentResponse.data?.[0];

              // Fetch progress milestones
              const progressResponse: { data: ProgressMilestone[] } =
                await fetchData(
                  `/ProgressMilestones/get-list?TopicID=${topic.topicID}`
                );
              const milestones: ProgressMilestone[] =
                progressResponse.data || [];
              const progress = calculateProgress(milestones);

              // Get last activity from milestones
              const lastActivity =
                milestones.length > 0
                  ? milestones.sort(
                      (a, b) =>
                        new Date(b.lastUpdated).getTime() -
                        new Date(a.lastUpdated).getTime()
                    )[0].lastUpdated
                  : topic.lastUpdated;

              return {
                studentCode: topic.proposerStudentCode,
                studentName:
                  studentProfile?.fullName || topic.proposerStudentCode,
                email: studentProfile?.studentEmail || "",
                phone: studentProfile?.phoneNumber || "",
                topicTitle: topic.title,
                topicCode: topic.topicCode,
                registrationDate: topic.createdAt,
                status: mapApiStatusToDisplay(topic.status),
                progress,
                lastActivity,
                topic,
                studentProfile,
                milestones,
              };
            } catch (err) {
              console.error(
                `Error fetching data for topic ${topic.topicCode}:`,
                err
              );
              // Return basic info if API calls fail
              return {
                studentCode: topic.proposerStudentCode,
                studentName: topic.proposerStudentCode,
                email: "",
                phone: "",
                topicTitle: topic.title,
                topicCode: topic.topicCode,
                registrationDate: topic.createdAt,
                status: mapApiStatusToDisplay(topic.status),
                progress: 0,
                lastActivity: topic.lastUpdated,
                topic,
              };
            }
          })
        );

        setStudents(studentsData);
      } catch (err) {
        console.error("Failed to fetch students data:", err);
        setError("Không thể tải danh sách sinh viên. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    };

    fetchStudentsData();
  }, [user?.userCode]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle size={16} color="#22C55E" />;
      case "pending":
        return <Clock size={16} color="#F59E0B" />;
      case "rejected":
        return <AlertCircle size={16} color="#EF4444" />;
      case "revision":
        return <Edit size={16} color="#F59E0B" />;
      default:
        return <Clock size={16} color="#6B7280" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "approved":
        return "Đã duyệt";
      case "pending":
        return "Chờ duyệt";
      case "rejected":
        return "Từ chối";
      case "revision":
        return "Cần sửa đổi";
      default:
        return "Không xác định";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "#22C55E";
      case "pending":
        return "#F59E0B";
      case "rejected":
        return "#EF4444";
      case "revision":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  // Filter and sort students
  const filteredAndSortedStudents = students
    .filter((student) => {
      const matchesSearch =
        student.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.topicTitle.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || student.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "name":
          comparison = a.studentName.localeCompare(b.studentName);
          break;
        case "progress":
          comparison = a.progress - b.progress;
          break;
        case "date":
          comparison =
            new Date(a.registrationDate).getTime() -
            new Date(b.registrationDate).getTime();
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

  const toggleSort = (field: "name" | "progress" | "date") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
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
          <Users size={32} color="#F37021" />
          Sinh viên hướng dẫn
        </h1>
        <p style={{ fontSize: "14px", color: "#666" }}>
          Quản lý và theo dõi tiến độ của các sinh viên đang hướng dẫn
        </p>
      </div>

      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "24px",
            color: "#DC2626",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={20} />
            <span style={{ fontWeight: "600" }}>Lỗi tải dữ liệu</span>
          </div>
          <p style={{ margin: "8px 0 0 28px" }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #F3F4F6",
              borderTop: "4px solid #F37021",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              marginBottom: "16px",
            }}
          />
          <p style={{ color: "#666", fontSize: "16px" }}>
            Đang tải danh sách sinh viên...
          </p>
        </div>
      ) : (
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
              <div style={{ flex: "1 1 300px", position: "relative" }}>
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
                  onChange={(e) => setSearchTerm(e.target.value)}
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

              {/* Filter and View Toggle */}
              <div
                style={{ display: "flex", gap: "12px", alignItems: "center" }}
              >
                {/* Status Filter */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <Filter size={16} color="#6B7280" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #D1D5DB",
                      borderRadius: "8px",
                      fontSize: "14px",
                      cursor: "pointer",
                      outline: "none",
                      background: "white",
                    }}
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="approved">Đã duyệt</option>
                    <option value="pending">Chờ duyệt</option>
                    <option value="revision">Cần sửa đổi</option>
                    <option value="rejected">Từ chối</option>
                  </select>
                </div>

                {/* View Toggle */}
                <div
                  style={{
                    display: "flex",
                    background: "#F3F4F6",
                    borderRadius: "8px",
                    padding: "4px",
                  }}
                >
                  <button
                    onClick={() => setViewMode("card")}
                    style={{
                      padding: "6px 12px",
                      background: viewMode === "card" ? "white" : "transparent",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      fontWeight: "500",
                      color: viewMode === "card" ? "#F37021" : "#6B7280",
                      transition: "all 0.2s ease",
                      boxShadow:
                        viewMode === "card"
                          ? "0 1px 3px rgba(0,0,0,0.1)"
                          : "none",
                    }}
                  >
                    <LayoutGrid size={16} />
                    Card
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    style={{
                      padding: "6px 12px",
                      background:
                        viewMode === "table" ? "white" : "transparent",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      fontWeight: "500",
                      color: viewMode === "table" ? "#F37021" : "#6B7280",
                      transition: "all 0.2s ease",
                      boxShadow:
                        viewMode === "table"
                          ? "0 1px 3px rgba(0,0,0,0.1)"
                          : "none",
                    }}
                  >
                    <List size={16} />
                    Table
                  </button>
                </div>
              </div>
            </div>
          </div>

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
                background: "linear-gradient(135deg, #FFF5F0 0%, #FFE8DC 100%)",
                border: "1px solid #F37021",
                borderRadius: "12px",
                padding: "20px",
                textAlign: "center",
              }}
            >
              <Users
                size={24}
                color="#F37021"
                style={{ marginBottom: "8px" }}
              />
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "700",
                  color: "#F37021",
                  marginBottom: "4px",
                }}
              >
                {students.length}
              </div>
              <div style={{ fontSize: "12px", color: "#666" }}>
                Tổng sinh viên
              </div>
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
                {students.filter((s) => s.status === "approved").length}
              </div>
              <div style={{ fontSize: "12px", color: "#666" }}>
                Đã duyệt đề tài
              </div>
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
                {students.filter((s) => s.status === "pending").length}
              </div>
              <div style={{ fontSize: "12px", color: "#666" }}>Chờ duyệt</div>
            </div>

            <div
              style={{
                background: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
                border: "1px solid #F59E0B",
                borderRadius: "12px",
                padding: "20px",
                textAlign: "center",
              }}
            >
              <Edit size={24} color="#F59E0B" style={{ marginBottom: "8px" }} />
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "700",
                  color: "#F59E0B",
                  marginBottom: "4px",
                }}
              >
                {students.filter((s) => s.status === "revision").length}
              </div>
              <div style={{ fontSize: "12px", color: "#666" }}>Cần sửa đổi</div>
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
                {students.filter((s) => s.status === "rejected").length}
              </div>
              <div style={{ fontSize: "12px", color: "#666" }}>Từ chối</div>
            </div>
          </div>

          {/* Students List */}
          {viewMode === "card" ? (
            <div style={{ display: "grid", gap: "16px" }}>
              {filteredAndSortedStudents.map((student) => (
                <div
                  key={student.studentCode}
                  style={{
                    background: "white",
                    border: "1px solid #E5E7EB",
                    borderRadius: "12px",
                    padding: "24px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 24px rgba(0,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 2px 8px rgba(0,0,0,0.05)";
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: "20px",
                      alignItems: "start",
                    }}
                  >
                    {/* Student Avatar */}
                    <div
                      style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "50%",
                        background:
                          "linear-gradient(135deg, #F37021 0%, #FF8838 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: "20px",
                        fontWeight: "700",
                        boxShadow: "0 4px 12px rgba(243, 112, 33, 0.3)",
                        overflow: "hidden",
                      }}
                    >
                      {student.studentProfile?.studentImage ? (
                        <img
                          src={getAvatarUrl(
                            student.studentProfile.studentImage
                          )}
                          alt={student.studentName}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: "50%",
                          }}
                          onError={(e) => {
                            // Fallback to initial if image fails to load
                            e.currentTarget.style.display = "none";
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              parent.innerHTML = student.studentName.charAt(0);
                              parent.style.fontSize = "20px";
                              parent.style.fontWeight = "700";
                            }
                          }}
                        />
                      ) : (
                        student.studentName.charAt(0)
                      )}
                    </div>

                    {/* Student Info */}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          marginBottom: "12px",
                        }}
                      >
                        <h3
                          style={{
                            fontSize: "18px",
                            fontWeight: "600",
                            color: "#1a1a1a",
                          }}
                        >
                          {student.studentName}
                        </h3>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 8px",
                            background: getStatusColor(student.status) + "20",
                            color: getStatusColor(student.status),
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        >
                          {getStatusIcon(student.status)}
                          {getStatusText(student.status)}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(250px, 1fr))",
                          gap: "16px",
                          marginBottom: "16px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <User size={14} color="#666" />
                          <span style={{ fontSize: "14px", color: "#666" }}>
                            Mã SV: <strong>{student.studentCode}</strong>
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <Mail size={14} color="#666" />
                          <span style={{ fontSize: "14px", color: "#666" }}>
                            {student.email}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <Phone size={14} color="#666" />
                          <span style={{ fontSize: "14px", color: "#666" }}>
                            {student.phone}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <Calendar size={14} color="#666" />
                          <span style={{ fontSize: "14px", color: "#666" }}>
                            Đăng ký:{" "}
                            {new Date(
                              student.registrationDate
                            ).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                      </div>

                      {/* Topic Info */}
                      <div
                        style={{
                          background: "#F9FAFB",
                          borderRadius: "8px",
                          padding: "16px",
                          marginBottom: "16px",
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
                          <BookOpen size={16} color="#F37021" />
                          <span
                            style={{
                              fontSize: "14px",
                              fontWeight: "600",
                              color: "#1a1a1a",
                            }}
                          >
                            Đề tài: {student.topicTitle}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            margin: 0,
                          }}
                        >
                          Mã đề tài: {student.topicCode}
                        </p>
                      </div>

                      {/* Progress */}
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "8px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#666",
                              textTransform: "uppercase",
                            }}
                          >
                            Tiến độ
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#1a1a1a",
                            }}
                          >
                            {student.progress}%
                          </span>
                        </div>
                        <div
                          style={{
                            width: "100%",
                            height: "6px",
                            background: "#E5E7EB",
                            borderRadius: "3px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${student.progress}%`,
                              height: "100%",
                              background:
                                "linear-gradient(90deg, #F37021 0%, #FF8838 100%)",
                              borderRadius: "3px",
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
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
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#E55A1B";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#F37021";
                        }}
                        onClick={() => openDetailModal(student)}
                      >
                        Xem chi tiết
                      </button>
                      <button
                        style={{
                          padding: "8px 16px",
                          background: "white",
                          color: "#F37021",
                          border: "1px solid #F37021",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#FFF5F0";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "white";
                        }}
                      >
                        Nhắn tin
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Table View
            <div
              style={{
                background: "white",
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                border: "1px solid #E5E7EB",
                overflow: "hidden",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr
                      style={{
                        background: "#F9FAFB",
                        borderBottom: "2px solid #E5E7EB",
                      }}
                    >
                      <th
                        style={{
                          padding: "16px",
                          textAlign: "left",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#374151",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                        onClick={() => toggleSort("name")}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          Sinh viên
                          <ArrowUpDown size={14} />
                        </div>
                      </th>
                      <th
                        style={{
                          padding: "16px",
                          textAlign: "left",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#374151",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Liên hệ
                      </th>
                      <th
                        style={{
                          padding: "16px",
                          textAlign: "left",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#374151",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Đề tài
                      </th>
                      <th
                        style={{
                          padding: "16px",
                          textAlign: "center",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#374151",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Trạng thái
                      </th>
                      <th
                        style={{
                          padding: "16px",
                          textAlign: "center",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#374151",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          cursor: "pointer",
                          userSelect: "none",
                          whiteSpace: "nowrap",
                        }}
                        onClick={() => toggleSort("progress")}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            justifyContent: "center",
                          }}
                        >
                          Tiến độ
                          <ArrowUpDown size={14} />
                        </div>
                      </th>
                      <th
                        style={{
                          padding: "16px",
                          textAlign: "center",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#374151",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          cursor: "pointer",
                          userSelect: "none",
                          whiteSpace: "nowrap",
                        }}
                        onClick={() => toggleSort("date")}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            justifyContent: "center",
                          }}
                        >
                          Ngày đăng ký
                          <ArrowUpDown size={14} />
                        </div>
                      </th>
                      <th
                        style={{
                          padding: "16px",
                          textAlign: "center",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#374151",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedStudents.map((student, index) => (
                      <tr
                        key={student.studentCode}
                        style={{
                          borderBottom: "1px solid #E5E7EB",
                          background: index % 2 === 0 ? "white" : "#F9FAFB",
                          transition: "background 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#FFF5F0";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            index % 2 === 0 ? "white" : "#F9FAFB";
                        }}
                      >
                        {/* Student Info */}
                        <td style={{ padding: "16px" }}>
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
                                borderRadius: "50%",
                                background:
                                  "linear-gradient(135deg, #F37021 0%, #FF8838 100%)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                                fontSize: "14px",
                                fontWeight: "700",
                                flexShrink: 0,
                                overflow: "hidden",
                              }}
                            >
                              {student.studentProfile?.studentImage ? (
                                <img
                                  src={getAvatarUrl(
                                    student.studentProfile.studentImage
                                  )}
                                  alt={student.studentName}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    borderRadius: "50%",
                                  }}
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                    const parent =
                                      e.currentTarget.parentElement;
                                    if (parent) {
                                      parent.innerHTML =
                                        student.studentName.charAt(0);
                                      parent.style.fontSize = "14px";
                                      parent.style.fontWeight = "700";
                                    }
                                  }}
                                />
                              ) : (
                                student.studentName.charAt(0)
                              )}
                            </div>
                            <div>
                              <div
                                style={{
                                  fontSize: "14px",
                                  fontWeight: "600",
                                  color: "#1F2937",
                                }}
                              >
                                {student.studentName}
                              </div>
                              <div
                                style={{ fontSize: "12px", color: "#6B7280" }}
                              >
                                {student.studentCode}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td style={{ padding: "16px" }}>
                          <div style={{ fontSize: "13px", color: "#4B5563" }}>
                            <div style={{ marginBottom: "4px" }}>
                              {student.email}
                            </div>
                            <div style={{ color: "#9CA3AF" }}>
                              {student.phone}
                            </div>
                          </div>
                        </td>

                        {/* Topic */}
                        <td style={{ padding: "16px", maxWidth: "300px" }}>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: "500",
                              color: "#1F2937",
                              marginBottom: "4px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {student.topicTitle}
                          </div>
                          <div style={{ fontSize: "11px", color: "#9CA3AF" }}>
                            {student.topicCode}
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: "16px", textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "6px 12px",
                              background: getStatusColor(student.status) + "20",
                              color: getStatusColor(student.status),
                              borderRadius: "20px",
                              fontSize: "12px",
                              fontWeight: "600",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {getStatusIcon(student.status)}
                            {getStatusText(student.status)}
                          </span>
                        </td>

                        {/* Progress */}
                        <td style={{ padding: "16px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                            }}
                          >
                            <div
                              style={{
                                flex: 1,
                                height: "6px",
                                background: "#E5E7EB",
                                borderRadius: "3px",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${student.progress}%`,
                                  height: "100%",
                                  background:
                                    "linear-gradient(90deg, #F37021 0%, #FF8838 100%)",
                                  borderRadius: "3px",
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: "600",
                                color: "#374151",
                                minWidth: "35px",
                              }}
                            >
                              {student.progress}%
                            </span>
                          </div>
                        </td>

                        {/* Date */}
                        <td style={{ padding: "16px", textAlign: "center" }}>
                          <div style={{ fontSize: "13px", color: "#4B5563" }}>
                            {new Date(
                              student.registrationDate
                            ).toLocaleDateString("vi-VN")}
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "16px", textAlign: "center" }}>
                          <button
                            onClick={() => openDetailModal(student)}
                            style={{
                              padding: "6px 12px",
                              background: "#F37021",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              whiteSpace: "nowrap",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#E55A1B";
                              e.currentTarget.style.transform =
                                "translateY(-1px)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#F37021";
                              e.currentTarget.style.transform = "translateY(0)";
                            }}
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {detailModal.isOpen && detailModal.student && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
            animation: "modalFadeIn 0.3s ease-out",
          }}
          onClick={closeDetailModal}
        >
          <style>{`
            @keyframes modalFadeIn {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
            }
            @keyframes slideInUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .modal-content {
              animation: slideInUp 0.4s ease-out;
            }
            .smooth-scroll {
              scroll-behavior: smooth;
            }
            .progress-ring {
              transform: rotate(-90deg);
            }
            .progress-ring circle {
              transition: stroke-dashoffset 0.5s ease;
            }
          `}</style>
          <div
            className="modal-content smooth-scroll"
            style={{
              background: "white",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "1100px",
              maxHeight: "90vh",
              overflow: "hidden",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.25)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeDetailModal}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                background: "rgba(0, 0, 0, 0.1)",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#666",
                fontSize: "20px",
                fontWeight: "300",
                transition: "all 0.2s ease",
                zIndex: 10,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(0, 0, 0, 0.2)";
                e.currentTarget.style.transform = "scale(1.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(0, 0, 0, 0.1)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              ×
            </button>

            {/* Header Section */}
            <div
              style={{
                background: "linear-gradient(135deg, #f37021 0%, #1e3a8a 100%)",
                padding: "40px 32px",
                color: "white",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "-50%",
                  right: "-20%",
                  width: "200px",
                  height: "200px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "50%",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: "-30%",
                  left: "-10%",
                  width: "150px",
                  height: "150px",
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: "50%",
                }}
              />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "24px",
                  position: "relative",
                  zIndex: 2,
                }}
              >
                {/* Student Avatar */}
                <div
                  style={{
                    width: "120px",
                    height: "120px",
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.2)",
                    backdropFilter: "blur(10px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "42px",
                    fontWeight: "700",
                    border: "3px solid rgba(255, 255, 255, 0.3)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
                    overflow: "hidden",
                  }}
                >
                  {detailModal.student.studentProfile?.studentImage ? (
                    <img
                      src={getAvatarUrl(
                        detailModal.student.studentProfile.studentImage
                      )}
                      alt={detailModal.student.studentName}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "50%",
                      }}
                      onError={(e) => {
                        // Fallback to initial if image fails to load
                        e.currentTarget.style.display = "none";
                        const parent = e.currentTarget.parentElement;
                        if (parent && detailModal.student) {
                          parent.innerHTML =
                            detailModal.student.studentName.charAt(0);
                          parent.style.fontSize = "42px";
                          parent.style.fontWeight = "700";
                        }
                      }}
                    />
                  ) : (
                    detailModal.student.studentName.charAt(0)
                  )}
                </div>

                {/* Student Info */}
                <div style={{ flex: 1 }}>
                  <h1
                    style={{
                      fontSize: "28px",
                      fontWeight: "700",
                      margin: "0 0 8px 0",
                      color: "white",
                    }}
                  >
                    {detailModal.student.studentName}
                  </h1>
                  <p
                    style={{
                      fontSize: "16px",
                      margin: "0 0 12px 0",
                      opacity: 0.9,
                    }}
                  >
                    Mã sinh viên: {detailModal.student.studentCode}
                  </p>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 16px",
                      background:
                        getStatusColor(detailModal.student.status) + "30",
                      borderRadius: "20px",
                      border: `1px solid ${getStatusColor(
                        detailModal.student.status
                      )}50`,
                    }}
                  >
                    {getStatusIcon(detailModal.student.status)}
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "white",
                      }}
                    >
                      {getStatusText(detailModal.student.status)}
                    </span>
                  </div>
                </div>

                {/* Progress Ring */}
                <div style={{ position: "relative" }}>
                  <svg width="100" height="100" className="progress-ring">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="rgba(255, 255, 255, 0.2)"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="white"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${
                        2 *
                        Math.PI *
                        40 *
                        (1 - detailModal.student.progress / 100)
                      }`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: "700",
                        color: "white",
                      }}
                    >
                      {detailModal.student.progress}%
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        opacity: 0.8,
                        color: "white",
                      }}
                    >
                      HOÀN THÀNH
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div
              style={{
                padding: "32px",
                maxHeight: "calc(90vh - 200px)",
                overflowY: "auto",
                background: "#f8fafc",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr",
                  gap: "32px",
                }}
              >
                {/* Main Content */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "24px",
                  }}
                >
                  {/* Student Details Card */}
                  <div
                    style={{
                      background: "white",
                      borderRadius: "16px",
                      padding: "24px",
                      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05)",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "20px",
                        fontWeight: "600",
                        color: "#1e293b",
                        margin: "0 0 20px 0",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <User size={20} color="#f37021" />
                      Thông tin sinh viên
                    </h3>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "20px",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "#64748b",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            marginBottom: "6px",
                            display: "block",
                          }}
                        >
                          Email
                        </label>
                        <p
                          style={{
                            fontSize: "15px",
                            color: "#334155",
                            margin: 0,
                            fontWeight: "500",
                          }}
                        >
                          {detailModal.student.email || "Chưa cập nhật"}
                        </p>
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "#64748b",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            marginBottom: "6px",
                            display: "block",
                          }}
                        >
                          Số điện thoại
                        </label>
                        <p
                          style={{
                            fontSize: "15px",
                            color: "#334155",
                            margin: 0,
                            fontWeight: "500",
                          }}
                        >
                          {detailModal.student.phone || "Chưa cập nhật"}
                        </p>
                      </div>
                      {detailModal.student.studentProfile && (
                        <>
                          <div>
                            <label
                              style={{
                                fontSize: "12px",
                                fontWeight: "600",
                                color: "#64748b",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                marginBottom: "6px",
                                display: "block",
                              }}
                            >
                              GPA
                            </label>
                            <p
                              style={{
                                fontSize: "15px",
                                color: "#334155",
                                margin: 0,
                                fontWeight: "500",
                              }}
                            >
                              {detailModal.student.studentProfile.gpa || "N/A"}
                            </p>
                          </div>
                          <div>
                            <label
                              style={{
                                fontSize: "12px",
                                fontWeight: "600",
                                color: "#64748b",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                marginBottom: "6px",
                                display: "block",
                              }}
                            >
                              Học lực
                            </label>
                            <p
                              style={{
                                fontSize: "15px",
                                color: "#334155",
                                margin: 0,
                                fontWeight: "500",
                              }}
                            >
                              {detailModal.student.studentProfile
                                .academicStanding || "N/A"}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Topic Details Card */}
                  <div
                    style={{
                      background: "white",
                      borderRadius: "16px",
                      padding: "24px",
                      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05)",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "20px",
                        fontWeight: "600",
                        color: "#1e293b",
                        margin: "0 0 20px 0",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <BookOpen size={20} color="#f37021" />
                      Thông tin đề tài
                    </h3>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "#64748b",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            marginBottom: "8px",
                            display: "block",
                          }}
                        >
                          Tên đề tài
                        </label>
                        <p
                          style={{
                            fontSize: "18px",
                            color: "#1e293b",
                            margin: 0,
                            fontWeight: "600",
                            lineHeight: "1.4",
                          }}
                        >
                          {detailModal.student.topicTitle}
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
                              color: "#64748b",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              marginBottom: "6px",
                              display: "block",
                            }}
                          >
                            Mã đề tài
                          </label>
                          <p
                            style={{
                              fontSize: "15px",
                              color: "#334155",
                              margin: 0,
                              fontWeight: "500",
                            }}
                          >
                            {detailModal.student.topicCode}
                          </p>
                        </div>
                        <div>
                          <label
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#64748b",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              marginBottom: "6px",
                              display: "block",
                            }}
                          >
                            Ngày đăng ký
                          </label>
                          <p
                            style={{
                              fontSize: "15px",
                              color: "#334155",
                              margin: 0,
                              fontWeight: "500",
                            }}
                          >
                            {new Date(
                              detailModal.student.registrationDate
                            ).toLocaleDateString("vi-VN")}
                          </p>
                        </div>
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "#64748b",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            marginBottom: "8px",
                            display: "block",
                          }}
                        >
                          Mô tả đề tài
                        </label>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#475569",
                            lineHeight: "1.6",
                            padding: "16px",
                            background: "#f8fafc",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          {detailModal.student.topic.summary ||
                            "Không có mô tả chi tiết"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "24px",
                  }}
                >
                  {/* Current Milestone Card */}
                  <div
                    style={{
                      background: "white",
                      borderRadius: "16px",
                      padding: "24px",
                      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05)",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <h4
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#1e293b",
                        margin: "0 0 16px 0",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <CheckCircle size={18} color="#f37021" />
                      Mốc hiện tại
                    </h4>
                    {detailModal.student.milestones &&
                    getCurrentMilestone(detailModal.student.milestones) ? (
                      (() => {
                        const currentMilestone = getCurrentMilestone(
                          detailModal.student.milestones
                        );
                        const milestoneData: {
                          [key: string]: { name: string; description: string };
                        } = {
                          MS_REG: {
                            name: "Đăng ký đề tài",
                            description:
                              "Sinh viên lựa chọn và đăng ký đề tài khóa luận, điền thông tin chi tiết và chờ giảng viên hướng dẫn phê duyệt.",
                          },
                          MS_PROG1: {
                            name: "Nộp báo cáo tiến độ lần 1",
                            description:
                              "Sinh viên nộp báo cáo tiến độ lần 1, mô tả tình hình thực hiện, khó khăn và kế hoạch tiếp theo.",
                          },
                          MS_PROG2: {
                            name: "Nộp báo cáo tiến độ lần 2",
                            description:
                              "Sinh viên nộp báo cáo tiến độ lần 2, trình bày kết quả đạt được và hoàn thiện các nội dung còn thiếu.",
                          },
                          MS_FULL: {
                            name: "Nộp khóa luận hoàn chỉnh",
                            description:
                              "Sinh viên hoàn thiện và nộp toàn bộ khóa luận đúng quy định về hình thức và nội dung.",
                          },
                          MS_DEF: {
                            name: "Bảo vệ luận văn",
                            description:
                              "Sinh viên chuẩn bị slide, thuyết trình và tham gia buổi bảo vệ khóa luận trước hội đồng.",
                          },
                        };

                        const data =
                          milestoneData[
                            currentMilestone?.milestoneTemplateCode || ""
                          ];

                        return data ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "12px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "16px",
                                color: "#1e293b",
                                fontWeight: "600",
                              }}
                            >
                              {data.name}
                            </div>
                            <div
                              style={{
                                fontSize: "13px",
                                color: "#64748b",
                                lineHeight: "1.5",
                              }}
                            >
                              {data.description}
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#94a3b8",
                              fontStyle: "italic",
                            }}
                          >
                            {currentMilestone?.milestoneTemplateCode ||
                              "Không xác định"}
                          </div>
                        );
                      })()
                    ) : (
                      <div
                        style={{
                          fontSize: "14px",
                          color: "#94a3b8",
                          fontStyle: "italic",
                        }}
                      >
                        Chưa có mốc nào
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div
                    style={{
                      background: "white",
                      borderRadius: "16px",
                      padding: "24px",
                      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05)",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <h4
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#1e293b",
                        margin: "0 0 16px 0",
                      }}
                    >
                      Thao tác nhanh
                    </h4>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      <button
                        style={{
                          padding: "12px 16px",
                          background: "#f37021",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "14px",
                          fontWeight: "500",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#e55a0d";
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#f37021";
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        <Mail size={16} />
                        Gửi email
                      </button>
                      <button
                        style={{
                          padding: "12px 16px",
                          background: "white",
                          color: "#f37021",
                          border: "1px solid #f37021",
                          borderRadius: "8px",
                          fontSize: "14px",
                          fontWeight: "500",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#fef3f2";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "white";
                        }}
                      >
                        <Calendar size={16} />
                        Lên lịch gặp
                      </button>
                    </div>
                  </div>

                  {/* Last Activity */}
                  <div
                    style={{
                      background: "white",
                      borderRadius: "16px",
                      padding: "24px",
                      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05)",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <h4
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#1e293b",
                        margin: "0 0 16px 0",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <Clock size={18} color="#f37021" />
                      Hoạt động gần nhất
                    </h4>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#475569",
                        margin: 0,
                        fontWeight: "500",
                      }}
                    >
                      {new Date(
                        detailModal.student.lastActivity
                      ).toLocaleDateString("vi-VN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerStudents;
