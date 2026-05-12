import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Edit,
  Eye,
  Filter,
  History,
  Check,
  Clock,
  Plus,
  Search,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { fetchData, normalizeUrl } from "../../api/fetchData";
import ImportExportActions from "../../components/admin/ImportExportActions.tsx";
import ManagementSectionedFormBody from "../../components/admin/ManagementSectionedFormBody";
import TablePagination from "../../components/TablePagination/TablePagination";
import { useToast } from "../../context/useToast";
import type { ApiResponse } from "../../types/api";
import "./TopicsManagement.css";

type RecordData = Record<string, unknown>;
type FieldType = "text" | "number" | "date" | "textarea";

interface FieldDef {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
}

interface ColumnDef {
  key: string;
  label: string;
  aliases?: string[];
}

interface DetailCard {
  label: string;
  value: string;
  wide?: boolean;
}

type TopicTag = {
  tagCode: string;
  tagName: string;
};

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
  type: string;
  status: string;
  catalogTopicCode?: string;
  supervisorLecturerCode?: string;
  departmentCode?: string;
  createdAt?: string;
  lastUpdated?: string;
};

type DashboardSupervisor = {
  lecturerProfileID: number;
  lecturerCode: string;
  userCode?: string;
  fullName: string;
  degree?: string;
  email: string;
  phoneNumber: string;
  departmentCode?: string;
  guideQuota?: number;
  currentGuidingCount?: number;
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
};

type DashboardItem = {
  student: DashboardStudent;
  topic: DashboardTopic;
  topicTags: TopicTag[];
  currentMilestone: DashboardMilestone | null;
  supervisor: DashboardSupervisor | null;
  supervisorTags?: TopicTag[];
  canSubmit?: boolean;
  blockReason?: string | null;
};

type DashboardDataPayload = {
  items: DashboardItem[];
  page: number;
  pageSize: number;
  totalCount: number;
};

type MilestoneTemplate = {
  milestoneTemplateID: number;
  milestoneTemplateCode: string;
  name: string;
  description?: string;
  ordinal: number;
  deadline?: string | null;
  createdAt?: string;
  lastUpdated?: string | null;
};

type ProgressHistoryFile = {
  fileID: number;
  fileURL: string;
  fileName: string;
  fileSizeBytes?: number;
  mimeType?: string;
  uploadedAt?: string;
  uploadedByUserCode?: string;
};

type ProgressHistorySubmission = {
  submissionID: number;
  submissionCode: string;
  milestoneID?: number;
  milestoneCode: string;
  ordinal?: number;
  studentUserCode: string;
  studentProfileCode?: string | null;
  lecturerCode?: string;
  submittedAt?: string;
  attemptNumber?: number;
  lecturerComment?: string;
  lecturerState?: string;
  feedbackLevel?: string;
  reportTitle?: string;
  reportDescription?: string;
  lastUpdated?: string;
  files?: ProgressHistoryFile[];
};

type ProgressHistoryItem = {
  submission: ProgressHistorySubmission;
};

type ProgressHistoryPayload = {
  items: ProgressHistoryItem[];
  page: number;
  pageSize: number;
  totalCount: number;
};

interface DetailMilestoneView {
  code: string;
  label: string;
  ordinal: number;
  isCompleted: boolean;
  isCurrent: boolean;
  completedAt: string | null;
}

const hiddenSystemFields: FieldDef[] = [
  { name: "createdAt", label: "createdAt", type: "date" },
  { name: "lastUpdated", label: "lastUpdated", type: "date" },
];

const fields: FieldDef[] = [
  { name: "topicCode", label: "Mã đề tài", required: true },
  { name: "title", label: "Tên đề tài", required: true },
  { name: "summary", label: "Mô tả", type: "textarea" },
  { name: "type", label: "Loại đề tài" },
  { name: "status", label: "Trạng thái" },
  { name: "departmentID", label: "departmentID", type: "number" },
  { name: "departmentCode", label: "departmentCode" },
  { name: "proposerUserID", label: "proposerUserID", type: "number" },
  { name: "proposerUserCode", label: "proposerUserCode" },
  {
    name: "proposerStudentProfileID",
    label: "proposerStudentProfileID",
    type: "number",
  },
  { name: "proposerStudentCode", label: "proposerStudentCode" },
  { name: "supervisorUserID", label: "supervisorUserID", type: "number" },
  { name: "supervisorUserCode", label: "supervisorUserCode" },
  {
    name: "supervisorLecturerProfileID",
    label: "supervisorLecturerProfileID",
    type: "number",
  },
  { name: "supervisorLecturerCode", label: "supervisorLecturerCode" },
  { name: "catalogTopicID", label: "catalogTopicID", type: "number" },
  { name: "catalogTopicCode", label: "catalogTopicCode" },
  { name: "resubmitCount", label: "resubmitCount", type: "number" },
  { name: "lecturerComment", label: "Phản hồi giảng viên", type: "textarea" },
];

const createFields = fields;
const editFields = fields.filter((field) => field.name !== "topicCode");
const updateFields = [...editFields, ...hiddenSystemFields];

function getFieldDefinition(name: string): FieldDef {
  return (
    fields.find((field) => field.name === name) ?? {
      name,
      label: name,
      type: "text",
    }
  );
}

const editFieldSections: Array<{
  title: string;
  description: string;
  fields: string[];
}> = [
  {
    title: "Thông tin cơ bản",
    description: "Mã, tên, loại và trạng thái của đề tài.",
    fields: ["topicCode", "title", "type", "status"],
  },
  {
    title: "Người đề xuất",
    description: "Thông tin liên kết của sinh viên hoặc user đề xuất.",
    fields: [
      "proposerUserID",
      "proposerUserCode",
      "proposerStudentProfileID",
      "proposerStudentCode",
    ],
  },
  {
    title: "Người hướng dẫn",
    description: "Thông tin giảng viên hướng dẫn.",
    fields: [
      "supervisorUserID",
      "supervisorUserCode",
      "supervisorLecturerProfileID",
      "supervisorLecturerCode",
    ],
  },
  {
    title: "Danh mục & khoa",
    description: "Liên kết danh mục đề tài và đơn vị quản lý.",
    fields: [
      "catalogTopicID",
      "catalogTopicCode",
      "departmentID",
      "departmentCode",
      "resubmitCount",
    ],
  },
  {
    title: "Mô tả bổ sung",
    description: "Nội dung mô tả và phản hồi của giảng viên.",
    fields: ["summary", "lecturerComment"],
  },
];

const filterFields: FieldDef[] = [
  { name: "topicCode", label: "Mã đề tài" },
  { name: "title", label: "Tên đề tài" },
  { name: "departmentCode", label: "Khoa/Bộ môn" },
  { name: "status", label: "Trạng thái" },
  { name: "type", label: "Loại đề tài" },
  { name: "proposerUserCode", label: "Mã người đề xuất" },
  { name: "supervisorUserCode", label: "Mã GV hướng dẫn" },
];

const columns: ColumnDef[] = [
  { key: "topicCode", label: "Mã đề tài", aliases: ["code"] },
  { key: "title", label: "Tên đề tài", aliases: ["topicTitle", "name"] },
  {
    key: "departmentCode",
    label: "Khoa/Bộ môn",
    aliases: ["departmentName", "department"],
  },
  {
    key: "proposerUserCode",
    label: "Người đề xuất",
    aliases: ["proposerStudentCode", "proposerCode", "proposerName"],
  },
  {
    key: "supervisorLecturerCode",
    label: "GV hướng dẫn",
    aliases: ["supervisorUserCode", "supervisorCode"],
  },
  { key: "status", label: "Trạng thái", aliases: ["topicStatus", "isActive"] },
];

const topicTableColumnWidths: Record<string, string> = {
  topicCode: "12%",
  title: "20%",
  departmentCode: "10%",
  proposerUserCode: "10%",
  supervisorLecturerCode: "10%",
  status: "8%",
  action: "12%",
};

function toDisplay(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatDateTime(value?: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN");
}

function formatDate(value?: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("vi-VN");
}

function getColumnValue(row: RecordData, column: ColumnDef): unknown {
  const keys = [column.key, ...(column.aliases ?? [])];
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value;
  }
  return "";
}

function toFormRecord(
  data: RecordData,
  schemaFields: FieldDef[] = fields,
): Record<string, string> {
  return schemaFields.reduce<Record<string, string>>((acc, field) => {
    acc[field.name] = toDisplay(data[field.name]);
    return acc;
  }, {});
}

function toPayload(
  formValues: Record<string, string>,
  schemaFields: FieldDef[] = fields,
): RecordData {
  return schemaFields.reduce<RecordData>((acc, field) => {
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

function normalizeDashboardItems(payload: unknown): DashboardItem[] {
  if (!payload || typeof payload !== "object") return [];
  const source = payload as Record<string, unknown>;
  const items = source.items;
  return Array.isArray(items) ? (items as DashboardItem[]) : [];
}

function getTopicCode(row: RecordData): string {
  return String(row.topicCode || row.code || "--");
}

function getTopicTitle(row: RecordData): string {
  return String(row.title || row.topicTitle || row.name || "--");
}

function getTopicType(row: RecordData): string {
  return String(row.type || row.topicType || "--");
}

function getTopicStatus(row: RecordData): string {
  return String(row.status || row.topicStatus || "--");
}

function getTopicID(row: RecordData): string {
  const topic =
    row.topic && typeof row.topic === "object"
      ? (row.topic as Record<string, unknown>)
      : null;
  return String(
    row.topicID || row.topicId || row.id || topic?.topicID || "",
  ).trim();
}

function getTopicProposerName(item?: DashboardItem): string {
  return String(item?.student?.fullName || "--");
}

function getTopicSupervisorName(item?: DashboardItem): string {
  return String(item?.supervisor?.fullName || "--");
}

function getStatusTone(status?: string): string {
  const value = String(status || "").toLowerCase();
  if (value.includes("approved") || value.includes("đã duyệt"))
    return "approved";
  if (value.includes("rejected") || value.includes("từ chối"))
    return "rejected";
  if (value.includes("revision") || value.includes("cần sửa"))
    return "revision";
  return "pending";
}

function buildFallbackDetailItem(row: RecordData): DashboardItem {
  return {
    student: {
      studentProfileID: 0,
      studentCode: String(row.studentCode || ""),
      userCode: String(row.userCode || ""),
      fullName: String(row.fullName || row.studentName || "--"),
      studentEmail: String(row.studentEmail || ""),
      phoneNumber: String(row.phoneNumber || ""),
      departmentCode: String(row.departmentCode || ""),
      classCode: String(row.classCode || ""),
      facultyCode: String(row.facultyCode || ""),
      studentImage: String(row.studentImage || ""),
      gpa: row.gpa !== undefined ? Number(row.gpa) : undefined,
      academicStanding: String(row.academicStanding || ""),
      gender: String(row.gender || ""),
      dateOfBirth: String(row.dateOfBirth || ""),
      address: String(row.address || ""),
      enrollmentYear:
        row.enrollmentYear !== undefined
          ? Number(row.enrollmentYear)
          : undefined,
      graduationYear:
        row.graduationYear !== undefined ? Number(row.graduationYear) : null,
      status: String(row.studentStatus || row.status || ""),
      notes: String(row.notes || ""),
      createdAt: String(row.studentCreatedAt || row.createdAt || ""),
      lastUpdated: String(row.studentLastUpdated || row.lastUpdated || ""),
    },
    topic: {
      topicID: Number(row.topicID || 0),
      topicCode: String(row.topicCode || ""),
      title: String(row.title || "--"),
      summary: String(row.summary || "--"),
      type: String(row.type || "--"),
      status: String(row.status || "--"),
      catalogTopicCode: String(row.catalogTopicCode || ""),
      supervisorLecturerCode: String(row.supervisorLecturerCode || ""),
      departmentCode: String(row.departmentCode || ""),
      createdAt: String(row.createdAt || ""),
      lastUpdated: String(row.lastUpdated || ""),
    },
    topicTags: [],
    currentMilestone: null,
    supervisor: {
      lecturerProfileID: 0,
      lecturerCode: String(row.supervisorLecturerCode || ""),
      fullName: String(row.supervisorName || "--"),
      degree: String(row.degree || ""),
      email: String(row.supervisorEmail || ""),
      phoneNumber: String(row.supervisorPhoneNumber || ""),
      departmentCode: String(row.departmentCode || ""),
      guideQuota: undefined,
      currentGuidingCount: undefined,
    },
    supervisorTags: [],
    canSubmit: false,
    blockReason: null,
  };
}

function getMilestoneLabel(code: string): string {
  const map: Record<string, string> = {
    MS_REG: "Đăng ký đề tài",
    MS_PROG1: "Tiến độ 1",
    MS_PROG2: "Tiến độ 2",
    MS_FULL: "Nộp khóa luận hoàn chỉnh",
  };
  return map[code] || code;
}

const TopicsManagement: React.FC = () => {
  const { addToast } = useToast();
  const [rows, setRows] = useState<RecordData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState<
    "detail" | "create" | "edit" | null
  >(null);
  const [selectedRow, setSelectedRow] = useState<RecordData | null>(null);
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
  const [templates, setTemplates] = useState<MilestoneTemplate[]>([]);
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    item?: DashboardItem;
  }>({ isOpen: false });
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<
    "topic" | "student" | "supervisor" | "history"
  >("topic");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<ProgressHistoryItem[]>([]);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchKeyword(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetchData<ApiResponse<MilestoneTemplate[]>>(
          "/MilestoneTemplates/get-list?Page=0&PageSize=10",
          { method: "GET" },
        );
        if (!response?.success) return;
        setTemplates(response.data || []);
      } catch {
        setTemplates([]);
      }
    };

    void fetchTemplates();
  }, []);

  const listQuery = useMemo(
    () => ({ page, pageSize, search: searchKeyword, ...advancedFilters }),
    [advancedFilters, page, pageSize, searchKeyword],
  );

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = buildQuery(listQuery);
      const { data, totalCount: apiTotal } = await requestApiData<unknown>(
        `/Topics/get-list${query}`,
        { method: "GET" },
        "Không thể tải danh sách đề tài.",
      );
      const normalized = normalizeList(data);
      setRows(normalized.items);
      setTotalCount(apiTotal > 0 ? apiTotal : normalized.fallbackTotal);
    } catch (error) {
      addToast(
        error instanceof Error
          ? error.message
          : "Không thể tải danh sách đề tài.",
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

  const openCreate = async () => {
    try {
      const { data } = await requestApiData<RecordData>(
        "/Topics/get-create",
        { method: "GET" },
        "Không thể tải mẫu tạo mới.",
      );
      setFormValues(toFormRecord(data || {}, createFields));
    } catch {
      setFormValues(toFormRecord({}, createFields));
    }
    setSelectedRow(null);
    setActiveModal("create");
  };

  const openEdit = async (row: RecordData) => {
    const topicID = getTopicID(row);
    if (!topicID) {
      addToast("Không xác định được topicID để cập nhật.", "error");
      return;
    }

    try {
      const { data } = await requestApiData<RecordData>(
        `/Topics/get-update/${encodeURIComponent(topicID)}`,
        { method: "GET" },
        "Không thể tải dữ liệu cập nhật.",
      );
      setFormValues(toFormRecord(data || row, updateFields));
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

  const loadDetail = useCallback(
    async (topicCode: string) => {
      if (!topicCode) return null;

      try {
        const query = new URLSearchParams();
        query.append("TopicCode", topicCode);

        const response = await fetchData<ApiResponse<DashboardDataPayload>>(
          `/reports/student/dashboard/get-list?${query.toString()}`,
          { method: "GET" },
        );

        if (!response?.success || !response.data) {
          throw new Error(
            response?.message || "Không thể tải chi tiết đề tài.",
          );
        }

        const items = normalizeDashboardItems(response.data);
        const item = items[0];
        if (!item) return null;

        const userCode = String(item.student?.userCode || "").trim();
        if (userCode) {
          setHistoryLoading(true);
          try {
            const historyRes = await fetchData<
              ApiResponse<ProgressHistoryPayload>
            >(
              `/reports/student/progress-history?userCode=${encodeURIComponent(userCode)}&page=1&pageSize=10`,
              { method: "GET" },
            );

            if (historyRes?.success && historyRes.data) {
              setHistoryItems(
                Array.isArray(historyRes.data.items)
                  ? historyRes.data.items
                  : [],
              );
              setHistoryTotalCount(
                Number(
                  historyRes.totalCount || historyRes.data.totalCount || 0,
                ),
              );
            } else {
              setHistoryItems([]);
              setHistoryTotalCount(0);
            }
          } catch {
            setHistoryItems([]);
            setHistoryTotalCount(0);
          } finally {
            setHistoryLoading(false);
          }
        }

        return item;
      } catch (error) {
        addToast(
          error instanceof Error
            ? error.message
            : "Không thể tải chi tiết đề tài.",
          "error",
        );
        return null;
      }
    },
    [addToast],
  );

  const openDetail = async (row: RecordData) => {
    const code = String(row.topicCode ?? "").trim();
    if (!code) {
      setSelectedRow(row);
      setDetailModal({ isOpen: false });
      setActiveModal("detail");
      return;
    }

    setDetailLoading(true);
    setHistoryItems([]);
    setHistoryTotalCount(0);
    setDetailTab("topic");

    const detailItem = await loadDetail(code);
    if (detailItem) {
      setDetailModal({ isOpen: true, item: detailItem });
      setSelectedRow(detailItem.topic as RecordData);
    } else {
      setDetailModal({ isOpen: true, item: buildFallbackDetailItem(row) });
      setSelectedRow(row);
    }
    setDetailLoading(false);
  };

  const handleDelete = async (row: RecordData) => {
    const code = String(row.topicCode ?? "").trim();
    if (!code) {
      addToast("Không xác định được topicCode để xóa.", "error");
      return;
    }
    if (!window.confirm("Bạn chắc chắn muốn xóa bản ghi này?")) return;

    try {
      await requestApiData<unknown>(
        `/Topics/delete/${encodeURIComponent(code)}`,
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
    const schemaFields = activeModal === "edit" ? updateFields : createFields;
    const payload = toPayload(formValues, schemaFields);
    const required = schemaFields.find((field) => {
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

    const proposerUserID = Number(payload.proposerUserID ?? 0);
    const proposerUserCode = String(payload.proposerUserCode ?? "").trim();
    if (!proposerUserID && !proposerUserCode) {
      addToast("Cần proposerUserID hoặc proposerUserCode.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeModal === "create") {
        await requestApiData<RecordData>(
          "/Topics/create",
          { method: "POST", body: payload },
          "Không thể tạo bản ghi.",
        );
        addToast("Tạo mới thành công.", "success");
      }

      if (activeModal === "edit" && selectedRow) {
        const topicID = getTopicID(selectedRow);
        if (!topicID) {
          addToast("Không xác định được topicID để cập nhật.", "error");
          return;
        }
        await requestApiData<RecordData>(
          `/Topics/update/${encodeURIComponent(topicID)}`,
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

  const detailItem = detailModal.item;
  const detailTopic = detailItem?.topic || ({} as DashboardTopic);
  const detailStudent = detailItem?.student || ({} as DashboardStudent);
  const detailSupervisor =
    detailItem?.supervisor || ({} as DashboardSupervisor);
  const detailTopicTags = detailItem?.topicTags ?? [];
  const detailSupervisorTags = detailItem?.supervisorTags ?? [];

  const detailMilestones = useMemo<DetailMilestoneView[]>(() => {
    const fallbackCodes = ["MS_REG", "MS_PROG1", "MS_PROG2", "MS_FULL"];
    const templateCodes = [...templates]
      .sort((a, b) => a.ordinal - b.ordinal)
      .slice(0, 4)
      .map((item) => item.milestoneTemplateCode);
    const codes = templateCodes.length === 4 ? templateCodes : fallbackCodes;

    const currentCode =
      detailItem?.currentMilestone?.milestoneTemplateCode || "";
    const currentOrdinal = Number(detailItem?.currentMilestone?.ordinal || 0);
    const currentState = detailItem?.currentMilestone?.state;

    const completedAtValues = [
      detailItem?.currentMilestone?.completedAt1,
      detailItem?.currentMilestone?.completedAt2,
      detailItem?.currentMilestone?.completedAt3,
      detailItem?.currentMilestone?.completedAt4,
    ];

    return codes.map((code, index) => {
      const ordinal = index + 1;
      const completedAt = completedAtValues[index] || null;
      let isCompleted = Boolean(completedAt && String(completedAt).trim());

      // If we are waiting for committee, then milestone 4 is effectively completed
      if (ordinal === 4 && currentState === "WaitingForCommittee") {
        isCompleted = true;
      }

      let isCurrent =
        code === currentCode || (!isCompleted && currentOrdinal === ordinal);

      // If waiting for committee, it's effectively finished, so don't show as current (orange)
      if (currentState === "WaitingForCommittee" && ordinal === 4) {
        isCurrent = false;
      }

      let label = getMilestoneLabel(code);
      if (ordinal === 4 && currentState === "WaitingForCommittee") {
        label = "Chờ tạo hội đồng và bảo vệ";
      }

      return {
        code,
        label,
        ordinal,
        isCompleted,
        isCurrent,
        completedAt,
      };
    });
  }, [
    templates,
    detailItem?.currentMilestone?.milestoneTemplateCode,
    detailItem?.currentMilestone?.ordinal,
    detailItem?.currentMilestone?.state,
    detailItem?.currentMilestone?.completedAt1,
    detailItem?.currentMilestone?.completedAt2,
    detailItem?.currentMilestone?.completedAt3,
    detailItem?.currentMilestone?.completedAt4,
  ]);

  const detailSummaryCards: DetailCard[] = [
    { label: "Mã đề tài", value: getTopicCode(detailTopic) },
    { label: "Tên đề tài", value: getTopicTitle(detailTopic) },
    { label: "Loại đề tài", value: getTopicType(detailTopic) },
    { label: "Trạng thái", value: getTopicStatus(detailTopic) },
    { label: "Người đề xuất", value: getTopicProposerName(detailItem) },
    { label: "GV hướng dẫn", value: getTopicSupervisorName(detailItem) },
    { label: "createdAt", value: formatDateTime(detailTopic.createdAt) },
    { label: "lastUpdated", value: formatDateTime(detailTopic.lastUpdated) },
    { label: "Mô tả", value: String(detailTopic.summary || "--"), wide: true },
  ];

  const statusText = getTopicStatus(detailTopic);

  return (
    <div className="topics-module">
      <div className="topics-header">
        <h1>
          <BookOpen size={30} color="#F37021" /> Quản lý đề tài
        </h1>
        <p>
          Dữ liệu chuẩn theo schema Topics, hiển thị theo bố cục giống giao diện
          quản lý sinh viên.
        </p>
      </div>

      <div className="topics-toolbar">
        <div className="topics-search-wrap">
          <Search size={16} />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Tìm kiếm nhanh..."
          />
        </div>

        <div className="topics-actions-wrap">
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className="topics-filter-btn"
          >
            <Filter size={14} />
            {showAdvancedFilters ? "Ẩn lọc" : "Lọc nâng cao"}
          </button>
          <ImportExportActions
            moduleName="topics"
            moduleLabel="Quản lý đề tài"
            onImportSuccess={loadRows}
          />
          <button
            type="button"
            onClick={openCreate}
            className="topics-create-btn"
          >
            <Plus size={14} /> Thêm mới
          </button>
        </div>
      </div>

      {showAdvancedFilters && (
        <div className="topics-filter-panel">
          <div className="topics-filter-grid">
            {filterFields.map((field) => (
              <label key={field.name} className="topics-filter-field">
                <span>{field.label}</span>
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
                />
              </label>
            ))}
          </div>

          <div className="topics-filter-actions">
            <button
              type="button"
              onClick={resetFilters}
              className="topics-reset-btn"
            >
              Xóa bộ lọc
            </button>
          </div>
        </div>
      )}

      <div className="topics-table-wrap">
        <table className="topics-table">
          <colgroup>
            {columns.map((column) => (
              <col
                key={column.key}
                style={{ width: topicTableColumnWidths[column.key] ?? "12%" }}
              />
            ))}
            <col style={{ width: topicTableColumnWidths.action }} />
          </colgroup>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              <th
                style={{
                  textAlign: "center",
                  width: topicTableColumnWidths.action,
                }}
              >
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length + 1}>Đang tải dữ liệu...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1}>Không có dữ liệu.</td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`topics-${index}-${String(row.topicCode ?? "")}`}>
                  {columns.map((column) => (
                    <td
                      key={`${column.key}-${index}`}
                      style={
                        column.key === "title"
                          ? { whiteSpace: "normal" }
                          : {
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }
                      }
                    >
                      {column.key === "title" ? (
                        <div
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            lineHeight: "1.4",
                            maxHeight: "2.8em",
                          }}
                          title={String(getColumnValue(row, column))}
                        >
                          {toDisplay(getColumnValue(row, column))}
                        </div>
                      ) : (
                        toDisplay(getColumnValue(row, column))
                      )}
                    </td>
                  ))}
                  <td>
                    <div className="topics-action-buttons">
                      <button
                        type="button"
                        onClick={() => void openDetail(row)}
                        className="topics-icon-btn"
                        title="Chi tiết"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void openEdit(row)}
                        className="topics-icon-btn"
                        title="Cập nhật"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(row)}
                        className="topics-icon-btn topics-icon-btn-danger"
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
        pageSizeOptions={[10, 20, 50, 100]}
        totalLabel="Tổng bản ghi:"
        pageSizeLabel="Số dòng/trang"
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
      />

      {detailModal.isOpen && (
        <div className="topics-modal-overlay">
          <div
            className="topics-modal topics-detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="topics-detail-shell">
              <div className="topics-detail-header">
                <div className="topics-detail-header-left">
                  <div className="topics-avatar-fallback">
                    <BookOpen size={22} />
                  </div>
                  <div className="topics-detail-header-text">
                    <h3
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        lineHeight: "1.3",
                        maxHeight: "2.6em",
                      }}
                      title={getTopicTitle(detailTopic)}
                    >
                      {getTopicTitle(detailTopic)}
                    </h3>
                    <p>
                      {getTopicCode(detailTopic)} • {statusText}
                    </p>
                    <div className="topics-detail-subline">
                      <span
                        className={`topics-status topics-status-${getStatusTone(statusText)}`}
                      >
                        {statusText}
                      </span>
                      <span className="topics-detail-meta">
                        {getTopicType(detailTopic)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="topics-detail-header-actions">
                  <button
                    type="button"
                    className="topics-edit-btn"
                    onClick={() => {
                      if (detailItem?.topic) {
                        void openEdit(detailItem.topic);
                        setDetailModal({ isOpen: false });
                      }
                    }}
                  >
                    <Edit size={13} />
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="topics-cancel-btn"
                    onClick={() => setDetailModal({ isOpen: false })}
                  >
                    Đóng
                  </button>
                </div>
              </div>

              <div className="topics-detail-tabs">
                <button
                  type="button"
                  className={detailTab === "topic" ? "is-active" : ""}
                  onClick={() => setDetailTab("topic")}
                >
                  <BookOpen size={14} />
                  Thông tin đề tài
                </button>
                <button
                  type="button"
                  className={detailTab === "student" ? "is-active" : ""}
                  onClick={() => setDetailTab("student")}
                >
                  <User size={14} />
                  Thông tin sinh viên
                </button>
                <button
                  type="button"
                  className={detailTab === "supervisor" ? "is-active" : ""}
                  onClick={() => setDetailTab("supervisor")}
                >
                  <Users size={14} />
                  Thông tin giảng viên
                </button>
                <button
                  type="button"
                  className={detailTab === "history" ? "is-active" : ""}
                  onClick={() => setDetailTab("history")}
                >
                  <History size={14} />
                  Lịch sử báo cáo
                </button>
              </div>

              <div className="topics-detail-body">
                {detailLoading ? (
                  <div className="topics-detail-loading">
                    Đang tải chi tiết...
                  </div>
                ) : (
                  <>
                    {detailTab === "topic" && (
                      <div className="topics-topic-layout">
                        <section className="topics-info-card topics-detail-section topics-topic-panel">
                          <div className="topics-topic-code-row">
                            <div className="topics-topic-code-field">
                              <span>Mã đề tài</span>
                              <strong>{getTopicCode(detailTopic)}</strong>
                            </div>
                            <span
                              className={`topics-status topics-status-${getStatusTone(statusText)}`}
                            >
                              {statusText}
                            </span>
                          </div>

                          <div className="topics-detail-list topics-detail-list-topic">
                            {detailSummaryCards.map((card) => (
                              <div
                                key={card.label}
                                className={
                                  card.wide ? "topics-detail-row-wide" : ""
                                }
                              >
                                <span>{card.label}</span>
                                <strong>{card.value}</strong>
                              </div>
                            ))}
                          </div>

                          <div className="topics-topic-inline-row">
                            <div className="topics-topic-inline-field topics-topic-inline-lastupdated">
                              <span>lastUpdated</span>
                              <strong>
                                {formatDateTime(detailTopic.lastUpdated)}
                              </strong>
                            </div>

                            <div className="topics-topic-inline-tags">
                              <span className="topics-topic-inline-label">
                                Tag đề tài
                              </span>
                              <div className="topics-tag-wrap topics-tag-wrap-compact topics-tag-wrap-grid">
                                {detailTopicTags.length === 0 ? (
                                  <span className="topics-empty">
                                    Không có tag.
                                  </span>
                                ) : (
                                  detailTopicTags.map((tag) => (
                                    <span
                                      key={tag.tagCode}
                                      className="topics-tag"
                                    >
                                      {tag.tagName}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </section>

                        <section className="topics-info-card topics-detail-section topics-progress-card">
                          <div className="topics-progress-panel">
                            <div className="topics-timeline-horizontal">
                              {detailMilestones.map((milestone) => (
                                <div
                                  key={milestone.code}
                                  className={`topics-timeline-step ${milestone.isCompleted ? "is-completed" : ""} ${milestone.isCurrent ? "is-current" : ""}`}
                                >
                                  <div className="topics-timeline-node">
                                    {milestone.isCurrent ? (
                                      <Clock size={14} strokeWidth={3} />
                                    ) : (
                                      <Check size={14} strokeWidth={3} />
                                    )}
                                  </div>
                                  <div className="topics-timeline-step-body">
                                    <strong>{milestone.label}</strong>
                                    <span className="topics-timeline-time">
                                      {milestone.completedAt
                                        ? formatDateTime(milestone.completedAt)
                                        : "--"}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </section>
                      </div>
                    )}

                    {detailTab === "student" && (
                      <div className="topics-student-layout">
                        <section className="topics-info-card topics-supervisor-card topics-profile-card">
                          <div className="topics-profile-card-head">
                            <div className="topics-student-header">
                              {detailStudent.studentImage ? (
                                <img
                                  src={normalizeUrl(detailStudent.studentImage)}
                                  alt={detailStudent.fullName}
                                  className="topics-avatar-lg"
                                />
                              ) : (
                                <div className="topics-avatar-fallback topics-avatar-lg-fallback">
                                  {detailStudent.fullName?.charAt(0) || "S"}
                                </div>
                              )}
                              <div>
                                <h3 className="topics-profile-name">
                                  {detailStudent.fullName || "--"}
                                </h3>
                                <p className="topics-profile-code">
                                  {detailStudent.userCode || "--"} •{" "}
                                  {detailStudent.studentCode || "--"}
                                </p>
                              </div>
                            </div>

                            <div className="topics-detail-subline topics-profile-meta-row">
                              <span className="topics-status topics-status-pending">
                                {detailStudent.status || "--"}
                              </span>
                              <span className="topics-detail-meta">
                                GPA {detailStudent.gpa ?? "--"}
                              </span>
                            </div>
                          </div>

                          <div className="topics-detail-list topics-detail-list-stacked topics-detail-list-profile">
                            <div>
                              <span>Department</span>
                              <strong>
                                {detailStudent.departmentCode || "--"}
                              </strong>
                            </div>
                            <div>
                              <span>Class</span>
                              <strong>{detailStudent.classCode || "--"}</strong>
                            </div>
                            <div>
                              <span>Faculty</span>
                              <strong>
                                {detailStudent.facultyCode || "--"}
                              </strong>
                            </div>
                            <div>
                              <span>Email</span>
                              <strong>
                                {detailStudent.studentEmail || "--"}
                              </strong>
                            </div>
                            <div>
                              <span>Phone</span>
                              <strong>
                                {detailStudent.phoneNumber || "--"}
                              </strong>
                            </div>
                            <div>
                              <span>Gender</span>
                              <strong>{detailStudent.gender || "--"}</strong>
                            </div>
                            <div>
                              <span>Ngày sinh</span>
                              <strong>
                                {formatDate(detailStudent.dateOfBirth)}
                              </strong>
                            </div>
                            <div>
                              <span>Địa chỉ</span>
                              <strong>{detailStudent.address || "--"}</strong>
                            </div>
                            <div>
                              <span>CreatedAt</span>
                              <strong>
                                {formatDateTime(detailStudent.createdAt)}
                              </strong>
                            </div>
                            <div>
                              <span>LastUpdated</span>
                              <strong>
                                {formatDateTime(detailStudent.lastUpdated)}
                              </strong>
                            </div>
                          </div>
                        </section>
                      </div>
                    )}

                    {detailTab === "supervisor" && (
                      <div className="topics-supervisor-layout">
                        <section className="topics-info-card topics-supervisor-card topics-profile-card">
                          <div className="topics-profile-card-head">
                            <div className="topics-supervisor-header">
                              <div className="topics-avatar-fallback topics-avatar-lg-fallback">
                                {detailSupervisor.fullName?.charAt(0) || "G"}
                              </div>
                              <div>
                                <h3 className="topics-profile-name">
                                  {detailSupervisor.fullName || "--"}
                                </h3>
                                <p className="topics-profile-code">
                                  {detailSupervisor.userCode ||
                                    detailSupervisor.lecturerCode ||
                                    "--"}{" "}
                                  • {detailSupervisor.lecturerCode || "--"}
                                </p>
                                <div className="topics-detail-subline">
                                  <span className="topics-status topics-status-approved">
                                    {detailSupervisor.degree || "--"}
                                  </span>
                                  <span className="topics-detail-meta">
                                    {detailSupervisor.currentGuidingCount ?? 0}/
                                    {detailSupervisor.guideQuota ?? 0}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="topics-detail-list topics-detail-list-stacked topics-detail-list-profile">
                            <div>
                              <span>Email</span>
                              <strong>{detailSupervisor.email || "--"}</strong>
                            </div>
                            <div>
                              <span>Phone</span>
                              <strong>
                                {detailSupervisor.phoneNumber || "--"}
                              </strong>
                            </div>
                            <div>
                              <span>Department</span>
                              <strong>
                                {detailSupervisor.departmentCode || "--"}
                              </strong>
                            </div>
                            <div>
                              <span>Guide quota</span>
                              <strong>
                                {detailSupervisor.guideQuota ?? "--"}
                              </strong>
                            </div>
                          </div>

                          <div className="topics-supervisor-stats-row">
                            <div className="topics-supervisor-stat-field topics-supervisor-stat-inline">
                              <span>Current guiding</span>
                              <strong>
                                {detailSupervisor.currentGuidingCount ?? "--"}
                              </strong>
                            </div>

                            <div className="topics-supervisor-tags-field topics-supervisor-tags-inline">
                              <span>Tags</span>
                              <div className="topics-supervisor-tags-input">
                                {detailSupervisorTags.length === 0 ? (
                                  <span className="topics-empty">
                                    Không có tag.
                                  </span>
                                ) : (
                                  detailSupervisorTags.map((tag) => (
                                    <span
                                      key={tag.tagCode}
                                      className="topics-tag"
                                    >
                                      {tag.tagName}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </section>
                      </div>
                    )}

                    {detailTab === "history" && (
                      <div className="topics-progress-panel">
                        {historyLoading ? (
                          <div className="topics-history-empty">
                            Đang tải lịch sử báo cáo...
                          </div>
                        ) : historyItems.length === 0 ? (
                          <div className="topics-history-empty">
                            Không có lịch sử báo cáo.
                          </div>
                        ) : (
                          <div className="topics-history-list">
                            {historyItems.map((item) => {
                              const submission = item.submission;
                              return (
                                <article
                                  key={submission.submissionID}
                                  className="topics-history-item"
                                >
                                  <div className="topics-history-head">
                                    <div>
                                      <h5>
                                        {submission.reportTitle ||
                                          submission.submissionCode}
                                      </h5>
                                      <p>
                                        {submission.milestoneCode} •{" "}
                                        {submission.studentProfileCode ||
                                          submission.studentUserCode}
                                      </p>
                                    </div>
                                    <span className="topics-history-badge">
                                      {submission.lecturerState || "--"}
                                    </span>
                                  </div>

                                  <div className="topics-history-meta-grid">
                                    <div className="topics-history-meta-item">
                                      <span>Submitted at</span>
                                      <strong>
                                        {formatDateTime(submission.submittedAt)}
                                      </strong>
                                    </div>
                                    <div className="topics-history-meta-item">
                                      <span>Last updated</span>
                                      <strong>
                                        {formatDateTime(submission.lastUpdated)}
                                      </strong>
                                    </div>
                                    <div className="topics-history-meta-item">
                                      <span>Attempt</span>
                                      <strong>
                                        {submission.attemptNumber ?? "--"}
                                      </strong>
                                    </div>
                                    <div className="topics-history-meta-item">
                                      <span>Feedback level</span>
                                      <strong>
                                        {submission.feedbackLevel || "--"}
                                      </strong>
                                    </div>
                                  </div>

                                  <div className="topics-history-content-grid">
                                    <div className="topics-history-block">
                                      <span className="topics-history-block-label">
                                        Mô tả báo cáo
                                      </span>
                                      <p className="topics-history-desc">
                                        {submission.reportDescription || "--"}
                                      </p>
                                    </div>
                                    <div className="topics-history-block">
                                      <span className="topics-history-block-label">
                                        Phản hồi giảng viên
                                      </span>
                                      <p className="topics-history-comment">
                                        {submission.lecturerComment || "--"}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="topics-history-files">
                                    {Array.isArray(submission.files) &&
                                    submission.files.length > 0 ? (
                                      submission.files.map((file) => (
                                        <a
                                          key={file.fileID}
                                          href={normalizeUrl(file.fileURL)}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          {file.fileName}
                                        </a>
                                      ))
                                    ) : (
                                      <span className="topics-history-empty">
                                        Không có tệp đính kèm.
                                      </span>
                                    )}
                                  </div>

                                  <div className="topics-history-footer">
                                    <strong>{historyTotalCount}</strong> bản ghi
                                    lịch sử
                                  </div>
                                </article>
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
          </div>
        </div>
      )}

      {activeModal && (
        <div
          className="topics-modal-overlay"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="topics-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="topics-modal-close"
              onClick={() => setActiveModal(null)}
            >
              x
            </button>

            <div className="topics-form-shell">
              <div className="topics-modal-header">
                <h3>
                  {activeModal === "create" ? "Tạo đề tài" : "Cập nhật đề tài"}
                </h3>
                <p>
                  {activeModal === "create"
                    ? "Nhập đầy đủ thông tin cho đề tài mới."
                    : "Chỉnh sửa thông tin đề tài theo bố cục giống giao diện quản lý sinh viên."}
                </p>
              </div>

              <ManagementSectionedFormBody
                sections={editFieldSections}
                values={formValues}
                getFieldDefinition={getFieldDefinition}
                onFieldChange={(name, value) =>
                  setFormValues((prev) => ({ ...prev, [name]: value }))
                }
                visibleFieldNames={
                  activeModal === "create"
                    ? createFields.map((field) => field.name)
                    : editFields.map((field) => field.name)
                }
                fullWidthFieldNames={["summary", "lecturerComment"]}
              />

              <div className="topics-form-actions">
                <button
                  type="button"
                  className="topics-cancel-btn"
                  onClick={() => setActiveModal(null)}
                  disabled={isSubmitting}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  className="topics-save-btn"
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopicsManagement;
