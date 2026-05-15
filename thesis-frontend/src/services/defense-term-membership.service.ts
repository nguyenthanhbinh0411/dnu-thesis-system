import { fetchData } from "../api/fetchData";
import type { ApiResponse } from "../types/api";

export type DefenseTermStudentFilter = {
  defenseTermId?: number | string;
  studentProfileID?: number | string;
  studentCode?: string;
  userCode?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortDescending?: boolean;
  page?: number;
  pageSize?: number;
};

export type DefenseTermLecturerFilter = {
  defenseTermId?: number | string;
  lecturerProfileID?: number | string;
  lecturerCode?: string;
  userCode?: string;
  isPrimary?: boolean;
  search?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortDescending?: boolean;
  page?: number;
  pageSize?: number;
};

export type StudentProfileFilter = {
  search?: string;
  minGPA?: number | string;
  maxGPA?: number | string;
  classCode?: string;
  facultyCode?: string;
  departmentCode?: string;
  studentCode?: string;
  userCode?: string;
  page?: number;
  pageSize?: number;
  excludeDefenseTermId?: number | string;
};

export type LecturerProfileFilter = {
  search?: string;
  departmentCode?: string;
  degree?: string;
  tagCodes?: string;
  tags?: string;
  lecturerCode?: string;
  userCode?: string;
  page?: number;
  pageSize?: number;
  excludeDefenseTermId?: number | string;
};

export type DefenseTermStudentPayload = {
  defenseTermId: number;
  studentProfileID: number;
  studentCode?: string;
  userCode?: string;
};

export type DefenseTermLecturerPayload = {
  defenseTermId: number;
  lecturerProfileID: number;
  lecturerCode?: string;
  userCode?: string;
  isPrimary?: boolean;
};

export type DefenseTermStudentRecord = Record<string, unknown>;
export type DefenseTermLecturerRecord = Record<string, unknown>;
export type StudentProfileRecord = Record<string, unknown>;
export type LecturerProfileRecord = Record<string, unknown>;

function appendQuery(
  params: URLSearchParams,
  key: string,
  value: unknown,
): void {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === "boolean") {
    params.append(key, value ? "true" : "false");
    return;
  }

  const text = String(value).trim();
  if (!text) {
    return;
  }

  params.append(key, text);
}

export function buildQueryString(input: Record<string, unknown>): string {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) =>
    appendQuery(params, key, value),
  );
  const query = params.toString();
  return query ? `?${query}` : "";
}

async function requestApiData<T>(
  path: string,
  options?: Parameters<typeof fetchData>[1],
  fallback = "Không thể tải dữ liệu.",
): Promise<{ data: T; totalCount: number }> {
  const response = await fetchData<ApiResponse<T>>(path, options);
  if (!response?.success) {
    throw new Error(response?.message || response?.title || fallback);
  }

  return {
    data: response.data as T,
    totalCount: Number(response.totalCount || response.TotalCount || 0),
  };
}

function normalizeList(payload: unknown): {
  items: Record<string, unknown>[];
  fallbackTotal: number;
} {
  if (Array.isArray(payload)) {
    return {
      items: payload as Record<string, unknown>[],
      fallbackTotal: payload.length,
    };
  }

  if (payload && typeof payload === "object") {
    const source = payload as Record<string, unknown>;
    const candidates = [
      source.items,
      source.Items,
      source.records,
      source.Records,
      source.data,
      source.Data,
      source.list,
      source.List,
      source.result,
      source.Result,
    ];
    const items = candidates.find((candidate) => Array.isArray(candidate));
    if (Array.isArray(items)) {
      return {
        items: items as Record<string, unknown>[],
        fallbackTotal: Number(
          source.totalCount ??
            source.TotalCount ??
            source.total ??
            source.Total ??
            items.length,
        ),
      };
    }
  }

  return { items: [], fallbackTotal: 0 };
}

export async function listDefenseTermStudents(
  filter: DefenseTermStudentFilter = {},
): Promise<{ data: Record<string, unknown>[]; totalCount: number }> {
  const query = buildQueryString(filter);
  const response = await requestApiData<unknown>(
    `/DefenseTermStudents/get-list${query}`,
    { method: "GET" },
    "Không thể tải danh sách sinh viên trong đợt.",
  );
  const normalized = normalizeList(response.data);
  return {
    data: normalized.items,
    totalCount:
      response.totalCount > 0 ? response.totalCount : normalized.fallbackTotal,
  };
}

export async function getDefenseTermStudentDetail(id: number | string) {
  return requestApiData<Record<string, unknown>>(
    `/DefenseTermStudents/get-detail/${encodeURIComponent(String(id))}`,
    { method: "GET" },
    "Không thể tải chi tiết sinh viên trong đợt.",
  );
}

export async function getDefenseTermStudentCreateTemplate() {
  return requestApiData<Record<string, unknown>>(
    "/DefenseTermStudents/get-create",
    { method: "GET" },
    "Không thể tải mẫu tạo mới sinh viên trong đợt.",
  );
}

export async function createDefenseTermStudent(
  payload: DefenseTermStudentPayload,
) {
  return requestApiData<Record<string, unknown>>(
    "/DefenseTermStudents/create",
    { method: "POST", body: payload },
    "Không thể tạo sinh viên trong đợt.",
  );
}

export async function getDefenseTermStudentUpdateTemplate(id: number | string) {
  return requestApiData<Record<string, unknown>>(
    `/DefenseTermStudents/get-update/${encodeURIComponent(String(id))}`,
    { method: "GET" },
    "Không thể tải dữ liệu cập nhật sinh viên trong đợt.",
  );
}

export async function updateDefenseTermStudent(
  id: number | string,
  payload: DefenseTermStudentPayload,
) {
  return requestApiData<Record<string, unknown>>(
    `/DefenseTermStudents/update/${encodeURIComponent(String(id))}`,
    { method: "PUT", body: payload },
    "Không thể cập nhật sinh viên trong đợt.",
  );
}

export async function deleteDefenseTermStudent(id: number | string) {
  return requestApiData<Record<string, unknown>>(
    `/DefenseTermStudents/delete/${encodeURIComponent(String(id))}`,
    { method: "DELETE" },
    "Không thể xóa sinh viên trong đợt.",
  );
}

export async function listDefenseTermLecturers(
  filter: DefenseTermLecturerFilter = {},
): Promise<{ data: Record<string, unknown>[]; totalCount: number }> {
  const query = buildQueryString(filter);
  const response = await requestApiData<unknown>(
    `/DefenseTermLecturers/get-list${query}`,
    { method: "GET" },
    "Không thể tải danh sách giảng viên trong đợt.",
  );
  const normalized = normalizeList(response.data);
  return {
    data: normalized.items,
    totalCount:
      response.totalCount > 0 ? response.totalCount : normalized.fallbackTotal,
  };
}

export async function getDefenseTermLecturerDetail(id: number | string) {
  return requestApiData<Record<string, unknown>>(
    `/DefenseTermLecturers/get-detail/${encodeURIComponent(String(id))}`,
    { method: "GET" },
    "Không thể tải chi tiết giảng viên trong đợt.",
  );
}

export async function getDefenseTermLecturerCreateTemplate() {
  return requestApiData<Record<string, unknown>>(
    "/DefenseTermLecturers/get-create",
    { method: "GET" },
    "Không thể tải mẫu tạo mới giảng viên trong đợt.",
  );
}

export async function createDefenseTermLecturer(
  payload: DefenseTermLecturerPayload,
) {
  return requestApiData<Record<string, unknown>>(
    "/DefenseTermLecturers/create",
    { method: "POST", body: payload },
    "Không thể tạo giảng viên trong đợt.",
  );
}

export async function getDefenseTermLecturerUpdateTemplate(
  id: number | string,
) {
  return requestApiData<Record<string, unknown>>(
    `/DefenseTermLecturers/get-update/${encodeURIComponent(String(id))}`,
    { method: "GET" },
    "Không thể tải dữ liệu cập nhật giảng viên trong đợt.",
  );
}

export async function updateDefenseTermLecturer(
  id: number | string,
  payload: DefenseTermLecturerPayload,
) {
  return requestApiData<Record<string, unknown>>(
    `/DefenseTermLecturers/update/${encodeURIComponent(String(id))}`,
    { method: "PUT", body: payload },
    "Không thể cập nhật giảng viên trong đợt.",
  );
}

export async function deleteDefenseTermLecturer(id: number | string) {
  return requestApiData<Record<string, unknown>>(
    `/DefenseTermLecturers/delete/${encodeURIComponent(String(id))}`,
    { method: "DELETE" },
    "Không thể xóa giảng viên trong đợt.",
  );
}

export async function listStudentProfiles(
  filter: StudentProfileFilter = {},
): Promise<{ data: Record<string, unknown>[]; totalCount: number }> {
  const query = buildQueryString(filter);
  const response = await requestApiData<unknown>(
    `/StudentProfiles/get-list${query}`,
    { method: "GET" },
    "Không thể tải danh sách sinh viên.",
  );
  const normalized = normalizeList(response.data);
  return {
    data: normalized.items,
    totalCount:
      response.totalCount > 0 ? response.totalCount : normalized.fallbackTotal,
  };
}

export async function listLecturerProfiles(
  filter: LecturerProfileFilter = {},
): Promise<{ data: Record<string, unknown>[]; totalCount: number }> {
  const query = buildQueryString(filter);
  const response = await requestApiData<unknown>(
    `/LecturerProfiles/get-list${query}`,
    { method: "GET" },
    "Không thể tải danh sách giảng viên.",
  );
  const normalized = normalizeList(response.data);
  return {
    data: normalized.items,
    totalCount:
      response.totalCount > 0 ? response.totalCount : normalized.fallbackTotal,
  };
}
