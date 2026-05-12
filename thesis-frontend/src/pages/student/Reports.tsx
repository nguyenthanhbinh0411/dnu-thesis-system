import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Upload,
  FileText,
  Calendar,
  Clock,
  Download,
  User as UserIcon,
  BookOpen,
  Award,
  CheckCircle2,
  X,
  Eye,
  MessageSquare,
  ChevronRight,
  TrendingUp,
  Target,
  CheckCircle,
  LayoutGrid,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { useToast } from "../../context/useToast";
import { fetchData, normalizeUrl } from "../../api/fetchData";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { getAccessToken } from "../../services/auth-session.service";
import type { ApiResponse } from "../../types/api";
import type { SubmissionFile } from "../../types/submissionFile";
import type { Report } from "../../types/report";
import type { Topic } from "../../types/topic";
import type { LecturerProfile } from "../../types/lecturer";
import type { MilestoneTemplate } from "../../types/milestoneTemplate";
import type {
  ReportAggregateTag,
  StudentDashboardPayload,
  StudentProgressHistoryPayload,
  StudentProgressHistorySubmission,
  StudentProgressSubmitPayload,
  StudentReportAggregateMilestone,
  StudentReportAggregateSupervisor,
  StudentReportAggregateTopic,
} from "../../types/report-aggregate";

const mapAggregateTopicToTopic = (
  topic: StudentReportAggregateTopic,
): Topic => ({
  topicID: topic.topicID,
  topicCode: topic.topicCode,
  title: topic.title,
  summary: topic.summary,
  type: topic.type,
  proposerUserID: 0,
  proposerUserCode: "",
  proposerStudentProfileID: 0,
  proposerStudentCode: "",
  supervisorUserID: null,
  supervisorUserCode: topic.supervisorLecturerCode,
  supervisorLecturerProfileID: null,
  supervisorLecturerCode: topic.supervisorLecturerCode,
  catalogTopicID: null,
  catalogTopicCode: topic.catalogTopicCode,
  departmentID: null,
  departmentCode: null,
  status: topic.status,
  resubmitCount: null,
  createdAt: topic.createdAt,
  lastUpdated: topic.lastUpdated,
  tagID: null,
  tagCode: null,
});

const mapAggregateSupervisorToLecturer = (
  supervisor: StudentReportAggregateSupervisor,
): LecturerProfile => ({
  lecturerProfileID: supervisor.lecturerProfileID,
  lecturerCode: supervisor.lecturerCode,
  userCode: "",
  departmentCode: supervisor.departmentCode,
  degree: supervisor.degree,
  guideQuota: 0,
  defenseQuota: 0,
  currentGuidingCount: 0,
  gender: "",
  dateOfBirth: "",
  email: supervisor.email,
  phoneNumber: supervisor.phoneNumber,
  profileImage: "",
  address: "",
  notes: "",
  fullName: supervisor.fullName,
  createdAt: "",
  lastUpdated: null,
});

const mapHistorySubmissionToReport = (
  submission: StudentProgressHistorySubmission,
): Report => ({
  submissionID: submission.submissionID,
  submissionCode: submission.submissionCode,
  milestoneID: submission.milestoneID,
  milestoneCode: submission.milestoneCode,
  ordinal: submission.ordinal ?? null,
  studentUserID: 0,
  studentUserCode: submission.studentUserCode,
  studentProfileID: 0,
  studentProfileCode: submission.studentProfileCode || "",
  lecturerProfileID: null,
  lecturerCode: submission.lecturerCode,
  submittedAt: submission.submittedAt,
  attemptNumber: submission.attemptNumber,
  lecturerComment: submission.lecturerComment || undefined,
  lecturerState: submission.lecturerState || undefined,
  feedbackLevel: submission.feedbackLevel || undefined,
  reportTitle: submission.reportTitle,
  reportDescription: submission.reportDescription,
  lastUpdated: submission.lastUpdated,
  files: submission.files || [],
});

const Reports: React.FC = () => {
  const auth = useAuth();
  const { addToast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reportTitle, setReportTitle] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [canSubmit, setCanSubmit] = useState(true);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [lecturerProfile, setLecturerProfile] = useState<LecturerProfile | null>(null);
  const [currentMilestone, setCurrentMilestone] = useState<StudentReportAggregateMilestone | null>(null);
  const [milestoneTemplates, setMilestoneTemplates] = useState<MilestoneTemplate[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showReportDetailModal, setShowReportDetailModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const navigate = useNavigate();

  const loadStudentDashboard = useCallback(async (userCode: string) => {
    try {
      const dashboardRes = (await fetchData(
        `/reports/student/dashboard?userCode=${encodeURIComponent(userCode)}`,
      )) as ApiResponse<StudentDashboardPayload>;
      if (dashboardRes.success && dashboardRes.data) {
        const dashboard = dashboardRes.data;
        setTopic(dashboard.topic ? mapAggregateTopicToTopic(dashboard.topic) : null);
        setCurrentMilestone(dashboard.currentMilestone || null);
        setLecturerProfile(dashboard.supervisor ? mapAggregateSupervisorToLecturer(dashboard.supervisor) : null);
        setCanSubmit(Boolean(dashboard.canSubmit));
        setSubmitMessage(dashboard.blockReason || null);
      }
    } catch (err) { console.error("Error loading dashboard:", err); }
  }, []);

  const loadMilestoneTemplates = useCallback(async () => {
    try {
      const res = await fetchData<{ data?: MilestoneTemplate[] }>(
        "/MilestoneTemplates/get-list?Page=0&PageSize=10",
      );
      if (res.data) setMilestoneTemplates(res.data);
    } catch (err) { console.error("Error loading milestones:", err); }
  }, []);

  const loadProgressHistory = useCallback(async (userCode: string) => {
    try {
      const historyRes = (await fetchData(
        `/reports/student/progress-history?userCode=${encodeURIComponent(userCode)}&page=1&pageSize=50`,
      )) as ApiResponse<StudentProgressHistoryPayload>;
      if (historyRes.success && historyRes.data) {
        const items = historyRes.data.items || [];
        setReports(items.map((item) => mapHistorySubmissionToReport(item.submission)));
      }
    } catch (err) { console.error("Error loading history:", err); }
  }, []);

  useEffect(() => {
    const userCode = auth.user?.userCode;
    if (!userCode) return;
    const bootstrap = async () => {
      setLoading(true);
      await Promise.all([loadStudentDashboard(userCode), loadProgressHistory(userCode), loadMilestoneTemplates()]);
      setLoading(false);
    };
    bootstrap();
  }, [auth.user?.userCode, loadProgressHistory, loadStudentDashboard, loadMilestoneTemplates]);

  const milestoneViews = useMemo(() => {
    const sorted = [...milestoneTemplates].sort((a, b) => a.ordinal - b.ordinal);
    const currentOrdinal = currentMilestone?.ordinal ?? -1;
    const currentState = currentMilestone?.state;

    return sorted.map((m) => {
      const isCompleted =
        m.ordinal < currentOrdinal ||
        (m.ordinal === currentOrdinal && (currentState === "COMPLETED" || currentState === "WaitingForCommittee"));
      const isCurrent =
        m.ordinal === currentOrdinal && currentState !== "COMPLETED" && currentState !== "WaitingForCommittee";
      return { ...m, isCompleted, isCurrent };
    });
  }, [milestoneTemplates, currentMilestone]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
  };

  const handleDownloadFile = async (file: SubmissionFile, e?: React.MouseEvent) => {
    e?.preventDefault();
    try {
      const url = normalizeUrl(`/api/SubmissionFiles/download/${file.fileID}`);
      const token = getAccessToken();
      const resp = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!resp.ok) throw new Error("Download failed");
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.fileName || "download";
      a.click();
    } catch (err) { addToast("Không thể tải file.", "error"); }
  };

  const validateAndSetFile = (file: File) => {
    const errors: { [key: string]: string } = {};
    if (file.size > 10 * 1024 * 1024) errors.file = "File quá lớn (Tối đa 10MB)";
    const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) {
      errors.file = "Định dạng không hỗ trợ (Chỉ PDF, DOC, DOCX)";
    }
    setValidationErrors(errors);
    setSelectedFile(Object.keys(errors).length === 0 ? file : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !auth.user?.userCode) {
      addToast("Vui lòng chọn file và đăng nhập.", "warning"); return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("topicCode", topic?.topicCode || "");
      formData.append("milestoneCode", currentMilestone?.milestoneCode || "");
      formData.append("studentUserCode", auth.user.userCode);
      formData.append("lecturerCode", lecturerProfile?.lecturerCode || "");
      formData.append("reportTitle", reportTitle.trim());
      formData.append("reportDescription", reportDescription.trim());
      formData.append("files", selectedFile);
      const res = (await fetchData("/reports/student/progress-submit", { method: "POST", body: formData })) as ApiResponse<any>;
      if (res.success) {
        addToast("Nộp báo cáo thành công", "success");
        setReportTitle(""); setReportDescription(""); setSelectedFile(null);
        if (auth.user?.userCode) await loadProgressHistory(auth.user.userCode);
      }
    } catch (err) { addToast("Lỗi khi nộp báo cáo", "error"); } finally { setSubmitting(false); }
  };

  const getStatusText = (s?: string) => {
    const state = s?.toLowerCase();
    if (["đã duyệt", "approved", "accepted"].includes(state!)) return "Đã duyệt";
    if (["chờ duyệt", "pending"].includes(state!)) return "Chờ duyệt";
    return "Cần sửa";
  };

  const getStatusTone = (s?: string) => {
    const state = s?.toLowerCase();
    if (["đã duyệt", "approved", "accepted"].includes(state!)) return { bg: "#ecfdf5", color: "#10b981", border: "#10b981" };
    if (["chờ duyệt", "pending"].includes(state!)) return { bg: "#fff7ed", color: "#F37021", border: "#fdba74" };
    return { bg: "#fef9c3", color: "#a16207", border: "#fde047" };
  };

  const getFeedbackLevelText = (level?: string) => {
    switch (level?.toLowerCase()) {
      case "good": return "Tốt";
      case "moderate": return "Trung bình";
      case "high": return "Cao";
      case "normal": return "Bình thường";
      case "medium": return "Trung cấp";
      case "low": return "Thấp";
      default: return level || "Chưa có";
    }
  };

  const getMilestoneTone = (isCompleted: boolean, isCurrent: boolean, state?: string) => {
    if (isCompleted || state === "WaitingForCommittee") return { bg: "#ecfdf5", color: "#10b981", border: "#10b981", dot: "#10B981" };
    if (isCurrent) return { bg: "#fff7ed", color: "#F37021", border: "#fdba74", dot: "#F37021" };
    return { bg: "#f8fafc", color: "#64748b", border: "#cbd5e1", dot: "#e2e8f0" };
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#003D82] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Đang tải dữ liệu...</p>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 lg:p-8 w-full flex flex-col gap-6">
      <style>
        {`
          .unified-workspace {
            display: grid; grid-template-columns: 1fr 450px; gap: 24px;
            width: 100%; align-items: stretch;
          }
          @media (max-width: 1400px) { .unified-workspace { grid-template-columns: 1fr; } }
          .custom-table th {
            text-align: left; padding: 12px 16px; background: #FFFFFF; color: #64748B;
            font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
            border-bottom: 2px solid #F1F5F9;
          }
          .custom-table td { padding: 14px 16px; border-bottom: 1px solid #F1F5F9; font-size: 12px; }
          .custom-table tr:hover { background: #F8FAFC; }
        `}
      </style>

      {/* --- QUICK STATS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 flex items-center gap-5 group hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#F37021] flex items-center justify-center group-hover:scale-110 transition-transform"><FileText size={24} /></div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng số báo cáo</p>
               <h3 className="text-xl font-black text-slate-900">{reports.length} bản ghi</h3>
            </div>
         </div>
         <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 flex items-center gap-5 group hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#003D82] flex items-center justify-center group-hover:scale-110 transition-transform"><TrendingUp size={24} /></div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đánh giá gần nhất</p>
               <h3 className="text-xl font-black text-slate-900">{reports[0] ? getFeedbackLevelText(reports[0].feedbackLevel) : "Chưa có"}</h3>
            </div>
         </div>
         <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 flex items-center gap-5 group hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform"><Target size={24} /></div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hạn chót tiếp theo</p>
               <h3 className="text-xl font-black text-slate-900">{currentMilestone?.deadline ? new Date(currentMilestone.deadline).toLocaleDateString('vi-VN') : "Không có"}</h3>
            </div>
         </div>
      </div>

      {/* --- MAXIMUM STRETCH ROADMAP --- */}
      <div className="bg-white p-10 lg:p-12 rounded-[24px] shadow-sm border border-slate-100 relative overflow-hidden">
         <div className="flex justify-between items-start relative px-8">
            {milestoneViews.map((m, idx) => {
               const tone = getMilestoneTone(m.isCompleted, m.isCurrent, m.ordinal === currentMilestone?.ordinal ? currentMilestone?.state : undefined);
               const nextMilestone = milestoneViews[idx + 1] || null;
               
               let lineColor = "#E2E8F0";
               if (nextMilestone) {
                  if (nextMilestone.isCompleted) lineColor = "#10B981";
                  else if (nextMilestone.isCurrent) lineColor = "#F37021";
               }

               return (
                  <div key={m.milestoneTemplateID} className="flex-1 flex flex-col items-center relative group">
                     {idx < milestoneViews.length - 1 && (
                        <div className="absolute top-6 left-[50%] right-[-50%] h-[2px] z-0" style={{ backgroundColor: lineColor }}></div>
                     )}

                     <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300 bg-white z-10
                        ${m.isCompleted || m.isCurrent ? 'scale-110 shadow-lg' : ''}`}
                        style={{ borderColor: tone.dot, color: tone.dot }}>
                        {m.isCompleted ? <CheckCircle size={24} /> : <span className="font-black text-sm">{idx + 1}</span>}
                     </div>

                     <div className="mt-7 text-center px-2">
                        <p className={`text-[12px] font-black mb-1 transition-colors ${m.isCurrent || m.isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                           {m.name}
                        </p>
                        <span className="text-[10px] font-bold text-slate-400 block mb-2">
                           {m.deadline ? new Date(m.deadline).toLocaleDateString('vi-VN') : "Đang cập nhật"}
                        </span>
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider"
                           style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}>
                           {m.ordinal === 4 && currentMilestone?.state === "WaitingForCommittee" 
                              ? "Chờ hội đồng & bảo vệ" 
                              : m.isCompleted ? "Hoàn thành" : m.isCurrent ? "Đang thực hiện" : "Sắp tới"}
                        </span>
                     </div>
                  </div>
               );
            })}
         </div>
      </div>

      <div className="unified-workspace">
        {/* --- LEFT: SUBMISSION FORM --- */}
        <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 lg:p-10 flex flex-col gap-8 h-full">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Upload size={24} className="text-[#F37021]" />Nộp báo cáo tiến độ</h2>
            </div>
            {!canSubmit && <div className="px-4 py-2 bg-orange-50 border border-orange-100 rounded-xl text-orange-600 text-[10px] font-black uppercase">Cổng đang đóng</div>}
          </div>
          {(!canSubmit || currentMilestone?.state === "WaitingForCommittee") ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-10">
               <div className={`w-16 h-16 rounded-full flex items-center justify-center ${currentMilestone?.state === "WaitingForCommittee" ? "bg-emerald-50 text-emerald-500" : "bg-slate-50 text-slate-300"}`}>
                  {currentMilestone?.state === "WaitingForCommittee" ? <CheckCircle size={32} /> : <Clock size={32} />}
               </div>
               <p className={`${currentMilestone?.state === "WaitingForCommittee" ? "text-emerald-600" : "text-slate-400"} font-bold text-sm max-w-xs text-center`}>
                  {currentMilestone?.state === "WaitingForCommittee" 
                    ? "Bạn đã hoàn thành tất cả các mốc báo cáo. Vui lòng chờ nhà trường sắp xếp hội đồng bảo vệ." 
                    : (submitMessage || "Hiện tại không trong thời gian nộp bài.")}
               </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 flex-1">
                 <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Tiêu đề báo cáo</label>
                      <input type="text" value={reportTitle} onChange={(e) => setReportTitle(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-[#003D82] focus:ring-4 focus:ring-blue-50 transition-all"
                        placeholder="Nhập tiêu đề..." required />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Mô tả</label>
                      <textarea value={reportDescription} onChange={(e) => setReportDescription(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-[#003D82] focus:ring-4 focus:ring-blue-50 transition-all resize-none flex-1"
                        placeholder="Mô tả nội dung..." rows={5} />
                    </div>
                 </div>
                 <div className="flex flex-col h-full">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Tài liệu</label>
                    <div className={`flex-1 border-2 border-dashed rounded-[24px] p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all relative
                        ${isDragOver ? "border-[#003D82] bg-blue-50" : "border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300"}`}
                      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setIsDragOver(false); if(e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]); }}
                      onClick={() => document.getElementById("file-input")?.click()}>
                      
                      <input type="file" id="file-input" className="hidden" onChange={handleFileChange} />
                      
                      {!selectedFile ? (
                        <div className="flex flex-col items-center gap-4"><div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400"><Upload size={24} /></div><p className="text-xs font-black text-slate-600 uppercase tracking-widest">Kéo thả file</p></div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300">
                           <button 
                             onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                             className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm border border-slate-100"
                           >
                             <X size={16} />
                           </button>
                           <div className="w-14 h-14 bg-[#003D82] rounded-2xl shadow-lg flex items-center justify-center text-white"><FileText size={24} /></div>
                           <p className="text-xs font-black text-slate-800 truncate max-w-[200px]">{selectedFile.name}</p>
                        </div>
                      )}
                    </div>
                 </div>
              </div>
              <div className="pt-8 border-t border-slate-100 flex items-center justify-between">
                 <div className="flex flex-col gap-1">
                    {validationErrors.file ? (
                       <p className="text-[10px] font-black text-red-500 uppercase flex items-center gap-1.5 animate-pulse"><AlertCircle size={14} /> {validationErrors.file}</p>
                    ) : (
                       <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5"><AlertCircle size={14} /> Định dạng: PDF, DOC, DOCX (Tối đa 10MB)</p>
                    )}
                 </div>
                 <button type="submit" disabled={submitting || !selectedFile}
                   className={`px-12 py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all
                     ${submitting || !selectedFile ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-[#F37021] text-white shadow-xl shadow-orange-100 hover:bg-orange-600"}`}>
                   {submitting ? "Đang xử lý..." : "Gửi báo cáo ngay"}
                 </button>
              </div>
            </form>
          )}
        </div>

        {/* --- RIGHT: HISTORY TABLE --- */}
        <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 flex flex-col overflow-hidden h-full max-h-[800px]">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
             <h2 className="text-sm font-black text-slate-900 flex items-center gap-2"><Clock size={16} className="text-[#003D82]" />Lịch sử nộp báo cáo ({reports.length})</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full custom-table border-collapse">
              <thead>
                <tr>
                  <th className="w-14">Lần</th>
                  <th>Tiêu đề</th>
                  <th className="w-24">Ngày nộp</th>
                  <th className="w-24">Trạng thái</th>
                  <th className="text-center w-20">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-20 text-slate-400 font-bold italic text-[11px]">Chưa có dữ liệu.</td></tr>
                ) : (
                  reports.map((report, idx) => {
                    const tone = getStatusTone(report.lecturerState);
                    return (
                      <tr 
                        key={report.submissionID}
                        className="cursor-pointer hover:bg-blue-50/30 group/row transition-all relative"
                        onClick={() => { setSelectedReport(report); setShowReportDetailModal(true); }}
                      >
                        <td className="font-black text-slate-400">#{report.attemptNumber || reports.length - idx}</td>
                        <td className="font-bold text-slate-800">
                           <div className="truncate max-w-[150px] group-hover/row:text-[#003D82] transition-colors" title={report.reportTitle}>{report.reportTitle}</div>
                        </td>
                        <td className="text-slate-500 font-medium whitespace-nowrap">{new Date(report.submittedAt).toLocaleDateString("vi-VN")}</td>
                        <td>
                           <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider whitespace-nowrap"
                              style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}>
                              {getStatusText(report.lecturerState)}
                           </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                           <div className="flex items-center justify-center gap-1">
                              <button onClick={() => { setSelectedReport(report); setShowReportDetailModal(true); }} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-[#003D82] shadow-sm border border-transparent hover:border-slate-100 transition-all" title="Xem chi tiết"><Eye size={14} /></button>
                              {report.files?.[0] && (
                                <button onClick={(e) => handleDownloadFile(report.files![0], e)} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-emerald-500 shadow-sm border border-transparent hover:border-slate-100 transition-all" title="Tải tài liệu"><Download size={14} /></button>
                              )}
                           </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showReportDetailModal && selectedReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
           <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="bg-gradient-to-r from-[#003D82] to-[#0052a2] p-6 text-white flex justify-between items-center">
                 <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-80 mb-0.5">Chi tiết lịch sử nộp báo cáo</h3>
                    <p className="text-[10px] font-bold text-blue-100 flex items-center gap-2"><Clock size={12} /> Lần nộp #{selectedReport.attemptNumber || "N/A"}</p>
                 </div>
                 <button onClick={() => setShowReportDetailModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={20} /></button>
              </div>
              <div className="p-8 space-y-6 max-h-[65vh] overflow-y-auto">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Mốc tiến độ</span>
                             <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#F37021]"></div>
                                <span className="text-xs font-black text-slate-900 uppercase">{selectedReport.milestoneCode}</span>
                             </div>
                          </div>
                          <div className="space-y-1 text-right">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ngày nộp</span>
                             <div className="text-xs font-black text-slate-900">{new Date(selectedReport.submittedAt).toLocaleString('vi-VN')}</div>
                          </div>
                       </div>

                       <div className="p-5 rounded-[20px] bg-slate-50 border border-slate-100 space-y-3">
                          <div className="space-y-1">
                             <span className="text-[9px] font-black text-[#003D82] uppercase tracking-widest block">Tiêu đề báo cáo</span>
                             <p className="text-lg font-black text-slate-900 leading-tight">{selectedReport.reportTitle}</p>
                          </div>
                          <div className="space-y-1">
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Mô tả nội dung</span>
                             <p className="text-xs text-slate-600 font-bold italic leading-relaxed">"{selectedReport.reportDescription || "Không có mô tả"}"</p>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-6">
                       {selectedReport.files && selectedReport.files.length > 0 && (
                          <div className="space-y-2">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tài liệu đính kèm</span>
                             <div className="space-y-2">
                                {selectedReport.files.map((file) => (
                                   <div key={file.fileID} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-[#003D82] transition-all group">
                                      <div className="flex items-center gap-3">
                                         <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#003D82] flex items-center justify-center group-hover:bg-[#003D82] group-hover:text-white transition-all"><FileText size={16} /></div>
                                         <div className="max-w-[200px]">
                                            <p className="text-[11px] font-black text-slate-900 truncate" title={file.fileName}>{file.fileName}</p>
                                         </div>
                                      </div>
                                      <button onClick={(e) => handleDownloadFile(file, e)} className="p-2 text-slate-400 hover:text-emerald-500 transition-all" title="Tải xuống"><Download size={16} /></button>
                                   </div>
                                ))}
                             </div>
                          </div>
                       )}

                       {selectedReport.lecturerComment && (
                          <div className="p-5 rounded-[20px] bg-orange-50 border border-orange-100 space-y-2">
                             <span className="text-[9px] font-black text-[#F37021] uppercase tracking-widest flex items-center gap-2">
                                <MessageSquare size={12} /> Phản hồi từ giảng viên
                             </span>
                             <p className="text-xs text-slate-700 font-bold leading-relaxed">{selectedReport.lecturerComment}</p>
                             {selectedReport.feedbackLevel && (
                                <div className="pt-1">
                                   <span className="px-2 py-0.5 bg-white rounded-md text-[9px] font-black text-[#F37021] uppercase border border-orange-200">
                                      Đánh giá: {getFeedbackLevelText(selectedReport.feedbackLevel)}
                                   </span>
                                </div>
                             )}
                          </div>
                       )}
                    </div>
                 </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                 <button onClick={() => setShowReportDetailModal(false)} className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-100 transition-all">Đóng</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
