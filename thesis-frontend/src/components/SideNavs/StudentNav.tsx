import React from "react";
import { NavLink } from "react-router-dom";
import {
  GraduationCap,
  Home,
  BookOpen,
  LineChart,
  Upload,
  Calendar,
} from "lucide-react";
import "./SideNav.css";
import "./StudentNav.css";

interface StudentNavProps {
  onNavigate?: () => void;
  collapsed?: boolean;
}

const StudentNav: React.FC<StudentNavProps> = ({
  onNavigate,
  collapsed = false,
}) => {
  const navItems = [
    { path: "/student", label: "Trang chủ", icon: <Home size={18} /> },
    {
      path: "/student/topics",
      label: "Đăng ký đề tài",
      icon: <BookOpen size={18} />,
    },
    {
      path: "/student/progress",
      label: "Tiến độ đồ án",
      icon: <LineChart size={18} />,
    },
    {
      path: "/student/reports",
      label: "Nộp báo cáo",
      icon: <Upload size={18} />,
    },
    {
      path: "/student/schedule",
      label: "Lịch bảo vệ",
      icon: <Calendar size={18} />,
    },
    // Quick access to student's defense info
    {
      path: "/student/defense-info",
      label: "Bảo vệ & kết quả",
      icon: <GraduationCap size={18} />,
    },
  ];

  return (
    <nav className={`sidenav student-theme ${collapsed ? "collapsed" : ""}`}>
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

export default StudentNav;
