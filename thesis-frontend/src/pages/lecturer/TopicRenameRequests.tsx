import { useEffect, useState } from "react";
import {
  BookOpen,
  Clock,
  FileText,
  Filter,
  Loader2,
  Search,
  CheckCircle,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import TopicRenameRequestModal from "../../components/workflow/TopicRenameRequestModal";
import TablePagination from "../../components/TablePagination/TablePagination";
import { listTopicRenameRequests } from "../../services/topic-rename-request.service";
import type { TopicRenameRequestListItem } from "../../types/topic-rename-request";
import { useToast } from "../../context/useToast";
import { useAuth } from "../../hooks/useAuth";

type RenameRequestStatusFilter = "" | "Pending" | "Approved" | "Rejected";

type LecturerRenameRequestContext = {
  topicID?: number | null;
  topicCode?: string | null;
  title?: string | null;
  proposerUserCode?: string | null;
  supervisorUserCode?: string | null;
};

const normalizeStatus = (status: unknown) =>
  String(status ?? "")
    .trim()
    .toLowerCase();

const getStatusMeta = (status: unknown) => {
  const normalized = normalizeStatus(status);

  if (["pending", "dang cho", "đang chờ", "chờ duyệt"].includes(normalized)) {
    return { label: "Chờ duyệt", tone: "pending", icon: Clock };
  }

  if (["approved", "đã duyệt"].includes(normalized)) {
    return { label: "Đã duyệt", tone: "approved", icon: CheckCircle };
  }

  if (["rejected", "từ chối"].includes(normalized)) {
    return { label: "Từ chối", tone: "rejected", icon: AlertCircle };
  }

  return {
    label: String(status ?? "Khác").trim() || "Khác",
    tone: "unknown",
    icon: FileText,
  };
};

const TopicRenameRequestsPage = () => {
  const { addToast } = useToast();
  const auth = useAuth();
  const [requests, setRequests] = useState<TopicRenameRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] =
    useState<RenameRequestStatusFilter>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [summaryCount, setSummaryCount] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] =
    useState<LecturerRenameRequestContext | null>(null);

  const statusOptions: Array<{
    value: RenameRequestStatusFilter;
    label: string;
  }> = [
    { value: "", label: "Tất cả trạng thái" },
    { value: "Pending", label: "Chờ duyệt" },
    { value: "Approved", label: "Đã duyệt" },
    { value: "Rejected", label: "Từ chối" },
  ];

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const loadRequests = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await listTopicRenameRequests({
        reviewedByUserCode: auth.user?.userCode || undefined,
        status: statusFilter || undefined,
        search: searchTerm.trim() || undefined,
        sortBy: "createdAt",
        sortDescending: true,
        page: Math.max(0, currentPage - 1),
        pageSize,
      });

      setRequests(response.items);
      setTotalCount(response.totalCount);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Không thể tải danh sách đơn xin đổi tên đề tài.";
      setError(message);
      setRequests([]);
      setTotalCount(0);
      addToast(message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await listTopicRenameRequests({
        reviewedByUserCode: auth.user?.userCode || undefined,
        sortBy: "createdAt",
        sortDescending: true,
        page: 0,
        pageSize: 1000,
      });

      const summary = response.items.reduce(
        (accumulator, item) => {
          const meta = getStatusMeta(item.status);
          accumulator.total += 1;
          if (meta.tone === "pending") accumulator.pending += 1;
          if (meta.tone === "approved") accumulator.approved += 1;
          if (meta.tone === "rejected") accumulator.rejected += 1;
          return accumulator;
        },
        { total: 0, pending: 0, approved: 0, rejected: 0 },
      );

      setSummaryCount(summary);
    } catch {
      // Keep summary if refresh fails.
    }
  };

  useEffect(() => {
    void loadRequests();
    void loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.userCode, currentPage, statusFilter, searchTerm, pageSize]);

  const openDetailModal = (request: TopicRenameRequestListItem) => {
    setSelectedTopic({
      topicID: request.topicID ?? null,
      topicCode: request.topicCode || null,
      title: request.oldTitle || request.newTitle || null,
      proposerUserCode: request.requestedByUserCode || null,
      supervisorUserCode: request.reviewedByUserCode || null,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    void loadRequests();
    void loadSummary();
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

      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "#1a1a1a",
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <BookOpen size={32} color="#F59E0B" />
          Xin đổi tên đề tài
        </h1>
        <p style={{ fontSize: "14px", color: "#666" }}>
          Danh sách và chi tiết workflow đổi tên đề tài của giảng viên.
        </p>
      </div>

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
              placeholder="Tìm kiếm theo tên đề tài, mã đề tài, sinh viên..."
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
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as RenameRequestStatusFilter);
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
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
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
            <div className="stat-icon-wrapper" style={{ background: "rgba(245, 158, 11, 0.1)" }}>
              <BookOpen size={24} color="#F59E0B" />
            </div>
            <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
              Tổng đơn
            </div>
            <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
              {summaryCount.total}
            </div>
          </div>
          <div style={{ height: "4px", background: "#F59E0B", borderRadius: "2px", width: "40%", marginTop: "12px" }} />
        </div>

        <div className="premium-card">
          <div>
            <div className="stat-icon-wrapper" style={{ background: "rgba(245, 158, 11, 0.1)" }}>
              <Clock size={24} color="#F59E0B" />
            </div>
            <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
              Chờ duyệt
            </div>
            <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
              {summaryCount.pending}
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
              {summaryCount.approved}
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
              Từ chối
            </div>
            <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
              {summaryCount.rejected}
            </div>
          </div>
          <div style={{ height: "4px", background: "#EF4444", borderRadius: "2px", width: "40%", marginTop: "12px" }} />
        </div>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "24px",
          border: "1px solid #D9E1F2",
          padding: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: "48px" }}>
            <Loader2
              size={32}
              color="#F59E0B"
              style={{ animation: "spin 1s linear infinite" }}
            />
            <p style={{ marginTop: "16px", color: "#666" }}>
              Đang tải danh sách đơn xin đổi tên đề tài...
            </p>
          </div>
        ) : requests.length === 0 ? (
          <div
            style={{ textAlign: "center", padding: "48px", color: "#64748B" }}
          >
            Chưa có đơn xin đổi tên đề tài nào.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{ width: "100%", fontSize: "13px", tableLayout: "fixed" }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid #E5ECFB",
                    background: "#F8FAFF",
                  }}
                >
                  <th
                    style={{
                      padding: "14px 16px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#1F3C88",
                      textTransform: "uppercase",
                      fontSize: "11px",
                      width: "14%",
                    }}
                  >
                    Mã request
                  </th>
                  <th
                    style={{
                      padding: "14px 16px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#1F3C88",
                      textTransform: "uppercase",
                      fontSize: "11px",
                      width: "28%",
                    }}
                  >
                    Đề tài
                  </th>
                  <th
                    style={{
                      padding: "14px 16px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#1F3C88",
                      textTransform: "uppercase",
                      fontSize: "11px",
                      width: "13%",
                    }}
                  >
                    Người tạo
                  </th>
                  <th
                    style={{
                      padding: "14px 16px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#1F3C88",
                      textTransform: "uppercase",
                      fontSize: "11px",
                      width: "13%",
                    }}
                  >
                    Người duyệt
                  </th>
                  <th
                    style={{
                      padding: "14px 16px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#1F3C88",
                      textTransform: "uppercase",
                      fontSize: "11px",
                      width: "18%",
                    }}
                  >
                    Lý do
                  </th>
                  <th
                    style={{
                      padding: "14px 16px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#1F3C88",
                      textTransform: "uppercase",
                      fontSize: "11px",
                      width: "14%",
                    }}
                  >
                    Trạng thái
                  </th>
                  <th
                    style={{
                      padding: "14px 16px",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "#1F3C88",
                      textTransform: "uppercase",
                      fontSize: "11px",
                      width: "10%",
                    }}
                  >
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const statusMeta = getStatusMeta(request.status);
                  const StatusIcon = statusMeta.icon;

                  return (
                    <tr
                      key={request.topicRenameRequestID}
                      style={{
                        borderBottom: "1px solid #F3F4F6",
                        transition: "background 0.2s ease",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.background = "#F9FAFB";
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background = "white";
                      }}
                      onClick={() => openDetailModal(request)}
                    >
                      <td
                        style={{ padding: "14px 16px", verticalAlign: "top" }}
                      >
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#1a1a1a",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {request.requestCode ||
                            `#${request.topicRenameRequestID}`}
                        </div>
                        <div
                          style={{
                            marginTop: "4px",
                            fontSize: "11px",
                            color: "#666",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {request.topicCode || "-"}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          verticalAlign: "top",
                          maxWidth: "260px",
                        }}
                      >
                        <div style={{ display: "grid", gap: "4px" }}>
                          <div
                            style={{
                              fontSize: "13px",
                              color: "#1a1a1a",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontWeight: 600,
                            }}
                          >
                            {request.oldTitle || "-"}
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#666",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Tên mới: {request.newTitle || "-"}
                          </div>
                        </div>
                      </td>
                      <td
                        style={{ padding: "14px 16px", verticalAlign: "top" }}
                      >
                        <div
                          style={{
                            fontSize: "13px",
                            color: "#1a1a1a",
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {request.requestedByName || "-"}
                        </div>
                        <div
                          style={{
                            marginTop: "4px",
                            fontSize: "11px",
                            color: "#666",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {request.requestedByStudentCode || "-"}
                        </div>
                      </td>
                      <td
                        style={{ padding: "14px 16px", verticalAlign: "top" }}
                      >
                        <div
                          style={{
                            fontSize: "13px",
                            color: "#1a1a1a",
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {request.reviewedByName || "-"}
                        </div>
                        <div
                          style={{
                            marginTop: "4px",
                            fontSize: "11px",
                            color: "#666",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {request.reviewedByLecturerCode || "-"}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          verticalAlign: "top",
                          maxWidth: "240px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#1a1a1a",
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            lineHeight: 1.4,
                          }}
                        >
                          {request.reason || "-"}
                        </div>
                      </td>
                      <td
                        style={{ padding: "14px 16px", verticalAlign: "top" }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 12px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 600,
                            background:
                              statusMeta.tone === "approved"
                                ? "#F0FDF4"
                                : statusMeta.tone === "pending"
                                  ? "#FFF7ED"
                                  : statusMeta.tone === "rejected"
                                    ? "#FEF2F2"
                                    : "#F3F4F6",
                            color:
                              statusMeta.tone === "approved"
                                ? "#15803D"
                                : statusMeta.tone === "pending"
                                  ? "#C2410C"
                                  : statusMeta.tone === "rejected"
                                    ? "#B91C1C"
                                    : "#4B5563",
                            border: `1px solid ${statusMeta.tone === "approved" ? "#86EFAC" : statusMeta.tone === "pending" ? "#FDBA74" : statusMeta.tone === "rejected" ? "#FECACA" : "#D1D5DB"}`,
                          }}
                        >
                          <StatusIcon size={12} /> {statusMeta.label}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          verticalAlign: "top",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            justifyContent: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            style={{
                              padding: "6px 10px",
                              background: "#F37021",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "11px",
                              fontWeight: 600,
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              openDetailModal(request);
                            }}
                          >
                            Xem
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <TablePagination
          totalCount={totalCount}
          page={currentPage}
          pageCount={totalPages}
          pageSize={pageSize}
          isLoading={loading || refreshing}
          pageSizeOptions={[10, 20, 50]}
          totalLabel="Tổng bản ghi:"
          pageSizeLabel="Số dòng/trang"
          onPageChange={setCurrentPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setCurrentPage(1);
          }}
        />
      </div>

      <TopicRenameRequestModal
        isOpen={isModalOpen}
        onClose={closeModal}
        currentTopic={selectedTopic}
        initialMode="detail"
      />
    </div>
  );
};

export default TopicRenameRequestsPage;
