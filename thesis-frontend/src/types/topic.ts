export interface Topic {
  topicID: number;
  topicCode: string;
  title: string;
  summary: string;
  type: string;
  defenseTermId?: string | number | null;
  proposerUserID: number;
  proposerUserCode: string;
  proposerStudentProfileID: number;
  proposerStudentCode: string;
  supervisorUserID: number | null;
  supervisorUserCode: string | null;
  supervisorLecturerProfileID: number | null;
  supervisorLecturerCode: string | null;
  catalogTopicID: number | null;
  catalogTopicCode: string | null;
  departmentID: number | null;
  departmentCode: string | null;
  status: string;
  resubmitCount: number | null;
  createdAt: string;
  lastUpdated: string;
  tagID: number | null;
  tagCode: string | null;
  lecturerComment?: string;
  score?: number | null;
}

export interface ApiResponseTopics {
  data: Topic[];
}

export interface TopicFormData {
  topicCode?: string; // Auto generated from API template
  title: string;
  summary: string;
  type: "CATALOG" | "SELF";
  catalogTopicID: number | null;
  supervisorLecturerProfileID: number | null;
  departmentID: number | null;
  tagID: number | null;
  status?: string; // Auto set to "Đang chờ"
}
