import React, { useEffect, useState } from "react";
import {
  Calendar,
  Users,
  MapPin,
  GraduationCap,
  AlertCircle,
  User,
} from "lucide-react";
import { committeeAssignmentApi } from "../../api/committeeAssignmentApi";
import type { StudentDefenseInfoDto } from "../../types/committee-assignment";

const StudentDefenseInfo: React.FC = () => {
  const [data, setData] = useState<StudentDefenseInfoDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDefenseInfo = async () => {
      try {
        // Try to read current user/student code from localStorage (app_user.userCode) to match other pages
        let studentCode: string | undefined;
        try {
          const raw = typeof window !== 'undefined' ? window.localStorage.getItem('app_user') : null;
          if (raw) {
            const parsed = JSON.parse(raw) as { userCode?: string } | null;
            studentCode = parsed?.userCode;
          }
        } catch {
          // ignore parse errors
        }

        if (!studentCode) {
          setError('Không tìm thấy mã sinh viên (vui lòng đăng nhập)');
          setLoading(false);
          return;
        }

        const response = await committeeAssignmentApi.getStudentDefense(studentCode);
        // response is ApiResponse<StudentDefenseInfoDto>
        if (response && (response as any).success && (response as any).data) {
          setData((response as any).data as StudentDefenseInfoDto);
        } else {
          setError(((response as any)?.message as string) || 'Không thể tải thông tin bảo vệ');
        }
      } catch (err) {
        console.error('fetchDefenseInfo error', err);
        setError('Lỗi khi tải dữ liệu');
      } finally {
        setLoading(false);
      }
    };
    void fetchDefenseInfo();
  }, []);

  if (loading) {
    return <div>Đang tải...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  const hasDefenseScheduled = data && data.committee;

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
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
          <GraduationCap size={32} color="#F37021" />
          Thông tin Bảo vệ đò án tốt nghiệp
        </h1>
        <p style={{ fontSize: "14px", color: "#666" }}>
          Xem lịch bảo vệ và thông tin hội đồng của bạn
        </p>
      </div>
      <div
        style={{
          background: "linear-gradient(135deg, #FFF5F0 0%, #FFE8DC 100%)",
          border: "1px solid #F37021",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "32px",
          display: "flex",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #F37021 0%, #FF8838 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "32px",
            fontWeight: "700",
            boxShadow: "0 4px 12px rgba(243, 112, 33, 0.3)",
          }}
        >
          {data?.studentCode.charAt(0)}
        </div>
        <div>
          <h2
            style={{
              fontSize: "22px",
              fontWeight: "600",
              color: "#1a1a1a",
              marginBottom: "6px",
            }}
          >
            {data?.studentCode}
          </h2>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>
            Mã sinh viên: <strong>{data?.studentCode}</strong>
          </p>
          {data?.title && (
            <p style={{ fontSize: "14px", color: "#666" }}>
              Đề tài: <strong>{data.title}</strong>
            </p>
          )}
        </div>
      </div>

      {/* Defense Schedule */}
      {!hasDefenseScheduled ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 20px",
            background: "linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%)",
            borderRadius: "12px",
            border: "2px dashed #E5E7EB",
          }}
        >
          <Calendar size={64} color="#CCC" style={{ marginBottom: "16px" }} />
          <h3
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#333",
              marginBottom: "8px",
            }}
          >
            Ôi, đề tài của bạn chưa đủ điều kiện bảo vệ! 😊
          </h3>
          <p style={{ color: "#666" }}>
            Đừng lo lắng nhé! Lịch bảo vệ của bạn chưa được sắp xếp. Hãy tiếp tục hoàn thiện đề tài và liên hệ với giảng viên hướng dẫn để được hỗ trợ thêm. Chúc bạn cố gắng! 💪
          </p>
        </div>
      ) : (
        <>
          {/* Defense Schedule Card */}
          <div
            style={{
              background: "white",
              border: "2px solid #F37021",
              borderRadius: "12px",
              padding: "32px",
              marginBottom: "24px",
              boxShadow: "0 8px 24px rgba(243, 112, 33, 0.15)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "24px",
              }}
            >
              <Calendar size={28} color="#F37021" />
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#1a1a1a",
                }}
              >
                Lịch Bảo vệ
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "24px",
              }}
            >
              <div
                style={{
                  padding: "20px",
                  background:
                    "linear-gradient(135deg, #FFF5F0 0%, #FFE8DC 100%)",
                  borderRadius: "8px",
                  border: "1px solid #F37021",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <Calendar size={18} color="#F37021" />
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#666",
                      textTransform: "uppercase",
                    }}
                  >
                    Thời gian
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#1a1a1a",
                  }}
                >
                  {data.committee?.defenseDate ? new Date(data.committee.defenseDate).toLocaleString("vi-VN", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }) : "Chưa có"}
                </p>
                {data.committee?.startTime && data.committee?.endTime && (
                  <p style={{ fontSize: "14px", color: "#666", marginTop: "4px" }}>
                    {data.committee.startTime} - {data.committee.endTime}
                  </p>
                )}
              </div>

              {data.committee?.room && (
                <div
                  style={{
                    padding: "20px",
                    background:
                      "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
                    borderRadius: "8px",
                    border: "1px solid #3B82F6",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    <MapPin size={18} color="#3B82F6" />
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      Địa điểm
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: "18px",
                      fontWeight: "600",
                      color: "#1a1a1a",
                    }}
                  >
                    Phòng {data.committee.room}
                  </p>
                </div>
              )}

              {data.committee && (
                <div
                  style={{
                    padding: "20px",
                    background:
                      "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
                    borderRadius: "8px",
                    border: "1px solid #22C55E",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    <Users size={18} color="#22C55E" />
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#666",
                        textTransform: "uppercase",
                      }}
                    >
                      Hội đồng
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#1a1a1a",
                    }}
                  >
                    {data.committee.name}
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      marginTop: "4px",
                    }}
                  >
                    {data.committee.committeeCode}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Committee Members */}
          {data.committee &&
            data.committee.members &&
            data.committee.members.length > 0 && (
              <div
                style={{
                  background: "white",
                  border: "1px solid #E5E7EB",
                  borderRadius: "12px",
                  padding: "32px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "24px",
                  }}
                >
                  <Users size={28} color="#F37021" />
                  <h2
                    style={{
                      fontSize: "20px",
                      fontWeight: "600",
                      color: "#1a1a1a",
                    }}
                  >
                    Thành viên Hội đồng
                  </h2>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {data.committee.members.map((member, index) => (
                    <div
                      key={index}
                      style={{
                        padding: "20px",
                        background: "#F9FAFB",
                        border: "2px solid #E5E7EB",
                        borderRadius: "12px",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-4px)";
                        e.currentTarget.style.boxShadow =
                          "0 8px 16px rgba(0,0,0,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          marginBottom: "12px",
                        }}
                      >
                        <div
                          style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "50%",
                            background: "#E5E7EB",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontWeight: "600",
                            fontSize: "18px",
                          }}
                        >
                          <User size={24} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p
                            style={{
                              fontSize: "16px",
                              fontWeight: "600",
                              color: "#1a1a1a",
                            }}
                          >
                            {member.name}
                          </p>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            padding: "6px 12px",
                            background: member.role === "Chủ tịch" ? "linear-gradient(135deg, #F37021 0%, #FF8838 100%)" : "white",
                            color: member.role === "Chủ tịch" ? "white" : "#666",
                            border: member.role === "Chủ tịch" ? "none" : "1px solid #E5E7EB",
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontWeight: "600",
                            textAlign: "center",
                          }}
                        >
                          {member.role}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Preparation Note */}
          <div
            style={{
              marginTop: "24px",
              padding: "20px",
              background: "#FEF3C7",
              border: "1px solid #FCD34D",
              borderRadius: "8px",
            }}
          >
            <h3
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#92400E",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertCircle size={18} />
              Lưu ý quan trọng
            </h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: "20px",
                fontSize: "13px",
                color: "#92400E",
                lineHeight: "1.8",
              }}
            >
              <li>Vui lòng có mặt trước giờ bảo vệ ít nhất 15 phút</li>
              <li>Chuẩn bị file thuyết trình</li>
              <li>Ăn mặc lịch sự, trang trọng</li>
              <li>Kiểm tra thiết bị trình chiếu trước khi bắt đầu</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default StudentDefenseInfo;
