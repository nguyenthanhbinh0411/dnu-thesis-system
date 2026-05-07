import React, { useState } from "react";
import AdminNav from "../SideNavs/AdminNav";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  LogOut,
  Bell,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const AdminLayout: React.FC = () => {
  const auth = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const sidebarWidth = isSidebarCollapsed ? 84 : 260;

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

              <img
                src="/logo-ios.png"
                alt="Đại học Đại Nam"
                style={{
                  display: "block",
                  height: "36px",
                  width: "auto",
                  filter: "brightness(0) invert(1)",
                }}
              />

              {/* Mobile Logo - Only visible on mobile */}
              <img
                src="/logo-ios.png"
                alt="Đại học Đại Nam"
                className="admin-mobile-logo"
                style={{
                  display: "none",
                  height: "32px",
                  width: "auto",
                  filter: "brightness(0) invert(1)",
                }}
              />

              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 600,
                  color: "#FFFFFF",
                  letterSpacing: "0.5px",
                  textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                }}
              >
                Quản trị hệ thống đồ án tốt nghiệp
              </h2>
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

              {/* User Info */}
              <div
                className="admin-avatar-section"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 14px",
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "rgba(255, 255, 255, 0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "rgba(255, 255, 255, 0.1)";
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(243, 112, 33, 0.1))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  }}
                >
                  👤
                </div>
                <span
                  className="admin-user-info"
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                  }}
                >
                  {auth.user?.fullName || "Quản trị viên"}
                </span>
              </div>

              {/* Logout Button */}
              <button
                onClick={() => auth.logout()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: "#F37021",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: "0 2px 8px rgba(243, 112, 33, 0.3)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#E55A1B";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(243, 112, 33, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#F37021";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(243, 112, 33, 0.3)";
                }}
              >
                <LogOut size={17} strokeWidth={2.5} />
                Đăng xuất
              </button>
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
