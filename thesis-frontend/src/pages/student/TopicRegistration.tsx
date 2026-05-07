import React, { useState, useEffect, useCallback, useMemo } from "react";
import /* useNavigate */ "react-router-dom";
import { fetchData, FetchDataError, getAvatarUrl } from "../../api/fetchData";
import { useAuth } from "../../hooks/useAuth";
import type { ApiResponse } from "../../types/api";
import type { LecturerProfile } from "../../types/lecturer-profile";
import type { Department } from "../../types/department";
import type { StudentProfile } from "../../types/studentProfile";
import type { Topic, TopicFormData } from "../../types/topic";
import type { Tag, LecturerTag, TopicTag } from "../../types/tag";
import {
  BookOpen,
  FileText,
  User as PersonIcon,
  Building,
  GraduationCap,
  Users,
  CheckCircle,
  Edit,
  RotateCcw,
  Search,
  LayoutGrid,
  Info,
  AlertCircle,
  Calendar,
  Check,
  ChevronRight,
  X,
  List,
  Grid2X2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import TopicRenameRequestModal from "../../components/workflow/TopicRenameRequestModal";
import {
  type DefensePeriodId,
  type WorkflowDetailResponse,
  type DefenseTermOption,
  type WorkflowResubmitRequest,
  type WorkflowTopic,
} from "../../types/workflow-topic";
import {
  getDefenseTermList,
  getTopicWorkflowDetail,
  resubmitTopicWorkflow,
  submitTopicWorkflow,
} from "../../services/topic-workflow.service";
import ChatbotPopup from "../../components/ChatbotPopup";


type TopicRenameRequestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  currentTopic?: {
    topicID?: number | null;
    topicCode?: string | null;
    title?: string | null;
    proposerUserCode?: string | null;
    supervisorUserCode?: string | null;
  } | null;
  initialMode?: "detail" | "create" | "edit" | "review";
};

const TopicRenameRequestModalView =
  TopicRenameRequestModal as unknown as React.ComponentType<TopicRenameRequestModalProps>;
import { ROLE_LECTURER } from "../../utils/role";

type CatalogTopicWithTags = {
  catalogTopicID: number;
  catalogTopicCode: string;
  title: string;
  summary: string;
  departmentCode: string;
  assignedStatus: string;
  assignedAt: string | null;
  createdAt: string;
  lastUpdated: string;
  tags: Array<{
    tagID: number;
    tagCode: string;
    tagName: string;
  }>;
};

function ensureWorkflowSuccess<T>(
  envelope: ApiResponse<T>,
  fallbackMessage: string,
): { data: T; totalCount: number } {
  if (
    !envelope.success ||
    envelope.data === null ||
    envelope.data === undefined
  ) {
    throw new Error(envelope.message || envelope.title || fallbackMessage);
  }
  return {
    data: envelope.data,
    totalCount: Number(envelope.totalCount || 0),
  };
}

async function getWorkflowTopicDetailApi(
  topicId: number,
): Promise<WorkflowDetailResponse> {
  return getTopicWorkflowDetail(topicId);
}

function getDisplayedTopicStatus(status?: string): string {
  const normalized = String(status || "").trim();
  if (normalized === "Đủ điều kiện bảo vệ") {
    return "Chờ bảo vệ";
  }
  return normalized || "--";
}

async function getCatalogTopicsWithTagsApi(input?: {
  assignedStatus?: string;
  catalogTopicCode?: string;
  page?: number;
  pageSize?: number;
}): Promise<CatalogTopicWithTags[]> {
  const params = new URLSearchParams();
  params.append("Page", String(input?.page ?? 0));
  params.append("PageSize", String(input?.pageSize ?? 200));

  if (input?.assignedStatus) {
    params.append("AssignedStatus", input.assignedStatus);
  }
  if (input?.catalogTopicCode) {
    params.append("CatalogTopicCode", input.catalogTopicCode);
  }

  const envelope = await fetchData<ApiResponse<CatalogTopicWithTags[]>>(
    `/CatalogTopics/get-list-with-tags?${params.toString()}`,
    { method: "GET" },
  );

  return ensureWorkflowSuccess(
    envelope,
    "Không thể tải danh sách đề tài có sẵn kèm tags.",
  ).data;
}

const TopicRegistration: React.FC = () => {
  const auth = useAuth();
  // navigate removed; we now show a success modal instead of navigating
  const userCode = auth.user?.userCode;
  const [registrationType, setRegistrationType] = useState<"catalog" | "self">(
    "catalog",
  );
  const [catalogTopics, setCatalogTopics] = useState<CatalogTopicWithTags[]>(
    [],
  );
  const [lecturers, setLecturers] = useState<LecturerProfile[]>([]);
  const [filteredLecturers, setFilteredLecturers] = useState<LecturerProfile[]>(
    [],
  );
  const [defaultDepartment, setDefaultDepartment] = useState<Department | null>(
    null,
  );
  const [tags, setTags] = useState<Tag[]>([]);
  const [defenseTerms, setDefenseTerms] = useState<DefenseTermOption[]>([]);
  const [selectedDefenseTermId, setSelectedDefenseTermId] =
    useState<DefensePeriodId | null>(null);
  const [selectedTagInfo, setSelectedTagInfo] = useState<Tag | null>(null);
  const [selectedTagIDs, setSelectedTagIDs] = useState<number[]>([]);
  const [topicTags, setTopicTags] = useState<TopicTag[]>([]);
  const [topicTagNames, setTopicTagNames] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [existingTopic, setExistingTopic] = useState<Topic | null>(null);
  const [, setWorkflowDetail] = useState<WorkflowDetailResponse | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState("");
  const [catalogTagFilter, setCatalogTagFilter] = useState<string | null>(null);
  const [catalogViewMode, setCatalogViewMode] = useState<"card" | "table">("card");
  const [isTopicRenameModalOpen, setIsTopicRenameModalOpen] = useState(false);
  
  const filteredCatalogTopics = useMemo(() => {
    return catalogTopics.filter(t => 
      (t.title.toLowerCase().includes(catalogSearchQuery.toLowerCase()) || 
       t.catalogTopicCode.toLowerCase().includes(catalogSearchQuery.toLowerCase())) &&
      (!catalogTagFilter || (t.tags && t.tags.some(tag => tag.tagCode === catalogTagFilter)))
    );
  }, [catalogTopics, catalogSearchQuery, catalogTagFilter]);
  const [editFormData, setEditFormData] = useState<TopicFormData>({
    topicCode: "",
    title: "",
    summary: "",
    type: "CATALOG",
    catalogTopicID: null,
    supervisorLecturerProfileID: null,
    departmentID: null,
    tagID: null,
  });

  const [formData, setFormData] = useState<TopicFormData>({
    topicCode: "",
    title: "",
    summary: "",
    type: "CATALOG",
    catalogTopicID: null,
    supervisorLecturerProfileID: null,
    departmentID: null,
    tagID: null,
  });

  // Fetch initial data
  // Extracted loader so we can call it again when refreshing UI after success
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [catalogRes, lecturerRes, departmentRes, tagRes, defenseTermRes] =
        await Promise.all([
          getCatalogTopicsWithTagsApi({
            assignedStatus: "Chưa giao",
            page: 0,
            pageSize: 200,
          }),
          fetchData("/LecturerProfiles/get-list"),
          fetchData("/Departments/get-list"),
          fetchData("/Tags/list"),
          getDefenseTermList(),
        ]);

      setCatalogTopics(catalogRes || []);
      setLecturers((lecturerRes as ApiResponse<LecturerProfile[]>)?.data || []);
      setFilteredLecturers([]);

      // Departments list — prefer the logged-in student's department as the default
      const departmentsList =
        (departmentRes as ApiResponse<Department[]>)?.data || [];

      let deptToUse: Department | null = departmentsList.length
        ? departmentsList[0]
        : null;

      if (userCode) {
        try {
          const studentRes = await fetchData(
            `/StudentProfiles/get-list?UserCode=${userCode}`,
          );
          const studentData =
            (studentRes as ApiResponse<StudentProfile[]>)?.data || [];
          if (studentData.length > 0) {
            const studentDeptCode = studentData[0].departmentCode;
            const matched = departmentsList.find(
              (d) => d.departmentCode === studentDeptCode,
            );
            if (matched) deptToUse = matched;
          }
        } catch (err) {
          console.error("Error fetching student profile for department:", err);
        }
      }

      if (deptToUse) {
        setDefaultDepartment(deptToUse);
        // Set department in form data (new registrations)
        setFormData((prev) => ({
          ...prev,
          departmentID: deptToUse!.departmentID,
        }));
        setEditFormData((prev) => ({
          ...prev,
          departmentID: deptToUse!.departmentID,
        }));
      }

      setTags((tagRes as ApiResponse<Tag[]>)?.data || []);
      setDefenseTerms(defenseTermRes || []);
      if (defenseTermRes && defenseTermRes.length > 0) {
        setSelectedDefenseTermId((prev) => {
          const exists = prev && defenseTermRes.some(t => String(t.defenseTermId) === String(prev));
          return exists ? prev : defenseTermRes[0].defenseTermId;
        });
      }

      // Fetch topic code template
      try {
        const templateRes = await fetchData("/Topics/get-create");
        const templateData = (templateRes as ApiResponse)?.data as Record<
          string,
          unknown
        >;
        if (templateData?.topicCode) {
          setFormData((prev) => ({
            ...prev,
            topicCode: templateData.topicCode as string,
          }));
        }
      } catch (error) {
        console.error("Error fetching topic code template:", error);
      }

      // Check if student already has a topic
      if (userCode) {
        try {
          const topicsRes = await fetchData(
            `/Topics/get-list?ProposerUserCode=${userCode}`,
          );
          const topics = (topicsRes as ApiResponse<Topic[]>)?.data || [];
          const existingTopic =
            topics.find(
              (topic) =>
                topic.status === "Đang chờ" ||
                topic.status === "Đã duyệt" ||
                topic.status === "Đã chấp nhận" ||
                topic.status === "Đủ điều kiện bảo vệ" ||
                topic.status === "Từ chối" ||
                topic.status === "Cần sửa đổi",
            ) ??
            topics[0] ??
            null;

          setExistingTopic(existingTopic);
        } catch (error) {
          console.error("Error checking existing topics:", error);
        }
      }
    } catch (error) {
      setError("Không thể tải dữ liệu ban đầu");
      console.error("Error fetching initial data:", error);
    } finally {
      setLoading(false);
    }
  }, [userCode]);

  const handleContinueAfterSuccess = async () => {
    // Close modal and refresh data/form after registration
    setShowSuccessModal(false);
    setSuccess(null);
    // reload initial data (topics, lecturers, etc.)
    await loadInitialData();
    // reset form to initial state (keep department set to student's department when available)
    setFormData((prev) => ({
      ...prev,
      topicCode: formData.topicCode,
      title: "",
      summary: "",
      type: "CATALOG",
      catalogTopicID: null,
      supervisorLecturerProfileID: null,
      departmentID:
        defaultDepartment?.departmentID ?? prev.departmentID ?? null,
      tagID: null,
    }));
    setEditFormData({
      topicCode: "",
      title: "",
      summary: "",
      type: "CATALOG",
      catalogTopicID: null,
      supervisorLecturerProfileID: null,
      departmentID: defaultDepartment?.departmentID ?? null,
      tagID: null,
    });
    setRegistrationType("catalog");
    setSelectedTagInfo(null);
    setFilteredLecturers([]);
    setSelectedTagIDs([]);
    setSelectedDefenseTermId(null);
    setWorkflowDetail(null);
    setIsEditing(false);
  };

  const toTopicModel = useCallback(
    (wfTopic: WorkflowTopic, tagCode?: string | null): Topic => ({
      topicID: wfTopic.topicID,
      topicCode: wfTopic.topicCode,
      title: wfTopic.title,
      summary: wfTopic.summary,
      type: wfTopic.type,
      defenseTermId: wfTopic.defenseTermId,
      proposerUserID: wfTopic.proposerUserID,
      proposerUserCode: wfTopic.proposerUserCode,
      proposerStudentProfileID: wfTopic.proposerStudentProfileID,
      proposerStudentCode: wfTopic.proposerStudentCode,
      supervisorUserID: wfTopic.supervisorUserID,
      supervisorUserCode: wfTopic.supervisorUserCode,
      supervisorLecturerProfileID: wfTopic.supervisorLecturerProfileID,
      supervisorLecturerCode: wfTopic.supervisorLecturerCode,
      catalogTopicID: wfTopic.catalogTopicID,
      catalogTopicCode: wfTopic.catalogTopicCode,
      departmentID: wfTopic.departmentID,
      departmentCode: wfTopic.departmentCode,
      status: wfTopic.status,
      resubmitCount: wfTopic.resubmitCount,
      createdAt: wfTopic.createdAt,
      lastUpdated: wfTopic.lastUpdated,
      tagID: null,
      tagCode: tagCode ?? null,
      lecturerComment: wfTopic.lecturerComment ?? "",
    }),
    [],
  );

  const syncWorkflowTopicById = useCallback(
    async (topicId: number) => {
      const detail = await getWorkflowTopicDetailApi(topicId);
      setWorkflowDetail(detail);
      setSelectedDefenseTermId(detail.topic.defenseTermId ?? null);

      const firstTagCode = detail.tagCodes[0] ?? null;
      setExistingTopic(toTopicModel(detail.topic, firstTagCode));

      const selected = tags.filter((tag) =>
        detail.tagCodes.includes(tag.tagCode),
      );
      setTopicTagNames(selected);
      setSelectedTagIDs(selected.map((tag) => tag.tagID));

      // Preserve existing list type for compatibility with current UI blocks.
      setTopicTags(
        detail.tagCodes.map((tagCode, idx) => ({
          topicTagID: idx + 1,
          topicCode: detail.topic.topicCode,
          tagID: selected.find((tag) => tag.tagCode === tagCode)?.tagID || 0,
          tagCode,
          catalogTopicCode: detail.topic.catalogTopicCode,
          createdAt: detail.topic.createdAt,
        })),
      );
    },
    [tags, toTopicModel],
  );

  useEffect(() => {
    if (!existingTopic?.topicID) {
      setWorkflowDetail(null);
      return;
    }

    if (isEditing) return;

    const refreshDetail = async () => {
      try {
        const detail = await getWorkflowTopicDetailApi(existingTopic.topicID);
        setWorkflowDetail(detail);
        setSelectedDefenseTermId(detail.topic.defenseTermId ?? null);
      } catch (err) {
        console.error("Error loading workflow detail:", err);
      }
    };

    void refreshDetail();
  }, [existingTopic?.topicID, isEditing]);

  const handleEditTopic = async () => {
    if (!existingTopic) return;

    try {
      setLoading(true);
      setError(null);

      const detail = await getWorkflowTopicDetailApi(existingTopic.topicID);
      const topicData = detail.topic;
      setSelectedDefenseTermId(topicData.defenseTermId ?? null);

      // Populate form with existing data
      setEditFormData({
        topicCode: topicData.topicCode,
        title: topicData.title,
        summary: topicData.summary,
        type: topicData.type === "CATALOG" ? "CATALOG" : "SELF",
        catalogTopicID: topicData.catalogTopicID,
        supervisorLecturerProfileID: topicData.supervisorLecturerProfileID,
        departmentID: topicData.departmentID,
        tagID:
          tags.find((tag) => detail.tagCodes.includes(tag.tagCode))?.tagID ||
          null,
      });

      // Set registration type based on topic type
      setRegistrationType(topicData.type === "CATALOG" ? "catalog" : "self");

      // Load tag info based on topic type
      if (topicData.type === "CATALOG" && topicData.catalogTopicID) {
        // For catalog topics, use tags embedded in get-list-with-tags response
        let selectedTopic = catalogTopics.find(
          (t) => t.catalogTopicID === topicData.catalogTopicID,
        );

        if (!selectedTopic && topicData.catalogTopicCode) {
          const catalogByCode = await getCatalogTopicsWithTagsApi({
            catalogTopicCode: topicData.catalogTopicCode,
            page: 0,
            pageSize: 20,
          });
          selectedTopic = catalogByCode[0];
        }

        if (selectedTopic) {
          try {
            const embeddedTags = Array.isArray(selectedTopic.tags)
              ? selectedTopic.tags
              : [];
            const uniqueTagCodes = [
              ...new Set(
                embeddedTags
                  .map((item) => item.tagCode)
                  .filter(
                    (code) =>
                      typeof code === "string" && code.trim().length > 0,
                  ),
              ),
            ];

            if (uniqueTagCodes.length > 0) {
              const selectedFromMaster = tags.filter((tag) =>
                uniqueTagCodes.includes(tag.tagCode),
              );
              const resolvedTags =
                selectedFromMaster.length > 0
                  ? selectedFromMaster
                  : embeddedTags.map((item) => ({
                      tagID: item.tagID,
                      tagCode: item.tagCode,
                      tagName: item.tagName,
                      description: "",
                      createdAt: "",
                    }));

              setSelectedTagInfo(resolvedTags[0] || null);

              const tagCodesQuery = uniqueTagCodes
                .map((code) => `TagCodes=${encodeURIComponent(code)}`)
                .join("&");
              const lecturersRes = await fetchData(
                `/LecturerProfiles/get-list?${tagCodesQuery}`,
              );
              const availableLecturers =
                (lecturersRes as ApiResponse<LecturerProfile[]>)?.data || [];
              setFilteredLecturers(availableLecturers);
            }
          } catch (error) {
            console.error("Error loading catalog topic with tags:", error);
          }
        }
      } else if (topicData.type === "SELF" && detail.tagCodes.length > 0) {
        // For self-proposed topics, load tag from tagID
        try {
          const tagRes = await fetchData(
            `/Tags/list?TagCode=${detail.tagCodes[0]}`,
          );
          const tagData = (tagRes as ApiResponse<Tag[]>)?.data || [];

          if (tagData.length > 0) {
            const tagInfo = tagData[0];
            setSelectedTagInfo(tagInfo);

            // Get lecturers for this tag
            const lecturerTagsRes = await fetchData(
              `/LecturerTags/list?TagCode=${tagInfo.tagCode}`,
            );
            const lecturerTags =
              (lecturerTagsRes as ApiResponse<LecturerTag[]>)?.data || [];

            const tagLecturerCodes = lecturerTags.map((lt) => lt.lecturerCode);
            const availableLecturers = lecturers.filter((l) =>
              tagLecturerCodes.includes(l.lecturerCode),
            );

            setFilteredLecturers(availableLecturers);
          }
        } catch (error) {
          console.error("Error loading tag info for edit:", error);
        }
      }

      const selectedTagIDsFromCodes = tags
        .filter((tag) => detail.tagCodes.includes(tag.tagCode))
        .map((tag) => tag.tagID);
      setSelectedTagIDs(selectedTagIDsFromCodes);

      setIsEditing(true);
      // Don't set existingTopic to null - we need it for the update API call
      // setExistingTopic(null); // Hide the existing topic view
    } catch (error) {
      setError("Không thể tải dữ liệu đề tài để sửa");
      console.error("Error loading topic for editing:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!existingTopic?.topicCode) return;

    if (
      !window.confirm(
        "Bạn có chắc chắn muốn rollback dữ liệu test của đề tài này? Hành động này sẽ xóa dữ liệu hiện tại và cho phép bạn đăng ký lại.",
      )
    ) {
      return;
    }

    try {
      setSubmitting(true);
      await fetchData(
        `/workflows/topics/rollback-my-test-data?topicCode=${existingTopic.topicCode}`,
        {
          method: "POST",
        },
      );
      alert("Rollback thành công! Trang sẽ được tải lại.");
      window.location.reload();
    } catch (error) {
      console.error("Rollback error:", error);
      alert(
        "Rollback thất bại: " +
          (error instanceof Error ? error.message : "Lỗi không xác định"),
      );
    } finally {
      setSubmitting(false);
    }
  };


  useEffect(() => {
    void loadInitialData();
  }, [userCode, loadInitialData]);

  // Handle registration type change
  const handleRegistrationTypeChange = (type: "catalog" | "self") => {
    setRegistrationType(type);
    setFormData({
      ...formData,
      type: type === "catalog" ? "CATALOG" : "SELF",
      catalogTopicID: type === "catalog" ? formData.catalogTopicID : null,
      title: type === "catalog" ? formData.title : "",
      summary: type === "catalog" ? formData.summary : "",
      tagID: type === "catalog" ? formData.tagID : null,
      supervisorLecturerProfileID: null, // Reset lecturer selection
    });

    // Reset filtered data when switching types
    if (type === "self") {
      setSelectedTagInfo(null);
      setFilteredLecturers([]);
      setSelectedTagIDs([]);
    }
  };

  // Filter lecturers based on selected tags for self-proposed topics and edit mode
  useEffect(() => {
    if (
      (registrationType === "self" && selectedTagIDs.length > 0) ||
      (isEditing && selectedTagIDs.length > 0)
    ) {
      const filterLecturersForTags = async () => {
        try {
          // Get selected tags
          const selectedTags = tags.filter((t) =>
            selectedTagIDs.includes(t.tagID),
          );
          if (selectedTags.length === 0) return;

          // Build query parameters for multiple tags
          const tagCodes = selectedTags.map((t) => t.tagCode);
          const queryParams = tagCodes
            .map((code) => `TagCodes=${code}`)
            .join("&");

          // Get lecturers directly filtered by tags
          const lecturersRes = await fetchData(
            `/LecturerProfiles/get-list?${queryParams}`,
          );
          const availableLecturers =
            (lecturersRes as ApiResponse<LecturerProfile[]>)?.data || [];

          setFilteredLecturers(availableLecturers);
          // Set first selected tag as selectedTagInfo for display
          setSelectedTagInfo(selectedTags[0]);
        } catch (error) {
          console.error("Error filtering lecturers for tags:", error);
        }
      };

      void filterLecturersForTags();
    } else if (
      (registrationType === "self" && selectedTagIDs.length === 0) ||
      (isEditing && selectedTagIDs.length === 0)
    ) {
      setFilteredLecturers([]);
      setSelectedTagInfo(null);
    }
  }, [registrationType, selectedTagIDs, tags, lecturers, isEditing]);

  // Load topic tags when existing topic changes
  useEffect(() => {
    if (existingTopic) {
      const loadTopicTags = async () => {
        try {
          const topicTagsRes = await fetchData(
            `/TopicTags/list?TopicCode=${existingTopic.topicCode}`,
          );
          const topicTagsData =
            (topicTagsRes as ApiResponse<TopicTag[]>)?.data || [];
          setTopicTags(topicTagsData);
        } catch (error) {
          console.error("Error loading topic tags:", error);
          setTopicTags([]);
        }
      };

      void loadTopicTags();
    } else {
      setTopicTags([]);
    }
  }, [existingTopic]);

  // Load tag names from API when topicTags change
  useEffect(() => {
    if (topicTags.length > 0) {
      const loadTagNames = async () => {
        try {
          // Get unique tagCodes from topicTags
          const tagCodes = [...new Set(topicTags.map((tt) => tt.tagCode))];

          // Call API for each tagCode and collect results
          const tagPromises = tagCodes.map((tagCode) =>
            fetchData(`/Tags/list?TagCode=${tagCode}`),
          );

          const tagResponses = await Promise.all(tagPromises);
          const allTags: Tag[] = [];

          tagResponses.forEach((response) => {
            const tagsData = (response as ApiResponse<Tag[]>)?.data || [];
            allTags.push(...tagsData);
          });

          setTopicTagNames(allTags);
        } catch (error) {
          console.error("Error loading tag names:", error);
          setTopicTagNames([]);
        }
      };

      void loadTagNames();
    } else {
      setTopicTagNames([]);
    }
  }, [topicTags]);

  // Resolve a lecturer -> userID (tries in-memory lecturer.userID first,
  // then falls back to calling possible Users endpoints). Returns 0 if not found.
  const resolveSupervisorUserID = async (
    lecturer?: LecturerProfile | null,
  ): Promise<number> => {
    if (!lecturer) return 0;

    // Some API responses may already include userID on lecturer object (not in TS type)
    const maybeId = (lecturer as unknown as Record<string, unknown>).userID as
      | number
      | undefined;
    if (typeof maybeId === "number" && maybeId > 0) return maybeId;

    const userCode =
      lecturer.userCode ||
      ((lecturer as unknown as Record<string, unknown>).lecturerCode as
        | string
        | undefined);
    if (!userCode) return 0;

    // Try common user endpoints (best-effort; backend may not expose all of these)
    const candidates = [
      `/Users/get-list?UserCode=${encodeURIComponent(userCode)}`,
      `/Users/get-detail/${encodeURIComponent(userCode)}`,
      `/Users/list?UserCode=${encodeURIComponent(userCode)}`,
    ];

    for (const path of candidates) {
      try {
        const resp = await fetchData(path);
        const data = (resp as ApiResponse<unknown>)?.data ?? resp;
        if (!data) continue;
        if (Array.isArray(data) && data.length > 0) {
          const first = data[0] as Record<string, unknown>;
          if (typeof first.userID === "number") return first.userID as number;
        }
        const obj = data as Record<string, unknown>;
        if (typeof obj.userID === "number") return obj.userID as number;
      } catch {
        // ignore and try next candidate
      }
    }

    // not found — return 0 so backend can still attempt resolution from userCode
    return 0;
  };

  // Handle catalog topic selection
  const handleCatalogTopicChange = async (catalogTopicID: number) => {
    const selectedTopic = catalogTopics.find(
      (t) => t.catalogTopicID === catalogTopicID,
    );
    if (!selectedTopic) return;

    try {
      // Use embedded tags from get-list-with-tags instead of per-topic API calls
      const embeddedTags = Array.isArray(selectedTopic.tags)
        ? selectedTopic.tags
        : [];

      if (embeddedTags.length === 0) {
        setError("Đề tài này chưa có thông tin thẻ");
        return;
      }

      const uniqueTagCodes = [
        ...new Set(
          embeddedTags
            .map((item) => item.tagCode)
            .filter(
              (code) => typeof code === "string" && code.trim().length > 0,
            ),
        ),
      ];

      const selectedFromMaster = tags.filter((tag) =>
        uniqueTagCodes.includes(tag.tagCode),
      );
      const resolvedTags =
        selectedFromMaster.length > 0
          ? selectedFromMaster
          : embeddedTags.map((item) => ({
              tagID: item.tagID,
              tagCode: item.tagCode,
              tagName: item.tagName,
              description: "",
              createdAt: "",
            }));

      if (resolvedTags.length === 0) {
        setError("Không tìm thấy thông tin thẻ");
        return;
      }

      const uniqueTags = Array.from(
        new Map(resolvedTags.map((tag) => [tag.tagID, tag])).values(),
      );
      const firstTag = uniqueTags[0];

      // Step 3: Get lecturers for this tag
      const tagCodesQuery = uniqueTagCodes
        .map((code) => `TagCodes=${encodeURIComponent(code)}`)
        .join("&");
      const lecturersRes = await fetchData(
        `/LecturerProfiles/get-list?${tagCodesQuery}`,
      );
      const availableLecturers =
        (lecturersRes as ApiResponse<LecturerProfile[]>)?.data || [];

      // Update state
      setSelectedTagInfo(firstTag || null);
      setSelectedTagIDs(uniqueTags.map((tag) => tag.tagID));
      setFilteredLecturers(availableLecturers);

      // Update form data
      setFormData({
        ...formData,
        catalogTopicID,
        title: selectedTopic.title,
        summary: selectedTopic.summary,
        tagID: firstTag?.tagID || null,
        supervisorLecturerProfileID: null, // Reset lecturer selection
      });

      setError(null); // Clear any previous errors
    } catch (error) {
      setError("Có lỗi khi tải thông tin đề tài");
      console.error("Error loading topic details:", error);
    }
  };

  const getWorkflowFriendlyError = (
    err: unknown,
    fallbackMessage: string,
  ): string => {
    const rawMessage =
      err instanceof FetchDataError
        ? `${err.message} ${JSON.stringify(err.data ?? "")}`
        : err instanceof Error
          ? err.message
          : "";

    if (/defense\s*term|dot\s*bao\s*ve|đợt\s*bảo\s*vệ/i.test(rawMessage)) {
      return "Đợt bảo vệ đã chọn không hợp lệ hoặc không còn khả dụng. Vui lòng chọn lại đợt bảo vệ.";
    }

    return err instanceof Error ? err.message : fallbackMessage;
  };

  // Handle form submission - only for creating new topics
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (registrationType === "self" && selectedTagIDs.length === 0) {
        setError("Vui lòng chọn ít nhất một Tag");
        return;
      }

      const selectedLecturer = lecturers.find(
        (l) => l.lecturerProfileID === formData.supervisorLecturerProfileID,
      );
      const selectedDepartment = defaultDepartment;
      const selectedCatalogTopic = catalogTopics.find(
        (c) => c.catalogTopicID === formData.catalogTopicID,
      );

      if (!selectedLecturer) {
        setError("Vui lòng chọn giảng viên hướng dẫn.");
        return;
      }

      if (
        !selectedDepartment?.departmentID ||
        !selectedDepartment.departmentCode
      ) {
        setError("Không xác định được thông tin khoa/bộ môn.");
        return;
      }

      const supervisorUserID = await resolveSupervisorUserID(selectedLecturer);

      let proposerStudentProfileID = 0;
      let proposerStudentCode = "";
      if (auth.user?.userCode) {
        try {
          const studentRes = await fetchData(
            `/StudentProfiles/get-list?UserCode=${auth.user.userCode}`,
          );
          const studentData =
            (studentRes as ApiResponse<StudentProfile[]>)?.data || [];
          if (studentData.length > 0) {
            proposerStudentProfileID = studentData[0].studentProfileID;
            proposerStudentCode = studentData[0].studentCode;
          }
        } catch (error) {
          console.error("Error fetching student profile:", error);
        }
      }

      if (!proposerStudentProfileID || !proposerStudentCode) {
        setError("Không tìm thấy hồ sơ sinh viên để gửi đề tài.");
        return;
      }

      if (!selectedDefenseTermId) {
        setError("Vui lòng chọn đợt bảo vệ trước khi gửi đề tài.");
        return;
      }

      const effectiveTagIds =
        selectedTagIDs.length > 0
          ? selectedTagIDs
          : [formData.tagID, selectedTagInfo?.tagID].filter(
              (id): id is number => typeof id === "number" && id > 0,
            );
      const chosenTags = tags.filter((tag) =>
        effectiveTagIds.includes(tag.tagID),
      );
      const submitPayload: WorkflowResubmitRequest = {
        topicID: null,
        topicCode: null,
        title: formData.title,
        summary: formData.summary,
        type: formData.type,
        defenseTermId: selectedDefenseTermId,
        proposerUserID: auth.user?.userID || 0,
        proposerUserCode: auth.user?.userCode || "",
        proposerStudentProfileID,
        proposerStudentCode,
        supervisorUserID,
        supervisorUserCode: selectedLecturer.userCode || "",
        supervisorLecturerProfileID: formData.supervisorLecturerProfileID || 0,
        supervisorLecturerCode: selectedLecturer.lecturerCode || "",
        reviewedByUserCode: selectedLecturer.userCode || null,
        reviewedByRole: ROLE_LECTURER,
        catalogTopicID: formData.catalogTopicID,
        catalogTopicCode: selectedCatalogTopic?.catalogTopicCode || null,
        departmentID: formData.departmentID || selectedDepartment.departmentID,
        departmentCode: selectedDepartment.departmentCode,
        tagIDs: chosenTags.map((tag) => tag.tagID),
        tagCodes: chosenTags.map((tag) => tag.tagCode),
        useCatalogTopicTags: formData.type === "CATALOG",
        forceCreateNewTopic: true,
        studentNote: "Nộp lần đầu",
      };

      const workflowResult =
        submitPayload.topicID === null && !submitPayload.topicCode
          ? await submitTopicWorkflow(submitPayload)
          : await resubmitTopicWorkflow(submitPayload);
      await syncWorkflowTopicById(workflowResult.topic.topicID);

      setSuccess(workflowResult.message || "Đăng ký đề tài thành công!");
      setShowSuccessModal(true);
    } catch (error) {
      setError(
        getWorkflowFriendlyError(error, "Có lỗi xảy ra khi xử lý đề tài"),
      );
      console.error("Error submitting topic:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit form submission - workflow resubmit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (!existingTopic) {
        throw new Error("Không tìm thấy đề tài để cập nhật");
      }

      if (selectedTagIDs.length === 0) {
        setError("Vui lòng chọn ít nhất một Tag");
        return;
      }

      if (!selectedDefenseTermId) {
        setError("Vui lòng chọn đợt bảo vệ trước khi cập nhật đề tài.");
        return;
      }

      const selectedLecturer = lecturers.find(
        (l) => l.lecturerProfileID === editFormData.supervisorLecturerProfileID,
      );
      const selectedDepartment = defaultDepartment;
      const selectedCatalogTopic = catalogTopics.find(
        (c) => c.catalogTopicID === editFormData.catalogTopicID,
      );

      if (!selectedLecturer) {
        setError("Vui lòng chọn giảng viên hướng dẫn.");
        return;
      }

      if (
        !selectedDepartment?.departmentID ||
        !selectedDepartment.departmentCode
      ) {
        setError("Không xác định được thông tin khoa/bộ môn.");
        return;
      }

      const supervisorUserID = await resolveSupervisorUserID(selectedLecturer);
      const effectiveTagIds =
        selectedTagIDs.length > 0
          ? selectedTagIDs
          : [editFormData.tagID, selectedTagInfo?.tagID].filter(
              (id): id is number => typeof id === "number" && id > 0,
            );
      const chosenTags = tags.filter((tag) =>
        effectiveTagIds.includes(tag.tagID),
      );

      const resubmitPayload: WorkflowResubmitRequest = {
        topicID: existingTopic.topicID,
        topicCode: existingTopic.topicCode || null,
        title: editFormData.title,
        summary: editFormData.summary,
        type: editFormData.type,
        defenseTermId: selectedDefenseTermId,
        proposerUserID: existingTopic.proposerUserID,
        proposerUserCode: existingTopic.proposerUserCode,
        proposerStudentProfileID: existingTopic.proposerStudentProfileID,
        proposerStudentCode: existingTopic.proposerStudentCode,
        supervisorUserID,
        supervisorUserCode: selectedLecturer.userCode || "",
        supervisorLecturerProfileID:
          editFormData.supervisorLecturerProfileID || 0,
        supervisorLecturerCode: selectedLecturer.lecturerCode || "",
        reviewedByUserCode: selectedLecturer.userCode || null,
        reviewedByRole: ROLE_LECTURER,
        catalogTopicID: editFormData.catalogTopicID,
        catalogTopicCode: selectedCatalogTopic?.catalogTopicCode || null,
        departmentID:
          editFormData.departmentID || selectedDepartment.departmentID,
        departmentCode: selectedDepartment.departmentCode,
        tagIDs: chosenTags.map((tag) => tag.tagID),
        tagCodes: chosenTags.map((tag) => tag.tagCode),
        useCatalogTopicTags: editFormData.type === "CATALOG",
        forceCreateNewTopic: false,
        studentNote: "Em đã cập nhật theo góp ý",
      };

      const workflowResult = await resubmitTopicWorkflow(resubmitPayload);
      await syncWorkflowTopicById(workflowResult.topic.topicID);

      setSuccess(workflowResult.message || "Cập nhật đề tài thành công!");
      setShowSuccessModal(true);
      setIsEditing(false);
    } catch (error) {
      setError(
        getWorkflowFriendlyError(error, "Có lỗi xảy ra khi cập nhật đề tài"),
      );
      console.error("Error updating topic:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "400px",
          fontSize: "18px",
          color: "#666",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #f37021",
              borderTop: "4px solid transparent",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          ></div>
          Đang tải dữ liệu...
        </div>
      </div>
    );
  }

  // If editing existing topic, show edit form
  if (isEditing && existingTopic) {
    return (
      <div
        style={{
          padding: "24px",
          maxWidth: "900px",
          margin: "0 auto",
          backgroundColor: "#fff",
          minHeight: "100vh",
        }}
      >
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>

        {/* Header */}
        <div
          style={{
            marginBottom: "32px",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              color: "#f37021",
              fontSize: "28px",
              fontWeight: "bold",
              margin: "0 0 8px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <Edit size={32} />
            Sửa đề tài
          </h1>
          <p
            style={{
              color: "#666",
              fontSize: "16px",
              margin: 0,
            }}
          >
            Chỉnh sửa thông tin đề tài của bạn
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div
            style={{
              backgroundColor: "#ffebee",
              border: "1px solid #f44336",
              borderRadius: "8px",
              padding: "12px 16px",
              marginBottom: "24px",
              color: "#d32f2f",
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              backgroundColor: "#e8f5e8",
              border: "1px solid #4caf50",
              borderRadius: "8px",
              padding: "12px 16px",
              marginBottom: "24px",
              color: "#2e7d32",
            }}
          >
            {success}
          </div>
        )}

        {/* Edit Form */}
        <form
          onSubmit={handleEditSubmit}
          style={{
            backgroundColor: "#fafafa",
            padding: "32px",
            borderRadius: "12px",
            border: "1px solid #eee",
          }}
        >
          {/* Topic Code */}
          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "600",
                color: "#333",
                fontSize: "16px",
              }}
            >
              <FileText
                size={16}
                style={{ marginRight: "8px", verticalAlign: "middle" }}
              />
              Mã đề tài
            </label>
            <input
              type="text"
              value={editFormData.topicCode || ""}
              readOnly
              placeholder="Mã đề tài sẽ được giữ nguyên"
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "2px solid #ddd",
                borderRadius: "8px",
                fontSize: "16px",
                backgroundColor: "#f5f5f5",
                color: "#666",
                cursor: "not-allowed",
              }}
            />
          </div>

          {/* Title */}
          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "600",
                color: "#333",
                fontSize: "16px",
              }}
            >
              <BookOpen
                size={16}
                style={{ marginRight: "8px", verticalAlign: "middle" }}
              />
              Tên đề tài
            </label>
            <input
              type="text"
              value={editFormData.title}
              onChange={(e) =>
                setEditFormData({ ...editFormData, title: e.target.value })
              }
              required
              placeholder="Nhập tên đề tài"
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "2px solid #ddd",
                borderRadius: "8px",
                fontSize: "16px",
                transition: "border-color 0.3s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#f37021")}
              onBlur={(e) => (e.target.style.borderColor = "#ddd")}
            />
          </div>

          {/* Summary */}
          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "600",
                color: "#333",
                fontSize: "16px",
              }}
            >
              <FileText
                size={16}
                style={{ marginRight: "8px", verticalAlign: "middle" }}
              />
              Tóm tắt đề tài
            </label>
            <textarea
              value={editFormData.summary}
              onChange={(e) =>
                setEditFormData({ ...editFormData, summary: e.target.value })
              }
              required
              placeholder="Nhập tóm tắt đề tài"
              rows={4}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "2px solid #ddd",
                borderRadius: "8px",
                fontSize: "16px",
                fontFamily: "inherit",
                resize: "vertical",
                transition: "border-color 0.3s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#f37021")}
              onBlur={(e) => (e.target.style.borderColor = "#ddd")}
            />
          </div>

          {/* Department */}
          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "600",
                color: "#333",
                fontSize: "16px",
              }}
            >
              <Building
                size={16}
                style={{ marginRight: "8px", verticalAlign: "middle" }}
              />
              Khoa
            </label>
            <input
              type="text"
              value={defaultDepartment?.name || "Công nghệ thông tin"}
              readOnly
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "2px solid #ddd",
                borderRadius: "8px",
                fontSize: "16px",
                backgroundColor: "#f5f5f5",
                color: "#666",
                cursor: "not-allowed",
              }}
            />
          </div>

          {/* Defense Term */}
          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "600",
                color: "#333",
                fontSize: "16px",
              }}
            >
              <FileText
                size={16}
                style={{ marginRight: "8px", verticalAlign: "middle" }}
              />
              Đợt bảo vệ *
            </label>
            <select
              value={selectedDefenseTermId ?? ""}
              onChange={(e) => {
                const picked = defenseTerms.find(
                  (term) => String(term.defenseTermId) === e.target.value,
                );
                setSelectedDefenseTermId(picked ? picked.defenseTermId : null);
              }}
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "2px solid #ddd",
                borderRadius: "8px",
                fontSize: "16px",
                backgroundColor: "#fff",
                transition: "border-color 0.3s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#f37021")}
              onBlur={(e) => (e.target.style.borderColor = "#ddd")}
            >
              <option value="">-- Chọn đợt bảo vệ --</option>
              {defenseTerms.map((term) => (
                <option key={term.defenseTermId} value={term.defenseTermId}>
                  {term.defenseTermCode} - {term.defenseTermName}
                </option>
              ))}
            </select>
            {defenseTerms.length === 0 && (
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "12px",
                  color: "#f44336",
                }}
              >
                Hiện chưa có đợt bảo vệ khả dụng, vui lòng thử lại sau.
              </div>
            )}
          </div>

          {/* Tags */}
          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "600",
                color: "#333",
                fontSize: "16px",
              }}
            >
              <GraduationCap
                size={16}
                style={{ marginRight: "8px", verticalAlign: "middle" }}
              />
              Tags *
            </label>
            <div
              style={{
                border: "2px solid #ddd",
                borderRadius: "8px",
                padding: "16px",
                backgroundColor: "#fff",
              }}
            >
              <div
                style={{
                  marginBottom: "12px",
                  fontSize: "14px",
                  color: "#666",
                }}
              >
                Chọn một hoặc nhiều Tags:
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "8px",
                }}
              >
                {tags.map((tag) => (
                  <label
                    key={tag.tagID}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "8px 12px",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      backgroundColor: selectedTagIDs.includes(tag.tagID)
                        ? "#fff3cd"
                        : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTagIDs.includes(tag.tagID)}
                      onChange={(e) => {
                        const tagID = tag.tagID;
                        if (e.target.checked) {
                          setSelectedTagIDs((prev) => [...prev, tagID]);
                        } else {
                          setSelectedTagIDs((prev) =>
                            prev.filter((id) => id !== tagID),
                          );
                        }
                      }}
                      style={{ marginRight: "8px" }}
                    />
                    <div>
                      <div style={{ fontWeight: "500", fontSize: "14px" }}>
                        {tag.tagName}
                      </div>
                      <div style={{ fontSize: "12px", color: "#666" }}>
                        {tag.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              {selectedTagIDs.length === 0 && (
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "12px",
                    color: "#f44336",
                  }}
                >
                  Vui lòng chọn ít nhất một Tag
                </div>
              )}
            </div>
          </div>

          {/* Lecturer */}
          <div style={{ marginBottom: "32px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "600",
                color: "#333",
                fontSize: "16px",
              }}
            >
              <PersonIcon
                size={16}
                style={{ marginRight: "8px", verticalAlign: "middle" }}
              />
              Giảng viên hướng dẫn
            </label>
            <select
              value={editFormData.supervisorLecturerProfileID || ""}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  supervisorLecturerProfileID: Number(e.target.value),
                })
              }
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "2px solid #ddd",
                borderRadius: "8px",
                fontSize: "16px",
                backgroundColor: "#fff",
                transition: "border-color 0.3s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#f37021")}
              onBlur={(e) => (e.target.style.borderColor = "#ddd")}
            >
              <option value="">-- Chọn giảng viên --</option>
              {filteredLecturers.map((lecturer) => (
                <option
                  key={lecturer.lecturerProfileID}
                  value={lecturer.lecturerProfileID}
                >
                  {lecturer.fullName || lecturer.lecturerCode} -{" "}
                  {lecturer.degree} ({lecturer.currentGuidingCount}/
                  {lecturer.guideQuota})
                </option>
              ))}
            </select>

            {/* Quota Info */}
            {editFormData.supervisorLecturerProfileID && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "12px",
                  backgroundColor: "#f0f7ff",
                  border: "1px solid #2196f3",
                  borderRadius: "6px",
                  fontSize: "13px",
                  color: "#1565c0",
                }}
              >
                {(() => {
                  const lecturer = filteredLecturers.find(
                    (l) =>
                      l.lecturerProfileID ===
                      editFormData.supervisorLecturerProfileID,
                  );
                  if (!lecturer) return null;
                  const available =
                    lecturer.guideQuota - lecturer.currentGuidingCount;
                  return (
                    <>
                      <strong>{lecturer.fullName}</strong> - {lecturer.degree}
                      <br />
                      Sinh viên hướng dẫn: {lecturer.currentGuidingCount}/
                      {lecturer.guideQuota}
                      {available > 0
                        ? ` (Còn ${available} slot)`
                        : " (Hạn chế)"}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div style={{ textAlign: "center" }}>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              style={{
                padding: "12px 24px",
                backgroundColor: "#f5f5f5",
                color: "#666",
                border: "2px solid #ddd",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "500",
                cursor: "pointer",
                marginRight: "16px",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#e0e0e0";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "#f5f5f5";
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "12px 32px",
                backgroundColor: submitting ? "#ccc" : "#f37021",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "500",
                cursor: submitting ? "not-allowed" : "pointer",
                transition: "all 0.3s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
              onMouseEnter={(e) => {
                if (!submitting) {
                  e.currentTarget.style.backgroundColor = "#d55a1b";
                }
              }}
              onMouseOut={(e) => {
                if (!submitting) {
                  e.currentTarget.style.backgroundColor = "#f37021";
                }
              }}
            >
              {submitting ? (
                <>
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      border: "2px solid #fff",
                      borderTop: "2px solid transparent",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  Đang cập nhật...
                </>
              ) : (
                <>
                  <Edit size={16} />
                  Cập nhật đề tài
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // If student already has a pending or approved topic, show topic details
  if (existingTopic) {
    return (
      <div
        style={{
          padding: "24px",
          maxWidth: "900px",
          margin: "10px auto",
          backgroundColor: "#fff",
          minHeight: "100vh",
        }}
      >
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>

        {/* Header */}
        <div
          style={{
            marginBottom: "32px",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              color: "#f37021",
              fontSize: "28px",
              fontWeight: "bold",
              margin: "0 0 8px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <BookOpen size={32} />
            {existingTopic.status === "Đang chờ"
              ? "Đề tài của bạn đang được xét duyệt"
              : "Đề tài của bạn"}
          </h1>
          <p
            style={{
              color: "#666",
              fontSize: "16px",
              margin: 0,
            }}
          >
            {existingTopic.status === "Đang chờ"
              ? "Vui lòng chờ quyết định từ giảng viên hướng dẫn và ban quản lý"
              : "Đề tài của bạn đã được duyệt thành công"}
          </p>
        </div>

        {/* Topic Details */}
        <div
          style={{
            backgroundColor: "#fafafa",
            padding: "32px",
            borderRadius: "12px",
            border: "1px solid #eee",
          }}
        >
          <div style={{ marginBottom: "24px" }}>
            <h2
              style={{
                color: "#f37021",
                fontSize: "20px",
                fontWeight: "bold",
                margin: "0 0 16px 0",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FileText size={20} />
              Thông tin đề tài
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: "600",
                    color: "#333",
                    fontSize: "14px",
                    marginBottom: "4px",
                  }}
                >
                  Mã đề tài
                </label>
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "14px",
                    color: "#666",
                  }}
                >
                  {existingTopic.topicCode}
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: "600",
                    color: "#333",
                    fontSize: "14px",
                    marginBottom: "4px",
                  }}
                >
                  Trạng thái
                </label>
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor:
                      existingTopic.status === "Đang chờ"
                        ? "#fff3cd"
                        : "#e8f5e8",
                    border: `1px solid ${
                      existingTopic.status === "Đang chờ"
                        ? "#ffc107"
                        : "#4caf50"
                    }`,
                    borderRadius: "6px",
                    fontSize: "14px",
                    color:
                      existingTopic.status === "Đang chờ"
                        ? "#856404"
                        : "#2e7d32",
                    fontWeight: "500",
                  }}
                >
                  {getDisplayedTopicStatus(existingTopic.status)}
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: "600",
                    color: "#333",
                    fontSize: "14px",
                    marginBottom: "4px",
                  }}
                >
                  Tên đề tài
                </label>
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "14px",
                    color: "#333",
                  }}
                >
                  {existingTopic.title}
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: "600",
                    color: "#333",
                    fontSize: "14px",
                    marginBottom: "4px",
                  }}
                >
                  Tóm tắt đề tài
                </label>
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "14px",
                    color: "#333",
                    lineHeight: "1.5",
                  }}
                >
                  {existingTopic.summary}
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: "600",
                    color: "#333",
                    fontSize: "14px",
                    marginBottom: "4px",
                  }}
                >
                  Loại đề tài
                </label>
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "14px",
                    color: "#333",
                  }}
                >
                  {existingTopic.type === "CATALOG"
                    ? "Chọn từ danh mục có sẵn"
                    : "Tự đề xuất"}
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: "600",
                    color: "#333",
                    fontSize: "14px",
                    marginBottom: "4px",
                  }}
                >
                  Giảng viên hướng dẫn
                </label>
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "14px",
                    color: "#333",
                  }}
                >
                  {(() => {
                    const supervisor = lecturers.find(
                      (l) => l.userCode === existingTopic.supervisorUserCode,
                    );
                    return (
                      supervisor?.fullName ||
                      existingTopic.supervisorLecturerCode ||
                      "Chưa có"
                    );
                  })()}
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: "600",
                    color: "#333",
                    fontSize: "14px",
                    marginBottom: "4px",
                  }}
                >
                  Khoa
                </label>
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "14px",
                    color: "#333",
                  }}
                >
                  {(() => {
                    // Use default department name if it matches, otherwise show existing topic's department
                    if (
                      defaultDepartment &&
                      defaultDepartment.departmentID ===
                        existingTopic.departmentID
                    ) {
                      return defaultDepartment.name;
                    }
                    return existingTopic.departmentCode || "Chưa có";
                  })()}
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: "600",
                    color: "#333",
                    fontSize: "14px",
                    marginBottom: "4px",
                  }}
                >
                  Tags
                </label>
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "14px",
                    color: "#333",
                  }}
                >
                  {(() => {
                    // Display tag names from topicTagNames API data
                    if (topicTagNames.length > 0) {
                      const tagNames = topicTagNames.map((tag) => tag.tagName);
                      return tagNames.length > 0
                        ? tagNames.join(", ")
                        : "Chưa có";
                    }

                    // Fallback to old logic if topicTagNames is empty
                    const byId = tags.find(
                      (t) => t.tagID === existingTopic.tagID,
                    )?.tagName;
                    if (byId) return byId;
                    const byCode = tags.find(
                      (t) => t.tagCode === existingTopic.tagCode,
                    )?.tagName;
                    return byCode || existingTopic.tagCode || "Chưa có";
                  })()}
                </div>
              </div>

              {/* Lecturer Comment - only show for rejected or revision topics */}
              {(existingTopic.status === "Từ chối" ||
                existingTopic.status === "Cần sửa đổi") &&
                existingTopic.lecturerComment && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label
                      style={{
                        display: "block",
                        fontWeight: "600",
                        color: "#333",
                        fontSize: "14px",
                        marginBottom: "4px",
                      }}
                    >
                      Nhận xét của giảng viên
                    </label>
                    <div
                      style={{
                        padding: "12px",
                        backgroundColor: "#fff3cd",
                        border: "1px solid #ffc107",
                        borderRadius: "6px",
                        fontSize: "14px",
                        color: "#856404",
                        lineHeight: "1.5",
                      }}
                    >
                      {existingTopic.lecturerComment}
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Status Message */}
          <div
            style={{
              backgroundColor:
                existingTopic.status === "Đang chờ"
                  ? "#e3f2fd"
                  : existingTopic.status === "Từ chối" ||
                      existingTopic.status === "Cần sửa đổi"
                    ? "#ffebee"
                    : "#e8f5e8",
              border: `1px solid ${
                existingTopic.status === "Đang chờ"
                  ? "#2196f3"
                  : existingTopic.status === "Từ chối" ||
                      existingTopic.status === "Cần sửa đổi"
                    ? "#f44336"
                    : "#4caf50"
              }`,
              borderRadius: "8px",
              padding: "16px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                color:
                  existingTopic.status === "Đang chờ"
                    ? "#1976d2"
                    : existingTopic.status === "Từ chối" ||
                        existingTopic.status === "Cần sửa đổi"
                      ? "#c62828"
                      : "#2e7d32",
                fontSize: "16px",
                fontWeight: "500",
                marginBottom: "8px",
              }}
            >
              {existingTopic.status === "Đang chờ"
                ? "Đề tài của bạn đang trong quá trình xét duyệt"
                : existingTopic.status === "Từ chối"
                  ? "Đề tài của bạn đã bị từ chối"
                  : existingTopic.status === "Cần sửa đổi"
                    ? "Đề tài của bạn cần được sửa đổi"
                    : "Đề tài của bạn đã được duyệt thành công"}
            </div>
            <div
              style={{
                color: "#666",
                fontSize: "14px",
                marginBottom:
                  existingTopic.status === "Từ chối" ||
                  existingTopic.status === "Cần sửa đổi"
                    ? "16px"
                    : "0",
              }}
            >
              {existingTopic.status === "Đang chờ"
                ? "Bạn sẽ nhận được thông báo khi có kết quả. Trong thời gian này, bạn không thể đăng ký đề tài mới."
                : existingTopic.status === "Từ chối"
                  ? "Bạn có thể sửa đổi và đăng ký lại đề tài mới."
                  : existingTopic.status === "Cần sửa đổi"
                    ? "Vui lòng sửa đổi đề tài theo nhận xét của giảng viên và gửi lại."
                    : "Chúc mừng! Bạn có thể bắt đầu thực hiện đề tài của mình."}
            </div>

            {/* Edit Topic Button - only show for rejected or revision topics */}
            {(existingTopic.status === "Từ chối" ||
              existingTopic.status === "Cần sửa đổi") && (
              <button
                onClick={handleEditTopic}
                style={{
                  backgroundColor: "#f37021",
                  color: "#fff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "background-color 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#d55a1b";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "#f37021";
                }}
              >
                <Edit size={16} />
                Sửa đề tài
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsTopicRenameModalOpen(true)}
              style={{
                marginTop:
                  existingTopic.status === "Từ chối" ||
                  existingTopic.status === "Cần sửa đổi"
                    ? "16px"
                    : "0",
                backgroundColor: "#fff",
                color: "#f37021",
                border: "1px solid #f37021",
                padding: "10px 20px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                transition: "background-color 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "#fff8f3";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "#fff";
              }}
            >
              <Edit size={16} />
              Đơn xin đổi đề tài
            </button>

            <button
              type="button"
              onClick={handleRollback}
              disabled={submitting}
              style={{
                marginTop: "16px",
                marginLeft: "12px",
                backgroundColor: "#fff",
                color: "#dc3545",
                border: "1px solid #dc3545",
                padding: "10px 20px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: submitting ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s",
                opacity: submitting ? 0.7 : 1,
              }}
              onMouseOver={(e) => {
                if (!submitting) {
                  e.currentTarget.style.backgroundColor = "#fff5f5";
                }
              }}
              onMouseOut={(e) => {
                if (!submitting) {
                  e.currentTarget.style.backgroundColor = "#fff";
                }
              }}
            >
              <RotateCcw size={16} />
              Rollback dữ liệu test
            </button>

          </div>
        </div>
        <TopicRenameRequestModalView
          isOpen={isTopicRenameModalOpen}
          onClose={() => setIsTopicRenameModalOpen(false)}
          currentTopic={{
            topicID: existingTopic.topicID,
            topicCode: existingTopic.topicCode || null,
            title: existingTopic.title || null,
            proposerUserCode: existingTopic.proposerUserCode || null,
            supervisorUserCode: existingTopic.supervisorUserCode || null,
          }}
        />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 lg:p-10 font-sans text-slate-900">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');
          
          .font-vietnam { font-family: 'Be Vietnam Pro', sans-serif; }
          
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes shine { from { left: -100%; } to { left: 200%; } }
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
        `}
      </style>

      <div className="max-w-[1550px] mx-auto animate-[fadeIn_0.5s_ease-out] font-vietnam">
        <header className="mb-12 text-center">
            <h1 className="text-5xl font-extrabold text-[#002855] tracking-tight mb-3 font-jakarta">Đăng ký Đề tài Tốt nghiệp</h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em]">Thesis Registration Workspace</p>
        </header>

        <form onSubmit={isEditing ? handleEditSubmit : handleSubmit} className="bg-white rounded-[48px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.08)] border border-slate-200 overflow-hidden flex flex-col xl:flex-row min-h-[800px] items-stretch">
          
          {/* SECTION 1: Parameters (32%) */}
          <div className="xl:w-[32%] bg-slate-50/50 p-12 border-r border-slate-200 flex flex-col">
            <div className="flex items-center gap-4 mb-12">
                <div className="w-12 h-12 bg-[#002855] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                    <LayoutGrid size={22} />
                </div>
                <div>
                    <span className="font-black text-slate-900 uppercase tracking-widest text-[11px] block font-jakarta">Cấu hình Đề tài</span>
                    <span className="text-slate-500 text-[10px] font-extrabold">Lựa chọn loại hình đăng ký</span>
                </div>
            </div>

            {/* Mode Switcher */}
            <div className="bg-slate-200/40 p-1.5 rounded-3xl mb-12 flex">
                <button
                    type="button"
                    onClick={() => handleRegistrationTypeChange("catalog")}
                    className={`flex-1 py-4 rounded-[22px] text-xs font-black uppercase tracking-wider transition-all duration-300 ${registrationType === "catalog" ? "bg-white text-[#F37021] shadow-xl shadow-orange-100/50 scale-[1.02]" : "text-slate-400 hover:text-slate-600"}`}
                >
                    Danh mục
                </button>
                <button
                    type="button"
                    onClick={() => handleRegistrationTypeChange("self")}
                    className={`flex-1 py-4 rounded-[22px] text-xs font-black uppercase tracking-wider transition-all duration-300 ${registrationType === "self" ? "bg-white text-[#F37021] shadow-xl shadow-orange-100/50 scale-[1.02]" : "text-slate-400 hover:text-slate-600"}`}
                >
                    Tự đề xuất
                </button>
            </div>

            <div className="space-y-10 flex-1">
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Tiêu đề đề tài</label>
                    </div>
                    <div className="relative group">
                        <input
                            type="text"
                            value={isEditing ? editFormData.title : formData.title}
                            onChange={(e) => {
                                if (registrationType === "self") {
                                    isEditing ? setEditFormData({ ...editFormData, title: e.target.value }) : setFormData({ ...formData, title: e.target.value })
                                }
                            }}
                            readOnly={registrationType === "catalog"}
                            placeholder={registrationType === "catalog" ? "Nhấp vào đây hoặc kính lúp để chọn đề tài..." : "Nhập tên đề tài của bạn..."}
                            className={`w-full px-6 py-5 border-2 rounded-[24px] text-[15px] transition-all duration-300 font-bold font-jakarta ${
                                registrationType === "catalog" 
                                    ? "bg-slate-50 border-slate-300 text-slate-600 cursor-pointer pr-16" 
                                    : "bg-white border-slate-400/50 text-slate-900 focus:outline-none focus:border-[#F37021] focus:ring-4 focus:ring-orange-500/10 shadow-sm"
                            }`}
                            onClick={() => { if (registrationType === "catalog") setIsCatalogModalOpen(true); }}
                        />
                        {registrationType === "catalog" && (
                            <button
                                type="button"
                                onClick={() => setIsCatalogModalOpen(true)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-orange-50 text-[#F37021] rounded-xl hover:bg-[#F37021] hover:text-white transition-all shadow-sm z-10"
                            >
                                <Search size={18} />
                            </button>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest ml-1">Tóm tắt nội dung</label>
                    <textarea
                        value={isEditing ? editFormData.summary : formData.summary}
                        onChange={(e) => {
                            if (registrationType === "self") {
                                isEditing ? setEditFormData({ ...editFormData, summary: e.target.value }) : setFormData({ ...formData, summary: e.target.value })
                            }
                        }}
                        readOnly={registrationType === "catalog"}
                        rows={11}
                        placeholder={registrationType === "catalog" ? "Nội dung tóm tắt sẽ hiển thị sau khi chọn đề tài." : "Mô tả mục tiêu, công nghệ và phạm vi..."}
                        className={`w-full px-6 py-5 border-2 rounded-[24px] text-[15px] transition-all duration-300 resize-none font-bold leading-relaxed font-jakarta ${
                            registrationType === "catalog" 
                                ? "bg-slate-50 border-slate-300 text-slate-500 cursor-default" 
                                : "bg-white border-slate-400/50 text-slate-900 focus:outline-none focus:border-[#F37021] focus:ring-4 focus:ring-orange-500/10 shadow-sm"
                        }`}
                    />
                </div>
            </div>
          </div>

          {/* SECTION 2: Customization (43%) */}
          <div className="xl:w-[43%] pt-12 px-12 pb-4 flex flex-col">
            <div className="flex items-center gap-4 mb-12">
                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-[#F37021]">
                    <GraduationCap size={24} />
                </div>
                <div>
                    <span className="font-black text-slate-800 uppercase tracking-widest text-[11px] block font-jakarta">Lĩnh vực & Giảng viên</span>
                    <span className="text-slate-400 text-[10px] font-bold">Phân loại và chọn người hướng dẫn</span>
                </div>
            </div>

            <div className="space-y-12 flex-1">
                <div>
                    <div className="flex items-center justify-between mb-5">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Tags nhận diện</label>
                        <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-3 py-1 rounded-full">Chọn ít nhất 1</span>
                    </div>
                    <div className="flex flex-wrap gap-2.5 max-h-[160px] overflow-y-auto custom-scrollbar pr-2 py-1">
                        {tags.map((tag) => (
                            <button
                                key={tag.tagID}
                                type="button"
                                onClick={() => {
                                    const tagID = tag.tagID;
                                    if (selectedTagIDs.includes(tagID)) {
                                        setSelectedTagIDs(selectedTagIDs.filter((id) => id !== tagID));
                                    } else {
                                        setSelectedTagIDs([...selectedTagIDs, tagID]);
                                    }
                                }}
                                className={`px-5 py-3 rounded-2xl text-xs font-black transition-all duration-300 border-2 font-jakarta ${
                                    selectedTagIDs.includes(tag.tagID)
                                        ? "bg-[#F37021] border-[#F37021] text-white shadow-lg shadow-orange-100 scale-105"
                                        : "bg-white border-slate-300 text-slate-500 hover:border-orange-200 hover:text-orange-500"
                                }`}
                            >
                                {tag.tagName}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                    <label className="block text-[11px] font-black text-slate-500 uppercase mb-5 tracking-widest ml-1">Giảng viên hướng dẫn</label>
                    <div className="overflow-y-auto custom-scrollbar pr-2" style={{ maxHeight: "380px" }}>
                        <table className="w-full border-separate border-spacing-y-3">
                            <thead>
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <th className="text-left px-6 pb-2">Giảng viên</th>
                                    <th className="text-center pb-2">Hạn ngạch</th>
                                    <th className="text-right px-6 pb-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLecturers.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-10 text-center text-slate-400 text-xs font-bold italic bg-slate-50/50 rounded-[24px] border-2 border-dashed border-slate-200">
                                            Vui lòng chọn lĩnh vực hoặc đề tài để xem danh sách giảng viên phù hợp
                                        </td>
                                    </tr>
                                )}
                                {filteredLecturers.slice(0, 3).map((lecturer) => {
                                    const isSelected = (isEditing ? editFormData.supervisorLecturerProfileID : formData.supervisorLecturerProfileID) === lecturer.lecturerProfileID;
                                    return (
                                        <tr 
                                            key={lecturer.lecturerProfileID}
                                            onClick={() => isEditing 
                                                ? setEditFormData({ ...editFormData, supervisorLecturerProfileID: lecturer.lecturerProfileID })
                                                : setFormData({ ...formData, supervisorLecturerProfileID: lecturer.lecturerProfileID })
                                            }
                                            className={`group cursor-pointer transition-all duration-300 ${
                                                isSelected ? "bg-orange-50/50" : "hover:bg-slate-50"
                                            }`}
                                        >
                                            <td className={`px-6 py-4 rounded-l-[24px] border-y-2 border-l-2 transition-all ${
                                                isSelected ? "border-[#F37021]" : "border-slate-300"
                                            }`}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm transition-colors overflow-hidden shrink-0 ${
                                                        isSelected ? "bg-[#F37021] text-white" : "bg-white text-slate-400 shadow-sm border border-slate-100"
                                                    }`}>
                                                        {lecturer.profileImage ? (
                                                            <img 
                                                                src={getAvatarUrl(lecturer.profileImage)} 
                                                                alt={lecturer.fullName}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                    (e.target as HTMLImageElement).parentElement!.innerText = lecturer.fullName?.charAt(0) || "?";
                                                                }}
                                                            />
                                                        ) : (
                                                            lecturer.fullName?.charAt(0)
                                                        )}
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-[14px] font-black text-slate-800 truncate font-jakarta">{lecturer.fullName}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{lecturer.degree}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={`py-4 border-y-2 transition-all ${
                                                isSelected ? "border-[#F37021]" : "border-slate-300"
                                            }`}>
                                                <div className="flex flex-col items-center gap-1.5 min-w-[100px]">
                                                    <span className={`text-[11px] font-black ${lecturer.currentGuidingCount >= lecturer.guideQuota ? "text-red-500" : "text-[#F37021]"}`}>
                                                        {lecturer.currentGuidingCount} / {lecturer.guideQuota}
                                                    </span>
                                                    <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full transition-all duration-1000 ${lecturer.currentGuidingCount >= lecturer.guideQuota ? "bg-red-500" : "bg-[#F37021]"}`}
                                                            style={{ width: `${Math.min(100, (lecturer.currentGuidingCount / lecturer.guideQuota) * 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={`px-6 py-4 rounded-r-[24px] border-y-2 border-r-2 transition-all ${
                                                isSelected ? "border-[#F37021]" : "border-slate-300"
                                            }`}>
                                                <div className="flex justify-end">
                                                    {isSelected ? (
                                                        <div className="w-6 h-6 rounded-full bg-[#F37021] text-white flex items-center justify-center shadow-lg shadow-orange-200">
                                                            <Check size={14} strokeWidth={4} />
                                                        </div>
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full border-2 border-slate-100 group-hover:border-orange-200 transition-colors" />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
          </div>

          {/* SECTION 3: Summary (25%) */}
          <div className="xl:w-[25%] bg-[#F37021] p-12 text-white flex flex-col relative overflow-hidden">
            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/20">
                        <FileText size={24} />
                    </div>
                    <div>
                        <span className="font-black uppercase tracking-[0.2em] text-[11px] block font-jakarta">Tổng kết</span>
                        <span className="text-white/60 text-[10px] font-bold">Xem lại trước khi gửi</span>
                    </div>
                </div>

                <div className="space-y-10 flex-1">
                    <div className="p-8 bg-white/10 rounded-[40px] border border-white/20 backdrop-blur-sm shadow-2xl">
                        <label className="block text-[10px] font-black text-orange-100 uppercase mb-4 tracking-[0.2em] font-jakarta">Đợt bảo vệ dự kiến</label>
                        <div className="relative">
                            <div className="text-xl font-black text-white font-jakarta">
                                {defenseTerms.find(term => String(term.defenseTermId) === String(selectedDefenseTermId))?.defenseTermName || "--"}
                            </div>
                        </div>
                        <p className="text-[10px] text-orange-100/60 mt-3 font-bold italic tracking-tight">Hệ thống lọc theo khóa học của bạn</p>
                    </div>

                    <div className="space-y-8 px-4">
                        <div className="group">
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block mb-2 font-jakarta">Tên đề tài</span>
                            <p className="text-[15px] font-bold leading-relaxed text-white line-clamp-4 font-jakarta">
                                {(isEditing ? editFormData.title : formData.title) || "Chưa xác định"}
                            </p>
                        </div>
                        <div className="group">
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block mb-3 font-jakarta">Hướng dẫn</span>
                            {(() => {
                                const selectedLecturer = lecturers.find(l => l.lecturerProfileID === (isEditing ? editFormData.supervisorLecturerProfileID : formData.supervisorLecturerProfileID));
                                if (!selectedLecturer) return <p className="text-[15px] font-bold text-white font-jakarta">Chưa chọn</p>;
                                return (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-white/20 overflow-hidden border border-white/20 shadow-lg">
                                            {selectedLecturer.profileImage ? (
                                                <img 
                                                    src={getAvatarUrl(selectedLecturer.profileImage)} 
                                                    alt={selectedLecturer.fullName}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center font-black text-sm text-white/60 bg-white/10">
                                                    {selectedLecturer.fullName?.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-[15px] font-bold text-white truncate font-jakarta">{selectedLecturer.fullName}</p>
                                            <p className="text-[10px] text-white/50 font-bold uppercase tracking-tight">{selectedLecturer.degree}</p>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="group">
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block mb-2 font-jakarta">Quản lý</span>
                            <p className="text-[15px] font-bold text-white font-jakarta">{defaultDepartment?.name || "Khoa CNTT"}</p>
                        </div>
                    </div>
                </div>

                <div className="mt-16 space-y-5">
                    {error && (
                        <div className="p-4 bg-red-600/20 border border-red-500/30 rounded-2xl flex items-center gap-3">
                            <AlertCircle size={20} className="shrink-0 text-white" />
                            <span className="text-[11px] font-bold text-white leading-tight">{error}</span>
                        </div>
                    )}
                    
                    <button
                        type="submit"
                        disabled={submitting}
                        className={`w-full py-4 rounded-[20px] font-black transition-all duration-300 flex items-center justify-between px-8 shadow-lg relative overflow-hidden group ${
                            submitting
                                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                : "bg-[#002855] text-white hover:bg-[#003D82] hover:shadow-blue-200/40"
                        }`}
                    >
                        {submitting ? (
                            <div className="flex items-center gap-3 w-full justify-center">
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                <span className="text-[12px] uppercase tracking-widest opacity-70">Đang xử lý...</span>
                            </div>
                        ) : (
                            <>
                                <span className="text-[14px] uppercase tracking-wider relative z-10">
                                    {isEditing ? "Cập nhật đề tài" : "Đăng ký ngay"}
                                </span>
                                
                                <div className="relative z-10 w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-[#F37021] transition-all duration-300">
                                    <ChevronRight size={18} strokeWidth={3} />
                                </div>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-[100px] -mr-40 -mt-40" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/5 rounded-full blur-[80px] -ml-32 -mb-32" />
            <FileText size={400} className="absolute -right-24 -bottom-24 text-white/5 -rotate-12 pointer-events-none" />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="mt-12 flex items-center justify-between px-8 text-slate-400 text-sm font-medium">
             <p className="flex items-center gap-2">
                 <Info size={16} className="text-orange-500" />
                 Mọi thay đổi sẽ được lưu vết trong lịch sử hệ thống
             </p>
             <div className="flex items-center gap-6">
                {isEditing && (
                    <button 
                        type="button"
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 hover:text-slate-600 transition-colors"
                    >
                        <RotateCcw size={16} />
                        Hủy chỉnh sửa
                    </button>
                )}
                {existingTopic && (
                    <button
                        type="button"
                        onClick={handleRollback}
                        className="flex items-center gap-2 text-red-400 hover:text-red-600 transition-colors bg-red-50 px-4 py-2 rounded-2xl"
                    >
                        <RotateCcw size={16} />
                        Rollback dữ liệu test
                    </button>
                )}
             </div>
        </div>
      </div>

      {/* Catalog Topic Selector Modal */}
      <AnimatePresence>
        {isCatalogModalOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 sm:p-8">
            <motion.div
              onClick={() => setIsCatalogModalOpen(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div
              className="relative w-full max-w-6xl bg-white rounded-[56px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20 font-vietnam"
            >
              <div className="p-10 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-8 bg-white">
                <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-[#F37021] rounded-[22px] flex items-center justify-center text-white shadow-xl shadow-orange-200">
                        <BookOpen size={28} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Kho đề tài Niên luận / Đồ án</h2>
                        <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em] mt-1">Lựa chọn đề tài định hướng từ khoa</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center shadow-inner">
                        <button 
                            onClick={() => setCatalogViewMode("card")}
                            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-xs font-bold ${catalogViewMode === "card" ? "bg-white text-orange-500 shadow-md" : "text-slate-400 hover:text-slate-600"}`}
                        >
                            <Grid2X2 size={16} />
                            Lưới
                        </button>
                        <button 
                            onClick={() => setCatalogViewMode("table")}
                            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-xs font-bold ${catalogViewMode === "table" ? "bg-white text-orange-500 shadow-md" : "text-slate-400 hover:text-slate-600"}`}
                        >
                            <List size={16} />
                            Bảng
                        </button>
                    </div>
                    <button onClick={() => setIsCatalogModalOpen(false)} className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 transition-all border border-slate-200/50">
                      <X size={24} />
                    </button>
                </div>
              </div>
              <div className="px-10 py-6 bg-white/80 border-b border-slate-100 flex flex-col md:flex-row gap-6 items-center">
                <div className="relative flex-1 w-full group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="Tìm kiếm mã hoặc tên đề tài..." 
                        value={catalogSearchQuery}
                        onChange={(e) => setCatalogSearchQuery(e.target.value)}
                        className="w-full pl-14 pr-6 py-5 bg-slate-50/50 border-2 border-slate-100 rounded-3xl text-sm focus:outline-none focus:border-orange-500 focus:bg-white transition-all font-bold"
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <select 
                        value={catalogTagFilter || ""} 
                        onChange={(e) => setCatalogTagFilter(e.target.value || null)}
                        className="w-full md:w-64 px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl text-xs font-black uppercase tracking-widest focus:outline-none focus:border-orange-500 appearance-none cursor-pointer"
                    >
                        <option value="">Lọc theo lĩnh vực</option>
                        {tags.map(tag => (
                            <option key={tag.tagID} value={tag.tagCode}>{tag.tagName}</option>
                        ))}
                    </select>
                </div>
              </div>
              <div className="p-10 overflow-y-auto custom-scrollbar flex-1 bg-[#FDFCFB]">
                {catalogViewMode === "card" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredCatalogTopics
                      .map((topic) => (
                        <div
                          key={topic.catalogTopicID}
                          onClick={() => {
                            handleCatalogTopicChange(topic.catalogTopicID);
                            setIsCatalogModalOpen(false);
                          }}
                          className={`p-8 rounded-[48px] border-2 transition-all duration-300 cursor-pointer group relative overflow-hidden flex flex-col min-h-[280px] bg-white ${
                            (isEditing ? editFormData.catalogTopicID : formData.catalogTopicID) === topic.catalogTopicID
                              ? "border-orange-500 shadow-xl shadow-orange-100"
                              : "border-slate-50 hover:border-orange-200"
                          }`}
                        >
                          <div className="flex justify-between items-start mb-6">
                            <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest ${
                              (isEditing ? editFormData.catalogTopicID : formData.catalogTopicID) === topic.catalogTopicID ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-400"
                            }`}>
                              {topic.catalogTopicCode}
                            </span>
                            {(isEditing ? editFormData.catalogTopicID : formData.catalogTopicID) === topic.catalogTopicID && (
                              <div className="text-orange-500 bg-orange-50 p-1.5 rounded-full animate-bounce">
                                <Check size={18} />
                              </div>
                            )}
                          </div>
                          <h3 className="text-lg font-bold text-slate-800 mb-4 group-hover:text-orange-500 transition-colors line-clamp-2">{topic.title}</h3>
                          <p className="text-[12px] text-slate-400 mb-8 flex-1 line-clamp-3">{topic.summary}</p>
                          <div className="flex flex-wrap gap-2 mb-6">
                            {topic.tags?.slice(0, 3).map(tag => (
                                <span key={tag.tagID} className="text-[9px] font-bold bg-orange-50/50 text-orange-600 px-3 py-1 rounded-lg uppercase">
                                    {tag.tagName}
                                </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 border-t border-slate-50 pt-5 mt-auto">
                            <Building size={14} />
                            <span>{topic.departmentCode || "CNTT"}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="bg-white border border-slate-100 rounded-[48px] overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                <th className="px-8 py-6">Mã Đề tài</th>
                                <th className="px-8 py-6">Tên Đề tài</th>
                                <th className="px-8 py-6">Lĩnh vực</th>
                                <th className="px-8 py-6 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredCatalogTopics
                              .map((topic) => (
                                <tr key={topic.catalogTopicID} onClick={() => { handleCatalogTopicChange(topic.catalogTopicID); setIsCatalogModalOpen(false); }} className={`group cursor-pointer hover:bg-orange-50/10 ${ (isEditing ? editFormData.catalogTopicID : formData.catalogTopicID) === topic.catalogTopicID ? "bg-orange-50/20" : "" }`}>
                                    <td className="px-8 py-6"><span className="text-xs font-black text-orange-500">{topic.catalogTopicCode}</span></td>
                                    <td className="px-8 py-6"><p className="text-[14px] font-bold text-slate-700">{topic.title}</p></td>
                                    <td className="px-8 py-6">
                                        <div className="flex gap-1.5 flex-wrap">
                                            {topic.tags?.slice(0, 2).map(tag => ( <span key={tag.tagID} className="text-[10px] font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-lg">{tag.tagName}</span> ))}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <button className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${ (isEditing ? editFormData.catalogTopicID : formData.catalogTopicID) === topic.catalogTopicID ? "bg-orange-500 text-white shadow-lg shadow-orange-100" : "bg-slate-50 text-slate-400 group-hover:bg-orange-500 group-hover:text-white" }`}>
                                            { (isEditing ? editFormData.catalogTopicID : formData.catalogTopicID) === topic.catalogTopicID ? "Đã chọn" : "Lựa chọn" }
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="p-8 bg-white border-t border-slate-100 flex justify-between items-center px-12">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Hiển thị {catalogTopics.length} đề tài</p>
                <button className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center text-sm font-bold">1</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <TopicRenameRequestModalView
        isOpen={isTopicRenameModalOpen}
        onClose={() => setIsTopicRenameModalOpen(false)}
        currentTopic={existingTopic ? {
          topicID: (existingTopic as any).topicID,
          topicCode: (existingTopic as any).topicCode || null,
          title: (existingTopic as any).title || null,
          proposerUserCode: (existingTopic as any).proposerUserCode || null,
          supervisorUserCode: (existingTopic as any).supervisorUserCode || null,
        } : null}
      />

      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl flex items-center justify-center z-[4000] p-6">
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 50 }} className="bg-white rounded-[56px] p-12 max-w-xl w-full shadow-2xl text-center relative overflow-hidden border border-white/20 font-vietnam" >
              <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-orange-500 to-orange-300" />
              <div className="w-32 h-32 bg-orange-50 rounded-[40px] flex items-center justify-center mx-auto mb-10 text-orange-500 relative">
                <div className="absolute inset-0 bg-orange-200/30 rounded-[40px] animate-ping" />
                <CheckCircle size={64} className="relative z-10" />
              </div>
              <h2 className="text-4xl font-black text-slate-900 mb-6 tracking-tight">Đã gửi yêu cầu!</h2>
              <p className="text-slate-500 mb-12 leading-relaxed font-medium text-lg px-4">Tuyệt vời! Đề tài của bạn đã được chuyển đến bộ phận quản lý.</p>
              <button onClick={handleContinueAfterSuccess} className="w-full py-6 bg-slate-900 text-white rounded-[32px] font-black uppercase tracking-[0.2em] text-xs hover:bg-orange-500 transition-all shadow-2xl active:scale-[0.98]" > Trở về trang quản lý </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ChatbotPopup />
    </div>
  );
};


export default TopicRegistration;
