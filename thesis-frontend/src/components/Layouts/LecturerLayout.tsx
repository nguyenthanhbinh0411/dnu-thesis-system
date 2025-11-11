import React, { useEffect, useState } from "react";
import LecturerNav from "../SideNavs/LecturerNav";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  LogOut,
  ChevronDown,
  User,
  Clock,
  GraduationCap,
  Menu,
  X,
} from "lucide-react";
import { fetchData, getAvatarUrl } from "../../api/fetchData";
import type { ApiResponse } from "../../types/api";
import type { LecturerProfile } from "../../types/lecturer-profile";

const LecturerLayout: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<LecturerProfile | null>(null);
  const [lecturerImage, setLecturerImage] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!auth.user?.userCode) return;
        const res = await fetchData(
          `/LecturerProfiles/get-list?UserCode=${auth.user.userCode}`
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
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

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
            
            /* Hide desktop title and icon on mobile */
            .lecturer-header > div:first-child > div:last-child {
              display: none !important;
            }
            
            /* Show mobile logo */
            .lecturer-mobile-logo {
              display: flex !important;
            }
            
            /* Hide time display on mobile */
            .lecturer-header > div:last-child > div:first-child {
              display: none !important;
            }
            
            /* Hide status badge on mobile */
            .lecturer-status-badge {
              display: none !important;
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
        `}
      </style>
      <aside
        className={`lecturer-sidebar ${isMobileMenuOpen ? "open" : ""}`}
        style={{
          width: 260,
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
              width: 88,
              display: "block",
              margin: "0 auto 10px",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.06))",
            }}
          />
          <h3
            style={{
              color: "#f37021",
              fontSize: 17,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "0.5px",
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
            }}
          >
            Hệ thống Quản lý Đồ án
          </h3>
          <div style={{ fontSize: 12, color: "#e2e8f0", marginTop: 6 }}>
            Vai trò: <strong style={{ color: "#f37021" }}>Giảng viên</strong>
          </div>
        </div>

        <div style={{ flex: 1, padding: "12px 16px", overflowY: "auto" }}>
          <LecturerNav onNavigate={() => setIsMobileMenuOpen(false)} />
        </div>

        <footer
          style={{
            fontSize: 11,
            color: "#94a3b8",
            textAlign: "center",
            padding: "18px 12px",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            background: "rgba(0, 0, 0, 0.2)",
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
          marginLeft: 260,
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
            left: 260,
            right: 0,
            top: 0,
            height: 80,
            zIndex: 20,
            borderBottom: "2px solid rgba(243, 112, 33, 0.3)",
            backdropFilter: "blur(10px)",
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

            {/* Mobile Logo - Only visible on mobile */}
            <img
              src="/logo-ios.png"
              alt="Đại học Đại Nam"
              className="lecturer-mobile-logo"
              style={{
                display: "none",
                height: "36px",
                width: "auto",
                filter: "brightness(0) invert(1)",
              }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background:
                    "linear-gradient(135deg, rgba(243, 112, 33, 0.2), rgba(243, 112, 33, 0.1))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(243, 112, 33, 0.2)",
                }}
              >
                <GraduationCap size={24} color="#f37021" />
              </div>
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#FFFFFF",
                    letterSpacing: "0.5px",
                    textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
                    lineHeight: 1.2,
                  }}
                >
                  Giảng viên Đại học Đại Nam
                  <br />
                  <span
                    style={{ fontSize: 16, fontWeight: 500, color: "#f37021" }}
                  >
                    Hệ thống Quản lý Đồ án Tốt nghiệp
                  </span>
                </h2>
              </div>
            </div>
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
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#e2e8f0",
                          fontWeight: 500,
                        }}
                      ></div>
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
                      onClick={() => auth.logout()}
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
