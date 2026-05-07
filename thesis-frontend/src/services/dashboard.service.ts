import { fetchData, FetchDataError } from "../api/fetchData";
import type { ApiResponse } from "../types/api";

export type DashboardRole =
  | "admin"
  | "lecturer"
  | "student"
  | "student-service";

export type DashboardRecord = Record<string, unknown>;

export interface DashboardQueryParams {
  page?: number;
  pageSize?: number;
  days?: number;
  limit?: number;
  lecturerCode?: string;
  roleName?: string;
  userCode?: string;
  studentCode?: string;
  topicCode?: string;
  departmentCode?: string;
  status?: string;
  search?: string;
}

export interface DashboardResponseEnvelope<TRecord = DashboardRecord> {
  items?: TRecord[];
  rows?: TRecord[];
  records?: TRecord[];
  data?: TRecord[];
  list?: TRecord[];
  result?: TRecord[];
  payload?: TRecord[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  summary?: DashboardRecord;
  stats?: DashboardRecord;
  metrics?: DashboardRecord;
  counts?: DashboardRecord;
  totals?: DashboardRecord;
  notifications?: unknown[];
  recentTopics?: unknown[];
  upcomingEvents?: unknown[];
  activities?: unknown[];
  traceId?: string;
}

export interface DefenseScheduleRecord {
  committeename: string;
  defensedate: string;
  roomcode: string;
  topictitle: string;
  studentfullname: string;
  lecturerrole: string;
}

export interface CommitteeRecord {
  committeeid: number;
  committeecode: string;
  committeename: string;
  departmentcode: string;
  defensedate: string;
  roomcode: string;
  state: string;
}

const ARRAY_CONTAINER_KEYS = [
  "items",
  "rows",
  "records",
  "data",
  "list",
  "result",
  "payload",
  "notifications",
  "recentTopics",
  "upcomingEvents",
  "activities",
];

const OBJECT_CONTAINER_KEYS = [
  "data",
  "summary",
  "stats",
  "metrics",
  "counts",
  "totals",
  "payload",
  "result",
  "dashboard",
  "meta",
];

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  return withScheme.endsWith("/") ? withScheme.slice(0, -1) : withScheme;
}

function buildCandidatePaths(role: DashboardRole): string[] {
  switch (role) {
    case "admin":
      return ["/Dashboards/admin/overview"];
    case "lecturer":
      return ["/Dashboards/lecturer/overview"];
    case "student-service":
      return ["/Dashboards/student-service/overview"];
    case "student":
    default:
      return ["/Dashboards/student/overview"];
  }
}

function buildSnapshotCandidatePaths(role: DashboardRole): string[] {
  switch (role) {
    case "admin":
      return ["/Dashboards/snapshots/period"];
    case "lecturer":
      return ["/Dashboards/snapshots/lecturer-workload"];
    case "student-service":
      return ["/Dashboards/student-service/backlog"];
    case "student":
    default:
      return ["/Dashboards/snapshots/period"];
  }
}

export function buildDashboardQuery(params: DashboardQueryParams = {}): string {
  const query = new URLSearchParams();

  const appendNumber = (key: string, value: number | undefined) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      query.set(key, String(value));
    }
  };

  appendNumber("page", params.page);
  appendNumber("pageSize", params.pageSize);
  appendNumber("days", params.days);
  appendNumber("limit", params.limit);

  if (params.lecturerCode) query.set("lecturerCode", params.lecturerCode);
  if (params.roleName) query.set("roleName", params.roleName);
  if (params.userCode) query.set("userCode", params.userCode);
  if (params.studentCode) query.set("studentCode", params.studentCode);
  if (params.topicCode) query.set("topicCode", params.topicCode);
  if (params.departmentCode) query.set("departmentCode", params.departmentCode);
  if (params.status) query.set("status", params.status);
  if (params.search) query.set("search", params.search);

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

function asRecord(value: unknown): DashboardRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as DashboardRecord;
}

function pickNestedRecord(source: unknown, key: string): unknown {
  const record = asRecord(source);
  if (!record) return undefined;
  const exact = record[key];
  if (exact !== undefined) return exact;

  const lowerKey = key.toLowerCase();
  for (const [candidateKey, candidateValue] of Object.entries(record)) {
    if (candidateKey.toLowerCase() === lowerKey) {
      return candidateValue;
    }
  }

  return undefined;
}

function collectArrayCandidates(source: unknown, depth = 0): unknown[] {
  if (!source || typeof source !== "object" || depth > 3) {
    return [];
  }

  if (Array.isArray(source)) {
    return source;
  }

  const record = source as Record<string, unknown>;
  for (const key of ARRAY_CONTAINER_KEYS) {
    const candidate = pickNestedRecord(record, key);
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  for (const key of OBJECT_CONTAINER_KEYS) {
    const candidate = pickNestedRecord(record, key);
    if (candidate && typeof candidate === "object") {
      const nested = collectArrayCandidates(candidate, depth + 1);
      if (nested.length > 0) {
        return nested;
      }
    }
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const nested = collectArrayCandidates(value, depth + 1);
      if (nested.length > 0) {
        return nested;
      }
    }
  }

  return [];
}

export function normalizeDashboardItems<TRecord = DashboardRecord>(
  payload: unknown,
): TRecord[] {
  if (Array.isArray(payload)) {
    return payload as TRecord[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidates = collectArrayCandidates(payload);
  if (candidates.length > 0) {
    return candidates as TRecord[];
  }

  return [payload as TRecord];
}

export function readDashboardValue(
  source: unknown,
  keys: string[],
  fallback: unknown = undefined,
): unknown {
  if (!source || typeof source !== "object") {
    return fallback;
  }

  const visited = new Set<unknown>();
  const search = (node: unknown, depth: number): unknown => {
    if (!node || typeof node !== "object" || visited.has(node) || depth > 4) {
      return undefined;
    }

    visited.add(node);
    const record = node as Record<string, unknown>;
    for (const key of keys) {
      for (const [candidateKey, candidateValue] of Object.entries(record)) {
        if (candidateKey.toLowerCase() === key.toLowerCase()) {
          return candidateValue;
        }
      }
    }

    for (const containerKey of OBJECT_CONTAINER_KEYS) {
      const candidate = pickNestedRecord(record, containerKey);
      if (candidate !== undefined) {
        const found = search(candidate, depth + 1);
        if (found !== undefined) {
          return found;
        }
      }
    }

    return undefined;
  };

  const found = search(source, 0);
  return found === undefined ? fallback : found;
}

export function readDashboardString(
  source: unknown,
  keys: string[],
  fallback = "",
): string {
  const value = readDashboardValue(source, keys, fallback);
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

export function readDashboardNumber(
  source: unknown,
  keys: string[],
  fallback = 0,
): number {
  const value = readDashboardValue(source, keys, fallback);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readDashboardBoolean(
  source: unknown,
  keys: string[],
  fallback = false,
): boolean {
  const value = readDashboardValue(source, keys, fallback);
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
}

async function fetchDashboardFromPaths<TResponse>(
  paths: string[],
  params: DashboardQueryParams,
): Promise<ApiResponse<TResponse>> {
  const query = buildDashboardQuery(params);
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      return await fetchData<ApiResponse<TResponse>>(`${path}${query}`);
    } catch (error) {
      lastError = error;
      if (
        error instanceof FetchDataError &&
        [404, 405].includes(error.status)
      ) {
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Không tìm thấy endpoint dashboard phù hợp.");
}

async function fetchDashboardEndpoint<TResponse>(
  path: string,
  params: DashboardQueryParams = {},
): Promise<ApiResponse<TResponse>> {
  const query = buildDashboardQuery(params);
  return await fetchData<ApiResponse<TResponse>>(`${path}${query}`);
}

export async function getDashboardData<TRecord = DashboardRecord>(
  role: DashboardRole,
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardFromPaths<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >(buildCandidatePaths(role), params);
}

export async function getDashboardSnapshot<TRecord = DashboardRecord>(
  role: DashboardRole,
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardFromPaths<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >(buildSnapshotCandidatePaths(role), params);
}

export async function getLecturerOverview<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/lecturer/overview", params);
}

export async function getLecturerReviewQueue<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/lecturer/review-queue", params);
}

export async function getLecturerScoringProgress<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/lecturer/scoring-progress", params);
}

export async function getLecturerDeadlineRisk<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/lecturer/deadline-risk", params);
}

export async function getLecturerDefenseSchedule<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/lecturer/defense-schedule", params);
}

export async function getLecturerProgressStatusBreakdown<
  TRecord = DashboardRecord,
>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/lecturer/progress-status-breakdown", params);
}

export async function getLecturerOverdueTrend<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/lecturer/overdue-trend", params);
}

export async function getLecturerTopicTypeBreakdown<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/lecturer/topic-type-breakdown", params);
}

export async function getLecturerReviewStatusBreakdown<
  TRecord = DashboardRecord,
>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/lecturer/review-status-breakdown", params);
}

export async function getLecturerCommittees<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/lecturer/committees", params);
}

export async function getLecturerWorkloadSnapshot<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/snapshots/lecturer-workload", params);
}

export async function getStudentServiceOverview<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/student-service/overview", params);
}

export async function getStudentServiceAtRisk<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/student-service/at-risk", params);
}

export async function getStudentServiceBacklog<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/student-service/backlog", params);
}

export async function getStudentServiceDepartmentBreakdown<
  TRecord = DashboardRecord,
>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/student-service/department-breakdown", params);
}

export async function getAdminOverview<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/admin/overview", params);
}

export async function getAdminPeriodFunnel<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/admin/period-funnel", params);
}

export async function getAdminCouncilCapacity<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/admin/council-capacity", params);
}

export async function getAdminScoreQuality<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/admin/score-quality", params);
}

export async function getAdminSlaBottleneck<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/admin/sla-bottleneck", params);
}

export async function getAdminSecurityAudit<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/admin/security-audit", params);
}

export async function getDailyKpiByRole<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/snapshots/daily-kpi-by-role", params);
}

export async function getAdminPeriodSnapshot<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/snapshots/period", params);
}

export async function getSlaBreachDaily<TRecord = DashboardRecord>(
  params: DashboardQueryParams = {},
): Promise<
  ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
> {
  return await fetchDashboardEndpoint<
    DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord
  >("/Dashboards/snapshots/sla-breach-daily", params);
}

export function normalizeDashboardResponse<TRecord = DashboardRecord>(
  response:
    | ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
    | null
    | undefined,
): DashboardResponseEnvelope<TRecord> {
  if (!response) {
    return {};
  }

  const payload = response.data;
  if (Array.isArray(payload)) {
    return { items: payload as TRecord[], totalCount: response.totalCount };
  }

  if (!payload || typeof payload !== "object") {
    return { totalCount: response.totalCount };
  }

  const record = payload as DashboardResponseEnvelope<TRecord>;
  return {
    ...record,
    totalCount: record.totalCount ?? response.totalCount,
  };
}

export function normalizeDashboardItemsFromResponse<TRecord = DashboardRecord>(
  response:
    | ApiResponse<DashboardResponseEnvelope<TRecord> | TRecord[] | TRecord>
    | null
    | undefined,
): TRecord[] {
  if (!response) return [];
  return normalizeDashboardItems<TRecord>(response.data);
}

export function getApiResponseTraceId(
  response:
    | ApiResponse<
        DashboardResponseEnvelope | DashboardRecord[] | DashboardRecord
      >
    | null
    | undefined,
): string | undefined {
  return response?.traceId;
}

export function normalizeApiUrl(value: string): string {
  return normalizeBaseUrl(value);
}
