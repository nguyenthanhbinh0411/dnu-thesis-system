import { normalizeRole } from "../utils/role";

const ACCESS_TOKEN_KEY = "access_token";
const EXPIRES_AT_KEY = "access_token_expires_at";
const LOGIN_RESPONSE_KEY = "login_response";
const AUTH_SESSION_KEY = "auth_session";
const EXPIRED_MESSAGE_KEY = "auth_expired_message";
const APP_USER_KEY = "app_user";
const STUDENT_CODE_KEY = "student_code";
const LECTURER_CODE_KEY = "lecturer_code";

let memoryAccessToken: string | null = null;
let memoryExpiresAt: string | null = null;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const json = atob(padded);
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function pickAllRoleClaims(payload: Record<string, unknown>): string[] {
  const roleCandidates = [
    payload.role,
    payload.Role,
    payload.roles,
    payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"],
  ];

  const allRoles: string[] = [];

  for (const candidate of roleCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      allRoles.push(normalizeRole(candidate.trim()));
    } else if (Array.isArray(candidate)) {
      candidate.forEach((item) => {
        if (typeof item === "string" && item.trim()) {
          allRoles.push(normalizeRole(item.trim()));
        }
      });
    }
  }

  // Deduplicate
  return Array.from(new Set(allRoles));
}

function pickRoleClaim(payload: Record<string, unknown>): string | null {
  const all = pickAllRoleClaims(payload);
  return all.length > 0 ? all[0] : null;
}

function getStorageList(): Storage[] {
  if (typeof window === "undefined") return [];
  return [window.localStorage, window.sessionStorage];
}

function readFromAnyStorage(key: string): string | null {
  for (const storage of getStorageList()) {
    const value = storage.getItem(key);
    if (value) return value;
  }
  return null;
}

function writeToStorageWithFallback(key: string, value: string): void {
  const storages = getStorageList();
  if (storages.length === 0) return;

  for (const storage of storages) {
    try {
      storage.setItem(key, value);
      return;
    } catch {
      // continue to fallback storage
    }
  }
}

function removeFromAllStorage(key: string): void {
  for (const storage of getStorageList()) {
    storage.removeItem(key);
  }
}

function parseExpireTime(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = Date.parse(expiresAt);
  if (Number.isNaN(ms)) return null;
  return ms;
}

function tryHydrateTokenFromLegacyPayload(): void {
  if (memoryAccessToken) return;

  const authSessionRaw = readFromAnyStorage(AUTH_SESSION_KEY);
  if (authSessionRaw) {
    try {
      const parsed = JSON.parse(authSessionRaw) as {
        accessToken?: string;
        expiresAt?: string;
      };
      if (parsed?.accessToken) {
        setAuthSession({
          accessToken: parsed.accessToken,
          expiresAt: parsed.expiresAt ?? null,
        });
        return;
      }
    } catch {
      // ignore malformed legacy payload
    }
  }

  const loginResponseRaw = readFromAnyStorage(LOGIN_RESPONSE_KEY);
  if (loginResponseRaw) {
    try {
      const parsed = JSON.parse(loginResponseRaw) as {
        accessToken?: string;
        expiresAt?: string;
      };
      if (parsed?.accessToken) {
        setAuthSession({
          accessToken: parsed.accessToken,
          expiresAt: parsed.expiresAt ?? null,
        });
      }
    } catch {
      // ignore malformed legacy payload
    }
  }
}

export function setAuthSession(input: {
  accessToken?: string | null;
  expiresAt?: string | null;
}): void {
  const token = input.accessToken?.trim() || null;
  const expiresAt = input.expiresAt?.trim() || null;

  memoryAccessToken = token;
  memoryExpiresAt = expiresAt;

  if (token) {
    writeToStorageWithFallback(ACCESS_TOKEN_KEY, token);
  } else {
    removeFromAllStorage(ACCESS_TOKEN_KEY);
  }

  if (expiresAt) {
    writeToStorageWithFallback(EXPIRES_AT_KEY, expiresAt);
  } else {
    removeFromAllStorage(EXPIRES_AT_KEY);
  }
}

export function getAccessToken(): string | null {
  if (!memoryAccessToken) {
    memoryAccessToken = readFromAnyStorage(ACCESS_TOKEN_KEY);
  }
  if (!memoryExpiresAt) {
    memoryExpiresAt = readFromAnyStorage(EXPIRES_AT_KEY);
  }

  if (!memoryAccessToken) {
    tryHydrateTokenFromLegacyPayload();
  }

  if (!memoryAccessToken) return null;

  const expired = isTokenExpired(memoryExpiresAt);
  if (expired) {
    clearAuthSession();
    return null;
  }

  return memoryAccessToken;
}

export function getRoleClaimFromAccessToken(
  token?: string | null,
): string | null {
  const roles = getAllRolesFromAccessToken(token);
  return roles.length > 0 ? roles[0] : null;
}

export function getAllRolesFromAccessToken(
  token?: string | null,
): string[] {
  const targetToken = token ?? getAccessToken();
  if (!targetToken) return [];
  const payload = decodeJwtPayload(targetToken);
  if (!payload) return [];
  return pickAllRoleClaims(payload);
}

export function getTokenExpiresAt(): string | null {
  if (!memoryExpiresAt) {
    memoryExpiresAt = readFromAnyStorage(EXPIRES_AT_KEY);
  }
  return memoryExpiresAt;
}

export function isTokenExpired(
  expiresAt: string | null = getTokenExpiresAt(),
): boolean {
  const expiresAtMs = parseExpireTime(expiresAt);
  if (!expiresAtMs) return false;
  return Date.now() >= expiresAtMs;
}

export function hasValidAccessToken(): boolean {
  return !!getAccessToken();
}

export function markSessionExpiredMessage(
  message = "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại",
): void {
  writeToStorageWithFallback(EXPIRED_MESSAGE_KEY, message);
}

export function consumeSessionExpiredMessage(): string | null {
  const message = readFromAnyStorage(EXPIRED_MESSAGE_KEY);
  if (!message) return null;
  removeFromAllStorage(EXPIRED_MESSAGE_KEY);
  return message;
}

export function clearAuthSession(): void {
  memoryAccessToken = null;
  memoryExpiresAt = null;

  const keys = [
    ACCESS_TOKEN_KEY,
    EXPIRES_AT_KEY,
    LOGIN_RESPONSE_KEY,
    AUTH_SESSION_KEY,
    APP_USER_KEY,
    STUDENT_CODE_KEY,
    LECTURER_CODE_KEY,
  ];

  keys.forEach((key) => removeFromAllStorage(key));
}

export function getStudentCode(): string | null {
  const value = readFromAnyStorage(STUDENT_CODE_KEY);
  return value?.trim() || null;
}

export function setStudentCode(value: string | null | undefined): void {
  const normalized = value?.trim() || "";
  if (!normalized) {
    removeFromAllStorage(STUDENT_CODE_KEY);
    return;
  }
  writeToStorageWithFallback(STUDENT_CODE_KEY, normalized);
}

export function getLecturerCode(): string | null {
  const value = readFromAnyStorage(LECTURER_CODE_KEY);
  return value?.trim() || null;
}

export function setLecturerCode(value: string | null | undefined): void {
  const normalized = value?.trim() || "";
  if (!normalized) {
    removeFromAllStorage(LECTURER_CODE_KEY);
    return;
  }
  writeToStorageWithFallback(LECTURER_CODE_KEY, normalized);
}

export const AuthSessionKeys = {
  ACCESS_TOKEN_KEY,
  EXPIRES_AT_KEY,
  LOGIN_RESPONSE_KEY,
  AUTH_SESSION_KEY,
  EXPIRED_MESSAGE_KEY,
  APP_USER_KEY,
  STUDENT_CODE_KEY,
  LECTURER_CODE_KEY,
};
