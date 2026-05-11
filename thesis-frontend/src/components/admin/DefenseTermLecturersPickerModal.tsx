import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckSquare,
  Filter,
  Search,
  Square,
  Star,
  X,
} from "lucide-react";
import { normalizeUrl } from "../../api/fetchData";
import {
  listDefenseTermLecturers,
  listLecturerProfiles,
  type DefenseTermLecturerRecord,
  type LecturerProfileRecord,
} from "../../services/defense-term-membership.service";
import TablePagination from "../TablePagination/TablePagination";

const ROLE_OPTIONS = [
  { value: "Giảng viên hướng dẫn", label: "Giảng viên hướng dẫn" },
  { value: "Thư ký", label: "Thư ký" },
  { value: "Tham gia bảo vệ", label: "Tham gia bảo vệ" },
];

export type DefenseTermLecturerSelection = {
  lecturerProfileID: number;
  lecturerCode: string;
  userCode: string;
  fullName: string;
  departmentCode: string;
  degree: string;
  profileImage?: string;
  roles: string[];
  isPrimary: boolean;
  raw: Record<string, unknown>;
};

type LecturerTab = "all" | "assigned";

type LecturerPickerFilters = {
  search: string;
  departmentCode: string;
  degree: string;
  tagCodes: string;
  tags: string;
  lecturerCode: string;
  userCode: string;
  role: string;
  isPrimary: string;
};

type LecturerRow = DefenseTermLecturerSelection & {
  defenseTermLecturerID: number;
  defenseTermId: number;
};

interface DefenseTermLecturersPickerModalProps {
  isOpen: boolean;
  defenseTermId: number | null;
  title?: string;
  subtitle?: string;
  initialSelectedIds?: number[];
  initialSelections?: DefenseTermLecturerSelection[];
  onClose: () => void;
  onConfirm: (selected: DefenseTermLecturerSelection[]) => void | Promise<void>;
}

const initialFilters: LecturerPickerFilters = {
  search: "",
  departmentCode: "",
  degree: "",
  tagCodes: "",
  tags: "",
  lecturerCode: "",
  userCode: "",
  role: "",
  isPrimary: "",
};

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
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

function toLecturerSelection(
  record: LecturerProfileRecord,
): DefenseTermLecturerSelection {
  return {
    lecturerProfileID: Number(
      record.lecturerProfileID ??
        record.LecturerProfileID ??
        record.id ??
        record.Id ??
        0,
    ),
    lecturerCode: asString(record.lecturerCode ?? record.LecturerCode),
    userCode: asString(record.userCode ?? record.UserCode),
    fullName: asString(
      record.fullName ?? record.FullName ?? record.name ?? record.Name,
    ),
    departmentCode: asString(record.departmentCode ?? record.DepartmentCode),
    degree: asString(record.degree ?? record.Degree),
    profileImage: asString(record.profileImage ?? record.ProfileImage),
    roles: toRoleList(
      record.role ?? record.roles ?? record.Role ?? record.Roles,
    ),
    isPrimary: asBoolean(record.isPrimary ?? record.IsPrimary),
    raw: record,
  };
}

function toAssignedSelection(record: DefenseTermLecturerRecord): LecturerRow {
  const base = toLecturerSelection(record);
  return {
    ...base,
    roles: toRoleList(record.role ?? record.roles ?? base.roles),
    isPrimary: asBoolean(
      record.isPrimary ?? record.IsPrimary ?? base.isPrimary,
    ),
    defenseTermLecturerID: Number(
      record.defenseTermLecturerID ??
        record.DefenseTermLecturerID ??
        record.id ??
        record.Id ??
        0,
    ),
    defenseTermId: Number(record.defenseTermId ?? record.DefenseTermId ?? 0),
  };
}

function rowKey(row: DefenseTermLecturerSelection | LecturerRow): string {
  return String(
    row.lecturerProfileID || row.lecturerCode || row.userCode || "",
  );
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
  width: "min(1320px, 100%)",
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

const buttonBase: React.CSSProperties = {
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

const buttonPrimary: React.CSSProperties = {
  ...buttonBase,
  background: "#1e3a5f",
  color: "#ffffff",
  borderColor: "#1e3a5f",
};

const buttonGhost: React.CSSProperties = {
  ...buttonBase,
  background: "#ffffff",
};

const bodyStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 340px) minmax(0, 1fr)",
  minHeight: 0,
  flex: 1,
};

const sidePanelStyle: React.CSSProperties = {
  borderRight: "1px solid #e2e8f0",
  padding: 12,
  overflowY: "auto",
  background: "linear-gradient(180deg, #ffffff 0%, #fffaf5 100%)",
};

const mainPanelStyle: React.CSSProperties = {
  padding: 12,
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

const multiRoleWrap: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

function buildFilterSummary(filters: LecturerPickerFilters): string[] {
  const parts: string[] = [];
  if (filters.departmentCode)
    parts.push(`Khoa/Bộ môn: ${filters.departmentCode}`);
  if (filters.degree) parts.push(`Học vị: ${filters.degree}`);
  if (filters.tagCodes) parts.push(`Tag codes: ${filters.tagCodes}`);
  if (filters.tags) parts.push(`Tags: ${filters.tags}`);
  if (filters.role) parts.push(`Role: ${filters.role}`);
  if (filters.isPrimary) parts.push(`Primary: ${filters.isPrimary}`);
  return parts;
}

const DefenseTermLecturersPickerModal: React.FC<
  DefenseTermLecturersPickerModalProps
> = ({
  isOpen,
  defenseTermId,
  title = "Chọn giảng viên",
  subtitle = "Chọn nhiều giảng viên, cấu hình role cho từng giảng viên và lưu vào đợt bảo vệ.",
  initialSelectedIds = [],
  initialSelections = [],
  onClose,
  onConfirm,
}) => {
  const [activeTab, setActiveTab] = useState<LecturerTab>("all");
  const [filters, setFilters] = useState<LecturerPickerFilters>(initialFilters);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [rows, setRows] = useState<
    Array<DefenseTermLecturerSelection | LecturerRow>
  >([]);
  const [assignedRows, setAssignedRows] = useState<LecturerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSelectedIds);
  const [selectedCache, setSelectedCache] = useState<
    Record<number, DefenseTermLecturerSelection | LecturerRow>
  >({});
  const [roleDrafts, setRoleDrafts] = useState<Record<number, string[]>>({});
  const [primaryDrafts, setPrimaryDrafts] = useState<Record<number, boolean>>(
    {},
  );

  useEffect(() => {
    if (!isOpen) return;

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
      initialSelections.reduce<Record<number, DefenseTermLecturerSelection>>(
        (acc, item) => {
          acc[item.lecturerProfileID] = item;
          return acc;
        },
        {},
      ),
    );
    setRoleDrafts(
      initialSelections.reduce<Record<number, string[]>>((acc, item) => {
        acc[item.lecturerProfileID] = item.roles;
        return acc;
      }, {}),
    );
    setPrimaryDrafts(
      initialSelections.reduce<Record<number, boolean>>((acc, item) => {
        acc[item.lecturerProfileID] = item.isPrimary;
        return acc;
      }, {}),
    );
  }, [initialSelectedIds, initialSelections, isOpen]);

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
        setError("Vui lòng chọn một đợt bảo vệ trước khi thêm giảng viên.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (activeTab === "all") {
          const response = await listLecturerProfiles({
            search: filters.search,
            departmentCode: filters.departmentCode,
            degree: filters.degree,
            tagCodes: filters.tagCodes,
            tags: filters.tags,
            lecturerCode: filters.lecturerCode,
            userCode: filters.userCode,
            page,
            pageSize,
          });

          if (cancelled) return;

          const normalized = response.data.map(toLecturerSelection);
          setRows(normalized);
          setTotalCount(response.totalCount);
          setSelectedCache((prev) => {
            const next = { ...prev };
            normalized.forEach((item) => {
              next[item.lecturerProfileID] = item;
            });
            return next;
          });
        } else {
          const response = await listDefenseTermLecturers({
            defenseTermId,
            search: filters.search,
            lecturerCode: filters.lecturerCode,
            userCode: filters.userCode,
            role: filters.role,
            isPrimary: filters.isPrimary
              ? filters.isPrimary.toLowerCase() === "true"
              : undefined,
            page,
            pageSize,
            sortBy: "lecturerCode",
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
              next[item.lecturerProfileID] = item;
            });
            return next;
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Không thể tải dữ liệu giảng viên.",
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
    () =>
      visibleRows.map((row) => row.lecturerProfileID).filter((id) => id > 0),
    [visibleRows],
  );
  const selectedCount = selectedIds.length;

  const getSelectedRoles = (lecturerProfileID: number): string[] => {
    const cached = roleDrafts[lecturerProfileID];
    if (cached && cached.length > 0) {
      return cached;
    }
    const row = selectedCache[lecturerProfileID];
    if (!row) return [];
    return row.roles;
  };

  const isPrimary = (lecturerProfileID: number): boolean => {
    if (primaryDrafts[lecturerProfileID] !== undefined) {
      return primaryDrafts[lecturerProfileID];
    }
    const row = selectedCache[lecturerProfileID];
    return row ? row.isPrimary : false;
  };

  const toggleSelected = (row: DefenseTermLecturerSelection | LecturerRow) => {
    const id = row.lecturerProfileID;
    if (!id) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
    setSelectedCache((prev) => ({ ...prev, [id]: row }));
    setRoleDrafts((prev) => ({
      ...prev,
      [id]:
        prev[id] && prev[id].length > 0
          ? prev[id]
          : row.roles.length > 0
            ? row.roles
            : [ROLE_OPTIONS[0].value],
    }));
    setPrimaryDrafts((prev) => ({
      ...prev,
      [id]: prev[id] ?? row.isPrimary,
    }));
  };

  const toggleRole = (
    row: DefenseTermLecturerSelection | LecturerRow,
    role: string,
  ) => {
    const lecturerProfileID = row.lecturerProfileID;
    if (!lecturerProfileID) return;

    setSelectedIds((prev) =>
      prev.includes(lecturerProfileID) ? prev : [...prev, lecturerProfileID],
    );
    setSelectedCache((prev) => ({
      ...prev,
      [lecturerProfileID]: row,
    }));
    setRoleDrafts((prev) => {
      const current = prev[lecturerProfileID] ?? row.roles;
      const next = current.includes(role)
        ? current.filter((item) => item !== role)
        : [...current, role];
      if (next.length === 0) {
        setSelectedIds((prevIds) =>
          prevIds.filter((id) => id !== lecturerProfileID),
        );
        const nextDrafts = { ...prev };
        delete nextDrafts[lecturerProfileID];
        return nextDrafts;
      }
      return { ...prev, [lecturerProfileID]: next };
    });
  };

  const togglePrimary = (row: DefenseTermLecturerSelection | LecturerRow) => {
    const lecturerProfileID = row.lecturerProfileID;
    if (!lecturerProfileID) return;

    setSelectedIds((prev) =>
      prev.includes(lecturerProfileID) ? prev : [...prev, lecturerProfileID],
    );
    setSelectedCache((prev) => ({
      ...prev,
      [lecturerProfileID]: row,
    }));
    setPrimaryDrafts((prev) => ({
      ...prev,
      [lecturerProfileID]: !isPrimary(lecturerProfileID),
    }));
  };

  const selectAllVisible = () => {
    const nextIds = new Set(selectedIds);
    visibleRows.forEach((row) => {
      if (row.lecturerProfileID > 0) {
        nextIds.add(row.lecturerProfileID);
        setSelectedCache((prev) => ({ ...prev, [row.lecturerProfileID]: row }));
        setRoleDrafts((prev) => ({
          ...prev,
          [row.lecturerProfileID]:
            prev[row.lecturerProfileID] &&
            prev[row.lecturerProfileID].length > 0
              ? prev[row.lecturerProfileID]
              : row.roles.length > 0
                ? row.roles
                : [ROLE_OPTIONS[0].value],
        }));
        setPrimaryDrafts((prev) => ({
          ...prev,
          [row.lecturerProfileID]: prev[row.lecturerProfileID] ?? row.isPrimary,
        }));
      }
    });
    setSelectedIds(Array.from(nextIds));
  };

  const clearVisible = () => {
    const nextIds = new Set(selectedIds);
    visibleRows.forEach((row) => nextIds.delete(row.lecturerProfileID));
    setSelectedIds(Array.from(nextIds));
  };

  const confirmSelection = async () => {
    const payload = selectedIds
      .map((id) => selectedCache[id])
      .filter(Boolean)
      .map((row) => ({
        lecturerProfileID: row.lecturerProfileID,
        lecturerCode: row.lecturerCode,
        userCode: row.userCode,
        fullName: row.fullName,
        departmentCode: row.departmentCode,
        degree: row.degree,
        profileImage: row.profileImage,
        roles: getSelectedRoles(row.lecturerProfileID),
        isPrimary: isPrimary(row.lecturerProfileID),
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
              Đã chọn <strong>{selectedCount}</strong> giảng viên
            </div>
          </div>
          <button
            type="button"
            style={buttonGhost}
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
                    padding: 14,
                    borderBottom: "1px solid #e2e8f0",
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  Bộ lọc nguồn
                </div>
                <div style={{ padding: 14, display: "grid", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>
                      Tìm kiếm
                    </span>
                    <div style={{ position: "relative" }}>
                      <Search
                        size={15}
                        style={{
                          position: "absolute",
                          left: 12,
                          top: 11,
                          color: "#f37021",
                        }}
                      />
                      <input
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Tên, mã GV, mã user"
                        style={{ ...inputStyle, paddingLeft: 36 }}
                      />
                    </div>
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>
                      Khoa/Bộ môn
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

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>
                      Học vị
                    </span>
                    <input
                      value={filters.degree}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          degree: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>
                      Tag codes
                    </span>
                    <input
                      value={filters.tagCodes}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          tagCodes: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>Tags</span>
                    <input
                      value={filters.tags}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          tags: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>Mã GV</span>
                    <input
                      value={filters.lecturerCode}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          lecturerCode: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>
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

                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      gridTemplateColumns: "1fr 1fr",
                    }}
                  >
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>
                        Role
                      </span>
                      <input
                        value={filters.role}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            role: event.target.value,
                          }))
                        }
                        placeholder="Role"
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>
                        Chính
                      </span>
                      <select
                        value={filters.isPrimary}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            isPrimary: event.target.value,
                          }))
                        }
                        style={inputStyle}
                      >
                        <option value="">Tất cả</option>
                        <option value="true">Có</option>
                        <option value="false">Không</option>
                      </select>
                    </label>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      style={buttonPrimary}
                      onClick={() => setPage(1)}
                    >
                      <Filter size={15} /> Áp dụng lọc
                    </button>
                    <button
                      type="button"
                      style={buttonGhost}
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
                    padding: 14,
                    borderBottom: "1px solid #e2e8f0",
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  Chọn nhanh
                </div>
                <div style={{ padding: 14, display: "grid", gap: 10 }}>
                  <button
                    type="button"
                    style={buttonPrimary}
                    onClick={selectAllVisible}
                  >
                    <CheckSquare size={15} /> Chọn tất cả đang lọc
                  </button>
                  <button
                    type="button"
                    style={buttonGhost}
                    onClick={clearVisible}
                  >
                    <Square size={15} /> Bỏ chọn đang lọc
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
                Danh sách tất cả giảng viên
              </button>
              <button
                type="button"
                style={tabButtonStyle(activeTab === "assigned")}
                onClick={() => setActiveTab("assigned")}
              >
                Danh sách giảng viên đã có trong đợt
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
                      ? "Danh sách nguồn giảng viên"
                      : "Danh sách giảng viên trong đợt"}
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
                    style={buttonGhost}
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
                      <th style={{ padding: 12 }}>Giảng viên</th>
                      <th style={{ padding: 12 }}>Mã GV</th>
                      <th style={{ padding: 12 }}>User</th>
                      <th style={{ padding: 12 }}>Khoa/Bộ môn</th>
                      <th style={{ padding: 12 }}>Học vị</th>
                      <th style={{ padding: 12 }}>Roles</th>
                      <th style={{ padding: 12 }}>Chính</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const checked = selectedIds.includes(
                        row.lecturerProfileID,
                      );
                      const imageUrl = row.profileImage
                        ? normalizeUrl(row.profileImage)
                        : "";
                      const roles = getSelectedRoles(row.lecturerProfileID);
                      const primary = isPrimary(row.lecturerProfileID);
                      return (
                        <tr
                          key={rowKey(row)}
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
                                    background: "#ecfeff",
                                    color: "#0f766e",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 800,
                                  }}
                                >
                                  {row.fullName
                                    ? row.fullName.slice(0, 1).toUpperCase()
                                    : "G"}
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
                          <td style={{ padding: 12, verticalAlign: "top" }}>
                            {row.lecturerCode || "--"}
                          </td>
                          <td style={{ padding: 12, verticalAlign: "top" }}>
                            {row.userCode || "--"}
                          </td>
                          <td style={{ padding: 12, verticalAlign: "top" }}>
                            {row.departmentCode || "--"}
                          </td>
                          <td style={{ padding: 12, verticalAlign: "top" }}>
                            {row.degree || "--"}
                          </td>
                          <td style={{ padding: 12, verticalAlign: "top" }}>
                            <div style={multiRoleWrap}>
                              {ROLE_OPTIONS.map((role) => {
                                const roleChecked = roles.includes(role.value);
                                return (
                                  <label
                                    key={role.value}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 8,
                                      fontSize: 12,
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={roleChecked}
                                      onChange={() =>
                                        toggleRole(row, role.value)
                                      }
                                    />
                                    {role.label}
                                  </label>
                                );
                              })}
                            </div>
                          </td>
                          <td style={{ padding: 12, verticalAlign: "top" }}>
                            <label
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 12,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={primary}
                                onChange={() => togglePrimary(row)}
                              />
                              <Star size={14} />
                            </label>
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
                  totalLabel="Tổng giảng viên:"
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
            Đã chọn <strong>{selectedCount}</strong> giảng viên.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={buttonGhost} onClick={onClose}>
              Hủy
            </button>
            <button
              type="button"
              style={buttonPrimary}
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

export default DefenseTermLecturersPickerModal;
