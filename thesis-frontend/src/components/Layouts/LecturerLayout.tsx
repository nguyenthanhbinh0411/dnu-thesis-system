import React, { useEffect, useState } from "react";
import LecturerNav from "../SideNavs/LecturerNav";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  LogOut,
  ChevronDown,
  User,
  Clock,
  Menu,
  X,
  KeyRound,
} from "lucide-react";
import { fetchData, getAvatarUrl } from "../../api/fetchData";
import type { ApiResponse } from "../../types/api";
import type { LecturerProfile } from "../../types/lecturer-profile";
import ChatWidget from "../chat/ChatWidget.tsx";
import NotificationBell from "../notifications/NotificationBell";
import {
  getActiveDefensePeriodId,
  setActiveDefensePeriodId,
} from "../../utils/defensePeriod";
import { fetchCurrentLecturerDefenseAccess } from "../../services/current-defense-period.service";

const LecturerLayout: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<LecturerProfile | null>(null);
  const [lecturerImage, setLecturerImage] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [canViewDefenseMenus, setCanViewDefenseMenus] = useState(false);
  const [canViewRevisionMenu, setCanViewRevisionMenu] = useState(false);
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
          `/LecturerProfiles/get-list?UserCode=${auth.user.userCode}`,
        );
        const data = (res as ApiResponse<LecturerProfile[]>)?.data || [];
        if (data.length > 0) {
          setProfile(data[0]);
          if (data[0].profileImage) {
            setLecturerImage(data[0].profileImage as string);
          }
        }
      } catch (err) {
        console.error("Error loading lecturer profile:", err);
      }
    };
    loadProfile();
  }, [auth.user?.userCode]);

  // Update current time every minute
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date());
    };

    updateTime();

    const timer = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // Close dropdown when clicking outside
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
        const result = await fetchCurrentLecturerDefenseAccess();
        if (cancelled) {
          return;
        }

        if (result.ok) {
        setCanViewDefenseMenus(result.hasCommitteeAccess);
        setCanViewRevisionMenu(result.isSecretary && result.hasPendingRevisions);
        const periodName = result.period.name || `Đợt ${result.period.periodId}`;
        setActiveDefensePeriodId(result.period.periodId);
        setHeaderPeriod({
          label: `${periodName} (#${result.period.periodId})`,
          tone: "normal",
          tooltip: `Đợt hiện tại: ${periodName} (#${result.period.periodId})`,
        });
        return;
      }

      setCanViewDefenseMenus(false);
      setCanViewRevisionMenu(false);

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

        setCanViewDefenseMenus(false);
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
          borderColor: "rgba(248, 113, 113, 0.45)",
          backgroundColor: "rgba(127, 29, 29, 0.45)",
          textColor: "#fecaca",
          dotColor: "#f87171",
        }
      : headerPeriod.tone === "warning"
        ? {
            borderColor: "rgba(251, 191, 36, 0.5)",
            backgroundColor: "rgba(146, 64, 14, 0.35)",
            textColor: "#fde68a",
            dotColor: "#fbbf24",
          }
        : {
            borderColor: "rgba(243, 112, 33, 0.5)",
            backgroundColor: "rgba(243, 112, 33, 0.2)",
            textColor: "#ffedd5",
            dotColor: "#fdba74",
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
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.7;
              transform: scale(1.1);
            }
          }
          
          /* Responsive Styles */
          @media (max-width: 768px) {
            .lecturer-sidebar {
              transform: translateX(-100%);
              transition: transform 0.3s ease;
            }
            
            .lecturer-sidebar.open {
              transform: translateX(0);
            }
            
            .lecturer-main {
              margin-left: 0 !important;
            }
            
            .lecturer-header {
              left: 0 !important;
              padding: 10px 12px !important;
              height: 60px !important;
            }
            
            /* Hide time display on mobile */
            .lecturer-header > div:last-child > div:first-child {
              display: none !important;
            }
            
            /* Hide status badge on mobile */
            .lecturer-status-badge {
              display: none !important;
            }

            .lecturer-period-badge {
              max-width: 150px !important;
              padding: 6px 10px !important;
            }

            .lecturer-period-badge .period-text {
              font-size: 11px !important;
            }
            
            .lecturer-header h3 {
              font-size: 14px !important;
            }
            
            .mobile-menu-btn {
              display: flex !important;
            }
            
            .mobile-close-btn {
              display: flex !important;
            }
            
            .lecturer-content {
              padding: 16px !important;
              margin-bottom: 60px;
            }
            
            /* Avatar section responsive */
            .lecturer-avatar-section {
              padding: 6px 12px !important;
              border-radius: 12px !important;
              gap: 8px !important;
            }
            
            .lecturer-avatar-section img,
            .lecturer-avatar-section > div:first-child {
              width: 32px !important;
              height: 32px !important;
            }
            
            .lecturer-avatar-section .user-name {
              font-size: 13px !important;
              max-width: 100px !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
              white-space: nowrap !important;
            }
            
            .lecturer-avatar-section .user-code {
              display: none !important;
            }
          }

          .lecturer-period-badge {
            max-width: 320px;
            min-width: 0;
          }

          .lecturer-period-badge .period-text {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          
          @media (min-width: 769px) and (max-width: 1024px) {
            .lecturer-sidebar {
              width: 220px !important;
            }
            
            .lecturer-main {
              margin-left: 220px !important;
            }
            
            .lecturer-header {
              left: 220px !important;
            }
          }

          .lecturer-sidebar,
          .lecturer-main,
          .lecturer-header,
          .lecturer-sidebar img,
          .lecturer-sidebar .sidebar-brand-text,
          .lecturer-sidebar .sidebar-footer-text {
            transition: width 0.28s ease, margin-left 0.28s ease, left 0.28s ease, opacity 0.24s ease, transform 0.24s ease, margin 0.28s ease;
          }

          .lecturer-sidebar .sidebar-brand-text,
          .lecturer-sidebar .sidebar-footer-text {
            will-change: opacity, transform;
          }

          .lecturer-sidebar.collapsed .sidebar-brand-text,
          .lecturer-sidebar.collapsed .sidebar-footer-text {
            opacity: 0;
            transform: translateY(-8px) scale(0.96);
            pointer-events: none;
          }
        `}
      </style>
      <aside
        className={`lecturer-sidebar ${isMobileMenuOpen ? "open" : ""} ${isSidebarCollapsed ? "collapsed" : ""}`}
        style={{
          width: sidebarWidth,
          backgroundColor: "#002855",
          color: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "2px 0 8px rgba(0, 0, 0, 0.15)",
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
              "linear-gradient(180deg, rgba(243, 112, 33, 0.12) 0%, rgba(0, 40, 85, 0.95) 100%)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
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
                zIndex: 40,
                transform: "translateX(-50%)",
                flexShrink: 0,
                backdropFilter: "blur(8px)",
              }}
            >
              <Menu size={18} strokeWidth={2.5} />
            </button>
          )}

          {/* Close Button for Mobile */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="mobile-close-btn"
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              display: "none",
              background: "rgba(255, 255, 255, 0.1)",
              border: "none",
              borderRadius: "8px",
              padding: "8px",
              cursor: "pointer",
              color: "white",
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
            Vai trò: <strong style={{ color: "#F37021" }}>Giảng viên</strong>
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
          <LecturerNav
            collapsed={isSidebarCollapsed}
            onNavigate={() => setIsMobileMenuOpen(false)}
            showDefenseMenus={canViewDefenseMenus}
            showRevisionMenu={canViewRevisionMenu}
          />
        </div>

        <footer
          className="sidebar-footer-text"
          style={{
            fontSize: 11,
            color: "#94a3b8",
            textAlign: "center",
            padding: "18px 12px",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            background: "rgba(0, 0, 0, 0.2)",
            opacity: isSidebarCollapsed ? 0 : 1,
            transform: isSidebarCollapsed ? "translateY(8px)" : "translateY(0)",
            maxHeight: isSidebarCollapsed ? 0 : 80,
            overflow: "hidden",
            transition:
              "opacity 0.24s ease, transform 0.24s ease, max-height 0.28s ease",
          }}
        >
          © 2025 Đại học Đại Nam
        </footer>
      </aside>

      <main
        className="lecturer-main"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          marginLeft: sidebarWidth,
          transition: "margin-left 0.28s ease",
        }}
      >
        <header
          className="lecturer-header"
          style={{
            background:
              "linear-gradient(135deg, #002855 0%, #003d7a 30%, #f37021 70%, #e55a0f 100%)",
            padding: "16px 32px",
            boxShadow:
              "0 4px 20px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#FFFFFF",
            position: "fixed",
            left: sidebarWidth,
            right: 0,
            top: 0,
            height: 80,
            zIndex: 20,
            borderBottom: "2px solid rgba(243, 112, 33, 0.3)",
            backdropFilter: "blur(10px)",
            transition: "left 0.28s ease",
          }}
        >
          {/* Left Section - Title and Profile Info */}
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{
                display: "none",
                background: "rgba(255, 255, 255, 0.1)",
                border: "none",
                borderRadius: "8px",
                padding: "8px",
                cursor: "pointer",
                color: "white",
              }}
              className="mobile-menu-btn"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

          </div>

          {/* Right Section - Time and User Menu */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            {/* Current Time - Hidden on mobile */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "20px",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(10px)",
              }}
            >
              <Clock size={16} color="#fff" />
              <span
                style={{
                  fontSize: 13,
                  color: "#FFFFFF",
                  fontWeight: 600,
                  fontFamily: "monospace",
                }}
              >
                {currentTime.toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "#e2e8f0",
                  fontWeight: 500,
                }}
              >
                {currentTime.toLocaleDateString("vi-VN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>

            {/* Status Badge - Hidden on mobile */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "20px",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(10px)",
              }}
              className="lecturer-status-badge"
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#fff",
                  boxShadow: "0 0 10px rgba(243, 112, 33, 0.5)",
                  animation: "pulse 2s infinite",
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  color: "#fff",
                  fontWeight: 600,
                  letterSpacing: "0.3px",
                }}
              >
                Giảng viên
              </span>
            </div>

            <div
              className="lecturer-period-badge"
              title={headerPeriod.tooltip}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 14px",
                borderRadius: "20px",
                backgroundColor: headerPeriodStyle.backgroundColor,
                border: `1px solid ${headerPeriodStyle.borderColor}`,
                backdropFilter: "blur(10px)",
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

            <NotificationBell theme="lecturer" />

            <ChatWidget theme="lecturer" />

            <div style={{ position: "relative" }} data-dropdown>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="lecturer-avatar-section"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  background:
                    "linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  padding: "8px 16px",
                  borderRadius: "16px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(243, 112, 33, 0.5)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 16px rgba(243, 112, 33, 0.2)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor =
                    "rgba(255, 255, 255, 0.2)";
                  e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(0, 0, 0, 0.1)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {lecturerImage ? (
                  <img
                    src={getAvatarUrl(lecturerImage)}
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
                      background:
                        "linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(243, 112, 33, 0.1))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      color: "#ffffff",
                      fontSize: "18px",
                      fontWeight: 700,
                    }}
                  >
                    {profile?.fullName ? profile.fullName.charAt(0) : "G"}
                  </div>
                )}
                <ChevronDown
                  size={16}
                  style={{
                    color: "#ffffff",
                    transition: "transform 0.3s ease, color 0.3s ease",
                    transform: showDropdown ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    background:
                      "linear-gradient(135deg, rgba(0, 40, 85, 0.95), rgba(0, 61, 122, 0.9))",
                    border: "1px solid rgba(243, 112, 33, 0.3)",
                    borderRadius: "16px",
                    boxShadow:
                      "0 10px 25px rgba(0, 0, 0, 0.3), 0 6px 16px rgba(243, 112, 33, 0.1)",
                    minWidth: "240px",
                    zIndex: 1000,
                    marginTop: "12px",
                    overflow: "hidden",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <div
                    style={{
                      padding: "20px",
                      borderBottom: "1px solid rgba(243, 112, 33, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      background:
                        "linear-gradient(135deg, rgba(243, 112, 33, 0.08), rgba(243, 112, 33, 0.04))",
                    }}
                  >
                    {/* Avatar */}
                    {lecturerImage ? (
                      <img
                        src={getAvatarUrl(lecturerImage)}
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
                            "linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(243, 112, 33, 0.1))",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                          color: "#ffffff",
                          fontSize: "20px",
                          fontWeight: 700,
                        }}
                      >
                        {profile?.fullName ? profile.fullName.charAt(0) : "G"}
                      </div>
                    )}

                    {/* User Info */}
                    <div style={{ flex: 1 }}>
                      <div
                        className="user-name"
                        style={{
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "#FFFFFF",
                          marginBottom: "4px",
                          textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
                        }}
                      >
                        {profile?.fullName || "Giảng viên"}
                      </div>
                      <div
                        className="user-code"
                        style={{
                          fontSize: "12px",
                          color: "#e2e8f0",
                          fontWeight: 500,
                        }}
                      >
                        {profile?.degree} - {profile?.departmentCode}
                      </div>

                    </div>
                  </div>

                  <div style={{ padding: "8px" }}>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        navigate("/lecturer/profile");
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
                        color: "#e2e8f0",
                        fontWeight: 500,
                        transition: "all 0.3s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "rgba(243, 112, 33, 0.15)";
                        e.currentTarget.style.color = "#f37021";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#e2e8f0";
                      }}
                    >
                      <User size={18} color="#6B7280" />
                      Thông tin giảng viên
                    </button>

                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        navigate("/lecturer/change-password");
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
                        color: "#e2e8f0",
                        fontWeight: 500,
                        transition: "all 0.3s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "rgba(243, 112, 33, 0.15)";
                        e.currentTarget.style.color = "#f37021";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#e2e8f0";
                      }}
                    >
                      <KeyRound size={18} color="#6B7280" />
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
                          "rgba(220, 38, 38, 0.1)";
                        e.currentTarget.style.color = "#B91C1C";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#dc2626";
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
          className="lecturer-content"
          style={{
            flex: 1,
            backgroundColor: "#FFFFFF",
            padding: "24px 32px",
            marginTop: 80,
            height: "calc(100vh - 80px)",
            overflowY: "auto",
          }}
          onPointerUpCapture={collapseSidebarOnActivity}
        >
          <Outlet />
        </div>

        <footer
          style={{
            backgroundColor: "#F5F6FA",
            borderTop: "1px solid #E5E7EB",
            padding: "16px 36px",
            textAlign: "center",
            fontSize: 12,
            color: "#6B7280",
          }}
        >
          © 2025 Đại học Đại Nam
        </footer>
      </main>
    </div>
  );
};

export default LecturerLayout;
