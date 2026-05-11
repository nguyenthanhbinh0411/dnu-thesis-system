import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Edit, Filter, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import {
  createDefenseTermLecturer,
  deleteDefenseTermLecturer,
  updateDefenseTermLecturer,
  listDefenseTermLecturers,
  type DefenseTermLecturerPayload,
} from "../../services/defense-term-membership.service";
import { useToast } from "../../context/useToast";
import TablePagination from "../TablePagination/TablePagination";
import DefenseTermLecturersPickerModal, {
  type DefenseTermLecturerSelection,
} from "./DefenseTermLecturersPickerModal";

type RecordData = Record<string, unknown>;

type DefenseTermLecturerRow = {
  defenseTermLecturerID: number;
  defenseTermId: number;
  lecturerProfileID: number;
  lecturerCode: string;
  userCode: string;
  fullName: string;
  departmentCode: string;
  degree: string;
  roles: string[];
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  raw: RecordData;
};

type LecturerFilterState = {
  search: string;
  departmentCode: string;
  degree: string;
  tagCodes: string;
  tags: string;
  lecturerCode: string;
  userCode: string;
  role: string;
  isPrimary: string;
  fromDate: string;
  toDate: string;
  sortBy: string;
  sortDescending: string;
};

const initialFilters: LecturerFilterState = {
  search: "",
  departmentCode: "",
  degree: "",
  tagCodes: "",
  tags: "",
  lecturerCode: "",
  userCode: "",
  role: "",
  isPrimary: "",
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

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const text = asString(value).toLowerCase();
  return ["1", "true", "yes", "y", "on", "đúng", "co"].includes(text);
}

function toRoleList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(asString).filter(Boolean);
  }
  return asString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLecturerRow(row: RecordData): DefenseTermLecturerRow {
  return {
    defenseTermLecturerID: asNumber(
      row.defenseTermLecturerID ??
        row.DefenseTermLecturerID ??
        row.id ??
        row.Id,
    ),
    defenseTermId: asNumber(row.defenseTermId ?? row.DefenseTermId),
    lecturerProfileID: asNumber(
      row.lecturerProfileID ?? row.LecturerProfileID ?? row.lecturerProfileId,
    ),
    lecturerCode: asString(row.lecturerCode ?? row.LecturerCode),
    userCode: asString(row.userCode ?? row.UserCode),
    fullName: asString(
      row.fullName ?? row.FullName ?? row.lecturerName ?? row.name,
    ),
    departmentCode: asString(row.departmentCode ?? row.DepartmentCode),
    degree: asString(row.degree ?? row.Degree),
    roles: toRoleList(row.role ?? row.roles ?? row.Role ?? row.Roles),
    isPrimary: asBoolean(row.isPrimary ?? row.IsPrimary),
    createdAt: asString(row.createdAt ?? row.CreatedAt),
    updatedAt: asString(
      row.updatedAt ?? row.UpdatedAt ?? row.lastUpdated ?? row.LastUpdated,
    ),
    raw: row,
  };
}

function toPayload(
  row: DefenseTermLecturerSelection,
  defenseTermId: number,
): DefenseTermLecturerPayload {
  return {
    defenseTermId,
    lecturerProfileID: row.lecturerProfileID,
    lecturerCode: row.lecturerCode,
    userCode: row.userCode,
    role: row.roles.join(", "),
    isPrimary: row.isPrimary,
  };
}

interface DefenseTermLecturersSectionProps {
  defenseTermId: number | null;
}

export interface DefenseTermLecturersSectionHandle {
  openAdd: () => void;
}

const DefenseTermLecturersSection = forwardRef<
  DefenseTermLecturersSectionHandle,
  DefenseTermLecturersSectionProps
>(({ defenseTermId }, ref) => {
  const { addToast } = useToast();
  const [rows, setRows] = useState<DefenseTermLecturerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filters, setFilters] = useState<LecturerFilterState>(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<DefenseTermLecturerRow | null>(
    null,
  );

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
      departmentCode: filters.departmentCode,
      degree: filters.degree,
      tagCodes: filters.tagCodes,
      tags: filters.tags,
      lecturerCode: filters.lecturerCode,
      userCode: filters.userCode,
      role: filters.role,
      isPrimary:
        filters.isPrimary === "" ? undefined : filters.isPrimary === "true",
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      sortBy: filters.sortBy,
      sortDescending: filters.sortDescending === "true",
      page,
      pageSize,
    }),
    [defenseTermId, filters, page, pageSize, searchKeyword],
  );

  const loadRows = useCallback(async () => {
    if (defenseTermId == null) {
      setRows([]);
      setTotalCount(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await listDefenseTermLecturers(listQuery);
      setRows(response.data.map(normalizeLecturerRow));
      setTotalCount(response.totalCount);
    } catch (loadError) {
      setRows([]);
      setTotalCount(0);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải danh sách giảng viên trong đợt.",
      );
    } finally {
      setLoading(false);
    }
  }, [defenseTermId, listQuery]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize))),
    [pageSize, totalCount],
  );

  const openAdd = useCallback(() => {
    if (defenseTermId == null) {
      addToast("Vui lòng chọn một đợt trước khi thêm giảng viên.", "warning");
      return;
    }
    setEditingRow(null);
    setPickerOpen(true);
  }, [addToast, defenseTermId]);

  useImperativeHandle(ref, () => ({ openAdd }), [openAdd]);

  const openEdit = (row: DefenseTermLecturerRow) => {
    setEditingRow(row);
    setPickerOpen(true);
  };

  const handleDelete = async (row: DefenseTermLecturerRow) => {
    if (!row.defenseTermLecturerID) {
      addToast("Không xác định được bản ghi để xóa.", "error");
      return;
    }
    if (
      !window.confirm(
        `Xóa giảng viên ${row.lecturerCode || row.fullName || "này"}?`,
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      await deleteDefenseTermLecturer(row.defenseTermLecturerID);
      addToast("Đã xóa giảng viên trong đợt.", "success");
      await loadRows();
    } catch (deleteError) {
      addToast(
        deleteError instanceof Error
          ? deleteError.message
          : "Không thể xóa giảng viên.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSelection = async (
    selected: DefenseTermLecturerSelection[],
  ) => {
    if (defenseTermId == null) {
      return;
    }
    if (selected.length === 0) {
      addToast("Chưa chọn giảng viên nào.", "warning");
      return;
    }

    setSaving(true);
    try {
      if (editingRow) {
        const first = selected[0];
        await updateDefenseTermLecturer(
          editingRow.defenseTermLecturerID,
          toPayload(first, defenseTermId),
        );
        addToast("Đã cập nhật giảng viên trong đợt.", "success");
      } else {
        await Promise.all(
          selected.map((item) =>
            createDefenseTermLecturer({
              ...toPayload(item, defenseTermId),
            }),
          ),
        );
        addToast("Đã thêm giảng viên vào đợt.", "success");
      }
      setPickerOpen(false);
      setEditingRow(null);
      await loadRows();
    } catch (submitError) {
      addToast(
        submitError instanceof Error
          ? submitError.message
          : "Không thể lưu giảng viên vào đợt.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearchKeyword("");
    setFilters(initialFilters);
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
            Giảng viên trong đợt
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
          <span style={{ fontWeight: 600, fontSize: 11, color: "#0f172a" }}>Tìm kiếm</span>
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
              placeholder="Tên, mã GV, mã user"
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
          <span style={{ fontWeight: 600, fontSize: 11, color: "#0f172a" }}>Khoa</span>
          <input
            value={filters.departmentCode}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                departmentCode: event.target.value,
              }))
            }
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 12,
            }}
          />
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
            onClick={() => {
              setFilters(initialFilters);
              setSearchInput("");
              setPage(1);
            }}
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
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Mã GV</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Giảng viên</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>User</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Khoa</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Học vị</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.defenseTermLecturerID}
                style={{ borderTop: "1px solid #e2e8f0" }}
              >
                <td
                  style={{ padding: "10px 12px", verticalAlign: "top", fontWeight: 700, fontSize: 13, color: "#0f172a" }}
                >
                  {row.lecturerCode || "--"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>
                    {row.fullName || "--"}
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                    {row.lecturerProfileID || "--"}
                  </div>
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13, color: "#0f172a" }}>
                  {row.userCode || "--"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13, color: "#0f172a" }}>
                  {row.departmentCode || "--"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13, color: "#0f172a" }}>
                  {row.degree || "--"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
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
                      disabled={saving}
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
                  colSpan={6}
                  style={{ padding: 24, textAlign: "center", color: "#64748b" }}
                >
                  Chưa có giảng viên trong đợt.
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
          totalLabel="Tổng giảng viên:"
          pageSizeLabel="Số dòng/trang"
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </div>

      <DefenseTermLecturersPickerModal
        isOpen={pickerOpen}
        defenseTermId={defenseTermId}
        initialSelectedIds={editingRow ? [editingRow.lecturerProfileID] : []}
        initialSelections={
          editingRow
            ? [
                {
                  lecturerProfileID: editingRow.lecturerProfileID,
                  lecturerCode: editingRow.lecturerCode,
                  userCode: editingRow.userCode,
                  fullName: editingRow.fullName,
                  departmentCode: editingRow.departmentCode,
                  degree: editingRow.degree,
                  profileImage: "",
                  roles: editingRow.roles,
                  isPrimary: editingRow.isPrimary,
                  raw: editingRow.raw,
                },
              ]
            : []
        }
        title={
          editingRow ? "Sửa giảng viên trong đợt" : "Thêm giảng viên vào đợt"
        }
        subtitle={
          editingRow
            ? "Chọn một giảng viên mới và cấu hình lại role/chính cho bản ghi hiện tại."
            : "Chọn nhiều giảng viên, rồi gắn role cho từng giảng viên trước khi lưu."
        }
        onClose={() => {
          setPickerOpen(false);
          setEditingRow(null);
        }}
        onConfirm={handleConfirmSelection}
      />
    </section>
  );
});

DefenseTermLecturersSection.displayName = "DefenseTermLecturersSection";

export default DefenseTermLecturersSection;
