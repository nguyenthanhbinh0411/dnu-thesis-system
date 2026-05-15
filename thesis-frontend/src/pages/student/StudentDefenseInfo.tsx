import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "../../context/useToast";
import { fetchData } from "../../api/fetchData";
import type { ApiResponse } from "../../types/api";
import {
  pickCaseInsensitiveValue,
  readEnvelopeAllowedActions,
  readEnvelopeData,
  readEnvelopeErrorMessages,
  readEnvelopeMessage,
  readEnvelopeSuccess,
  readEnvelopeWarningMessages,
} from "../../utils/api-envelope";
import {
  getActiveDefensePeriodId,
  normalizeDefensePeriodId,
  setActiveDefensePeriodId,
} from "../../utils/defensePeriod";
import {
  AlertCircle,
  Bell,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Flame,
  GraduationCap,
  Hash,
  MapPin,
  MessageCircle,
  Upload,
  User,
  Users,
} from "lucide-react";

type SessionCode = "MORNING" | "AFTERNOON";
type StudentPanel = "overview" | "revision";
type RevisionStatusCode = 1 | 2 | 3;

type DefenseInfoView = {
  studentCode: string;
  studentName: string;
  topicCode: string;
  topicTitle: string;
  committeeCode: string | null;
  room: string | null;
  scheduledAt: string | null;
  session: number | null;
  sessionCode: SessionCode | null;
  finalScore: number | null;
  grade: string | null;
  councilListLocked: boolean;
  councilLockStatus: "LOCKED" | "UNLOCKED";
  
  // Enriched details
  scoreGvhd: number | null;
  scoreCt: number | null;
  scoreUvtk: number | null;
  scoreUvpb: number | null;
  isScoreLocked: boolean;
  revision: StudentRevisionInfoDto | null;
};

type StudentRevisionInfoDto = {
  revisionId: number;
  assignmentId: number;
  needsRevision: boolean;
  revisionReason: string | null;
  requiredContent: string | null;
  deadline: string | null;
  status: string | null;
};

type StudentNotification = {
  type: string;
  message: string;
  timestamp: string;
};

type RevisionHistoryView = {
  id: number;
  assignmentId: number | null;
  revisionFileUrl: string | null;
  finalStatus: RevisionStatusCode;
  statusText: string;
  hasSubmittedFile: boolean;
  isCtApproved: boolean;
  isUvtkApproved: boolean;
  isGvhdApproved: boolean;
  createdAt: string;
  lastUpdated: string;
};

type CurrentDefensePeriodView = {
  periodId: number;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

const DEFAULT_DEFENSE_INFO: DefenseInfoView = {
  studentCode: "",
  studentName: "",
  topicCode: "",
  topicTitle: "",
  committeeCode: null,
  room: null,
  scheduledAt: null,
  session: null,
  sessionCode: null,
  finalScore: null,
  grade: null,
  councilListLocked: false,
  councilLockStatus: "UNLOCKED",
  scoreGvhd: null,
  scoreCt: null,
  scoreUvtk: null,
  scoreUvpb: null,
  isScoreLocked: false,
  revision: null,
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toRecordArray = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => toRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
};

const toStringOrNull = (value: unknown): string | null => {
  const text = String(value ?? "").trim();
  return text ? text : null;
};

const toDisplayText = (value: unknown, fallback = ""): string => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const readBooleanLike = (value: unknown, fallback = false): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
};

const readNumberLike = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseRevisionStatusCode = (value: unknown): RevisionStatusCode => {
  const num = readNumberLike(value);
  if (num === 2) return 2;
  if (num === 3) return 3;

  const text = String(value ?? "").trim().toUpperCase();
  if (text.includes("APPROVED") || text.includes("DUYET")) return 2;
  if (text.includes("REJECT") || text.includes("TU_CHOI") || text.includes("TỪ CHỐI")) return 3;
  return 1;
};

const toIsoDateOrNull = (value: unknown): string | null => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const formatRevisionStatus = (status: RevisionStatusCode) => {
  switch (status) {
    case 2:
      return { label: "Đã duyệt", className: "bg-emerald-50 text-emerald-600 border-emerald-100" };
    case 3:
      return { label: "Từ chối", className: "bg-red-50 text-red-600 border-red-100" };
    default:
      return { label: "Chờ duyệt", className: "bg-amber-50 text-amber-600 border-amber-100" };
  }
};

const formatNotificationType = (type: string): string => {
  const normalized = String(type ?? "").trim().toUpperCase();
  if (normalized.includes("ERROR") || normalized.includes("FAIL")) return "Lỗi";
  if (normalized.includes("WARN")) return "Cảnh báo";
  if (normalized.includes("SUCCESS") || normalized.includes("OK")) return "Thành công";
  return "Thông báo";
};

const formatDateTime = (value: string | null, includeTime = true): string => {
  if (!value) return "Chờ thông báo";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const dateText = parsed.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  if (!includeTime) return dateText;
  const timeText = parsed.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return timeText === "00:00" ? dateText : `${timeText}, ${dateText}`;
};

const formatCountdown = (value: string | null | undefined): string => {
  if (!value) return "Chưa có hạn";
  const target = new Date(value);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - now.getTime()) / 86400000);
  if (diff > 0) return `Còn ${diff} ngày`;
  if (diff === 0) return "Hết hạn hôm nay";
  return `Quá hạn ${Math.abs(diff)} ngày`;
};

const StudentDefenseInfo: React.FC = () => {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [periodId, setPeriodId] = useState<number | null>(() => getActiveDefensePeriodId());
  const [activePanel, setActivePanel] = useState<StudentPanel>("overview");
  const [defenseInfo, setDefenseInfo] = useState<DefenseInfoView>(DEFAULT_DEFENSE_INFO);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [revisionHistory, setRevisionHistory] = useState<RevisionHistoryView[]>([]);
  const [backendAllowedActions, setBackendAllowedActions] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [revisedContent, setRevisedContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchSnapshot = useCallback(async () => {
    setLoadingData(true);
    try {
      const url = periodId 
        ? `/defense-periods/${periodId}/student/snapshot` 
        : `/student-defense/current/snapshot`;
      const response = await fetchData<ApiResponse<any>>(url);
      if (readEnvelopeSuccess(response)) {
        const fullData = readEnvelopeData<any>(response);
        // The current/snapshot returns { period, snapshot: { defenseInfo, ... } }
        // The {periodId}/student/snapshot returns { defenseInfo, notifications, ... }
        const data = fullData?.snapshot || fullData;
        const source = data?.defenseInfo || data?.studentDefenseInfo || data;
        
        const mappedInfo: DefenseInfoView = {
          studentCode: toDisplayText(pickCaseInsensitiveValue(source, ["studentCode", "StudentCode"], "")),
          studentName: toDisplayText(
            pickCaseInsensitiveValue(
              source,
              [
                "studentName",
                "StudentName",
                "studentFullName",
                "StudentFullName",
                "proposerStudentName",
                "ProposerStudentName",
                "fullName",
                "FullName",
              ],
              "",
            ),
          ),
          topicCode: toDisplayText(pickCaseInsensitiveValue(source, ["topicCode", "TopicCode"], "")),
          topicTitle: toDisplayText(pickCaseInsensitiveValue(source, ["topicTitle", "TopicTitle"], "")),
          committeeCode: toStringOrNull(pickCaseInsensitiveValue(source, ["committeeCode", "CommitteeCode"], null)),
          room: toStringOrNull(pickCaseInsensitiveValue(source, ["room", "Room"], null)),
          scheduledAt: toIsoDateOrNull(pickCaseInsensitiveValue(source, ["scheduledAt", "ScheduledAt"], null)),
          session: readNumberLike(pickCaseInsensitiveValue(source, ["session", "Session"], null)),
          sessionCode: pickCaseInsensitiveValue(source, ["sessionCode", "SessionCode"], null) as SessionCode | null,
          finalScore: readNumberLike(pickCaseInsensitiveValue(source, ["finalScore", "FinalScore"], null)),
          grade: toStringOrNull(pickCaseInsensitiveValue(source, ["grade", "Grade"], null)),
          councilListLocked: readBooleanLike(pickCaseInsensitiveValue(source, ["councilListLocked", "CouncilListLocked"], false)),
          councilLockStatus: (pickCaseInsensitiveValue(source, ["councilLockStatus", "CouncilLockStatus"], "UNLOCKED") as string).toUpperCase() as "LOCKED" | "UNLOCKED",
          scoreGvhd: readNumberLike(pickCaseInsensitiveValue(source, ["scoreGvhd", "ScoreGvhd"], null)),
          scoreCt: readNumberLike(pickCaseInsensitiveValue(source, ["scoreCt", "ScoreCt"], null)),
          scoreUvtk: readNumberLike(pickCaseInsensitiveValue(source, ["scoreUvtk", "ScoreUvtk", "scoreTk", "ScoreTk"], null)),
          scoreUvpb: readNumberLike(pickCaseInsensitiveValue(source, ["scoreUvpb", "ScoreUvpb", "scorePb", "ScorePb"], null)),
          isScoreLocked: readBooleanLike(pickCaseInsensitiveValue(source, ["isScoreLocked", "IsScoreLocked"], false)),
          revision: null
        };

        const revisionRecord = toRecord(pickCaseInsensitiveValue(source, ["revision", "Revision"], null));
        if (revisionRecord) {
          mappedInfo.revision = {
            revisionId: readNumberLike(pickCaseInsensitiveValue(revisionRecord, ["revisionId", "RevisionId"], 0)) || 0,
            assignmentId: readNumberLike(pickCaseInsensitiveValue(revisionRecord, ["assignmentId", "AssignmentId"], 0)) || 0,
            needsRevision: readBooleanLike(pickCaseInsensitiveValue(revisionRecord, ["needsRevision", "NeedsRevision"], true)),
            revisionReason: toStringOrNull(pickCaseInsensitiveValue(revisionRecord, ["revisionReason", "RevisionReason"], null)),
            requiredContent: toStringOrNull(pickCaseInsensitiveValue(revisionRecord, ["requiredContent", "RequiredContent"], null)),
            deadline: toIsoDateOrNull(pickCaseInsensitiveValue(revisionRecord, ["deadline", "Deadline"], null)),
            status: toStringOrNull(pickCaseInsensitiveValue(revisionRecord, ["status", "Status"], null)),
          };
          if (mappedInfo.revision.needsRevision && activePanel === "overview") {
            setActivePanel("revision");
          }
        }

        setDefenseInfo(mappedInfo);
        setNotifications(toRecordArray(pickCaseInsensitiveValue(data, ["notifications", "Notifications"], [])) as any);

        const mappedHistory = toRecordArray(
          pickCaseInsensitiveValue(data, ["revisionHistory", "RevisionHistory"], []),
        )
          .map((item) => {
            const revisionFileUrl = toStringOrNull(
              pickCaseInsensitiveValue(item, ["revisionFileUrl", "RevisionFileUrl", "fileUrl", "FileUrl"], null),
            );
            const statusText = String(
              pickCaseInsensitiveValue(item, ["status", "Status", "finalStatusText", "FinalStatusText"], ""),
            )
              .trim()
              .toUpperCase();
            const hasSubmittedFile = Boolean(revisionFileUrl);

            return {
              id: readNumberLike(pickCaseInsensitiveValue(item, ["id", "Id", "revisionId", "RevisionId"], 0)) || 0,
              assignmentId: readNumberLike(pickCaseInsensitiveValue(item, ["assignmentId", "AssignmentId"], null)),
              revisionFileUrl,
              finalStatus: parseRevisionStatusCode(
                pickCaseInsensitiveValue(item, ["finalStatus", "FinalStatus", "status", "Status"], 1),
              ),
              statusText,
              hasSubmittedFile,
              isCtApproved: readBooleanLike(pickCaseInsensitiveValue(item, ["isCtApproved", "IsCtApproved"], false)),
              isUvtkApproved: readBooleanLike(pickCaseInsensitiveValue(item, ["isUvtkApproved", "IsUvtkApproved"], false)),
              isGvhdApproved: readBooleanLike(pickCaseInsensitiveValue(item, ["isGvhdApproved", "IsGvhdApproved"], false)),
              createdAt: toDisplayText(
                pickCaseInsensitiveValue(item, ["createdAt", "CreatedAt", "submittedAt", "SubmittedAt"], ""),
                "",
              ),
              lastUpdated: toDisplayText(
                pickCaseInsensitiveValue(item, ["lastUpdated", "LastUpdated", "updatedAt", "UpdatedAt"], ""),
                "",
              ),
            };
          })
          .filter((item) => item.id > 0)
          .filter((item) => item.hasSubmittedFile)
          .sort((a, b) => {
            const left = new Date(a.lastUpdated || a.createdAt || 0).getTime();
            const right = new Date(b.lastUpdated || b.createdAt || 0).getTime();
            return right - left;
          });

        setRevisionHistory(mappedHistory);
        setBackendAllowedActions(readEnvelopeAllowedActions(response) as string[]);
      }
    } catch (err) {
      addToast("Không thể tải thông tin bảo vệ", "error");
    } finally {
      setLoadingData(false);
    }
  }, [periodId, addToast, activePanel]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  const submitRevision = async () => {
    if (showSubmittedWaitingCard) {
      addToast("Bạn đã nộp bản chỉnh sửa và đang chờ thư ký kiểm tra. Tạm thời chưa thể nộp lại.", "warning");
      return;
    }
    if (!selectedFile || !defenseInfo.revision?.assignmentId) return;
    setSubmittingRevision(true);
    try {
      const formData = new FormData();
      formData.append("AssignmentId", String(defenseInfo.revision.assignmentId));
      formData.append("RevisedContent", revisedContent);
      formData.append("File", selectedFile); // Backend expects "File" in StudentRevisionSubmissionDto
      
      const targetPeriodId = periodId || 0; // The endpoint expects periodId in path
      const url = `/defense-periods/${targetPeriodId}/student/revisions`;
      
      const response = await fetchData<ApiResponse<any>>(url, {
        method: "POST",
        body: formData,
      });

      if (readEnvelopeSuccess(response)) {
        addToast("Nộp bản chỉnh sửa thành công", "success");
        setSelectedFile(null);
        setSelectedFileName("");
        setRevisedContent("");
        fetchSnapshot();
      } else {
        addToast(readEnvelopeMessage(response) || "Có lỗi xảy ra", "error");
      }
    } catch (err) {
      addToast("Lỗi kết nối máy chủ", "error");
    } finally {
      setSubmittingRevision(false);
    }
  };

  const latestSubmittedRevision = useMemo(() => revisionHistory[0] ?? null, [revisionHistory]);
  const showSubmittedWaitingCard = Boolean(latestSubmittedRevision && latestSubmittedRevision.finalStatus === 1);
  const isSubmissionLocked = showSubmittedWaitingCard;

  return (
    <div className="stu-dashboard-container">
      <style>
        {`
          .stu-dashboard-container { min-height: 100vh; background-color: #F8FAFC; padding: 32px; display: flex; flex-direction: column; gap: 32px; width: 100%; }
          .stu-section-title { font-size: 24px; font-weight: 900; color: #0f172a; display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
          .stu-section-desc { font-size: 14px; font-weight: 600; color: #64748b; margin-bottom: 24px; }
          .stu-grid-header { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; width: 100%; }
          .stu-quick-card { background: white; padding: 24px; border-radius: 24px; border: 1px solid #f1f5f9; display: flex; align-items: center; gap: 20px; transition: all 0.3s ease; }
          .stu-quick-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px -8px rgba(0,0,0,0.05); }
          .stu-icon-box { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; }
          .stu-card-info h4 { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 4px; }
          .stu-card-info p { font-size: 18px; font-weight: 900; color: #1e293b; }
          .stu-main-workspace { display: grid; grid-template-columns: 1fr 400px; gap: 32px; width: 100%; }
          .stu-content-card { background: white; border-radius: 32px; border: 1px solid #f1f5f9; overflow: hidden; display: flex; flex-direction: column; }
          .stu-card-header { padding: 32px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
          .stu-tabs { display: flex; gap: 8px; background: #f8fafc; padding: 6px; border-radius: 16px; }
          .stu-tab { padding: 10px 20px; border-radius: 12px; font-size: 13px; font-weight: 800; color: #64748b; transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
          .stu-tab.active { background: white; color: #F37021; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .stu-card-body { padding: 32px; flex: 1; }
          .stu-info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
          .stu-info-item { padding: 24px; background: #f8fafc; border-radius: 20px; border: 1px solid #f1f5f9; }
          .stu-info-item label { font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 8px; }
          .stu-info-item .value { font-size: 16px; font-weight: 800; color: #1e293b; }
          .stu-sidebar-card { background: white; border-radius: 32px; border: 1px solid #f1f5f9; padding: 32px; display: flex; flex-direction: column; gap: 24px; }
          .stu-reminder-item { display: flex; gap: 16px; padding: 16px; background: #f8fafc; border-radius: 16px; border: 1px solid #f1f5f9; }
          .stu-reminder-icon { width: 40px; height: 40px; border-radius: 12px; background: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #F37021; }
          .stu-reminder-content h5 { font-size: 13px; font-weight: 900; color: #1e293b; margin-bottom: 4px; }
          .stu-reminder-content p { font-size: 12px; font-weight: 600; color: #64748b; line-height: 1.5; }
          .stu-revision-form { display: flex; flex-direction: column; gap: 20px; }
          .stu-textarea { width: 100%; padding: 16px; border-radius: 16px; border: 2px solid #f1f5f9; background: #f8fafc; font-size: 14px; font-weight: 600; resize: none; min-height: 120px; transition: all 0.2s; }
          .stu-textarea:focus { outline: none; border-color: #F37021; background: white; }
          .stu-file-drop { border: 2px dashed #e2e8f0; border-radius: 20px; padding: 32px; text-align: center; background: #f8fafc; cursor: pointer; transition: all 0.2s; }
          .stu-file-drop:hover { border-color: #F37021; background: #fff7ed; }
          .stu-submit-btn { background: #F37021; color: white; padding: 16px; border-radius: 16px; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; transition: all 0.2s; box-shadow: 0 8px 16px -4px rgba(243, 112, 33, 0.3); }
          .stu-submit-btn:hover:not(:disabled) { transform: translateY(-2px); background: #ea580c; }
          .stu-submit-btn:disabled { background: #cbd5e1; box-shadow: none; cursor: not-allowed; }
          @media (max-width: 1200px) { .stu-grid-header { grid-template-columns: repeat(2, 1fr); } }
          @media (max-width: 1100px) { .stu-main-workspace { grid-template-columns: 1fr; } }
          @media (max-width: 640px) { .stu-grid-header { grid-template-columns: 1fr; } }
        `}
      </style>

      <div>
        <h1 className="stu-section-title">
          <GraduationCap size={28} className="text-[#F37021]" />
          Thông tin đồ án tốt nghiệp & Kết quả
        </h1>
        <p className="stu-section-desc">
          Theo dõi chi tiết lịch đồ án tốt nghiệp, kết quả chấm điểm và thực hiện chỉnh sửa hậu bảo vệ nếu cần thiết.
        </p>
      </div>

      <div className="stu-grid-header">
        <div className="stu-quick-card">
          <div className="stu-icon-box bg-blue-50 text-blue-600">
            <FileText size={24} />
          </div>
          <div className="stu-card-info">
            <h4>Mã đề tài</h4>
            <p>{defenseInfo.topicCode || "---"}</p>
          </div>
        </div>

        <div className="stu-quick-card">
          <div className="stu-icon-box bg-orange-50 text-[#F37021]">
            <Users size={24} />
          </div>
          <div className="stu-card-info">
            <h4>Hội đồng</h4>
            <p>{defenseInfo.committeeCode || "Chờ sắp xếp"}</p>
          </div>
        </div>

        <div className="stu-quick-card">
          <div className="stu-icon-box bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={24} />
          </div>
          <div className="stu-card-info">
            <h4>Kết quả tổng</h4>
            <p>{defenseInfo.finalScore != null ? `${defenseInfo.finalScore} (${defenseInfo.grade})` : "Chưa có điểm"}</p>
          </div>
        </div>

        <div className="stu-quick-card">
          <div className="stu-icon-box bg-purple-50 text-purple-600">
            <Clock size={24} />
          </div>
          <div className="stu-card-info">
            <h4>Trạng thái</h4>
            <p>{defenseInfo.councilListLocked ? "Đã chốt lịch" : "Đang xử lý"}</p>
          </div>
        </div>
      </div>

      <div className="stu-main-workspace">
        <div className="stu-content-card">
          <div className="stu-card-header">
            <div className="stu-tabs">
              <button className={`stu-tab ${activePanel === "overview" ? "active" : ""}`} onClick={() => setActivePanel("overview")}>
                <Calendar size={16} /> Tổng quan đồ án tốt nghiệp
              </button>
              {defenseInfo.revision?.needsRevision && (
                <button className={`stu-tab ${activePanel === "revision" ? "active" : ""}`} onClick={() => setActivePanel("revision")}>
                  <Upload size={16} /> Hậu bảo vệ đồ án tốt nghiệp
                </button>
              )}
            </div>
            {activePanel === "revision" && defenseInfo.revision?.deadline && (
              <div className="flex items-center gap-2 text-[11px] font-black text-red-500 uppercase">
                <Flame size={14} /> {formatCountdown(defenseInfo.revision.deadline)}
              </div>
            )}
          </div>

          <div className="stu-card-body">
            {activePanel === "overview" ? (
              <div className="flex flex-col gap-8">
                <div className="stu-info-grid">
                  <div className="stu-info-item">
                    <label>Phòng đồ án tốt nghiệp</label>
                    <div className="flex items-center gap-2 value"><MapPin size={16} className="text-blue-500" />{defenseInfo.room || "Chưa xác định"}</div>
                  </div>
                  <div className="stu-info-item">
                    <label>Thời gian</label>
                    <div className="flex items-center gap-2 value"><Clock size={16} className="text-orange-500" />{formatDateTime(defenseInfo.scheduledAt)}</div>
                  </div>
                  <div className="stu-info-item col-span-2">
                    <label>Tên đề tài</label>
                    <div className="value leading-relaxed">{defenseInfo.topicTitle || "Đang cập nhật..."}</div>
                  </div>
                </div>

                {(defenseInfo.isScoreLocked || defenseInfo.finalScore != null) && (
                  <div className="mt-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Chi tiết điểm từ hội đồng</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-5 bg-white border border-slate-100 rounded-2xl text-center shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Chủ tịch</p>
                        <p className="text-2xl font-black text-[#003D82]">{defenseInfo.scoreCt ?? "-"}</p>
                      </div>
                      <div className="p-5 bg-white border border-slate-100 rounded-2xl text-center shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Thư ký</p>
                        <p className="text-2xl font-black text-[#003D82]">{defenseInfo.scoreUvtk ?? "-"}</p>
                      </div>
                      <div className="p-5 bg-white border border-slate-100 rounded-2xl text-center shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Phản biện</p>
                        <p className="text-2xl font-black text-[#003D82]">{defenseInfo.scoreUvpb ?? "-"}</p>
                      </div>
                      <div className="p-5 bg-white border border-slate-100 rounded-2xl text-center shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">GV hướng dẫn</p>
                        <p className="text-2xl font-black text-[#003D82]">{defenseInfo.scoreGvhd ?? "-"}</p>
                      </div>
                    </div>
                    
                    <div className="mt-6 p-6 bg-orange-50 rounded-2xl border border-orange-100 flex justify-between items-center">
                      <div>
                        <p className="text-[11px] font-black text-orange-600 uppercase mb-1">Kết quả chung</p>
                        <h3 className="text-xl font-black text-slate-900">Điểm tổng kết: {defenseInfo.finalScore ?? "---"}</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-black text-orange-600 uppercase mb-1">Xếp loại</p>
                        <span className="px-4 py-2 bg-[#F37021] text-white rounded-xl font-black text-sm uppercase">
                          {defenseInfo.grade || "Đang xét"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-4 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <h5 className="flex items-center gap-2 text-sm font-black text-slate-900 mb-4"><AlertCircle size={16} className="text-blue-500" /> Lưu ý quan trọng</h5>
                  <ul className="space-y-3">
                    <li className="flex gap-3 text-xs font-bold text-slate-600"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>Có mặt tại phòng đồ án tốt nghiệp trước ít nhất 20 phút để chuẩn bị thiết bị và tinh thần.</li>
                    <li className="flex gap-3 text-xs font-bold text-slate-600"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>Chuẩn bị slide trình bày ngắn gọn, tập trung vào kết quả và sản phẩm chính.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="stu-revision-form">
                {showSubmittedWaitingCard && (
                  <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 mb-2">
                    <h5 className="text-sm font-black text-emerald-800 mb-2">Đã nộp bản chỉnh sửa</h5>
                    <p className="text-xs font-bold text-emerald-700 leading-relaxed">
                      Bạn đã nộp xong file hoàn thiện. Vui lòng chờ thư ký hội đồng kiểm tra và phản hồi kết quả.
                    </p>
                  </div>
                )}
                <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 mb-4">
                  <h5 className="flex items-center gap-2 text-sm font-black text-blue-900 mb-2"><MessageCircle size={16} /> Yêu cầu chỉnh sửa từ Hội đồng</h5>
                  <p className="text-xs font-bold text-blue-700 leading-relaxed">{defenseInfo.revision?.revisionReason || "Vui lòng hoàn thiện báo cáo theo góp ý của hội đồng."}</p>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="stu-input-group">
                    <label>Nội dung sinh viên đã sửa</label>
                    <textarea
                      className="stu-textarea"
                      placeholder="Mô tả tóm tắt những nội dung bạn đã cập nhật..."
                      value={revisedContent}
                      onChange={(e) => setRevisedContent(e.target.value)}
                      disabled={isSubmissionLocked}
                    />
                  </div>
                  <div className="stu-input-group">
                    <label>Tệp báo cáo hoàn thiện (PDF)</label>
                    <div
                      className="stu-file-drop"
                      onClick={() => {
                        if (isSubmissionLocked) return;
                        fileInputRef.current?.click();
                      }}
                      style={isSubmissionLocked ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                    >
                      <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" disabled={isSubmissionLocked} onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedFile(file);
                        setSelectedFileName(file?.name || "");
                      }} />
                      {selectedFile ? (
                        <div className="flex flex-col items-center gap-2">
                          <FileText size={32} className="text-[#F37021]" />
                          <span className="text-sm font-black text-slate-900">{selectedFileName}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Upload size={32} />
                          <span className="text-sm font-black">Chọn hoặc kéo thả tệp PDF vào đây</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button className="stu-submit-btn" disabled={submittingRevision || !selectedFile || isSubmissionLocked} onClick={submitRevision}>
                    {isSubmissionLocked ? "ĐANG CHỜ THƯ KÝ KIỂM TRA" : (submittingRevision ? "Đang xử lý..." : "Nộp báo cáo hoàn thiện")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <div className="stu-sidebar-card">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2"><Bell size={18} className="text-[#F37021]" /> Thông báo mới</h4>
            <div className="flex flex-col gap-4">
              {notifications.length > 0 ? (
                notifications.slice(0, 3).map((note, idx) => (
                  <div key={idx} className="stu-reminder-item">
                    <div className="stu-reminder-icon"><Bell size={18} /></div>
                    <div className="stu-reminder-content">
                      <h5>{formatNotificationType(note.type)}</h5>
                      <p>{note.message}</p>
                      <span className="text-[10px] font-bold text-slate-400 mt-1 block">{formatDateTime(note.timestamp)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8"><p className="text-xs font-bold text-slate-400 italic">Chưa có thông báo mới</p></div>
              )}
            </div>
          </div>

          {revisionHistory.length > 0 && (
            <div className="stu-sidebar-card">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2"><Clock size={18} className="text-blue-600" /> Lịch sử nộp</h4>
              <div className="flex flex-col gap-3">
                {revisionHistory.map((rev) => (
                  <div key={rev.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="text-xs font-black text-slate-900">Lần nộp #{rev.id}</p>
                      <p className="text-[10px] font-bold text-slate-400">{formatDateTime(rev.createdAt || rev.lastUpdated, false)}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${formatRevisionStatus(rev.finalStatus).className}`}>
                      {formatRevisionStatus(rev.finalStatus).label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDefenseInfo;
