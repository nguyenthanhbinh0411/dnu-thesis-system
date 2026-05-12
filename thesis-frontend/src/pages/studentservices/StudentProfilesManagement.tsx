import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle,
  Circle,
  Clock,
  Clock3,
  Edit,
  Filter,
  Plus,
  Search,
  ShieldCheck,
  Trash,
  Users,
  Eye,
  BookOpen,
  History,
  User,
} from "lucide-react";
import { fetchData, getAvatarUrl, normalizeUrl } from "../../api/fetchData";
import ImportExportActions from "../../components/admin/ImportExportActions";
import ManagementSectionedFormBody from "../../components/admin/ManagementSectionedFormBody";
import { useToast } from "../../context/useToast";
import type { ApiResponse } from "../../types/api";
import "./StudentProfilesManagement.css";

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
};

type DashboardTopic = {
  topicID: number;
  topicCode: string;
  title: string;
  summary: string;
  status: string;
  createdAt: string;
  lastUpdated: string;
};

type DashboardTag = {
  tagCode: string;
  tagName: string;
};

type DashboardMilestone = {
  milestoneTemplateCode: string;
  ordinal?: number;
  state?: string;
  startedAt?: string | null;
  completedAt1?: string | null;
  completedAt2?: string | null;
  completedAt3?: string | null;
  completedAt4?: string | null;
  completedAt5?: string | null;
};

type DashboardSupervisor = {
  lecturerCode: string;
  fullName: string;
  degree?: string;
  email: string;
  phoneNumber: string;
  guideQuota?: number;
  currentGuidingCount?: number;
  departmentCode?: string;
};

type StudentDashboardItem = {
  student: DashboardStudent;
  topic?: DashboardTopic | null;
  topicTags: DashboardTag[];
  currentMilestone: DashboardMilestone | null;
  supervisor: DashboardSupervisor | null;
  supervisorTags?: DashboardTag[];
  canSubmit?: boolean;
  blockReason?: string | null;
};

type DashboardDataPayload = {
  items: StudentDashboardItem[];
  page: number;
  pageSize: number;
  totalCount: number;
};

type MilestoneTemplate = {
  milestoneTemplateID: number;
  milestoneTemplateCode: string;
  ordinal: number;
};

type ProgressHistoryFile = {
  fileID: number;
  fileURL: string;
  fileName: string;
  fileSizeBytes?: number;
  mimeType?: string;
  uploadedAt?: string;
};

type ProgressHistorySubmission = {
  submissionID: number;
  submissionCode: string;
  milestoneCode: string;
  ordinal?: number;
  studentUserCode: string;
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

type RowStatus =
  | "approved"
  | "pending"
  | "rejected"
  | "revision"
  | "defense-ready"
  | "committee-assigned"
  | "none";

type DashboardRowView = StudentDashboardItem & {
  __status: RowStatus;
  __progress: number;
};

type FieldType = "text" | "number" | "date" | "textarea";

type FieldDef = {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
};

const profileFields: FieldDef[] = [
  { name: "studentCode", label: "Mã sinh viên" },
  { name: "userCode", label: "Mã user", required: true },
  { name: "departmentCode", label: "Khoa/Bộ môn" },
  { name: "classCode", label: "Lớp" },
  { name: "facultyCode", label: "Khoa viện" },
  { name: "studentImage", label: "Ảnh sinh viên" },
  { name: "fullName", label: "Họ tên" },
  { name: "studentEmail", label: "Email" },
  { name: "phoneNumber", label: "Số điện thoại" },
  { name: "academicStanding", label: "Học lực" },
  { name: "status", label: "Trạng thái" },
  { name: "enrollmentYear", label: "Năm nhập học", type: "number" },
  { name: "graduationYear", label: "Năm tốt nghiệp", type: "number" },
  { name: "gender", label: "Giới tính" },
  { name: "dateOfBirth", label: "Ngày sinh", type: "date" },
  { name: "gpa", label: "GPA", type: "number" },
  { name: "address", label: "Địa chỉ" },
  { name: "notes", label: "Ghi chú", type: "textarea" },
];

const editFieldSections: Array<{
  title: string;
  description: string;
  fields: string[];
}> = [
  {
    title: "Thông tin tài khoản",
    description: "Thông tin định danh và tài khoản liên kết.",
    fields: ["studentCode", "userCode", "status"],
  },
  {
    title: "Thông tin cá nhân",
    description: "Thông tin liên hệ, nhân thân của sinh viên.",
    fields: [
      "fullName",
      "studentEmail",
      "phoneNumber",
      "gender",
      "dateOfBirth",
      "address",
      "studentImage",
    ],
  },
  {
    title: "Thông tin học tập",
    description: "Khoa, lớp, niên khóa và học lực.",
    fields: [
      "departmentCode",
      "classCode",
      "facultyCode",
      "enrollmentYear",
      "graduationYear",
      "gpa",
      "academicStanding",
      "notes",
    ],
  },
];

function getFieldDefinition(name: string): FieldDef {
  return (
    profileFields.find((field) => field.name === name) ?? {
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

function toFormRecord(data: Record<string, unknown>): Record<string, string> {
  return profileFields.reduce<Record<string, string>>((acc, field) => {
    acc[field.name] = toDisplay(data[field.name]);
    return acc;
  }, {});
}

function toPayload(
  formValues: Record<string, string>,
): Record<string, unknown> {
  return profileFields.reduce<Record<string, unknown>>((acc, field) => {
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

async function requestApiData<T>(
  path: string,
  options?: Parameters<typeof fetchData>[1],
  fallback = "Không thể tải dữ liệu.",
): Promise<{ data: T }> {
  const response = await fetchData<ApiResponse<T>>(path, options);
  if (!response?.success) {
    throw new Error(response?.message || response?.title || fallback);
  }
  return { data: response.data as T };
}

function mapApiStatusToDisplay(apiStatus?: string): RowStatus {
  const status = (apiStatus || "").toLowerCase();
  if (status.includes("đủ điều kiện bảo vệ")) return "defense-ready";
  if (status.includes("đã phân hội đồng")) return "committee-assigned";
  if (status.includes("đã duyệt")) return "approved";
  if (status.includes("từ chối")) return "rejected";
  if (status.includes("cần sửa")) return "revision";
  if (!apiStatus) return "none";
  return "pending";
}

function getStatusText(status: RowStatus | string): string {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("đã phân hội đồng")) return "đã có HĐ";
  if (normalized === "committee-assigned") return "đã có HĐ";
  if (normalized.includes("đủ điều kiện bảo vệ")) return "Chờ bảo vệ";
  if (normalized === "defense-ready") return "Chờ bảo vệ";
  if (status === "approved") return "Đã duyệt";
  if (status === "rejected") return "Từ chối";
  if (status === "revision") return "Cần sửa đổi";
  if (status === "none") return "Chưa đăng ký";
  return "Chờ duyệt";
}

function formatDate(value?: string): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
}

function formatDateTime(value?: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN");
}

function calcProgress(
  currentMilestone: DashboardMilestone | null,
  totalTemplates: number,
): number {
  if (!currentMilestone || !totalTemplates) return 0;
  const ordinal = Number(currentMilestone.ordinal || 0);
  if (!Number.isFinite(ordinal) || ordinal < 1) return 0;

  // If we are at the last milestone (4) and waiting for committee, it's 100%
  if (ordinal === 4 && currentMilestone.state === "WaitingForCommittee") {
    return 100;
  }

  if (ordinal <= 1) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round(((ordinal - 1) / totalTemplates) * 100)),
  );
}

function getMilestoneLabel(code: string): string {
  const map: Record<string, string> = {
    MS_REG: "Đăng ký đề tài",
    MS_PROG1: "Tiến độ 1",
    MS_PROG2: "Tiến độ 2",
    MS_FULL: "Nộp full",
  };
  return map[code] || code;
}

const StudentProfilesManagement: React.FC = () => {
  const { addToast } = useToast();
  const [rows, setRows] = useState<StudentDashboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [templates, setTemplates] = useState<MilestoneTemplate[]>([]);
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    row?: DashboardRowView;
  }>({ isOpen: false });
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<
    "info" | "supervisor" | "topic" | "history"
  >("info");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<ProgressHistoryItem[]>([]);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [activeModal, setActiveModal] = useState<"create" | "edit" | null>(
    null,
  );
  const [editingCode, setEditingCode] = useState("");
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshTick, setRefreshTick] = useState(0);

  const normalizeItems = (items: unknown): StudentDashboardItem[] => {
    if (!Array.isArray(items)) return [];
    return items.filter((item): item is StudentDashboardItem => {
      if (!item || typeof item !== "object") return false;
      const source = item as Partial<StudentDashboardItem>;
      return Boolean(source.student);
    });
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchKeyword(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetchData<ApiResponse<MilestoneTemplate[]>>(
          "/MilestoneTemplates/get-list?Page=0&PageSize=50",
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

  useEffect(() => {
    const loadRows = async () => {
      setIsLoading(true);
      try {
        const query = new URLSearchParams();
        query.append("page", String(Math.max(0, page - 1)));
        query.append("pageSize", String(pageSize));

        const response = await fetchData<ApiResponse<DashboardDataPayload>>(
          `/reports/student/dashboard/get-list?${query.toString()}`,
          { method: "GET" },
        );

        if (!response?.success || !response.data) {
          throw new Error(
            response?.message || "Không thể tải danh sách sinh viên.",
          );
        }

        const payload = response.data;
        setRows(normalizeItems(payload.items));
        setTotalCount(
          Number(response.totalCount || 0) > 0
            ? Number(response.totalCount)
            : Number(payload.totalCount || 0),
        );
      } catch (error) {
        addToast(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách sinh viên.",
          "error",
        );
        setRows([]);
        setTotalCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    void loadRows();
  }, [addToast, page, pageSize, refreshTick]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize))),
    [pageSize, totalCount],
  );

  const rowsView = useMemo<DashboardRowView[]>(() => {
    return rows
      .map((item) => {
        const status = mapApiStatusToDisplay(item.topic?.status);
        const progress = calcProgress(item.currentMilestone, templates.length);
        return { ...item, __status: status, __progress: progress };
      })
      .filter((item) => {
        const q = searchKeyword.toLowerCase();
        const matchSearch =
          !q ||
          item.student?.fullName?.toLowerCase().includes(q) ||
          item.student?.studentCode?.toLowerCase().includes(q) ||
          item.topic?.title?.toLowerCase().includes(q) ||
          item.topic?.topicCode?.toLowerCase().includes(q);
        const matchStatus =
          statusFilter === "all" || item.__status === statusFilter;
        return matchSearch && matchStatus;
      });
  }, [rows, searchKeyword, statusFilter, templates.length]);

  const openDetail = async (row: DashboardRowView) => {
    const studentCode = String(row.student?.studentCode || "").trim();
    const userCode = String(row.student?.userCode || "").trim();
    if (!studentCode) {
      addToast("Không xác định được mã sinh viên để tải chi tiết.", "error");
      return;
    }

    setDetailLoading(true);
    setDetailTab("info");
    setHistoryItems([]);
    setHistoryTotalCount(0);
    setDetailModal({ isOpen: true, row });

    try {
      const query = new URLSearchParams();
      query.append("Page", "0");
      query.append("PageSize", "10");
      query.append("StudentCode", studentCode);

      const response = await fetchData<ApiResponse<DashboardDataPayload>>(
        `/reports/student/dashboard/get-list?${query.toString()}`,
        { method: "GET" },
      );

      if (!response?.success || !response.data) {
        throw new Error(
          response?.message || "Không thể tải chi tiết sinh viên.",
        );
      }

      const payload = response.data;
      const firstItem = normalizeItems(payload.items)[0];
      if (firstItem) {
        setDetailModal({
          isOpen: true,
          row: {
            ...firstItem,
            __status: row.__status,
            __progress: row.__progress,
          },
        });

        const resolvedUserCode = String(
          firstItem.student?.userCode || userCode,
        ).trim();
        if (resolvedUserCode) {
          setHistoryLoading(true);
          try {
            const historyRes = await fetchData<
              ApiResponse<ProgressHistoryPayload>
            >(
              `/reports/student/progress-history?userCode=${encodeURIComponent(
                resolvedUserCode,
              )}&page=1&pageSize=10`,
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
            }
          } catch {
            setHistoryItems([]);
            setHistoryTotalCount(0);
          } finally {
            setHistoryLoading(false);
          }
        }
      }
    } catch (error) {
      addToast(
        error instanceof Error
          ? error.message
          : "Không thể tải chi tiết sinh viên.",
        "error",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailModal({ isOpen: false });
  };

  const openCreate = async () => {
    try {
      const { data } = await requestApiData<Record<string, unknown>>(
        "/StudentProfiles/get-create",
        { method: "GET" },
        "Không thể tải mẫu tạo mới.",
      );
      setFormValues(toFormRecord(data || {}));
    } catch {
      setFormValues(toFormRecord({}));
    }
    setEditingCode("");
    setActiveModal("create");
  };

  const openEdit = async (row: DashboardRowView) => {
    const code = String(row.student?.studentCode || "").trim();
    if (!code) {
      addToast("Không xác định được mã sinh viên để cập nhật.", "error");
      return;
    }
    try {
      const { data } = await requestApiData<Record<string, unknown>>(
        `/StudentProfiles/get-update/${encodeURIComponent(code)}`,
        { method: "GET" },
        "Không thể tải dữ liệu cập nhật.",
      );
      setFormValues(toFormRecord(data || {}));
      setEditingCode(code);
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

  const handleDelete = async (row: DashboardRowView) => {
    const code = String(row.student?.studentCode || "").trim();
    if (!code) {
      addToast("Không xác định được mã sinh viên để xóa.", "error");
      return;
    }

    if (!window.confirm("Bạn chắc chắn muốn xóa bản ghi này?")) {
      return;
    }

    try {
      await requestApiData<unknown>(
        `/StudentProfiles/delete/${encodeURIComponent(code)}`,
        { method: "DELETE" },
        "Không thể xóa bản ghi.",
      );
      addToast("Xóa dữ liệu thành công.", "success");
      setRefreshTick((prev) => prev + 1);
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Không thể xóa bản ghi.",
        "error",
      );
    }
  };

  const handleSubmit = async () => {
    const payload = toPayload(formValues);
    const requiredField = profileFields.find((field) => {
      if (!field.required) return false;
      const value = payload[field.name];
      return !value || String(value).trim() === "";
    });

    if (requiredField) {
      addToast(`Trường ${requiredField.label} là bắt buộc.`, "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeModal === "create") {
        await requestApiData<unknown>(
          "/StudentProfiles/create",
          { method: "POST", body: payload },
          "Không thể tạo bản ghi.",
        );
        addToast("Tạo mới thành công.", "success");
      }

      if (activeModal === "edit") {
        await requestApiData<unknown>(
          `/StudentProfiles/update/${encodeURIComponent(editingCode)}`,
          { method: "PUT", body: payload },
          "Không thể cập nhật bản ghi.",
        );
        addToast("Cập nhật thành công.", "success");
      }

      setActiveModal(null);
      setRefreshTick((prev) => prev + 1);
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Không thể lưu dữ liệu.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const detailStudent = detailModal.row;
  const detailTopicTags = detailStudent?.topicTags ?? [];
  const detailSupervisorTags = detailStudent?.supervisorTags ?? [];
  const detailMilestones = useMemo(() => {
    const fallbackCodes = ["MS_REG", "MS_PROG1", "MS_PROG2", "MS_FULL"];
    const templateCodes = [...templates]
      .sort((a, b) => a.ordinal - b.ordinal)
      .slice(0, 4)
      .map((item) => item.milestoneTemplateCode);
    const codes = templateCodes.length === 4 ? templateCodes : fallbackCodes;

    const currentCode =
      detailStudent?.currentMilestone?.milestoneTemplateCode || "";
    const currentOrdinal = Number(
      detailStudent?.currentMilestone?.ordinal || 0,
    );
    const currentState = detailStudent?.currentMilestone?.state;

    const completedAtValues = [
      detailStudent?.currentMilestone?.completedAt1,
      detailStudent?.currentMilestone?.completedAt2,
      detailStudent?.currentMilestone?.completedAt3,
      detailStudent?.currentMilestone?.completedAt4,
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
    detailStudent?.currentMilestone?.milestoneTemplateCode,
    detailStudent?.currentMilestone?.ordinal,
    detailStudent?.currentMilestone?.state,
    detailStudent?.currentMilestone?.completedAt1,
    detailStudent?.currentMilestone?.completedAt2,
    detailStudent?.currentMilestone?.completedAt3,
    detailStudent?.currentMilestone?.completedAt4,
  ]);

  const getLecturerStateLabel = (state?: string): string => {
    const value = (state || "").toUpperCase();
    if (value === "APPROVED") return "Đã duyệt";
    if (value === "REJECTED") return "Từ chối";
    if (value === "PENDING") return "Chờ duyệt";
    return state || "--";
  };

  return (
    <div className="student-profiles-module">
      <div className="spm-header">
        <h1>
          <Users size={30} color="#F37021" /> Danh sách sinh viên
        </h1>
        <p>Hiển thị theo dashboard báo cáo sinh viên và tiến độ đề tài.</p>
      </div>

      <div className="spm-toolbar">
        <div className="spm-search-wrap">
          <Search size={16} />
          <input
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
            }}
            placeholder="Tìm kiếm sinh viên, đề tài, mã đề tài..."
          />
        </div>

        <div className="spm-actions-wrap">
          <button type="button" className="spm-create-btn" onClick={openCreate}>
            <Plus size={14} /> Thêm mới
          </button>
          <div className="spm-filter-wrap">
            <Filter size={16} />
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="revision">Cần sửa đổi</option>
              <option value="defense-ready">Chờ bảo vệ</option>
              <option value="committee-assigned">đã có HĐ</option>
              <option value="rejected">Từ chối</option>
            </select>
          </div>
          <ImportExportActions
            moduleName="students"
            moduleLabel="Quản lý sinh viên"
            onImportSuccess={() => {
              setPage(1);
              setRefreshTick((prev) => prev + 1);
            }}
          />
        </div>
      </div>

      <div className="spm-table-wrap">
        <table className="spm-table">
          <thead>
            <tr>
              <th>SINH VIÊN</th>
              <th>LIÊN HỆ</th>
              <th>ĐỀ TÀI</th>
              <th>TRẠNG THÁI</th>
              <th>TIẾN ĐỘ</th>
              <th>NGÀY ĐĂNG KÝ</th>
              <th>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7}>Đang tải dữ liệu...</td>
              </tr>
            ) : rowsView.length === 0 ? (
              <tr>
                <td colSpan={7}>Không có dữ liệu.</td>
              </tr>
            ) : (
              rowsView.map((row) => (
                <tr
                  key={`${row.student.studentProfileID}-${row.topic?.topicID || 'none'}`}
                  className="spm-row"
                >
                  <td>
                    <div className="spm-student-cell">
                      <div className="spm-avatar-wrap">
                        {row.student.studentImage ? (
                          <img
                            src={getAvatarUrl(row.student.studentImage)}
                            alt={row.student.fullName}
                            className="spm-avatar"
                            loading="lazy"
                          />
                        ) : (
                          <div className="spm-avatar-fallback">
                            {row.student.fullName?.charAt(0) || "S"}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="spm-student-name">
                          {row.student.fullName}
                        </div>
                        <div className="spm-student-code">
                          {row.student.studentCode}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="spm-muted">
                      {row.student.studentEmail || "--"}
                    </div>
                    <div className="spm-subtle">
                      {row.student.phoneNumber || "--"}
                    </div>
                  </td>

                  <td>
                    <div className="spm-table-topic-title">
                      {row.topic?.title || "Chưa có đề tài"}
                    </div>
                    <div className="spm-subtle">{row.topic?.topicCode || "--"}</div>
                  </td>

                  <td>
                    <span className={`spm-status spm-status-${row.__status}`}>
                      {row.__status === "approved" && <CheckCircle size={14} />}
                      {row.__status === "pending" && <Clock size={14} />}
                      {(row.__status === "revision" ||
                        row.__status === "rejected") && (
                        <AlertCircle size={14} />
                      )}
                      {row.__status === "defense-ready" && (
                        <ShieldCheck size={14} />
                      )}
                      {row.__status === "committee-assigned" && (
                        <BookOpen size={14} />
                      )}
                      {row.__status === "none" && <Circle size={14} />}
                      {getStatusText(row.__status)}
                    </span>
                  </td>

                  <td>
                    <div className="spm-progress-cell">
                      <div className="spm-progress-track">
                        <div
                          className="spm-progress-fill"
                          style={{ width: `${row.__progress}%` }}
                        />
                      </div>
                      <strong>{row.__progress}%</strong>
                    </div>
                  </td>

                  <td>{row.topic ? formatDate(row.topic.createdAt) : "--"}</td>

                  <td>
                    <div className="spm-action-buttons">
                      <button
                        type="button"
                        className="spm-detail-btn"
                        onClick={() => void openDetail(row)}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        className="spm-edit-btn"
                        onClick={() => void openEdit(row)}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        className="spm-delete-btn"
                        onClick={() => void handleDelete(row)}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="spm-paging">
        <div>
          Tổng bản ghi: <strong>{totalCount}</strong>
        </div>
        <div className="spm-paging-controls">
          <label>
            Page size
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>

          <button
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Trước
          </button>
          <span>
            Trang {page} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount || isLoading}
            onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
          >
            Sau
          </button>
        </div>
      </div>

      {detailModal.isOpen && detailModal.row && (
        <div className="spm-modal-overlay" onClick={closeDetail}>
          <div
            className="spm-modal spm-detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="spm-close" onClick={closeDetail}>
              x
            </button>

            <div className="spm-detail-shell">
              <div className="spm-detail-header">
                <div className="spm-detail-header-left">
                  {detailModal.row.student.studentImage ? (
                    <img
                      src={getAvatarUrl(detailModal.row.student.studentImage)}
                      alt={detailModal.row.student.fullName}
                      className="spm-avatar-lg"
                    />
                  ) : (
                    <div className="spm-avatar-fallback spm-avatar-lg-fallback">
                      {detailModal.row.student.fullName?.charAt(0) || "S"}
                    </div>
                  )}
                  <div className="spm-detail-header-text">
                    <h3>{detailModal.row.student.fullName}</h3>
                    <p>
                      {detailModal.row.student.studentCode} •{" "}
                      {detailModal.row.student.userCode}
                    </p>
                    <div className="spm-detail-subline">
                      <span
                        className={`spm-status spm-status-${detailModal.row.__status}`}
                      >
                        {detailModal.row.__status === "defense-ready" && (
                          <ShieldCheck size={14} />
                        )}
                        {detailModal.row.__status === "committee-assigned" && (
                          <BookOpen size={14} />
                        )}
                        {detailModal.row.student.status
                          ? getStatusText(detailModal.row.student.status)
                          : getStatusText(detailModal.row.__status)}
                      </span>
                      <span className="spm-detail-gpa">
                        GPA {detailModal.row.student.gpa ?? "--"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="spm-detail-header-actions">
                  <button
                    type="button"
                    className="spm-edit-btn"
                    onClick={() => {
                      void openEdit(detailModal.row as DashboardRowView);
                      closeDetail();
                    }}
                  >
                    <Edit size={13} />
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="spm-delete-btn"
                    onClick={closeDetail}
                  >
                    Đóng
                  </button>
                </div>
              </div>

              <div className="spm-detail-tabs">
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
                  className={detailTab === "supervisor" ? "is-active" : ""}
                  onClick={() => setDetailTab("supervisor")}
                >
                  <Users size={14} />
                  Giảng viên
                </button>
                <button
                  type="button"
                  className={detailTab === "topic" ? "is-active" : ""}
                  onClick={() => setDetailTab("topic")}
                >
                  <BookOpen size={14} />
                  Đề tài
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

              <div className="spm-detail-body">
                {detailLoading ? (
                  <div className="spm-detail-loading">Đang tải chi tiết...</div>
                ) : (
                  <>
                    {detailTab === "info" && (
                      <div className="spm-detail-columns">
                        <div className="spm-detail-column">
                          <div className="spm-detail-section spm-info-card">
                            <h4>Thông tin cá nhân</h4>
                            <div className="spm-detail-list">
                              <div>
                                <span>Email</span>
                                <strong>
                                  {detailModal.row.student.studentEmail || "--"}
                                </strong>
                              </div>
                              <div>
                                <span>SĐT</span>
                                <strong>
                                  {detailModal.row.student.phoneNumber || "--"}
                                </strong>
                              </div>
                              <div>
                                <span>Giới tính</span>
                                <strong>
                                  {detailModal.row.student.gender || "--"}
                                </strong>
                              </div>
                              <div>
                                <span>Ngày sinh</span>
                                <strong>
                                  {formatDate(
                                    detailModal.row.student.dateOfBirth,
                                  ) || "--"}
                                </strong>
                              </div>
                              <div>
                                <span>Địa chỉ</span>
                                <strong>
                                  {detailModal.row.student.address || "--"}
                                </strong>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="spm-detail-column">
                          <div className="spm-detail-section spm-info-card">
                            <h4>Học tập</h4>
                            <div className="spm-detail-list">
                              <div>
                                <span>Khoa</span>
                                <strong>
                                  {detailModal.row.student.departmentCode ||
                                    "--"}
                                </strong>
                              </div>
                              <div>
                                <span>Lớp</span>
                                <strong>
                                  {detailModal.row.student.classCode || "--"}
                                </strong>
                              </div>
                              <div>
                                <span>Niên khóa</span>
                                <strong>
                                  {detailModal.row.student.enrollmentYear ||
                                    "--"}
                                </strong>
                              </div>
                              <div>
                                <span>GPA</span>
                                <strong>
                                  {detailModal.row.student.gpa ?? "--"}
                                </strong>
                              </div>
                              <div>
                                <span>Xếp loại</span>
                                <strong>
                                  {detailModal.row.student.academicStanding ||
                                    "--"}
                                </strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {detailTab === "supervisor" && (
                      <div className="spm-supervisor-layout">
                        <div className="spm-detail-section spm-info-card spm-supervisor-card">
                          <h4>Giảng viên hướng dẫn</h4>
                          <div className="spm-detail-list spm-supervisor-list">
                            <div>
                              <span>Họ tên</span>
                              <strong>
                                {detailModal.row.supervisor?.fullName || "--"}
                              </strong>
                            </div>
                            <div>
                              <span>Mã GV</span>
                              <strong>
                                {detailModal.row.supervisor?.lecturerCode ||
                                  "--"}
                              </strong>
                            </div>
                            <div>
                              <span>Học vị</span>
                              <strong>
                                {detailModal.row.supervisor?.degree || "--"}
                              </strong>
                            </div>
                          </div>

                          <div className="spm-guide-quota">
                            <div className="spm-guide-quota-row">
                              <span>Chỉ tiêu hướng dẫn</span>
                              <strong>
                                {detailModal.row.supervisor
                                  ? `${detailModal.row.supervisor.currentGuidingCount || 0} / ${detailModal.row.supervisor.guideQuota || 0}`
                                  : "--"}
                              </strong>
                            </div>
                            <div className="spm-progress-track spm-progress-track-lg">
                              <div
                                className="spm-progress-fill"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.round(
                                      ((detailModal.row.supervisor
                                        ?.currentGuidingCount || 0) /
                                        Math.max(
                                          1,
                                          detailModal.row.supervisor
                                            ?.guideQuota || 1,
                                        )) *
                                        100,
                                    ),
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="spm-detail-section spm-info-card spm-supervisor-card">
                          <h4>Liên hệ & Chuyên ngành</h4>
                          <div className="spm-detail-list spm-supervisor-list">
                            <div>
                              <span>Email</span>
                              <strong>
                                {detailModal.row.supervisor?.email || "--"}
                              </strong>
                            </div>
                            <div>
                              <span>SĐT</span>
                              <strong>
                                {detailModal.row.supervisor?.phoneNumber ||
                                  "--"}
                              </strong>
                            </div>
                            <div className="spm-supervisor-specialty-row">
                              <span>Chuyên ngành</span>
                              {detailSupervisorTags.length > 0 ? (
                                <div className="spm-tag-wrap spm-tag-wrap-compact spm-supervisor-tags">
                                  {detailSupervisorTags.map((tag) => (
                                    <span key={tag.tagCode} className="spm-tag">
                                      {tag.tagName}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <strong>--</strong>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {detailTab === "topic" && (
                      <div className="spm-progress-panel">
                        <div className="spm-detail-section spm-topic-hero">
                          {detailModal.row.topic ? (
                            <div className="spm-topic-panel">
                              <strong className="spm-detail-topic-title">
                                {detailModal.row.topic.title}
                              </strong>

                              <div className="spm-topic-layout">
                                <div className="spm-topic-layout-left">
                                  <div className="spm-topic-field">
                                    <span className="spm-topic-field-label">
                                      Mã đề tài:
                                    </span>
                                    <strong>
                                      {detailModal.row.topic.topicCode}
                                    </strong>
                                  </div>

                                  <div className="spm-topic-field spm-topic-field-summary">
                                    <span className="spm-topic-field-label">
                                      Mô tả:
                                    </span>
                                    <p>{detailModal.row.topic.summary || "--"}</p>
                                  </div>
                                </div>

                                <div className="spm-topic-layout-right">
                                  <div className="spm-topic-meta-row">
                                    <span className="spm-topic-meta-label">
                                      Trạng thái:
                                    </span>
                                    <span
                                      className={`spm-status spm-status-${detailModal.row.__status}`}
                                    >
                                      {detailModal.row.topic.status}
                                    </span>
                                  </div>

                                  <div className="spm-topic-meta-row">
                                    <span className="spm-topic-meta-label">
                                      Tags:
                                    </span>
                                    {detailTopicTags.length > 0 ? (
                                      <div className="spm-tag-wrap spm-tag-wrap-compact">
                                        {detailTopicTags.map((tag) => (
                                          <span
                                            key={tag.tagCode}
                                            className="spm-tag"
                                          >
                                            {tag.tagName}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="spm-topic-meta-empty">
                                        --
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="spm-topic-empty-state">
                              <BookOpen size={48} className="spm-empty-icon" />
                              <p>Sinh viên này hiện chưa đăng ký đề tài tốt nghiệp.</p>
                            </div>
                          )}
                        </div>

                        <div className="spm-detail-section">
                          <div className="spm-timeline-horizontal">
                            {detailMilestones.map((milestone) => (
                              <div
                                key={milestone.code}
                                className={`spm-timeline-step ${milestone.isCurrent ? "is-current" : ""} ${milestone.isCompleted ? "is-completed" : ""}`}
                              >
                                <div className="spm-timeline-node">
                                  {milestone.isCompleted ? (
                                    <Check size={16} />
                                  ) : milestone.isCurrent ? (
                                    <Clock3 size={15} />
                                  ) : (
                                    <Circle size={11} />
                                  )}
                                </div>
                                <div className="spm-timeline-step-body">
                                  <strong>
                                    {milestone.code} - {milestone.label}
                                  </strong>
                                  <span className="spm-timeline-state">
                                    {milestone.isCompleted
                                      ? "Đã xong"
                                      : milestone.isCurrent
                                        ? "Đang làm"
                                        : "Chưa làm"}
                                  </span>
                                  <span className="spm-timeline-time">
                                    Hoàn thành:{" "}
                                    {formatDateTime(milestone.completedAt)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {detailTab === "history" && (
                      <div className="spm-progress-panel">
                        <div className="spm-detail-section">
                          <h4>Lịch sử báo cáo</h4>
                          {historyLoading ? (
                            <div className="spm-detail-loading">
                              Đang tải lịch sử báo cáo...
                            </div>
                          ) : historyItems.length === 0 ? (
                            <div className="spm-history-empty">
                              Chưa có báo cáo nào.
                            </div>
                          ) : (
                            <div className="spm-history-list">
                              {historyItems.map((item) => {
                                const submission = item.submission;
                                const files = submission.files ?? [];
                                return (
                                  <article
                                    key={submission.submissionID}
                                    className="spm-history-item"
                                  >
                                    <header className="spm-history-head">
                                      <div>
                                        <h5>
                                          {submission.reportTitle ||
                                            submission.submissionCode}
                                        </h5>
                                        <p>
                                          {submission.submissionCode} •{" "}
                                          {submission.milestoneCode}
                                        </p>
                                      </div>
                                      <span className="spm-history-badge">
                                        {getLecturerStateLabel(
                                          submission.lecturerState,
                                        )}
                                      </span>
                                    </header>

                                    <div className="spm-history-meta-grid">
                                      <div className="spm-history-meta-item">
                                        <span>Nộp lúc</span>
                                        <strong>
                                          {formatDateTime(
                                            submission.submittedAt,
                                          )}
                                        </strong>
                                      </div>
                                      <div className="spm-history-meta-item">
                                        <span>Cập nhật</span>
                                        <strong>
                                          {formatDateTime(
                                            submission.lastUpdated,
                                          )}
                                        </strong>
                                      </div>
                                      <div className="spm-history-meta-item">
                                        <span>Lần nộp</span>
                                        <strong>
                                          {submission.attemptNumber ?? "--"}
                                        </strong>
                                      </div>
                                      <div className="spm-history-meta-item">
                                        <span>Feedback</span>
                                        <strong>
                                          {submission.feedbackLevel || "--"}
                                        </strong>
                                      </div>
                                    </div>

                                    <div className="spm-history-content-grid">
                                      <div className="spm-history-block">
                                        <span className="spm-history-block-label">
                                          Mô tả báo cáo
                                        </span>
                                        <p className="spm-history-desc">
                                          {submission.reportDescription ||
                                            "Không có mô tả."}
                                        </p>
                                      </div>

                                      <div className="spm-history-block">
                                        <span className="spm-history-block-label">
                                          Nhận xét giảng viên
                                        </span>
                                        <p className="spm-history-comment">
                                          {submission.lecturerComment ||
                                            "Chưa có nhận xét."}
                                        </p>
                                      </div>
                                    </div>

                                    {files.length > 0 && (
                                      <div className="spm-history-files">
                                        {files.map((file) => (
                                          <a
                                            key={file.fileID}
                                            href={normalizeUrl(file.fileURL)}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            {file.fileName}
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </article>
                                );
                              })}
                            </div>
                          )}

                          <div className="spm-history-footer">
                            Tổng báo cáo: <strong>{historyTotalCount}</strong>
                          </div>
                        </div>
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
        <div className="spm-modal-overlay" onClick={() => setActiveModal(null)}>
          <div
            className="spm-modal spm-form-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="spm-close" onClick={() => setActiveModal(null)}>
              x
            </button>

            <div className="spm-modal-header">
              <div>
                <h3>
                  {activeModal === "create"
                    ? "Tạo hồ sơ sinh viên"
                    : "Cập nhật hồ sơ sinh viên"}
                </h3>
                <p>Nhập dữ liệu theo schema StudentProfiles.</p>
              </div>
            </div>

            <ManagementSectionedFormBody
              sections={editFieldSections}
              values={formValues}
              getFieldDefinition={getFieldDefinition}
              onFieldChange={(name, value) =>
                setFormValues((prev) => ({ ...prev, [name]: value }))
              }
            />

            <div className="spm-form-actions">
              <button
                type="button"
                className="spm-cancel-btn"
                onClick={() => setActiveModal(null)}
                disabled={isSubmitting}
              >
                Đóng
              </button>
              <button
                type="button"
                className="spm-save-btn"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentProfilesManagement;
