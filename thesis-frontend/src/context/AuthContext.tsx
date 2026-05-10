import React, { useEffect, useState } from "react";
import type { User } from "../types/user";
import { AuthContext } from "./AuthContextTypes";
import {
  clearAuthSession,
  getAllRolesFromAccessToken,
  getRoleClaimFromAccessToken,
  hasValidAccessToken,
} from "../services/auth-session.service";
import { normalizeRole } from "../utils/role";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("app_user");
    const hydrated = raw ? (JSON.parse(raw) as User) : null;
    if (!hydrated) return null;

    const rolesFromToken = getAllRolesFromAccessToken();
    const savedActiveRole = localStorage.getItem("active_role");
    
    const activeRole = (savedActiveRole || rolesFromToken[0] || hydrated.role || "") as string;

    return {
      ...hydrated,
      roles: (rolesFromToken.length > 0 ? rolesFromToken : [hydrated.role].filter(Boolean)) as string[],
      activeRole: activeRole,
      role: activeRole,
    };
  });

  const [isSwitching, setIsSwitching] = useState(false);
  const [switchProgress, setSwitchProgress] = useState(0);

  useEffect(() => {
    if (user) {
      localStorage.setItem("app_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("app_user");
    }
  }, [user]);

  useEffect(() => {
    if (!hasValidAccessToken() && user) {
      setUser(null);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const rolesFromToken = getAllRolesFromAccessToken();
    if (rolesFromToken.length === 0) return;
    
    const hasChanged = JSON.stringify(rolesFromToken) !== JSON.stringify(user.roles);
    if (!hasChanged) return;

    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        roles: rolesFromToken,
      };
    });
  }, [user]);

  const login = (u: User | null) => {
    if (u && u.role) {
      localStorage.setItem("active_role", u.role);
    }
    setUser(u);
  };
  
  const logout = () => {
    clearAuthSession();
    localStorage.removeItem("active_role");
    setUser(null);
  };

  const switchRole = (role: string) => {
    if (!user) return;
    
    setIsSwitching(true);
    setSwitchProgress(0);

    let progress = 0;
    const interval = setInterval(() => {
      const increment = progress < 30 ? 4 : progress < 60 ? 3 : progress < 85 ? 2 : 1;
      progress = Math.min(progress + increment, 100);
      setSwitchProgress(progress);
      
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          localStorage.setItem("active_role", role);
          setUser({
            ...user,
            activeRole: role,
            role: role
          });
          window.location.href = role === "ADMIN" ? "/admin" : "/lecturer";
        }, 300);
      }
    }, 40);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && hasValidAccessToken(),
        isSwitching,
        switchProgress,
        login,
        logout,
        switchRole,
      }}
    >
      {isSwitching && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(255, 255, 255, 0.98)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backdropFilter: "blur(8px)",
            animation: "fadeIn 0.3s ease-out",
          }}
        >
          <style>
            {`
              @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
              @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}
          </style>
          <div
            style={{
              width: 430,
              background: "#ffffff",
              border: "1px solid #f1f5f9",
              borderRadius: 24,
              padding: 42,
              textAlign: "center",
              boxShadow: "0 20px 50px rgba(0,0,0,0.06)",
              animation: "slideUp 0.5s ease-out",
            }}
          >
            <img
              src="/dnu_logo.png"
              alt="Đại Nam University"
              style={{
                width: 80,
                height: 80,
                objectFit: "contain",
                margin: "0 auto 24px",
                display: "block",
              }}
            />

            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#001C3D",
                marginBottom: 12,
                fontFamily: '"Inter", sans-serif',
              }}
            >
              Chuyển đổi không gian làm việc
            </div>

            <div
              style={{
                fontSize: 14,
                color: "#6b7280",
                lineHeight: 1.6,
                marginBottom: 32,
              }}
            >
              Đang đồng bộ hóa dữ liệu và thiết lập quyền hạn cho vai trò mới...
            </div>

            <div
              style={{
                width: "100%",
                height: 8,
                background: "#f3f4f6",
                borderRadius: 999,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: `${switchProgress}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #F37021, #FF8C42)",
                  transition: "width 0.15s ease-out",
                }}
              />
            </div>

            <div
              style={{
                marginTop: 20,
                fontSize: 14,
                fontWeight: 600,
                color: "#001C3D",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <span>
                {switchProgress < 40
                  ? "Đang chuẩn bị..."
                  : switchProgress < 80
                    ? "Đang xác thực quyền..."
                    : "Sẵn sàng!"}
              </span>
              <span style={{ color: "#F37021" }}>{Math.round(switchProgress)}%</span>
            </div>

            <div
              style={{
                marginTop: 32,
                fontSize: 12,
                color: "#9ca3af",
                letterSpacing: 0.5,
                fontWeight: 500,
              }}
            >
              DAI NAM UNIVERSITY • THESIS SYSTEM
            </div>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
};
