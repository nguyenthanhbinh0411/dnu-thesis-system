import { FetchDataError, fetchData } from "../api/fetchData";
import type { ApiResponse } from "../types/api";
import { pickCaseInsensitiveValue, readEnvelopeData } from "../utils/api-envelope";
import { normalizeDefensePeriodId } from "../utils/defensePeriod";

export type CurrentDefenseRole = "student" | "lecturer";

export type CurrentDefensePeriod = {
  periodId: number;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

export type CurrentDefensePeriodFailureCode =
  | "NOT_MAPPED"
  | "AMBIGUOUS"
  | "INVALID_CONTRACT"
  | "REQUEST_FAILED";

export type CurrentDefensePeriodResult =
  | {
      ok: true;
      period: CurrentDefensePeriod;
    }
  | {
      ok: false;
      status: number | null;
      code: CurrentDefensePeriodFailureCode;
      message: string;
    };

export type CurrentLecturerDefenseAccessResult =
  | {
      ok: true;
      period: CurrentDefensePeriod;
      councilListLocked: boolean | null;
      hasCommitteeAccess: boolean;
      committeeCount: number;
    }
  | {
      ok: false;
      status: number | null;
      code: CurrentDefensePeriodFailureCode;
      message: string;
    };

const CURRENT_SNAPSHOT_ENDPOINT_BY_ROLE: Record<CurrentDefenseRole, string> = {
  student: "/student-defense/current/snapshot",
  lecturer: "/lecturer-defense/current/snapshot",
};

const CURRENT_ACCESS_ENDPOINT_BY_ROLE: Record<CurrentDefenseRole, string> = {
  student: "/student-defense/current/snapshot",
  lecturer: "/lecturer-defense/current/access",
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toText = (value: unknown, fallback = ""): string => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const toIsoDateOrNull = (value: unknown): string | null => {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is Record<string, unknown> => Boolean(toRecord(item)));
};

const readApiErrorMessage = (payload: unknown): string | null => {
  const record = toRecord(payload);
  if (!record) {
    return null;
  }

  const directMessage = toText(
    pickCaseInsensitiveValue(record, ["message", "Message", "title", "Title"], ""),
  );
  if (directMessage) {
    return directMessage;
  }

  const errorRecord = toRecord(
    pickCaseInsensitiveValue(record, ["errors", "Errors"], null),
  );
  if (!errorRecord) {
    return null;
  }

  for (const value of Object.values(errorRecord)) {
    if (Array.isArray(value) && value.length > 0) {
      const first = toText(value[0], "");
      if (first) {
        return first;
      }
    }
  }

  return null;
};

const mapCurrentPeriod = (
  periodRecord: Record<string, unknown> | null,
): CurrentDefensePeriod | null => {
  if (!periodRecord) {
    return null;
  }

  const periodId = normalizeDefensePeriodId(
    pickCaseInsensitiveValue(
      periodRecord,
      ["defenseTermId", "DefenseTermId", "periodId", "PeriodId", "id", "Id"],
      null,
    ),
  );

  if (periodId == null || periodId <= 0) {
    return null;
  }

  return {
    periodId,
    name:
      toText(
        pickCaseInsensitiveValue(periodRecord, ["name", "Name", "title", "Title"], ""),
      ) || `Đợt ${periodId}`,
    status:
      toText(
        pickCaseInsensitiveValue(periodRecord, ["status", "Status", "state", "State"], "UNKNOWN"),
      ) || "UNKNOWN",
    startDate: toIsoDateOrNull(
      pickCaseInsensitiveValue(periodRecord, ["startDate", "StartDate", "startedAt", "StartedAt"], null),
    ),
    endDate: toIsoDateOrNull(
      pickCaseInsensitiveValue(periodRecord, ["endDate", "EndDate", "endedAt", "EndedAt"], null),
    ),
  };
};

const extractLecturerDefenseAccess = (
  payload: Record<string, unknown> | null,
): {
  councilListLocked: boolean | null;
  hasCommitteeAccess: boolean;
  committeeCount: number;
} => {
  const snapshotRecord = toRecord(
    pickCaseInsensitiveValue(payload ?? {}, ["snapshot", "Snapshot"], payload),
  );
  const councilListLockedValue = pickCaseInsensitiveValue(
    snapshotRecord ?? payload ?? {},
    ["councilListLocked", "CouncilListLocked"],
    pickCaseInsensitiveValue(payload ?? {}, ["councilListLocked", "CouncilListLocked"], null),
  );
  const councilListLocked =
    typeof councilListLockedValue === "boolean" ? councilListLockedValue : null;

  const committeeCountValue = pickCaseInsensitiveValue(
    snapshotRecord ?? payload ?? {},
    ["committeeCount", "CommitteeCount"],
    pickCaseInsensitiveValue(payload ?? {}, ["committeeCount", "CommitteeCount"], null),
  );
  const committeeCount =
    typeof committeeCountValue === "number"
      ? committeeCountValue
      : toRecordArray(
          pickCaseInsensitiveValue(snapshotRecord ?? {}, ["committees", "Committees", "items", "Items"], []),
        ).length;

  return {
    councilListLocked,
    hasCommitteeAccess: councilListLocked === true && committeeCount > 0,
    committeeCount,
  };
};

export const fetchCurrentDefensePeriod = async (
  role: CurrentDefenseRole,
): Promise<CurrentDefensePeriodResult> => {
  const endpoint = CURRENT_SNAPSHOT_ENDPOINT_BY_ROLE[role];

  try {
    const response = await fetchData<ApiResponse<Record<string, unknown>>>(endpoint, {
      method: "GET",
    });

    const payload = toRecord(readEnvelopeData<Record<string, unknown>>(response));
    const period = mapCurrentPeriod(
      toRecord(pickCaseInsensitiveValue(payload ?? {}, ["period", "Period"], payload)),
    );

    if (!period) {
      return {
        ok: false,
        status: null,
        code: "INVALID_CONTRACT",
        message: "Snapshot hiện tại không chứa thông tin đợt bảo vệ hợp lệ.",
      };
    }

    return {
      ok: true,
      period,
    };
  } catch (error) {
    if (error instanceof FetchDataError) {
      const status = typeof error.status === "number" ? error.status : null;
      const apiMessage = readApiErrorMessage(error.data);

      if (status === 404) {
        return {
          ok: false,
          status,
          code: "NOT_MAPPED",
          message:
            apiMessage ??
            "Không tìm thấy mapping đợt bảo vệ đang hoạt động cho tài khoản hiện tại.",
        };
      }

      if (status === 409) {
        return {
          ok: false,
          status,
          code: "AMBIGUOUS",
          message:
            apiMessage ??
            "Tài khoản hiện đang có nhiều mapping đợt bảo vệ hoạt động. Vui lòng liên hệ quản trị viên để xử lý dữ liệu.",
        };
      }

      return {
        ok: false,
        status,
        code: "REQUEST_FAILED",
        message: apiMessage ?? "Không tải được dữ liệu đợt bảo vệ hiện tại.",
      };
    }

    return {
      ok: false,
      status: null,
      code: "REQUEST_FAILED",
      message: "Không thể kết nối hệ thống để lấy đợt bảo vệ hiện tại.",
    };
  }
};

export const fetchCurrentLecturerDefenseAccess = async (): Promise<CurrentLecturerDefenseAccessResult> => {
  const endpoint = CURRENT_ACCESS_ENDPOINT_BY_ROLE.lecturer;

  try {
    const response = await fetchData<ApiResponse<Record<string, unknown>>>(endpoint, {
      method: "GET",
    });

    const payload = toRecord(readEnvelopeData<Record<string, unknown>>(response));
    const period = mapCurrentPeriod(
      toRecord(pickCaseInsensitiveValue(payload ?? {}, ["period", "Period"], payload)),
    );

    if (!period) {
      return {
        ok: false,
        status: null,
        code: "INVALID_CONTRACT",
        message: "Snapshot hiện tại không chứa thông tin đợt bảo vệ hợp lệ.",
      };
    }

    const access = extractLecturerDefenseAccess(payload);

    return {
      ok: true,
      period,
      councilListLocked: access.councilListLocked,
      hasCommitteeAccess: access.hasCommitteeAccess,
      committeeCount: access.committeeCount,
    };
  } catch (error) {
    if (error instanceof FetchDataError) {
      const status = typeof error.status === "number" ? error.status : null;
      const apiMessage = readApiErrorMessage(error.data);

      if (status === 404) {
        return {
          ok: false,
          status,
          code: "NOT_MAPPED",
          message:
            apiMessage ??
            "Không tìm thấy mapping đợt bảo vệ đang hoạt động cho tài khoản hiện tại.",
        };
      }

      if (status === 409) {
        return {
          ok: false,
          status,
          code: "AMBIGUOUS",
          message:
            apiMessage ??
            "Tài khoản hiện đang có nhiều mapping đợt bảo vệ hoạt động. Vui lòng liên hệ quản trị viên để xử lý dữ liệu.",
        };
      }

      return {
        ok: false,
        status,
        code: "REQUEST_FAILED",
        message: apiMessage ?? "Không tải được dữ liệu đợt bảo vệ hiện tại.",
      };
    }

    return {
      ok: false,
      status: null,
      code: "REQUEST_FAILED",
      message: "Không thể kết nối hệ thống để lấy đợt bảo vệ hiện tại.",
    };
  }
};