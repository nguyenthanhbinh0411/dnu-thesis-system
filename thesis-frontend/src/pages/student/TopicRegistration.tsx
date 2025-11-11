import React, { useState, useEffect, useCallback } from "react";
import /* useNavigate */ "react-router-dom";
import { fetchData } from "../../api/fetchData";
import { useAuth } from "../../hooks/useAuth";
import type { ApiResponse } from "../../types/api";
import type { CatalogTopic } from "../../types/catalog-topic";
import type { LecturerProfile } from "../../types/lecturer-profile";
import type { Department } from "../../types/department";
import type { StudentProfile } from "../../types/studentProfile";
import type { Topic, TopicFormData } from "../../types/topic";
import type {
  Tag,
  LecturerTag,
  CatalogTopicTag,
  TopicTag,
} from "../../types/tag";
import {
  BookOpen,
  FileText,
  User as PersonIcon,
  Building,
  GraduationCap,
  Users,
  CheckCircle,
  Edit,
} from "lucide-react";

const TopicRegistration: React.FC = () => {
  const auth = useAuth();
  // navigate removed; we now show a success modal instead of navigating
  const userCode = auth.user?.userCode;
  const [registrationType, setRegistrationType] = useState<"catalog" | "self">(
    "catalog"
  );
  const [catalogTopics, setCatalogTopics] = useState<CatalogTopic[]>([]);
  const [lecturers, setLecturers] = useState<LecturerProfile[]>([]);
  const [filteredLecturers, setFilteredLecturers] = useState<LecturerProfile[]>(
    []
  );
  const [defaultDepartment, setDefaultDepartment] = useState<Department | null>(
    null
  );
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagInfo, setSelectedTagInfo] = useState<Tag | null>(null);
  const [selectedTagIDs, setSelectedTagIDs] = useState<number[]>([]);
  // existing topicTag records for the topic when editing (used to compute adds/removes)
  const [existingTopicTagRecords, setExistingTopicTagRecords] = useState<
    TopicTag[]
  >([]);
  const [topicTags, setTopicTags] = useState<TopicTag[]>([]);
  const [topicTagNames, setTopicTagNames] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [existingTopic, setExistingTopic] = useState<Topic | null>(null);
  const [isEditing, setIsEditing] = useState(false);
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
      const [catalogRes, lecturerRes, departmentRes, tagRes] =
        await Promise.all([
          fetchData("/CatalogTopics/get-list?AssignedStatus=Ch%C6%B0a%20giao"),
          fetchData("/LecturerProfiles/get-list"),
          fetchData("/Departments/get-detail/DPT_CNTT"),
          fetchData("/Tags/list"),
        ]);

      setCatalogTopics((catalogRes as ApiResponse<CatalogTopic[]>)?.data || []);
      setLecturers((lecturerRes as ApiResponse<LecturerProfile[]>)?.data || []);

      const cnttDept = (departmentRes as ApiResponse<Department>)?.data;
      if (cnttDept) {
        setDefaultDepartment(cnttDept);
        // Set department in form data
        setFormData((prev) => ({
          ...prev,
          departmentID: cnttDept.departmentID,
        }));
        setEditFormData((prev) => ({
          ...prev,
          departmentID: cnttDept.departmentID,
        }));
      }

      setTags((tagRes as ApiResponse<Tag[]>)?.data || []);

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

      // Check if student already has a pending or approved topic
      if (userCode) {
        try {
          const topicsRes = await fetchData(
            `/Topics/get-list?ProposerUserCode=${userCode}`
          );
          const topics = (topicsRes as ApiResponse<Topic[]>)?.data || [];
          const existingTopic = topics.find(
            (topic) =>
              topic.status === "Đang chờ" ||
              topic.status === "Đã duyệt" ||
              topic.status === "Đã chấp nhận" ||
              topic.status === "Từ chối" ||
              topic.status === "Cần sửa đổi"
          );
          if (existingTopic) {
            setExistingTopic(existingTopic);
          } else {
            setExistingTopic(null);
          }
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
    // Close modal and refresh data and form
    setShowSuccessModal(false);
    setSuccess(null);
    // reload initial data (topics, lecturers, etc.)
    await loadInitialData();
    // reset form to initial state
    setFormData({
      topicCode: formData.topicCode,
      title: "",
      summary: "",
      type: "CATALOG",
      catalogTopicID: null,
      supervisorLecturerProfileID: null,
      departmentID: null,
      tagID: null,
    });
    setEditFormData({
      topicCode: "",
      title: "",
      summary: "",
      type: "CATALOG",
      catalogTopicID: null,
      supervisorLecturerProfileID: null,
      departmentID: null,
      tagID: null,
    });
    setRegistrationType("catalog");
    setSelectedTagInfo(null);
    setFilteredLecturers([]);
    setSelectedTagIDs([]);
    setIsEditing(false);
  };

  const handleEditTopic = async () => {
    if (!existingTopic) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch current topic data for editing
      const topicUpdateRes = await fetchData(
        `/Topics/get-update/${existingTopic.topicID}`
      );
      const topicData = (topicUpdateRes as ApiResponse)?.data as Record<
        string,
        unknown
      >;

      if (!topicData) {
        throw new Error("Không thể tải dữ liệu đề tài");
      }

      // Populate form with existing data
      setEditFormData({
        topicCode: topicData.topicCode as string,
        title: topicData.title as string,
        summary: topicData.summary as string,
        type: (topicData.type as string) === "CATALOG" ? "CATALOG" : "SELF",
        catalogTopicID: topicData.catalogTopicID as number | null,
        supervisorLecturerProfileID: topicData.supervisorLecturerProfileID as
          | number
          | null,
        departmentID: topicData.departmentID as number | null,
        tagID: topicData.tagID as number | null,
      });

      // Set registration type based on topic type
      setRegistrationType(topicData.type === "CATALOG" ? "catalog" : "self");

      // Load tag info based on topic type
      if (topicData.type === "CATALOG" && topicData.catalogTopicID) {
        // For catalog topics, load tag from catalog topic
        const selectedTopic = catalogTopics.find(
          (t) => t.catalogTopicID === topicData.catalogTopicID
        );
        if (selectedTopic) {
          try {
            const catalogTopicTagsRes = await fetchData(
              `/CatalogTopicTags/list?CatalogTopicCode=${selectedTopic.catalogTopicCode}`
            );
            const catalogTopicTags =
              (catalogTopicTagsRes as ApiResponse<CatalogTopicTag[]>)?.data ||
              [];

            if (catalogTopicTags.length > 0) {
              const tagCode = catalogTopicTags[0].tagCode;
              const tagRes = await fetchData(`/Tags/list?TagCode=${tagCode}`);
              const tagData = (tagRes as ApiResponse<Tag[]>)?.data || [];

              if (tagData.length > 0) {
                const tagInfo = tagData[0];
                setSelectedTagInfo(tagInfo);

                // Get lecturers for this tag
                const lecturerTagsRes = await fetchData(
                  `/LecturerTags/list?TagCode=${tagCode}`
                );
                const lecturerTags =
                  (lecturerTagsRes as ApiResponse<LecturerTag[]>)?.data || [];

                const tagLecturerCodes = lecturerTags.map(
                  (lt) => lt.lecturerCode
                );
                const availableLecturers = lecturers.filter((l) =>
                  tagLecturerCodes.includes(l.lecturerCode)
                );

                setFilteredLecturers(availableLecturers);
              }
            }
          } catch (error) {
            console.error("Error loading catalog topic tag:", error);
          }
        }
      } else if (topicData.type === "SELF" && topicData.tagID) {
        // For self-proposed topics, load tag from tagID
        try {
          const tagRes = await fetchData(`/Tags/list?TagID=${topicData.tagID}`);
          const tagData = (tagRes as ApiResponse<Tag[]>)?.data || [];

          if (tagData.length > 0) {
            const tagInfo = tagData[0];
            setSelectedTagInfo(tagInfo);

            // Get lecturers for this tag
            const lecturerTagsRes = await fetchData(
              `/LecturerTags/list?TagCode=${tagInfo.tagCode}`
            );
            const lecturerTags =
              (lecturerTagsRes as ApiResponse<LecturerTag[]>)?.data || [];

            const tagLecturerCodes = lecturerTags.map((lt) => lt.lecturerCode);
            const availableLecturers = lecturers.filter((l) =>
              tagLecturerCodes.includes(l.lecturerCode)
            );

            setFilteredLecturers(availableLecturers);
          }
        } catch (error) {
          console.error("Error loading tag info for edit:", error);
        }
      }

      // Load existing TopicTag records for this topic so we can allow editing multiple tags
      try {
        const topicTagsRes = await fetchData(
          `/TopicTags/by-topic/${existingTopic.topicCode}`
        );
        const existingTopicTags =
          (topicTagsRes as ApiResponse<TopicTag[]>)?.data || [];
        setExistingTopicTagRecords(existingTopicTags);

        // initialize selectedTagIDs from existingTopicTags
        const existingTagIDs = existingTopicTags.map((tt) => tt.tagID);
        setSelectedTagIDs(existingTagIDs);
      } catch (error) {
        // fallback to old list endpoint if by-topic not available
        console.warn(
          "/TopicTags/by-topic failed, falling back to /TopicTags/list",
          error
        );
        try {
          const topicTagsRes = await fetchData(
            `/TopicTags/list?TopicCode=${existingTopic.topicCode}`
          );
          const existingTopicTags =
            (topicTagsRes as ApiResponse<TopicTag[]>)?.data || [];
          setExistingTopicTagRecords(existingTopicTags);
          const existingTagIDs = existingTopicTags.map((tt) => tt.tagID);
          setSelectedTagIDs(existingTagIDs);
        } catch (error) {
          console.error("Error loading existing topic tags for edit:", error);
        }
      }

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
            selectedTagIDs.includes(t.tagID)
          );
          if (selectedTags.length === 0) return;

          // Build query parameters for multiple tags
          const tagCodes = selectedTags.map((t) => t.tagCode);
          const queryParams = tagCodes
            .map((code) => `TagCodes=${code}`)
            .join("&");

          // Get lecturers directly filtered by tags
          const lecturersRes = await fetchData(
            `/LecturerProfiles/get-list?${queryParams}`
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
            `/TopicTags/list?TopicCode=${existingTopic.topicCode}`
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
            fetchData(`/Tags/list?TagCode=${tagCode}`)
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

  // Handle catalog topic selection
  const handleCatalogTopicChange = async (catalogTopicID: number) => {
    const selectedTopic = catalogTopics.find(
      (t) => t.catalogTopicID === catalogTopicID
    );
    if (!selectedTopic) return;

    try {
      // Step 1: Get catalog topic tags
      const catalogTopicTagsRes = await fetchData(
        `/CatalogTopicTags/list?CatalogTopicCode=${selectedTopic.catalogTopicCode}`
      );
      const catalogTopicTags =
        (catalogTopicTagsRes as ApiResponse<CatalogTopicTag[]>)?.data || [];

      if (catalogTopicTags.length === 0) {
        setError("Đề tài này chưa có thông tin thẻ");
        return;
      }

      // Get the first tag (assuming one topic has one tag)
      const tagCode = catalogTopicTags[0].tagCode;

      // Step 2: Get tag details
      const tagRes = await fetchData(`/Tags/list?TagCode=${tagCode}`);
      const tagData = (tagRes as ApiResponse<Tag[]>)?.data || [];

      if (tagData.length === 0) {
        setError("Không tìm thấy thông tin thẻ");
        return;
      }

      const tagInfo = tagData[0];

      // Step 3: Get lecturers for this tag
      const lecturersRes = await fetchData(
        `/LecturerProfiles/get-list?TagCodes=${tagCode}`
      );
      const availableLecturers =
        (lecturersRes as ApiResponse<LecturerProfile[]>)?.data || [];

      // Update state
      setSelectedTagInfo(tagInfo);
      setFilteredLecturers(availableLecturers);

      // Update form data
      setFormData({
        ...formData,
        catalogTopicID,
        title: selectedTopic.title,
        summary: selectedTopic.summary,
        tagID: tagInfo.tagID,
        supervisorLecturerProfileID: null, // Reset lecturer selection
      });

      setError(null); // Clear any previous errors
    } catch (error) {
      setError("Có lỗi khi tải thông tin đề tài");
      console.error("Error loading topic details:", error);
    }
  };

  // Handle form submission - only for creating new topics
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate required fields
      if (registrationType === "self" && selectedTagIDs.length === 0) {
        setError("Vui lòng chọn ít nhất một Tag");
        return;
      }

      // Create new topic (existing logic)
      // First get the create template
      const createTemplate = await fetchData("/Topics/get-create");

      // Prepare the payload
      const templateData =
        ((createTemplate as ApiResponse)?.data as Record<string, unknown>) ||
        {};

      // Get additional data for payload
      const selectedLecturer = lecturers.find(
        (l) => l.lecturerProfileID === formData.supervisorLecturerProfileID
      );
      const selectedDepartment = defaultDepartment;
      const selectedTag = tags.find((t) => t.tagID === formData.tagID);
      const selectedCatalogTopic = catalogTopics.find(
        (c) => c.catalogTopicID === formData.catalogTopicID
      );

      // Backend will resolve supervisorUserID from supervisorUserCode
      const supervisorUserID = 0;

      // Get student profile for proposer
      let proposerStudentProfileID = 0;
      let proposerStudentCode = "";
      if (auth.user?.userCode) {
        try {
          const studentRes = await fetchData(
            `/StudentProfiles/get-list?UserCode=${auth.user.userCode}`
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

      const payload = {
        ...templateData,
        topicCode: templateData.topicCode || "",
        title: formData.title,
        summary: formData.summary,
        type: formData.type, // "CATALOG" for existing topics, "SELF" for self-proposed topics
        proposerUserID: auth.user?.userID || 0,
        proposerUserCode: auth.user?.userCode || "",
        proposerStudentProfileID: proposerStudentProfileID,
        proposerStudentCode: proposerStudentCode,
        supervisorUserID: supervisorUserID,
        supervisorUserCode: selectedLecturer?.userCode || "",
        supervisorLecturerProfileID: formData.supervisorLecturerProfileID || 0,
        supervisorLecturerCode: selectedLecturer?.lecturerCode || "",
        catalogTopicID: formData.catalogTopicID || 0,
        catalogTopicCode: selectedCatalogTopic?.catalogTopicCode || "",
        departmentID: formData.departmentID || 0,
        departmentCode: selectedDepartment?.departmentCode || "",
        status: "Đang chờ",
        resubmitCount: 0,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        tagID: formData.tagID || 0,
        tagCode: selectedTag?.tagCode || "",
      };

      await fetchData("/Topics/create", {
        method: "POST",
        body: payload,
      });

      // Create initial progress milestone after successful topic creation
      try {
        const milestoneTemplate = await fetchData(
          "/ProgressMilestones/get-create"
        );
        const milestoneData =
          ((milestoneTemplate as ApiResponse)?.data as Record<
            string,
            unknown
          >) || {};

        const milestonePayload = {
          ...milestoneData,
          topicCode: templateData.topicCode || "",
          topicID: null, // Will be set by backend
          state: "Đang tiến hành",
          startedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };

        await fetchData("/ProgressMilestones/create", {
          method: "POST",
          body: milestonePayload,
        });
        console.log("Progress milestone created successfully");
      } catch (milestoneErr) {
        console.error("Error creating progress milestone:", milestoneErr);
        // Don't fail the entire registration if milestone creation fails
      }

      // Create topic tag associations after successful topic creation
      try {
        const topicTagTemplate = await fetchData("/TopicTags/get-create");
        const topicTagData =
          ((topicTagTemplate as ApiResponse)?.data as Record<
            string,
            unknown
          >) || {};

        // Create topic tag for each selected tag
        const selectedTags = tags.filter((t) =>
          selectedTagIDs.includes(t.tagID)
        );
        for (const tag of selectedTags) {
          const topicTagPayload = {
            ...topicTagData,
            tagID: tag.tagID,
            tagCode: tag.tagCode,
            catalogTopicCode: selectedCatalogTopic?.catalogTopicCode || "",
            topicCode: templateData.topicCode || "",
          };

          await fetchData("/TopicTags/create", {
            method: "POST",
            body: topicTagPayload,
          });
        }
        console.log("Topic tag associations created successfully");
      } catch (topicTagErr) {
        console.error("Error creating topic tag associations:", topicTagErr);
        // Don't fail the entire registration if topic tag creation fails
      }

      setSuccess("Đăng ký đề tài thành công!");
      setShowSuccessModal(true);
    } catch (error) {
      setError("Có lỗi xảy ra khi xử lý đề tài");
      console.error("Error submitting topic:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit form submission - only calls Topics/update API
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (!existingTopic) {
        throw new Error("Không tìm thấy đề tài để cập nhật");
      }

      // Validate required fields
      if (selectedTagIDs.length === 0) {
        setError("Vui lòng chọn ít nhất một Tag");
        return;
      }

      // Get selected data for edit form
      const selectedLecturer = lecturers.find(
        (l) => l.lecturerProfileID === editFormData.supervisorLecturerProfileID
      );
      const selectedDepartment = defaultDepartment;
      const selectedTag = tags.find((t) => selectedTagIDs.includes(t.tagID));
      const selectedCatalogTopic = catalogTopics.find(
        (c) => c.catalogTopicID === editFormData.catalogTopicID
      );

      const updatePayload = {
        title: editFormData.title,
        summary: editFormData.summary,
        type: editFormData.type,
        proposerUserID: existingTopic.proposerUserID,
        proposerUserCode: existingTopic.proposerUserCode,
        proposerStudentProfileID: existingTopic.proposerStudentProfileID,
        proposerStudentCode: existingTopic.proposerStudentCode,
        supervisorUserID: 0,
        supervisorUserCode: selectedLecturer?.userCode || "",
        supervisorLecturerProfileID:
          editFormData.supervisorLecturerProfileID || 0,
        supervisorLecturerCode: selectedLecturer?.lecturerCode || "",
        catalogTopicID: editFormData.catalogTopicID || 0,
        catalogTopicCode: selectedCatalogTopic?.catalogTopicCode || "",
        departmentID: editFormData.departmentID || 0,
        departmentCode: selectedDepartment?.departmentCode || "",
        status: "Đang chờ",
        resubmitCount: existingTopic.resubmitCount || 0,
        createdAt: existingTopic.createdAt,
        lastUpdated: new Date().toISOString(),
        tagID: selectedTag?.tagID || 0,
        tagCode: selectedTag?.tagCode || "",
        lecturerComment: "",
      };

      // Only call Topics/update API when editing
      await fetchData(`/Topics/update/${existingTopic.topicID}`, {
        method: "PUT",
        body: updatePayload,
      });

      // Sync TopicTags: add new selected tags and remove unselected existing tags
      try {
        const topicCode = existingTopic.topicCode;

        // existingTopicTagRecords contains TopicTag objects with topicTagID and tagID
        const existingTagIDs = existingTopicTagRecords.map((t) => t.tagID);

        // Tags to add = selectedTagIDs - existingTagIDs
        const tagsToAdd = selectedTagIDs.filter(
          (id) => !existingTagIDs.includes(id)
        );

        // Tags to remove = existingTopicTagRecords whose tagID not in selectedTagIDs
        const tagsToRemove = existingTopicTagRecords.filter(
          (rec) => !selectedTagIDs.includes(rec.tagID)
        );

        // POST create for each tag to add
        if (tagsToAdd.length > 0) {
          const topicTagTemplateRes = await fetchData("/TopicTags/get-create");
          const topicTagTemplate =
            ((topicTagTemplateRes as ApiResponse)?.data as Record<
              string,
              unknown
            >) || {};

          for (const tagID of tagsToAdd) {
            const tagInfo = tags.find((t) => t.tagID === tagID);
            const payload = {
              ...topicTagTemplate,
              tagID: tagInfo?.tagID || tagID,
              tagCode: tagInfo?.tagCode || "",
              catalogTopicCode: updatePayload.catalogTopicCode || "",
              topicCode: topicCode || "",
            };

            await fetchData(`/TopicTags/create`, {
              method: "POST",
              body: payload,
            });
          }
        }

        // DELETE for each tag to remove (use topicTagID)
        for (const rec of tagsToRemove) {
          try {
            await fetchData(
              `/TopicTags/delete/${topicCode}/${rec.topicTagID}`,
              {
                method: "DELETE",
              }
            );
          } catch (delErr) {
            console.error("Error deleting topicTag", rec, delErr);
          }
        }
      } catch (syncErr) {
        console.error("Error syncing topic tags after update:", syncErr);
      }

      setSuccess("Cập nhật đề tài thành công!");
      setShowSuccessModal(true);
      setIsEditing(false);
      // Reload data to show updated topic
      await loadInitialData();
    } catch (error) {
      setError("Có lỗi xảy ra khi cập nhật đề tài");
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
          color: "#f37021",
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
                            prev.filter((id) => id !== tagID)
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
                      editFormData.supervisorLecturerProfileID
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
                  {existingTopic.status}
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
                      (l) => l.userCode === existingTopic.supervisorUserCode
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
                      (t) => t.tagID === existingTopic.tagID
                    )?.tagName;
                    if (byId) return byId;
                    const byCode = tags.find(
                      (t) => t.tagCode === existingTopic.tagCode
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
          </div>
        </div>
      </div>
    );
  }

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
          <BookOpen size={32} />
          Đăng ký đề tài
        </h1>
        <p
          style={{
            color: "#666",
            fontSize: "16px",
            margin: 0,
          }}
        >
          Chọn loại đăng ký và điền thông tin đề tài của bạn
        </p>
      </div>

      {/* Registration Type Selection */}
      <div
        style={{
          marginBottom: "32px",
          display: "flex",
          gap: "16px",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={() => handleRegistrationTypeChange("catalog")}
          style={{
            padding: "12px 24px",
            border: `2px solid ${
              registrationType === "catalog" ? "#f37021" : "#ddd"
            }`,
            borderRadius: "8px",
            backgroundColor:
              registrationType === "catalog" ? "#f37021" : "#fff",
            color: registrationType === "catalog" ? "#fff" : "#333",
            fontSize: "16px",
            fontWeight: "500",
            cursor: "pointer",
            transition: "all 0.3s ease",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FileText size={18} />
          Chọn đề tài có sẵn
        </button>
        <button
          type="button"
          onClick={() => handleRegistrationTypeChange("self")}
          style={{
            padding: "12px 24px",
            border: `2px solid ${
              registrationType === "self" ? "#f37021" : "#ddd"
            }`,
            borderRadius: "8px",
            backgroundColor: registrationType === "self" ? "#f37021" : "#fff",
            color: registrationType === "self" ? "#fff" : "#333",
            fontSize: "16px",
            fontWeight: "500",
            cursor: "pointer",
            transition: "all 0.3s ease",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <PersonIcon size={18} />
          Tự đề xuất đề tài
        </button>
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

      {/* Form */}
      <form
        onSubmit={isEditing ? handleEditSubmit : handleSubmit}
        style={{
          backgroundColor: "#fafafa",
          padding: "32px",
          borderRadius: "12px",
          border: "1px solid #eee",
        }}
      >
        {/* Catalog Topic Selection (Only for catalog type) */}
        {registrationType === "catalog" && (
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
              Chọn đề tài có sẵn
            </label>
            <select
              value={
                isEditing
                  ? editFormData.catalogTopicID || ""
                  : formData.catalogTopicID || ""
              }
              onChange={(e) => handleCatalogTopicChange(Number(e.target.value))}
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
              <option value="">-- Chọn đề tài --</option>
              {catalogTopics.map((topic) => (
                <option key={topic.catalogTopicID} value={topic.catalogTopicID}>
                  {topic.title}
                </option>
              ))}
            </select>
          </div>
        )}

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
            value={
              isEditing
                ? editFormData.topicCode || ""
                : formData.topicCode || ""
            }
            readOnly
            placeholder="Mã đề tài sẽ được tạo tự động"
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
            Tên đề tài *
          </label>
          <input
            type="text"
            value={isEditing ? editFormData.title : formData.title}
            onChange={(e) =>
              isEditing
                ? setEditFormData({ ...editFormData, title: e.target.value })
                : setFormData({ ...formData, title: e.target.value })
            }
            required
            disabled={
              registrationType === "catalog" && !formData.catalogTopicID
            }
            placeholder="Nhập tên đề tài"
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "2px solid #ddd",
              borderRadius: "8px",
              fontSize: "16px",
              backgroundColor:
                registrationType === "catalog" && !formData.catalogTopicID
                  ? "#f5f5f5"
                  : "#fff",
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
            Tóm tắt đề tài *
          </label>
          <textarea
            value={isEditing ? editFormData.summary : formData.summary}
            onChange={(e) =>
              isEditing
                ? setEditFormData({ ...editFormData, summary: e.target.value })
                : setFormData({ ...formData, summary: e.target.value })
            }
            required
            disabled={
              registrationType === "catalog" && !formData.catalogTopicID
            }
            placeholder="Mô tả chi tiết về đề tài"
            rows={4}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "2px solid #ddd",
              borderRadius: "8px",
              fontSize: "16px",
              backgroundColor:
                registrationType === "catalog" && !formData.catalogTopicID
                  ? "#f5f5f5"
                  : "#fff",
              transition: "border-color 0.3s ease",
              resize: "vertical",
              fontFamily: "inherit",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#f37021")}
            onBlur={(e) => (e.target.style.borderColor = "#ddd")}
          />
        </div>

        {/* Specialty */}
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
          {registrationType === "catalog" && selectedTagInfo ? (
            <div
              style={{
                padding: "12px 16px",
                border: "2px solid #f37021",
                borderRadius: "8px",
                backgroundColor: "#fff8f3",
                fontSize: "16px",
              }}
            >
              <div
                style={{
                  fontWeight: "600",
                  color: "#f37021",
                  marginBottom: "4px",
                }}
              >
                {selectedTagInfo.tagName}
              </div>
              <div style={{ color: "#666", fontSize: "14px" }}>
                {selectedTagInfo.description}
              </div>
            </div>
          ) : (
            <div
              style={{
                border: "2px solid #ddd",
                borderRadius: "8px",
                padding: "16px",
                backgroundColor:
                  registrationType === "catalog" ? "#f5f5f5" : "#fff",
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
                      cursor:
                        registrationType === "catalog"
                          ? "not-allowed"
                          : "pointer",
                      opacity: registrationType === "catalog" ? 0.6 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTagIDs.includes(tag.tagID)}
                      onChange={(e) => {
                        if (registrationType === "catalog") return;

                        const tagID = tag.tagID;
                        if (e.target.checked) {
                          setSelectedTagIDs((prev) => [...prev, tagID]);
                        } else {
                          setSelectedTagIDs((prev) =>
                            prev.filter((id) => id !== tagID)
                          );
                        }
                      }}
                      disabled={registrationType === "catalog"}
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
              {selectedTagIDs.length === 0 && registrationType === "self" && (
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
          )}
        </div>

        {/* Supervisor */}
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
            <Users
              size={16}
              style={{ marginRight: "8px", verticalAlign: "middle" }}
            />
            Giảng viên hướng dẫn *
          </label>
          <select
            value={
              isEditing
                ? editFormData.supervisorLecturerProfileID || ""
                : formData.supervisorLecturerProfileID || ""
            }
            onChange={(e) =>
              isEditing
                ? setEditFormData({
                    ...editFormData,
                    supervisorLecturerProfileID: Number(e.target.value),
                  })
                : setFormData({
                    ...formData,
                    supervisorLecturerProfileID: Number(e.target.value),
                  })
            }
            required
            disabled={
              registrationType === "self" && selectedTagIDs.length === 0
            }
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "2px solid #ddd",
              borderRadius: "8px",
              fontSize: "16px",
              backgroundColor:
                registrationType === "self" && selectedTagIDs.length === 0
                  ? "#f5f5f5"
                  : "#fff",
              transition: "border-color 0.3s ease",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#f37021")}
            onBlur={(e) => (e.target.style.borderColor = "#ddd")}
          >
            <option value="">
              {registrationType === "catalog"
                ? "-- Chọn đề tài để xem giảng viên --"
                : selectedTagIDs.length > 0
                ? "-- Chọn giảng viên hướng dẫn --"
                : "-- Chọn thẻ trước để lọc giảng viên --"}
            </option>
            {(registrationType === "catalog" ||
            (registrationType === "self" && filteredLecturers.length > 0)
              ? filteredLecturers
              : lecturers
            ).map((lecturer) => (
              <option
                key={lecturer.lecturerProfileID}
                value={lecturer.lecturerProfileID}
              >
                {lecturer.fullName || lecturer.lecturerCode} - {lecturer.degree}{" "}
                ({lecturer.currentGuidingCount}/{lecturer.guideQuota})
              </option>
            ))}
          </select>

          {/* Quota Info for Main Form */}
          {formData.supervisorLecturerProfileID && (
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
                const displayLecturers =
                  registrationType === "catalog" ||
                  (registrationType === "self" && filteredLecturers.length > 0)
                    ? filteredLecturers
                    : lecturers;
                const lecturer = displayLecturers.find(
                  (l) =>
                    l.lecturerProfileID === formData.supervisorLecturerProfileID
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
                    {available > 0 ? ` (Còn ${available} slot)` : " (Hạn chế)"}
                  </>
                );
              })()}
            </div>
          )}
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
            Khoa *
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

        {/* Submit Button */}
        <div style={{ textAlign: "center" }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "16px 40px",
              backgroundColor: submitting ? "#ccc" : "#f37021",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "18px",
              fontWeight: "600",
              cursor: submitting ? "not-allowed" : "pointer",
              transition: "background-color 0.3s ease",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              margin: "0 auto",
            }}
          >
            {submitting ? (
              <>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    border: "2px solid #fff",
                    borderTop: "2px solid transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                ></div>
                Đang xử lý...
              </>
            ) : (
              <>
                <BookOpen size={20} />
                {isEditing ? "Cập nhật đề tài" : "Đăng ký đề tài"}
              </>
            )}
          </button>
        </div>
      </form>

      {/* Success Modal */}
      {showSuccessModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            animation: "modalFadeIn 0.3s ease-out",
          }}
        >
          <style>
            {`
              @keyframes modalFadeIn {
                from {
                  opacity: 0;
                  transform: scale(0.8);
                }
                to {
                  opacity: 1;
                  transform: scale(1);
                }
              }
            `}
          </style>
          <div
            style={{
              width: 520,
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
              textAlign: "center",
              animation: "modalContentSlideIn 0.4s ease-out",
            }}
          >
            <style>
              {`
                @keyframes modalContentSlideIn {
                  from {
                    opacity: 0;
                    transform: translateY(-20px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
                @keyframes iconBounce {
                  0% {
                    transform: scale(0.3);
                    opacity: 0;
                  }
                  50% {
                    transform: scale(1.05);
                  }
                  70% {
                    transform: scale(0.9);
                  }
                  100% {
                    transform: scale(1);
                    opacity: 1;
                  }
                }
                @keyframes iconGlow {
                  from {
                    filter: drop-shadow(0 0 0 rgba(76, 175, 80, 0));
                  }
                  to {
                    filter: drop-shadow(0 0 10px rgba(76, 175, 80, 0.5));
                  }
                }
                @keyframes textFadeIn {
                  from {
                    opacity: 0;
                    transform: translateY(10px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
                @keyframes titleGradient {
                  0% {
                    background-position: 0% 50%;
                  }
                  50% { 
                    background-position: 100% 50%;
                  }
                  100% {
                    background-position: 0% 50%;
                  }
                }
              `}
            </style>
            <div
              style={{
                marginBottom: 16,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                animation:
                  "iconBounce 0.6s ease-out, iconGlow 2s ease-in-out infinite alternate",
              }}
            >
              <CheckCircle size={64} color="#4caf50" />
            </div>
            <h2
              style={{
                margin: "0 0 12px 0",
                background: "linear-gradient(45deg, #4caf50, #66bb6a)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontSize: "24px",
                fontWeight: "bold",
                textShadow: "0 2px 4px rgba(0,0,0,0.1)",
                animation:
                  "textFadeIn 0.5s ease-out 0.2s both, titleGradient 3s ease-in-out infinite",
              }}
            >
              Đăng ký thành công!
            </h2>
            <p
              style={{
                color: "#475569",
                marginTop: 0,
                lineHeight: 1.5,
                animation: "textFadeIn 0.5s ease-out 0.4s both",
              }}
            >
              Đề tài của bạn đã được gửi thành công! Bạn sẽ nhận được thông báo
              qua email khi đề tài được duyệt hoặc có cập nhật.
            </p>
            <div
              style={{
                marginTop: 24,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <button
                onClick={handleContinueAfterSuccess}
                style={{
                  padding: "12px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: "#f37021",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: "600",
                  transition: "background-color 0.3s ease",
                }}
                onMouseOver={(e) =>
                  ((e.target as HTMLElement).style.backgroundColor = "#e55a1b")
                }
                onMouseOut={(e) =>
                  ((e.target as HTMLElement).style.backgroundColor = "#f37021")
                }
              >
                Tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopicRegistration;
