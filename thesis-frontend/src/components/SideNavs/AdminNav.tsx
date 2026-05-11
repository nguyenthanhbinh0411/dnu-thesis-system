import React from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  Users,
  ClipboardList,
  BookOpen,
  FileCog,
  Bell,
  Activity,
  GraduationCap,
  Building2,
  ShieldCheck,
  CalendarDays,
} from "lucide-react";
import "./SideNav.css";
import "./AdminNav.css";
import { useAuth } from "../../hooks/useAuth";
import {
  isManagementRole,
  normalizeRole,
  ROLE_ADMIN,
  ROLE_STUDENT_SERVICE,
} from "../../utils/role";
import { hasUserManagementPermission } from "../../utils/permissions";

interface AdminNavProps {
  onNavigate?: () => void;
  collapsed?: boolean;
}

const AdminNav: React.FC<AdminNavProps> = ({
  onNavigate,
  collapsed = false,
}) => {
  const auth = useAuth();
  const role = normalizeRole(auth.user?.role);

  if (!isManagementRole(role)) {
    return null;
  }

  const basePath =
    role === ROLE_STUDENT_SERVICE ? "/student-service" : "/admin";

  const commonItems = [
    { path: `${basePath}`, label: "Trang chủ", icon: <Home size={18} /> },
    {
      path: `${basePath}/students`,
      label: "Quản lý sinh viên",
      icon: <Users size={18} />,
    },
    {
      path: `${basePath}/lecturers`,
      label: "Quản lý giảng viên",
      icon: <GraduationCap size={18} />,
    },
    {
      path: `${basePath}/departments`,
      label: "Quản lý khoa/bộ môn",
      icon: <Building2 size={18} />,
    },
    {
      path: `${basePath}/topics`,
      label: "Quản lý đề tài",
      icon: <ClipboardList size={18} />,
    },
    {
      path: `${basePath}/defense-periods`,
      label: "Quản lý đợt",
      icon: <CalendarDays size={18} />,
    },
    {
      path: `${basePath}/rooms`,
      label: "Quản lý phòng",
      icon: <Building2 size={18} />,
    },
    {
      path: `${basePath}/tags`,
      label: "Quản lý tags",
      icon: <BookOpen size={18} />,
    },
    {
      path: `${basePath}/catalogtopics`,
      label: "Kho đề tài có sẵn",
      icon: <ClipboardList size={18} />,
    },
  ];

  const roleCanSeeUsers = hasUserManagementPermission(role, "users:list");

  const hiddenPaths =
    role === ROLE_STUDENT_SERVICE
      ? new Set([`${basePath}/defense-periods`, `${basePath}/rooms`])
      : new Set<string>();

  const adminOnlyItems = [
    {
      path: `${basePath}/topic-review`,
      label: "Duyệt đề tài",
      icon: <BookOpen size={18} />,
    },
    {
      path: `${basePath}/committees/management`,
      label: "Phân công hội đồng",
      icon: <ShieldCheck size={18} />,
    },
    {
      path: `${basePath}/committees/operations`,
      label: "Điều hành chấm điểm",
      icon: <Activity size={18} />,
    },
    {
      path: `${basePath}/notifications/create`,
      label: "Tạo thông báo",
      icon: <Bell size={18} />,
    },
    {
      path: `${basePath}/system-config`,
      label: "Cấu hình hệ thống",
      icon: <FileCog size={18} />,
    },
    {
      path: `${basePath}/activity-logs`,
      label: "Lịch sử hoạt động",
      icon: <Activity size={18} />,
    },
    {
      path: `${basePath}/workflow-audits`,
      label: "Workflow Audit",
      icon: <Activity size={18} />,
    },
  ];

  const rawNavItems = [
    ...commonItems,
    ...(roleCanSeeUsers
      ? [
          {
            path: `${basePath}/users`,
            label: "Quản lý người dùng",
            icon: <Users size={18} />,
          },
        ]
      : []),
    ...(role === ROLE_ADMIN ? adminOnlyItems : []),
  ];

  const navItems = Array.from(
    new Map(
      rawNavItems
        .filter((item) => !hiddenPaths.has(item.path))
        .map((item) => [item.path, item]),
    ).values(),
  );

  return (
    <nav className={`sidenav admin-theme ${collapsed ? "collapsed" : ""}`}>
      <ul>
        {navItems.map((item) => (
          <li key={`${item.path}-${item.label}`}>
            <NavLink
              to={item.path}
              end
              className={({ isActive }) => (isActive ? "active" : undefined)}
              onClick={onNavigate}
              title={item.label}
              aria-label={item.label}
              data-tooltip={item.label}
            >
              <span className="icon">{item.icon}</span>
              <span className="label">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default AdminNav;
