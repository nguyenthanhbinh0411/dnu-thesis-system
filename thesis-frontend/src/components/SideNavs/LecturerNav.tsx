import React from "react";
import { NavLink } from "react-router-dom";
import {
  Gavel,
  Home,
  Users,
  CalendarCheck,
  FileText,
  Bell,
  BookOpen,
  Activity,
  FileCheck2,
} from "lucide-react";
import "./SideNav.css";
import "./LecturerNav.css";

interface LecturerNavProps {
  onNavigate?: () => void;
  collapsed?: boolean;
  showDefenseMenus?: boolean;
  showRevisionMenu?: boolean;
}

const LecturerNav: React.FC<LecturerNavProps> = ({
  onNavigate,
  collapsed = false,
  showDefenseMenus = false,
  showRevisionMenu = false,
}) => {
  const navItems = [
    { path: "/lecturer", label: "Trang chủ", icon: <Home size={18} /> },
    {
      path: "/lecturer/students",
      label: "Sinh viên hướng dẫn",
      icon: <Users size={18} />,
    },
    {
      path: "/lecturer/reports",
      label: "Nhận xét báo cáo",
      icon: <FileText size={18} />,
    },
    {
      path: "/lecturer/topic-review",
      label: "Duyệt đề tài",
      icon: <BookOpen size={18} />,
    },
    {
      path: "/lecturer/topic-rename-requests",
      label: "Xin đổi tên đề tài",
      icon: <FileText size={18} />,
    },
    {
      path: "/lecturer/workflow-audits",
      label: "Workflow Audit",
      icon: <Activity size={18} />,
    },
    ...(showRevisionMenu
      ? [
        {
          path: "/lecturer/post-defense",
          label: "Hậu bảo vệ",
          icon: <FileCheck2 size={18} />,
        },
      ]
      : []),
    ...(showDefenseMenus
      ? [
        {
          path: "/lecturer/schedule",
          label: "Lịch chấm bảo vệ",
          icon: <CalendarCheck size={18} />,
        },
        // Committees view for lecturer
        {
          path: "/lecturer/committees",
          label: "Ca bảo vệ & chấm điểm",
          icon: <Gavel size={18} />,
        },
      ]
      : []),
    {
      path: "/lecturer/notifications",
      label: "Thông báo",
      icon: <Bell size={18} />,
    },
  ];

  return (
    <nav className={`sidenav lecturer-theme ${collapsed ? "collapsed" : ""}`}>
      <ul>
        {navItems.map((item) => (
          <li key={item.path}>
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

export default LecturerNav;
