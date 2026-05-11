import React, { useEffect, useState } from "react";
import AdminNav from "../SideNavs/AdminNav";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  LogOut,
  Bell,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  GraduationCap,
  ChevronDown,
  User,
  KeyRound,
} from "lucide-react";
import { fetchData, getAvatarUrl } from "../../api/fetchData";
import type { ApiResponse } from "../../types/api";
import type { LecturerProfile } from "../../types/lecturer-profile";

const AdminLayout: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState<LecturerProfile | null>(null);
  const [lecturerImage, setLecturerImage] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const sidebarWidth = isSidebarCollapsed ? 84 : 260;

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
        console.error("Error loading lecturer profile in admin:", err);
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

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
        }
        
        /* Responsive Styles */
        @media (max-width: 768px) {
          .admin-sidebar {
            transform: translateX(-100%);
            transition: transform 0.3s ease;
          }
          
          .admin-sidebar.open {
            transform: translateX(0);
          }
          
          .admin-main {
            margin-left: 0 !important;
          }
          
          .admin-header {
            left: 0 !important;
            padding: 12px 16px !important;
          }
          
          .admin-header h2 {
            font-size: 16px !important;
          }
          
          .mobile-menu-btn {
            display: flex !important;
          }
          
          .mobile-close-btn {
            display: flex !important;
          }
          
          .admin-content {
            padding: 16px !important;
            margin-bottom: 60px;
          }
        }
        
        @media (min-width: 769px) and (max-width: 1024px) {
          .admin-sidebar {
            width: 220px !important;
          }
          
          .admin-main {
            margin-left: 220px !important;
          }
          
          .admin-header {
            left: 220px !important;
          }
        }

        .admin-sidebar,
        .admin-main,
        .admin-header,
        .admin-sidebar img,
        .admin-sidebar .sidebar-brand-text,
        .admin-sidebar .sidebar-footer-text {
          transition: width 0.28s ease, margin-left 0.28s ease, left 0.28s ease, opacity 0.24s ease, transform 0.24s ease, margin 0.28s ease;
        }

        .admin-sidebar .sidebar-brand-text,
        .admin-sidebar .sidebar-footer-text {
          will-change: opacity, transform;
        }

        .admin-sidebar.collapsed .sidebar-brand-text,
        .admin-sidebar.collapsed .sidebar-footer-text {
          opacity: 0;
          transform: translateY(-8px) scale(0.96);
          pointer-events: none;
        }
      `}</style>
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          backgroundColor: "#FFFFFF",
          fontFamily: '"Be Vietnam Pro", "Segoe UI", sans-serif',
        }}
      >
        <aside
          className={`admin-sidebar ${isMobileMenuOpen ? "open" : ""} ${isSidebarCollapsed ? "collapsed" : ""}`}
          style={{
            width: sidebarWidth,
            backgroundColor: "#001C3D",
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
              padding: "28px 20px",
              background:
                "linear-gradient(180deg, rgba(243, 112, 33, 0.1) 0%, #001C3D 100%)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              position: "relative",
            }}
          >
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

            <img
              src="/dnu_logo.png"
              alt="Đại học Đại Nam"
              style={{
                width: isSidebarCollapsed ? 52 : 90,
                display: "block",
                margin: isSidebarCollapsed ? "16px auto 10px" : "0 auto 14px",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                transition:
                  "transform 0.3s ease, width 0.28s ease, margin 0.28s ease, opacity 0.24s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "scale(1.05)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            />
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
              Quản trị hệ thống
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

          <div style={{ flex: 1, padding: "12px 16px", overflowY: "auto" }}>
            <AdminNav
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
              padding: "20px 16px",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
              background:
                "linear-gradient(180deg, #001C3D 0%, rgba(0, 28, 61, 0.8) 100%)",
              fontWeight: 500,
              opacity: isSidebarCollapsed ? 0 : 1,
              transform: isSidebarCollapsed
                ? "translateY(8px)"
                : "translateY(0)",
              maxHeight: isSidebarCollapsed ? 0 : 80,
              overflow: "hidden",
              transition:
                "opacity 0.24s ease, transform 0.24s ease, max-height 0.28s ease",
            }}
          >
            <div style={{ marginBottom: 4, fontSize: 10, color: "#888" }}>
              Phiên bản 1.0.0
            </div>
            © 2025 Đại học Đại Nam
          </footer>
        </aside>

        <main
          className="admin-main"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            marginLeft: sidebarWidth,
            transition: "margin-left 0.28s ease",
          }}
        >
          <header
            className="admin-header"
            style={{
              backgroundColor: "#001C3D",
              padding: "18px 36px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 2px 12px rgba(0, 0, 0, 0.2)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "#FFFFFF",
              position: "fixed",
              left: sidebarWidth,
              right: 0,
              top: 0,
              height: 72,
              zIndex: 60,
              transition: "left 0.28s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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

              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                title={
                  isSidebarCollapsed ? "Mở rộng thanh nav" : "Thu gọn thanh nav"
                }
                aria-label={
                  isSidebarCollapsed ? "Mở rộng thanh nav" : "Thu gọn thanh nav"
                }
                style={{
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen size={18} />
                ) : (
                  <PanelLeftClose size={18} />
                )}
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
              {/* Notification Icon with Badge */}
              <div
                className="admin-notification-bell"
                style={{
                  position: "relative",
                  cursor: "pointer",
                  padding: "10px",
                  borderRadius: "10px",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  backgroundColor: "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "rgba(243, 112, 33, 0.2)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
                title="Thông báo"
              >
                <Bell size={20} strokeWidth={2.5} />
                <span
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    backgroundColor: "#FF3D00",
                    color: "#FFFFFF",
                    borderRadius: "50%",
                    width: "18px",
                    height: "18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    fontWeight: 700,
                    border: "2px solid #001C3D",
                    boxShadow: "0 2px 6px rgba(255, 61, 0, 0.4)",
                    animation: "pulse 2s infinite",
                  }}
                >
                  3
                </span>
              </div>

              {/* User Dropdown */}
              <div style={{ position: "relative" }} data-dropdown>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    background: "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    padding: "8px 16px",
                    borderRadius: "16px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                    color: "#FFFFFF",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  {lecturerImage ? (
                    <img
                      src={getAvatarUrl(lecturerImage)}
                      alt={profile?.fullName || "avatar"}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "2px solid rgba(243, 112, 33, 0.2)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(243, 112, 33, 0.1))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#FFFFFF",
                      }}
                    >
                      {profile?.fullName ? profile.fullName.charAt(0) : "A"}
                    </div>
                  )}
                  <ChevronDown
                    size={16}
                    style={{
                      transition: "transform 0.3s ease",
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
                      background: "linear-gradient(135deg, #001C3D, #002855)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "16px",
                      boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
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
                        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        background: "rgba(255, 255, 255, 0.03)",
                      }}
                    >
                      {lecturerImage ? (
                        <img
                          src={getAvatarUrl(lecturerImage)}
                          alt="avatar"
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "2px solid rgba(243, 112, 33, 0.2)",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(243, 112, 33, 0.1))",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "20px",
                            fontWeight: 700,
                            color: "#FFFFFF",
                          }}
                        >
                          {profile?.fullName ? profile.fullName.charAt(0) : "A"}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "16px", fontWeight: 700, color: "#FFFFFF", marginBottom: "2px" }}>
                          {profile?.fullName || auth.user?.fullName || "Quản trị viên"}
                        </div>
                        <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                          {profile?.degree || "Quản trị hệ thống"}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: "8px" }}>
                      {auth.user?.roles?.includes("LECTURER") && (
                        <button
                          onClick={() => {
                            setShowDropdown(false);
                            auth.switchRole("LECTURER");
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                            width: "100%",
                            padding: "14px 18px",
                            background: "rgba(243, 112, 33, 0.1)",
                            border: "none",
                            borderRadius: "12px",
                            textAlign: "left",
                            cursor: "pointer",
                            fontSize: "14px",
                            color: "#F37021",
                            fontWeight: 600,
                            transition: "all 0.3s ease",
                            marginBottom: "8px"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(243, 112, 33, 0.2)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(243, 112, 33, 0.1)";
                          }}
                        >
                          <GraduationCap size={18} />
                          Giao diện Giảng viên
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          navigate("/admin/change-password");
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          width: "100%",
                          padding: "12px 18px",
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
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <KeyRound size={18} />
                        Đổi mật khẩu
                      </button>

                      <button
                        onClick={() => auth.logout()}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          width: "100%",
                          padding: "12px 18px",
                          background: "none",
                          border: "none",
                          borderRadius: "12px",
                          textAlign: "left",
                          cursor: "pointer",
                          fontSize: "14px",
                          color: "#ff4d4d",
                          fontWeight: 600,
                          transition: "all 0.3s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 77, 77, 0.1)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <LogOut size={18} />
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div
            className="admin-content"
            style={{
              flex: 1,
              backgroundColor: "#FFFFFF",
              padding: "24px 32px",
              marginTop: 72,
              height: "calc(100vh - 72px)",
              overflowY: "auto",
            }}
          >
            <Outlet />
          </div>

          <footer
            style={{
              backgroundColor: "#F5F6FA",
              borderTop: "1px solid #E5E7EB",
              padding: "16px 36px",
              textAlign: "center",
              fontSize: "12px",
              color: "#6B7280",
              fontWeight: 500,
              boxShadow: "0 -2px 10px rgba(0,0,0,0.03)",
            }}
          >
            © 2025 Đại học Đại Nam - Hệ thống quản lý đồ án tốt nghiệp
          </footer>
        </main>
      </div>
    </>
  );
};

export default AdminLayout;
