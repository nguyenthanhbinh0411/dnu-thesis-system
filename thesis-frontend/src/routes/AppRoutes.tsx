import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "../pages/Home";
import LoginPage from "../pages/auth/LoginPage";
import ChangePasswordPage from "../pages/auth/ChangePasswordPage";
import Forbidden from "../pages/Forbidden";
import StudentLayout from "../components/Layouts/StudentLayout";
import LecturerLayout from "../components/Layouts/LecturerLayout";
import AdminLayout from "../components/Layouts/AdminLayout";
import StudentDashboard from "../pages/student/Dashboard";
import TopicRegistration from "../pages/student/TopicRegistration";
import Progress from "../pages/student/Progress";
import Reports from "../pages/student/Reports";
import Schedule from "../pages/student/Schedule";
import LecturerDashboard from "../pages/lecturer/Dashboard";
import LecturerCommittees from "../pages/lecturer/LecturerCommittees";
import LecturerCommitteeGradingRoom from "../pages/lecturer/LecturerCommitteeGradingRoom";
import LecturerStudents from "../pages/lecturer/LecturerStudents";
import LecturerSchedule from "../pages/lecturer/LecturerSchedule";
import LecturerReports from "../pages/lecturer/LecturerReports";
import LecturerTopicRenameRequests from "../pages/lecturer/TopicRenameRequests";
import UsersManagement from "../pages/admin/UsersManagement";
import SystemConfig from "../pages/admin/SystemConfig";
import AdminDashboard from "../pages/admin/Dashboard";
import ProtectedRoute from "../components/ProtectedRoute";
import ScrollToTop from "../components/ScrollToTop";

import CreateNotification from "../pages/admin/CreateNotification";
import StudentDefenseInfo from "../pages/student/StudentDefenseInfo";
import StudentProfilePage from "../pages/student/StudentProfile";
import LecturerProfilePage from "../pages/lecturer/LecturerProfile";
import LecturerTopicReview from "../pages/admin/LecturerTopicReview";
import LecturerNotifications from "../pages/lecturer/Notifications";
import CommitteeManagement from "../pages/admin/CommitteeManagement";
import CommitteeOperationsManagement from "../pages/admin/CommitteeOperationsManagement";
import SystemActivityLogs from "../pages/admin/SystemActivityLogs";
import LecturerTopicReviewPage from "../pages/lecturer/LecturerTopicReview";
import StudentServiceDashboard from "../pages/studentservices/StudentServiceDashboard";
import StudentProfilesManagement from "../pages/studentservices/StudentProfilesManagement";
import LecturerProfilesManagement from "../pages/studentservices/LecturerProfilesManagement";
import DepartmentsManagement from "../pages/studentservices/DepartmentsManagement";
import TopicsManagement from "../pages/studentservices/TopicsManagement";
import TagsManagement from "../pages/studentservices/TagsManagement";
import CatalogTopicsWarehousePage from "../pages/studentservices/CatalogTopicsWarehousePage";
import AcademicDataManagementPage from "../pages/studentservices/AcademicDataManagementPage";
import TopicWorkflowAudits from "../pages/admin/TopicWorkflowAudits";
import DefensePeriodsManagement from "../pages/admin/DefensePeriodsManagement";
import RoomsManagement from "../pages/admin/RoomsManagement";
import RouteErrorBoundary from "../components/RouteErrorBoundary";
/**
 * AppRoutes chứa tất cả route của ứng dụng.
 * Nếu thêm route mới, chỉ edit file này.
 */
const AppRoutes: React.FC = () => {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/403" element={<Forbidden />} />

        {/* STUDENT */}
        <Route
          path="/student/*"
          element={
            <ProtectedRoute allowedRoles={["STUDENT"]}>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<StudentDashboard />} />
          <Route path="topics" element={<TopicRegistration />} />
          <Route path="progress" element={<Progress />} />
          <Route path="reports" element={<Reports />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="defense-info" element={<StudentDefenseInfo />} />
          <Route path="profile" element={<StudentProfilePage />} />
          <Route path="change-password" element={<ChangePasswordPage />} />
          {/* thêm các route con của student ở đây */}
        </Route>

        {/* LECTURER */}
        <Route
          path="/lecturer/*"
          element={
            <ProtectedRoute allowedRoles={["LECTURER"]}>
              <LecturerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<LecturerDashboard />} />
          <Route path="students" element={<LecturerStudents />} />
          <Route path="schedule" element={<LecturerSchedule />} />
          <Route path="committees" element={<LecturerCommittees key="lecturer-committees" />} />
          <Route path="committees/grading" element={<LecturerCommitteeGradingRoom />} />
          <Route path="reports" element={<LecturerReports />} />
          <Route path="topic-review" element={<LecturerTopicReviewPage />} />
          <Route
            path="topic-rename-requests"
            element={
              <RouteErrorBoundary pageTitle="Xin đổi tên đề tài">
                <LecturerTopicRenameRequests />
              </RouteErrorBoundary>
            }
          />
          <Route path="workflow-audits" element={<TopicWorkflowAudits />} />
          <Route path="profile" element={<LecturerProfilePage />} />
          <Route path="change-password" element={<ChangePasswordPage />} />
          <Route path="notifications" element={<LecturerNotifications />} />
          {/* thêm các route con của lecturer ở đây */}
        </Route>

        {/* ADMIN */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route
            path="academic-data"
            element={<AcademicDataManagementPage />}
          />
          <Route path="users" element={<UsersManagement />} />

          <Route path="students" element={<StudentProfilesManagement />} />
          <Route path="lecturers" element={<LecturerProfilesManagement />} />
          <Route path="departments" element={<DepartmentsManagement />} />
          <Route path="topics" element={<TopicsManagement />} />
          <Route path="tags" element={<TagsManagement />} />
          <Route
            path="catalogtopics"
            element={<CatalogTopicsWarehousePage />}
          />
          <Route path="topic-review" element={<LecturerTopicReview />} />
          <Route
            path="defense-periods"
            element={<DefensePeriodsManagement />}
          />
          <Route path="rooms" element={<RoomsManagement />} />
          <Route
            path="committees"
            element={<Navigate to="/admin/committees/management" replace />}
          />
          <Route
            path="committees/management"
            element={
              <RouteErrorBoundary pageTitle="Phân công - Quản lý hội đồng">
                <CommitteeManagement />
              </RouteErrorBoundary>
            }
          />
          <Route
            path="committees/operations"
            element={
              <RouteErrorBoundary pageTitle="Điều hành chấm điểm - Hậu bảo vệ">
                <CommitteeOperationsManagement />
              </RouteErrorBoundary>
            }
          />
          <Route
            path="defense-assignments"
            element={<Navigate to="/admin/committees/management" replace />}
          />
          <Route path="system-config" element={<SystemConfig />} />
          <Route path="notifications/create" element={<CreateNotification />} />
          <Route path="activity-logs" element={<SystemActivityLogs />} />
          <Route path="workflow-audits" element={<TopicWorkflowAudits />} />
        </Route>

        {/* STUDENT SERVICE */}
        <Route
          path="/student-service/*"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "STUDENTSERVICE"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<StudentServiceDashboard />} />
          <Route
            path="academic-data"
            element={<AcademicDataManagementPage />}
          />
          <Route path="users" element={<UsersManagement />} />
          <Route path="students" element={<StudentProfilesManagement />} />
          <Route path="lecturers" element={<LecturerProfilesManagement />} />
          <Route path="departments" element={<DepartmentsManagement />} />
          <Route path="topics" element={<TopicsManagement />} />
          <Route path="tags" element={<TagsManagement />} />
          <Route
            path="catalogtopics"
            element={<CatalogTopicsWarehousePage />}
          />
        </Route>

        {/* fallback: nếu không match => điều hướng về /login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
};

export default AppRoutes;
