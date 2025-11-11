import React from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  Users,
  ClipboardList,
  FileCog,
  ShieldCheck,
  Bell,
  Activity,
} from "lucide-react";
import "./SideNav.css";
import "./AdminNav.css";

interface AdminNavProps {
  onNavigate?: () => void;
}

const AdminNav: React.FC<AdminNavProps> = ({ onNavigate }) => {
  const navItems = [
    { path: "/admin", label: "Trang chủ", icon: <Home size={18} /> },
    {
      path: "/admin/users",
      label: "Quản lý người dùng",
      icon: <Users size={18} />,
    },
    {
      path: "/admin/topic-review",
      label: "Quản lý đề tài",
      icon: <ClipboardList size={18} />,
    },
    {
      path: "/admin/committees",
      label: "Hội đồng & phân công",
      icon: <ShieldCheck size={18} />,
    },
    {
      path: "/admin/notifications/create",
      label: "Tạo thông báo",
      icon: <Bell size={18} />,
    },
    {
      path: "/admin/system-config",
      label: "Cấu hình hệ thống",
      icon: <FileCog size={18} />,
    },
    {
      path: "/admin/activity-logs",
      label: "Lịch sử hoạt động",
      icon: <Activity size={18} />,
    },
  ];

  return (
    <nav className="sidenav admin-theme">
      <ul>
        {navItems.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end
              className={({ isActive }) => (isActive ? "active" : undefined)}
              onClick={onNavigate}
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
