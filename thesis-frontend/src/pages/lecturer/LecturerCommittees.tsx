import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Users, GraduationCap, MapPin, Eye, X } from "lucide-react";
import { fetchData } from "../../api/fetchData";
import { useAuth } from "../../hooks/useAuth";
import type { LecturerCommitteeItem } from "../../types/committee-assignment";
import type { LecturerCommitteesResponse } from "../../types/committee-assignment-responses";

// ModalShell Component
interface ModalShellProps {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  subtitle?: string;
  wide?: boolean;
}

function ModalShell({ children, onClose, title, subtitle, wide }: ModalShellProps) {
  const widthClass = wide ? "max-w-[980px]" : "max-w-[760px]";

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      <motion.div
        className="absolute inset-0 bg-[#0F1C3F]/65 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={onClose}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        className={`relative flex max-h-[90vh] w-full ${widthClass} flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_30px_70px_rgba(15,28,63,0.18)] ring-1 ring-[#E5ECFB]`}
        style={{ fontFamily: '"Inter","Poppins",sans-serif' }}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-white/98 px-8 py-5 border-b border-[#EAF1FF]">
          <div className="flex min-w-0 flex-col gap-0">
            <span className="text-xs font-bold tracking-wide text-[#1F3C88]">
              {title}
            </span>
            {subtitle && <p className="text-sm text-[#4A5775]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-md border border-transparent bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#e65f2f] transition"
          >
            <X size={16} />
            Đóng
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-8 pb-8 pt-6">{children}</div>
      </motion.div>
    </div>
  );
}

const LecturerCommittees: React.FC = () => {
  const auth = useAuth();
  const [committees, setCommittees] = useState<LecturerCommitteeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommittee, setSelectedCommittee] = useState<LecturerCommitteeItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Function to calculate days until defense
  const getDaysUntilDefense = (defenseDate: string | null) => {
    if (!defenseDate) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const defense = new Date(defenseDate);
    defense.setHours(0, 0, 0, 0);
    
    const diffTime = defense.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  // Function to get countdown display
  const getCountdownDisplay = (days: number | null) => {
    if (days === null) return null;
    
    if (days < 0) {
      return { text: `Đã diễn ra ${Math.abs(days)} ngày`, color: "#6B7280" };
    } else if (days === 0) {
      return { text: "Hôm nay", color: "#1F3C88" };
    } else if (days === 1) {
      return { text: "Ngày mai", color: "#F59E0B" };
    } else if (days <= 7) {
      return { text: `${days} ngày nữa`, color: "#F59E0B" };
    } else {
      return { text: `${days} ngày nữa`, color: "#10B981" };
    }
  };

  useEffect(() => {
    const fetchCommittees = async () => {
      if (!auth.user?.userCode) {
        setError("Không tìm thấy mã người dùng");
        setLoading(false);
        return;
      }

      try {
        const response = await fetchData<LecturerCommitteesResponse>(
          `/CommitteeAssignment/lecturer-committees/${auth.user.userCode}`
        );
        if (response.success && response.data) {
          setCommittees(response.data.committees);
        } else {
          setError("Không thể tải danh sách hội đồng");
        }
      } catch (err) {
        setError("Lỗi khi tải dữ liệu");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCommittees();
  }, []);

  // viewing details is not implemented in this component; details API call available if needed

  if (loading) {
    return <div>Đang tải...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: "700",
            color: "#1a1a1a",
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <Users size={32} color="#1F3C88" />
          Hội đồng Bảo vệ của tôi
        </h1>
        <p style={{ fontSize: "14px", color: "#666" }}>
          Xem danh sách các hội đồng bạn tham gia và đề tài cần bảo vệ
        </p>
      </div>

      {/* Committees List */}
      {committees.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            textAlign: "center",
            padding: "80px 20px",
            background: "linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%)",
            borderRadius: "12px",
            border: "2px dashed #E5E7EB",
          }}
        >
          <Users size={64} color="#CCC" style={{ marginBottom: "16px" }} />
          <h3
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#333",
              marginBottom: "8px",
            }}
          >
            Chưa có hội đồng bảo vệ
          </h3>
          <p style={{ color: "#666" }}>
            Hiện tại bạn chưa được phân công tham gia hội đồng bảo vệ nào. Vui
            lòng liên hệ với khoa để được hỗ trợ.
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{ display: "grid", gap: "24px" }}
        >
          {committees.map((committee, index) => (
            <motion.div
              key={committee.committeeCode}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              style={{
                background: "white",
                border: "1px solid #E5E7EB",
                borderRadius: "12px",
                padding: "24px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 8px 24px rgba(31, 60, 136, 0.15)";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.borderColor = "#1F3C88";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "#E5E7EB";
              }}
            >
              {/* Committee Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                  marginBottom: "16px",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "8px",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 12px",
                        background:
                          "linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)",
                        color: "#1F3C88",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                      }}
                    >
                      {committee.committeeCode}
                    </span>
                    {committee.tags && committee.tags.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: "4px",
                          flexWrap: "wrap",
                        }}
                      >
                        {committee.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag.tagCode}
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              background: "#E3F2FD",
                              color: "#1976D2",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: "500",
                            }}
                          >
                            {tag.tagName}
                          </span>
                        ))}
                        {committee.tags.length > 2 && (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              background: "#E3F2FD",
                              color: "#1976D2",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: "500",
                            }}
                          >
                            +{committee.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                    {committee.members &&
                      committee.members.find(
                        (m) => m.lecturerCode === auth.user?.userCode
                      ) && (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 12px",
                            background: committee.members.find(
                              (m) => m.lecturerCode === auth.user?.userCode
                            )?.isChair
                              ? "linear-gradient(135deg, #1F3C88 0%, #0F1C3F 100%)"
                              : "linear-gradient(135deg, #10B981 0%, #34D399 100%)",
                            color: "white",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        >
                          {
                            committee.members.find(
                              (m) => m.lecturerCode === auth.user?.userCode
                            )?.role
                          }
                        </span>
                      )}
                  </div>
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: "600",
                      color: "#1a1a1a",
                      marginBottom: "12px",
                    }}
                  >
                    {committee.name}
                  </h3>
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}
                  >
                    {committee.defenseDate && (() => {
                      const days = getDaysUntilDefense(committee.defenseDate || null);
                      const countdown = getCountdownDisplay(days);
                      const isUrgent = days !== null && days >= 0 && days <= 7;
                      const isToday = days === 0;
                      
                      return (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px 12px",
                            background: isToday 
                              ? "linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)"
                              : isUrgent
                              ? "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)"
                              : "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
                            border: `2px solid ${isToday ? "#1F3C88" : isUrgent ? "#F59E0B" : "#10B981"}`,
                            borderRadius: "8px",
                            boxShadow: isToday || isUrgent ? "0 2px 8px rgba(31, 60, 136, 0.2)" : "none",
                          }}
                        >
                          <Calendar size={16} color={isToday ? "#1F3C88" : isUrgent ? "#F59E0B" : "#10B981"} />
                          <span style={{ 
                            fontSize: "13px", 
                            color: isToday ? "#1F3C88" : isUrgent ? "#D97706" : "#047857",
                            fontWeight: "700"
                          }}>
                            {new Date(committee.defenseDate).toLocaleDateString(
                              "vi-VN",
                              {
                                weekday: "short",
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </span>
                          {countdown && (
                            <span style={{ 
                              fontSize: "12px", 
                              color: isToday ? "#1F3C88" : isUrgent ? "#D97706" : "#047857",
                              fontWeight: "600",
                              background: "rgba(255,255,255,0.8)",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              marginLeft: "4px"
                            }}>
                              {countdown.text}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    {committee.room && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <MapPin size={16} color="#1F3C88" />
                        <span style={{ fontSize: "13px", color: "#666" }}>
                          Phòng {committee.room}
                        </span>
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <GraduationCap size={16} color="#1F3C88" />
                      <span style={{ fontSize: "13px", color: "#666" }}>
                        {committee.assignments?.length || 0} đề tài
                      </span>
                    </div>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    padding: "8px 16px",
                    background: "#1F3C88",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                  onClick={() => {
                    setSelectedCommittee(committee);
                    setIsModalOpen(true);
                  }}
                >
                  <Eye size={16} />
                  Xem Chi Tiết
                </motion.button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Detail Modal */}
      {isModalOpen && selectedCommittee && (
        <ModalShell
          title={`Chi tiết hội đồng: ${selectedCommittee.name}`}
          subtitle={selectedCommittee.committeeCode}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedCommittee(null);
          }}
          wide
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Basic Info */}
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#1a1a1a", marginBottom: "16px" }}>
                Thông tin cơ bản
              </h3>
              <div style={{ display: "grid", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>Mã hội đồng:</span>
                  <span style={{ fontWeight: "600" }}>{selectedCommittee.committeeCode}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>Tên hội đồng:</span>
                  <span style={{ fontWeight: "600" }}>{selectedCommittee.name}</span>
                </div>
                {selectedCommittee.defenseDate && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#666" }}>Ngày bảo vệ:</span>
                    <span style={{ fontWeight: "600" }}>
                      {new Date(selectedCommittee.defenseDate).toLocaleDateString("vi-VN", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                )}
                {selectedCommittee.room && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#666" }}>Phòng:</span>
                    <span style={{ fontWeight: "600" }}>Phòng {selectedCommittee.room}</span>
                  </div>
                )}
                {selectedCommittee.tags && selectedCommittee.tags.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#666" }}>Tags:</span>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {selectedCommittee.tags.map((tag) => (
                        <span
                          key={tag.tagCode}
                          style={{
                            display: "inline-block",
                            padding: "4px 8px",
                            background: "#E3F2FD",
                            color: "#1976D2",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: "500",
                          }}
                        >
                          {tag.tagName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Members Section */}
            {selectedCommittee.members && selectedCommittee.members.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#1a1a1a", marginBottom: "16px" }}>
                  Thành viên hội đồng ({selectedCommittee.members.length})
                </h3>
                <div style={{ display: "grid", gap: "12px" }}>
                  {selectedCommittee.members.map((member) => (
                    <motion.div
                      key={member.lecturerCode}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{
                        background: "#F9FAFB",
                        border: "1px solid #E5E7EB",
                        borderRadius: "8px",
                        padding: "16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: "600", color: "#1a1a1a", fontSize: "16px" }}>
                          {member.fullName}
                        </div>
                        <div style={{ fontSize: "14px", color: "#666", marginTop: "4px" }}>
                          {member.degree} • {member.lecturerCode}
                        </div>
                        {member.tagNames && member.tagNames.length > 0 && (
                          <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
                            {member.tagNames.join(", ")}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            padding: "6px 12px",
                            background: member.isChair
                              ? "linear-gradient(135deg, #1F3C88 0%, #0F1C3F 100%)"
                              : member.lecturerCode === auth.user?.userCode
                              ? "linear-gradient(135deg, #10B981 0%, #34D399 100%)"
                              : "#E5E7EB",
                            color: member.isChair || member.lecturerCode === auth.user?.userCode ? "white" : "#666",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        >
                          {member.role}
                          {member.lecturerCode === auth.user?.userCode && " (Bạn)"}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Topics Section */}
            {selectedCommittee.assignments && selectedCommittee.assignments.length > 0 && (
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#1a1a1a", marginBottom: "16px" }}>
                  Đề tài bảo vệ ({selectedCommittee.assignments.length})
                </h3>
                <div style={{ display: "grid", gap: "16px" }}>
                  {selectedCommittee.assignments.map((topic, index) => (
                    <motion.div
                      key={topic.topicCode}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      style={{
                        background: "#F9FAFB",
                        border: "1px solid #E5E7EB",
                        borderRadius: "8px",
                        padding: "16px",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#E3F2FD";
                        e.currentTarget.style.borderColor = "#1F3C88";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#F9FAFB";
                        e.currentTarget.style.borderColor = "#E5E7EB";
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "8px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 8px",
                            background: "white",
                            border: "1px solid #E5E7EB",
                            color: "#666",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        >
                          {topic.topicCode}
                        </span>
                        {topic.session && (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 8px",
                              background: "#E3F2FD",
                              color: "#1976D2",
                              borderRadius: "4px",
                              fontSize: "12px",
                              fontWeight: "600",
                            }}
                          >
                            Phiên {topic.session === 1 ? "Sáng" : "Chiều"}
                          </span>
                        )}
                      </div>
                      <h4 style={{ fontSize: "16px", fontWeight: "600", color: "#1a1a1a", marginBottom: "8px" }}>
                        {topic.title}
                      </h4>
                      {topic.studentName && (
                        <p style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>
                          <strong>Sinh viên:</strong> {topic.studentName} ({topic.studentCode})
                        </p>
                      )}
                      {topic.supervisorName && (
                        <p style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>
                          <strong>Giảng viên hướng dẫn:</strong> {topic.supervisorName} ({topic.supervisorCode})
                        </p>
                      )}
                      {(topic.startTime || topic.endTime) && (
                        <p style={{ fontSize: "14px", color: "#666" }}>
                          <strong>Thời gian:</strong> {topic.startTime} - {topic.endTime}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </ModalShell>
      )}
    </div>
  );
};

export default LecturerCommittees;
