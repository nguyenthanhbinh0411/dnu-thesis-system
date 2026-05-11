import { useMemo, useState, useEffect } from "react";
import { Edit, Filter, RefreshCw, Search, Trash2 } from "lucide-react";
import { useToast } from "../../context/useToast";
import TablePagination from "../TablePagination/TablePagination";
import { fetchData } from "../../api/fetchData";

type RecordData = Record<string, unknown>;

type DefenseTopicRow = {
  topicId: number;
  topicCode: string;
  topicName: string;
  studentCode: string;
  studentName: string;
  lecturerCode: string;
  lecturerName: string;
  tags: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  raw: RecordData;
};

type TopicFilterState = {
  search: string;
  topicCode: string;
  studentCode: string;
  lecturerCode: string;
  status: string;
  fromDate: string;
  toDate: string;
  sortBy: string;
  sortDescending: string;
};

const initialFilters: TopicFilterState = {
  search: "",
  topicCode: "",
  studentCode: "",
  lecturerCode: "",
  status: "",
  fromDate: "",
  toDate: "",
  sortBy: "createdAt",
  sortDescending: "true",
};

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTopicRow(row: RecordData): DefenseTopicRow {
  return {
    topicId: asNumber(row.topicId ?? row.TopicId ?? row.id ?? row.Id),
    topicCode: asString(row.topicCode ?? row.TopicCode ?? row.code),
    topicName: asString(
      row.topicName ?? row.TopicName ?? row.name ?? row.title ?? row.topicTitle ?? row.TopicTitle,
    ),
    studentCode: asString(row.studentCode ?? row.StudentCode),
    studentName: asString(row.studentName ?? row.StudentName),
    lecturerCode: asString(
      row.lecturerCode ?? row.LecturerCode ?? row.supervisorCode ?? row.SupervisorCode,
    ),
    lecturerName: asString(
      row.lecturerName ?? row.LecturerName ?? row.supervisorName ?? row.SupervisorName ?? row.advisor,
    ),
    tags: asString(row.tags ?? row.Tags ?? row.tag),
    status: asString(row.status ?? row.Status ?? row.state),
    createdAt: asString(row.createdAt ?? row.CreatedAt),
    updatedAt: asString(
      row.updatedAt ?? row.UpdatedAt ?? row.lastUpdated ?? row.LastUpdated,
    ),
    raw: row,
  };
}

interface DefenseTopicsSectionProps {
  defenseTermId: number | null;
}

export default function DefenseTopicsSection({
  defenseTermId,
}: DefenseTopicsSectionProps) {
  const { addToast } = useToast();
  const [rows, setRows] = useState<DefenseTopicRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filters, setFilters] = useState<TopicFilterState>(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchKeyword(searchInput.trim());
      setFilters((prev) => ({ ...prev, search: searchInput.trim() }));
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const listQuery = useMemo(
    () => ({
      defenseTermId: defenseTermId ?? undefined,
      search: searchKeyword,
      topicCode: filters.topicCode,
      studentCode: filters.studentCode,
      lecturerCode: filters.lecturerCode,
      status: filters.status,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      sortBy: filters.sortBy,
      sortDescending: filters.sortDescending === "true",
      page,
      pageSize,
    }),
    [defenseTermId, filters, page, pageSize, searchKeyword],
  );

  const loadRows = async () => {
    if (defenseTermId == null) {
      setRows([]);
      setTotalCount(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetchData<any>(
        `/defense-periods/${defenseTermId}/topics`,
        {
          method: "GET",
          params: listQuery,
        },
      );
      const data = response.data;
      setRows(
        (data?.items ?? data?.Items ?? []).map((row: RecordData) =>
          normalizeTopicRow(row),
        ),
      );
      setTotalCount(
        response.totalCount ?? data?.totalTopics ?? data?.TotalTopics ?? 0,
      );
    } catch (loadError) {
      setRows([]);
      setTotalCount(0);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải danh sách đề tài.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [defenseTermId, listQuery]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize))),
    [pageSize, totalCount],
  );

  const handleEdit = (row: DefenseTopicRow) => {
    addToast(`Chỉnh sửa: ${row.topicCode}`, "info");
  };

  const handleDelete = async (row: DefenseTopicRow) => {
    if (!row.topicId) {
      addToast("Không xác định được bản ghi để xóa.", "error");
      return;
    }
    if (!window.confirm(`Xóa đề tài ${row.topicCode || row.topicName}?`)) {
      return;
    }

    try {
      await fetchData(`/api/defense-periods/${defenseTermId}/topics/${row.topicId}`, {
        method: "DELETE",
      });
      addToast("Đã xóa đề tài.", "success");
      await loadRows();
    } catch (deleteError) {
      addToast(
        deleteError instanceof Error
          ? deleteError.message
          : "Không thể xóa đề tài.",
        "error",
      );
    }
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setSearchInput("");
    setPage(1);
  };

  return (
    <section
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 10,
        background: "#ffffff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          padding: "14px 18px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
            Đề tài
          </div>
          <div style={{ marginTop: 2, color: "#475569", fontSize: 12 }}>
            {rows.length} hàng
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "12px 18px",
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr",
          gap: 10,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 11, color: "#0f172a" }}>
            Tìm kiếm
          </span>
          <div style={{ position: "relative" }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 10,
                top: 9,
                color: "#1e3a5f",
              }}
            />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Mã, tên đề tài"
              style={{
                width: "100%",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "8px 10px 8px 32px",
                fontSize: 12,
              }}
            />
          </div>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 11, color: "#0f172a" }}>
            Trạng thái
          </span>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, status: event.target.value }))
            }
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 12,
            }}
          >
            <option value="">Tất cả</option>
            <option value="draft">Nháp</option>
            <option value="registered">Đã đăng ký</option>
            <option value="approved">Đã phê duyệt</option>
            <option value="rejected">Bị từ chối</option>
          </select>
        </label>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          <button
            type="button"
            onClick={() => setPage(1)}
            style={{
              border: "1px solid #1e3a5f",
              background: "#1e3a5f",
              color: "#ffffff",
              borderRadius: 8,
              padding: "8px 10px",
              fontWeight: 600,
              fontSize: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              flex: 1,
            }}
          >
            <Filter size={12} /> Áp dụng
          </button>
          <button
            type="button"
            onClick={resetFilters}
            style={{
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              borderRadius: 8,
              padding: "8px 10px",
              fontWeight: 600,
              fontSize: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {error ? (
        <div
          style={{
            padding: 12,
            color: "#b91c1c",
            background: "#fff1f2",
            borderBottom: "1px solid #fecdd3",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
              <th
                style={{
                  padding: "10px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  borderBottom: "1px solid #e2e8f0",
                  textTransform: "uppercase",
                  color: "#0f172a",
                  letterSpacing: "0.02em",
                }}
              >
                Mã đề tài
              </th>
              <th
                style={{
                  padding: "10px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  borderBottom: "1px solid #e2e8f0",
                  textTransform: "uppercase",
                  color: "#0f172a",
                  letterSpacing: "0.02em",
                }}
              >
                Tên đề tài
              </th>
              <th
                style={{
                  padding: "10px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  borderBottom: "1px solid #e2e8f0",
                  textTransform: "uppercase",
                  color: "#0f172a",
                  letterSpacing: "0.02em",
                }}
              >
                Sinh viên
              </th>
              <th
                style={{
                  padding: "10px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  borderBottom: "1px solid #e2e8f0",
                  textTransform: "uppercase",
                  color: "#0f172a",
                  letterSpacing: "0.02em",
                }}
              >
                GVHD
              </th>
              <th
                style={{
                  padding: "10px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  borderBottom: "1px solid #e2e8f0",
                  textTransform: "uppercase",
                  color: "#0f172a",
                  letterSpacing: "0.02em",
                }}
              >
                Tag
              </th>
              <th
                style={{
                  padding: "10px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  borderBottom: "1px solid #e2e8f0",
                  textTransform: "uppercase",
                  color: "#0f172a",
                  letterSpacing: "0.02em",
                }}
              >
                Trạng thái
              </th>
              <th
                style={{
                  padding: "10px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  borderBottom: "1px solid #e2e8f0",
                  textTransform: "uppercase",
                  color: "#0f172a",
                  letterSpacing: "0.02em",
                }}
              >
                Hành động
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.topicId}
                style={{ borderTop: "1px solid #e2e8f0" }}
              >
                <td
                  style={{
                    padding: "10px 12px",
                    verticalAlign: "top",
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#0f172a",
                  }}
                >
                  {row.topicCode || "--"}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    verticalAlign: "top",
                    fontSize: 13,
                    color: "#0f172a",
                  }}
                >
                  {row.topicName || "--"}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    verticalAlign: "top",
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>
                    {row.studentName || "--"}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#475569",
                      marginTop: 2,
                    }}
                  >
                    {row.studentCode || "--"}
                  </div>
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    verticalAlign: "top",
                    fontSize: 13,
                    color: "#0f172a",
                  }}
                >
                  {row.lecturerName ? (
                    <>
                      <div style={{ fontWeight: 700 }}>
                        {row.lecturerName}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#475569",
                          marginTop: 2,
                        }}
                      >
                        {row.lecturerCode}
                      </div>
                    </>
                  ) : (
                    "--"
                  )}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    verticalAlign: "top",
                    fontSize: 13,
                    color: "#0f172a",
                  }}
                >
                  {row.tags || "--"}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    verticalAlign: "top",
                    fontSize: 13,
                    color: "#0f172a",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      background:
                        row.status === "approved"
                          ? "#ecfdf5"
                          : row.status === "rejected"
                            ? "#fef2f2"
                            : row.status === "registered"
                              ? "#eff6ff"
                              : "#f3f4f6",
                      color:
                        row.status === "approved"
                          ? "#065f46"
                          : row.status === "rejected"
                            ? "#7f1d1d"
                            : row.status === "registered"
                              ? "#1e40af"
                              : "#374151",
                    }}
                  >
                    {row.status === "approved"
                      ? "Phê duyệt"
                      : row.status === "rejected"
                        ? "Từ chối"
                        : row.status === "registered"
                          ? "Đã đăng ký"
                          : "Nháp"}
                  </span>
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    verticalAlign: "top",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleEdit(row)}
                      style={{
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#0f172a",
                        borderRadius: 8,
                        padding: "6px 8px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <Edit size={12} /> Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(row)}
                      style={{
                        border: "1px solid #ef4444",
                        background: "#ffffff",
                        color: "#b91c1c",
                        borderRadius: 8,
                        padding: "6px 8px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={12} /> Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  Chưa có đề tài trong đợt.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div style={{ padding: 12, borderTop: "1px solid #e2e8f0" }}>
        <TablePagination
          totalCount={totalCount}
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          isLoading={loading}
          pageSizeOptions={[10, 20, 50, 100]}
          totalLabel="Tổng đề tài:"
          pageSizeLabel="Số dòng/trang"
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </section>
  );
}
