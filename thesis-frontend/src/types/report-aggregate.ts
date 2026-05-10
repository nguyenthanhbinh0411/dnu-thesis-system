import type { SubmissionFile } from "./submissionFile";

export interface ReportAggregateTag {
  tagCode: string;
  tagName: string;
}

export interface StudentReportAggregateTopic {
  topicID: number;
  topicCode: string;
  title: string;
  summary: string;
  type: string;
  status: string;
  catalogTopicCode: string | null;
  supervisorLecturerCode: string | null;
  createdAt: string;
  lastUpdated: string;
  score?: number | null;
}

export interface StudentReportAggregateMilestone {
  milestoneID: number;
  milestoneCode: string;
  topicCode: string;
  milestoneTemplateCode: string;
  ordinal: number;
  deadline: string;
  state: string;
  startedAt: string | null;
  completedAt1: string | null;
  completedAt2: string | null;
  completedAt3: string | null;
  completedAt4: string | null;
  completedAt5: string | null;
}

export interface StudentReportAggregateSupervisor {
  lecturerProfileID: number;
  lecturerCode: string;
  fullName: string;
  degree: string;
  email: string;
  phoneNumber: string;
  departmentCode: string;
}

export interface StudentDashboardPayload {
  topic: StudentReportAggregateTopic | null;
  topicTags: ReportAggregateTag[];
  currentMilestone: StudentReportAggregateMilestone | null;
  supervisor: StudentReportAggregateSupervisor | null;
  supervisorTags: ReportAggregateTag[];
  canSubmit: boolean;
  blockReason: string | null;
}

export interface StudentProgressHistorySubmission {
  submissionID: number;
  submissionCode: string;
  milestoneID: number;
  milestoneCode: string;
  ordinal: number | null;
  studentUserCode: string;
  studentProfileCode: string | null;
  lecturerCode: string | null;
  submittedAt: string;
  attemptNumber: number;
  lecturerComment: string | null;
  lecturerState: string | null;
  feedbackLevel: string | null;
  reportTitle: string;
  reportDescription: string;
  lastUpdated: string;
  files: SubmissionFile[];
}

export interface StudentProgressHistoryItem {
  submission: StudentProgressHistorySubmission;
}

export interface StudentProgressHistoryPayload {
  items: StudentProgressHistoryItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface StudentProgressSubmitPayload {
  submission: StudentProgressHistorySubmission;
  message: string;
}

export interface LecturerSubmissionAggregateItem {
  submission: StudentProgressHistorySubmission;
  student: {
    studentProfileID: number;
    studentCode: string;
    userCode: string;
    fullName: string;
    studentEmail: string;
    phoneNumber: string;
    departmentCode: string;
    classCode: string;
  } | null;
  topic: StudentReportAggregateTopic | null;
  supervisor: StudentReportAggregateSupervisor | null;
}

export interface LecturerSubmissionAggregatePayload {
  items: LecturerSubmissionAggregateItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}
