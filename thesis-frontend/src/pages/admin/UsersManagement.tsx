import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  KeyRound,
  Search,
  Trash2,
  UserPlus,
  UserRoundCog,
  Users,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { fetchData, FetchDataError } from "../../api/fetchData";
import { useToast } from "../../context/useToast";
import { useAuth } from "../../hooks/useAuth";
import type { ApiResponse } from "../../types/api";
import { normalizeRole } from "../../utils/role";
import { hasUserManagementPermission } from "../../utils/permissions";
import "../admin/Dashboard.css";

type UserRow = Record<string, unknown>;
type LinkedProfile = Record<string, unknown>;
type LinkedProfileType = "student" | "lecturer";

interface LinkedProfileState {
  profileType: LinkedProfileType;
  data: LinkedProfile;
}

type LinkedProfileEntry = [string, LinkedProfileState];

type UserCreatePayload = {
  userCode: string;
  password: string;
  role: string;
  fullName?: string;
  email?: string;
};

function getApiMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const source = payload as Record<string, unknown>;
    const candidate = source.message ?? source.title;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }
  return fallback;
}

function formatErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof FetchDataError) {
    return getApiMessage(error.data, fallback);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

async function requestApi<T>(
  path: string,
  options?: Parameters<typeof fetchData>[1],
  fallback = "Không thể xử lý yêu cầu.",
): Promise<{ data: T; totalCount: number }> {
  const response = await fetchData<ApiResponse<T>>(path, options);
  if (!response?.success) {
    throw new Error(response.message || response.title || fallback);
  }
  return {
    data: response.data as T,
    totalCount: Number(response.totalCount || 0),
  };
}

function normalizeItems(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload as Record<string, unknown>[];
  }
  if (payload && typeof payload === "object") {
    const source = payload as Record<string, unknown>;
    const nested = [
      source.items,
      source.records,
      source.result,
      source.data,
      source.list,
    ];
    const arr = nested.find((candidate) => Array.isArray(candidate));
    if (Array.isArray(arr)) {
      return arr as Record<string, unknown>[];
    }
  }
  return [];
}

async function findStudentProfileByUserCode(
  userCode: string,
): Promise<LinkedProfile | null> {
  const query = new URLSearchParams({
    page: "1",
    pageSize: "1",
    userCode,
  });
  const { data } = await requestApi<unknown>(
    `/StudentProfiles/get-list?${query.toString()}`,
    { method: "GET" },
    "Không thể tải dữ liệu StudentProfile.",
  );
  const items = normalizeItems(data);
  return items[0] ?? null;
}

async function findLecturerProfileByUserCode(
  userCode: string,
): Promise<LinkedProfile | null> {
  const query = new URLSearchParams({
    page: "1",
    pageSize: "1",
    userCode,
  });
  const { data } = await requestApi<unknown>(
    `/LecturerProfiles/get-list?${query.toString()}`,
    { method: "GET" },
    "Không thể tải dữ liệu LecturerProfile.",
  );
  const items = normalizeItems(data);
  return items[0] ?? null;
}

function resolveDisplayValue(
  user: UserRow,
  linked: LinkedProfileState | null,
  key: "fullName" | "email",
): string {
  const profile = linked?.data || {};
  if (key === "fullName") {
    const candidate = profile.fullName ?? user.fullName;
    return String(candidate ?? "");
  }
  const candidate = profile.studentEmail ?? profile.email ?? user.email;
  return String(candidate ?? "");
}

const UsersManagement: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const role = normalizeRole(auth.user?.role);
  const canList = hasUserManagementPermission(role, "users:list");
  const canDetail = hasUserManagementPermission(role, "users:detail");
  const canCreate = hasUserManagementPermission(role, "users:create");
  const canUpdateRole = hasUserManagementPermission(role, "users:update-role");
  const canDelete = hasUserManagementPermission(role, "users:delete");
  const canResetDefaultPassword = role === "ADMIN";

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchUserCode, setSearchUserCode] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedUserIDs, setSelectedUserIDs] = useState<number[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [selectedLinkedProfile, setSelectedLinkedProfile] =
    useState<LinkedProfileState | null>(null);
  const [linkedProfilesByUserCode, setLinkedProfilesByUserCode] = useState<
    Record<string, LinkedProfileState>
  >({});
  const [createForm, setCreateForm] = useState<UserCreatePayload>({
    userCode: "",
    password: "",
    role: "",
    fullName: "",
    email: "",
  });
  const [updateRoleValue, setUpdateRoleValue] = useState("");
  const [updateTemplate, setUpdateTemplate] = useState<Record<
    string,
    unknown
  > | null>(null);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize))),
    [totalCount, pageSize],
  );

  const toLogin = useCallback(() => {
    auth.logout();
    navigate("/login", { replace: true });
  }, [auth, navigate]);

  const handleApiError = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof FetchDataError) {
        if (error.status === 401) {
          addToast(
            "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.",
            "warning",
          );
          toLogin();
          return;
        }
        if (error.status === 403) {
          addToast("Bạn không có quyền", "error");
          return;
        }
        if (error.status === 400) {
          addToast(getApiMessage(error.data, fallback), "warning");
          return;
        }
        if (error.status >= 500) {
          addToast("Lỗi hệ thống, vui lòng thử lại sau.", "error");
          return;
        }
      }

      addToast(formatErrorMessage(error, fallback), "error");
    },
    [addToast, toLogin],
  );

  const loadUsers = useCallback(async () => {
    if (!canList) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        userCode: searchUserCode.trim(),
        role: roleFilter.trim(),
      });
      const { data, totalCount: total } = await requestApi<unknown>(
        `/Users/get-list?${query.toString()}`,
        { method: "GET" },
        "Không thể tải danh sách tài khoản.",
      );

      const list = Array.isArray(data)
        ? (data as UserRow[])
        : data &&
            typeof data === "object" &&
            Array.isArray((data as Record<string, unknown>).items)
          ? ((data as Record<string, unknown>).items as UserRow[])
          : [];

      const fallbackTotal = Array.isArray(data)
        ? data.length
        : data && typeof data === "object"
          ? Number(
              (data as Record<string, unknown>).totalCount ??
                (data as Record<string, unknown>).total ??
                list.length,
            )
          : list.length;

      setRows(list);
      setTotalCount(total > 0 ? total : fallbackTotal);
    } catch (error) {
      handleApiError(error, "Không thể tải danh sách tài khoản.");
    } finally {
      setLoading(false);
    }
  }, [canList, handleApiError, page, pageSize, roleFilter, searchUserCode]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!rows.length) {
      setLinkedProfilesByUserCode({});
      return;
    }

    let cancelled = false;
    const loadLinkedProfiles = async () => {
      const entries: Array<LinkedProfileEntry | null> = await Promise.all(
        rows.map(async (row) => {
          const userCode = String(row.userCode ?? "").trim();
          const roleName = String(row.role ?? "")
            .trim()
            .toUpperCase();
          if (!userCode) return null;

          try {
            if (roleName === "STUDENT") {
              const profile = await findStudentProfileByUserCode(userCode);
              if (profile) {
                return [
                  userCode,
                  { profileType: "student" as const, data: profile },
                ] as LinkedProfileEntry;
              }
            }

            if (roleName === "LECTURER") {
              const profile = await findLecturerProfileByUserCode(userCode);
              if (profile) {
                return [
                  userCode,
                  { profileType: "lecturer" as const, data: profile },
                ] as LinkedProfileEntry;
              }
            }
          } catch {
            return null;
          }

          return null;
        }),
      );

      if (cancelled) return;

      const map = entries.reduce<Record<string, LinkedProfileState>>(
        (acc, entry) => {
          if (!entry) return acc;
          const [userCode, profile] = entry;
          acc[userCode] = profile;
          return acc;
        },
        {},
      );
      setLinkedProfilesByUserCode(map);
    };

    void loadLinkedProfiles();

    return () => {
      cancelled = true;
    };
  }, [rows]);

  const openDetail = async (row: UserRow) => {
    if (!canDetail) return;
    const code = String(row.userCode ?? row.code ?? "").trim();
    if (!code) {
      addToast("Không xác định được mã user.", "error");
      return;
    }
    try {
      const { data } = await requestApi<UserRow>(
        `/Users/get-detail/${encodeURIComponent(code)}`,
        { method: "GET" },
        "Không thể tải chi tiết tài khoản.",
      );

      const roleName = String(data.role ?? row.role ?? "")
        .trim()
        .toUpperCase();
      let linked: LinkedProfileState | null = null;
      if (roleName === "STUDENT") {
        const profile = await findStudentProfileByUserCode(code);
        if (profile) {
          linked = { profileType: "student", data: profile };
        }
      }
      if (roleName === "LECTURER") {
        const profile = await findLecturerProfileByUserCode(code);
        if (profile) {
          linked = { profileType: "lecturer", data: profile };
        }
      }

      setSelectedUser(data);
      setSelectedLinkedProfile(linked);
      setShowDetailModal(true);
    } catch (error) {
      handleApiError(error, "Không thể tải chi tiết tài khoản.");
    }
  };

  const openUpdateRole = async (row: UserRow) => {
    if (!canUpdateRole) return;
    const id = Number(row.userID ?? row.id ?? 0);
    if (!id) {
      addToast("Không xác định được userID.", "error");
      return;
    }
    try {
      const { data } = await requestApi<Record<string, unknown>>(
        `/Users/get-update/${id}`,
        { method: "GET" },
        "Không thể tải dữ liệu cập nhật user.",
      );
      setSelectedUser(row);
      setUpdateTemplate(data);
      setUpdateRoleValue(String(data.role ?? row.role ?? ""));
      setShowUpdateModal(true);
    } catch (error) {
      handleApiError(error, "Không thể tải dữ liệu cập nhật user.");
    }
  };

  const submitCreate = async () => {
    if (!canCreate) return;
    if (!createForm.userCode.trim()) {
      addToast("userCode là bắt buộc.", "warning");
      return;
    }
    if (!createForm.password.trim()) {
      addToast("password là bắt buộc.", "warning");
      return;
    }
    if (!createForm.role.trim()) {
      addToast("role là bắt buộc.", "warning");
      return;
    }

    setSaving(true);
    try {
      await requestApi<unknown>(
        "/Users/create",
        {
          method: "POST",
          body: {
            userCode: createForm.userCode.trim(),
            password: createForm.password,
            role: createForm.role.trim(),
            fullName: createForm.fullName?.trim() || undefined,
            email: createForm.email?.trim() || undefined,
          },
        },
        "Không thể tạo tài khoản.",
      );
      addToast("Tạo tài khoản thành công.", "success");
      setShowCreateModal(false);
      setCreateForm({
        userCode: "",
        password: "",
        role: "",
        fullName: "",
        email: "",
      });
      await loadUsers();
    } catch (error) {
      handleApiError(error, "Không thể tạo tài khoản.");
    } finally {
      setSaving(false);
    }
  };

  const submitUpdateRole = async () => {
    if (!canUpdateRole || !selectedUser) return;
    const id = Number(selectedUser.userID ?? selectedUser.id ?? 0);
    if (!id) {
      addToast("Không xác định được userID.", "error");
      return;
    }
    if (!updateRoleValue.trim()) {
      addToast("role là bắt buộc.", "warning");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...(updateTemplate || {}),
        role: updateRoleValue.trim(),
      };
      await requestApi<unknown>(
        `/Users/update/${id}`,
        { method: "PUT", body: payload },
        "Không thể cập nhật role user.",
      );
      addToast("Cập nhật role thành công.", "success");
      setShowUpdateModal(false);
      await loadUsers();
    } catch (error) {
      handleApiError(error, "Không thể cập nhật role user.");
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (row: UserRow) => {
    if (!canDelete) return;
    const id = Number(row.userID ?? row.id ?? 0);
    if (!id) {
      addToast("Không xác định được userID.", "error");
      return;
    }
    const confirmed = window.confirm("Bạn chắc chắn muốn xóa tài khoản này?");
    if (!confirmed) return;

    setSaving(true);
    try {
      await requestApi<unknown>(
        `/Users/delete/${id}`,
        { method: "DELETE" },
        "Không thể xóa tài khoản.",
      );
      addToast("Xóa tài khoản thành công.", "success");
      await loadUsers();
    } catch (error) {
      handleApiError(error, "Không thể xóa tài khoản.");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!canDelete || selectedUserIDs.length === 0) return;

    const confirmed = window.confirm(
      `Bạn chắc chắn muốn xóa ${selectedUserIDs.length} tài khoản đã chọn?`
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const results = await Promise.allSettled(
        selectedUserIDs.map((id) =>
          requestApi<unknown>(`/Users/delete/${id}`, { method: "DELETE" })
        )
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;

      if (succeeded > 0) {
        addToast(`Đã xóa thành công ${succeeded} tài khoản.`, "success");
      }
      if (failed > 0) {
        addToast(`Xóa thất bại ${failed} tài khoản.`, "error");
      }

      setSelectedUserIDs([]);
      await loadUsers();
    } catch (error) {
      handleApiError(error, "Có lỗi xảy ra trong quá trình xóa hàng loạt.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSelectRow = (userID: number) => {
    setSelectedUserIDs((prev) =>
      prev.includes(userID)
        ? prev.filter((id) => id !== userID)
        : [...prev, userID]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUserIDs.length === rows.length && rows.length > 0) {
      setSelectedUserIDs([]);
    } else {
      const allIDs = rows
        .map((r) => Number(r.userID ?? r.id ?? 0))
        .filter((id) => id !== 0);
      setSelectedUserIDs(allIDs);
    }
  };

  const resetDefaultPassword = async (row: UserRow) => {
    if (!canResetDefaultPassword) return;

    const userCode = String(row.userCode ?? "").trim();
    if (!userCode) {
      addToast("Không xác định được userCode.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Bạn có chắc muốn reset mật khẩu mặc định cho ${userCode}? Mật khẩu mới sẽ bằng userCode.`,
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const { data } = await requestApi<{
        userCode: string;
        defaultPassword?: string;
        message?: string;
      }>(
        "/Auth/reset-password-default",
        {
          method: "POST",
          body: { userCode },
        },
        "Không thể reset mật khẩu mặc định.",
      );

      addToast(
        data?.message ||
          `Đã đặt lại mật khẩu mặc định cho ${data?.userCode || userCode}.`,
        "success",
      );
    } catch (error) {
      handleApiError(error, "Không thể reset mật khẩu mặc định.");
    } finally {
      setSaving(false);
    }
  };

  if (!canList) {
    return <Navigate to="/403" replace />;
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>
          <Users size={28} style={{ marginRight: 10, color: "#f37021" }} />
          Quản lý tài khoản
        </h1>
        <p>
          Quản trị danh sách user, phân quyền role và thao tác CRUD theo UI
          permission.
        </p>
      </div>

      <div
        style={{
          background: "white",
          padding: "16px 18px",
          borderRadius: 12,
          marginBottom: 20,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            flex: "1 1 420px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 240px", position: "relative" }}>
            <Search
              size={18}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
              }}
            />
            <input
              value={searchUserCode}
              onChange={(event) => setSearchUserCode(event.target.value)}
              placeholder="Lọc theo userCode"
              style={{
                width: "100%",
                padding: "9px 10px 9px 34px",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
              }}
            />
          </div>

          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            style={{
              padding: "9px 10px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
            }}
          >
            <option value="">Tất cả role</option>
            <option value="ADMIN">ADMIN</option>
            <option value="STUDENTSERVICE">STUDENTSERVICE</option>
            <option value="LECTURER">LECTURER</option>
            <option value="STUDENT">STUDENT</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setPage(1);
              void loadUsers();
            }}
            style={{
              border: "1px solid #cbd5e1",
              background: "#fff",
              borderRadius: 8,
              padding: "9px 12px",
              fontWeight: 600,
            }}
          >
            Tìm kiếm
          </button>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              border: "none",
              background: "#f37021",
              color: "#fff",
              borderRadius: 8,
              padding: "9px 12px",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <UserPlus size={16} /> Tạo user
          </button>
        )}
      </div>

      {selectedUserIDs.length > 0 && (
        <div
          style={{
            background: "#fff1f2",
            border: "1px solid #fecaca",
            padding: "12px 20px",
            borderRadius: 12,
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            animation: "slideDown 0.3s ease-out",
            boxShadow: "0 4px 12px rgba(185, 28, 28, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                background: "#b91c1c",
                color: "#fff",
                width: 24,
                height: 24,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {selectedUserIDs.length}
            </div>
            <span style={{ color: "#991b1b", fontWeight: 600, fontSize: 14 }}>
              Tài khoản đang được chọn
            </span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => setSelectedUserIDs([])}
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                padding: "8px 12px",
              }}
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              style={{
                background: "#b91c1c",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontWeight: 700,
                fontSize: 14,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(185, 28, 28, 0.2)",
              }}
            >
              <Trash2 size={16} /> Xóa vĩnh viễn
            </button>
          </div>
        </div>
      )}

      <div className="recent-topics-section" style={{ overflowX: "auto" }}>
        <table className="topics-table">
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={
                    rows.length > 0 && selectedUserIDs.length === rows.length
                  }
                  onChange={toggleSelectAll}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
              </th>
              <th>userID</th>
              <th>userCode</th>
              <th>fullName</th>
              <th>email</th>
              <th>role</th>
              <th style={{ textAlign: "center" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>Đang tải dữ liệu...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6}>Không có dữ liệu tài khoản.</td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = String(row.userID ?? row.id ?? "");
                return (
                  <tr
                    key={id || String(row.userCode ?? Math.random())}
                    style={{
                      background: selectedUserIDs.includes(Number(id))
                        ? "#fff7ed"
                        : "transparent",
                    }}
                  >
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedUserIDs.includes(Number(id))}
                        onChange={() => toggleSelectRow(Number(id))}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                    </td>
                    <td>{String(row.userID ?? row.id ?? "")}</td>
                    <td>{String(row.userCode ?? "")}</td>
                    <td>
                      {resolveDisplayValue(
                        row,
                        linkedProfilesByUserCode[String(row.userCode ?? "")] ||
                          null,
                        "fullName",
                      )}
                    </td>
                    <td>
                      {resolveDisplayValue(
                        row,
                        linkedProfilesByUserCode[String(row.userCode ?? "")] ||
                          null,
                        "email",
                      )}
                    </td>
                    <td>
                      <span className="status-badge in-progress">
                        {String(row.role ?? "")}
                      </span>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        {canDetail && (
                          <button
                            type="button"
                            onClick={() => void openDetail(row)}
                            title="Chi tiết"
                            style={{
                              border: "1px solid #cbd5e1",
                              background: "#fff",
                              borderRadius: 8,
                              padding: 6,
                            }}
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        {canUpdateRole && (
                          <button
                            type="button"
                            onClick={() => void openUpdateRole(row)}
                            title="Đổi role"
                            style={{
                              border: "1px solid #cbd5e1",
                              background: "#fff",
                              borderRadius: 8,
                              padding: 6,
                            }}
                          >
                            <UserRoundCog size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void removeUser(row)}
                            title="Xóa"
                            style={{
                              border: "1px solid #fecaca",
                              background: "#fff",
                              color: "#b91c1c",
                              borderRadius: 8,
                              padding: 6,
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        {canResetDefaultPassword && (
                          <button
                            type="button"
                            onClick={() => void resetDefaultPassword(row)}
                            title="Reset mật khẩu mặc định"
                            style={{
                              border: "1px solid #fdba74",
                              background: "#fff",
                              color: "#c2410c",
                              borderRadius: 8,
                              padding: 6,
                            }}
                          >
                            <KeyRound size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div style={{ color: "#64748b", fontSize: 13 }}>
            Tổng user: <strong>{totalCount}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "6px 8px",
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "6px 10px",
                background: "#fff",
              }}
            >
              Trước
            </button>
            <span style={{ minWidth: 94, textAlign: "center", fontSize: 13 }}>
              Trang {page} / {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount || loading}
              onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "6px 10px",
                background: "#fff",
              }}
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      {showCreateModal && canCreate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 80,
            padding: 14,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 640,
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ margin: 0 }}>Tạo tài khoản</h3>
            </div>
            <div style={{ padding: 16, display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>userCode *</span>
                <input
                  value={createForm.userCode}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      userCode: event.target.value,
                    }))
                  }
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: 10,
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>password *</span>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: 10,
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>role *</span>
                <select
                  value={createForm.role}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      role: event.target.value,
                    }))
                  }
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: 10,
                  }}
                >
                  <option value="">Chọn role</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="STUDENTSERVICE">STUDENTSERVICE</option>
                  <option value="LECTURER">LECTURER</option>
                  <option value="STUDENT">STUDENT</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>fullName</span>
                <input
                  value={createForm.fullName || ""}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      fullName: event.target.value,
                    }))
                  }
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: 10,
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>email</span>
                <input
                  value={createForm.email || ""}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: 10,
                  }}
                />
              </label>
            </div>
            <div
              style={{
                padding: 16,
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={saving}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void submitCreate()}
                disabled={saving}
                style={{
                  border: "none",
                  background: "#f37021",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                {saving ? "Đang tạo..." : "Tạo user"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpdateModal && canUpdateRole && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 80,
            padding: 14,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ margin: 0 }}>Cập nhật role user</h3>
            </div>
            <div style={{ padding: 16, display: "grid", gap: 8 }}>
              <div>
                userCode:{" "}
                <strong>{String(selectedUser?.userCode ?? "")}</strong>
              </div>
              <label style={{ display: "grid", gap: 6 }}>
                <span>role *</span>
                <select
                  value={updateRoleValue}
                  onChange={(event) => setUpdateRoleValue(event.target.value)}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: 10,
                  }}
                >
                  <option value="">Chọn role</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="STUDENTSERVICE">STUDENTSERVICE</option>
                  <option value="LECTURER">LECTURER</option>
                  <option value="STUDENT">STUDENT</option>
                </select>
              </label>
            </div>
            <div
              style={{
                padding: 16,
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => setShowUpdateModal(false)}
                disabled={saving}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void submitUpdateRole()}
                disabled={saving}
                style={{
                  border: "none",
                  background: "#f37021",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                {saving ? "Đang cập nhật..." : "Lưu role"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && canDetail && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 80,
            padding: 14,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 700,
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ margin: 0 }}>Chi tiết tài khoản</h3>
            </div>
            <div style={{ padding: 16, display: "grid", gap: 8 }}>
              {Object.entries(selectedUser || {}).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "200px 1fr",
                    gap: 8,
                  }}
                >
                  <strong>{key}</strong>
                  <span>{String(value ?? "")}</span>
                </div>
              ))}

              <div
                style={{
                  marginTop: 10,
                  paddingTop: 12,
                  borderTop: "1px dashed #cbd5e1",
                  display: "grid",
                  gap: 8,
                }}
              >
                <h4 style={{ margin: 0, color: "#0f172a" }}>
                  Thông tin hồ sơ liên kết theo userCode
                </h4>
                {selectedLinkedProfile ? (
                  <>
                    <div style={{ color: "#475569", fontSize: 13 }}>
                      Nguồn dữ liệu:{" "}
                      {selectedLinkedProfile.profileType === "student"
                        ? "StudentProfiles"
                        : "LecturerProfiles"}
                    </div>
                    {Object.entries(selectedLinkedProfile.data).map(
                      ([key, value]) => (
                        <div
                          key={`linked-${key}`}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "200px 1fr",
                            gap: 8,
                          }}
                        >
                          <strong>{key}</strong>
                          <span>{String(value ?? "")}</span>
                        </div>
                      ),
                    )}
                  </>
                ) : (
                  <div style={{ color: "#64748b" }}>
                    Không tìm thấy hồ sơ StudentProfile/LecturerProfile theo
                    userCode.
                  </div>
                )}
              </div>
            </div>
            <div
              style={{
                padding: 16,
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedLinkedProfile(null);
                }}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagement;
