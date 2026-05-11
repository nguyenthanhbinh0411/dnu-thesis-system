import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Edit,
  Eye,
  Filter,
  Plus,
  Search,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { fetchData, getAvatarUrl } from "../../api/fetchData";
import ImportExportActions from "../../components/admin/ImportExportActions.tsx";
import ManagementSectionedFormBody from "../../components/admin/ManagementSectionedFormBody";
import TablePagination from "../../components/TablePagination/TablePagination";
import { useToast } from "../../context/useToast";
import type { ApiResponse } from "../../types/api";
import "./LecturerProfilesManagement.css";

type RecordData = Record<string, unknown>;
type FieldType = "text" | "number" | "date" | "textarea";

interface FieldDef {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
}

type LecturerDetailTab = "info" | "students" | "topics";

type DashboardStudent = {
  studentProfileID: number;
  studentCode: string;
  userCode: string;
  fullName: string;
  studentEmail: string;
  phoneNumber: string;
  departmentCode: string;
  classCode: string;
  facultyCode: string;
  studentImage?: string;
  gpa?: number;
  academicStanding?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  enrollmentYear?: number;
  graduationYear?: number | null;
  status?: string;
  notes?: string | null;
  createdAt?: string;
  lastUpdated?: string;
};

type DashboardTopic = {
  topicID: number;
  topicCode: string;
  title: string;
  summary: string;
  type?: string;
  status: string;
  catalogTopicCode?: string | null;
  supervisorLecturerCode?: string;
  createdAt?: string;
  lastUpdated?: string;
};

type DashboardTag = {
  tagCode: string;
  tagName: string;
};

type DashboardMilestone = {
  milestoneID: number;
  milestoneCode: string;
  topicCode: string;
  milestoneTemplateCode: string;
  ordinal?: number;
  deadline?: string | null;
  state?: string;
  startedAt?: string | null;
  completedAt1?: string | null;
  completedAt2?: string | null;
  completedAt3?: string | null;
  completedAt4?: string | null;
  completedAt5?: string | null;
};

type DashboardSupervisor = {
  lecturerProfileID: number;
  lecturerCode: string;
  fullName: string;
  degree?: string;
  email?: string;
  phoneNumber?: string;
  departmentCode?: string;
  guideQuota?: number;
  currentGuidingCount?: number;
};

type LecturerDashboardItem = {
  student: DashboardStudent;
  topic: DashboardTopic;
  topicTags: DashboardTag[];
  currentMilestone: DashboardMilestone | null;
  supervisor: DashboardSupervisor | null;
  supervisorTags?: DashboardTag[];
  canSubmit?: boolean;
  blockReason?: string | null;
};

const fields: FieldDef[] = [
  { name: "lecturerCode", label: "lecturerCode" },
  { name: "userCode", label: "userCode", required: true },
  { name: "departmentCode", label: "departmentCode" },
  { name: "fullName", label: "fullName" },
  { name: "email", label: "email" },
  { name: "phoneNumber", label: "phoneNumber" },
  { name: "degree", label: "degree" },
  { name: "guideQuota", label: "guideQuota", type: "number" },
  { name: "defenseQuota", label: "defenseQuota", type: "number" },
  { name: "currentGuidingCount", label: "currentGuidingCount", type: "number" },
  { name: "profileImage", label: "profileImage" },
  { name: "gender", label: "gender" },
  { name: "dateOfBirth", label: "dateOfBirth", type: "date" },
  { name: "address", label: "address" },
  { name: "notes", label: "notes", type: "textarea" },
];

const filterFields: FieldDef[] = [
  { name: "lecturerCode", label: "Mã giảng viên" },
  { name: "userCode", label: "Mã user" },
  { name: "departmentCode", label: "Khoa/Bộ môn" },
  { name: "degree", label: "Học vị" },
  { name: "guideQuota", label: "Chỉ tiêu hướng dẫn", type: "number" },
  { name: "gender", label: "Giới tính" },
];

const tableColumns = [
  { key: "departmentCode", label: "KHOA" },
  { key: "degree", label: "HỌC VỊ" },
  { key: "defenseQuota", label: "BẢO VỆ" },
  { key: "currentGuidingCount", label: "ĐANG HƯỚNG DẪN" },
] as const;

const editFieldSections: Array<{
  title: string;
  description: string;
  fields: string[];
}> = [
  {
    title: "Thông tin tài khoản",
    description: "Thông tin định danh và liên kết tài khoản.",
    fields: ["lecturerCode", "userCode", "departmentCode"],
  },
  {
    title: "Thông tin liên hệ",
    description: "Thông tin cơ bản và kênh liên lạc.",
    fields: ["fullName", "email", "phoneNumber", "gender", "dateOfBirth"],
  },
  {
    title: "Thông tin chuyên môn",
    description: "Học vị và chỉ tiêu giảng dạy.",
    fields: ["degree", "guideQuota", "defenseQuota", "currentGuidingCount"],
  },
  {
    title: "Thông tin bổ sung",
    description: "Ảnh đại diện, địa chỉ và ghi chú.",
    fields: ["profileImage", "address", "notes"],
  },
];

function getFieldDefinition(name: string): FieldDef {
  return (
    fields.find((field) => field.name === name) ?? {
      name,
      label: name,
      type: "text",
    }
  );
}

function toDisplay(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatDateForInput(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toISOString().slice(0, 10);
}

function toFormRecord(data: RecordData): Record<string, string> {
  return fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.name] =
      field.type === "date"
        ? formatDateForInput(data[field.name])
        : toDisplay(data[field.name]);
    return acc;
  }, {});
}

function toPayload(formValues: Record<string, string>): RecordData {
  return fields.reduce<RecordData>((acc, field) => {
    const raw = (formValues[field.name] ?? "").trim();
    if (!raw) {
      acc[field.name] = field.type === "number" ? null : "";
      return acc;
    }
    if (field.type === "number") {
      const parsed = Number(raw);
      acc[field.name] = Number.isFinite(parsed) ? parsed : raw;
      return acc;
    }
    acc[field.name] = raw;
    return acc;
  }, {});
}

function buildQuery(input: Record<string, unknown>): string {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    params.append(key, normalized);
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

async function requestApiData<T>(
  path: string,
  options?: Parameters<typeof fetchData>[1],
  fallback = "Không thể tải dữ liệu.",
): Promise<{ data: T; totalCount: number }> {
  const response = await fetchData<ApiResponse<T>>(path, options);
  if (!response?.success) {
    throw new Error(response.message || response.title || fallback);
  }
  return {
    data: response.data as T,
    totalCount: Number(response.totalCount || 0),
  };
}

function normalizeList(payload: unknown): {
  items: RecordData[];
  fallbackTotal: number;
} {
  if (Array.isArray(payload)) {
    return { items: payload as RecordData[], fallbackTotal: payload.length };
  }
  if (payload && typeof payload === "object") {
    const source = payload as Record<string, unknown>;
    const nested = [
      source.items,
      source.records,
      source.result,
      source.data,
      source.list,
    ];
    const arr = nested.find((candidate) => Array.isArray(candidate));
    if (Array.isArray(arr)) {
      return {
        items: arr as RecordData[],
        fallbackTotal: Number(
          source.totalCount ?? source.total ?? source.count ?? arr.length,
        ),
      };
    }
  }
  return { items: [], fallbackTotal: 0 };
}

function getDisplayName(row: RecordData): string {
  return String(row.fullName || row.lecturerName || row.name || "--");
}

function getDisplayCode(row: RecordData): string {
  return String(row.lecturerCode || row.code || "--");
}

function getGuidingProgress(row: RecordData): {
  current: number;
  quota: number;
  ratio: number;
} {
  const current = Number(row.currentGuidingCount ?? 0);
  const quota = Number(row.guideQuota ?? 0);
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safeQuota = Number.isFinite(quota) ? quota : 0;
  return {
    current: safeCurrent,
    quota: safeQuota,
    ratio:
      safeQuota > 0
        ? Math.max(
            0,
            Math.min(100, Math.round((safeCurrent / safeQuota) * 100)),
          )
        : 0,
  };
}

function formatDate(value?: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("vi-VN");
}

function formatDateTime(value?: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN");
}

function getStatusText(status?: string): string {
  const normalized = (status || "").toLowerCase();
  if (normalized.includes("đã duyệt")) return "Đã duyệt";
  if (normalized.includes("chờ")) return "Chờ duyệt";
  if (normalized.includes("từ chối")) return "Từ chối";
  if (normalized.includes("cần sửa")) return "Cần sửa đổi";
  if (normalized.includes("đang thực hiện")) return "Đang thực hiện";
  return status || "--";
}

function getMilestoneLabel(code: string): string {
  const map: Record<string, string> = {
    MS_REG: "Đăng ký đề tài",
    MS_PROG1: "Tiến độ 1",
    MS_PROG2: "Tiến độ 2",
    MS_FULL: "Nộp full",
    MS_DEF: "Bảo vệ",
  };
  return map[code] || code;
}

function calcProgress(
  currentMilestone: DashboardMilestone | null,
  totalMilestones = 5,
): number {
  if (!currentMilestone || !totalMilestones) return 0;
  const ordinal = Number(currentMilestone.ordinal || 0);
  if (!Number.isFinite(ordinal) || ordinal <= 1) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round(((ordinal - 1) / totalMilestones) * 100)),
  );
}

function normalizeDashboardItems(payload: unknown): LecturerDashboardItem[] {
  const normalized = normalizeList(payload);
  return normalized.items.filter((item): item is LecturerDashboardItem => {
    if (!item || typeof item !== "object") return false;
    const source = item as Partial<LecturerDashboardItem>;
    return Boolean(source.student && source.topic);
  });
}

function getStudentName(item: LecturerDashboardItem): string {
  return String(item.student?.fullName || item.student?.studentCode || "--");
}

function getStudentCode(item: LecturerDashboardItem): string {
  return String(item.student?.studentCode || "--");
}

function getTopicTitle(item: LecturerDashboardItem): string {
  return String(item.topic?.title || item.topic?.topicCode || "--");
}

function getTopicCode(item: LecturerDashboardItem): string {
  return String(item.topic?.topicCode || "--");
}

function getTopicTypeLabel(type?: string): string {
  if (!type) return "--";
  const normalized = type.toUpperCase();
  if (normalized === "CATALOG") return "Đề tài catalog";
  if (normalized === "SELF") return "Đề tài tự chọn";
  return type;
}

const LecturerProfilesManagement: React.FC = () => {
  const { addToast } = useToast();
  const [rows, setRows] = useState<RecordData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState<
    "detail" | "create" | "edit" | null
  >(null);
  const [selectedRow, setSelectedRow] = useState<RecordData | null>(null);
  const [detailTab, setDetailTab] = useState<LecturerDetailTab>("info");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailItems, setDetailItems] = useState<LecturerDashboardItem[]>([]);
  const [detailTotalCount, setDetailTotalCount] = useState(0);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<
    Record<string, string>
  >(() =>
    filterFields.reduce<Record<string, string>>((acc, field) => {
      acc[field.name] = "";
      return acc;
    }, {}),
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchKeyword(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const listQuery = useMemo(
    () => ({
      page,
      pageSize,
      search: searchKeyword,
      ...advancedFilters,
    }),
    [advancedFilters, page, pageSize, searchKeyword],
  );

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = buildQuery(listQuery);
      const { data, totalCount: apiTotal } = await requestApiData<unknown>(
        `/LecturerProfiles/get-list${query}`,
        { method: "GET" },
        "Không thể tải danh sách giảng viên.",
      );
      const normalized = normalizeList(data);
      setRows(normalized.items);
      setTotalCount(apiTotal > 0 ? apiTotal : normalized.fallbackTotal);
    } catch (error) {
      addToast(
        error instanceof Error
          ? error.message
          : "Không thể tải danh sách giảng viên.",
        "error",
      );
      setRows([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [addToast, listQuery]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize))),
    [pageSize, totalCount],
  );

  const detailLecturerName = String(
    selectedRow?.fullName || selectedRow?.lecturerName || "--",
  );
  const detailLecturerCode = String(
    selectedRow?.lecturerCode || selectedRow?.code || "--",
  );
  const detailDepartmentCode = String(
    selectedRow?.departmentCode || selectedRow?.department || "--",
  );
  const detailStudents = useMemo(() => {
    const seen = new Set<string>();
    return detailItems.filter((item) => {
      const key = getStudentCode(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [detailItems]);
  const detailTopics = useMemo(() => {
    const seen = new Set<string>();
    return detailItems.filter((item) => {
      const key = getTopicCode(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [detailItems]);

  const lecturerTableColSpan = tableColumns.length + 3;

  const openCreate = async () => {
    try {
      const { data } = await requestApiData<RecordData>(
        "/LecturerProfiles/get-create",
        { method: "GET" },
        "Không thể tải mẫu tạo mới.",
      );
      setFormValues(toFormRecord(data || {}));
    } catch {
      setFormValues(toFormRecord({}));
    }
    setSelectedRow(null);
    setActiveModal("create");
  };

  const openEdit = async (row: RecordData) => {
    const code = String(row.lecturerCode ?? "").trim();
    if (!code) {
      addToast("Không xác định được lecturerCode để cập nhật.", "error");
      return;
    }
    try {
      const { data } = await requestApiData<RecordData>(
        `/LecturerProfiles/get-update/${encodeURIComponent(code)}`,
        { method: "GET" },
        "Không thể tải dữ liệu cập nhật.",
      );
      const mergedRow = {
        ...row,
        ...(data || {}),
      };
      mergedRow.lecturerCode =
        mergedRow.lecturerCode || row.lecturerCode || code;
      mergedRow.userCode = mergedRow.userCode || row.userCode || "";
      mergedRow.dateOfBirth = mergedRow.dateOfBirth || row.dateOfBirth || "";
      setFormValues(toFormRecord(mergedRow));
      setSelectedRow(row);
      setActiveModal("edit");
    } catch (error) {
      addToast(
        error instanceof Error
          ? error.message
          : "Không thể tải dữ liệu cập nhật.",
        "error",
      );
    }
  };

  const openDetail = async (row: RecordData) => {
    const code = String(row.lecturerCode ?? "").trim();
    if (!code) {
      setSelectedRow(row);
      setActiveModal("detail");
      return;
    }

    setDetailTab("info");
    setDetailLoading(true);
    setDetailItems([]);
    setDetailTotalCount(0);
    setSelectedRow(row);
    setActiveModal("detail");

    try {
      const [detailResponse, dashboardResponse] = await Promise.all([
        requestApiData<RecordData>(
          `/LecturerProfiles/get-detail/${encodeURIComponent(code)}`,
          { method: "GET" },
          "Không thể tải chi tiết giảng viên.",
        ),
        requestApiData<unknown>(
          `/reports/student/dashboard/get-list?Page=0&PageSize=10&SupervisorLecturerCode=${encodeURIComponent(code)}`,
          { method: "GET" },
          "Không thể tải danh sách sinh viên.",
        ),
      ]);

      setSelectedRow(detailResponse.data || row);
      const dashboardItems = normalizeDashboardItems(dashboardResponse.data);
      setDetailItems(dashboardItems);
      setDetailTotalCount(
        dashboardResponse.totalCount || dashboardItems.length,
      );
    } catch {
      try {
        const { data } = await requestApiData<RecordData>(
          `/LecturerProfiles/get-detail/${encodeURIComponent(code)}`,
          { method: "GET" },
          "Không thể tải chi tiết giảng viên.",
        );
        setSelectedRow(data);
      } catch {
        setSelectedRow(row);
      }
      try {
        const dashboardResponse = await requestApiData<unknown>(
          `/reports/student/dashboard/get-list?Page=0&PageSize=10&SupervisorLecturerCode=${encodeURIComponent(code)}`,
          { method: "GET" },
          "Không thể tải danh sách sinh viên.",
        );
        const dashboardItems = normalizeDashboardItems(dashboardResponse.data);
        setDetailItems(dashboardItems);
        setDetailTotalCount(
          dashboardResponse.totalCount || dashboardItems.length,
        );
      } catch {
        setDetailItems([]);
        setDetailTotalCount(0);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (row: RecordData) => {
    const code = String(row.lecturerCode ?? "").trim();
    if (!code) {
      addToast("Không xác định được lecturerCode để xóa.", "error");
      return;
    }
    if (!window.confirm("Bạn chắc chắn muốn xóa bản ghi này?")) return;

    try {
      await requestApiData<unknown>(
        `/LecturerProfiles/delete/${encodeURIComponent(code)}`,
        { method: "DELETE" },
        "Không thể xóa bản ghi.",
      );
      addToast("Xóa dữ liệu thành công.", "success");
      await loadRows();
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Không thể xóa bản ghi.",
        "error",
      );
    }
  };

  const handleSubmit = async () => {
    const payload = toPayload(formValues);
    const required = fields.find((field) => {
      if (!field.required) return false;
      const value = payload[field.name];
      return (
        value === null || value === undefined || String(value).trim() === ""
      );
    });
    if (required) {
      addToast(`Trường ${required.label} là bắt buộc.`, "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeModal === "create") {
        await requestApiData<RecordData>(
          "/LecturerProfiles/create",
          { method: "POST", body: payload },
          "Không thể tạo bản ghi.",
        );
        addToast("Tạo mới thành công.", "success");
      }

      if (activeModal === "edit" && selectedRow) {
        const code = String(selectedRow.lecturerCode ?? "").trim();
        await requestApiData<RecordData>(
          `/LecturerProfiles/update/${encodeURIComponent(code)}`,
          { method: "PUT", body: payload },
          "Không thể cập nhật bản ghi.",
        );
        addToast("Cập nhật thành công.", "success");
      }

      setActiveModal(null);
      await loadRows();
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Không thể lưu dữ liệu.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearchKeyword("");
    setAdvancedFilters(
      filterFields.reduce<Record<string, string>>((acc, field) => {
        acc[field.name] = "";
        return acc;
      }, {}),
    );
    setPage(1);
  };

  return (
    <div className="lecturer-profiles-module">
      <div className="dashboard-header">
        <h1>
          <Users size={30} color="#F37021" /> Quản lý giảng viên
        </h1>
        <p>
          Dữ liệu chuẩn theo schema LecturerProfiles (email, guideQuota,
          defenseQuota, currentGuidingCount...).
        </p>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          padding: 16,
          marginBottom: 20,
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flex: "1 1 300px",
            }}
          >
            <Search size={16} color="#64748b" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tìm kiếm nhanh..."
              style={{
                width: "100%",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "9px 12px",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              style={{
                border: "1px solid #cbd5e1",
                background: "#fff",
                borderRadius: 8,
                padding: "8px 12px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <Filter size={16} />{" "}
              {showAdvancedFilters ? "Ẩn lọc" : "Lọc nâng cao"}
            </button>
            <ImportExportActions
              moduleName="lecturers"
              moduleLabel="Quản lý giảng viên"
              onImportSuccess={loadRows}
            />
            <button
              type="button"
              onClick={openCreate}
              style={{
                border: "none",
                background: "#f37021",
                color: "#fff",
                borderRadius: 8,
                padding: "9px 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Plus size={16} /> Thêm mới
            </button>
          </div>
        </div>

        {showAdvancedFilters && (
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 12,
              display: "grid",
              gap: 10,
              background: "#f8fafc",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                gap: 10,
              }}
            >
              {filterFields.map((field) => (
                <label key={field.name} style={{ display: "grid", gap: 6 }}>
                  <span
                    style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}
                  >
                    {field.label}
                  </span>
                  <input
                    type={
                      field.type === "number"
                        ? "number"
                        : field.type === "date"
                          ? "date"
                          : "text"
                    }
                    value={advancedFilters[field.name] ?? ""}
                    onChange={(event) => {
                      const next = event.target.value;
                      setAdvancedFilters((prev) => ({
                        ...prev,
                        [field.name]: next,
                      }));
                      setPage(1);
                    }}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      padding: "8px 10px",
                      background: "#fff",
                    }}
                  />
                </label>
              ))}
            </div>

            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
            >
              <button
                type="button"
                onClick={resetFilters}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="lecturer-table-wrap">
        <table className="lecturer-table">
          <thead>
            <tr>
              <th>GIẢNG VIÊN</th>
              <th>LIÊN HỆ</th>
              {tableColumns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              <th style={{ textAlign: "center" }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={lecturerTableColSpan}>Đang tải dữ liệu...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={lecturerTableColSpan}>Không có dữ liệu.</td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={`lecturers-${index}-${String(row.lecturerCode ?? "")}`}
                  className="lecturer-row"
                >
                  <td>
                    <div className="lecturer-cell">
                      <div className="lecturer-avatar-wrap">
                        {row.profileImage ? (
                          <img
                            src={getAvatarUrl(String(row.profileImage))}
                            alt={getDisplayName(row)}
                            className="lecturer-avatar"
                            loading="lazy"
                          />
                        ) : (
                          <div className="lecturer-avatar lecturer-avatar-fallback">
                            {getDisplayName(row).trim().charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="lecturer-name">
                          {getDisplayName(row)}
                        </div>
                        <div className="lecturer-code">
                          {getDisplayCode(row)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="lecturer-contact-cell">
                      <div className="lecturer-contact-email">
                        {toDisplay(row.email) || "--"}
                      </div>
                      <div className="lecturer-contact-phone">
                        {toDisplay(row.phoneNumber) || "--"}
                      </div>
                    </div>
                  </td>
                  {tableColumns.map((column) => {
                    if (column.key === "currentGuidingCount") {
                      const { current, quota, ratio } = getGuidingProgress(row);
                      return (
                        <td key={`${column.key}-${index}`}>
                          <div className="lecturer-progress-cell">
                            <div className="lecturer-progress-track">
                              <div
                                className="lecturer-progress-fill"
                                style={{ width: `${ratio}%` }}
                              />
                            </div>
                            <strong>
                              {current}/{quota || "--"}
                            </strong>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={`${column.key}-${index}`}>
                        <div
                          className={
                            column.key === "degree"
                              ? "lecturer-table-degree"
                              : "lecturer-muted"
                          }
                        >
                          {toDisplay(row[column.key]) || "--"}
                        </div>
                      </td>
                    );
                  })}
                  <td>
                    <div className="lecturer-action-buttons">
                      <button
                        type="button"
                        className="lecturer-detail-btn"
                        onClick={() => void openDetail(row)}
                        title="Chi tiết"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        className="lecturer-edit-btn"
                        onClick={() => void openEdit(row)}
                        title="Cập nhật"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        className="lecturer-delete-btn"
                        onClick={() => void handleDelete(row)}
                        title="Xóa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        totalCount={totalCount}
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        isLoading={isLoading}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
      />

      {activeModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 80,
            padding: 14,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 860,
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
            }}
          >
            {activeModal !== "detail" && (
              <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0" }}>
                <h3 style={{ margin: 0, color: "#0f172a" }}>
                  {activeModal === "create" && "Tạo hồ sơ giảng viên"}
                  {activeModal === "edit" && "Cập nhật hồ sơ giảng viên"}
                </h3>
              </div>
            )}

            {activeModal === "detail" ? (
              <div className="lecturer-detail-shell">
                <div className="lecturer-detail-header">
                  <div className="lecturer-detail-header-left">
                    {selectedRow?.profileImage ? (
                      <img
                        src={getAvatarUrl(String(selectedRow.profileImage))}
                        alt={detailLecturerName}
                        className="lecturer-avatar-lg"
                      />
                    ) : (
                      <div className="lecturer-avatar-lg lecturer-avatar-lg-fallback">
                        {detailLecturerName.trim().charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="lecturer-detail-header-text">
                      <h4>{detailLecturerName}</h4>
                      <p>
                        {detailLecturerCode}
                        {selectedRow?.degree
                          ? ` • ${String(selectedRow.degree)}`
                          : ""}
                      </p>
                      <div className="lecturer-detail-subline">
                        <span className="lecturer-detail-chip">
                          {detailDepartmentCode}
                        </span>
                        <span className="lecturer-detail-gpa">
                          Hướng dẫn{" "}
                          {String(selectedRow?.currentGuidingCount ?? "--")}/
                          {String(selectedRow?.guideQuota ?? "--")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="lecturer-detail-header-actions">
                    <button
                      type="button"
                      className="lecturer-edit-btn"
                      onClick={() => {
                        if (selectedRow) {
                          void openEdit(selectedRow);
                        }
                        setActiveModal(null);
                      }}
                    >
                      <Edit size={13} />
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="lecturer-delete-btn"
                      onClick={() => setActiveModal(null)}
                    >
                      Đóng
                    </button>
                  </div>
                </div>

                <div className="lecturer-detail-tabs">
                  <button
                    type="button"
                    className={detailTab === "info" ? "is-active" : ""}
                    onClick={() => setDetailTab("info")}
                  >
                    <User size={14} />
                    Thông tin
                  </button>
                  <button
                    type="button"
                    className={detailTab === "students" ? "is-active" : ""}
                    onClick={() => setDetailTab("students")}
                  >
                    <Users size={14} />
                    Sinh viên
                  </button>
                  <button
                    type="button"
                    className={detailTab === "topics" ? "is-active" : ""}
                    onClick={() => setDetailTab("topics")}
                  >
                    <BookOpen size={14} />
                    Đề tài
                  </button>
                </div>

                <div className="lecturer-detail-body">
                  {detailLoading ? (
                    <div className="lecturer-detail-loading">
                      Đang tải chi tiết...
                    </div>
                  ) : (
                    <>
                      {detailTab === "info" && (
                        <div className="lecturer-detail-columns">
                          <div className="lecturer-detail-column">
                            <section className="lecturer-info-card">
                              <h4>Thông tin cơ bản</h4>
                              <div className="lecturer-detail-list">
                                <div>
                                  <span>Mã giảng viên</span>
                                  <strong>
                                    {String(selectedRow?.lecturerCode || "--")}
                                  </strong>
                                </div>
                                <div>
                                  <span>Mã user</span>
                                  <strong>
                                    {String(selectedRow?.userCode || "--")}
                                  </strong>
                                </div>
                                <div>
                                  <span>Khoa/Bộ môn</span>
                                  <strong>
                                    {String(
                                      selectedRow?.departmentCode || "--",
                                    )}
                                  </strong>
                                </div>
                                <div>
                                  <span>Học vị</span>
                                  <strong>
                                    {String(selectedRow?.degree || "--")}
                                  </strong>
                                </div>
                                <div>
                                  <span>Email</span>
                                  <strong>
                                    {String(selectedRow?.email || "--")}
                                  </strong>
                                </div>
                                <div>
                                  <span>SĐT</span>
                                  <strong>
                                    {String(selectedRow?.phoneNumber || "--")}
                                  </strong>
                                </div>
                              </div>

                              <div className="lecturer-guide-quota">
                                <div className="lecturer-guide-quota-row">
                                  <span>Chỉ tiêu hướng dẫn</span>
                                  <strong>
                                    {String(
                                      selectedRow?.currentGuidingCount ?? 0,
                                    )}
                                    /{String(selectedRow?.guideQuota ?? "--")}
                                  </strong>
                                </div>
                                <div className="lecturer-progress-track-lg">
                                  <div
                                    className="lecturer-progress-fill"
                                    style={{
                                      width: `${getGuidingProgress(selectedRow || {}).ratio}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </section>
                          </div>

                          <div className="lecturer-detail-column">
                            <section className="lecturer-info-card">
                              <h4>Thông tin mở rộng</h4>
                              <div className="lecturer-detail-list">
                                <div>
                                  <span>Giới tính</span>
                                  <strong>
                                    {String(selectedRow?.gender || "--")}
                                  </strong>
                                </div>
                                <div>
                                  <span>Ngày sinh</span>
                                  <strong>
                                    {formatDate(
                                      String(selectedRow?.dateOfBirth || ""),
                                    )}
                                  </strong>
                                </div>
                                <div>
                                  <span>Địa chỉ</span>
                                  <strong>
                                    {String(selectedRow?.address || "--")}
                                  </strong>
                                </div>
                                <div>
                                  <span>Ghi chú</span>
                                  <strong>
                                    {String(selectedRow?.notes || "--")}
                                  </strong>
                                </div>
                                <div>
                                  <span>Ngày cập nhật</span>
                                  <strong>
                                    {formatDateTime(
                                      String(selectedRow?.lastUpdated || ""),
                                    )}
                                  </strong>
                                </div>
                              </div>
                            </section>
                          </div>
                        </div>
                      )}

                      {detailTab === "students" && (
                        <div className="lecturer-list-panel">
                          <div className="lecturer-list-header">
                            <h4>Danh sách sinh viên</h4>
                            <span>
                              {detailStudents.length} / {detailTotalCount}
                            </span>
                          </div>
                          {detailStudents.length === 0 ? (
                            <div className="lecturer-empty-state">
                              Không có sinh viên nào.
                            </div>
                          ) : (
                            <div className="lecturer-item-list">
                              {detailStudents.map((item) => (
                                <div
                                  key={getStudentCode(item)}
                                  className="lecturer-item-card"
                                >
                                  <div className="lecturer-item-head">
                                    <div className="lecturer-item-avatar-wrap">
                                      {item.student?.studentImage ? (
                                        <img
                                          src={getAvatarUrl(
                                            String(item.student.studentImage),
                                          )}
                                          alt={getStudentName(item)}
                                          className="lecturer-item-avatar"
                                          loading="lazy"
                                        />
                                      ) : (
                                        <div className="lecturer-item-avatar lecturer-item-avatar-fallback">
                                          {getStudentName(item)
                                            .trim()
                                            .charAt(0)
                                            .toUpperCase()}
                                        </div>
                                      )}
                                    </div>

                                    <div className="lecturer-item-head-text">
                                      <h5>{getStudentName(item)}</h5>
                                      <p>
                                        {getStudentCode(item)} •{" "}
                                        {String(item.student?.userCode || "--")}
                                      </p>
                                    </div>

                                    <span className="lecturer-status lecturer-status-approved">
                                      {getStatusText(item.topic?.status)}
                                    </span>
                                  </div>

                                  <div className="lecturer-item-meta-grid">
                                    <div className="lecturer-item-meta">
                                      <span>Lớp</span>
                                      <strong>
                                        {String(
                                          item.student?.classCode || "--",
                                        )}
                                      </strong>
                                    </div>
                                    <div className="lecturer-item-meta">
                                      <span>Khoa</span>
                                      <strong>
                                        {String(
                                          item.student?.departmentCode || "--",
                                        )}
                                      </strong>
                                    </div>
                                    <div className="lecturer-item-meta">
                                      <span>GPA</span>
                                      <strong>
                                        {String(item.student?.gpa ?? "--")}
                                      </strong>
                                    </div>
                                    <div className="lecturer-item-meta">
                                      <span>Tiến độ</span>
                                      <strong>
                                        {item.currentMilestone
                                          ?.milestoneTemplateCode
                                          ? getMilestoneLabel(
                                              item.currentMilestone
                                                .milestoneTemplateCode,
                                            )
                                          : "--"}
                                      </strong>
                                    </div>
                                  </div>

                                  <div className="lecturer-item-topic">
                                    <span>Đề tài</span>
                                    <p>{getTopicTitle(item)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {detailTab === "topics" && (
                        <div className="lecturer-list-panel">
                          <div className="lecturer-list-header">
                            <h4>Danh sách đề tài</h4>
                            <span>
                              {detailTopics.length} / {detailTotalCount}
                            </span>
                          </div>
                          {detailTopics.length === 0 ? (
                            <div className="lecturer-empty-state">
                              Không có đề tài nào.
                            </div>
                          ) : (
                            <div className="lecturer-item-list">
                              {detailTopics.map((item) => {
                                const progress = calcProgress(
                                  item.currentMilestone,
                                  5,
                                );
                                return (
                                  <div
                                    key={getTopicCode(item)}
                                    className="lecturer-item-card"
                                  >
                                    <div className="lecturer-topic-head">
                                      <div>
                                        <h5>{getTopicTitle(item)}</h5>
                                        <p>{getTopicCode(item)}</p>
                                      </div>
                                      <span className="lecturer-status lecturer-status-pending">
                                        {getStatusText(item.topic?.status)}
                                      </span>
                                    </div>

                                    <div className="lecturer-topic-summary">
                                      <span>Mô tả</span>
                                      <p>
                                        {String(item.topic?.summary || "--")}
                                      </p>
                                    </div>

                                    <div className="lecturer-topic-meta-grid">
                                      <div className="lecturer-item-meta">
                                        <span>Loại</span>
                                        <strong>
                                          {getTopicTypeLabel(item.topic?.type)}
                                        </strong>
                                      </div>
                                      <div className="lecturer-item-meta">
                                        <span>Ngày tạo</span>
                                        <strong>
                                          {formatDateTime(
                                            item.topic?.createdAt,
                                          )}
                                        </strong>
                                      </div>
                                      <div className="lecturer-item-meta">
                                        <span>Milestone</span>
                                        <strong>
                                          {item.currentMilestone
                                            ?.milestoneTemplateCode
                                            ? getMilestoneLabel(
                                                item.currentMilestone
                                                  .milestoneTemplateCode,
                                              )
                                            : "--"}
                                        </strong>
                                      </div>
                                      <div className="lecturer-item-meta">
                                        <span>Tiến độ</span>
                                        <strong>{progress}%</strong>
                                      </div>
                                    </div>

                                    <div className="lecturer-topic-tags">
                                      {(item.topicTags || []).map((tag) => (
                                        <span
                                          key={tag.tagCode}
                                          className="lecturer-tag"
                                        >
                                          {tag.tagName}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <ManagementSectionedFormBody
                sections={editFieldSections}
                values={formValues}
                getFieldDefinition={getFieldDefinition}
                onFieldChange={(name, value) =>
                  setFormValues((prev) => ({ ...prev, [name]: value }))
                }
              />
            )}

            {activeModal !== "detail" && (
              <div className="lecturer-form-actions">
                <button
                  type="button"
                  className="lecturer-cancel-btn"
                  onClick={() => setActiveModal(null)}
                  disabled={isSubmitting}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  className="lecturer-save-btn"
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerProfilesManagement;
