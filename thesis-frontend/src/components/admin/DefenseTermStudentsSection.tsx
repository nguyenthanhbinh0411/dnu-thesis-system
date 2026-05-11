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
  createDefenseTermStudent,
  deleteDefenseTermStudent,
  listDefenseTermStudents,
  updateDefenseTermStudent,
  type DefenseTermStudentPayload,
} from "../../services/defense-term-membership.service";
import { useToast } from "../../context/useToast";
import TablePagination from "../TablePagination/TablePagination";
import DefenseTermStudentsPickerModal, {
  type DefenseTermStudentSelection,
} from "./DefenseTermStudentsPickerModal";

type RecordData = Record<string, unknown>;

type DefenseTermStudentRow = {
  defenseTermStudentID: number;
  defenseTermId: number;
  studentProfileID: number;
  studentCode: string;
  userCode: string;
  fullName: string;
  classCode: string;
  facultyCode: string;
  departmentCode: string;
  gpa: number | null;
  createdAt: string;
  updatedAt: string;
  raw: RecordData;
};

type StudentFilterState = {
  search: string;
  studentCode: string;
  userCode: string;
  fromDate: string;
  toDate: string;
  sortBy: string;
  sortDescending: string;
};

const initialFilters: StudentFilterState = {
  search: "",
  studentCode: "",
  userCode: "",
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

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStudentRow(row: RecordData): DefenseTermStudentRow {
  return {
    defenseTermStudentID: asNumber(
      row.defenseTermStudentID ?? row.DefenseTermStudentID ?? row.id ?? row.Id,
    ),
    defenseTermId: asNumber(row.defenseTermId ?? row.DefenseTermId),
    studentProfileID: asNumber(
      row.studentProfileID ?? row.StudentProfileID ?? row.studentProfileId,
    ),
    studentCode: asString(row.studentCode ?? row.StudentCode),
    userCode: asString(row.userCode ?? row.UserCode),
    fullName: asString(
      row.fullName ?? row.FullName ?? row.studentName ?? row.name,
    ),
    classCode: asString(row.classCode ?? row.ClassCode),
    facultyCode: asString(row.facultyCode ?? row.FacultyCode),
    departmentCode: asString(row.departmentCode ?? row.DepartmentCode),
    gpa: asNullableNumber(row.gpa ?? row.GPA),
    createdAt: asString(row.createdAt ?? row.CreatedAt),
    updatedAt: asString(
      row.updatedAt ?? row.UpdatedAt ?? row.lastUpdated ?? row.LastUpdated,
    ),
    raw: row,
  };
}

function toPayload(
  row: DefenseTermStudentSelection,
  defenseTermId: number,
): DefenseTermStudentPayload {
  return {
    defenseTermId,
    studentProfileID: row.studentProfileID,
    studentCode: row.studentCode,
    userCode: row.userCode,
  };
}

interface DefenseTermStudentsSectionProps {
  defenseTermId: number | null;
}

export interface DefenseTermStudentsSectionHandle {
  openAdd: () => void;
}

const DefenseTermStudentsSection = forwardRef<
  DefenseTermStudentsSectionHandle,
  DefenseTermStudentsSectionProps
>(({ defenseTermId }, ref) => {
  const { addToast } = useToast();
  const [rows, setRows] = useState<DefenseTermStudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filters, setFilters] = useState<StudentFilterState>(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<DefenseTermStudentRow | null>(
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
      studentCode: filters.studentCode,
      userCode: filters.userCode,
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
      const response = await listDefenseTermStudents(listQuery);
      setRows(response.data.map(normalizeStudentRow));
      setTotalCount(response.totalCount);
    } catch (loadError) {
      setRows([]);
      setTotalCount(0);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải danh sách sinh viên trong đợt.",
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
      addToast("Vui lòng chọn một đợt trước khi thêm sinh viên.", "warning");
      return;
    }
    setEditingRow(null);
    setPickerOpen(true);
  }, [addToast, defenseTermId]);

  useImperativeHandle(ref, () => ({ openAdd }), [openAdd]);

  const openEdit = (row: DefenseTermStudentRow) => {
    setEditingRow(row);
    setPickerOpen(true);
  };

  const handleDelete = async (row: DefenseTermStudentRow) => {
    if (!row.defenseTermStudentID) {
      addToast("Không xác định được bản ghi để xóa.", "error");
      return;
    }
    if (
      !window.confirm(
        `Xóa sinh viên ${row.studentCode || row.fullName || "này"}?`,
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      await deleteDefenseTermStudent(row.defenseTermStudentID);
      addToast("Đã xóa sinh viên trong đợt.", "success");
      await loadRows();
    } catch (deleteError) {
      addToast(
        deleteError instanceof Error
          ? deleteError.message
          : "Không thể xóa sinh viên.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSelection = async (
    selected: DefenseTermStudentSelection[],
  ) => {
    if (defenseTermId == null) {
      return;
    }
    if (selected.length === 0) {
      addToast("Chưa chọn sinh viên nào.", "warning");
      return;
    }

    setSaving(true);
    try {
      if (editingRow) {
        const first = selected[0];
        await updateDefenseTermStudent(editingRow.defenseTermStudentID, {
          defenseTermId,
          studentProfileID: first.studentProfileID,
          studentCode: first.studentCode,
          userCode: first.userCode,
        } as DefenseTermStudentPayload);
        addToast("Đã cập nhật sinh viên trong đợt.", "success");
      } else {
        await Promise.all(
          selected.map((item) =>
            createDefenseTermStudent(toPayload(item, defenseTermId)),
          ),
        );
        addToast("Đã thêm sinh viên vào đợt.", "success");
      }
      setPickerOpen(false);
      setEditingRow(null);
      await loadRows();
    } catch (submitError) {
      addToast(
        submitError instanceof Error
          ? submitError.message
          : "Không thể lưu sinh viên vào đợt.",
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
            Sinh viên trong đợt
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
              placeholder="Tên, mã SV, mã user"
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
          <span style={{ fontWeight: 600, fontSize: 11, color: "#0f172a" }}>Sắp xếp</span>
          <select
            value={filters.sortBy}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, sortBy: event.target.value }))
            }
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 12,
            }}
          >
            <option value="createdAt">CreatedAt</option>
            <option value="updatedAt">UpdatedAt</option>
            <option value="studentCode">StudentCode</option>
            <option value="userCode">UserCode</option>
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
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Mã SV</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Sinh viên</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>User</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Lớp</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Khoa</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>GPA</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.defenseTermStudentID || row.studentProfileID}
                style={{ borderTop: "1px solid #e2e8f0" }}
              >
                <td
                  style={{ padding: "10px 12px", verticalAlign: "top", fontWeight: 700, fontSize: 13, color: "#0f172a" }}
                >
                  {row.studentCode || "--"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>
                    {row.fullName || "--"}
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                    {row.studentProfileID || "--"}
                  </div>
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13, color: "#0f172a" }}>
                  {row.userCode || "--"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13, color: "#0f172a" }}>
                  {row.classCode || "--"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13, color: "#0f172a" }}>
                  {row.facultyCode || "--"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13, color: "#0f172a" }}>
                  {row.gpa ?? "--"}
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
                  colSpan={8}
                  style={{ padding: 24, textAlign: "center", color: "#64748b" }}
                >
                  Chưa có sinh viên trong đợt.
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
          totalLabel="Tổng sinh viên:"
          pageSizeLabel="Số dòng/trang"
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </div>

      <DefenseTermStudentsPickerModal
        isOpen={pickerOpen}
        defenseTermId={defenseTermId}
        initialSelectedIds={editingRow ? [editingRow.studentProfileID] : []}
        initialSelections={
          editingRow
            ? [
                {
                  studentProfileID: editingRow.studentProfileID,
                  studentCode: editingRow.studentCode,
                  userCode: editingRow.userCode,
                  fullName: editingRow.fullName,
                  classCode: editingRow.classCode,
                  facultyCode: editingRow.facultyCode,
                  departmentCode: editingRow.departmentCode,
                  gpa: editingRow.gpa,
                  studentImage: "",
                  raw: editingRow.raw,
                },
              ]
            : []
        }
        title={
          editingRow ? "Sửa sinh viên trong đợt" : "Thêm sinh viên vào đợt"
        }
        subtitle={
          editingRow
            ? "Chọn một sinh viên mới để thay thế bản ghi hiện tại."
            : "Chọn nhiều sinh viên từ danh sách nguồn để thêm vào đợt."
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

DefenseTermStudentsSection.displayName = "DefenseTermStudentsSection";

export default DefenseTermStudentsSection;
