import React, { useEffect, useMemo, useState } from "react";
import { Check, CheckSquare, Filter, Search, Square, X } from "lucide-react";
import { normalizeUrl } from "../../api/fetchData";
import {
  listDefenseTermStudents,
  listStudentProfiles,
  type DefenseTermStudentRecord,
  type StudentProfileRecord,
} from "../../services/defense-term-membership.service";
import TablePagination from "../TablePagination/TablePagination";

export type DefenseTermStudentSelection = {
  studentProfileID: number;
  studentCode: string;
  userCode: string;
  fullName: string;
  classCode: string;
  facultyCode: string;
  departmentCode: string;
  gpa: number | null;
  studentImage?: string;
  raw: Record<string, unknown>;
};

type StudentTab = "all" | "assigned";

type StudentPickerFilters = {
  search: string;
  minGPA: string;
  maxGPA: string;
  classCode: string;
  facultyCode: string;
  departmentCode: string;
  studentCode: string;
  userCode: string;
};

type StudentRow = DefenseTermStudentSelection & {
  defenseTermStudentID: number;
  defenseTermId: number;
};

interface DefenseTermStudentsPickerModalProps {
  isOpen: boolean;
  defenseTermId: number | null;
  title?: string;
  subtitle?: string;
  initialSelectedIds?: number[];
  initialSelections?: DefenseTermStudentSelection[];
  onClose: () => void;
  onConfirm: (selected: DefenseTermStudentSelection[]) => void | Promise<void>;
}

const initialFilters: StudentPickerFilters = {
  search: "",
  minGPA: "",
  maxGPA: "",
  classCode: "",
  facultyCode: "",
  departmentCode: "",
  studentCode: "",
  userCode: "",
};

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStudentSelection(
  record: StudentProfileRecord,
): DefenseTermStudentSelection {
  return {
    studentProfileID: Number(
      record.studentProfileID ??
        record.StudentProfileID ??
        record.id ??
        record.Id ??
        0,
    ),
    studentCode: asString(record.studentCode ?? record.StudentCode),
    userCode: asString(record.userCode ?? record.UserCode),
    fullName: asString(
      record.fullName ?? record.FullName ?? record.name ?? record.Name,
    ),
    classCode: asString(record.classCode ?? record.ClassCode),
    facultyCode: asString(record.facultyCode ?? record.FacultyCode),
    departmentCode: asString(record.departmentCode ?? record.DepartmentCode),
    gpa: asNumber(record.gpa ?? record.GPA),
    studentImage: asString(record.studentImage ?? record.StudentImage),
    raw: record,
  };
}

function toAssignedSelection(record: DefenseTermStudentRecord): StudentRow {
  const base = toStudentSelection(record);
  return {
    ...base,
    defenseTermStudentID: Number(
      record.defenseTermStudentID ??
        record.DefenseTermStudentID ??
        record.id ??
        record.Id ??
        0,
    ),
    defenseTermId: Number(record.defenseTermId ?? record.DefenseTermId ?? 0),
  };
}

function toRowKey(row: DefenseTermStudentSelection | StudentRow): string {
  return String(row.studentProfileID || row.studentCode || row.userCode || "");
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const cardStyle: React.CSSProperties = {
  width: "min(1280px, 100%)",
  maxHeight: "92vh",
  overflow: "hidden",
  background: "#ffffff",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  boxShadow: "0 28px 90px rgba(15, 23, 42, 0.24)",
  display: "flex",
  flexDirection: "column",
};

const headerStyle: React.CSSProperties = {
  padding: 14,
  borderBottom: "1px solid #e2e8f0",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const sectionButton: React.CSSProperties = {
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
  cursor: "pointer",
};

const sectionButtonPrimary: React.CSSProperties = {
  ...sectionButton,
  background: "#1e3a5f",
  color: "#ffffff",
  borderColor: "#1e3a5f",
};

const sectionButtonGhost: React.CSSProperties = {
  ...sectionButton,
  background: "#ffffff",
};

const bodyStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 320px) minmax(0, 1fr)",
  minHeight: 0,
  flex: 1,
};

const sidePanelStyle: React.CSSProperties = {
  borderRight: "1px solid #e2e8f0",
  padding: 16,
  overflowY: "auto",
  background: "linear-gradient(180deg, #ffffff 0%, #fffaf5 100%)",
};

const mainPanelStyle: React.CSSProperties = {
  padding: 16,
  overflowY: "auto",
  minHeight: 0,
};

const panelCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#ffffff",
  boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
};

const tabButtonStyle = (active: boolean): React.CSSProperties => ({
  border: "1px solid",
  borderColor: active ? "#1e3a5f" : "#cbd5e1",
  background: active ? "#1e3a5f" : "#ffffff",
  color: active ? "#ffffff" : "#0f172a",
  borderRadius: 999,
  padding: "8px 12px",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
});

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 12,
  outline: "none",
  background: "#ffffff",
};

function buildFilterSummary(filters: StudentPickerFilters): string[] {
  const parts: string[] = [];
  if (filters.classCode) parts.push(`Lớp: ${filters.classCode}`);
  if (filters.facultyCode) parts.push(`Khoa: ${filters.facultyCode}`);
  if (filters.departmentCode) parts.push(`Bộ môn: ${filters.departmentCode}`);
  if (filters.minGPA) parts.push(`GPA >= ${filters.minGPA}`);
  if (filters.maxGPA) parts.push(`GPA <= ${filters.maxGPA}`);
  return parts;
}

const DefenseTermStudentsPickerModal: React.FC<
  DefenseTermStudentsPickerModalProps
> = ({
  isOpen,
  defenseTermId,
  title = "Chọn sinh viên",
  subtitle = "Chọn nhiều sinh viên từ toàn bộ danh sách hoặc từ những sinh viên đã có trong đợt.",
  initialSelectedIds = [],
  initialSelections = [],
  onClose,
  onConfirm,
}) => {
  const [activeTab, setActiveTab] = useState<StudentTab>("all");
  const [filters, setFilters] = useState<StudentPickerFilters>(initialFilters);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [rows, setRows] = useState<
    Array<DefenseTermStudentSelection | StudentRow>
  >([]);
  const [assignedRows, setAssignedRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSelectedIds);
  const [selectedCache, setSelectedCache] = useState<
    Record<number, DefenseTermStudentSelection | StudentRow>
  >({});
  const [quickMinGpa, setQuickMinGpa] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setActiveTab("all");
    setFilters(initialFilters);
    setSearchInput("");
    setPage(1);
    setPageSize(10);
    setTotalCount(0);
    setRows([]);
    setAssignedRows([]);
    setLoading(false);
    setError(null);
    setSelectedIds(initialSelectedIds);
    setSelectedCache(
      initialSelections.reduce<Record<number, DefenseTermStudentSelection>>(
        (acc, item) => {
          acc[item.studentProfileID] = item;
          return acc;
        },
        {},
      ),
    );
    setQuickMinGpa("");
  }, [initialSelections, initialSelectedIds, isOpen]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput.trim() }));
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loadRows = async () => {
      if (defenseTermId == null) {
        setRows([]);
        setAssignedRows([]);
        setTotalCount(0);
        setError("Vui lòng chọn một đợt bảo vệ trước khi thêm sinh viên.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (activeTab === "all") {
          const response = await listStudentProfiles({
            search: filters.search,
            minGPA: filters.minGPA,
            maxGPA: filters.maxGPA,
            classCode: filters.classCode,
            facultyCode: filters.facultyCode,
            departmentCode: filters.departmentCode,
            studentCode: filters.studentCode,
            userCode: filters.userCode,
            page,
            pageSize,
          });

          if (cancelled) return;

          const normalized = response.data.map(toStudentSelection);
          setRows(normalized);
          setTotalCount(response.totalCount);
          setSelectedCache((prev) => {
            const next = { ...prev };
            normalized.forEach((item) => {
              next[item.studentProfileID] = item;
            });
            return next;
          });
        } else {
          const response = await listDefenseTermStudents({
            defenseTermId,
            search: filters.search,
            studentCode: filters.studentCode,
            userCode: filters.userCode,
            page,
            pageSize,
            sortBy: "studentCode",
            sortDescending: false,
          });

          if (cancelled) return;

          const normalized = response.data.map(toAssignedSelection);
          setAssignedRows(normalized);
          setRows(normalized);
          setTotalCount(response.totalCount);
          setSelectedCache((prev) => {
            const next = { ...prev };
            normalized.forEach((item) => {
              next[item.studentProfileID] = item;
            });
            return next;
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Không thể tải dữ liệu sinh viên.",
          );
          setRows([]);
          setAssignedRows([]);
          setTotalCount(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadRows();

    return () => {
      cancelled = true;
    };
  }, [activeTab, defenseTermId, filters, isOpen, page, pageSize]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize))),
    [pageSize, totalCount],
  );

  const visibleRows = activeTab === "all" ? rows : assignedRows;
  const visibleIds = useMemo(
    () => visibleRows.map((row) => row.studentProfileID).filter((id) => id > 0),
    [visibleRows],
  );

  const selectedCount = selectedIds.length;

  const toggleSelected = (row: DefenseTermStudentSelection | StudentRow) => {
    const id = row.studentProfileID;
    if (!id) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
    setSelectedCache((prev) => ({ ...prev, [id]: row }));
  };

  const selectAllVisible = () => {
    const nextIds = new Set(selectedIds);
    visibleRows.forEach((row) => {
      if (row.studentProfileID > 0) {
        nextIds.add(row.studentProfileID);
        setSelectedCache((prev) => ({ ...prev, [row.studentProfileID]: row }));
      }
    });
    setSelectedIds(Array.from(nextIds));
  };

  const clearVisible = () => {
    const nextIds = new Set(selectedIds);
    visibleRows.forEach((row) => nextIds.delete(row.studentProfileID));
    setSelectedIds(Array.from(nextIds));
  };

  const selectByGpa = async () => {
    const minGpa = Number(quickMinGpa);
    if (!Number.isFinite(minGpa)) {
      return;
    }

    try {
      const response = await listStudentProfiles({
        search: filters.search,
        minGPA: minGpa,
        maxGPA: filters.maxGPA,
        classCode: filters.classCode,
        facultyCode: filters.facultyCode,
        departmentCode: filters.departmentCode,
        studentCode: filters.studentCode,
        userCode: filters.userCode,
        page: 1,
        pageSize: 500,
      });
      const nextSelection = response.data.map(toStudentSelection);
      setSelectedCache((prev) => {
        const next = { ...prev };
        nextSelection.forEach((item) => {
          next[item.studentProfileID] = item;
        });
        return next;
      });
      setSelectedIds((prev) =>
        Array.from(
          new Set([
            ...prev,
            ...nextSelection.map((item) => item.studentProfileID),
          ]),
        ),
      );
    } catch {
      // Keep the popup responsive even if the bulk-select query fails.
    }
  };

  const confirmSelection = async () => {
    const payload = selectedIds
      .map((id) => selectedCache[id])
      .filter(Boolean)
      .map((row) => ({
        studentProfileID: row.studentProfileID,
        studentCode: row.studentCode,
        userCode: row.userCode,
        fullName: row.fullName,
        classCode: row.classCode,
        facultyCode: row.facultyCode,
        departmentCode: row.departmentCode,
        gpa: row.gpa,
        studentImage: row.studentImage,
        raw: row.raw,
      }));

    setSaving(true);
    try {
      await onConfirm(payload);
    } finally {
      setSaving(false);
    }
  };

  const isAllVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  if (!isOpen) {
    return null;
  }

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true">
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
              {title}
            </div>
            <div style={{ marginTop: 4, color: "#475569", fontSize: 12 }}>
              {subtitle}
            </div>
            <div style={{ marginTop: 6, color: "#0f172a", fontSize: 11 }}>
              Đang chọn: <strong>{selectedCount}</strong> sinh viên
            </div>
          </div>
          <button
            type="button"
            style={sectionButtonGhost}
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={16} /> Đóng
          </button>
        </div>

        <div style={bodyStyle}>
          <aside style={sidePanelStyle}>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={panelCardStyle as React.CSSProperties}>
                <div
                  style={{
                    padding: 12,
                    borderBottom: "1px solid #e2e8f0",
                    fontWeight: 700,
                    fontSize: 12,
                    color: "#0f172a",
                  }}
                >
                  Bộ lọc nguồn
                </div>
                <div style={{ padding: 12, display: "grid", gap: 8 }}>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>
                      Tìm kiếm
                    </span>
                    <div style={{ position: "relative" }}>
                      <Search
                        size={13}
                        style={{
                          position: "absolute",
                          left: 10,
                          top: 8,
                          color: "#1e3a5f",
                        }}
                      />
                      <input
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Tên, mã SV, mã user"
                        style={{ ...inputStyle, paddingLeft: 36 }}
                      />
                    </div>
                  </label>

                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      gridTemplateColumns: "1fr 1fr",
                    }}
                  >
                    <label style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>
                        GPA từ
                      </span>
                      <input
                        type="number"
                        value={filters.minGPA}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            minGPA: event.target.value,
                          }))
                        }
                        step="0.01"
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>
                        GPA đến
                      </span>
                      <input
                        type="number"
                        value={filters.maxGPA}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            maxGPA: event.target.value,
                          }))
                        }
                        step="0.01"
                        style={inputStyle}
                      />
                    </label>
                  </div>

                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>Lớp</span>
                    <input
                      value={filters.classCode}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          classCode: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>Khoa</span>
                    <input
                      value={filters.facultyCode}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          facultyCode: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>
                      Bộ môn
                    </span>
                    <input
                      value={filters.departmentCode}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          departmentCode: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>Mã SV</span>
                    <input
                      value={filters.studentCode}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          studentCode: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>
                      Mã user
                    </span>
                    <input
                      value={filters.userCode}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          userCode: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </label>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      style={sectionButtonPrimary}
                      onClick={() => setPage(1)}
                    >
                      <Filter size={15} /> Áp dụng lọc
                    </button>
                    <button
                      type="button"
                      style={sectionButtonGhost}
                      onClick={() => {
                        setFilters(initialFilters);
                        setSearchInput("");
                        setPage(1);
                      }}
                    >
                      <X size={15} /> Xóa lọc
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 6,
                      fontSize: 12,
                      color: "#334155",
                    }}
                  >
                    {buildFilterSummary(filters).map((item) => (
                      <span key={item}>• {item}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div style={panelCardStyle as React.CSSProperties}>
                <div
                  style={{
                    padding: 12,
                    borderBottom: "1px solid #e2e8f0",
                    fontWeight: 700,
                    fontSize: 12,
                    color: "#0f172a",
                  }}
                >
                  Chọn nhanh
                </div>
                <div style={{ padding: 12, display: "grid", gap: 8 }}>
                  <button
                    type="button"
                    style={sectionButtonPrimary}
                    onClick={selectAllVisible}
                  >
                    <CheckSquare size={15} /> Chọn tất cả đang lọc
                  </button>
                  <button
                    type="button"
                    style={sectionButtonGhost}
                    onClick={clearVisible}
                  >
                    <Square size={15} /> Bỏ chọn đang lọc
                  </button>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>
                      GPA &ge;
                    </span>
                    <input
                      type="number"
                      value={quickMinGpa}
                      onChange={(event) => setQuickMinGpa(event.target.value)}
                      step="0.01"
                      placeholder="Ví dụ: 3.2"
                      style={inputStyle}
                    />
                  </label>
                  <button
                    type="button"
                    style={sectionButtonGhost}
                    onClick={() => void selectByGpa()}
                  >
                    Chọn theo GPA
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <main style={mainPanelStyle}>
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <button
                type="button"
                style={tabButtonStyle(activeTab === "all")}
                onClick={() => setActiveTab("all")}
              >
                Danh sách tất cả sinh viên
              </button>
              <button
                type="button"
                style={tabButtonStyle(activeTab === "assigned")}
                onClick={() => setActiveTab("assigned")}
              >
                Danh sách sinh viên đã có trong đợt
              </button>
            </div>

            <div style={{ ...panelCardStyle, overflow: "hidden" }}>
              <div
                style={{
                  padding: 14,
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>
                    {activeTab === "all"
                      ? "Danh sách nguồn sinh viên"
                      : "Danh sách sinh viên trong đợt"}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "#475569" }}>
                    {loading
                      ? "Đang tải dữ liệu..."
                      : `Tổng bản ghi: ${totalCount}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={sectionButtonGhost}
                    onClick={() => setPage(1)}
                  >
                    <Filter size={14} /> Tải lại
                  </button>
                </div>
              </div>

              {error ? (
                <div
                  style={{
                    padding: 14,
                    color: "#b91c1c",
                    background: "#fff1f2",
                    borderBottom: "1px solid #fecdd3",
                  }}
                >
                  {error}
                </div>
              ) : null}

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                      <th style={{ padding: 12, width: 42 }}>
                        <input
                          type="checkbox"
                          checked={isAllVisibleSelected}
                          onChange={() =>
                            isAllVisibleSelected
                              ? clearVisible()
                              : selectAllVisible()
                          }
                        />
                      </th>
                      <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Sinh viên</th>
                      <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Mã SV</th>
                      <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>User</th>
                      <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Lớp</th>
                      <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Khoa</th>
                      <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Bộ môn</th>
                      <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>GPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const checked = selectedIds.includes(
                        row.studentProfileID,
                      );
                      const imageUrl = row.studentImage
                        ? normalizeUrl(row.studentImage)
                        : "";
                      return (
                        <tr
                          key={toRowKey(row)}
                          style={{ borderTop: "1px solid #e2e8f0" }}
                        >
                          <td style={{ padding: 12, verticalAlign: "top" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelected(row)}
                            />
                          </td>
                          <td style={{ padding: 12, verticalAlign: "top" }}>
                            <div
                              style={{
                                display: "flex",
                                gap: 10,
                                alignItems: "center",
                              }}
                            >
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={row.fullName}
                                  style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: "50%",
                                    objectFit: "cover",
                                    border: "1px solid #e2e8f0",
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: "50%",
                                    background: "#fff7ed",
                                    color: "#f37021",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 800,
                                  }}
                                >
                                  {row.fullName
                                    ? row.fullName.slice(0, 1).toUpperCase()
                                    : "S"}
                                </div>
                              )}
                              <div>
                                <div
                                  style={{ fontWeight: 800, color: "#0f172a" }}
                                >
                                  {row.fullName || "--"}
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "#475569",
                                    marginTop: 3,
                                  }}
                                >
                                  {checked ? "Đã chọn" : "Chưa chọn"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13 }}>
                            {row.studentCode || "--"}
                          </td>
                          <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13 }}>
                            {row.userCode || "--"}
                          </td>
                          <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13 }}>
                            {row.classCode || "--"}
                          </td>
                          <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13 }}>
                            {row.facultyCode || "--"}
                          </td>
                          <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13 }}>
                            {row.departmentCode || "--"}
                          </td>
                          <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13 }}>
                            {row.gpa ?? "--"}
                          </td>
                        </tr>
                      );
                    })}
                    {!loading && visibleRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            padding: 24,
                            textAlign: "center",
                            color: "#64748b",
                          }}
                        >
                          Chưa có dữ liệu phù hợp.
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
            </div>
          </main>
        </div>

        <div
          style={{
            padding: 16,
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ color: "#475569", fontSize: 13 }}>
            Đã chọn <strong>{selectedCount}</strong> sinh viên.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={sectionButtonGhost} onClick={onClose}>
              Hủy
            </button>
            <button
              type="button"
              style={sectionButtonPrimary}
              onClick={() => void confirmSelection()}
              disabled={saving || selectedCount === 0}
            >
              <Check size={15} /> {saving ? "Đang lưu..." : "Xác nhận chọn"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DefenseTermStudentsPickerModal;
