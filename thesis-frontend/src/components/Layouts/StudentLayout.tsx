import React, { useEffect, useState } from "react";
import StudentNav from "../SideNavs/StudentNav";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { LogOut, ChevronDown, User, Menu, X } from "lucide-react";
import { fetchData, getAvatarUrl } from "../../api/fetchData";
import type { ApiResponse } from "../../types/api";
import type { StudentProfile } from "../../types/studentProfile";

const StudentLayout: React.FC = () => {
  const auth = useAuth();
  const [studentImage, setStudentImage] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!auth.user?.userCode) return;
        const res = await fetchData(
          `/StudentProfiles/get-list?UserCode=${auth.user.userCode}`
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

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#FFFFFF",
        fontFamily: "'Inter', 'Poppins', 'Roboto', sans-serif",
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
            
            /* Hide desktop title and icon on mobile */
            .student-header > div:first-child > div:last-child {
              display: none !important;
            }
            
            /* Show mobile logo */
            .student-mobile-logo {
              display: flex !important;
            }
            
            /* Hide status badge on mobile */
            .student-status-badge {
              display: none !important;
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
            
            /* Avatar section responsive */
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
        `}
      </style>
      <aside
        className={`student-sidebar ${isMobileMenuOpen ? "open" : ""}`}
        style={{
          width: 260,
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
          {/* Close Button for Mobile */}
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

          <img
            src="/dnu_logo.png"
            alt="Đại học Đại Nam"
            style={{
              width: 88,
              display: "block",
              margin: "0 auto 10px",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.06))",
            }}
          />
          <h3
            style={{
              color: "#F37021",
              fontSize: 17,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "0.5px",
            }}
          >
            Hệ thống Quản lý Đồ án
          </h3>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>
            Vai trò: <strong style={{ color: "#F37021" }}>Sinh viên</strong>
          </div>
        </div>

        <div style={{ flex: 1, padding: "12px 16px", overflowY: "auto" }}>
          <StudentNav onNavigate={() => setIsMobileMenuOpen(false)} />
        </div>

        <footer
          style={{
            fontSize: 11,
            color: "#6B7280",
            textAlign: "center",
            padding: "18px 12px",
            borderTop: "1px solid #E5E7EB",
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
          marginLeft: 260,
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
            left: 260,
            right: 0,
            top: 0,
            height: 72,
            zIndex: 20,
            borderBottom: "1px solid #E5E7EB",
            background: "linear-gradient(135deg, #ffffff 0%, #fefefe 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Mobile Menu Button */}
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

            {/* Mobile Logo - Only visible on mobile */}
            <img
              src="/logo-ios.png"
              alt="Đại học Đại Nam"
              className="student-mobile-logo"
              style={{
                display: "none",
                height: "36px",
                width: "auto",
              }}
            />

            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #f37021, #ff8c42)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(243, 112, 33, 0.2)",
              }}
            >
              <User size={20} color="#fff" />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#1a2736",
                  letterSpacing: "0.5px",
                  lineHeight: "1.2",
                }}
              >
                Sinh viên Đại học Đại Nam
              </h2>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: 12,
                  color: "#64748b",
                  fontWeight: 500,
                  letterSpacing: "0.3px",
                }}
              >
                Hệ thống Quản lý Đồ án Tốt nghiệp
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Status Badge - Hidden on mobile */}
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

              {/* Dropdown Menu */}
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
                    {/* Avatar */}
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

                    {/* User Info */}
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
                        // Navigate to student profile page
                        window.location.href = "/student/profile";
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
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default StudentLayout;
