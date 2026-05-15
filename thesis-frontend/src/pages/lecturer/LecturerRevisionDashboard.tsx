import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Download,
  CheckCircle2,
  XCircle,
  Building2,
  Users,
  MapPin,
  ClipboardList,
  Check,
} from "lucide-react";
import { fetchData, normalizeUrl } from "../../api/fetchData";
import { useToast } from "../../context/useToast";
import { getActiveDefensePeriodId } from "../../utils/defensePeriod";
import { createIdempotencyKey } from "../../types/defense-workflow-contract";
import type { ApiResponse } from "../../types/api";

// --- Types ---

type RevisionStatus =
  | "NotRequired"
  | "WaitingStudent"
  | "StudentSubmitted"
  | "Approved"
  | "Rejected"
  | "Expired";

type RevisionItem = {
  revisionId: number;
  assignmentId: number;
  topicCode: string;
  topicTitle: string;
  proposerStudentCode: string;
  proposerStudentName: string;
  finalStatus: string;
  revisionFileUrl: string | null;
  requiredRevisionContent: string | null;
  revisionReason: string | null;
  submissionDeadline: string | null;
  secretaryComment: string | null;
  isGvhdApproved: boolean;
  isUvtkApproved: boolean;
  isCtApproved: boolean;
  status: RevisionStatus;
  lastUpdated: string | null;
};

type CommitteeGroup = {
  committeeId: number;
  committeeCode: string;
  committeeName: string;
  room: string;
  defenseDate: string | null;
  committeeStatus: string | null;
  lecturerRole: string;
  normalizedRole: string;
  allowedRevisionActions: string[];
  pendingRevisionCount: number;
  waitingRevisionCount: number;
  revisions: RevisionItem[];
};

const statusLabels: Record<RevisionStatus, string> = {
  NotRequired: "Không yêu cầu",
  WaitingStudent: "Chờ sinh viên",
  StudentSubmitted: "Đã nộp lại",
  Approved: "Đã duyệt",
  Rejected: "Từ chối",
  Expired: "Quá hạn",
};

const normalizeRevisionStatus = (value: unknown): RevisionStatus => {
  if (typeof value === "number") {
    if (value === 2) return "StudentSubmitted";
    if (value === 3) return "Approved";
    if (value === 4) return "Rejected";
    if (value === 5) return "Expired";
    return "WaitingStudent";
  }

  const text = String(value ?? "").trim().toUpperCase();
  if (text === "2" || text.includes("STUDENTSUBMITTED")) return "StudentSubmitted";
  if (text.includes("APPROVED") || text.includes("DUYET")) return "Approved";
  if (text.includes("REJECT") || text.includes("TU_CHOI") || text.includes("TỪ CHỐI")) return "Rejected";
  if (text.includes("EXPIRED") || text.includes("QUA_HAN") || text.includes("QUÁ HẠN")) return "Expired";
  if (text.includes("NOTREQUIRED")) return "NotRequired";
  return "WaitingStudent";
};

// --- Utils ---

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("vi-VN");
};

const formatDateOnly = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("vi-VN");
};

const parseCommitteeGroups = (payload: unknown): CommitteeGroup[] => {
  if (!payload || typeof payload !== "object") return [];
  
  const data = (payload as any).data ?? (payload as any).Items ?? payload;
  if (!Array.isArray(data)) return [];

  return data.map((group: any) => ({
    committeeId: Number(group.committeeId ?? group.CommitteeId ?? 0),
    committeeCode: String(group.committeeCode ?? group.CommitteeCode ?? ""),
    committeeName: String(group.committeeName ?? group.CommitteeName ?? ""),
    room: String(group.room ?? group.Room ?? ""),
    defenseDate: group.defenseDate ?? group.DefenseDate ?? null,
    committeeStatus: group.committeeStatus ?? group.CommitteeStatus ?? null,
    lecturerRole: String(group.lecturerRole ?? group.LecturerRole ?? "Thành viên"),
    normalizedRole: String(group.normalizedRole ?? group.NormalizedRole ?? "MEMBER"),
    allowedRevisionActions: Array.isArray(group.allowedRevisionActions) ? group.allowedRevisionActions : [],
    pendingRevisionCount: Number(group.pendingRevisionCount ?? group.PendingRevisionCount ?? 0),
    waitingRevisionCount: Number(group.waitingRevisionCount ?? group.WaitingRevisionCount ?? 0),
    revisions: (group.revisions ?? group.Revisions ?? []).map((rev: any) => ({
      revisionId: Number(rev.revisionId ?? rev.RevisionId ?? 0),
      assignmentId: Number(rev.assignmentId ?? rev.AssignmentId ?? 0),
      topicCode: String(rev.topicCode ?? rev.TopicCode ?? ""),
      topicTitle: String(rev.topicTitle ?? rev.TopicTitle ?? ""),
      proposerStudentCode: String(rev.proposerStudentCode ?? rev.ProposerStudentCode ?? ""),
      proposerStudentName: String(
        rev.proposerStudentName ??
        rev.ProposerStudentName ??
        rev.studentName ??
        rev.StudentName ??
        rev.studentFullName ??
        rev.StudentFullName ??
        rev.fullName ??
        rev.FullName ??
        rev.proposerStudentCode ??
        rev.ProposerStudentCode ??
        "",
      ),
      finalStatus: String(rev.finalStatus ?? rev.FinalStatus ?? "PENDING"),
      revisionFileUrl: rev.revisionFileUrl ?? rev.RevisionFileUrl ?? null,
      requiredRevisionContent: rev.requiredRevisionContent ?? rev.RequiredRevisionContent ?? null,
      revisionReason: rev.revisionReason ?? rev.RevisionReason ?? null,
      submissionDeadline: rev.submissionDeadline ?? rev.SubmissionDeadline ?? null,
      secretaryComment: rev.secretaryComment ?? rev.SecretaryComment ?? null,
      isGvhdApproved: Boolean(rev.isGvhdApproved ?? rev.IsGvhdApproved ?? false),
      isUvtkApproved: Boolean(rev.isUvtkApproved ?? rev.IsUvtkApproved ?? false),
      isCtApproved: Boolean(rev.isCtApproved ?? rev.IsCtApproved ?? false),
      status: normalizeRevisionStatus(rev.status ?? rev.Status ?? "WaitingStudent"),
      lastUpdated: rev.lastUpdated ?? rev.LastUpdated ?? null,
    })),
  }));
};

const LecturerRevisionDashboard: React.FC = () => {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<CommitteeGroup[]>([]);
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<number | null>(
    searchParams.get("committeeId") ? Number(searchParams.get("committeeId")) : null
  );
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reasonByRevision, setReasonByRevision] = useState<Record<number, string>>({});
  const [activeAction, setActiveAction] = useState<{ revisionId: number; type: 'APPROVE' | 'REJECT' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const periodId = getActiveDefensePeriodId();

  const loadDashboard = useCallback(async () => {
    if (!periodId) {
      setGroups([]);
      setLoading(false);
      setError("Chưa xác định được đợt đồ án tốt nghiệp hiện tại.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const envelope = await fetchData<ApiResponse<CommitteeGroup[]>>(
        `/defense-periods/${periodId}/lecturer/revisions`,
        { method: "GET" }
      );

      if (!envelope.success) {
        throw new Error(envelope.message || "Không tải được danh sách hậu bảo vệ.");
      }

      const parsedGroups = parseCommitteeGroups(envelope.data);
      setGroups(parsedGroups);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Không tải được danh sách hậu bảo vệ.";
      setGroups([]);
      setError(message);
      addToast(message, "error");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [addToast, periodId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleSelectCommittee = (id: number | null) => {
    setSelectedCommitteeId(id);
    const nextParams = new URLSearchParams(searchParams);
    if (id) {
      nextParams.set("committeeId", String(id));
    } else {
      nextParams.delete("committeeId");
    }
    setSearchParams(nextParams, { replace: true });
  };

  const getReason = (revisionId: number): string => String(reasonByRevision[revisionId] ?? "").trim();

  const setReason = (revisionId: number, value: string) => {
    setReasonByRevision((prev) => ({ ...prev, [revisionId]: value }));
  };

  const clearReason = (revisionId: number) => {
    setReasonByRevision((prev) => {
      const next = { ...prev };
      delete next[revisionId];
      return next;
    });
  };

  const handleApprove = async (revisionId: number) => {
    if (!periodId) return;
    const reason = getReason(revisionId);
    if (!reason) {
      addToast("Vui lòng nhập lý do khi duyệt hồ sơ.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const envelope = await fetchData<ApiResponse<boolean>>(`/defense-periods/${periodId}/lecturer/revisions/actions`, {
        method: "POST",
        body: {
          action: "APPROVE",
          revisionId,
          approve: { reason },
          notifyStudent: true,
          idempotencyKey: createIdempotencyKey(String(periodId), `revision-approve-${revisionId}-${Date.now()}`),
        },
      });

      if (!envelope.success) throw new Error(envelope.message || "Không duyệt được.");

      addToast("Đã duyệt hồ sơ. Hệ thống đã gửi thông báo kết quả tới sinh viên.", "success");
      clearReason(revisionId);
      setActiveAction(null);
      await loadDashboard();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Lỗi xử lý", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (revisionId: number) => {
    if (!periodId) return;
    const reason = getReason(revisionId);
    if (!reason) {
      addToast("Vui lòng nhập lý do từ chối.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const envelope = await fetchData<ApiResponse<boolean>>(`/defense-periods/${periodId}/lecturer/revisions/actions`, {
        method: "POST",
        body: {
          action: "REJECT",
          revisionId,
          reject: { reason },
          notifyStudent: true,
          idempotencyKey: createIdempotencyKey(String(periodId), `revision-reject-${revisionId}-${Date.now()}`),
        },
      });

      if (!envelope.success) throw new Error(envelope.message || "Không từ chối được.");

      addToast("Đã từ chối hồ sơ và gửi phản hồi cho sinh viên.", "success");
      clearReason(revisionId);
      setActiveAction(null);
      await loadDashboard();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Lỗi xử lý", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadgeClass = (status: RevisionStatus) => {
    if (status === "StudentSubmitted") return "rev-badge-submitted";
    if (status === "Approved") return "rev-badge-submitted";
    if (status === "Rejected" || status === "Expired") return "rev-badge-neutral";
    return "rev-badge-waiting";
  };

  const currentCommittee = useMemo(() => 
    groups.find(g => g.committeeId === selectedCommitteeId), 
    [groups, selectedCommitteeId]
  );

  const filteredRevisions = useMemo(() => {
    if (!currentCommittee) return [];
    const lower = searchTerm.trim().toLowerCase();
    if (!lower) return currentCommittee.revisions;
    
    return currentCommittee.revisions.filter(r => 
      r.topicTitle.toLowerCase().includes(lower) ||
      r.proposerStudentCode.toLowerCase().includes(lower)
    );
  }, [currentCommittee, searchTerm]);

  const filteredGroups = useMemo(() => {
    const lower = searchTerm.trim().toLowerCase();
    if (!lower) return groups;
    return groups.filter(g => 
      g.committeeName.toLowerCase().includes(lower) ||
      g.committeeCode.toLowerCase().includes(lower)
    );
  }, [groups, searchTerm]);

  const totalStats = useMemo(() => {
    let totalCommittees = groups.length;
    let totalPending = groups.reduce((acc, g) => acc + g.pendingRevisionCount, 0);
    let totalWaiting = groups.reduce((acc, g) => acc + g.waitingRevisionCount, 0);
    return { totalCommittees, totalPending, totalWaiting };
  }, [groups]);

  const activeRevision = useMemo(() => {
    if (!activeAction || !currentCommittee) return null;
    return currentCommittee.revisions.find(r => r.revisionId === activeAction.revisionId);
  }, [activeAction, currentCommittee]);

  // --- Render ---

  return (
    <div className="dashboard-root" style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      <style>{`
        :root {
          --primary: #F37021;
          --primary-light: #fff7ed;
          --secondary: #1e3a8a;
          --text-main: #0f172a;
          --text-muted: #64748b;
          --bg-card: #ffffff;
          --radius-lg: 24px;
          --radius-md: 16px;
          --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
          --shadow-md: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05);
          --shadow-lg: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
        }

        .premium-card {
          background: var(--bg-card);
          border-radius: var(--radius-md);
          padding: 24px;
          border: 1px solid rgba(226, 232, 240, 0.8);
          box-shadow: var(--shadow-md);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 160px;
        }

        .premium-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
          border-color: var(--primary);
        }

        .stat-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }

        .rev-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 99px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }
        .rev-badge-submitted { background: #f0fdf4; color: #16a34a; border: 1px solid #dcfce7; }
        .rev-badge-waiting { background: #fff7ed; color: #ea580c; border: 1px solid #ffedd5; }
        .rev-badge-neutral { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }

        .rev-table {
          width: 100%;
          border-collapse: collapse;
        }
        .rev-table th {
          background: #f8fafc;
          padding: 16px 20px;
          text-align: left;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #e2e8f0;
        }
        .rev-table td {
          padding: 16px 20px;
          border-bottom: 1px solid #f1f5f9;
        }

        .rev-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .rev-modal {
          background: white;
          border-radius: 24px;
          width: 100%;
          max-width: 1200px;
          height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: var(--shadow-lg);
        }
        .rev-pdf-frame { width: 100%; height: 100%; border: none; }
        .rev-textarea { width: 100%; height: 80px; border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; font-size: 14px; outline: none; transition: border 0.2s; resize: none; }
        .rev-textarea:focus { border-color: #f37021; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .rev-quorum-dot {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 800;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #94a3b8;
          cursor: help;
        }
        .rev-quorum-dot.active {
          background: #f37021;
          color: white;
          border-color: #f37021;
        }

        .action-btn {
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
          border: 1px solid transparent;
        }

        .btn-approve {
          background: #f37021;
          color: white;
        }
        .btn-approve:hover {
          background: #e65f10;
          transform: translateY(-1px);
        }

        .btn-reject {
          background: #fef2f2;
          color: #ef4444;
          border-color: #fee2e2;
        }
        .btn-reject:hover {
          background: #fee2e2;
          transform: translateY(-1px);
        }

        .btn-cancel {
          background: transparent;
          color: #64748b;
          border: none;
          font-weight: 600;
          padding: 8px;
        }
        .btn-cancel:hover {
          color: #0f172a;
        }

        .expand-reason {
          animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          background: #f8fafc;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          margin-top: 8px;
          width: 320px;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .action-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(4px);
          z-index: 1100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: fadeIn 0.2s ease-out;
        }

        .action-modal {
          background: white;
          border-radius: 20px;
          width: 100%;
          max-width: 500px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Hero Section */}
      <div style={{
        background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
        borderRadius: "24px",
        padding: "40px",
        color: "white",
        marginBottom: "32px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(243, 112, 33, 0.2)",
            color: "#fb923c",
            padding: "6px 14px",
            borderRadius: "99px",
            fontSize: "13px",
            fontWeight: "700",
            marginBottom: "16px",
            border: "1px solid rgba(243, 112, 33, 0.3)"
          }}>
            <ShieldCheck size={14} />
            HỆ THỐNG QUẢN LÝ HẬU BẢO VỆ
          </div>
          <h1 style={{ fontSize: "32px", fontWeight: "900", margin: "0 0 12px 0", letterSpacing: "-0.02em" }}>Cổng thông tin <span style={{ color: '#f37021' }}>Hậu bảo vệ</span></h1>
          <p style={{ fontSize: "16px", color: "#cbd5e1", maxWidth: "600px", lineHeight: "1.6" }}>
            Chào mừng Thư ký hội đồng. Tại đây bạn có thể kiểm tra, phê duyệt hoặc yêu cầu chỉnh sửa lại 
            các bản thảo luận văn cuối cùng sau khi sinh viên đã bảo vệ thành công.
          </p>
          <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
            <button 
              onClick={() => { setIsRefreshing(true); void loadDashboard(); }} 
              style={{ background: 'white', color: '#1e293b', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
              Làm mới dữ liệu
            </button>
            <Link to="/lecturer/committees" style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '10px 20px', borderRadius: '12px', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowRight size={16} /> Quay lại hội đồng
            </Link>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginTop: "40px", position: 'relative', zIndex: 1 }}>
          <div style={{ background: "rgba(255, 255, 255, 0.05)", backdropFilter: "blur(10px)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "16px", padding: "20px" }}>
            <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Hội đồng phụ trách</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "white" }}>{totalStats.totalCommittees}</div>
          </div>
          <div style={{ background: "rgba(255, 255, 255, 0.05)", backdropFilter: "blur(10px)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "16px", padding: "20px" }}>
            <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Hồ sơ chờ xử lý</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#fb923c" }}>{totalStats.totalPending}</div>
          </div>
          <div style={{ background: "rgba(255, 255, 255, 0.05)", backdropFilter: "blur(10px)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "16px", padding: "20px" }}>
            <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Chờ sinh viên nộp</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#94a3b8" }}>{totalStats.totalWaiting}</div>
          </div>
        </div>
      </div>

      <div className="rev-main">
        {selectedCommitteeId === null ? (
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "20px", fontWeight: "800", marginBottom: "20px", color: "#0f172a" }}>
              <ClipboardList size={24} color="#f37021" />
              Danh sách Hội đồng bạn làm Thư ký
            </div>

            <div style={{ background: "white", borderRadius: "16px", padding: "20px", marginBottom: "24px", boxShadow: "var(--shadow-sm)", border: "1px solid #E5E7EB", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: "1 1 400px", position: "relative" }}>
                <Search size={18} color="#9CA3AF" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Tìm kiếm hội đồng, mã hội đồng..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px 10px 40px", border: "1px solid #D1D5DB", borderRadius: "12px", fontSize: "14px", outline: "none" }}
                />
              </div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" }}>
              {filteredGroups.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', background: 'white', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
                  <ClipboardList size={48} color="#94a3b8" style={{ marginBottom: '16px' }} />
                  <p style={{ color: '#64748b', fontWeight: 500 }}>{loading ? "Đang tải dữ liệu..." : "Không tìm thấy hội đồng nào phù hợp."}</p>
                </div>
              ) : (
                filteredGroups.map(group => (
                  <div key={group.committeeId} className="premium-card" onClick={() => handleSelectCommittee(group.committeeId)} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className="stat-icon-wrapper" style={{ background: "#fff7ed" }}>
                        <Users size={24} color="#f37021" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                        {group.pendingRevisionCount > 0 && (
                          <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, border: '1px solid #dcfce7' }}>
                            {group.pendingRevisionCount} hồ sơ đã nộp
                          </span>
                        )}
                        {group.waitingRevisionCount > 0 && (
                          <span style={{ background: '#f8fafc', color: '#64748b', padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, border: '1px solid #e2e8f0' }}>
                            {group.waitingRevisionCount} hồ sơ chờ nộp
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{group.committeeCode}</div>
                      <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 12px 0', color: '#0f172a' }}>{group.committeeName}</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
                          <CalendarDays size={14} /> {formatDateOnly(group.defenseDate)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
                          <MapPin size={14} /> Phòng: {group.room || 'Chưa xếp'}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>{group.revisions.length} đề tài tham gia</span>
                      <div style={{ color: '#f37021', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Chi tiết <ChevronRight size={16} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : (
          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", gap: "16px", flexWrap: "wrap" }}>
              <div onClick={() => handleSelectCommittee(null)} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                <ArrowLeft size={18} /> Quay lại danh sách hội đồng
              </div>
              <div style={{ position: 'relative', minWidth: '300px' }}>
                <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm sinh viên, đề tài..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '10px 16px 10px 40px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "20px", fontWeight: "800", marginBottom: "20px", color: "#0f172a" }}>
              <Building2 size={24} color="#f37021" />
              Chi tiết hồ sơ Hội đồng {currentCommittee?.committeeCode}
            </div>

            <div style={{ background: "white", borderRadius: "24px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "var(--shadow-md)" }}>
              <table className="rev-table">
                <thead>
                  <tr>
                    <th>Sinh viên</th>
                    <th>Đề tài luận văn</th>
                    <th>Trạng thái hồ sơ</th>
                    <th>Tiến độ duyệt</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRevisions.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>Không tìm thấy hồ sơ nào phù hợp.</td>
                    </tr>
                  ) : (
                    filteredRevisions.map(rev => (
                      <tr key={rev.revisionId}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{rev.proposerStudentName}</span>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>{rev.proposerStudentCode}</span>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Cập nhật: {formatDateTime(rev.lastUpdated)}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155', maxWidth: '400px', lineHeight: 1.4 }}>{rev.topicTitle}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Mã đề tài: {rev.topicCode}</div>
                        </td>
                        <td>
                          <span className={`rev-badge ${getStatusBadgeClass(rev.status)}`}>
                            {rev.status === 'StudentSubmitted' || rev.status === 'Approved' ? <Check size={12} /> : <Clock3 size={12} />}
                            {statusLabels[rev.status] || rev.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <div className={`rev-quorum-dot ${rev.isUvtkApproved ? 'active' : ''}`} title="Thư ký (Bạn) đã duyệt">T</div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'grid', gap: '8px', justifyItems: 'end' }}>
                            {rev.revisionFileUrl ? (
                              <a
                                href={normalizeUrl(rev.revisionFileUrl)}
                                target="_blank"
                                rel="noreferrer"
                                style={{ background: '#eef2ff', color: '#3730a3', border: '1px solid #c7d2fe', padding: '8px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                <Download size={14} /> Tải báo cáo
                              </a>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Chưa có tệp báo cáo</span>
                            )}

                            {rev.revisionFileUrl && currentCommittee?.allowedRevisionActions.some((action) => action === "APPROVE" || action === "REJECT") && (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  className="action-btn btn-reject"
                                  onClick={() => setActiveAction({ revisionId: rev.revisionId, type: 'REJECT' })}
                                >
                                  <XCircle size={14} /> Từ chối
                                </button>
                                <button
                                  type="button"
                                  className="action-btn btn-approve"
                                  onClick={() => setActiveAction({ revisionId: rev.revisionId, type: 'APPROVE' })}
                                >
                                  <CheckCircle2 size={14} /> Duyệt
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* Action Modal */}
      {activeAction && activeRevision && (
        <div className="action-modal-overlay">
          <div className="action-modal">
            <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '12px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: activeAction.type === 'APPROVE' ? '#fff7ed' : '#fef2f2',
                  color: activeAction.type === 'APPROVE' ? '#f37021' : '#ef4444'
                }}>
                  {activeAction.type === 'APPROVE' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    {activeAction.type === 'APPROVE' ? 'Phê duyệt hồ sơ' : 'Từ chối hồ sơ'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Sinh viên: {activeRevision.proposerStudentName}</p>
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', fontSize: '13px', color: '#475569', lineHeight: 1.5, border: '1px solid #e2e8f0' }}>
                <strong>Đề tài:</strong> {activeRevision.topicTitle}
              </div>
            </div>

            <div style={{ padding: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                {activeAction.type === 'APPROVE' ? 'Ghi chú hoặc lời dặn (tùy chọn)' : 'Lý do từ chối (bắt buộc)'}
              </label>
              <textarea
                className="rev-textarea"
                style={{ height: '120px' }}
                placeholder={activeAction.type === 'APPROVE' ? "Nhập lời chúc mừng hoặc dặn dò chỉnh sửa nhỏ..." : "Vui lòng ghi rõ lý do để sinh viên sửa lại..."}
                value={reasonByRevision[activeAction.revisionId] ?? ''}
                onChange={(e) => setReason(activeAction.revisionId, e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ padding: '16px 24px', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setActiveAction(null)}
                disabled={isSubmitting}
                style={{ padding: '10px 20px' }}
              >
                Đóng
              </button>
              <button
                type="button"
                className={`action-btn ${activeAction.type === 'APPROVE' ? 'btn-approve' : 'btn-reject'}`}
                style={{ padding: '10px 24px' }}
                onClick={() => void (activeAction.type === 'APPROVE' ? handleApprove(activeAction.revisionId) : handleReject(activeAction.revisionId))}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
                Xác nhận {activeAction.type === 'APPROVE' ? 'Duyệt' : 'Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerRevisionDashboard;