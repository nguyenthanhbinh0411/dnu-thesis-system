import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  createConcurrencyToken,
  createIdempotencyKey,
  ucError,
  type SessionCode,
  type WorkflowActionTrace,
} from "../../types/defense-workflow-contract";
import { useToast } from "../../context/useToast";
import { FetchDataError, fetchData, normalizeUrl } from "../../api/fetchData";
import type { ApiResponse } from "../../types/api";
import {
  pickCaseInsensitiveValue,
  readEnvelopeAllowedActions,
  readEnvelopeData,
  readEnvelopeErrorMessages,
  readEnvelopeMessage,
  readEnvelopeSuccess,
  readEnvelopeWarningMessages,
  toCompatResponse,
} from "../../utils/api-envelope";
import {
  getActiveDefensePeriodId,
  normalizeDefensePeriodId,
  setActiveDefensePeriodId,
} from "../../utils/defensePeriod";

import {
  ArrowRight,
  Building2,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  ClipboardPen,
  Clock3,
  Download,
  Eraser,
  Eye,
  ExternalLink,
  FileText,
  Gavel,
  Info,
  LayoutDashboard,
  Lock,
  MapPin,
  MessageSquareText,
  PencilRuler,
  Plus,
  Save,
  Star,
  Trash2,
  Undo2,
  Users2,
  XCircle,
  ShieldCheck,
  RefreshCw,
  Loader2,
  X,
  Check,
  Activity,
  Flag,
} from "lucide-react";
import { getAccessToken } from "../../services/auth-session.service";

type Committee = {
  id: string;
  name: string;
  numericId: number;
  room: string;
  session: SessionCode | null;
  date: string | null;
  slot: string | null;
  studentCount: number;
  status: "Sắp diễn ra" | "Đang họp" | "Đã chốt" | "Đã đóng";
  normalizedRole: CommitteeRoleCode;
  roleCode: CommitteeRoleCode;
  roleLabel: string;
  roleRaw: string;
  scoredTopics: number;
  totalTopics: number;
  allowedScoringActions: string[];
  allowedMinuteActions: string[];
  allowedRevisionActions: string[];
  members: CommitteeMemberView[];
};

type CommitteeRoleCode = "CT" | "UVTK" | "UVPB" | "UNKNOWN";

type CommitteeMemberView = {
  memberId: string;
  lecturerCode: string;
  lecturerName: string;
  degree: string | null;
  organization: string | null;
  roleRaw: string;
  roleCode: CommitteeRoleCode;
  roleLabel: string;
};

type RevisionRequest = {
  revisionId: number;
  assignmentId: number | null;
  studentCode: string;
  topicCode: string | null;
  topicTitle: string;
  revisionFileUrl: string | null;
  lastUpdated: string | null;
  status: "pending" | "approved" | "rejected";
  reason?: string;
};

type PanelKey = "councils" | "grading";
type CommitteeDetailTabKey = "overview" | "members" | "topics";
type WorkspaceTabKey = "scoring" | "minutes" | "review";
type CurrentDefensePeriodView = {
  periodId: number;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

type ScoringMatrixRow = {
  committeeId: number;
  committeeCode: string;
  committeeName: string;
  assignmentId: number;
  assignmentCode: string;
  topicCode: string | null;
  topicTitle: string;
  studentCode: string;
  studentName: string;
  supervisorLecturerName: string | null;
  topicTags: string[];
  session: SessionCode | null;
  scheduledAt: string | null;
  startTime: string | null;
  endTime: string | null;
  topicSupervisorScore: number | null;
  scoreGvhd: number | null;
  scoreCt: number | null;
  scoreTk: number | null;
  scorePb: number | null;
  finalScore: number | null;
  finalGrade: string | null;
  variance: number | null;
  isLocked: boolean;
  status: string;
  submittedCount: number;
  requiredCount: number;
  defenseDocuments: DefenseDocument[];
};

type DefenseDocument = {
  documentId: number;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  uploadedAt: string | null;
};

// --- Utils ---

const normalizeCommitteeRole = (value: unknown): CommitteeRoleCode => {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "CT" || raw === "CHAIR" || raw.includes("CHU TICH")) return "CT";
  if (raw === "UVTK" || raw === "TK" || raw === "SECRETARY" || raw.includes("THU KY")) return "UVTK";
  if (raw === "UVPB" || raw === "PB" || raw === "REVIEWER" || raw.includes("PHAN BIEN")) return "UVPB";
  return "UNKNOWN";
};

const mapCommitteeStatus = (value: unknown): Committee["status"] => {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "FINALIZED") return "Đã đóng";
  if (raw === "LOCKED" || raw === "COMPLETED") return "Đã chốt";
  if (raw === "LIVE" || raw === "ONGOING") return "Đang họp";
  return "Sắp diễn ra";
};

const getCommitteeStatusVisual = (status: Committee["status"]) => {
  switch (status) {
    case "Đang họp":
      return { icon: <Activity size={14} />, label: "Đang họp", color: "#ef4444", bg: "#fef2f2", border: "#fecaca" };
    case "Đã chốt":
      return { icon: <Lock size={14} />, label: "Đã chốt điểm", color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" };
    case "Đã đóng":
      return { icon: <Flag size={14} />, label: "Đã đóng", color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" };
    default:
      return { icon: <CalendarDays size={14} />, label: "Sắp diễn ra", color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0" };
  }
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("vi-VN");
};

// --- Component ---

const LecturerCommittees: React.FC = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadingData, setLoadingData] = useState(true);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [periodId, setPeriodId] = useState<number | null>(() => getActiveDefensePeriodId());
  const [currentPeriod, setCurrentPeriod] = useState<CurrentDefensePeriodView | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [detailCommitteeId, setDetailCommitteeId] = useState("");
  const [detailTab, setDetailTab] = useState<CommitteeDetailTabKey>("overview");
  const [scoringMatrix, setScoringMatrix] = useState<ScoringMatrixRow[]>([]);
  
  const filteredCommittees = useMemo(() => {
    const lower = searchTerm.trim().toLowerCase();
    if (!lower) return committees;
    return committees.filter(c => c.name.toLowerCase().includes(lower) || c.id.toLowerCase().includes(lower));
  }, [committees, searchTerm]);

  const committeeStats = useMemo(() => {
    return {
      total: committees.length,
      live: committees.filter(c => c.status === "Đang họp").length,
      locked: committees.filter(c => c.status === "Đã chốt").length,
      upcoming: committees.filter(c => c.status === "Sắp diễn ra").length,
    };
  }, [committees]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const endpoint = periodId ? `/defense-periods/${periodId}/lecturer/snapshot` : "/lecturer-defense/current/snapshot";
      const envelope = await fetchData<ApiResponse<any>>(endpoint);
      if (!envelope.success) throw new Error(envelope.message || "Lỗi tải dữ liệu.");
      
      const data = envelope.data || {};
      const snapshot = data.snapshot || data;
      
      // Robust extraction of committees array from snapshot
      let committeeItems: any[] = [];
      const committeesSource = snapshot.committees || snapshot.Committees || [];
      if (Array.isArray(committeesSource)) {
        committeeItems = committeesSource;
      } else if (committeesSource && typeof committeesSource === "object") {
        committeeItems = committeesSource.committees || committeesSource.Committees || committeesSource.items || committeesSource.Items || [];
      }

      const matrix = snapshot.scoring?.matrix || [];
      
      setScoringMatrix(matrix);
      
      const mapped: Committee[] = (Array.isArray(committeeItems) ? committeeItems : []).map((item: any) => {
        const roleCode = normalizeCommitteeRole(item.normalizedRole || item.RoleCode || item.lecturerRole || item.roleCode || item.Role || "");
        return {
          id: String(item.committeeCode || item.id || ""),
          numericId: Number(item.committeeId || item.numericId || 0),
          name: String(item.committeeName || item.name || ""),
          room: String(item.room || "-"),
          status: mapCommitteeStatus(item.status),
          date: item.defenseDate || item.date || null,
          session: item.session || item.Session || null,
          slot: item.slot || item.Slot || null,
          studentCount: Number(item.studentCount || 0),
          normalizedRole: roleCode,
          roleCode: roleCode,
          roleLabel: String(item.roleLabel || item.RoleLabel || item.lecturerRole || "Thành viên hội đồng"),
          roleRaw: String(item.roleRaw || item.Role || ""),
          scoredTopics: Number(item.scoredTopics || item.ScoredTopics || 0),
          totalTopics: Number(item.totalTopics || item.TotalTopics || item.studentCount || 0),
          allowedScoringActions: Array.isArray(item.allowedScoringActions) ? item.allowedScoringActions : [],
          allowedMinuteActions: Array.isArray(item.allowedMinuteActions) ? item.allowedMinuteActions : [],
          allowedRevisionActions: Array.isArray(item.allowedRevisionActions) ? item.allowedRevisionActions : [],
          members: (item.members || []).map((m: any) => ({
            memberId: String(m.memberId || m.id || ""),
            lecturerCode: String(m.lecturerCode || m.userCode || ""),
            lecturerName: String(m.lecturerName || m.name || ""),
            degree: m.degree || null,
            organization: m.organization || null,
            roleRaw: String(m.roleRaw || m.role || ""),
            roleCode: normalizeCommitteeRole(m.roleCode || m.role || ""),
            roleLabel: String(m.roleLabel || m.role || "Thành viên"),
          }))
        };
      });
      setCommittees(mapped);
      
      if (data.period) {
        setCurrentPeriod({
          periodId: data.period.id,
          name: data.period.name,
          status: data.period.status,
          startDate: data.period.startDate,
          endDate: data.period.endDate
        });
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Lỗi tải danh sách hội đồng", "error");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { loadData(); }, [periodId]);

  const openRoleWorkspace = (committee: Committee) => {
    navigate(`/lecturer/committees/grading?committeeId=${encodeURIComponent(committee.id)}`);
  };

  const detailCommittee = useMemo(() => committees.find(c => c.id === detailCommitteeId), [committees, detailCommitteeId]);
  const detailTopics = useMemo(() => scoringMatrix.filter(m => String(m.committeeCode || m.committeeId) === detailCommitteeId), [scoringMatrix, detailCommitteeId]);

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
          --shadow-md: 0 10px 25px -5px rgba(0,0,0,0.05);
          --shadow-lg: 0 20px 25px -5px rgba(0,0,0,0.1);
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
        }

        .premium-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
          border-color: var(--primary);
        }

        .stat-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 99px;
          font-size: 12px;
          font-weight: 700;
        }

        .progress-bar {
          height: 8px;
          background: #f1f5f9;
          border-radius: 99px;
          overflow: hidden;
          margin: 12px 0;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #f37021, #fb923c);
          border-radius: 99px;
          transition: width 0.5s ease-out;
        }

        .action-btn {
          border-radius: 12px;
          padding: 10px 16px;
          font-weight: 700;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        .btn-primary { background: #f37021; color: white; }
        .btn-primary:hover { background: #ea580c; }
        .btn-ghost { background: #f8fafc; color: var(--text-muted); border: 1px solid #e2e8f0; }
        .btn-ghost:hover { background: #f1f5f9; color: var(--text-main); }
        .btn-disabled { background: #94a3b8; color: white; cursor: not-allowed !important; }

        .modal-overlay {
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
        .modal-content {
          background: white;
          border-radius: 24px;
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: var(--shadow-lg);
          padding: 32px;
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", borderRadius: "24px", padding: "40px", color: "white", marginBottom: "32px", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(243, 112, 33, 0.2)", color: "#fb923c", padding: "6px 14px", borderRadius: "99px", fontSize: "13px", fontWeight: "700", marginBottom: "16px", border: "1px solid rgba(243, 112, 33, 0.3)" }}>
            <ShieldCheck size={14} /> HỘI ĐỒNG BẢO VỆ KHÓA LUẬN
          </div>
          <h1 style={{ fontSize: "32px", fontWeight: "900", margin: "0 0 12px 0", letterSpacing: "-0.02em" }}>Hội đồng <span style={{ color: '#f37021' }}>Của tôi</span></h1>
          <p style={{ fontSize: "16px", color: "#cbd5e1", maxWidth: "600px", lineHeight: "1.6" }}>
            Quản lý và theo dõi các hội đồng bảo vệ khóa luận mà bạn tham gia với các vai trò khác nhau.
          </p>
          <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
            <button onClick={loadData} style={{ background: 'white', color: '#1e293b', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={16} /> Làm mới
            </button>
            <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '10px 20px', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={16} /> {currentPeriod?.name || "Đợt đang hoạt động"}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "32px" }}>
        <div style={{ background: "white", padding: "24px", borderRadius: "20px", border: "1px solid #e2e8f0", boxShadow: "var(--shadow-md)" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: "8px" }}>Tổng hội đồng</div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: "#0f172a" }}>{committeeStats.total}</div>
        </div>
        <div style={{ background: "white", padding: "24px", borderRadius: "20px", border: "1px solid #e2e8f0", boxShadow: "var(--shadow-md)" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: "8px" }}>Đang họp</div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: "#ef4444" }}>{committeeStats.live}</div>
        </div>
        <div style={{ background: "white", padding: "24px", borderRadius: "20px", border: "1px solid #e2e8f0", boxShadow: "var(--shadow-md)" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: "8px" }}>Đã chốt điểm</div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: "#3b82f6" }}>{committeeStats.locked}</div>
        </div>
        <div style={{ background: "white", padding: "24px", borderRadius: "20px", border: "1px solid #e2e8f0", boxShadow: "var(--shadow-md)" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: "8px" }}>Sắp diễn ra</div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: "#22c55e" }}>{committeeStats.upcoming}</div>
        </div>
      </div>

      {/* Search and Grid */}
      <div style={{ background: "white", borderRadius: "20px", padding: "20px", border: "1px solid #e2e8f0", marginBottom: "24px", display: 'flex', alignItems: 'center', gap: '16px' }}>
        <LayoutDashboard size={20} color="#f37021" />
        <input 
          type="text" 
          placeholder="Tìm kiếm mã hoặc tên hội đồng..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', fontWeight: 500 }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "24px" }}>
        {loadingData ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px' }}>
            <Loader2 className="spin" size={48} color="#f37021" style={{ margin: '0 auto' }} />
          </div>
        ) : filteredCommittees.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', background: 'white', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
            <p style={{ color: '#64748b', fontWeight: 500 }}>Không tìm thấy hội đồng nào.</p>
          </div>
        ) : (
          filteredCommittees.map(c => {
            const visual = getCommitteeStatusVisual(c.status);
            return (
              <div key={c.id} className="premium-card" style={{ minHeight: '260px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div style={{ background: '#fff7ed', padding: '10px', borderRadius: '12px' }}>
                    <Users2 size={24} color="#f37021" />
                  </div>
                  <span className="stat-badge" style={{ background: visual.bg, color: visual.color, border: `1px solid ${visual.border}` }}>
                    {visual.icon} {visual.label}
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>{c.id}</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 16px 0', color: '#0f172a' }}>{c.name}</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
                      <CalendarDays size={14} color="#f37021" /> {formatDate(c.date)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
                      <MapPin size={14} color="#f37021" /> {c.room}
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Tiến độ chấm điểm</span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>{c.scoredTopics}/{c.totalTopics} đề tài</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${c.totalTopics > 0 ? (c.scoredTopics / c.totalTopics) * 100 : 0}%`, 
                          height: '100%', 
                          background: 'linear-gradient(90deg, #f37021, #ff8c42)',
                          borderRadius: '4px',
                          transition: 'width 0.5s ease-out'
                        }} 
                      />
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Vai trò</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>{c.roleLabel}</div>
                  </div>
                </div>

                <div style={{ marginTop: '24px', display: 'flex', gap: '10px' }}>
                  <button className="action-btn btn-ghost" style={{ flex: 1 }} onClick={() => setDetailCommitteeId(c.id)}>
                    <Eye size={16} /> Chi tiết
                  </button>
                  {(() => {
                    const canJoin = c.normalizedRole === 'CT' || c.status === 'Đang họp';
                    return (
                      <button 
                        className={`action-btn ${canJoin ? "btn-primary" : "btn-disabled"}`} 
                        style={{ flex: 1.5 }} 
                        onClick={() => canJoin && openRoleWorkspace(c)}
                        disabled={!canJoin}
                      >
                        <Gavel size={16} /> Tham gia hội đồng
                      </button>
                    );
                  })()}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail Modal */}
      {detailCommittee && (
        <div className="modal-overlay" onClick={() => setDetailCommitteeId("")}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900 }}>Hội đồng {detailCommittee.id}</h2>
                <p style={{ margin: '4px 0 0 0', color: '#64748b' }}>{detailCommittee.name}</p>
              </div>
              <button onClick={() => setDetailCommitteeId("")} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
              <button className={`action-btn ${detailTab === 'overview' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setDetailTab('overview')}>Thông tin</button>
              <button className={`action-btn ${detailTab === 'members' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setDetailTab('members')}>Thành viên</button>
              <button className={`action-btn ${detailTab === 'topics' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setDetailTab('topics')}>Danh sách đề tài</button>
            </div>

            <div style={{ minHeight: '300px' }}>
              {detailTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  <div style={{ padding: '20px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Địa điểm</div>
                    <div style={{ fontSize: '16px', fontWeight: 800 }}>{detailCommittee.room}</div>
                  </div>
                  <div style={{ padding: '20px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Thời gian</div>
                    <div style={{ fontSize: '16px', fontWeight: 800 }}>{formatDate(detailCommittee.date)}</div>
                  </div>
                  <div style={{ padding: '20px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Số sinh viên</div>
                    <div style={{ fontSize: '16px', fontWeight: 800 }}>{detailCommittee.studentCount}</div>
                  </div>
                </div>
              )}

              {detailTab === 'members' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {detailCommittee.members.map((m, i) => (
                    <div key={i} style={{ padding: '16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700 }}>{m.lecturerName}</span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#f37021', background: '#fff7ed', padding: '4px 12px', borderRadius: '99px' }}>{m.roleLabel}</span>
                    </div>
                  ))}
                </div>
              )}

              {detailTab === 'topics' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {detailTopics.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Chưa cập nhật danh sách đề tài.</div>
                  ) : (
                    detailTopics.map((t, i) => (
                      <div key={i} style={{ padding: '16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '4px' }}>{t.topicTitle}</div>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>Sinh viên: {t.studentName} ({t.studentCode})</div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                          {t.topicTags.map((tag, j) => (
                            <span key={j} style={{ fontSize: '10px', fontWeight: 700, background: '#e2e8f0', padding: '2px 8px', borderRadius: '4px' }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="action-btn btn-ghost" onClick={() => setDetailCommitteeId("")}>Đóng lại</button>
              {(() => {
                const canJoin = detailCommittee.normalizedRole === 'CT' || detailCommittee.status === 'Đang họp';
                return (
                  <button 
                    className={`action-btn ${canJoin ? "btn-primary" : "btn-disabled"}`} 
                    onClick={() => canJoin && openRoleWorkspace(detailCommittee)}
                    disabled={!canJoin}
                  >
                    Tham gia ngay
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerCommittees;
