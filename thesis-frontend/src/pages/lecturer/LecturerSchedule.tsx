import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { fetchData } from "../../api/fetchData";
import { useAuth } from "../../hooks/useAuth";
import type { LecturerCommitteesResponse } from "../../types/committee-assignment-responses";

interface DefenseSchedule {
  id: number;
  topicCode: string;
  topicTitle: string;
  studentCode: string;
  studentName: string;
  committeeCode: string;
  committeeName: string;
  room: string;
  scheduledAt: string;
  duration: number; // in minutes
  status: "scheduled" | "completed" | "cancelled";
  lecturerRole?: string;
}

const LecturerSchedule: React.FC = () => {
  const auth = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSchedule, setSelectedSchedule] =
    useState<DefenseSchedule | null>(null);
  const [schedules, setSchedules] = useState<DefenseSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchedules = async () => {
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
          // Transform committee data to schedule data
          
          // Build a map to ensure one schedule per committee per date
          const scheduleMap = new Map<string, DefenseSchedule>();

          response.data.committees.forEach((committee, committeeIndex) => {
            if (!committee.defenseDate) return;

            const dateKey = new Date(committee.defenseDate).toISOString().slice(0, 10); // yyyy-mm-dd
            const mapKey = `${committee.committeeCode}_${dateKey}`;

            if (!scheduleMap.has(mapKey)) {
              scheduleMap.set(mapKey, {
                id: parseInt(`${committee.committeeCode.replace(/\D/g, '')}${committeeIndex}`),
                topicCode: committee.assignments?.map(a => a.topicCode).join(', ') || '',
                topicTitle: committee.assignments?.map(a => a.title).join('; ') || '',
                studentCode: committee.assignments?.map(a => a.studentCode).join(', ') || '',
                studentName: committee.assignments?.map(a => a.studentName).join(', ') || '',
                committeeCode: committee.committeeCode,
                committeeName: committee.name || '',
                room: committee.room || '',
                scheduledAt: committee.defenseDate,
                duration: 90, // Default duration for committee defense
                status: getStatusFromDate(committee.defenseDate),
                lecturerRole: committee.members?.find(m => m.lecturerCode === auth.user?.userCode)?.role || "Thành viên"
              });
            }
          });

          setSchedules(Array.from(scheduleMap.values()));
        } else {
          setError("Không thể tải danh sách lịch bảo vệ");
        }
      } catch (err) {
        setError("Lỗi khi tải dữ liệu");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedules();
  }, [auth.user?.userCode]);

  // Helper function to determine status based on date
  const getStatusFromDate = (scheduledAt: string): "scheduled" | "completed" | "cancelled" => {
    const scheduleDate = new Date(scheduledAt);
    const now = new Date();
    
    if (scheduleDate < now) {
      return "completed";
    }
    return "scheduled";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "#F59E0B";
      case "completed":
        return "#22C55E";
      case "cancelled":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "scheduled":
        return "Đã lên lịch";
      case "completed":
        return "Hoàn thành";
      case "cancelled":
        return "Đã hủy";
      default:
        return "Không xác định";
    }
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getSchedulesForMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    return schedules.filter((schedule) => {
      const scheduleDate = new Date(schedule.scheduledAt);
      return (
        scheduleDate.getFullYear() === year && scheduleDate.getMonth() === month
      );
    });
  };

  const getSchedulesForDate = (date: Date) => {
    return schedules.filter((schedule) => {
      const scheduleDate = new Date(schedule.scheduledAt);
      return scheduleDate.toDateString() === date.toDateString();
    });
  };

  const monthSchedules = getSchedulesForMonth();

  if (loading) {
    return (
      <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{ fontSize: "18px", color: "#666" }}>Đang tải lịch bảo vệ...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{ fontSize: "18px", color: "#ef4444" }}>{error}</div>
        </div>
      </div>
    );
  }

  // Generate calendar days
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const calendarDays = getDaysInMonth(currentDate);

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
          <Calendar size={32} color="#F37021" />
          Lịch chấm bảo vệ
        </h1>
        <p style={{ fontSize: "14px", color: "#666" }}>
          Lịch trình bảo vệ luận văn mà bạn tham gia
        </p>
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "20px",
          marginBottom: "32px",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #FFF5F0 0%, #FFE8DC 100%)",
            border: "1px solid #F37021",
            borderRadius: "12px",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <Calendar size={24} color="#F37021" style={{ marginBottom: "8px" }} />
          <div
            style={{
              fontSize: "24px",
              fontWeight: "700",
              color: "#F37021",
              marginBottom: "4px",
            }}
          >
            {monthSchedules.length}
          </div>
          <div style={{ fontSize: "12px", color: "#666" }}>
            Lịch trong tháng
          </div>
        </div>

        <div
          style={{
            background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
            border: "1px solid #F59E0B",
            borderRadius: "12px",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <Clock size={24} color="#F59E0B" style={{ marginBottom: "8px" }} />
          <div
            style={{
              fontSize: "24px",
              fontWeight: "700",
              color: "#F59E0B",
              marginBottom: "4px",
            }}
          >
            {monthSchedules.filter((s) => s.status === "scheduled").length}
          </div>
          <div style={{ fontSize: "12px", color: "#666" }}>Sắp diễn ra</div>
        </div>

        <div
          style={{
            background: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
            border: "1px solid #22C55E",
            borderRadius: "12px",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <GraduationCap
            size={24}
            color="#22C55E"
            style={{ marginBottom: "8px" }}
          />
          <div
            style={{
              fontSize: "24px",
              fontWeight: "700",
              color: "#22C55E",
              marginBottom: "4px",
            }}
          >
            {monthSchedules.filter((s) => s.status === "completed").length}
          </div>
          <div style={{ fontSize: "12px", color: "#666" }}>Đã hoàn thành</div>
        </div>
      </div>

      {/* Calendar */}
      <div
        style={{
          background: "white",
          border: "1px solid #E5E7EB",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}
      >
        {/* Calendar Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <button
            onClick={() => navigateMonth("prev")}
            style={{
              padding: "8px",
              background: "#F3F4F6",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              color: "#374151",
            }}
          >
            <ChevronLeft size={20} />
          </button>

          <h2
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#1a1a1a",
            }}
          >
            {currentDate.toLocaleDateString("vi-VN", {
              month: "long",
              year: "numeric",
            })}
          </h2>

          <button
            onClick={() => navigateMonth("next")}
            style={{
              padding: "8px",
              background: "#F3F4F6",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              color: "#374151",
            }}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Calendar Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "8px",
          }}
        >
          {/* Day headers */}
          {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((day) => (
            <div
              key={day}
              style={{
                padding: "12px",
                textAlign: "center",
                fontSize: "12px",
                fontWeight: "600",
                color: "#666",
                textTransform: "uppercase",
              }}
            >
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map((date, index) => {
            if (!date) {
              return (
                <div
                  key={`empty-${index}`}
                  style={{
                    padding: "12px",
                    minHeight: "80px",
                  }}
                />
              );
            }

            const daySchedules = getSchedulesForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div
                key={date.toISOString()}
                style={{
                  padding: "12px",
                  minHeight: "80px",
                  border: isToday ? "2px solid #F37021" : "1px solid #E5E7EB",
                  borderRadius: "8px",
                  background: isToday ? "#FFF5F0" : "white",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: isToday ? "700" : "500",
                    color: isToday ? "#F37021" : "#1a1a1a",
                    marginBottom: "8px",
                  }}
                >
                  {date.getDate()}
                </div>

                {/* Schedule indicators */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  {daySchedules.slice(0, 3).map((schedule) => (
                    <div
                      key={schedule.id}
                      style={{
                        padding: "4px 6px",
                        background: getStatusColor(schedule.status),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "10px",
                        fontWeight: "600",
                        cursor: "pointer",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      onClick={() => setSelectedSchedule(schedule)}
                      title={`${schedule.committeeName} - ${schedule.topicTitle}`}
                    >
                      {schedule.committeeCode}
                    </div>
                  ))}

                  {daySchedules.length > 3 && (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#666",
                        textAlign: "center",
                        marginTop: "4px",
                      }}
                    >
                      +{daySchedules.length - 3} nữa
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule Detail Modal */}
      {selectedSchedule && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setSelectedSchedule(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "32px",
              maxWidth: "500px",
              width: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "24px",
              }}
            >
              <GraduationCap size={24} color="#F37021" />
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#1a1a1a",
                }}
              >
                Chi tiết lịch bảo vệ
              </h2>
            </div>

            <div style={{ display: "grid", gap: "16px" }}>
              <div>
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#666",
                    textTransform: "uppercase",
                  }}
                >
                  Đề tài bảo vệ
                </label>
                {selectedSchedule.topicTitle.split('; ').map((title, index) => (
                  <p
                    key={index}
                    style={{
                      fontSize: "14px",
                      color: "#1a1a1a",
                      margin: "4px 0",
                      fontWeight: "500",
                    }}
                  >
                    • {title}
                  </p>
                ))}
                <p style={{ fontSize: "12px", color: "#666", margin: "2px 0" }}>
                  Mã đề tài: {selectedSchedule.topicCode}
                </p>
              </div>

              <div>
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#666",
                    textTransform: "uppercase",
                  }}
                >
                  Sinh viên
                </label>
                {selectedSchedule.studentName.split(', ').map((name, index) => (
                  <p
                    key={index}
                    style={{
                      fontSize: "14px",
                      color: "#1a1a1a",
                      margin: "4px 0",
                    }}
                  >
                    • {name} ({selectedSchedule.studentCode.split(', ')[index]})
                  </p>
                ))}
              </div>

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
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#666",
                      textTransform: "uppercase",
                    }}
                  >
                    Thời gian
                  </label>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#1a1a1a",
                      margin: "4px 0",
                    }}
                  >
                    {new Date(selectedSchedule.scheduledAt).toLocaleDateString(
                      "vi-VN",
                      {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </p>
                  <p
                    style={{ fontSize: "12px", color: "#666", margin: "2px 0" }}
                  >
                    Thời lượng: {selectedSchedule.duration} phút
                  </p>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#666",
                      textTransform: "uppercase",
                    }}
                  >
                    Địa điểm
                  </label>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#1a1a1a",
                      margin: "4px 0",
                    }}
                  >
                    Phòng {selectedSchedule.room}
                  </p>
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#666",
                    textTransform: "uppercase",
                  }}
                >
                  Hội đồng
                </label>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#1a1a1a",
                    margin: "4px 0",
                  }}
                >
                  {selectedSchedule.committeeName}
                </p>
                <p style={{ fontSize: "12px", color: "#666", margin: "2px 0" }}>
                  Mã hội đồng: {selectedSchedule.committeeCode}
                </p>
                {selectedSchedule.lecturerRole && (
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#F37021",
                      margin: "2px 0",
                      fontWeight: "600",
                    }}
                  >
                    Vai trò: {selectedSchedule.lecturerRole}
                  </p>
                )}
              </div>

              <div>
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#666",
                    textTransform: "uppercase",
                  }}
                >
                  Trạng thái
                </label>
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 8px",
                    background: getStatusColor(selectedSchedule.status) + "20",
                    color: getStatusColor(selectedSchedule.status),
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    marginTop: "4px",
                  }}
                >
                  {getStatusText(selectedSchedule.status)}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                marginTop: "24px",
              }}
            >
              <button
                style={{
                  padding: "8px 16px",
                  background: "#6B7280",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
                onClick={() => setSelectedSchedule(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerSchedule;
