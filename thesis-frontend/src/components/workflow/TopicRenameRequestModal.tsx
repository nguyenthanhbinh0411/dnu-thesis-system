import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FC } from "react";
import {
  AlertCircle,
  CheckCircle,
  Download,
  Edit,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
  History,
  FilePlus,
  Send,
  User,
  Calendar as CalendarIcon,
  ChevronRight,
  ArrowRight,
  FileCheck,
  Clock,
  Info,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FetchDataError, normalizeUrl } from "../../api/fetchData";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/useToast";
import {
  ROLE_ADMIN,
  ROLE_LECTURER,
  ROLE_STUDENT,
  normalizeRole,
} from "../../utils/role";
import {
  createTopicRenameRequest,
  deleteTopicRenameRequest,
  deleteTopicRenameRequestTemplate,
  generateTopicRenameRequestTemplate,
  getTopicRenameRequestCreateTemplate,
  getLecturerProfileByUserCode,
  getTopicRenameRequestDetail,
  getTopicRenameRequestUpdateTemplate,
  getStudentProfileByUserCode,
  listTopicRenameRequests,
  parseTopicRenameDetail,
  reviewTopicRenameRequest,
  updateTopicRenameRequest,
} from "../../services/topic-rename-request.service";
import type { LecturerProfile } from "../../types/lecturer-profile";
import type {
  TopicRenameRequestCreateDto,
  TopicRenameRequestCreateFormData,
  TopicRenameRequestDetailDto,
  TopicRenameRequestFileReadDto,
  TopicRenameRequestListItem,
  TopicRenameRequestReviewAction,
  TopicRenameRequestReviewDto,
  TopicRenameRequestUpdateFormData,
} from "../../types/topic-rename-request";
import type { StudentProfile } from "../../types/studentProfile";

type TopicContext = {
  topicID?: number | null;
  topicCode?: string | null;
  title?: string | null;
  proposerUserCode?: string | null;
  supervisorUserCode?: string | null;
};

type PanelMode = "detail" | "create" | "edit" | "review";

type CreateTemplateContext = {
  studentProfile: StudentProfile | null;
  lecturerProfile: LecturerProfile | null;
  proposerUserCode: string | null;
  supervisorUserCode: string | null;
  reviewedByUserCode: string | null;
  reviewedByRole: string | null;
};

type ListFilterState = {
  topicID: string;
  topicCode: string;
  status: string;
  requestedByUserCode: string;
  reviewedByUserCode: string;
  oldTitle: string;
  newTitle: string;
};

interface TopicRenameRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTopic?: TopicContext | null;
  initialMode?: PanelMode;
}

const initialListFilters: ListFilterState = {
  topicID: "",
  topicCode: "",
  status: "",
  requestedByUserCode: "",
  reviewedByUserCode: "",
  oldTitle: "",
  newTitle: "",
};

const initialCreateForm: TopicRenameRequestCreateFormData = {
  topicID: "",
  topicCode: "",
  newTitle: "",
  reason: "",
};

const initialUpdateForm: TopicRenameRequestUpdateFormData = {
  newTitle: "",
  reason: "",
};

const initialCreateTemplateContext: CreateTemplateContext = {
  studentProfile: null,
  lecturerProfile: null,
  proposerUserCode: null,
  supervisorUserCode: null,
  reviewedByUserCode: null,
  reviewedByRole: null,
};

const modalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 120,
    background: "rgba(15, 23, 42, 0.4)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  } satisfies CSSProperties,
  card: {
    width: "min(1400px, 100%)",
    height: "min(850px, 92vh)",
    background: "rgba(255, 255, 255, 0.95)",
    borderRadius: 32,
    border: "1px solid rgba(255, 255, 255, 0.3)",
    boxShadow: "0 40px 100px -20px rgba(0, 0, 0, 0.15), 0 20px 40px -10px rgba(0, 0, 0, 0.05)",
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    overflow: "hidden",
  } satisfies CSSProperties,
  sidebar: {
    background: "linear-gradient(165deg, #0f172a 0%, #1e293b 100%)",
    padding: "32px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 24,
    color: "#fff",
    borderRight: "1px solid rgba(255, 255, 255, 0.05)",
  } satisfies CSSProperties,
  content: {
    display: "flex",
    flexDirection: "column",
    background: "#f8fafc",
    overflow: "hidden",
  } satisfies CSSProperties,
  header: {
    padding: "24px 40px",
    background: "#fff",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  } satisfies CSSProperties,
  body: {
    flex: 1,
    padding: "32px 40px 120px",
    overflowY: "auto",
    display: "grid",
    gap: 32,
    alignContent: "start",
  } satisfies CSSProperties,
  footer: {
    padding: "20px 40px",
    background: "#fff",
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
  } satisfies CSSProperties,
};

const cardStyles = {
  section: {
    background: "#fff",
    borderRadius: 24,
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)",
    transition: "all 0.3s ease",
  } satisfies CSSProperties,
  sectionHeader: {
    padding: "20px 24px",
    background: "#fff",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } satisfies CSSProperties,
  sectionBody: {
    padding: "32px 40px",
    display: "grid",
    gap: 32,
  } satisfies CSSProperties,
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: "#f8fafc",
  border: "2px solid #e2e8f0",
  borderRadius: 16,
  padding: "14px 18px",
  fontSize: "15px",
  fontWeight: 600,
  color: "#1e293b",
  transition: "all 0.2s ease",
  outline: "none",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 140,
  resize: "none",
};

const actionButtonBase = {
  padding: "12px 24px",
  borderRadius: 16,
  fontSize: "14px",
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  border: "none",
} satisfies CSSProperties;

const actionButtonPrimary = {
  ...actionButtonBase,
  background: "#f37021",
  color: "#fff",
  boxShadow: "0 10px 20px -5px rgba(243, 112, 33, 0.3)",
} satisfies CSSProperties;

const actionButtonGhost = {
  ...actionButtonBase,
  background: "#f1f5f9",
  color: "#475569",
} satisfies CSSProperties;

const actionButtonDanger = {
  ...actionButtonBase,
  background: "#fef2f2",
  color: "#dc2626",
} satisfies CSSProperties;

const badgeStyle = (tone: string) => {
  const palette = statusPalette(tone as any);
  return {
    padding: "6px 14px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    background: palette.bg,
    color: palette.text,
    border: `1px solid ${palette.border}20`,
  };
};

const documentStyles = {
  paper: {
    width: "100%",
    maxWidth: "850px",
    margin: "0 auto",
    background: "#fff",
    padding: "40px 60px",
    borderRadius: "2px",
    color: "#000",
    fontFamily: "'Times New Roman', Times, serif",
    fontSize: "15px",
    lineHeight: "1.3",
    border: "1px solid #e2e8f0",
  } satisfies CSSProperties,
  header: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr",
    marginBottom: "30px",
  } satisfies CSSProperties,
  title: {
    textAlign: "center" as const,
    fontSize: "20px",
    fontWeight: "bold",
    textTransform: "uppercase" as const,
    margin: "30px 0",
  } satisfies CSSProperties,
  section: {
    marginBottom: "8px",
    display: "flex",
    alignItems: "baseline",
  } satisfies CSSProperties,
  label: {
    fontWeight: "normal",
    whiteSpace: "nowrap" as const,
    marginRight: "8px",
  } satisfies CSSProperties,
  field: {
    borderBottom: "1px dotted #000",
    flex: 1,
    paddingLeft: "4px",
    minHeight: "20px",
  } satisfies CSSProperties,
  signature: {
    marginTop: "50px",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    textAlign: "center" as const,
  } satisfies CSSProperties,
};

function formatDocDate(val: string | null | undefined): string {
  if (!val) return "....................";
  const str = String(val);
  if (str.includes("T")) return str.split("T")[0].split("-").reverse().join("/");
  return str;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readField(
  record: Record<string, unknown> | null | undefined,
  keys: string[],
  fallback = "",
): string {
  if (!record) return fallback;
  for (const key of keys) {
    const exact = record[key];
    if (exact !== undefined && exact !== null && String(exact).trim()) {
      return String(exact).trim();
    }
    const matchedKey = Object.keys(record).find(
      (candidate) => candidate.toLowerCase() === key.toLowerCase(),
    );
    if (matchedKey) {
      const value = record[matchedKey];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }
  }
  return fallback;
}

type FieldLookup = Map<string, string>;

function buildFieldLookup(
  record: Record<string, unknown> | null | undefined,
): FieldLookup {
  const lookup = new Map<string, string>();
  if (!record) return lookup;

  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object") continue;

    const text = String(value).trim();
    if (!text) continue;

    lookup.set(key.toLowerCase(), text);
    if (!lookup.has(key)) {
      lookup.set(key, text);
    }
  }

  return lookup;
}

function readFieldFromLookup(
  lookup: FieldLookup,
  keys: string[],
  fallback = "",
): string {
  for (const key of keys) {
    const exact = lookup.get(key);
    if (exact) return exact;

    const matched = lookup.get(key.toLowerCase());
    if (matched) return matched;
  }
  return fallback;
}

function normalizeStatusTone(
  status: string | null | undefined,
): "pending" | "approved" | "rejected" | "default" {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();
  if (normalized.includes("pending") || normalized.includes("chờ") || normalized.includes("yêu cầu"))
    return "pending";
  if (
    normalized.includes("approved") ||
    normalized.includes("applied") ||
    normalized.includes("duyet") ||
    normalized.includes("đã duyệt")
  )
    return "approved";
  if (
    normalized.includes("rejected") ||
    normalized.includes("từ chối") ||
    normalized.includes("reject")
  )
    return "rejected";
  return "default";
}

function statusPalette(tone: "pending" | "approved" | "rejected" | "default"): {
  bg: string;
  text: string;
  border: string;
} {
  switch (tone) {
    case "pending":
      return { bg: "#fff7ed", text: "#9a3412", border: "#f37021" };
    case "approved":
      return { bg: "#f0fdf4", text: "#166534", border: "#16a34a" };
    case "rejected":
      return { bg: "#fef2f2", text: "#991b1b", border: "#dc2626" };
    default:
      return { bg: "#f8fafc", text: "#475569", border: "#94a3b8" };
  }
}

function isEditableStatus(status: string): boolean {
  const tone = normalizeStatusTone(status);
  return tone === "pending" || tone === "rejected";
}

function isPendingStatus(status: string): boolean {
  return normalizeStatusTone(status) === "pending";
}

function isAppliedStatus(status: string): boolean {
  return normalizeStatusTone(status) === "approved";
}

function extractValidationMessages(error: unknown): Record<string, string> {
  if (!(error instanceof FetchDataError)) {
    return {};
  }

  const payload = error.data as Record<string, unknown> | null | undefined;
  const validation = payload?.errors || payload?.Errors;
  if (
    !validation ||
    typeof validation !== "object" ||
    Array.isArray(validation)
  ) {
    return {};
  }

  return Object.entries(validation as Record<string, unknown>).reduce<
    Record<string, string>
  >((accumulator, [key, value]) => {
    if (Array.isArray(value) && value.length > 0) {
      accumulator[key] = String(value[0] ?? "").trim();
    } else if (typeof value === "string" && value.trim()) {
      accumulator[key] = value.trim();
    }
    return accumulator;
  }, {});
}



function formatDisplay(value: unknown, placeholder = "-"): string {
  const text = String(value ?? "").trim();
  return text || placeholder;
}

function isSameFileEntry(
  left: TopicRenameRequestFileReadDto | null | undefined,
  right: TopicRenameRequestFileReadDto | null | undefined,
): boolean {
  if (!left || !right) return false;

  const leftUrl = String(left.fileUrl ?? "").trim();
  const rightUrl = String(right.fileUrl ?? "").trim();
  if (leftUrl && rightUrl && leftUrl === rightUrl) {
    return true;
  }

  const leftName = String(left.fileName ?? "").trim();
  const rightName = String(right.fileName ?? "").trim();
  if (leftName && rightName && leftName === rightName) {
    return true;
  }

  return false;
}

function pickFirstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function getRequestId(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const value =
    record.topicRenameRequestID ??
    record.topicRenameRequestId ??
    record.TopicRenameRequestID ??
    record.TopicRenameRequestId ??
    record.requestID ??
    record.requestId ??
    record.RequestID ??
    record.RequestId ??
    record.id ??
    record.Id;
  const numberValue = toNumber(value);
  return numberValue;
}

const TopicRenameRequestModal: FC<TopicRenameRequestModalProps> = ({
  isOpen,
  onClose,
  currentTopic,
  initialMode = "detail",
}) => {
  const { addToast } = useToast();
  const auth = useAuth();
  const currentRole = normalizeRole(auth.user?.role);
  const canReview = currentRole === ROLE_ADMIN || currentRole === ROLE_LECTURER;
  const isStudentRole = currentRole === ROLE_STUDENT;

  const [panelMode, setPanelMode] = useState<PanelMode>(initialMode);
  const [listFilters, setListFilters] =
    useState<ListFilterState>(initialListFilters);
  const [requests, setRequests] = useState<TopicRenameRequestListItem[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(
    null,
  );
  const [detail, setDetail] = useState<TopicRenameRequestDetailDto | null>(
    null,
  );
  const [generatedFile, setGeneratedFile] =
    useState<TopicRenameRequestFileReadDto | null>(null);
  const [createForm, setCreateForm] =
    useState<TopicRenameRequestCreateFormData>(initialCreateForm);
  const [editForm, setEditForm] =
    useState<TopicRenameRequestUpdateFormData>(initialUpdateForm);
  const [createTemplateContext, setCreateTemplateContext] =
    useState<CreateTemplateContext>(initialCreateTemplateContext);
  const [reviewComment, setReviewComment] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingTemplateFile, setDeletingTemplateFile] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [showDocumentView, setShowDocumentView] = useState(false);
  const [reviewConfirmAction, setReviewConfirmAction] = useState<TopicRenameRequestReviewAction | null>(null);
  const [isReviewConfirmOpen, setIsReviewConfirmOpen] = useState(false);
  const [isDeleteFileConfirmOpen, setIsDeleteFileConfirmOpen] = useState(false);
  const studentProfileCacheRef = useRef(
    new Map<string, StudentProfile | null>(),
  );
  const lecturerProfileCacheRef = useRef(
    new Map<string, LecturerProfile | null>(),
  );

  const selectedRequest = useMemo(
    () =>
      requests.find(
        (item) => item.topicRenameRequestID === selectedRequestId,
      ) ?? null,
    [requests, selectedRequestId],
  );

  const selectedRequestOwnerCode = useMemo(() => {
    if (!selectedRequest) return "";
    return readField(
      selectedRequest.raw,
      [
        "requestedByUserCode",
        "RequestedByUserCode",
        "requesterCode",
        "RequesterCode",
        "createdByUserCode",
        "CreatedByUserCode",
        "createdBy",
        "CreatedBy",
      ],
      selectedRequest.requestedByUserCode,
    );
  }, [selectedRequest]);

  const selectedRequestStatus = useMemo(() => {
    if (selectedRequest) {
      return readField(
        selectedRequest.raw,
        ["status", "Status"],
        selectedRequest.status,
      );
    }
    return readField(detail?.request, ["status", "Status"], "");
  }, [detail?.request, selectedRequest]);

  const hasPendingRequest = useMemo(
    () => requests.some((item) => isPendingStatus(item.status)),
    [requests],
  );

  const activeDetail = detail?.request ?? selectedRequest?.raw ?? null;
  const currentStatus = selectedRequestStatus;
  const statusTone = normalizeStatusTone(currentStatus);
  const statusColors = statusPalette(statusTone);
  const activeRequestId =
    selectedRequestId ?? selectedRequest?.topicRenameRequestID ?? null;

  const canModifySelected =
    !!selectedRequest &&
    isStudentRole &&
    String(selectedRequestOwnerCode) === String(auth.user?.userCode ?? "");
  const canEditSelected = canModifySelected && isEditableStatus(currentStatus);
  const canDeleteSelected =
    canModifySelected &&
    isEditableStatus(currentStatus) &&
    !isAppliedStatus(currentStatus);
  const canReviewSelected = canReview && isPendingStatus(currentStatus);
  const hasActiveRequest =
    activeRequestId !== null && activeRequestId !== undefined;

  const defaultTopicID = currentTopic?.topicID ?? null;
  const defaultTopicCode = currentTopic?.topicCode ?? "";
  const defaultTopicTitle = currentTopic?.title ?? "";
  const topicProposerUserCode =
    currentTopic?.proposerUserCode ??
    readField(
      activeDetail,
      [
        "proposerUserCode",
        "ProposerUserCode",
        "requestedByUserCode",
        "RequestedByUserCode",
      ],
      "",
    );
  const topicSupervisorUserCode =
    currentTopic?.supervisorUserCode ??
    readField(
      activeDetail,
      [
        "supervisorUserCode",
        "SupervisorUserCode",
        "reviewedByUserCode",
        "ReviewedByUserCode",
      ],
      "",
    );

  const canCreateNew = isStudentRole && !hasPendingRequest;

  const loadTemplateContext = useCallback(
    async (
      proposerUserCode?: string | null,
      supervisorUserCode?: string | null,
    ) => {
      const normalizedProposerUserCode = String(proposerUserCode ?? "").trim();
      const normalizedSupervisorUserCode = String(
        supervisorUserCode ?? "",
      ).trim();

      if (!normalizedProposerUserCode && !normalizedSupervisorUserCode) {
        setCreateTemplateContext(initialCreateTemplateContext);
        return initialCreateTemplateContext;
      }

      const resolveStudentProfile = async (userCode: string) => {
        const normalizedUserCode = String(userCode ?? "").trim();
        if (!normalizedUserCode) return null;

        const cachedProfile =
          studentProfileCacheRef.current.get(normalizedUserCode);
        if (cachedProfile !== undefined) return cachedProfile;

        const profile = await getStudentProfileByUserCode(
          normalizedUserCode,
        ).catch(() => null);
        studentProfileCacheRef.current.set(normalizedUserCode, profile);
        return profile;
      };

      const resolveLecturerProfile = async (userCode: string) => {
        const normalizedUserCode = String(userCode ?? "").trim();
        if (!normalizedUserCode) return null;

        const cachedProfile =
          lecturerProfileCacheRef.current.get(normalizedUserCode);
        if (cachedProfile !== undefined) return cachedProfile;

        const profile = await getLecturerProfileByUserCode(
          normalizedUserCode,
        ).catch(() => null);
        lecturerProfileCacheRef.current.set(normalizedUserCode, profile);
        return profile;
      };

      const [studentProfile, lecturerProfile] = await Promise.all([
        normalizedProposerUserCode
          ? resolveStudentProfile(normalizedProposerUserCode)
          : Promise.resolve(null),
        normalizedSupervisorUserCode
          ? resolveLecturerProfile(normalizedSupervisorUserCode)
          : Promise.resolve(null),
      ]);

      const reviewedByUserCode =
        lecturerProfile?.userCode || normalizedSupervisorUserCode || null;
      const nextContext: CreateTemplateContext = {
        studentProfile,
        lecturerProfile,
        proposerUserCode:
          studentProfile?.userCode || normalizedProposerUserCode || null,
        supervisorUserCode:
          lecturerProfile?.userCode || normalizedSupervisorUserCode || null,
        reviewedByUserCode,
        reviewedByRole: reviewedByUserCode ? ROLE_LECTURER : null,
      };

      setCreateTemplateContext(nextContext);
      return nextContext;
    },
    [],
  );

  useEffect(() => {
    if (!isOpen) {
      setIsDeleteConfirmOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    void loadTemplateContext(topicProposerUserCode, topicSupervisorUserCode);
  }, [
    isOpen,
    loadTemplateContext,
    topicProposerUserCode,
    topicSupervisorUserCode,
  ]);

  const loadRequests = useCallback(async () => {
    setLoadingList(true);
    setBannerError(null);
    try {
      const topicIDFilter = listFilters.topicID.trim();
      const resolvedTopicID = topicIDFilter
        ? topicIDFilter
        : (defaultTopicID ?? undefined);

      const response = await listTopicRenameRequests({
        topicID: resolvedTopicID,
        topicCode:
          listFilters.topicCode.trim() || defaultTopicCode || undefined,
        status: listFilters.status.trim() || undefined,
        requestedByUserCode:
          listFilters.requestedByUserCode.trim() || undefined,
        reviewedByUserCode: listFilters.reviewedByUserCode.trim() || undefined,
        oldTitle: listFilters.oldTitle.trim() || undefined,
        newTitle: listFilters.newTitle.trim() || undefined,
        sortBy: "createdAt",
        sortDescending: true,
        page: 1,
        pageSize: 200,
      });

      setRequests(response.items);
      if (response.items.length === 0) {
        setSelectedRequestId(null);
        setDetail(null);
        return;
      }

      const nextSelected =
        (selectedRequestId &&
          response.items.find(
            (item) => item.topicRenameRequestID === selectedRequestId,
          )?.topicRenameRequestID) ||
        response.items[0].topicRenameRequestID;
      setSelectedRequestId(nextSelected);
    } catch (error) {
      if (error instanceof FetchDataError && error.status === 403) {
        setAccessDenied("Bạn không đủ quyền xem danh sách đơn xin đổi đề tài.");
      }
      setRequests([]);
      setSelectedRequestId(null);
      setDetail(null);
      setBannerError(
        error instanceof Error
          ? error.message
          : "Không thể tải danh sách đơn xin đổi đề tài.",
      );
    } finally {
      setLoadingList(false);
    }
  }, [
    defaultTopicCode,
    defaultTopicID,
    listFilters.oldTitle,
    listFilters.requestedByUserCode,
    listFilters.reviewedByUserCode,

    listFilters.status,
    listFilters.topicCode,
    listFilters.topicID,
    listFilters.newTitle,
    selectedRequestId,
  ]);

  const loadDetail = useCallback(async (id: number | null) => {
    if (!id) {
      setDetail(null);
      return;
    }

    setLoadingDetail(true);
    setBannerError(null);
    try {
      const response = await getTopicRenameRequestDetail(id);
      const parsed = parseTopicRenameDetail(response.data);
      setDetail(parsed);
      setGeneratedFile(null);
    } catch (error) {
      if (error instanceof FetchDataError && error.status === 404) {
        setBannerError("Không tìm thấy đơn xin đổi đề tài");
        setDetail(null);
        return;
      }
      if (error instanceof FetchDataError && error.status === 403) {
        setAccessDenied("Bạn không đủ quyền xem chi tiết đơn xin đổi đề tài.");
      }
      setBannerError(
        error instanceof Error
          ? error.message
          : "Không thể tải chi tiết đơn xin đổi đề tài.",
      );
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPanelMode(initialMode);
      setListFilters({
        ...initialListFilters,
        topicID: defaultTopicID ? String(defaultTopicID) : "",
        topicCode: defaultTopicCode,
      });
      setRequests([]);
      setSelectedRequestId(null);
      setDetail(null);
      setGeneratedFile(null);
      setCreateForm({
        topicID: defaultTopicID ? String(defaultTopicID) : "",
        topicCode: defaultTopicCode,
        newTitle: "",
        reason: "",
      });
      setCreateTemplateContext(initialCreateTemplateContext);
      setEditForm(initialUpdateForm);
      setReviewComment("");
      setPlaceOfBirth("");
      setBannerError(null);
      setFieldErrors({});
      setAccessDenied(null);
      return;
    }

    setPanelMode(initialMode);
    setListFilters({
      ...initialListFilters,
      topicID: defaultTopicID ? String(defaultTopicID) : "",
      topicCode: defaultTopicCode,
    });
    setCreateForm({
      topicID: defaultTopicID ? String(defaultTopicID) : "",
      topicCode: defaultTopicCode,
      newTitle: "",
      reason: "",
    });
    setCreateTemplateContext(initialCreateTemplateContext);
    setEditForm(initialUpdateForm);
    setReviewComment("");
    setPlaceOfBirth("");
    setGeneratedFile(null);
    setFieldErrors({});
    setBannerError(null);
    setAccessDenied(null);
    void loadRequests();
  }, [defaultTopicCode, defaultTopicID, initialMode, isOpen, loadRequests]);

  useEffect(() => {
    if (!isOpen) return;
    void loadDetail(selectedRequestId);
  }, [isOpen, loadDetail, selectedRequestId]);

  const openCreate = useCallback(async () => {
    if (hasPendingRequest) {
      setBannerError(
        "Bạn đang có đơn đổi đề tài ở trạng thái Pending nên không thể tạo mới thêm.",
      );
      return;
    }

    setLoadingForm(true);
    setFieldErrors({});
    setBannerError(null);
    try {
      const resolvedTemplateContext =
        createTemplateContext.studentProfile ||
        createTemplateContext.lecturerProfile ||
        createTemplateContext.reviewedByUserCode ||
        createTemplateContext.supervisorUserCode
          ? createTemplateContext
          : await loadTemplateContext(
              topicProposerUserCode,
              topicSupervisorUserCode,
            );
      const [response, createTemplateContextResult] = await Promise.all([
        getTopicRenameRequestCreateTemplate(),
        Promise.resolve(resolvedTemplateContext),
      ]);
      const payload = response.data ?? ({} as TopicRenameRequestCreateDto);
      setCreateForm({
        topicID:
          payload.topicID != null
            ? String(payload.topicID)
            : defaultTopicID
              ? String(defaultTopicID)
              : "",
        topicCode: payload.topicCode ?? defaultTopicCode ?? "",
        newTitle: payload.newTitle ?? "",
        reason: payload.reason ?? "",
      });
      setCreateTemplateContext(createTemplateContextResult);
      setPanelMode("create");
    } catch (error) {
      if (error instanceof FetchDataError && error.status === 403) {
        setAccessDenied("Bạn không đủ quyền tạo đơn xin đổi đề tài.");
      }
      setBannerError(
        error instanceof Error
          ? error.message
          : "Không thể tải dữ liệu tạo mới.",
      );
    } finally {
      setLoadingForm(false);
    }
  }, [
    createTemplateContext,
    defaultTopicCode,
    defaultTopicID,
    hasPendingRequest,
    loadTemplateContext,
    topicProposerUserCode,
    topicSupervisorUserCode,
  ]);

  const openEdit = useCallback(
    async (id: number | null) => {
      const requestId =
        id ??
        selectedRequestId ??
        selectedRequest?.topicRenameRequestID ??
        null;
      if (requestId === null || requestId === undefined) return;

      setFieldErrors({});
      setBannerError(null);
      setLoadingForm(true);
      try {
        const response = await getTopicRenameRequestUpdateTemplate(requestId);
        const payload = response.data ?? { newTitle: "", reason: "" };
        setEditForm({
          newTitle: String(
            payload.newTitle ?? selectedRequest?.newTitle ?? "",
          ).trim(),
          reason: String(
            payload.reason ?? selectedRequest?.reason ?? "",
          ).trim(),
        });
        setPanelMode("edit");
      } catch (error) {
        if (error instanceof FetchDataError && error.status === 403) {
          setAccessDenied("Bạn không đủ quyền sửa đơn xin đổi đề tài.");
        }
        if (error instanceof FetchDataError && error.status === 404) {
          setBannerError("Không tìm thấy đơn xin đổi đề tài");
          return;
        }
        setBannerError(
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu sửa đơn xin đổi đề tài.",
        );
      } finally {
        setLoadingForm(false);
      }
    },
    [
      selectedRequest?.newTitle,
      selectedRequest?.reason,
      selectedRequest?.topicRenameRequestID,
      selectedRequestId,
    ],
  );

  const submitCreate = useCallback(async () => {
    const topicID = toNumber(createForm.topicID);
    const topicCode = createForm.topicCode.trim();

    if (!topicID && !topicCode) {
      setFieldErrors({
        topicID: "Vui lòng nhập topicID hoặc topicCode.",
        topicCode: "Vui lòng nhập topicID hoặc topicCode.",
      });
      return;
    }
    if (!createForm.newTitle.trim()) {
      setFieldErrors({ newTitle: "Vui lòng nhập tên đề tài mới." });
      return;
    }
    if (!createForm.reason.trim()) {
      setFieldErrors({ reason: "Vui lòng nhập lý do đổi đề tài." });
      return;
    }

    setSaving(true);
    setFieldErrors({});
    try {
      const templateContext = await loadTemplateContext(
        topicProposerUserCode,
        topicSupervisorUserCode,
      );
      const resolvedSupervisorUserCode =
        templateContext.supervisorUserCode ?? topicSupervisorUserCode ?? null;
      const reviewedByUserCode =
        templateContext.reviewedByUserCode ?? resolvedSupervisorUserCode;
      const payload: TopicRenameRequestCreateDto = {
        topicID,
        topicCode: topicCode || null,
        newTitle: createForm.newTitle.trim(),
        reason: createForm.reason.trim(),
        requestedByUserCode: auth.user?.userCode ?? null,
        requestedByRole: currentRole || null,
        reviewedByUserCode,
        reviewedByRole: reviewedByUserCode ? ROLE_LECTURER : null,
        proposerUserCode:
          templateContext.proposerUserCode ?? topicProposerUserCode ?? null,
        proposerStudentCode:
          templateContext.studentProfile?.studentCode ?? null,
        supervisorUserCode: resolvedSupervisorUserCode,
        supervisorLecturerCode:
          templateContext.lecturerProfile?.lecturerCode ?? null,
        studentFullName: templateContext.studentProfile?.fullName ?? null,
        studentCode: templateContext.studentProfile?.studentCode ?? null,
        studentEmail: templateContext.studentProfile?.studentEmail ?? null,
        studentPhoneNumber: templateContext.studentProfile?.phoneNumber ?? null,
        studentDateOfBirth: templateContext.studentProfile?.dateOfBirth ?? null,
        studentGender: templateContext.studentProfile?.gender ?? null,
        studentDepartmentCode:
          templateContext.studentProfile?.departmentCode ?? null,
        studentClassCode: templateContext.studentProfile?.classCode ?? null,
        studentFacultyCode: templateContext.studentProfile?.facultyCode ?? null,
        studentEnrollmentYear:
          templateContext.studentProfile?.enrollmentYear ?? null,
        studentStatus: templateContext.studentProfile?.status ?? null,
        studentAddress: templateContext.studentProfile?.address ?? null,
        lecturerFullName: templateContext.lecturerProfile?.fullName ?? null,
        lecturerCode: templateContext.lecturerProfile?.lecturerCode ?? null,
        lecturerEmail: templateContext.lecturerProfile?.email ?? null,
        lecturerPhoneNumber:
          templateContext.lecturerProfile?.phoneNumber ?? null,
        lecturerDateOfBirth:
          templateContext.lecturerProfile?.dateOfBirth ?? null,
        lecturerGender: templateContext.lecturerProfile?.gender ?? null,
        lecturerDepartmentCode:
          templateContext.lecturerProfile?.departmentCode ?? null,
        lecturerDegree: templateContext.lecturerProfile?.degree ?? null,
        lecturerAddress: templateContext.lecturerProfile?.address ?? null,
      };

      const response = await createTopicRenameRequest(payload);
      addToast("Đã tạo đơn xin đổi đề tài.", "success");
      setPanelMode("detail");
      await loadRequests();

      const createdId = getRequestId(response.data);
      if (createdId) {
        setSelectedRequestId(createdId);
        await loadDetail(createdId);
      }
    } catch (error) {
      if (error instanceof FetchDataError && error.status === 403) {
        setAccessDenied("Bạn không đủ quyền tạo đơn xin đổi đề tài.");
      }
      const validation = extractValidationMessages(error);
      if (Object.keys(validation).length > 0) {
        setFieldErrors(validation);
      }
      addToast(
        error instanceof Error
          ? error.message
          : "Không thể tạo đơn xin đổi đề tài.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }, [
    addToast,
    auth.user?.userCode,
    currentRole,
    createForm,
    loadDetail,
    loadRequests,
    loadTemplateContext,
    topicProposerUserCode,
    topicSupervisorUserCode,
  ]);

  const submitEdit = useCallback(async () => {
    const requestId = activeRequestId;
    if (requestId === null || requestId === undefined) return;
    if (!isEditableStatus(currentStatus)) {
      addToast(
        "Đơn chỉ được sửa khi ở trạng thái Pending hoặc Rejected.",
        "warning",
      );
      return;
    }

    if (!editForm.newTitle.trim()) {
      setFieldErrors({ newTitle: "Vui lòng nhập tên đề tài mới." });
      return;
    }
    if (!editForm.reason.trim()) {
      setFieldErrors({ reason: "Vui lòng nhập lý do đổi đề tài." });
      return;
    }

    setSaving(true);
    setFieldErrors({});
    try {
      await updateTopicRenameRequest(requestId, {
        newTitle: editForm.newTitle.trim(),
        reason: editForm.reason.trim(),
      });
      setRequests((prev) =>
        prev.map((item) =>
          item.topicRenameRequestID === requestId
            ? {
                ...item,
                status: "Pending",
                reviewedAt: "",
                reviewedByUserCode: "",
                reviewedByName: "",
                reviewedByLecturerCode: "",
                reviewedByRole: "",
                raw: {
                  ...item.raw,
                  status: "Pending",
                  Status: "Pending",
                  reviewedAt: "",
                  ReviewedAt: "",
                  reviewedByUserCode: "",
                  ReviewedByUserCode: "",
                  reviewedByName: "",
                  ReviewedByName: "",
                  reviewedByLecturerCode: "",
                  ReviewedByLecturerCode: "",
                  reviewedByRole: "",
                  ReviewedByRole: "",
                },
              }
            : item,
        ),
      );
      setDetail((prev) => {
        if (!prev?.request) return prev;
        return {
          ...prev,
          request: {
            ...prev.request,
            status: "Pending",
            Status: "Pending",
            reviewedAt: "",
            ReviewedAt: "",
            reviewedByUserCode: "",
            ReviewedByUserCode: "",
            reviewedByName: "",
            ReviewedByName: "",
            reviewedByLecturerCode: "",
            ReviewedByLecturerCode: "",
            reviewedByRole: "",
            ReviewedByRole: "",
          },
        };
      });
      addToast("Đã cập nhật đơn xin đổi đề tài.", "success");
      setPanelMode("detail");
      await loadRequests();
      await loadDetail(requestId);
    } catch (error) {
      if (error instanceof FetchDataError && error.status === 403) {
        setAccessDenied("Bạn không đủ quyền sửa đơn xin đổi đề tài.");
      }
      const validation = extractValidationMessages(error);
      if (Object.keys(validation).length > 0) {
        setFieldErrors(validation);
      }
      addToast(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật đơn xin đổi đề tài.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }, [
    addToast,
    activeRequestId,
    currentStatus,
    editForm.newTitle,
    editForm.reason,
    loadDetail,
    loadRequests,
  ]);

  const submitDelete = useCallback(async () => {
    const requestId = activeRequestId;
    if (requestId === null || requestId === undefined) return;

    setSaving(true);
    try {
      await deleteTopicRenameRequest(requestId);
      addToast("Đã xóa đơn xin đổi đề tài.", "success");
      setIsDeleteConfirmOpen(false);
      setSelectedRequestId(null);
      setDetail(null);
      setPanelMode("detail");
      await loadRequests();
    } catch (error) {
      if (error instanceof FetchDataError && error.status === 403) {
        setAccessDenied("Bạn không đủ quyền xóa đơn xin đổi đề tài.");
      }
      addToast(
        error instanceof Error
          ? error.message
          : "Không thể xóa đơn xin đổi đề tài.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }, [addToast, activeRequestId, loadRequests]);

  const submitReview = useCallback(
    async (action: TopicRenameRequestReviewAction) => {
      if (selectedRequestId === null || selectedRequestId === undefined) return;

      setSaving(true);
      setFieldErrors({});
      try {
        const payload: TopicRenameRequestReviewDto = {
          action,
          comment: reviewComment.trim() || null,
        };
        await reviewTopicRenameRequest(selectedRequestId, payload);
        addToast(
          action === "Approve"
            ? "Đã duyệt đơn xin đổi đề tài."
            : "Đã từ chối đơn xin đổi đề tài.",
          "success",
        );
        setReviewComment("");
        setIsReviewConfirmOpen(false);
        setReviewConfirmAction(null);
        setPanelMode("detail");
        await loadRequests();
        await loadDetail(selectedRequestId);
      } catch (error) {
        if (error instanceof FetchDataError && error.status === 403) {
          setAccessDenied("Bạn không đủ quyền duyệt đơn xin đổi đề tài.");
        }
        const validation = extractValidationMessages(error);
        if (Object.keys(validation).length > 0) {
          setFieldErrors(validation);
        }
        addToast(
          error instanceof Error
            ? error.message
            : "Không thể xử lý duyệt đơn xin đổi đề tài.",
          "error",
        );
      } finally {
        setSaving(false);
      }
    },
    [addToast, loadDetail, loadRequests, reviewComment, selectedRequestId],
  );

  const triggerReviewConfirm = (action: TopicRenameRequestReviewAction) => {
    setReviewConfirmAction(action);
    setIsReviewConfirmOpen(true);
  };

  const submitGenerateTemplate = useCallback(async () => {
    if (selectedRequestId === null || selectedRequestId === undefined) return;

    setSaving(true);
    try {
      const response = await generateTopicRenameRequestTemplate(
        selectedRequestId,
        placeOfBirth.trim() || undefined,
      );
      const fileData = response.data as TopicRenameRequestFileReadDto | null;
      if (fileData) {
        setGeneratedFile(fileData);
      }
      addToast("Đã sinh file Word mẫu.", "success");
      await loadDetail(selectedRequestId);
    } catch (error) {
      if (error instanceof FetchDataError && error.status === 403) {
        setAccessDenied("Bạn không đủ quyền sinh file Word mẫu.");
      }
      addToast(
        error instanceof Error
          ? error.message
          : "Không thể sinh file Word mẫu.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }, [addToast, loadDetail, placeOfBirth, selectedRequestId]);

  const downloadFile = useCallback(
    (file: TopicRenameRequestFileReadDto) => {
      const url = normalizeUrl(file.fileUrl);
      if (!url) {
        addToast("Không có đường dẫn tải xuống hợp lệ.", "error");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [addToast],
  );

  const deleteTemplateFile = useCallback(async () => {
    if (selectedRequestId === null || selectedRequestId === undefined) {
      addToast("Không xác định được request để xóa file template.", "error");
      return;
    }

    setDeletingTemplateFile(true);
    try {
      await deleteTopicRenameRequestTemplate(selectedRequestId);
      addToast("Đã xóa file template.", "success");
      setIsDeleteFileConfirmOpen(false);
      setGeneratedFile(null);
      await loadDetail(selectedRequestId);
    } catch (error) {
      if (error instanceof FetchDataError && error.status === 403) {
        setAccessDenied("Bạn không đủ quyền xóa file template.");
      }
      addToast(
        error instanceof Error ? error.message : "Không thể xóa file template.",
        "error",
      );
    } finally {
      setDeletingTemplateFile(false);
    }
  }, [addToast, loadDetail, selectedRequestId]);

  const detailFiles = useMemo(() => detail?.files ?? [], [detail?.files]);

  const currentFile = useMemo(() => {
    if (generatedFile) {
      return generatedFile;
    }
    return detailFiles.find((file) => file.isCurrent) || detailFiles[0] || null;
  }, [detailFiles, generatedFile]);

  const detailFilesToRender = useMemo(
    () => detailFiles.filter((file) => !isSameFileEntry(file, currentFile)),
    [currentFile, detailFiles],
  );

  const templatePreview = useMemo(() => {
    const studentProfile = createTemplateContext.studentProfile;
    const lecturerProfile = createTemplateContext.lecturerProfile;
    const merged: Record<string, unknown> = {
      topicID: currentTopic?.topicID ?? selectedRequest?.topicID ?? null,
      topicCode:
        currentTopic?.topicCode ??
        selectedRequest?.topicCode ??
        defaultTopicCode ??
        "",
      title: currentTopic?.title ?? defaultTopicTitle ?? "",
      oldTitle:
        selectedRequest?.oldTitle ??
        currentTopic?.title ??
        defaultTopicTitle ??
        "",
      newTitle: selectedRequest?.newTitle ?? "",
      requestCode: selectedRequest?.requestCode ?? "",
      requestedByUserCode: selectedRequest?.requestedByUserCode ?? "",
      requestedByRole: selectedRequest?.requestedByRole ?? "",
      reviewedByUserCode:
        selectedRequest?.reviewedByUserCode ??
        createTemplateContext.reviewedByUserCode ??
        topicSupervisorUserCode ??
        "",
      reviewedByRole:
        selectedRequest?.reviewedByRole ??
        createTemplateContext.reviewedByRole ??
        (topicSupervisorUserCode ? ROLE_LECTURER : ""),
      status: selectedRequest?.status ?? "",
      reason: selectedRequest?.reason ?? "",
      proposerUserCode:
        createTemplateContext.proposerUserCode ?? topicProposerUserCode ?? "",
      supervisorUserCode:
        createTemplateContext.supervisorUserCode ??
        topicSupervisorUserCode ??
        "",
      fullName: studentProfile?.fullName ?? "",
      dateOfBirth: studentProfile?.dateOfBirth ?? "",
      phoneNumber: studentProfile?.phoneNumber ?? "",
      email: studentProfile?.studentEmail ?? "",
      classCode: studentProfile?.classCode ?? "",
      major:
        studentProfile?.facultyCode ?? studentProfile?.departmentCode ?? "",
      departmentCode:
        studentProfile?.departmentCode ?? lecturerProfile?.departmentCode ?? "",
      departmentName:
        studentProfile?.departmentCode ?? lecturerProfile?.departmentCode ?? "",
      enrollmentYear: studentProfile?.enrollmentYear ?? "",
      gender: studentProfile?.gender ?? "",
      address: studentProfile?.address ?? lecturerProfile?.address ?? "",
      studentFullName: studentProfile?.fullName ?? "",
      studentName: studentProfile?.fullName ?? "",
      studentCode: studentProfile?.studentCode ?? "",
      studentEmail: studentProfile?.studentEmail ?? "",
      studentPhoneNumber: studentProfile?.phoneNumber ?? "",
      studentDateOfBirth: studentProfile?.dateOfBirth ?? "",
      studentGender: studentProfile?.gender ?? "",
      studentDepartmentCode: studentProfile?.departmentCode ?? "",
      studentClassCode: studentProfile?.classCode ?? "",
      studentFacultyCode: studentProfile?.facultyCode ?? "",
      studentEnrollmentYear: studentProfile?.enrollmentYear ?? "",
      studentStatus: studentProfile?.status ?? "",
      studentAddress: studentProfile?.address ?? "",
      supervisorName: lecturerProfile?.fullName ?? "",
      supervisor: lecturerProfile?.fullName ?? "",
      lecturerName: lecturerProfile?.fullName ?? "",
      lecturerFullName: lecturerProfile?.fullName ?? "",
      lecturerCode: lecturerProfile?.lecturerCode ?? "",
      lecturerEmail: lecturerProfile?.email ?? "",
      lecturerPhoneNumber: lecturerProfile?.phoneNumber ?? "",
      lecturerDateOfBirth: lecturerProfile?.dateOfBirth ?? "",
      lecturerGender: lecturerProfile?.gender ?? "",
      lecturerDepartmentCode: lecturerProfile?.departmentCode ?? "",
      lecturerDegree: lecturerProfile?.degree ?? "",
      lecturerAddress: lecturerProfile?.address ?? "",
    };

    if (selectedRequest?.raw && typeof selectedRequest.raw === "object") {
      Object.assign(merged, selectedRequest.raw);
    }

    if (detail?.request && typeof detail.request === "object") {
      Object.assign(merged, detail.request);
    }

    if (detail?.templateData && typeof detail.templateData === "object") {
      Object.assign(merged, detail.templateData);
    }

    const mergedLookup = buildFieldLookup(merged);
    const mergedValue = (keys: string[]) =>
      readFieldFromLookup(mergedLookup, keys, "");

    const resolvedRequestedByUserCode = pickFirstNonEmpty(
      selectedRequest?.requestedByUserCode,
      mergedValue(["requestedByUserCode", "RequestedByUserCode"]),
      auth.user?.userCode,
    );
    const resolvedRequestedByRole = pickFirstNonEmpty(
      selectedRequest?.requestedByRole,
      mergedValue(["requestedByRole", "RequestedByRole"]),
      currentRole,
    );
    const resolvedReviewedByUserCode = pickFirstNonEmpty(
      selectedRequest?.reviewedByUserCode,
      createTemplateContext.reviewedByUserCode,
      topicSupervisorUserCode,
      mergedValue(["reviewedByUserCode", "ReviewedByUserCode"]),
    );
    const resolvedReviewedByRole = pickFirstNonEmpty(
      selectedRequest?.reviewedByRole,
      createTemplateContext.reviewedByRole,
      mergedValue(["reviewedByRole", "ReviewedByRole"]),
      resolvedReviewedByUserCode ? ROLE_LECTURER : "",
    );

    const resolvedProposerUserCode = pickFirstNonEmpty(
      createTemplateContext.proposerUserCode,
      topicProposerUserCode,
      mergedValue(["proposerUserCode", "ProposerUserCode"]),
    );
    const resolvedSupervisorUserCode = pickFirstNonEmpty(
      createTemplateContext.supervisorUserCode,
      topicSupervisorUserCode,
      mergedValue(["supervisorUserCode", "SupervisorUserCode"]),
    );

    const resolvedStudentFullName = pickFirstNonEmpty(
      studentProfile?.fullName,
      mergedValue([
        "studentFullName",
        "StudentFullName",
        "studentName",
        "fullName",
        "FullName",
      ]),
    );
    const resolvedDateOfBirth = pickFirstNonEmpty(
      studentProfile?.dateOfBirth,
      mergedValue(["dateOfBirth", "DateOfBirth", "birthday"]),
    );
    const resolvedPhoneNumber = pickFirstNonEmpty(
      studentProfile?.phoneNumber,
      mergedValue([
        "phoneNumber",
        "PhoneNumber",
        "studentPhoneNumber",
        "StudentPhoneNumber",
      ]),
    );
    const resolvedEmail = pickFirstNonEmpty(
      studentProfile?.studentEmail,
      mergedValue(["email", "Email", "studentEmail", "StudentEmail"]),
    );
    const resolvedClassCode = pickFirstNonEmpty(
      studentProfile?.classCode,
      mergedValue([
        "classCode",
        "ClassCode",
        "studentClassCode",
        "StudentClassCode",
      ]),
    );
    const resolvedMajor = pickFirstNonEmpty(
      mergedValue(["major", "Major", "specialization"]),
      studentProfile?.facultyCode,
      studentProfile?.departmentCode,
    );
    const resolvedDepartmentCode = pickFirstNonEmpty(
      mergedValue([
        "departmentCode",
        "DepartmentCode",
        "studentDepartmentCode",
        "StudentDepartmentCode",
      ]),
      studentProfile?.departmentCode,
      lecturerProfile?.departmentCode,
    );
    const resolvedDepartmentName = pickFirstNonEmpty(
      mergedValue(["departmentName", "DepartmentName"]),
      studentProfile?.departmentCode,
      lecturerProfile?.departmentCode,
    );
    const resolvedEnrollmentYear = pickFirstNonEmpty(
      studentProfile?.enrollmentYear,
      mergedValue(["enrollmentYear", "EnrollmentYear", "cohort"]),
    );
    const resolvedGender = pickFirstNonEmpty(
      studentProfile?.gender,
      mergedValue(["gender", "Gender", "studentGender", "StudentGender"]),
    );
    const resolvedAddress = pickFirstNonEmpty(
      studentProfile?.address,
      lecturerProfile?.address,
      mergedValue(["address", "Address", "studentAddress", "StudentAddress"]),
    );
    const resolvedStudentCode = pickFirstNonEmpty(
      studentProfile?.studentCode,
      mergedValue(["studentCode", "StudentCode"]),
    );
    const resolvedStudentStatus = pickFirstNonEmpty(
      studentProfile?.status,
      mergedValue(["studentStatus", "StudentStatus", "status", "Status"]),
    );

    const resolvedLecturerName = pickFirstNonEmpty(
      lecturerProfile?.fullName,
      mergedValue([
        "supervisorName",
        "supervisor",
        "lecturerName",
        "lecturerFullName",
      ]),
    );
    const resolvedLecturerCode = pickFirstNonEmpty(
      lecturerProfile?.lecturerCode,
      mergedValue(["lecturerCode", "LecturerCode"]),
    );
    const resolvedLecturerEmail = pickFirstNonEmpty(
      lecturerProfile?.email,
      mergedValue(["lecturerEmail", "LecturerEmail"]),
    );
    const resolvedLecturerPhone = pickFirstNonEmpty(
      lecturerProfile?.phoneNumber,
      mergedValue(["lecturerPhoneNumber", "LecturerPhoneNumber"]),
    );
    const resolvedLecturerDateOfBirth = pickFirstNonEmpty(
      lecturerProfile?.dateOfBirth,
      mergedValue(["lecturerDateOfBirth", "LecturerDateOfBirth"]),
    );
    const resolvedLecturerGender = pickFirstNonEmpty(
      lecturerProfile?.gender,
      mergedValue(["lecturerGender", "LecturerGender"]),
    );
    const resolvedLecturerDepartment = pickFirstNonEmpty(
      lecturerProfile?.departmentCode,
      mergedValue(["lecturerDepartmentCode", "LecturerDepartmentCode"]),
    );
    const resolvedLecturerDegree = pickFirstNonEmpty(
      lecturerProfile?.degree,
      mergedValue(["lecturerDegree", "LecturerDegree"]),
    );
    const resolvedLecturerAddress = pickFirstNonEmpty(
      lecturerProfile?.address,
      mergedValue(["lecturerAddress", "LecturerAddress"]),
    );

    Object.assign(merged, {
      requestCode: pickFirstNonEmpty(
        selectedRequest?.requestCode,
        mergedValue(["requestCode", "RequestCode"]),
      ),
      status: pickFirstNonEmpty(
        selectedRequest?.status,
        mergedValue(["status", "Status"]),
      ),
      requestedByUserCode: resolvedRequestedByUserCode,
      requestedByRole: resolvedRequestedByRole,
      reviewedByUserCode: resolvedReviewedByUserCode,
      reviewedByRole: resolvedReviewedByRole,
      proposerUserCode: resolvedProposerUserCode,
      supervisorUserCode: resolvedSupervisorUserCode,
      fullName: resolvedStudentFullName,
      dateOfBirth: resolvedDateOfBirth,
      phoneNumber: resolvedPhoneNumber,
      email: resolvedEmail,
      classCode: resolvedClassCode,
      major: resolvedMajor,
      departmentCode: resolvedDepartmentCode,
      departmentName: resolvedDepartmentName,
      enrollmentYear: resolvedEnrollmentYear,
      gender: resolvedGender,
      address: resolvedAddress,
      studentFullName: resolvedStudentFullName,
      studentName: resolvedStudentFullName,
      studentCode: resolvedStudentCode,
      studentEmail: resolvedEmail,
      studentPhoneNumber: resolvedPhoneNumber,
      studentDateOfBirth: resolvedDateOfBirth,
      studentGender: resolvedGender,
      studentDepartmentCode: resolvedDepartmentCode,
      studentClassCode: resolvedClassCode,
      studentFacultyCode: pickFirstNonEmpty(
        studentProfile?.facultyCode,
        mergedValue(["studentFacultyCode", "StudentFacultyCode"]),
      ),
      studentEnrollmentYear: resolvedEnrollmentYear,
      studentStatus: resolvedStudentStatus,
      studentAddress: resolvedAddress,
      supervisorName: resolvedLecturerName,
      supervisor: resolvedLecturerName,
      lecturerName: resolvedLecturerName,
      lecturerFullName: resolvedLecturerName,
      lecturerCode: resolvedLecturerCode,
      lecturerEmail: resolvedLecturerEmail,
      lecturerPhoneNumber: resolvedLecturerPhone,
      lecturerDateOfBirth: resolvedLecturerDateOfBirth,
      lecturerGender: resolvedLecturerGender,
      lecturerDepartmentCode: resolvedLecturerDepartment,
      lecturerDegree: resolvedLecturerDegree,
      lecturerAddress: resolvedLecturerAddress,
    });

    if (studentProfile) {
      Object.assign(merged, {
        studentProfile,
      });
    }

    if (lecturerProfile) {
      Object.assign(merged, {
        lecturerProfile,
      });
    }

    return merged;
  }, [
    currentTopic?.title,
    currentTopic?.topicCode,
    currentTopic?.topicID,
    defaultTopicCode,
    defaultTopicTitle,
    auth.user?.userCode,
    currentRole,
    detail?.request,
    detail?.templateData,
    createTemplateContext.lecturerProfile,
    createTemplateContext.proposerUserCode,
    createTemplateContext.reviewedByRole,
    createTemplateContext.reviewedByUserCode,
    createTemplateContext.studentProfile,
    createTemplateContext.supervisorUserCode,
    topicProposerUserCode,
    topicSupervisorUserCode,
    selectedRequest?.newTitle,
    selectedRequest?.oldTitle,
    selectedRequest?.raw,
    selectedRequest?.reason,
    selectedRequest?.requestedByRole,
    selectedRequest?.requestedByUserCode,
    selectedRequest?.requestCode,
    selectedRequest?.reviewedByRole,
    selectedRequest?.reviewedByUserCode,
    selectedRequest?.status,
    selectedRequest?.topicCode,
    selectedRequest?.topicID,
  ]);

  const selectedTopicLabel = useMemo(() => {
    return (
      readField(templatePreview, ["oldTitle", "OldTitle"]) ||
      defaultTopicTitle ||
      "--"
    );
  }, [templatePreview, defaultTopicTitle]);

  const selectedTopicCode = useMemo(() => {
    return (
      readField(templatePreview, ["topicCode", "TopicCode"]) ||
      defaultTopicCode ||
      "--"
    );
  }, [templatePreview, defaultTopicCode]);

  const historyRows = useMemo(() => detail?.history ?? [], [detail?.history]);
  const templatePreviewLookup = useMemo(
    () => buildFieldLookup(templatePreview),
    [templatePreview],
  );
  const templatePlaceOfBirth = useMemo(
    () =>
      readFieldFromLookup(
        templatePreviewLookup,
        ["placeOfBirth", "PlaceOfBirth"],
        "",
      ),
    [templatePreviewLookup],
  );
  useEffect(() => {
    if (!placeOfBirth.trim() && templatePlaceOfBirth) {
      setPlaceOfBirth(templatePlaceOfBirth);
    }
  }, [placeOfBirth, templatePlaceOfBirth]);

  // --- MEMOIZED RENDERING SECTIONS ---
  const sidebarSection = useMemo(() => {
    return (
      <div style={modalStyles.sidebar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ padding: 10, background: "rgba(243, 112, 33, 0.2)", borderRadius: 12 }}>
            <History size={20} className="text-[#f37021]" />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>Lịch sử đơn</h3>
            <p style={{ fontSize: 11, opacity: 0.5, margin: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Request History</p>
          </div>
        </div>

        <button
          onClick={() => void openCreate()}
          disabled={loadingForm || saving || !canCreateNew}
          style={{
            width: "100%",
            padding: "14px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 16,
            color: "#fff",
            fontSize: 13,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            cursor: "pointer",
            transition: "all 0.2s ease",
            marginBottom: 24,
            opacity: canCreateNew ? 1 : 0.5,
          }}
          onMouseEnter={(e) => { if (canCreateNew) e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"; }}
          onMouseLeave={(e) => { if (canCreateNew) e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"; }}
        >
          <FilePlus size={16} /> Tạo đơn mới
        </button>

        <div style={{ flex: 1, overflowY: "auto", display: "grid", gap: 10, paddingRight: 4 }} className="custom-scrollbar">
          {requests.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", opacity: 0.3 }}>
              <History size={40} style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 12, fontWeight: 700 }}>Chưa có yêu cầu nào</p>
            </div>
          ) : (
            requests.map((item) => {
              const isSelected = item.topicRenameRequestID === selectedRequestId;
              const tone = normalizeStatusTone(item.status);
              const palette = statusPalette(tone);
              return (
                <div
                  key={item.topicRenameRequestID}
                  onClick={() => setSelectedRequestId(item.topicRenameRequestID)}
                  style={{
                    padding: "16px",
                    borderRadius: 20,
                    background: isSelected ? "rgba(243, 112, 33, 0.15)" : "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${isSelected ? "#f37021" : "rgba(255, 255, 255, 0.05)"}`,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 900, opacity: 0.6 }}>{item.requestCode || `#${item.topicRenameRequestID}`}</span>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: palette.border }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {item.newTitle}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, opacity: 0.4 }}>{item.createdAt?.split(" ")[0]}</span>
                    <span style={{ fontSize: 9, fontWeight: 900, color: palette.text, background: `${palette.bg}20`, padding: "2px 8px", borderRadius: 6, textTransform: "uppercase" }}>
                      {item.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }, [requests, selectedRequestId, canCreateNew, loadingForm, saving]);

  const overviewSection = useMemo(() => {
    const request = templatePreview;
    const isEditMode = panelMode === "edit";
    const isApplied = isAppliedStatus(currentStatus);
    const oldTitleLabel = isApplied ? "Tên đề tài cũ" : "Tên đề tài hiện tại";
    const newTitleLabel = isApplied ? "Tên đề tài mới" : "Tên đề tài đề xuất";

    return (
      <div style={{ display: "grid", gap: 32 }}>
        <div style={cardStyles.section}>
          <div style={cardStyles.sectionHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ padding: 10, background: "#f0f7ff", color: "#003d82", borderRadius: 12 }}>
                <Edit size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Thông tin chi tiết</h3>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>So sánh tên đề tài cũ và mới</p>
              </div>
            </div>
            <div style={badgeStyle(currentStatus)}>{currentStatus || "---"}</div>
          </div>
          <div style={cardStyles.sectionBody}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 32, padding: "10px 0" }}>
              <div style={{ padding: 24, background: "#f8fafc", borderRadius: 20, border: "1px dashed #e2e8f0" }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: 12 }}>{oldTitleLabel}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#64748b", margin: 0, lineHeight: 1.6 }}>{selectedTopicLabel}</p>
              </div>
              <div style={{ color: "#f37021", animation: "bounceRight 2s infinite" }}>
                <ArrowRight size={32} />
              </div>
              <div style={{ padding: 24, background: "#fffaf5", borderRadius: 20, border: "2px solid #f3702120", boxShadow: "0 10px 30px -10px rgba(243, 112, 33, 0.1)" }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: "#f37021", textTransform: "uppercase", marginBottom: 12 }}>{newTitleLabel}</p>
                {isEditMode ? (
                  <input
                    value={editForm.newTitle}
                    onChange={(e) => setEditForm(prev => ({ ...prev, newTitle: e.target.value }))}
                    style={inputStyle}
                    placeholder="Nhập tên mới..."
                  />
                ) : (
                  <p style={{ fontSize: 18, fontWeight: 900, color: "#1e293b", margin: 0, lineHeight: 1.6 }}>
                    {readField(request, ["newTitle", "NewTitle"], "-")}
                  </p>
                )}
                {isEditMode && fieldErrors.newTitle && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>{fieldErrors.newTitle}</p>}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: 12 }}>Lý do thay đổi</p>
              <div style={{ padding: 24, background: "#f8fafc", borderRadius: 20 }}>
                {isEditMode ? (
                  <textarea
                    value={editForm.reason}
                    onChange={(e) => setEditForm(prev => ({ ...prev, reason: e.target.value }))}
                    style={textareaStyle}
                    placeholder="Giải trình lý do..."
                  />
                ) : (
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#475569", margin: 0, lineHeight: 1.7, fontStyle: "italic" }}>
                    "{readField(request, ["reason", "Reason"], "Chưa có lý do chi tiết.")}"
                  </p>
                )}
                {isEditMode && fieldErrors.reason && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>{fieldErrors.reason}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Files Section */}
        <div style={cardStyles.section}>
          <div style={cardStyles.sectionHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ padding: 10, background: "#f0fdf4", color: "#16a34a", borderRadius: 12 }}>
                <Download size={20} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>Tài liệu đính kèm</h3>
            </div>
            <button
              onClick={() => void submitGenerateTemplate()}
              disabled={saving || !selectedRequestId}
              style={{ ...actionButtonGhost, padding: "8px 16px", fontSize: 12 }}
            >
              <RefreshCw size={14} className={saving ? "animate-spin" : ""} /> Sinh file Word
            </button>
          </div>
          <div style={cardStyles.sectionBody}>
            <div style={{ display: "grid", gap: 12 }}>
              {generatedFile && (
                <div style={{ padding: 16, background: "#f0fdf4", borderRadius: 16, border: "1px solid #dcfce7", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, background: "#fff", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a" }}>
                      <FileCheck size={20} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#166534" }}>{generatedFile.fileName}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#16a34a", opacity: 0.7 }}>File Word mẫu vừa khởi tạo</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => downloadFile(generatedFile)} style={{ ...actionButtonPrimary, padding: "8px 16px", background: "#16a34a" }}><Download size={14} /></button>
                    <button onClick={() => setIsDeleteFileConfirmOpen(true)} style={{ ...actionButtonDanger, padding: "8px 16px" }}><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
              {currentFile && !generatedFile && (
                <div style={{ padding: 16, background: "#f0fdf4", borderRadius: 16, border: "1px solid #dcfce7", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, background: "#fff", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a" }}>
                      <FileCheck size={20} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#166534" }}>{currentFile.fileName || "Tài liệu chính"}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#16a34a", opacity: 0.7 }}>Tài liệu đính kèm chính thức</p>
                    </div>
                  </div>
                  <button onClick={() => downloadFile(currentFile)} style={{ ...actionButtonPrimary, padding: "8px 16px", background: "#16a34a" }}><Download size={14} /></button>
                </div>
              )}
              {detailFilesToRender.map((file, i) => (
                <div key={i} style={{ padding: 16, background: "#f8fafc", borderRadius: 16, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, background: "#fff", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                      <FileText size={20} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#1e293b" }}>{file.fileName || "Tài liệu phụ"}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>{file.fileType || "Document"}</p>
                    </div>
                  </div>
                  <button onClick={() => downloadFile(file)} style={{ ...actionButtonGhost, padding: "8px 16px" }}><Download size={14} /></button>
                </div>
              ))}
              {!generatedFile && !currentFile && detailFilesToRender.length === 0 && (
                <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: 13, border: "1px dashed #e2e8f0", borderRadius: 16 }}>
                  Chưa có tài liệu nào được đính kèm.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History Section */}
        <div style={cardStyles.section}>
          <div style={cardStyles.sectionHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ padding: 10, background: "#f5f3ff", color: "#7c3aed", borderRadius: 12 }}>
                <Clock size={20} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>Lịch sử xét duyệt</h3>
            </div>
          </div>
          <div style={{ padding: "0 24px 24px" }}>
            <div style={{ display: "grid", gap: 16, position: "relative" }}>
              <div style={{ position: "absolute", left: 19, top: 0, bottom: 0, width: 2, background: "#f1f5f9" }} />
              {historyRows.length > 0 ? historyRows.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 20, position: "relative", zIndex: 1 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff", border: "4px solid #f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#f37021", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                    <CheckCircle size={16} />
                  </div>
                  <div style={{ flex: 1, padding: 20, background: "#f8fafc", borderRadius: 20, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontWeight: 900, fontSize: 14, color: "#1e293b" }}>{item.approvedByRole || "Người duyệt"}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>{item.effectiveAt || item.createdAt}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{item.approvalComment || "Không có nhận xét."}</p>
                    <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                      <User size={12} className="text-[#f37021]" />
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#f37021" }}>{item.approvedByUserCode}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <div style={{ padding: "20px 40px", color: "#94a3b8", fontSize: 13 }}>Chưa có bản ghi xét duyệt.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }, [
    templatePreview, panelMode, currentStatus, selectedTopicLabel, fieldErrors,
    editForm.newTitle, editForm.reason, saving, selectedRequestId, generatedFile,
    currentFile, detailFilesToRender, historyRows
  ]);

  const previewSection = useMemo(() => {
    const data = templatePreview;
    const today = new Date();
    return (
      <div style={documentStyles.paper}>
        <div style={documentStyles.header}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontWeight: "bold", margin: 0 }}>BỘ GIÁO DỤC VÀ ĐÀO TẠ</p>
            <p style={{ fontWeight: "bold", borderBottom: "1px solid #000", display: "inline-block" }}>TRƯỜNG ĐẠI HỌC ĐẠI NAM</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontWeight: "bold", margin: 0 }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p style={{ fontWeight: "bold", borderBottom: "1px solid #000", display: "inline-block" }}>Độc lập - Tự do - Hạnh phúc</p>
            <p style={{ fontStyle: "italic", marginTop: 4, fontSize: "14px" }}>Hà Nội, ngày {today.getDate()} tháng {today.getMonth() + 1} năm {today.getFullYear()}</p>
          </div>
        </div>

        <h1 style={documentStyles.title}>ĐƠN XIN THAY ĐỔI TÊN ĐỀ TÀI ĐỒ ÁN</h1>

        <div style={{ marginBottom: 24, textAlign: "left", paddingLeft: "15%" }}>
          <p style={{ fontWeight: "bold", margin: 0 }}>
            Kính gửi: &nbsp;&nbsp;&nbsp; - Ban Giám hiệu Trường Đại học Đại Nam;<br/>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; - Phòng Quản lý Đào tạo;<br/>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; - Lãnh đạo Khoa: Công nghệ thông tin
          </p>
        </div>

        <div style={{ textAlign: "left" }}>
          <div style={documentStyles.section}>
            <span style={documentStyles.label}>Họ và tên sinh viên:</span>
            <span style={{ ...documentStyles.field, fontWeight: "bold" }}>{readField(data, ["studentFullName", "fullName"], "........................................................")}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, marginBottom: 8 }}>
            <div style={documentStyles.section}>
              <span style={documentStyles.label}>Ngày sinh:</span>
              <span style={documentStyles.field}>{formatDocDate(readField(data, ["studentDateOfBirth", "dateOfBirth"]))}</span>
            </div>
            <div style={documentStyles.section}>
              <span style={documentStyles.label}>Nơi sinh:</span>
              <span style={documentStyles.field}>{placeOfBirth || "...................................."}</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 20, marginBottom: 8 }}>
            <div style={documentStyles.section}>
              <span style={documentStyles.label}>MSV:</span>
              <span style={documentStyles.field}>{readField(data, ["studentCode"], "....................")}</span>
            </div>
            <div style={documentStyles.section}>
              <span style={documentStyles.label}>Khóa:</span>
              <span style={documentStyles.field}>{readField(data, ["enrollmentYear"], "....................")}</span>
            </div>
            <div style={documentStyles.section}>
              <span style={documentStyles.label}>Lớp:</span>
              <span style={documentStyles.field}>{readField(data, ["studentClassCode", "classCode"], "....................")}</span>
            </div>
          </div>

          <div style={documentStyles.section}>
            <span style={documentStyles.label}>Ngành đào tạo:</span>
            <span style={documentStyles.field}>{readField(data, ["major", "departmentName"], "Khoa Công nghệ Thông tin")}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, marginBottom: 8 }}>
            <div style={documentStyles.section}>
              <span style={documentStyles.label}>Số điện thoại:</span>
              <span style={documentStyles.field}>{readField(data, ["studentPhoneNumber", "phoneNumber"], "....................")}</span>
            </div>
            <div style={documentStyles.section}>
              <span style={documentStyles.label}>Email:</span>
              <span style={documentStyles.field}>{readField(data, ["studentEmail", "email"], "....................................")}</span>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <p style={{ margin: "4px 0" }}>Tên đề tài dự kiến thực hiện: <span style={{ fontStyle: "italic" }}>{readField(data, ["oldTitle", "OldTitle"], "..................................................................")}</span></p>
          </div>

          <div style={documentStyles.section}>
            <span style={documentStyles.label}>Đề xuất người hướng dẫn khoa học:</span>
            <span style={documentStyles.field}>{readField(data, ["supervisorName", "supervisor"], "..................................................................")}</span>
          </div>

          <p style={{ margin: "16px 0 8px" }}>Em xin được thay đổi tên đề tài đồ án như sau:</p>
          <div style={documentStyles.section}>
            <span style={{ fontWeight: "bold", marginRight: 8 }}>Tên đề tài đồ án(mới):</span>
            <span style={{ ...documentStyles.field, fontWeight: "bold" }}>{readField(data, ["newTitle", "NewTitle"], "..................................................................")}</span>
          </div>

          <div style={documentStyles.section}>
            <span style={{ fontWeight: "bold", marginRight: 8 }}>Lý do thay đổi:</span>
            <span style={documentStyles.field}>{readField(data, ["reason", "Reason"], "..................................................................")}</span>
          </div>

          <p style={{ marginTop: 20, lineHeight: 1.4 }}>
            Vì vậy, em làm đơn này kính đề nghị Ban Giám hiệu Nhà trường, Phòng Quản lý Đào tạo, Khoa Khoa Công nghệ Thông tin xem xét và tạo điều kiện cho em được thay đổi tên đề tài đồ án/khóa luận tốt nghiệp.<br/>
            Em xin cam kết thực hiện nghiêm túc và đầy đủ các quy định làm đồ án của Trường.<br/>
            <i>Xin trân trọng cảm ơn!</i>
          </p>

          <div style={documentStyles.signature}>
            <div>
              <p style={{ fontWeight: "bold", margin: 0 }}>Ý kiến của người hướng dẫn</p>
              <p style={{ fontStyle: "italic", margin: 0, fontSize: "13px" }}>(Ký và ghi rõ họ tên)</p>
            </div>
            <div>
              <p style={{ fontWeight: "bold", margin: 0 }}>Họ và tên sinh viên</p>
              <p style={{ fontStyle: "italic", margin: 0, fontSize: "13px" }}>(Ký và ghi rõ họ tên)</p>
            </div>
          </div>
        </div>
      </div>
    );
  }, [templatePreview, placeOfBirth]);

  const createFormSection = useMemo(() => {
    return (
      <div style={cardStyles.section}>
        <div style={cardStyles.sectionHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ padding: 10, background: "#fff7ed", color: "#f37021", borderRadius: 12 }}>
              <FilePlus size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Khởi tạo đơn mới</h3>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Vui lòng điền đầy đủ thông tin bên dưới</p>
            </div>
          </div>
        </div>
        <div style={cardStyles.sectionBody}>
          <div style={{ display: "grid", gap: 24 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 10, letterSpacing: "0.05em" }}>Tên đề tài mới</label>
              <input
                value={createForm.newTitle}
                onChange={(e) => setCreateForm(prev => ({ ...prev, newTitle: e.target.value }))}
                placeholder="Ví dụ: Hệ thống quản lý đào tạo trực tuyến nâng cao..."
                style={inputStyle}
              />
              {fieldErrors.newTitle && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 8, fontWeight: 600 }}>{fieldErrors.newTitle}</p>}
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 10, letterSpacing: "0.05em" }}>Nơi sinh</label>
              <input
                value={placeOfBirth}
                onChange={(e) => setPlaceOfBirth(e.target.value)}
                placeholder="Ví dụ: Hà Nội, Việt Nam"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 10, letterSpacing: "0.05em" }}>Lý do xin thay đổi</label>
              <textarea
                value={createForm.reason}
                onChange={(e) => setCreateForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Giải trình lý do vì sao bạn muốn đổi tên đề tài (ví dụ: Thay đổi phạm vi nghiên cứu, cập nhật công nghệ mới...)"
                style={textareaStyle}
              />
              {fieldErrors.reason && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 8, fontWeight: 600 }}>{fieldErrors.reason}</p>}
            </div>

            <div style={{ padding: 20, background: "#f0f7ff", borderRadius: 20, border: "1px solid #e0f2fe", display: "flex", gap: 16 }}>
              <div style={{ color: "#0369a1" }}><Info size={20} /></div>
              <p style={{ margin: 0, fontSize: 13, color: "#0369a1", fontWeight: 600, lineHeight: 1.6 }}>
                Sau khi gửi đơn, giảng viên hướng dẫn của bạn sẽ nhận được thông báo để xét duyệt. Bạn có thể theo dõi trạng thái đơn ở cột bên trái.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }, [createForm.newTitle, createForm.reason, placeOfBirth, fieldErrors]);

  const renderSidebar = () => sidebarSection;
  const renderRequestOverview = () => overviewSection;
  const renderDocumentPreview = () => previewSection;
  const renderForm = () => createFormSection;

  const renderFooterActions = () => {
    if (canReview && panelMode === "review") {
      return (
        <>
          <button type="button" style={actionButtonGhost} onClick={() => setPanelMode("detail")}>Quay lại</button>
          <button
            type="button"
            style={{ ...actionButtonDanger, background: "#fee2e2" }}
            onClick={() => triggerReviewConfirm("Reject")}
            disabled={saving || !selectedRequestId || !canReviewSelected}
          >
            <X size={16} /> Từ chối đơn
          </button>
          <button
            type="button"
            style={actionButtonPrimary}
            onClick={() => triggerReviewConfirm("Approve")}
            disabled={saving || !selectedRequestId || !canReviewSelected}
          >
            <CheckCircle size={16} /> Duyệt đơn ngay
          </button>
        </>
      );
    }

    if (panelMode === "create") {
      return (
        <>
          <button type="button" style={actionButtonGhost} onClick={() => setPanelMode("detail")}>Hủy bỏ</button>
          <button
            type="button"
            style={actionButtonPrimary}
            onClick={() => void submitCreate()}
            disabled={saving || loadingForm || !canCreateNew}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Gửi yêu cầu
          </button>
        </>
      );
    }

    if (panelMode === "edit") {
      return (
        <>
          <button type="button" style={actionButtonGhost} onClick={() => setPanelMode("detail")}>Hủy chỉnh sửa</button>
          <button
            type="button"
            style={actionButtonPrimary}
            onClick={() => void submitEdit()}
            disabled={saving || loadingForm || !hasActiveRequest}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />} Lưu thay đổi
          </button>
        </>
      );
    }

    return (
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {canReviewSelected && (
          <button
            onClick={() => setPanelMode("review")}
            style={{ ...actionButtonPrimary, background: "#0f172a" }}
          >
            <Edit size={16} /> Chế độ xét duyệt
          </button>
        )}
        {canEditSelected && (
          <button
            onClick={() => void openEdit(activeRequestId)}
            style={actionButtonPrimary}
          >
            <Edit size={16} /> Chỉnh sửa đơn
          </button>
        )}
        {canDeleteSelected && (
          <button
            onClick={() => setIsDeleteConfirmOpen(true)}
            style={actionButtonDanger}
          >
            <Trash2 size={16} /> Xóa đơn
          </button>
        )}
        <button type="button" style={actionButtonGhost} onClick={onClose}>Đóng cửa sổ</button>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div style={modalStyles.overlay} role="dialog" aria-modal="true">
      <style>
        {`
          @keyframes bounceRight {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(10px); }
          }
          .custom-scrollbar::-webkit-scrollbar { width: 5px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        `}
      </style>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 40 }}
        style={modalStyles.card}
      >
        {/* Sidebar */}
        {renderSidebar()}

        {/* Main Content */}
        <div style={modalStyles.content}>
          <header style={modalStyles.header}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 2, height: 32, background: "#f37021", borderRadius: 2 }} />
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", margin: 0 }}>Chi tiết yêu cầu</h1>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <CalendarIcon size={12} className="text-[#94a3b8]" />
                  <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{new Date().toLocaleDateString("vi-VN")}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {(panelMode === "detail" || panelMode === "review") && (
                <button
                  onClick={() => setShowDocumentView(!showDocumentView)}
                  style={{
                    ...actionButtonGhost,
                    padding: "10px 20px",
                    background: showDocumentView ? "#0f172a" : "#f1f5f9",
                    color: showDocumentView ? "#fff" : "#475569",
                    borderRadius: 12,
                    fontSize: 13,
                    boxShadow: showDocumentView ? "0 10px 20px -5px rgba(15, 23, 42, 0.3)" : "none",
                  }}
                >
                  <FileText size={18} /> {showDocumentView ? "Xem giao diện Dashboard" : "Xem văn bản mẫu"}
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  width: 40, height: 40, borderRadius: 12, border: "none", background: "#f1f5f9",
                  color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e8f0"; e.currentTarget.style.color = "#0f172a"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#64748b"; }}
              >
                <X size={20} strokeWidth={3} />
              </button>
            </div>
          </header>

          <div style={modalStyles.body}>
            {(bannerError || accessDenied) && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  padding: 20, borderRadius: 20, background: "#fef2f2", border: "1px solid #fee2e2",
                  color: "#dc2626", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 12
                }}
              >
                <AlertCircle size={20} />
                {accessDenied || bannerError}
              </motion.div>
            )}

            {loadingDetail ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "100px 0", gap: 20 }}>
                <Loader2 size={48} className="animate-spin text-[#f37021]" />
                <p style={{ fontSize: 16, fontWeight: 800, color: "#94a3b8" }}>Đang đồng bộ dữ liệu...</p>
              </div>
            ) : (
              <>
                {panelMode === "create" 
                  ? renderForm() 
                  : (showDocumentView ? renderDocumentPreview() : renderRequestOverview())
                }
              </>
            )}
          </div>

          <footer style={modalStyles.footer}>
            {renderFooterActions()}
          </footer>
        </div>
      </motion.div>

      {/* Delete Confirmation Overlay */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteConfirmOpen(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)" }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{
                position: "relative", width: "min(450px, 100%)", background: "#fff", borderRadius: 32,
                padding: 40, textAlign: "center", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)"
              }}
            >
              <div style={{ width: 80, height: 80, background: "#fef2f2", color: "#dc2626", borderRadius: 30, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <Trash2 size={40} />
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", marginBottom: 12 }}>Xác nhận xóa?</h3>
              <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
                Đơn xin đổi đề tài này sẽ bị xóa vĩnh viễn khỏi hệ thống. Bạn chắc chắn chứ?
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setIsDeleteConfirmOpen(false)} style={{ ...actionButtonGhost, flex: 1 }}>Hủy bỏ</button>
                <button onClick={() => void submitDelete()} style={{ ...actionButtonDanger, flex: 1 }}>Xác nhận xóa</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Review Confirmation Overlay */}
      <AnimatePresence>
        {isReviewConfirmOpen && reviewConfirmAction && (
          <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReviewConfirmOpen(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)" }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{
                position: "relative", width: "min(450px, 100%)", background: "#fff", borderRadius: 32,
                padding: 40, textAlign: "center", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)"
              }}
            >
              <div style={{ 
                width: 80, height: 80, 
                background: reviewConfirmAction === "Approve" ? "#f0fdf4" : "#fef2f2", 
                color: reviewConfirmAction === "Approve" ? "#16a34a" : "#dc2626", 
                borderRadius: 30, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" 
              }}>
                {reviewConfirmAction === "Approve" ? <CheckCircle size={40} /> : <X size={40} />}
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", marginBottom: 12 }}>
                {reviewConfirmAction === "Approve" ? "Xác nhận duyệt?" : "Xác nhận từ chối?"}
              </h3>
              <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
                Bạn chắc chắn muốn {reviewConfirmAction === "Approve" ? "phê duyệt" : "từ chối"} yêu cầu đổi tên đề tài này?
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setIsReviewConfirmOpen(false)} style={{ ...actionButtonGhost, flex: 1 }}>Hủy bỏ</button>
                <button 
                  onClick={() => void submitReview(reviewConfirmAction)} 
                  style={{ 
                    ...(reviewConfirmAction === "Approve" ? actionButtonPrimary : actionButtonDanger), 
                    flex: 1 
                  }}
                >
                  Xác nhận
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete File Confirmation Overlay */}
      <AnimatePresence>
        {isDeleteFileConfirmOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteFileConfirmOpen(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)" }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{
                position: "relative", width: "min(450px, 100%)", background: "#fff", borderRadius: 32,
                padding: 40, textAlign: "center", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)"
              }}
            >
              <div style={{ width: 80, height: 80, background: "#fef2f2", color: "#dc2626", borderRadius: 30, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <Trash2 size={40} />
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", marginBottom: 12 }}>Xóa tài liệu?</h3>
              <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
                Tài liệu này sẽ bị xóa vĩnh viễn. Bạn có chắc chắn không?
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setIsDeleteFileConfirmOpen(false)} style={{ ...actionButtonGhost, flex: 1 }}>Quay lại</button>
                <button onClick={() => void deleteTemplateFile()} style={{ ...actionButtonDanger, flex: 1 }}>Xác nhận xóa</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TopicRenameRequestModal;
