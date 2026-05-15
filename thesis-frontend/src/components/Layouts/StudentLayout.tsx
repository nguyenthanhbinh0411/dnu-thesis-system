import React, { useEffect, useState } from "react";
import StudentNav from "../SideNavs/StudentNav";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  LogOut,
  ChevronDown,
  User,
  Menu,
  X,
  KeyRound,
} from "lucide-react";
import { fetchData, getAvatarUrl } from "../../api/fetchData";
import type { ApiResponse } from "../../types/api";
import type { StudentProfile } from "../../types/studentProfile";
import ChatWidget from "../chat/ChatWidget.tsx";
import NotificationBell from "../notifications/NotificationBell";
import {
  getActiveDefensePeriodId,
  setActiveDefensePeriodId,
} from "../../utils/defensePeriod";
import { fetchCurrentDefensePeriod } from "../../services/current-defense-period.service";

const StudentLayout: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [studentImage, setStudentImage] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [headerPeriod, setHeaderPeriod] = useState<{
    label: string;
    tone: "normal" | "warning" | "error";
    tooltip: string;
  }>(() => {
    const cachedPeriodId = getActiveDefensePeriodId();
    if (cachedPeriodId) {
      return {
        label: `Đợt #${cachedPeriodId}`,
        tone: "normal",
        tooltip: `Đợt đang dùng: #${cachedPeriodId}`,
      };
    }

    return {
      label: "Đang xác định đợt",
      tone: "normal",
      tooltip: "Hệ thống đang tự động xác định đợt đồ án tốt nghiệp hiện tại.",
    };
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const sidebarWidth = isSidebarCollapsed ? 84 : 260;
  const collapseSidebarOnActivity = () => {
    if (window.innerWidth > 768) {
      setIsSidebarCollapsed(true);
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!auth.user?.userCode) return;
        const res = await fetchData(
          `/StudentProfiles/get-list?UserCode=${auth.user.userCode}`,
        );
        const data = (res as ApiResponse<StudentProfile[]>)?.data || [];
        if (data.length > 0) {
          setProfile(data[0]);
          if (data[0].studentImage) {
            setStudentImage(data[0].studentImage as string);
          }
        }
      } catch (err) {
        console.error("Error loading student profile:", err);
      }
    };
    loadProfile();
  }, [auth.user?.userCode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest("[data-dropdown]")) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  useEffect(() => {
    let cancelled = false;

    const bootstrapCurrentPeriod = async () => {
      try {
        const result = await fetchCurrentDefensePeriod("student");
        if (cancelled) {
          return;
        }

        if (result.ok) {
        const periodName = result.period.name || `Đợt ${result.period.periodId}`;
        setActiveDefensePeriodId(result.period.periodId);
        setHeaderPeriod({
          label: `${periodName} (#${result.period.periodId})`,
          tone: "normal",
          tooltip: `Đợt hiện tại: ${periodName} (#${result.period.periodId})`,
        });
        return;
      }

      if (result.code === "NOT_MAPPED") {
        setActiveDefensePeriodId(null);
        setHeaderPeriod({
          label: "Chưa có mapping đợt",
          tone: "warning",
          tooltip: result.message,
        });
        return;
      }

      if (result.code === "AMBIGUOUS" || result.code === "INVALID_CONTRACT") {
        setActiveDefensePeriodId(null);
        setHeaderPeriod({
          label: result.code === "AMBIGUOUS" ? "Dữ liệu đợt mơ hồ" : "Snapshot đợt không hợp lệ",
          tone: "error",
          tooltip: result.message,
        });
        return;
      }

      const cachedPeriodId = getActiveDefensePeriodId();
      if (cachedPeriodId) {
        setHeaderPeriod({
          label: `Đợt #${cachedPeriodId} (cache)`,
          tone: "warning",
          tooltip: result.message,
        });
        return;
      }

      setHeaderPeriod({
        label: "Không xác định đợt",
        tone: "error",
        tooltip: result.message,
      });
      } catch (error) {
        if (cancelled) return;

        setHeaderPeriod({
          label: "Không xác định đợt",
          tone: "error",
          tooltip: "Không thể kết nối hệ thống.",
        });
      }
    };

    void bootstrapCurrentPeriod();

    return () => {
      cancelled = true;
    };
  }, []);

  const headerPeriodStyle =
    headerPeriod.tone === "error"
      ? {
          borderColor: "rgba(220, 38, 38, 0.25)",
          backgroundColor: "rgba(220, 38, 38, 0.08)",
          textColor: "#b91c1c",
          dotColor: "#dc2626",
        }
      : headerPeriod.tone === "warning"
        ? {
            borderColor: "rgba(245, 158, 11, 0.35)",
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            textColor: "#92400e",
            dotColor: "#f59e0b",
          }
        : {
            borderColor: "rgba(243, 112, 33, 0.2)",
            backgroundColor: "rgba(243, 112, 33, 0.1)",
            textColor: "#f37021",
            dotColor: "#f37021",
          };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#FFFFFF",
        fontFamily: '"Be Vietnam Pro", "Segoe UI", sans-serif',
      }}
    >
      <style>
        {`
          /* Responsive Styles */
          @media (max-width: 768px) {
            .student-sidebar {
              transform: translateX(-100%);
              transition: transform 0.3s ease;
            }
            
            .student-sidebar.open {
              transform: translateX(0);
            }
            
            .student-main {
              margin-left: 0 !important;
            }
            
            .student-header {
              left: 0 !important;
              padding: 10px 12px !important;
              height: 60px !important;
            }
            
            .student-header > div:first-child > div:last-child {
              display: none !important;
            }
            
            .student-mobile-logo {
              display: flex !important;
            }
            
            .student-status-badge {
              display: none !important;
            }

            .student-period-badge {
              max-width: 150px !important;
              padding: 6px 10px !important;
            }

            .student-period-badge .period-text {
              font-size: 11px !important;
            }
            
            .mobile-menu-btn {
              display: flex !important;
            }
            
            .mobile-close-btn {
              display: flex !important;
            }
            
            .student-content {
              padding: 12px !important;
              margin-bottom: 60px;
            }
            
            .student-avatar-section {
              padding: 6px 12px !important;
              border-radius: 12px !important;
              gap: 8px !important;
            }
            
            .student-avatar-section img,
            .student-avatar-section > div:first-child {
              width: 32px !important;
              height: 32px !important;
            }
            
            .student-avatar-section .user-name {
              font-size: 13px !important;
              max-width: 100px !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
              white-space: nowrap !important;
            }
            
            .student-avatar-section .user-code {
              display: none !important;
            }
          }

          .student-period-badge {
            max-width: 280px;
            min-width: 0;
          }

          .student-period-badge .period-text {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          
          @media (min-width: 769px) and (max-width: 1024px) {
            .student-sidebar {
              width: 220px !important;
            }
            
            .student-main {
              margin-left: 220px !important;
            }
            
            .student-header {
              left: 220px !important;
            }
          }

          .student-sidebar,
          .student-main,
          .student-header,
          .student-sidebar img,
          .student-sidebar .sidebar-brand-text,
          .student-sidebar .sidebar-footer-text {
            transition: width 0.28s ease, margin-left 0.28s ease, left 0.28s ease, opacity 0.24s ease, transform 0.24s ease, margin 0.28s ease;
          }

          .student-sidebar .sidebar-brand-text,
          .student-sidebar .sidebar-footer-text {
            will-change: opacity, transform;
          }

          .student-sidebar.collapsed .sidebar-brand-text,
          .student-sidebar.collapsed .sidebar-footer-text {
            opacity: 0;
            transform: translateY(-8px) scale(0.96);
            pointer-events: none;
          }
        `}
      </style>
      <aside
        className={`student-sidebar ${isMobileMenuOpen ? "open" : ""} ${isSidebarCollapsed ? "collapsed" : ""}`}
        style={{
          width: sidebarWidth,
          backgroundColor: "#FFFFFF",
          color: "#002855",
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid #E5E7EB",
          boxShadow: "2px 0 8px rgba(0, 0, 0, 0.05)",
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: 30,
        }}
      >
        <div
          style={{
            textAlign: "center",
            padding: "24px 18px",
            background:
              "linear-gradient(180deg, rgba(243, 112, 33, 0.05) 0%, #FFFFFF 100%)",
            borderBottom: "1px solid #E5E7EB",
            position: "relative",
          }}
        >
          {isSidebarCollapsed && (
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(false)}
              title="Mở rộng thanh nav"
              aria-label="Mở rộng thanh nav"
              style={{
                position: "absolute",
                top: "14px",
                left: "50%",
                transform: "translateX(-50%)",
                width: 38,
                height: 38,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                border: "1px solid rgba(255, 255, 255, 0.3)",
                background:
                  "linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255,255,255,0.06) 100%)",
                color: "#FFFFFF",
                boxShadow: "0 6px 16px rgba(0, 0, 0, 0.18)",
                cursor: "pointer",
                flexShrink: 0,
                backdropFilter: "blur(8px)",
              }}
            >
              <Menu size={18} strokeWidth={2.5} />
            </button>
          )}

          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="mobile-close-btn"
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              display: "none",
              background: "rgba(243, 112, 33, 0.1)",
              border: "1px solid rgba(243, 112, 33, 0.2)",
              borderRadius: "8px",
              padding: "8px",
              cursor: "pointer",
              color: "#F37021",
              transition: "all 0.2s ease",
            }}
          >
            <X size={20} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (isSidebarCollapsed) {
                setIsSidebarCollapsed(false);
              }
            }}
            aria-label="Mở rộng thanh nav"
            title={isSidebarCollapsed ? "Mở rộng thanh nav" : "Logo Đại học Đại Nam"}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              margin: 0,
              cursor: isSidebarCollapsed ? "pointer" : "default",
              display: "block",
              width: "100%",
            }}
          >
            <img
              src={isSidebarCollapsed ? "/favicon_dnu.png" : "/dnu_logo.png"}
              alt="Đại học Đại Nam"
              style={{
                width: isSidebarCollapsed ? 44 : 90,
                display: "block",
                margin: isSidebarCollapsed ? "16px auto 10px" : "0 auto 14px",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                transition:
                  "transform 0.3s ease, width 0.28s ease, margin 0.28s ease, opacity 0.24s ease",
              }}
              onMouseEnter={(e) => {
                if (isSidebarCollapsed) {
                  e.currentTarget.style.transform = "scale(1.06)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            />
          </button>
          <h3
            className="sidebar-brand-text"
            style={{
              color: "#F37021",
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 4,
              letterSpacing: "0.5px",
              opacity: isSidebarCollapsed ? 0 : 1,
              transform: isSidebarCollapsed
                ? "translateY(-8px) scale(0.96)"
                : "translateY(0) scale(1)",
              maxHeight: isSidebarCollapsed ? 0 : 40,
              overflow: "hidden",
              transition:
                "opacity 0.24s ease, transform 0.24s ease, max-height 0.28s ease",
            }}
          >
            Vai trò: <strong style={{ color: "#F37021" }}>Sinh viên</strong>
          </h3>
          <p
            className="sidebar-brand-text"
            style={{
              fontSize: 12,
              color: "#6B7280",
              margin: 0,
              fontWeight: 500,
              opacity: isSidebarCollapsed ? 0 : 1,
              transform: isSidebarCollapsed
                ? "translateY(-8px) scale(0.96)"
                : "translateY(0) scale(1)",
              maxHeight: isSidebarCollapsed ? 0 : 28,
              overflow: "hidden",
              transition:
                "opacity 0.24s ease, transform 0.24s ease, max-height 0.28s ease",
            }}
          >
            Đại học Đại Nam
          </p>
        </div>

        <div
          style={{ flex: 1, padding: "12px 16px", overflowY: "auto" }}
        >
          <StudentNav
            collapsed={isSidebarCollapsed}
            onNavigate={() => setIsMobileMenuOpen(false)}
          />
        </div>

        <footer
          className="sidebar-footer-text"
          style={{
            fontSize: 11,
            color: "#6B7280",
            textAlign: "center",
            padding: "18px 12px",
            borderTop: "1px solid #E5E7EB",
            opacity: isSidebarCollapsed ? 0 : 1,
            transform: isSidebarCollapsed ? "translateY(8px)" : "translateY(0)",
            maxHeight: isSidebarCollapsed ? 0 : 80,
            overflow: "hidden",
            transition: "opacity 0.24s ease, transform 0.24s ease, max-height 0.28s ease",
          }}
        >
          © 2025 Đại học Đại Nam
        </footer>
      </aside>

      <main
        className="student-main"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          marginLeft: sidebarWidth,
          transition: "margin-left 0.28s ease",
        }}
      >
        <header
          className="student-header"
          style={{
            backgroundColor: "#FFFFFF",
            padding: "18px 36px",
            boxShadow: "0 2px 12px rgba(0, 0, 0, 0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#1a2736",
            position: "fixed",
            left: sidebarWidth,
            right: 0,
            top: 0,
            height: 72,
            zIndex: 20,
            borderBottom: "1px solid #E5E7EB",
            background: "linear-gradient(135deg, #ffffff 0%, #fefefe 100%)",
            transition: "left 0.28s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{
                display: "none",
                background: "rgba(243, 112, 33, 0.1)",
                border: "1px solid rgba(243, 112, 33, 0.2)",
                borderRadius: "8px",
                padding: "8px",
                cursor: "pointer",
                color: "#F37021",
              }}
              className="mobile-menu-btn"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              className="student-status-badge"
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                backgroundColor: "rgba(243, 112, 33, 0.1)",
                border: "1px solid rgba(243, 112, 33, 0.2)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#f37021",
                  boxShadow: "0 0 8px rgba(197, 110, 34, 0.4)",
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  color: "#f37021",
                  fontWeight: 600,
                  letterSpacing: "0.3px",
                }}
              >
                Sinh viên
              </span>
            </div>

            <div
              className="student-period-badge"
              title={headerPeriod.tooltip}
              style={{
                padding: "8px 14px",
                borderRadius: "20px",
                border: `1px solid ${headerPeriodStyle.borderColor}`,
                backgroundColor: headerPeriodStyle.backgroundColor,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: headerPeriodStyle.dotColor,
                }}
              />
              <span
                className="period-text"
                style={{
                  fontSize: 12,
                  color: headerPeriodStyle.textColor,
                  fontWeight: 600,
                  letterSpacing: "0.2px",
                }}
              >
                {headerPeriod.label}
              </span>
            </div>

            <NotificationBell theme="student" />

            <ChatWidget theme="student" />

            <div style={{ position: "relative" }} data-dropdown>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="student-avatar-section"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  background:
                    "linear-gradient(135deg, #ffffff 0%, #fefefe 100%)",
                  border: "1px solid #e5e7eb",
                  padding: "8px 16px",
                  borderRadius: "16px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#f37021";
                  e.currentTarget.style.boxShadow =
                    "0 4px 16px rgba(243, 112, 33, 0.15)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e5e7eb";
                  e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(0, 0, 0, 0.04)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {studentImage ? (
                  <img
                    src={getAvatarUrl(studentImage)}
                    alt={profile?.fullName || "avatar"}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      objectFit: "cover",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      border: "2px solid rgba(243, 112, 33, 0.1)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #f37021, #ff8c42)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(243, 112, 33, 0.2)",
                      color: "#ffffff",
                      fontSize: "18px",
                      fontWeight: 700,
                    }}
                  >
                    {profile?.fullName ? profile.fullName.charAt(0) : "S"}
                  </div>
                )}
                <ChevronDown
                  size={16}
                  style={{
                    color: "#64748b",
                    transition: "transform 0.3s ease, color 0.3s ease",
                    transform: showDropdown ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </button>

              {showDropdown && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    background:
                      "linear-gradient(135deg, #ffffff 0%, #fefefe 100%)",
                    border: "1px solid #e5e7eb",
                    borderRadius: "16px",
                    boxShadow:
                      "0 10px 25px rgba(0, 0, 0, 0.1), 0 6px 16px rgba(243, 112, 33, 0.08)",
                    minWidth: "240px",
                    zIndex: 1000,
                    marginTop: "12px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "20px",
                      borderBottom: "1px solid #e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      background:
                        "linear-gradient(135deg, rgba(243, 112, 33, 0.02) 0%, rgba(243, 112, 33, 0.01) 100%)",
                    }}
                  >
                    {studentImage ? (
                      <img
                        src={getAvatarUrl(studentImage)}
                        alt={profile?.fullName || "avatar"}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          objectFit: "cover",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                          border: "2px solid rgba(243, 112, 33, 0.15)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          background:
                            "linear-gradient(135deg, #f37021, #ff8c42)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(243, 112, 33, 0.2)",
                          color: "#ffffff",
                          fontSize: "20px",
                          fontWeight: 700,
                        }}
                      >
                        {profile?.fullName ? profile.fullName.charAt(0) : "S"}
                      </div>
                    )}

                    <div style={{ flex: 1 }}>
                      <div
                        className="user-name"
                        style={{
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "#1a2736",
                          marginBottom: "4px",
                          lineHeight: "1.2",
                        }}
                      >
                        {profile?.fullName || "Sinh viên"}
                      </div>
                      <div
                        className="user-code"
                        style={{
                          fontSize: "13px",
                          color: "#64748b",
                          fontWeight: 500,
                        }}
                      >
                        Mã SV: {profile?.studentCode || ""}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#f37021",
                          fontWeight: 600,
                          marginTop: "2px",
                        }}
                      >
                        Vai trò: Sinh viên
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: "8px" }}>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        navigate("/student/profile");
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        width: "100%",
                        padding: "14px 18px",
                        background: "none",
                        border: "none",
                        borderRadius: "12px",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: "14px",
                        color: "#374151",
                        fontWeight: 500,
                        transition: "all 0.3s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "rgba(243, 112, 33, 0.08)";
                        e.currentTarget.style.color = "#f37021";
                        e.currentTarget.style.transform = "translateX(4px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#374151";
                        e.currentTarget.style.transform = "translateX(0)";
                      }}
                    >
                      <User size={18} color="#64748b" />
                      Thông tin sinh viên
                    </button>

                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        navigate("/student/change-password");
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        width: "100%",
                        padding: "14px 18px",
                        background: "none",
                        border: "none",
                        borderRadius: "12px",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: "14px",
                        color: "#374151",
                        fontWeight: 500,
                        transition: "all 0.3s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "rgba(243, 112, 33, 0.08)";
                        e.currentTarget.style.color = "#f37021";
                        e.currentTarget.style.transform = "translateX(4px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#374151";
                        e.currentTarget.style.transform = "translateX(0)";
                      }}
                    >
                      <KeyRound size={18} color="#64748b" />
                      Đổi mật khẩu
                    </button>

                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        auth.logout();
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        width: "100%",
                        padding: "14px 18px",
                        background: "none",
                        border: "none",
                        borderRadius: "12px",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: "14px",
                        color: "#dc2626",
                        fontWeight: 500,
                        transition: "all 0.3s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "rgba(220, 38, 38, 0.08)";
                        e.currentTarget.style.transform = "translateX(4px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.transform = "translateX(0)";
                      }}
                    >
                      <LogOut size={18} color="#dc2626" />
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div
          className="student-content"
          style={{
            flex: 1,
            padding: 20,
            backgroundColor: "#FFFFFF",
            marginTop: 72,
            height: "calc(100vh - 72px)",
            overflowY: "auto",
          }}
          // onPointerUpCapture={collapseSidebarOnActivity}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default StudentLayout;
