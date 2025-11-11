import React, { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { fetchData } from "../../api/fetchData";
import { useAuth } from "../../hooks/useAuth";
import type { StudentDefenseInfoDto } from "../../types/committee-assignment-responses";
import type { ApiResponse } from "../../types/api";

interface ScheduleEvent {
  id: number;
  title: string;
  date: string;
  time: string;
  location: string;
  type: "defense" | "meeting" | "presentation";
  description: string;
  participants?: string[];
}

const Schedule: React.FC = () => {
  const auth = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventPopup, setShowEventPopup] = useState(false);
  const [selectedEventsForPopup, setSelectedEventsForPopup] = useState<
    ScheduleEvent[]
  >([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([
    {
      id: 1,
      title: "Đăng ký đề tài",
      date: "2026-01-15",
      time: "23:59",
      location: "Hệ thống trực tuyến",
      type: "meeting",
      description:
        "Sinh viên lựa chọn và đăng ký đề tài khóa luận, điền thông tin chi tiết và chờ giảng viên hướng dẫn phê duyệt.",
    },
    {
      id: 2,
      title: "Nộp báo cáo tiến độ lần 1",
      date: "2026-02-28",
      time: "23:59",
      location: "Hệ thống trực tuyến",
      type: "meeting",
      description:
        "Sinh viên nộp báo cáo tiến độ lần 1, mô tả tình hình thực hiện, khó khăn và kế hoạch tiếp theo.",
    },
    {
      id: 3,
      title: "Nộp báo cáo tiến độ lần 2",
      date: "2026-04-15",
      time: "23:59",
      location: "Hệ thống trực tuyến",
      type: "meeting",
      description:
        "Sinh viên nộp báo cáo tiến độ lần 2, trình bày kết quả đạt được và hoàn thiện các nội dung còn thiếu.",
    },
    {
      id: 4,
      title: "Nộp khóa luận hoàn chỉnh",
      date: "2026-05-20",
      time: "23:59",
      location: "Hệ thống trực tuyến",
      type: "meeting",
      description:
        "Sinh viên hoàn thiện và nộp toàn bộ khóa luận đúng quy định về hình thức và nội dung.",
    },
    {
      id: 5,
      title: "Bảo vệ khóa luận",
      date: "2026-06-10",
      time: "09:00 - 11:00",
      location: "Phòng A201",
      type: "defense",
      description:
        "Sinh viên chuẩn bị slide, thuyết trình và tham gia buổi bảo vệ khóa luận trước hội đồng.",
    },
    {
      id: 6,
      title: "Họp hướng dẫn định kỳ",
      date: "2026-04-20",
      time: "14:00 - 15:30",
      location: "Phòng B102",
      type: "meeting",
      description: "Báo cáo tiến độ và trao đổi với giảng viên hướng dẫn",
    },
    {
      id: 7,
      title: "Thuyết trình tiến độ",
      date: "2026-05-05",
      time: "10:00 - 11:00",
      location: "Hội trường A",
      type: "presentation",
      description: "Thuyết trình tiến độ đồ án trước khoa",
    },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDefenseInfo = async () => {
      if (!auth.user?.userCode) {
        setLoading(false);
        return;
      }

      try {
        const response: ApiResponse<StudentDefenseInfoDto> = await fetchData(
          `/CommitteeAssignment/student-defense/${auth.user.userCode}`
        );

        if (response.success && response.data?.committee?.defenseDate) {
          // Format time from TimeSpan strings (e.g., "09:00:00" -> "09:00")
          const formatTime = (timeStr?: string) => {
            if (!timeStr) return "";
            return timeStr.split(':').slice(0, 2).join(':');
          };

          const startTime = formatTime(response.data.committee.startTime);
          const endTime = formatTime(response.data.committee.endTime);
          const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : "09:00 - 11:00";

          // Update the defense event with real data
          setEvents(prevEvents =>
            prevEvents.map(event =>
              event.id === 5 // "Bảo vệ khóa luận" event
                ? {
                    ...event,
                    date: response.data!.committee!.defenseDate!,
                    time: timeRange,
                    location: response.data!.committee!.room || "Phòng A201",
                    description: `Sinh viên chuẩn bị slide, thuyết trình và tham gia buổi bảo vệ khóa luận "${response.data!.title}" trước hội đồng ${response.data!.committee!.name}.`,
                    participants: response.data!.committee!.members?.map((m: { name: string; role: string }) => m.name) || []
                  }
                : event
            )
          );
        }
      } catch (err) {
        console.error("Failed to fetch defense info:", err);
        // Keep default events if API fails
      } finally {
        setLoading(false);
      }
    };

    fetchDefenseInfo();
  }, [auth.user?.userCode]);

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "defense":
        return { bg: "#dcfce7", border: "#22c55e", text: "#166534" };
      case "meeting":
        return { bg: "#fff5f0", border: "#f37021", text: "#9a3412" };
      case "presentation":
        return { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" };
      default:
        return { bg: "#f3f4f6", border: "#9ca3af", text: "#374151" };
    }
  };

  const getEventTypeText = (type: string) => {
    switch (type) {
      case "defense":
        return "Bảo vệ";
      case "meeting":
        return "Họp";
      case "presentation":
        return "Thuyết trình";
      default:
        return "Khác";
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add actual days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const hasEvent = (date: Date) => {
    return events.some((event) => {
      const eventDate = new Date(event.date);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.date);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const previousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  };

  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
  };

  const handleEventClick = (event: ScheduleEvent) => {
    const eventDate = new Date(event.date);
    setCurrentDate(new Date(eventDate.getFullYear(), eventDate.getMonth(), 1));
  };

  const handleDateClick = (date: Date) => {
    const eventsForDate = getEventsForDate(date);
    if (eventsForDate.length > 0) {
      setSelectedEventsForPopup(eventsForDate);
      setShowEventPopup(true);
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const days = getDaysInMonth(currentDate);
  const upcomingEvents = events
    .filter((event) => new Date(event.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (loading) {
    return (
      <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{ fontSize: "18px", color: "#666" }}>Đang tải lịch bảo vệ...</div>
        </div>
      </div>
    );
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
          <CalendarIcon size={32} color="#f37021" />
          Lịch bảo vệ
        </h1>
        <p style={{ fontSize: "14px", color: "#666" }}>
          Xem lịch bảo vệ và các sự kiện liên quan đến đồ án
        </p>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}
      >
        {/* Calendar */}
        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "32px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
            border: "2px solid #f0f0f0",
            height: "690px",
            display: "flex",
            flexDirection: "column",
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
              onClick={previousMonth}
              style={{
                padding: "8px",
                border: "none",
                background: "#f37021",
                color: "#fff",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronLeft size={20} />
            </button>
            <h2
              style={{ fontSize: "20px", fontWeight: "600", color: "#1a1a1a" }}
            >
              Tháng {currentDate.getMonth() + 1}, {currentDate.getFullYear()}
            </h2>
            <button
              onClick={nextMonth}
              style={{
                padding: "8px",
                border: "none",
                background: "#f37021",
                color: "#fff",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Calendar Grid */}
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((day) => (
                <div
                  key={day}
                  style={{
                    textAlign: "center",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#666",
                    padding: "8px",
                  }}
                >
                  {day}
                </div>
              ))}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: "8px",
              }}
            >
              {days.map((date, index) => (
                <div
                  key={index}
                  onClick={() => date && handleDateClick(date)}
                  style={{
                    minHeight: "80px",
                    padding: "8px",
                    border: date ? "1px solid #e5e7eb" : "none",
                    borderRadius: "8px",
                    backgroundColor: date
                      ? isToday(date)
                        ? "#fff5f0"
                        : hasEvent(date)
                        ? "#dcfce7"
                        : "#fff"
                      : "transparent",
                    cursor: date ? "pointer" : "default",
                    position: "relative",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (date) {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow =
                        "0 4px 12px rgba(0,0,0,0.1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (date) {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }
                  }}
                >
                  {date && (
                    <>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: isToday(date) ? "700" : "500",
                          color: isToday(date) ? "#f37021" : "#333",
                          marginBottom: "4px",
                        }}
                      >
                        {date.getDate()}
                      </div>
                      {hasEvent(date) && (
                        <div
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            backgroundColor: "#22c55e",
                            margin: "0 auto",
                          }}
                        />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming Events */}
        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "32px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
            border: "2px solid #f0f0f0",
            height: "690px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#1a1a1a",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Clock size={24} color="#f37021" />
            Sự kiện sắp tới
          </h2>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              flex: 1,
              overflowY: "auto",
              paddingRight: "8px",
            }}
          >
            {upcomingEvents.map((event) => {
              const colors = getEventTypeColor(event.type);
              return (
                <div
                  key={event.id}
                  style={{
                    padding: "16px",
                    background: colors.bg,
                    border: `2px solid ${colors.border}`,
                    borderRadius: "12px",
                    transition: "all 0.3s ease",
                    cursor: "pointer",
                  }}
                  onClick={() => handleEventClick(event)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 12px rgba(0,0,0,0.1)";
                    e.currentTarget.style.borderColor = "#f37021";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      padding: "4px 8px",
                      backgroundColor: colors.border,
                      color: "#fff",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: "600",
                      marginBottom: "8px",
                    }}
                  >
                    {getEventTypeText(event.type)}
                  </span>
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#1a1a1a",
                      marginBottom: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    {event.title}
                    <span
                      style={{
                        fontSize: "12px",
                        color: colors.border,
                        fontWeight: "500",
                      }}
                    >
                      Nhấn để xem
                    </span>
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      color: "#666",
                      marginBottom: "4px",
                    }}
                  >
                    <CalendarIcon size={14} />
                    {new Date(event.date).toLocaleDateString("vi-VN")}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      color: "#666",
                      marginBottom: "4px",
                    }}
                  >
                    <Clock size={14} />
                    {event.time}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      color: "#666",
                      marginBottom: "8px",
                    }}
                  >
                    <MapPin size={14} />
                    {event.location}
                  </div>
                  {event.participants && event.participants.length > 0 && (
                    <div
                      style={{
                        marginTop: "8px",
                        paddingTop: "8px",
                        borderTop: `1px solid ${colors.border}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "12px",
                          color: "#666",
                          marginBottom: "4px",
                        }}
                      >
                        <Users size={14} />
                        Thành viên:
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#333",
                          paddingLeft: "20px",
                        }}
                      >
                        {event.participants.join(", ")}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Event Popup */}
      {showEventPopup && selectedEventsForPopup.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setShowEventPopup(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "600px",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
              border: "2px solid #f0f0f0",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <h2
                style={{
                  fontSize: "24px",
                  fontWeight: "700",
                  color: "#1a1a1a",
                  margin: 0,
                }}
              >
                Chi tiết sự kiện
              </h2>
              <button
                onClick={() => setShowEventPopup(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#666",
                  padding: "4px",
                  borderRadius: "4px",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f0f0f0";
                  e.currentTarget.style.color = "#333";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#666";
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              {selectedEventsForPopup.map((event) => {
                const colors = getEventTypeColor(event.type);
                return (
                  <div
                    key={event.id}
                    style={{
                      padding: "20px",
                      background: colors.bg,
                      border: `2px solid ${colors.border}`,
                      borderRadius: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "16px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: "600",
                          color: "#1a1a1a",
                          flex: 1,
                        }}
                      >
                        {event.title}
                      </div>
                      <span
                        style={{
                          padding: "6px 12px",
                          backgroundColor: colors.border,
                          color: "#fff",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "600",
                          marginLeft: "16px",
                        }}
                      >
                        {getEventTypeText(event.type)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "14px",
                        color: "#666",
                        marginBottom: "8px",
                      }}
                    >
                      <CalendarIcon size={16} />
                      {new Date(event.date).toLocaleDateString("vi-VN")}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "14px",
                        color: "#666",
                        marginBottom: "16px",
                      }}
                    >
                      <Clock size={16} />
                      {event.time}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "14px",
                        color: "#666",
                        marginBottom: "16px",
                      }}
                    >
                      <MapPin size={16} />
                      {event.location}
                    </div>

                    <div
                      style={{
                        fontSize: "15px",
                        color: "#333",
                        lineHeight: "1.6",
                        padding: "16px",
                        background: "#fff",
                        borderRadius: "8px",
                        border: `1px solid ${colors.border}20`,
                      }}
                    >
                      {event.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;
