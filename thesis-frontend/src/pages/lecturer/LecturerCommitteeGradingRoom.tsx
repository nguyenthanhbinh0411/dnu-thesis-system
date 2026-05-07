import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    createConcurrencyToken,
    createIdempotencyKey,
    ucError,
    type SessionCode,
    type WorkflowActionTrace,
} from "../../types/defense-workflow-contract";
import { useToast } from "../../context/useToast";
import { FetchDataError, fetchData, normalizeUrl } from "../../api/fetchData";
import type { ApiResponse } from "../../types/api";
import {
    pickCaseInsensitiveValue,
    readEnvelopeAllowedActions,
    readEnvelopeData,
    readEnvelopeErrorMessages,
    readEnvelopeMessage,
    readEnvelopeSuccess,
    readEnvelopeWarningMessages,
    toCompatResponse,
} from "../../utils/api-envelope";
import {
    getActiveDefensePeriodId,
    normalizeDefensePeriodId,
    setActiveDefensePeriodId,
} from "../../utils/defensePeriod";

import {
    ArrowRight,
    Building2,
    CalendarDays,
    CalendarClock,
    CheckCircle2,
    ClipboardPen,
    Clock3,
    Download,
    Eraser,
    Eye,
    ExternalLink,
    FileText,
    Gavel,
    Info,
    LayoutDashboard,
    Lock,
    MapPin,
    MessageSquareText,
    PencilRuler,
    Plus,
    Save,
    Star,
    Trash2,
    Undo2,
    Unlock,
    Users2,
    XCircle,
    AlertTriangle,
    ChevronDown,
} from "lucide-react";
import { getAccessToken } from "../../services/auth-session.service";

type Committee = {
    id: string;
    name: string;
    numericId: number;
    room: string;
    session: SessionCode | null;
    date: string | null;
    slot: string | null;
    studentCount: number;
    status: "Sắp diễn ra" | "Đang họp" | "Đã chốt" | "Đã đóng";
    normalizedRole: CommitteeRoleCode;
    roleCode: CommitteeRoleCode;
    roleLabel: string;
    roleRaw: string;
    allowedScoringActions: string[];
    allowedMinuteActions: string[];
    allowedRevisionActions: string[];
    members: CommitteeMemberView[];
};

type CommitteeRoleCode = "CT" | "UVTK" | "UVPB" | "UNKNOWN";

type CommitteeMemberView = {
    memberId: string;
    lecturerCode: string;
    lecturerName: string;
    degree: string | null;
    organization: string | null;
    roleRaw: string;
    roleCode: CommitteeRoleCode;
    roleLabel: string;
};

type RevisionRequest = {
    revisionId: number;
    assignmentId: number | null;
    studentCode: string;
    topicCode: string | null;
    topicTitle: string;
    revisionFileUrl: string | null;
    lastUpdated: string | null;
    status: "pending" | "approved" | "rejected";
    reason?: string;
};

type PanelKey = "councils" | "grading";

type CommitteeDetailTabKey = "overview" | "members" | "topics";

type WorkspaceTabKey = "scoring" | "minutes" | "review";

type PreviewModalType = "meeting" | "reviewer" | "scoreSheet";



type CurrentDefensePeriodView = {
    periodId: number;
    name: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
};

const EMPTY_REVISION: RevisionRequest = {
    revisionId: 0,
    assignmentId: null,
    studentCode: "",
    topicCode: null,
    topicTitle: "",
    revisionFileUrl: null,
    lastUpdated: null,
    status: "pending",
};

type ScoringOverview = {
    variance: number | null;
    varianceThreshold: number | null;
    finalScore: number | null;
    finalLetter: string | null;
};

type DefenseDocument = {
    documentId: number;
    fileName: string;
    fileUrl: string;
    mimeType: string | null;
    uploadedAt: string | null;
};

type ScoringMatrixRow = {
    committeeId: number;
    committeeCode: string;
    committeeName: string;
    assignmentId: number;
    assignmentCode: string;
    topicCode: string | null;
    topicTitle: string;
    studentCode: string;
    studentName: string;
    className: string | null;
    cohortCode: string | null;
    supervisorLecturerName: string | null;
    supervisorOrganization: string | null;
    topicTags: string[];
    session: SessionCode | null;
    scheduledAt: string | null;
    startTime: string | null;
    endTime: string | null;
    topicSupervisorScore: number | null;
    scoreGvhd: number | null;
    scoreCt: number | null;
    scoreTk: number | null;
    scorePb: number | null;
    commentGvhd: string | null;
    commentCt: string | null;
    commentTk: string | null;
    commentPb: string | null;
    finalScore: number | null;
    finalGrade: string | null;
    variance: number | null;
    isLocked: boolean;
    status: string;
    submittedCount: number;
    requiredCount: number;
    defenseDocuments: DefenseDocument[];
};

type ScoringAlertRow = {
    assignmentId: number;
    message: string;
    value: number | null;
    threshold: number | null;
};

type MinuteChapterInput = {
    chapterTitle: string;
    content: string;
};

type MinuteQuestionAnswer = {
    question: string;
    answer: string;
};

type ReviewerSections = {
    necessity: string;
    novelty: string;
    methodologyReliability: string;
    resultsContent: string;
    limitations: string;
    suggestions: string;
    overallConclusion: string;
};

type TopicFinalProgressRow = {
    committeeId: number;
    committeeCode: string;
    totalTopics: number;
    scoredTopics: number;
    progressPercent: number;
};


const panels: Array<{ key: PanelKey; label: string; icon: React.ReactNode }> = [
    { key: "councils", label: "Hội đồng của tôi", icon: <Users2 size={15} /> },
    { key: "grading", label: "Phòng chấm điểm hội đồng", icon: <PencilRuler size={15} /> },
];

const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: 18,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const normalizeCommitteeRole = (value: unknown): CommitteeRoleCode => {
    const raw = String(value ?? "").trim().toUpperCase();
    if (!raw) {
        return "UNKNOWN";
    }

    if (
        raw === "CT" ||
        raw === "CHAIR" ||
        raw.includes("CHU TICH") ||
        raw.includes("CHỦ TỊCH")
    ) {
        return "CT";
    }

    if (
        raw === "UVTK" ||
        raw === "TK" ||
        raw === "SECRETARY" ||
        raw.includes("THU KY") ||
        raw.includes("THƯ KÝ")
    ) {
        return "UVTK";
    }

    if (
        raw === "UVPB" ||
        raw === "PB" ||
        raw === "REVIEWER" ||
        raw.includes("PHAN BIEN") ||
        raw.includes("PHẢN BIỆN")
    ) {
        return "UVPB";
    }

    return "UNKNOWN";
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
};

const toStringOrNull = (value: unknown): string | null => {
    const text = String(value ?? "").trim();
    return text ? text : null;
};

const toBooleanOrNull = (value: unknown): boolean | null => {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        return Number.isFinite(value) ? value !== 0 : null;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes", "y"].includes(normalized)) {
            return true;
        }
        if (["false", "0", "no", "n"].includes(normalized)) {
            return false;
        }
    }

    return null;
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

const toNumberOrNull = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const toRomanNumeral = (value: number): string => {
    const numerals: Array<[number, string]> = [
        [1000, "M"],
        [900, "CM"],
        [500, "D"],
        [400, "CD"],
        [100, "C"],
        [90, "XC"],
        [50, "L"],
        [40, "XL"],
        [10, "X"],
        [9, "IX"],
        [5, "V"],
        [4, "IV"],
        [1, "I"],
    ];
    let remaining = Math.max(1, Math.floor(value));
    let result = "";
    for (const [amount, numeral] of numerals) {
        while (remaining >= amount) {
            result += numeral;
            remaining -= amount;
        }
    }
    return result;
};

const normalizeTopicTagNames = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        const normalized = value
            .map((item) => {
                if (typeof item === "string") {
                    return item.trim();
                }
                const record = toRecord(item);
                if (!record) {
                    return "";
                }
                return (
                    toStringOrNull(
                        pickCaseInsensitiveValue(
                            record,
                            ["tagName", "TagName", "name", "Name", "tagCode", "TagCode", "code", "Code"],
                            null,
                        ),
                    ) ?? ""
                );
            })
            .map((item) => item.trim())
            .filter(Boolean);

        return Array.from(new Set(normalized));
    }

    if (typeof value === "string") {
        const fromText = value
            .split(/[;,|]/)
            .map((item) => item.trim())
            .filter(Boolean);
        return Array.from(new Set(fromText));
    }

    return [];
};

const normalizeTimeText = (value: unknown): string | null => {
    const raw = String(value ?? "").trim();
    if (!raw) {
        return null;
    }

    const matched = raw.match(/^(\d{1,2}):(\d{2})/);
    if (!matched) {
        return null;
    }

    const hour = Number(matched[1]);
    const minute = Number(matched[2]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
        return null;
    }
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return null;
    }

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const inferSessionFromTime = (timeValue: string | null): SessionCode | null => {
    if (!timeValue) {
        return null;
    }
    const [hourText] = timeValue.split(":");
    const hour = Number(hourText);
    if (!Number.isFinite(hour)) {
        return null;
    }
    return hour >= 12 ? "AFTERNOON" : "MORNING";
};

const normalizeSessionCode = (value: unknown): SessionCode => {
    const raw = String(value ?? "").trim().toUpperCase();
    if (
        raw === "AFTERNOON" ||
        raw === "2" ||
        raw.includes("CHIEU") ||
        raw.includes("PM")
    ) {
        return "AFTERNOON";
    }
    return "MORNING";
};

const mapCurrentPeriodView = (
    periodRecord: Record<string, unknown> | null,
): CurrentDefensePeriodView | null => {
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
            String(
                pickCaseInsensitiveValue(periodRecord, ["name", "Name", "title", "Title"], ""),
            ).trim() || `Đợt ${periodId}`,
        status:
            String(
                pickCaseInsensitiveValue(periodRecord, ["status", "Status", "state", "State"], "UNKNOWN"),
            ).trim() || "UNKNOWN",
        startDate: toIsoDateOrNull(
            pickCaseInsensitiveValue(periodRecord, ["startDate", "StartDate", "startedAt", "StartedAt"], null),
        ),
        endDate: toIsoDateOrNull(
            pickCaseInsensitiveValue(periodRecord, ["endDate", "EndDate", "endedAt", "EndedAt"], null),
        ),
    };
};

const readApiErrorMessage = (payload: unknown): string | null => {
    const record = toRecord(payload);
    if (!record) {
        return null;
    }

    const directMessage = toStringOrNull(
        pickCaseInsensitiveValue(record, ["message", "Message", "title", "Title"], null),
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
            const first = toStringOrNull(value[0]);
            if (first) {
                return first;
            }
        }
    }

    return null;
};

const getRoleLabel = (roleCode: CommitteeRoleCode): string => {
    switch (roleCode) {
        case "CT":
            return "Chủ tịch hội đồng";
        case "UVTK":
            return "Ủy viên thư ký hội đồng";
        case "UVPB":
            return "Ủy viên phản biện hội đồng";
        default:
            return "Không xác định";
    }
};

const getCommitteeMemberParticipation = (
    member: CommitteeMemberView,
    scoringRows: ScoringMatrixRow[],
    context?: {
        isCurrentUser: boolean;
        hasJoinedCurrentCommittee: boolean;
        isCommitteeLive: boolean;
    },
) => {
    const onlineByScore = scoringRows.some((row) => {
        if (member.roleCode === "CT") {
            return row.scoreCt != null;
        }

        if (member.roleCode === "UVTK") {
            return row.scoreTk != null;
        }

        if (member.roleCode === "UVPB") {
            return row.scorePb != null;
        }

        return false;
    });

    const onlineByPresence = Boolean(
        context?.isCurrentUser && context?.hasJoinedCurrentCommittee && context?.isCommitteeLive,
    );

    const online = onlineByPresence || onlineByScore;

    return {
        online,
        emoji: online ? "🟢" : "⚫",
        label: online ? "Online" : "Offline",
        bg: online ? "#ecfdf5" : "#f8fafc",
        border: online ? "#22c55e" : "#cbd5e1",
        text: online ? "#166534" : "#475569",
    };
};

type CommitteeStatusVisual = {
    emoji: string;
    label: string;
    cardBorder: string;
    cardGlow: string;
    chipBg: string;
    chipBorder: string;
    chipText: string;
};

const getCommitteeStatusVisual = (status: Committee["status"]): CommitteeStatusVisual => {
    switch (status) {
        case "Đang họp":
            return {
                emoji: "🔴",
                label: "Đang họp",
                cardBorder: "#f97316",
                cardGlow: "rgba(249, 115, 22, 0.20)",
                chipBg: "#fff7ed",
                chipBorder: "#f97316",
                chipText: "#c2410c",
            };
        case "Đã chốt":
            return {
                emoji: "🔒",
                label: "Đã chốt",
                cardBorder: "#6366f1",
                cardGlow: "rgba(99, 102, 241, 0.18)",
                chipBg: "#eef2ff",
                chipBorder: "#6366f1",
                chipText: "#4338ca",
            };
        case "Đã đóng":
            return {
                emoji: "⚫",
                label: "Đã đóng",
                cardBorder: "#cbd5e1",
                cardGlow: "rgba(148, 163, 184, 0.18)",
                chipBg: "#f8fafc",
                chipBorder: "#cbd5e1",
                chipText: "#475569",
            };
        default:
            return {
                emoji: "🟢",
                label: "Sắp diễn ra",
                cardBorder: "#86efac",
                cardGlow: "rgba(34, 197, 94, 0.18)",
                chipBg: "#f0fdf4",
                chipBorder: "#86efac",
                chipText: "#166534",
            };
    }
};

const mapCommitteeStatus = (value: unknown): "Sắp diễn ra" | "Đang họp" | "Đã chốt" | "Đã đóng" => {
    const raw = String(value ?? "").trim().toUpperCase();
    if (raw === "FINALIZED") {
        return "Đã đóng";
    }
    if (raw === "LOCKED" || raw === "COMPLETED") {
        return "Đã chốt";
    }
    if (raw === "LIVE" || raw === "ONGOING") {
        return "Đang họp";
    }
    return "Sắp diễn ra";
};

const normalizeAllowedActions = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return Array.from(
        new Set(
            value
                .map((item) => String(item ?? "").trim().toUpperCase())
                .filter(Boolean),
        ),
    );
};

const includesAnyAction = (allowedActions: string[], ...targets: string[]): boolean => {
    if (allowedActions.length === 0) {
        return false;
    }

    const normalizedTargets = targets
        .map((item) => String(item ?? "").trim().toUpperCase())
        .filter(Boolean);

    if (normalizedTargets.length === 0) {
        return false;
    }

    return normalizedTargets.some((action) => allowedActions.includes(action));
};

const LecturerCommitteeGradingRoom: React.FC = () => {
    const { addToast } = useToast();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const isGradingScreen = true;
    const committeeIdParam = String(searchParams.get("committeeId") ?? "").trim();
    const [periodId, setPeriodId] = useState<number | null>(() => getActiveDefensePeriodId());
    const [currentPeriod, setCurrentPeriod] = useState<CurrentDefensePeriodView | null>(null);
    const [currentSnapshotError, setCurrentSnapshotError] = useState<string | null>(null);
    const [councilListLocked, setCouncilListLocked] = useState<boolean | null>(null);
    const [councilLockStatus, setCouncilLockStatus] = useState<string>("UNKNOWN");
    const periodBase = periodId ? `/defense-periods/${periodId}` : "";
    const lecturerBase = `${periodBase}/lecturer`;
    const periodIdText = String(periodId ?? "");
    const pickSnapshotSection = pickCaseInsensitiveValue;

    const syncPeriodToUrl = (nextPeriodId: number | null) => {
        const currentPeriodId = normalizeDefensePeriodId(searchParams.get("periodId"));
        if (currentPeriodId === nextPeriodId) {
            return;
        }

        const nextParams = new URLSearchParams(searchParams);
        if (nextPeriodId != null) {
            nextParams.set("periodId", String(nextPeriodId));
        } else {
            nextParams.delete("periodId");
        }
        setSearchParams(nextParams, { replace: true });
    };

    const getLecturerSnapshot = async (committeeId?: string | number) => {
        const committeeQuery =
            committeeId == null || String(committeeId).trim() === ""
                ? ""
                : `?committeeId=${encodeURIComponent(String(committeeId))}`;

        let envelope: ApiResponse<Record<string, unknown>>;
        try {
            envelope = await fetchData<ApiResponse<Record<string, unknown>>>(
                `/lecturer-defense/current/snapshot${committeeQuery}`,
                {
                    method: "GET",
                },
            );
        } catch (error) {
            if (periodId == null || periodId <= 0) {
                throw error;
            }

            envelope = await fetchData<ApiResponse<Record<string, unknown>>>(
                `${lecturerBase}/snapshot${committeeQuery}`,
                {
                    method: "GET",
                },
            );
        }

        const payloadRecord =
            toRecord(readEnvelopeData<Record<string, unknown>>(envelope)) ?? {};
        const periodView = mapCurrentPeriodView(
            toRecord(
                pickSnapshotSection(payloadRecord, ["period", "Period"], null),
            ),
        );

        if (periodView) {
            setPeriodId(periodView.periodId);
            setActiveDefensePeriodId(periodView.periodId);
            syncPeriodToUrl(periodView.periodId);
            setCurrentPeriod(periodView);
        } else if (periodId != null && periodId > 0) {
            syncPeriodToUrl(periodId);
            setCurrentPeriod((prev) =>
                prev ?? {
                    periodId,
                    name: `Đợt #${periodId}`,
                    status: "UNKNOWN",
                    startDate: null,
                    endDate: null,
                },
            );
        } else {
            throw new Error("CURRENT_PERIOD_CONTRACT_INVALID");
        }
        setCurrentSnapshotError(null);

        const snapshot =
            toRecord(
                pickSnapshotSection(payloadRecord, ["snapshot", "Snapshot"], payloadRecord),
            ) ?? {};

        return toCompatResponse(envelope, snapshot);
    };

    const lecturerApi = {
        getCommittees: async () => {
            const snapshotRes = await getLecturerSnapshot();
            const snapshot = readEnvelopeData<Record<string, unknown>>(snapshotRes);
            const committeesSource = pickSnapshotSection<unknown>(
                snapshot,
                ["committees", "Committees"],
                [],
            );

            const committeeContainer = toRecord(committeesSource);
            const rowsSource =
                Array.isArray(committeesSource)
                    ? committeesSource
                    : pickSnapshotSection<unknown[]>(
                        committeeContainer ?? {},
                        ["committees", "Committees", "items", "Items"],
                        [],
                    );

            const rows = Array.isArray(rowsSource)
                ? rowsSource
                    .map((item) => toRecord(item))
                    .filter((item): item is Record<string, unknown> => Boolean(item))
                : [];

            const lockFlag = toBooleanOrNull(
                pickSnapshotSection<unknown>(
                    committeeContainer ?? {},
                    ["councilListLocked", "CouncilListLocked"],
                    null,
                ),
            );
            const lockStatus = toStringOrNull(
                pickSnapshotSection<unknown>(
                    committeeContainer ?? {},
                    ["councilLockStatus", "CouncilLockStatus"],
                    null,
                ),
            );

            return toCompatResponse(snapshotRes, {
                items: rows,
                councilListLocked: lockFlag,
                councilLockStatus: lockStatus,
            });
        },
        getCommitteeMinutes: async (id: string | number) => {
            const snapshotRes = await getLecturerSnapshot(id);
            const snapshot = readEnvelopeData<Record<string, unknown>>(snapshotRes);
            const minutesRows = pickSnapshotSection<Array<Record<string, unknown>>>(
                snapshot,
                ["minutes", "Minutes"],
                [],
            );
            const committeeId = Number(id);
            const committeeCode = String(id).trim().toUpperCase();
            const filtered = (Array.isArray(minutesRows) ? minutesRows : []).filter(
                (item) => {
                    const row = toRecord(item) ?? {};
                    const rowCommitteeId = Number(
                        pickSnapshotSection<unknown>(
                            row,
                            ["committeeId", "CommitteeId", "councilId", "CouncilId"],
                            0,
                        ),
                    );
                    const rowCommitteeCode = String(
                        pickSnapshotSection<unknown>(
                            row,
                            ["committeeCode", "CommitteeCode", "councilCode", "CouncilCode"],
                            "",
                        ),
                    )
                        .trim()
                        .toUpperCase();

                    return rowCommitteeId === committeeId || (committeeCode && rowCommitteeCode === committeeCode);
                },
            );

            return toCompatResponse(snapshotRes, filtered);
        },
        updateCommitteeMinutes: (id: string | number, payload: Record<string, unknown>, idempotencyKey?: string) =>
            fetchData<ApiResponse<boolean>>(`${lecturerBase}/minutes/upsert`, {
                method: "POST",
                body: {
                    committeeId: Number(id),
                    data: payload,
                    ...(idempotencyKey ? { idempotencyKey } : {}),
                },
                headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
            }),
        submitIndependentScore: (id: string | number, payload: Record<string, unknown>, idempotencyKey?: string) =>
            fetchData<ApiResponse<boolean>>(`${lecturerBase}/scoring/actions`, {
                method: "POST",
                body: {
                    action: "SUBMIT",
                    committeeId: Number(id),
                    score: payload,
                    ...(idempotencyKey ? { idempotencyKey } : {}),
                },
                headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
            }),
        openSessionByCommittee: (id: string | number, idempotencyKey?: string) =>
            fetchData<ApiResponse<boolean>>(`${lecturerBase}/scoring/actions`, {
                method: "POST",
                body: {
                    action: "OPEN_SESSION",
                    committeeId: Number(id),
                    ...(idempotencyKey ? { idempotencyKey } : {}),
                },
                headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
            }),
        closeSessionByCommittee: (id: string | number, idempotencyKey?: string) =>
            fetchData<ApiResponse<boolean>>(`${lecturerBase}/scoring/actions`, {
                method: "POST",
                body: {
                    action: "CLOSE_SESSION",
                    committeeId: Number(id),
                    ...(idempotencyKey ? { idempotencyKey } : {}),
                },
                headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
            }),
        lockSessionByCommittee: (id: string | number, idempotencyKey?: string) =>
            fetchData<ApiResponse<boolean>>(`${lecturerBase}/scoring/actions`, {
                method: "POST",
                body: {
                    action: "LOCK_SESSION",
                    committeeId: Number(id),
                    ...(idempotencyKey ? { idempotencyKey } : {}),
                },
                headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
            }),
        getRevisionQueue: async () => {
            const snapshotRes = await getLecturerSnapshot();
            const snapshot = readEnvelopeData<Record<string, unknown>>(snapshotRes);
            const queue = pickSnapshotSection<Array<Record<string, unknown>>>(
                snapshot,
                ["revisionQueue", "RevisionQueue"],
                [],
            );
            return toCompatResponse(snapshotRes, Array.isArray(queue) ? queue : []);
        },
        getScoringMatrix: async (committeeId?: string | number) => {
            const snapshotRes = await getLecturerSnapshot();
            const snapshot = readEnvelopeData<Record<string, unknown>>(snapshotRes);
            const scoring = pickSnapshotSection<Record<string, unknown>>(
                snapshot,
                ["scoring", "Scoring"],
                {},
            );
            const matrixRows = pickSnapshotSection<Array<Record<string, unknown>>>(
                scoring,
                ["matrix", "Matrix"],
                [],
            );
            const normalizedRows = Array.isArray(matrixRows) ? matrixRows : [];
            const filtered =
                committeeId == null
                    ? normalizedRows
                    : normalizedRows.filter(
                        (item) =>
                            Number(item.committeeId ?? item.councilId ?? 0) ===
                            Number(committeeId) ||
                            String(item.committeeCode ?? "") === String(committeeId),
                    );
            return toCompatResponse(snapshotRes, filtered);
        },
        getScoringAlerts: async (committeeId?: string | number) => {
            const snapshotRes = await getLecturerSnapshot();
            const snapshot = readEnvelopeData<Record<string, unknown>>(snapshotRes);
            const scoring = pickSnapshotSection<Record<string, unknown>>(
                snapshot,
                ["scoring", "Scoring"],
                {},
            );
            const alertRows = pickSnapshotSection<Array<Record<string, unknown>>>(
                scoring,
                ["alerts", "Alerts"],
                [],
            );
            const normalizedRows = Array.isArray(alertRows) ? alertRows : [];
            const filtered =
                committeeId == null
                    ? normalizedRows
                    : normalizedRows.filter(
                        (item) =>
                            Number(item.committeeId ?? item.councilId ?? 0) ===
                            Number(committeeId) ||
                            String(item.committeeCode ?? "") === String(committeeId),
                    );
            return toCompatResponse(snapshotRes, filtered);
        },
        getTopicFinalProgress: async () => {
            const snapshotRes = await getLecturerSnapshot();
            const snapshot = readEnvelopeData<Record<string, unknown>>(snapshotRes);
            const scoring = pickSnapshotSection<Record<string, unknown>>(
                snapshot,
                ["scoring", "Scoring"],
                {},
            );
            const progressRows = pickSnapshotSection<Array<Record<string, unknown>>>(
                scoring,
                ["topicFinalProgress", "TopicFinalProgress"],
                [],
            );
            return toCompatResponse(snapshotRes, Array.isArray(progressRows) ? progressRows : []);
        },
        approveRevision: (revisionId: number, idempotencyKey?: string) =>
            fetchData<ApiResponse<boolean>>(`${lecturerBase}/revisions/actions`, {
                method: "POST",
                body: {
                    action: "APPROVE",
                    revisionId,
                    ...(idempotencyKey ? { idempotencyKey } : {}),
                },
                headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
            }),
        rejectRevision: (revisionId: number, reason: string, idempotencyKey?: string) =>
            fetchData<ApiResponse<boolean>>(`${lecturerBase}/revisions/actions`, {
                method: "POST",
                body: {
                    action: "REJECT",
                    revisionId,
                    reject: {
                        reason,
                    },
                    ...(idempotencyKey ? { idempotencyKey } : {}),
                },
                headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
            }),
    };
    const notifyError = (message: string) => addToast(message, "error");
    const notifySuccess = (message: string) => addToast(message, "success");
    const notifyInfo = (message: string) => addToast(message, "info");

    const downloadPreviewDocument = async (template: PreviewModalType, format: "word" | "pdf") => {
        if ((template === "meeting" || template === "reviewer") && !selectedAssignmentId) {
            notifyError("Vui lòng chọn đề tài trước khi tải file.");
            return;
        }

        try {
            setIsDownloadingPreviewFile(true);
            const token = getAccessToken();
            const endpoint = template === "scoreSheet"
                ? `/api/defense-periods/${periodId}/lecturer/reports/export-form-1?committeeId=${selectedCommitteeNumericId}&format=${format}`
                : `/api/defense-periods/${periodId}/lecturer/minutes/export-document?committeeId=${selectedCommitteeNumericId}&assignmentId=${selectedAssignmentId}&template=${template}&format=${format}`;
            const url = normalizeUrl(endpoint);
            const response = await fetch(url, {
                method: "GET",
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });

            if (!response.ok) {
                let message = "Không thể tải tài liệu.";
                const contentType = response.headers.get("content-type") || "";
                if (contentType.includes("application/json")) {
                    try {
                        const payload = (await response.json()) as Record<string, unknown>;
                        message =
                            String(payload.message || payload.Message || payload.title || payload.Title || message).trim() || message;
                    } catch {
                        // keep fallback message
                    }
                }
                throw new Error(message);
            }

            const blob = await response.blob();
            const contentDisposition = response.headers.get("content-disposition") || "";
            const fileNameMatch = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition);
            const serverFileName = decodeURIComponent((fileNameMatch?.[1] || fileNameMatch?.[2] || "").trim());
            const committeeCodeFallback = selectedMatrixRow?.committeeCode || String(selectedCommitteeNumericId || selectedAssignmentId);
            const reviewerCodeFallback = selectedCommittee?.members.find((member) => member.roleCode === "UVPB")?.lecturerCode || committeeCodeFallback;
            const fallbackFileName = template === "meeting"
                ? `bien-ban-hop-${committeeCodeFallback}.${format === "pdf" ? "pdf" : "docx"}`
                : template === "reviewer"
                    ? `nhan-xet-phan-bien-${reviewerCodeFallback}-${committeeCodeFallback}.${format === "pdf" ? "pdf" : "docx"}`
                    : `bang-diem-chi-tiet-ket-qua-bao-ve-${committeeCodeFallback}.${format === "pdf" ? "pdf" : "docx"}`;
            const fileName = serverFileName || fallbackFileName;

            const blobUrl = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = blobUrl;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(blobUrl);
            notifySuccess("Đã tải tài liệu thành công.");
        } catch (error) {
            notifyError(error instanceof Error ? error.message : "Không thể tải tài liệu.");
        } finally {
            setIsDownloadingPreviewFile(false);
        }
    };

    useEffect(() => {
        setActiveDefensePeriodId(periodId);
    }, [periodId]);

    const [activePanel, setActivePanel] = useState<PanelKey>(isGradingScreen ? "grading" : "councils");
    const [committees, setCommittees] = useState<Committee[]>([]);
    const [detailCommitteeId, setDetailCommitteeId] = useState<string>("");
    const [detailTab, setDetailTab] = useState<CommitteeDetailTabKey>("overview");
    const [revisionQueue, setRevisionQueue] = useState<RevisionRequest[]>([]);
    const [selectedCommitteeId, setSelectedCommitteeId] = useState<string>("");
    const [joinedCommitteeId, setJoinedCommitteeId] = useState<string>("");
    const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTabKey>("scoring");
    const [loadingData, setLoadingData] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [assignmentConcurrencyToken, setAssignmentConcurrencyToken] = useState(
        createConcurrencyToken("lecturer-assignment")
    );
    const [latestActionTrace, setLatestActionTrace] = useState<WorkflowActionTrace | null>(null);
    const [scoringOverview, setScoringOverview] = useState<ScoringOverview>({
        variance: null,
        varianceThreshold: null,
        finalScore: null,
        finalLetter: null,
    });

    const [review, setReview] = useState("");
    const [questions, setQuestions] = useState("");
    const [answers, setAnswers] = useState("");
    const [questionAnswers, setQuestionAnswers] = useState<MinuteQuestionAnswer[]>([]);
    const [strengths, setStrengths] = useState("");
    const [weaknesses, setWeaknesses] = useState("");
    const [recommendations, setRecommendations] = useState("");
    const [chapterContents, setChapterContents] = useState<MinuteChapterInput[]>([]);
    const [councilDiscussionConclusion, setCouncilDiscussionConclusion] = useState("");
    const [chairConclusion, setChairConclusion] = useState("");
    const [reviewerSections, setReviewerSections] = useState<ReviewerSections>({
        necessity: "",
        novelty: "",
        methodologyReliability: "",
        resultsContent: "",
        limitations: "",
        suggestions: "",
        overallConclusion: "",
    });
    const [deletedChapterDraft, setDeletedChapterDraft] = useState<{ index: number; item: MinuteChapterInput } | null>(null);
    const [deletedQuestionAnswerDraft, setDeletedQuestionAnswerDraft] = useState<{ index: number; item: MinuteQuestionAnswer } | null>(null);
    const [minuteSavedAt, setMinuteSavedAt] = useState<string | null>(null);
    const [lastAutoSave, setLastAutoSave] = useState<string | null>(null);

    useEffect(() => {
        setAnswers(
            questionAnswers
                .map((item, index) => {
                    const questionText = String(item.question ?? "").trim();
                    const answerText = String(item.answer ?? "").trim();
                    if (!questionText && !answerText) {
                        return "";
                    }
                    const label = questionText || `Câu hỏi ${index + 1}`;
                    return `${label}: ${answerText}`.trim();
                })
                .filter(Boolean)
                .join("\n\n"),
        );
    }, [questionAnswers]);

    const clearChapterContent = (index: number) => {
        const target = chapterContents[index];
        if (!target) {
            return;
        }
        const hasData = Boolean((target.chapterTitle ?? "").trim() || (target.content ?? "").trim());
        if (hasData && !window.confirm(`Bạn có chắc chắn muốn xóa trắng nội dung ${target.chapterTitle || `Chương ${toRomanNumeral(index + 1)}`}?`)) {
            return;
        }
        setChapterContents((prev) =>
            prev.map((item, idx) => (idx === index ? { ...item, content: "" } : item)),
        );
    };

    const deleteChapterWithConfirm = (index: number) => {
        const target = chapterContents[index];
        if (!target) {
            return;
        }
        if (!window.confirm(`Xóa ${target.chapterTitle || `Chương ${toRomanNumeral(index + 1)}`}? Dữ liệu đã nhập sẽ bị xóa, bạn có thể phục hồi ngay sau đó.`)) {
            return;
        }
        setDeletedChapterDraft({ index, item: target });
        setChapterContents((prev) => prev.filter((_, idx) => idx !== index));
    };

    const restoreDeletedChapter = () => {
        if (!deletedChapterDraft) {
            return;
        }
        setChapterContents((prev) => {
            const next = [...prev];
            const insertIndex = Math.min(Math.max(deletedChapterDraft.index, 0), next.length);
            next.splice(insertIndex, 0, deletedChapterDraft.item);
            return next;
        });
        setDeletedChapterDraft(null);
    };

    const QUESTION_SOURCE_REVIEWER = "II.1";
    const QUESTION_SOURCE_COUNCIL = "II.2";

    const getQuestionSource = (question: string) => {
        const normalized = (question ?? "").trim();
        if (normalized.startsWith(`[${QUESTION_SOURCE_REVIEWER}]`)) {
            return QUESTION_SOURCE_REVIEWER;
        }
        if (normalized.startsWith(`[${QUESTION_SOURCE_COUNCIL}]`)) {
            return QUESTION_SOURCE_COUNCIL;
        }
        return QUESTION_SOURCE_COUNCIL;
    };

    const stripQuestionSource = (question: string) =>
        (question ?? "")
            .replace(/^\[(II\.1|II\.2)\]\s*/i, "")
            .trimStart();

    const composeQuestionWithSource = (source: string, questionText: string) =>
        `[${source}] ${questionText ?? ""}`.trimEnd();

    const getQuestionItemsBySource = (source: string) =>
        questionAnswers
            .map((pair, index) => ({ pair, index }))
            .filter(({ pair }) => getQuestionSource(pair.question) === source);

    const addQuestionWithSource = (source: string) => {
        setQuestionAnswers((prev) => [...prev, { question: `[${source}] `, answer: "" }]);
    };

    const deleteQuestionAnswerWithConfirm = (index: number) => {
        const target = questionAnswers[index];
        if (!target) {
            return;
        }
        if (!window.confirm(`Xóa cặp câu hỏi - trả lời số ${index + 1}? Bạn có thể phục hồi ngay sau đó.`)) {
            return;
        }
        setDeletedQuestionAnswerDraft({ index, item: target });
        setQuestionAnswers((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    };

    const restoreDeletedQuestionAnswer = () => {
        if (!deletedQuestionAnswerDraft) {
            return;
        }
        setQuestionAnswers((prev) => {
            const next = [...prev];
            const insertIndex = Math.min(Math.max(deletedQuestionAnswerDraft.index, 0), next.length);
            next.splice(insertIndex, 0, deletedQuestionAnswerDraft.item);
            return next;
        });
        setDeletedQuestionAnswerDraft(null);
    };

    const [myScore, setMyScore] = useState("");
    const [myComment, setMyComment] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [sessionLocked, setSessionLocked] = useState(false);

    const [revision, setRevision] = useState<RevisionRequest>(EMPTY_REVISION);
    const [allScoringRows, setAllScoringRows] = useState<ScoringMatrixRow[]>([]);
    const [scoringMatrix, setScoringMatrix] = useState<ScoringMatrixRow[]>([]);
    const [scoringAlerts, setScoringAlerts] = useState<ScoringAlertRow[]>([]);
    const [topicFinalProgressRows, setTopicFinalProgressRows] = useState<TopicFinalProgressRow[]>([]);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState<number>(0);
    const [fallbackAllowedActions, setFallbackAllowedActions] = useState<string[]>([]);
    const [roomNow, setRoomNow] = useState<Date>(() => new Date());
    const [gradingLoadingProgress, setGradingLoadingProgress] = useState(0);
    const [gradingLoadingReady, setGradingLoadingReady] = useState(false);
    const [previewModalType, setPreviewModalType] = useState<PreviewModalType | null>(null);
    const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
    const [isDownloadingPreviewFile, setIsDownloadingPreviewFile] = useState(false);

    const renderPortal = (node: React.ReactNode) =>
        typeof document !== "undefined" ? createPortal(node, document.body) : null;

    useEffect(() => {
        if (gradingLoadingReady) return;
        const interval = setInterval(() => {
            setGradingLoadingProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                const increment = prev < 30 ? 3 : prev < 60 ? 2 : prev < 85 ? 1.5 : 0.5;
                return Math.min(prev + increment, 100);
            });
        }, 50);
        return () => clearInterval(interval);
    }, [gradingLoadingReady]);

    useEffect(() => {
        if (gradingLoadingProgress >= 100) {
            const timer = setTimeout(() => setGradingLoadingReady(true), 400);
            return () => clearTimeout(timer);
        }
    }, [gradingLoadingProgress]);

    useEffect(() => {
        setActivePanel(isGradingScreen ? "grading" : "councils");
    }, [isGradingScreen]);

    useEffect(() => {
        if (!isGradingScreen || committees.length === 0) {
            return;
        }

        if (!committeeIdParam) {
            notifyInfo("Vui lòng bấm Tham gia tại hội đồng để vào phòng chấm.");
            navigate("/lecturer/committees", { replace: true });
            return;
        }

        const targetCommittee = committees.find((item) => item.id === committeeIdParam) ?? null;

        if (!targetCommittee) {
            notifyInfo("Không tìm thấy hội đồng đã chọn. Vui lòng vào lại từ Danh sách hội đồng.");
            navigate("/lecturer/committees", { replace: true });
            return;
        }

        if (selectedCommitteeId !== targetCommittee.id) {
            setSelectedCommitteeId(targetCommittee.id);
        }

        if (joinedCommitteeId !== targetCommittee.id) {
            setJoinedCommitteeId(targetCommittee.id);
        }
    }, [
        committees,
        committeeIdParam,
        isGradingScreen,
        joinedCommitteeId,
        navigate,
        notifyInfo,
        selectedCommitteeId,
    ]);

    const normalizedFallbackAllowedActions = useMemo(
        () => normalizeAllowedActions(fallbackAllowedActions),
        [fallbackAllowedActions],
    );

    const hasAllowedAction = (scopedActions: string[], ...actions: string[]) => {
        const normalizedScopedActions = normalizeAllowedActions(scopedActions);
        if (normalizedScopedActions.length > 0) {
            return includesAnyAction(normalizedScopedActions, ...actions);
        }
        if (normalizedFallbackAllowedActions.length > 0) {
            return includesAnyAction(normalizedFallbackAllowedActions, ...actions);
        }
        return false;
    };

    const notifyApiFailure = (response: ApiResponse<unknown> | null | undefined, fallback: string) => {
        const allowedActions = readEnvelopeAllowedActions(response);
        if (allowedActions.length > 0) {
            setFallbackAllowedActions(normalizeAllowedActions(allowedActions));
        }

        const warnings = readEnvelopeWarningMessages(response);
        if (warnings.length) {
            notifyInfo(warnings.join(" | "));
        }

        const success = readEnvelopeSuccess(response);
        const messages = readEnvelopeErrorMessages(response);
        const message = readEnvelopeMessage(response);
        if (!success) {
            notifyError(messages[0] || message || fallback);
            return true;
        }
        if (message) {
            notifyInfo(message);
        }

        return false;
    };

    const extractMissingMemberCodes = (error: unknown): string[] => {
        const record = toRecord(error);
        if (!record) {
            return [];
        }

        const candidateValues: unknown[] = [
            pickCaseInsensitiveValue<unknown>(record, ["missingMembers", "MissingMembers"], null),
            pickCaseInsensitiveValue<unknown>(record, ["missingMemberCodes", "MissingMemberCodes"], null),
            pickCaseInsensitiveValue<unknown>(record, ["members", "Members"], null),
            pickCaseInsensitiveValue<unknown>(record, ["errors", "Errors"], null),
        ];

        for (const candidate of candidateValues) {
            if (Array.isArray(candidate)) {
                return candidate
                    .map((item) => String(item ?? "").trim())
                    .filter(Boolean);
            }

            if (typeof candidate === "string") {
                return candidate
                    .split(/[;,|]/)
                    .map((item) => item.trim())
                    .filter(Boolean);
            }
        }

        return [];
    };

    const mapRevisionQueueRows = (rows: unknown): RevisionRequest[] => {
        if (!Array.isArray(rows)) {
            return [];
        }

        return rows
            .map((item, index): RevisionRequest => {
                const revisionId = Number(
                    pickSnapshotSection<unknown>(item, ["revisionId", "RevisionId", "id", "Id"], 0),
                );
                const assignmentIdValue = Number(
                    pickSnapshotSection<unknown>(item, ["assignmentId", "AssignmentId"], 0),
                );
                const statusRaw = String(
                    pickSnapshotSection<unknown>(item, ["finalStatus", "FinalStatus", "status", "Status"], "PENDING"),
                )
                    .trim()
                    .toUpperCase();

                const status: RevisionRequest["status"] =
                    statusRaw === "2" || statusRaw === "APPROVED"
                        ? "approved"
                        : statusRaw === "3" || statusRaw === "REJECTED"
                            ? "rejected"
                            : "pending";

                const topicCode = toStringOrNull(
                    pickSnapshotSection<unknown>(item, ["topicCode", "TopicCode"], null),
                );
                const topicTitle =
                    toStringOrNull(
                        pickSnapshotSection<unknown>(item, ["topicTitle", "TopicTitle", "title", "Title"], null),
                    ) ??
                    topicCode ??
                    "-";

                const studentCode =
                    toStringOrNull(
                        pickSnapshotSection<unknown>(
                            item,
                            ["studentCode", "StudentCode", "proposerStudentCode", "ProposerStudentCode"],
                            null,
                        ),
                    ) ?? "-";
                const reason = toStringOrNull(
                    pickSnapshotSection<unknown>(item, ["reason", "Reason", "rejectReason", "RejectReason"], null),
                );

                return {
                    revisionId:
                        Number.isFinite(revisionId) && revisionId > 0
                            ? revisionId
                            : Number.isFinite(assignmentIdValue) && assignmentIdValue > 0
                                ? assignmentIdValue
                                : index + 1,
                    assignmentId:
                        Number.isFinite(assignmentIdValue) && assignmentIdValue > 0
                            ? assignmentIdValue
                            : null,
                    studentCode,
                    topicCode,
                    topicTitle,
                    revisionFileUrl: toStringOrNull(
                        pickSnapshotSection<unknown>(
                            item,
                            ["revisionFileUrl", "RevisionFileUrl", "fileUrl", "FileUrl"],
                            null,
                        ),
                    ),
                    lastUpdated: toStringOrNull(
                        pickSnapshotSection<unknown>(item, ["lastUpdated", "LastUpdated", "updatedAt", "UpdatedAt"], null),
                    ),
                    status,
                    ...(reason ? { reason } : {}),
                };
            })
            ;
    };

    const mapDefenseDocuments = (documents: unknown): DefenseDocument[] => {
        if (!Array.isArray(documents)) {
            return [];
        }

        return documents
            .map((entry, index) => {
                if (!entry || typeof entry !== "object") {
                    return null;
                }

                const record = entry as Record<string, unknown>;
                const fileId = Number(
                    pickSnapshotSection<unknown>(
                        record,
                        ["fileID", "FileID", "fileId", "FileId", "documentId", "DocumentId", "id", "Id"],
                        0,
                    ),
                );
                const rawFileUrl = String(
                    pickSnapshotSection<unknown>(
                        record,
                        ["fileURL", "FileURL", "fileUrl", "FileUrl", "downloadUrl", "DownloadUrl", "url", "Url"],
                        "",
                    ),
                ).trim();

                const fallbackDownloadUrl =
                    Number.isFinite(fileId) && fileId > 0
                        ? `/api/SubmissionFiles/download/${fileId}`
                        : "";
                const resolvedUrl = rawFileUrl || fallbackDownloadUrl;
                const normalizedFileUrl = normalizeUrl(resolvedUrl);

                const rawName = String(
                    pickSnapshotSection<unknown>(
                        record,
                        ["fileName", "FileName", "documentName", "DocumentName", "name", "Name", "documentType", "DocumentType"],
                        "",
                    ),
                ).trim();

                const documentType = String(
                    pickSnapshotSection<unknown>(record, ["documentType", "DocumentType"], ""),
                ).trim();

                const fallbackName =
                    resolvedUrl
                        .split("?")[0]
                        .split("#")[0]
                        .split("/")
                        .pop() || documentType || `Bao-cao-${index + 1}`;

                const uploadedAt = String(
                    pickSnapshotSection<unknown>(record, ["uploadedAt", "UploadedAt", "generatedAt", "GeneratedAt"], ""),
                ).trim();

                const fileName = rawName || decodeURIComponent(fallbackName);
                if (!fileName && !normalizedFileUrl) {
                    return null;
                }

                return {
                    documentId:
                        Number.isFinite(fileId) && fileId > 0
                            ? fileId
                            : index + 1,
                    fileName,
                    fileUrl: normalizedFileUrl,
                    mimeType:
                        String(
                            pickSnapshotSection<unknown>(
                                record,
                                ["mimeType", "MimeType", "contentType", "ContentType", "fileType", "FileType"],
                                "",
                            ),
                        ).trim() || null,
                    uploadedAt: uploadedAt || null,
                };
            })
            .filter((item): item is DefenseDocument => Boolean(item));
    };

    const mapCommitteeMembers = (rawMembers: unknown): CommitteeMemberView[] => {
        if (!Array.isArray(rawMembers)) {
            return [];
        }

        return rawMembers
            .map((member, index) => {
                const record = toRecord(member);
                if (!record) {
                    return null;
                }

                const roleRaw = String(
                    pickSnapshotSection<unknown>(record, ["role", "Role", "roleCode", "RoleCode"], ""),
                ).trim();
                const roleCode = normalizeCommitteeRole(roleRaw);
                const lecturerCode =
                    toStringOrNull(
                        pickSnapshotSection<unknown>(
                            record,
                            ["lecturerCode", "LecturerCode", "memberCode", "MemberCode"],
                            null,
                        ),
                    ) ?? "";
                const lecturerName =
                    toStringOrNull(
                        pickSnapshotSection<unknown>(
                            record,
                            ["lecturerName", "LecturerName", "fullName", "FullName", "name", "Name"],
                            null,
                        ),
                    ) ??
                    (lecturerCode ? `GV ${lecturerCode}` : "Chưa cập nhật");
                const degree = toStringOrNull(
                    pickSnapshotSection<unknown>(record, ["degree", "Degree", "academicTitle", "AcademicTitle"], null),
                );
                const organization = toStringOrNull(
                    pickSnapshotSection<unknown>(record, ["organization", "Organization", "workplace", "Workplace"], null),
                );

                return {
                    memberId:
                        toStringOrNull(
                            pickSnapshotSection<unknown>(record, ["memberId", "MemberId", "id", "Id"], null),
                        ) ?? `${lecturerCode || "member"}-${index + 1}`,
                    lecturerCode,
                    lecturerName,
                    degree,
                    organization,
                    roleRaw,
                    roleCode,
                    roleLabel: getRoleLabel(roleCode),
                };
            })
            .filter((member): member is CommitteeMemberView => Boolean(member));
    };

    const mapScoringMatrixRows = (
        items: Array<Record<string, unknown>>,
        committeeIdFallback = 0,
        committeeCodeFallback = "",
        defaultSession: SessionCode | null = null,
        committeeNameFallback = "",
    ): ScoringMatrixRow[] =>
        items.map((item) => {
            const topicRecord = toRecord(
                pickSnapshotSection<unknown>(item, ["topic", "Topic"], null),
            );
            const rawDocuments = pickSnapshotSection<unknown>(
                item,
                [
                    "defenseDocuments",
                    "DefenseDocuments",
                    "reportDocuments",
                    "ReportDocuments",
                    "documents",
                    "Documents",
                    "files",
                    "Files",
                ],
                [],
            );

            const topicCode =
                toStringOrNull(
                    pickSnapshotSection<unknown>(item, ["topicCode", "TopicCode"], null),
                ) ?? null;
            const assignmentCode =
                toStringOrNull(
                    pickSnapshotSection<unknown>(item, ["assignmentCode", "AssignmentCode"], null),
                ) ?? topicCode ?? "-";

            const supervisorNameFromRow = toStringOrNull(
                pickSnapshotSection<unknown>(
                    item,
                    [
                        "supervisorLecturerName",
                        "SupervisorLecturerName",
                        "supervisorName",
                        "SupervisorName",
                        "gvhdName",
                        "GvhdName",
                    ],
                    null,
                ),
            );
            const supervisorNameFromTopic = topicRecord
                ? toStringOrNull(
                    pickSnapshotSection<unknown>(
                        topicRecord,
                        [
                            "supervisorLecturerName",
                            "SupervisorLecturerName",
                            "supervisorName",
                            "SupervisorName",
                            "lecturerName",
                            "LecturerName",
                            "supervisorFullName",
                            "SupervisorFullName",
                        ],
                        null,
                    ),
                )
                : null;
            const supervisorOrganization = toStringOrNull(
                pickSnapshotSection<unknown>(
                    item,
                    ["supervisorOrganization", "SupervisorOrganization", "organization", "Organization"],
                    null,
                ),
            );
            const supervisorCode =
                toStringOrNull(
                    pickSnapshotSection<unknown>(
                        item,
                        ["supervisorLecturerCode", "SupervisorLecturerCode", "supervisorCode", "SupervisorCode"],
                        null,
                    ),
                ) ??
                (topicRecord
                    ? toStringOrNull(
                        pickSnapshotSection<unknown>(
                            topicRecord,
                            ["supervisorLecturerCode", "SupervisorLecturerCode", "supervisorCode", "SupervisorCode"],
                            null,
                        ),
                    )
                    : null);

            const rowTagNames = normalizeTopicTagNames(
                pickSnapshotSection<unknown>(
                    item,
                    ["topicTags", "TopicTags", "tags", "Tags", "tagNames", "TagNames", "tagCodes", "TagCodes"],
                    [],
                ),
            );
            const topicTagNames = topicRecord
                ? normalizeTopicTagNames(
                    pickSnapshotSection<unknown>(
                        topicRecord,
                        ["topicTags", "TopicTags", "tags", "Tags", "tagNames", "TagNames", "tagCodes", "TagCodes"],
                        [],
                    ),
                )
                : [];
            const topicTags = Array.from(new Set([...rowTagNames, ...topicTagNames]));

            const startTime = normalizeTimeText(
                pickSnapshotSection<unknown>(
                    item,
                    ["startTime", "StartTime", "slotStart", "SlotStart"],
                    null,
                ),
            );
            const endTime = normalizeTimeText(
                pickSnapshotSection<unknown>(
                    item,
                    ["endTime", "EndTime", "slotEnd", "SlotEnd"],
                    null,
                ),
            );

            const rawSession = toStringOrNull(
                pickSnapshotSection<unknown>(
                    item,
                    ["session", "Session", "sessionCode", "SessionCode"],
                    null,
                ),
            );

            const scheduledAt = toIsoDateOrNull(
                pickSnapshotSection<unknown>(item, ["scheduledAt", "ScheduledAt", "defenseDate", "DefenseDate"], null),
            );

            const resolvedSession = rawSession
                ? normalizeSessionCode(rawSession)
                : inferSessionFromTime(startTime) ?? defaultSession ?? null;

            return {
                committeeId:
                    Number(
                        pickSnapshotSection<unknown>(item, ["committeeId", "CommitteeId", "councilId", "CouncilId"], committeeIdFallback),
                    ) || committeeIdFallback,
                committeeCode:
                    String(
                        pickSnapshotSection<unknown>(item, ["committeeCode", "CommitteeCode", "councilCode", "CouncilCode"], committeeCodeFallback),
                    ) || committeeCodeFallback,
                committeeName:
                    toStringOrNull(
                        pickSnapshotSection<unknown>(item, ["committeeName", "CommitteeName", "councilName", "CouncilName", "name", "Name"], null),
                    ) ?? committeeNameFallback ?? committeeCodeFallback,
                assignmentId: Number(pickSnapshotSection<unknown>(item, ["assignmentId", "AssignmentId"], 0)),
                assignmentCode,
                topicCode,
                topicTitle:
                    toStringOrNull(
                        pickSnapshotSection<unknown>(item, ["topicTitle", "TopicTitle", "title", "Title"], null),
                    ) ?? assignmentCode,
                studentCode: String(pickSnapshotSection<unknown>(item, ["studentCode", "StudentCode"], "-")),
                studentName: String(pickSnapshotSection<unknown>(item, ["studentName", "StudentName"], "-")),
                className: toStringOrNull(
                    pickSnapshotSection<unknown>(item, ["className", "ClassName", "classCode", "ClassCode"], null),
                ),
                cohortCode: toStringOrNull(
                    pickSnapshotSection<unknown>(item, ["cohortCode", "CohortCode"], null),
                ),
                supervisorLecturerName:
                    supervisorNameFromRow ??
                    supervisorNameFromTopic ??
                    (supervisorCode ? `GV ${supervisorCode}` : null),
                supervisorOrganization,
                topicTags,
                session: resolvedSession,
                scheduledAt,
                startTime,
                endTime,
                topicSupervisorScore: toNumberOrNull(
                    pickSnapshotSection<unknown>(item, ["topicSupervisorScore", "TopicSupervisorScore", "scoreGvhd", "ScoreGvhd"], null),
                ),
                scoreGvhd: toNumberOrNull(
                    pickSnapshotSection<unknown>(item, ["scoreGvhd", "ScoreGvhd", "topicSupervisorScore", "TopicSupervisorScore"], null),
                ),
                scoreCt: toNumberOrNull(
                    pickSnapshotSection<unknown>(item, ["scoreCt", "ScoreCt"], null),
                ),
                scoreTk: toNumberOrNull(
                    pickSnapshotSection<unknown>(item, ["scoreTk", "ScoreTk", "scoreUvtk", "ScoreUvtk"], null),
                ),
                scorePb: toNumberOrNull(
                    pickSnapshotSection<unknown>(item, ["scorePb", "ScorePb", "scoreUvpb", "ScoreUvpb"], null),
                ),
                commentGvhd: toStringOrNull(
                    pickSnapshotSection<unknown>(item, ["commentGvhd", "CommentGvhd"], null),
                ) ?? null,
                commentCt: toStringOrNull(
                    pickSnapshotSection<unknown>(item, ["commentCt", "CommentCt"], null),
                ) ?? null,
                commentTk: toStringOrNull(
                    pickSnapshotSection<unknown>(item, ["commentTk", "CommentTk"], null),
                ) ?? null,
                commentPb: toStringOrNull(
                    pickSnapshotSection<unknown>(item, ["commentPb", "CommentPb"], null),
                ) ?? null,
                finalScore: toNumberOrNull(pickSnapshotSection<unknown>(item, ["finalScore", "FinalScore"], null)),
                finalGrade:
                    toStringOrNull(
                        pickSnapshotSection<unknown>(item, ["finalGrade", "FinalGrade", "finalLetter", "FinalLetter"], null),
                    ) ?? null,
                variance: toNumberOrNull(pickSnapshotSection<unknown>(item, ["variance", "Variance"], null)),
                isLocked: Boolean(pickSnapshotSection<unknown>(item, ["isLocked", "IsLocked"], false)),
                status: String(pickSnapshotSection<unknown>(item, ["status", "Status"], "PENDING")),
                submittedCount: Number(pickSnapshotSection<unknown>(item, ["submittedCount", "SubmittedCount"], 0)),
                requiredCount: Number(pickSnapshotSection<unknown>(item, ["requiredCount", "RequiredCount"], 0)),
                defenseDocuments: mapDefenseDocuments(rawDocuments),
            };
        });

    const refreshAllScoringRows = async () => {
        const [allMatrixResponse, topicProgressResponse] = await Promise.all([
            lecturerApi.getScoringMatrix(),
            lecturerApi.getTopicFinalProgress(),
        ]);
        if (notifyApiFailure(allMatrixResponse as ApiResponse<unknown>, "Không tải được danh sách đề tài chấm điểm.")) {
            return;
        }

        const matrixItems = (allMatrixResponse?.data ?? []) as Array<Record<string, unknown>>;
        setAllScoringRows(mapScoringMatrixRows(matrixItems));

        if (!notifyApiFailure(topicProgressResponse as ApiResponse<unknown>, "Không tải được tiến độ điểm tổng theo đề tài.")) {
            const rows = (topicProgressResponse?.data ?? []) as Array<Record<string, unknown>>;
            setTopicFinalProgressRows(
                rows.map((item) => ({
                    committeeId: Number(item.committeeId ?? 0),
                    committeeCode: String(item.committeeCode ?? ""),
                    totalTopics: Number(item.totalTopics ?? 0),
                    scoredTopics: Number(item.scoredTopics ?? 0),
                    progressPercent: Number(item.progressPercent ?? 0),
                })),
            );
        }
    };

    const refreshRevisionQueue = async () => {
        const response = await lecturerApi.getRevisionQueue();
        if (notifyApiFailure(response as ApiResponse<unknown>, "Không tải được hàng chờ chỉnh sửa.")) {
            return;
        }
        const mapped = mapRevisionQueueRows((response?.data ?? []) as Array<Record<string, unknown>>);
        setRevisionQueue(mapped);
        setRevision((prev) => mapped.find((item) => item.revisionId === prev.revisionId) ?? mapped[0] ?? EMPTY_REVISION);
    };

    const refreshScoringData = async (committeeId: number) => {
        const [matrixRes, alertsRes, topicProgressRes] = await Promise.all([
            lecturerApi.getScoringMatrix(committeeId),
            lecturerApi.getScoringAlerts(committeeId),
            lecturerApi.getTopicFinalProgress(),
        ]);

        if (notifyApiFailure(matrixRes as ApiResponse<unknown>, "Không tải được bảng chấm điểm.")) {
            return;
        }

        const matrixItems = (matrixRes?.data ?? []) as Array<Record<string, unknown>>;
        const committeeSessionFallback = committees.find((item) => item.id === selectedCommitteeId)?.session ?? null;
        const committeeNameFallback = committees.find((item) => item.id === selectedCommitteeId)?.name ?? selectedCommitteeId;
        const mappedMatrix = mapScoringMatrixRows(
            matrixItems,
            committeeId,
            selectedCommitteeId,
            committeeSessionFallback,
            committeeNameFallback,
        );
        setScoringMatrix(mappedMatrix);
        setSelectedAssignmentId((prev) => {
            if (prev > 0 && mappedMatrix.some((row) => row.assignmentId === prev)) {
                return prev;
            }
            return mappedMatrix[0]?.assignmentId ?? 0;
        });

        const alertItems = (alertsRes?.data ?? []) as Array<Record<string, unknown>>;
        setScoringAlerts(
            alertItems.map((item) => ({
                assignmentId: Number(item.assignmentId ?? 0),
                message: String(item.message ?? ""),
                value: Number.isFinite(Number(item.value)) ? Number(item.value) : null,
                threshold: Number.isFinite(Number(item.threshold)) ? Number(item.threshold) : null,
            }))
        );

        if (!notifyApiFailure(topicProgressRes as ApiResponse<unknown>, "Không tải được tiến độ điểm tổng theo đề tài.")) {
            const rows = (topicProgressRes?.data ?? []) as Array<Record<string, unknown>>;
            setTopicFinalProgressRows(
                rows.map((item) => ({
                    committeeId: Number(item.committeeId ?? 0),
                    committeeCode: String(item.committeeCode ?? ""),
                    totalTopics: Number(item.totalTopics ?? 0),
                    scoredTopics: Number(item.scoredTopics ?? 0),
                    progressPercent: Number(item.progressPercent ?? 0),
                })),
            );
        }
    };

    const hydrateMinutes = async (committeeId: number, assignmentId?: number) => {
        const response = await lecturerApi.getCommitteeMinutes(committeeId);
        if (notifyApiFailure(response as ApiResponse<unknown>, "Không tải được biên bản hội đồng.")) {
            return;
        }

        const rows = (response?.data ?? []) as Array<Record<string, unknown>>;
        const target =
            rows.find((item) => Number(item.assignmentId ?? 0) === (assignmentId ?? selectedAssignmentId)) ??
            rows[0] ??
            null;
        if (!target) {
            setReview("");
            setQuestions("");
            setAnswers("");
            setQuestionAnswers([]);
            setStrengths("");
            setWeaknesses("");
            setRecommendations("");
            setChapterContents([]);
            setCouncilDiscussionConclusion("");
            setChairConclusion("");
            setReviewerSections({
                necessity: "",
                novelty: "",
                methodologyReliability: "",
                resultsContent: "",
                limitations: "",
                suggestions: "",
                overallConclusion: "",
            });
            setDeletedChapterDraft(null);
            setDeletedQuestionAnswerDraft(null);
            setMinuteSavedAt(null);
            return;
        }

        const toText = (value: unknown) => String(value ?? "");
        const chapterRows = Array.isArray(target.chapterContents)
            ? target.chapterContents
                .map((item) =>
                    toRecord(item)
                        ? {
                            chapterTitle: toText((item as Record<string, unknown>).chapterTitle),
                            content: toText((item as Record<string, unknown>).content),
                        }
                        : null,
                )
                .filter((item): item is MinuteChapterInput => Boolean(item))
            : [];

        const questionAnswerRows = Array.isArray(target.questionAnswers)
            ? target.questionAnswers
                .map((item) =>
                    toRecord(item)
                        ? {
                            question: toText((item as Record<string, unknown>).question),
                            answer: toText((item as Record<string, unknown>).answer),
                        }
                        : null,
                )
                .filter((item): item is MinuteQuestionAnswer => Boolean(item))
            : [];

        const reviewerSectionsRaw = toRecord(target.reviewerSections);

        setReview(toText(target.reviewerComments));
        setQuestions(toText(target.committeeMemberComments));
        setQuestionAnswers(
            questionAnswerRows.length > 0
                ? questionAnswerRows
                : [
                    {
                        question: "[II.1] ",
                        answer: toText(target.qnaDetails),
                    },
                ],
        );
        setAnswers(toText(target.qnaDetails));
        setStrengths(toText(target.strengths));
        setWeaknesses(toText(target.weaknesses));
        setRecommendations(toText(target.recommendations));
        setChapterContents(chapterRows);
        setCouncilDiscussionConclusion(toText(target.councilDiscussionConclusion));
        setChairConclusion(toText(target.chairConclusion));
        setReviewerSections({
            necessity: toText(reviewerSectionsRaw?.necessity),
            novelty: toText(reviewerSectionsRaw?.novelty),
            methodologyReliability: toText(reviewerSectionsRaw?.methodologyReliability),
            resultsContent: toText(reviewerSectionsRaw?.resultsContent),
            limitations: toText(reviewerSectionsRaw?.limitations),
            suggestions: toText(reviewerSectionsRaw?.suggestions),
            overallConclusion: toText(reviewerSectionsRaw?.overallConclusion),
        });
        setDeletedChapterDraft(null);
        setDeletedQuestionAnswerDraft(null);
        setMinuteSavedAt(toStringOrNull(target.lastUpdated));
    };

    useEffect(() => {
        const hydrateLecturerData = async () => {
            setLoadingData(true);
            try {
                const [committeeRes, revisionRes] = await Promise.all([
                    lecturerApi.getCommittees() as Promise<
                        ApiResponse<{
                            items?: Array<Record<string, unknown>>;
                            councilListLocked?: boolean | null;
                            councilLockStatus?: string | null;
                        }>
                    >,
                    lecturerApi.getRevisionQueue(),
                ]);
                setCurrentSnapshotError(null);

                const allowedActions =
                    committeeRes?.allowedActions ?? committeeRes?.AllowedActions;
                if (allowedActions) {
                    setFallbackAllowedActions(normalizeAllowedActions(allowedActions));
                }

                const committeePayload =
                    (committeeRes?.data as {
                        items?: Array<Record<string, unknown>>;
                        councilListLocked?: boolean | null;
                        councilLockStatus?: string | null;
                    } | null) ?? null;

                const lockStatusText = String(committeePayload?.councilLockStatus ?? "")
                    .trim()
                    .toUpperCase();
                if (typeof committeePayload?.councilListLocked === "boolean") {
                    setCouncilListLocked(committeePayload.councilListLocked);
                    setCouncilLockStatus(
                        lockStatusText || (committeePayload.councilListLocked ? "LOCKED" : "UNLOCKED"),
                    );
                } else if (lockStatusText) {
                    setCouncilListLocked(lockStatusText === "LOCKED");
                    setCouncilLockStatus(lockStatusText);
                } else {
                    setCouncilListLocked(null);
                    setCouncilLockStatus("UNKNOWN");
                }

                const committeeItems =
                    (committeePayload?.items ?? []) as Array<Record<string, unknown>>;

                if (committeeItems.length) {
                    const mapped = committeeItems.map((item, index) => {
                        const roleValue = pickSnapshotSection<unknown>(
                            item,
                            ["normalizedRole", "NormalizedRole", "role", "Role"],
                            "",
                        );
                        const roleCode = normalizeCommitteeRole(roleValue);
                        const numericIdRaw = Number(
                            pickSnapshotSection<unknown>(
                                item,
                                ["committeeId", "CommitteeId", "councilId", "CouncilId", "id", "Id"],
                                0,
                            ),
                        );
                        const committeeCode = String(
                            pickSnapshotSection<unknown>(
                                item,
                                ["committeeCode", "CommitteeCode", "councilCode", "CouncilCode"],
                                `HD-${index + 1}`,
                            ),
                        ).trim() || `HD-${index + 1}`;
                        const fallbackNumeric = Number(String(committeeCode).replace(/\D+/g, ""));
                        const numericId =
                            Number.isFinite(numericIdRaw) && numericIdRaw > 0
                                ? numericIdRaw
                                : Number.isFinite(fallbackNumeric) && fallbackNumeric > 0
                                    ? fallbackNumeric
                                    : index + 1;

                        const allowedScoringActions = normalizeAllowedActions(
                            pickSnapshotSection<unknown>(
                                item,
                                ["allowedScoringActions", "AllowedScoringActions"],
                                [],
                            ),
                        );
                        const allowedMinuteActions = normalizeAllowedActions(
                            pickSnapshotSection<unknown>(
                                item,
                                ["allowedMinuteActions", "AllowedMinuteActions"],
                                [],
                            ),
                        );
                        const allowedRevisionActions = normalizeAllowedActions(
                            pickSnapshotSection<unknown>(
                                item,
                                ["allowedRevisionActions", "AllowedRevisionActions"],
                                [],
                            ),
                        );

                        const sessionRaw = toStringOrNull(
                            pickSnapshotSection<unknown>(
                                item,
                                ["sessionCode", "SessionCode", "session", "Session"],
                                null,
                            ),
                        );

                        const committeeName =
                            toStringOrNull(
                                pickSnapshotSection<unknown>(
                                    item,
                                    ["name", "Name", "committeeName", "CommitteeName"],
                                    null,
                                ),
                            ) ?? `Hội đồng ${committeeCode}`;

                        const startTime = normalizeTimeText(
                            pickSnapshotSection<unknown>(
                                item,
                                ["startTime", "StartTime", "slotStart", "SlotStart"],
                                null,
                            ),
                        );
                        const endTime = normalizeTimeText(
                            pickSnapshotSection<unknown>(
                                item,
                                ["endTime", "EndTime", "slotEnd", "SlotEnd"],
                                null,
                            ),
                        );

                        const scheduledAt = toIsoDateOrNull(
                            pickSnapshotSection<unknown>(
                                item,
                                ["scheduledAt", "ScheduledAt", "defenseDate", "DefenseDate"],
                                null,
                            ),
                        );

                        const resolvedSession = sessionRaw
                            ? normalizeSessionCode(sessionRaw)
                            : inferSessionFromTime(startTime);

                        const slot =
                            startTime && endTime
                                ? `${startTime} - ${endTime}`
                                : startTime
                                    ? `Từ ${startTime}`
                                    : endTime
                                        ? `Đến ${endTime}`
                                        : null;

                        const defenseDate = scheduledAt ? scheduledAt.slice(0, 10) : null;

                        const members = mapCommitteeMembers(
                            pickSnapshotSection<unknown>(
                                item,
                                ["members", "Members", "committeeMembers", "CommitteeMembers"],
                                [],
                            ),
                        );

                        return {
                            id: committeeCode,
                            name: committeeName,
                            numericId,
                            room: String(pickSnapshotSection<unknown>(item, ["room", "Room"], "-") ?? "-") || "-",
                            session: resolvedSession,
                            date: defenseDate,
                            slot,
                            studentCount: Number(
                                pickSnapshotSection<unknown>(
                                    item,
                                    ["studentCount", "StudentCount", "topicCount", "TopicCount", "assignmentCount", "AssignmentCount"],
                                    0,
                                ) ?? 0,
                            ),
                            status: mapCommitteeStatus(pickSnapshotSection<unknown>(item, ["status", "Status"], "")),
                            normalizedRole: roleCode,
                            roleCode,
                            roleLabel: getRoleLabel(roleCode),
                            roleRaw: String(pickSnapshotSection<unknown>(item, ["role", "Role"], "")).trim(),
                            allowedScoringActions,
                            allowedMinuteActions,
                            allowedRevisionActions,
                            members,
                        };
                    }) satisfies Committee[];
                    setCommittees(mapped);
                    setSelectedCommitteeId((prev) => (mapped.some((item) => item.id === prev) ? prev : mapped[0]?.id ?? ""));
                    setDetailCommitteeId((prev) => (mapped.some((item) => item.id === prev) ? prev : ""));
                } else {
                    setCommittees([]);
                    setSelectedCommitteeId("");
                    setDetailCommitteeId("");
                }

                if (!notifyApiFailure(revisionRes as ApiResponse<unknown>, "Không tải được hàng chờ chỉnh sửa.")) {
                    const mappedRevisions = mapRevisionQueueRows((revisionRes?.data ?? []) as Array<Record<string, unknown>>);
                    setRevisionQueue(mappedRevisions);
                    setRevision(mappedRevisions[0] ?? EMPTY_REVISION);
                }

                await refreshAllScoringRows();
            } catch (error) {
                setCommittees([]);
                setAllScoringRows([]);
                setRevisionQueue([]);
                setRevision(EMPTY_REVISION);
                setSelectedCommitteeId("");
                setDetailCommitteeId("");
                setCouncilListLocked(null);
                setCouncilLockStatus("UNKNOWN");

                if (error instanceof FetchDataError) {
                    const apiMessage = readApiErrorMessage(error.data);

                    if (error.status === 404) {
                        const message =
                            apiMessage ??
                            "Bạn chưa được gán vào đợt bảo vệ đang hoạt động. Vui lòng liên hệ quản trị viên.";
                        setCurrentSnapshotError(message);
                        setCurrentPeriod(null);
                        notifyInfo(message);
                        return;
                    }

                    if (error.status === 409) {
                        const message =
                            apiMessage ??
                            "Tài khoản hiện tại đang gắn với nhiều đợt bảo vệ hoạt động. Vui lòng liên hệ quản trị viên để xử lý dữ liệu.";
                        setCurrentSnapshotError(message);
                        setCurrentPeriod(null);
                        notifyError(message);
                        return;
                    }
                }

                if (error instanceof Error && error.message === "CURRENT_PERIOD_CONTRACT_INVALID") {
                    const message = "Dữ liệu snapshot hiện tại không chứa thông tin đợt bảo vệ hợp lệ.";
                    setCurrentSnapshotError(message);
                    setCurrentPeriod(null);
                    notifyError(message);
                    return;
                }

                setCurrentSnapshotError("Không tải được dữ liệu giảng viên từ API.");
                notifyError("Không tải được dữ liệu giảng viên từ API.");
            } finally {
                setLoadingData(false);
            }
        };

        void hydrateLecturerData();
    }, [periodId]);

    const committeeStats = useMemo(() => {
        const live = committees.filter((item) => item.status === "Đang họp").length;
        const upcoming = committees.filter((item) => item.status === "Sắp diễn ra").length;
        const locked = committees.filter((item) => item.status === "Đã chốt" || item.status === "Đã đóng").length;
        const pendingRevision = revisionQueue.filter((item) => item.status === "pending").length;
        return { live, upcoming, locked, pendingRevision };
    }, [committees, revisionQueue]);

    const periodDisplay = currentPeriod
        ? `${currentPeriod.name} (#${currentPeriod.periodId})`
        : periodId
            ? `Đợt #${periodId}`
            : "Chưa xác định";
    const waitingCouncilLock = !currentSnapshotError && councilListLocked === false;
    const hasCommitteeAccess = councilListLocked === true && committees.length > 0;
    const accessDeniedMessage =
        councilListLocked === false
            ? "Danh sách hội đồng chưa được chốt. Giảng viên chỉ có thể xem khi hội đồng đã khóa."
            : councilListLocked === true
                ? "Giảng viên hiện không thuộc hội đồng nào trong đợt bảo vệ này."
                : "Không xác định được quyền xem hội đồng hiện tại.";

    const selectedCommittee = useMemo(
        () => committees.find((item) => item.id === selectedCommitteeId) ?? null,
        [committees, selectedCommitteeId]
    );
    const joinedCommittee = useMemo(
        () => committees.find((item) => item.id === joinedCommitteeId) ?? null,
        [committees, joinedCommitteeId],
    );
    const detailCommittee = useMemo(
        () => committees.find((item) => item.id === detailCommitteeId) ?? null,
        [committees, detailCommitteeId],
    );
    const selectedCommitteeNumericId = useMemo(() => {
        if (selectedCommittee?.numericId && selectedCommittee.numericId > 0) {
            return selectedCommittee.numericId;
        }
        const parsed = Number(String(selectedCommitteeId).replace(/\D+/g, ""));
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    }, [selectedCommittee, selectedCommitteeId]);

    const selectedMatrixRow = useMemo(
        () => scoringMatrix.find((row) => row.assignmentId === selectedAssignmentId) ?? null,
        [scoringMatrix, selectedAssignmentId]
    );

    const selectedCommitteeScoreRows = useMemo(
        () => scoringMatrix.filter((row) => row.committeeId === selectedCommitteeNumericId),
        [scoringMatrix, selectedCommitteeNumericId],
    );

    const isRowInCommittee = (row: ScoringMatrixRow, committee: Committee | null) => {
        if (!committee) {
            return false;
        }
        return (
            row.committeeId === committee.numericId ||
            String(row.committeeCode).trim().toUpperCase() === committee.id.trim().toUpperCase()
        );
    };

    const committeeBadgeStats = useMemo(() => {
        const statsMap = new Map<string, { total: number; scored: number; locked: number }>();

        committees.forEach((committee) => {
            statsMap.set(committee.id, { total: 0, scored: 0, locked: 0 });
        });

        allScoringRows.forEach((row) => {
            const matched = committees.find((committee) => isRowInCommittee(row, committee));
            if (!matched) {
                return;
            }

            const current = statsMap.get(matched.id) ?? { total: 0, scored: 0, locked: 0 };
            current.total += 1;
            if (row.finalScore != null && Number(row.finalScore) > 0) {
                current.scored += 1;
            }
            if (row.isLocked) {
                current.locked += 1;
            }
            statsMap.set(matched.id, current);
        });

        committees.forEach((committee) => {
            const fromTopicProgress =
                topicFinalProgressRows.find(
                    (row) =>
                        row.committeeId === committee.numericId ||
                        String(row.committeeCode).trim().toUpperCase() === committee.id.trim().toUpperCase(),
                ) ?? null;

            const current = statsMap.get(committee.id) ?? { total: 0, scored: 0, locked: 0 };
            current.total = Math.max(current.total, fromTopicProgress?.totalTopics ?? 0, committee.studentCount);
            current.scored = Math.max(current.scored, fromTopicProgress?.scoredTopics ?? 0);
            statsMap.set(committee.id, current);
        });

        return statsMap;
    }, [allScoringRows, committees, topicFinalProgressRows]);

    const detailCommitteeRows = useMemo(
        () => allScoringRows.filter((row) => isRowInCommittee(row, detailCommittee)),
        [allScoringRows, detailCommittee],
    );

    const selectedRevisionItem = useMemo(
        () =>
            revisionQueue.find((item) => item.assignmentId != null && item.assignmentId === selectedAssignmentId) ??
            revision,
        [revision, revisionQueue, selectedAssignmentId],
    );

    const getSessionSortOrder = (session: SessionCode | null): number => {
        if (session === "MORNING") {
            return 0;
        }
        if (session === "AFTERNOON") {
            return 1;
        }
        return 2;
    };

    const sortedScoringRows = useMemo(
        () =>
            [...scoringMatrix].sort((left, right) => {
                const leftSessionOrder = getSessionSortOrder(left.session);
                const rightSessionOrder = getSessionSortOrder(right.session);
                if (leftSessionOrder !== rightSessionOrder) {
                    return leftSessionOrder - rightSessionOrder;
                }
                const leftTime = new Date(left.scheduledAt ?? 0).getTime();
                const rightTime = new Date(right.scheduledAt ?? 0).getTime();
                if (leftTime !== rightTime) {
                    return leftTime - rightTime;
                }
                if ((left.startTime ?? "") !== (right.startTime ?? "")) {
                    return (left.startTime ?? "").localeCompare(right.startTime ?? "");
                }
                return left.assignmentId - right.assignmentId;
            }),
        [scoringMatrix],
    );

    const morningRows = useMemo(
        () => sortedScoringRows.filter((row) => row.session === "MORNING"),
        [sortedScoringRows],
    );

    const afternoonRows = useMemo(
        () => sortedScoringRows.filter((row) => row.session === "AFTERNOON"),
        [sortedScoringRows],
    );

    const scoreGvhdDisplay =
        selectedMatrixRow?.topicSupervisorScore ??
        selectedMatrixRow?.scoreGvhd ??
        null;

    const selectedScoringActions = selectedCommittee?.allowedScoringActions ?? [];
    const selectedMinuteActions = selectedCommittee?.allowedMinuteActions ?? [];
    const selectedRevisionActions = selectedCommittee?.allowedRevisionActions ?? [];

    const hasScoringPermissionSource =
        selectedScoringActions.length > 0 || normalizedFallbackAllowedActions.length > 0;
    const hasMinutePermissionSource =
        selectedMinuteActions.length > 0 || normalizedFallbackAllowedActions.length > 0;
    const hasRevisionPermissionSource =
        selectedRevisionActions.length > 0 || normalizedFallbackAllowedActions.length > 0;

    const canOpenSessionByActions = hasAllowedAction(
        selectedScoringActions,
        "OPEN_SESSION",
        "UC3.1.OPEN",
    );
    const canSubmitScoreByActions = hasAllowedAction(
        selectedScoringActions,
        "SUBMIT",
        "SUBMIT_SCORE",
        "UC3.2.SUBMIT",
    );
    const canRequestReopenByActions = hasAllowedAction(
        selectedScoringActions,
        "REOPEN_REQUEST",
        "REOPEN_SCORE",
        "UC3.3.REOPEN",
    );
    const canLockSessionByActions = hasAllowedAction(
        selectedScoringActions,
        "LOCK_SESSION",
        "LOCK_SCORE",
        "UC3.5.LOCK",
    );

    const isChairRole = selectedCommittee?.roleCode === "CT";
    const isSecretaryRole = selectedCommittee?.roleCode === "UVTK";
    const isReviewerRole = selectedCommittee?.roleCode === "UVPB";

    const canOpenSession = canOpenSessionByActions || isChairRole;
    const canSubmitScore = canSubmitScoreByActions || isChairRole || isSecretaryRole || isReviewerRole;
    const canRequestReopen = canRequestReopenByActions || isChairRole;
    
    const allTopicsGraded = useMemo(() => {
        if (scoringMatrix.length === 0) return false;
        // In backend, "COMPLETED" or "LOCKED" status means all required scores are present
        return scoringMatrix.every(row => row.status === "COMPLETED" || row.status === "LOCKED");
    }, [scoringMatrix]);

    const canLockSession = (canLockSessionByActions || isChairRole) && allTopicsGraded;


    const canEditMinutesByActions = hasAllowedAction(
        selectedMinuteActions,
        "UPSERT",
        "UPSERT_MINUTES",
        "UPDATE_MINUTES",
        "EDIT_MINUTES",
    );
    const canEditMinutesSections123 = canEditMinutesByActions && isSecretaryRole;
    const canEditMinutesSection4 = canEditMinutesByActions && isChairRole;
    const canChairSeeMinutesSections123 = isChairRole && Boolean(minuteSavedAt);
    const shouldShowMinutesSections123 = isSecretaryRole || canChairSeeMinutesSections123;
    const canSaveMinutes = canEditMinutesSections123 || canEditMinutesSection4;

    const canEditReviewerByActions = hasAllowedAction(
        selectedMinuteActions,
        "UPSERT_REVIEW",
        "UPSERT_MINUTES",
        "UPDATE_REVIEW",
    );

    const canEditReviewerComments = canEditReviewerByActions && isReviewerRole;
    const canViewMinutesTab = isChairRole || isSecretaryRole;
    const canViewReviewTab = isChairRole || isReviewerRole;

    const canApproveRevisionByActions = hasAllowedAction(
        selectedRevisionActions,
        "APPROVE",
        "APPROVE_REVISION",
        "UC4.2.APPROVE",
    );
    const canRejectRevisionByActions = hasAllowedAction(
        selectedRevisionActions,
        "REJECT",
        "REJECT_REVISION",
        "UC4.2.REJECT",
    );
    const canApproveRevision = canApproveRevisionByActions;
    const canRejectRevision = canRejectRevisionByActions;
    const isSessionOpened = selectedCommittee?.status === "Đang họp";
    const isSessionLocked = selectedCommittee?.status === "Đã chốt";
    const isSessionClosed = selectedCommittee?.status === "Đã đóng";
    
    // Committee status is the source of truth
    const isCurrentSessionLocked = isSessionLocked || isSessionClosed;
    const canScoreNow = canSubmitScore && isSessionOpened;

    const myRoleLabel = isChairRole
        ? "Chủ tịch"
        : isSecretaryRole
            ? "Ủy viên thư ký"
            : isReviewerRole
                ? "Ủy viên phản biện"
                : "Thành viên";

    const permissionSourceMissing =
        !hasScoringPermissionSource && !hasMinutePermissionSource && !hasRevisionPermissionSource;

    const isScoreValid = useMemo(() => {
        const trimmed = String(myScore ?? "").trim();
        if (!trimmed) {
            return false;
        }

        const num = Number(trimmed);
        return Number.isFinite(num) && num >= 0 && num <= 10;
    }, [myScore]);

    const hasVarianceAlert = useMemo(() => {
        if (scoringOverview.variance == null || scoringOverview.varianceThreshold == null) {
            return false;
        }
        return scoringOverview.variance > scoringOverview.varianceThreshold;
    }, [scoringOverview]);

    useEffect(() => {
        const hydrateScoringOverview = async () => {
            if (!selectedCommitteeId) {
                setScoringOverview({ variance: null, varianceThreshold: null, finalScore: null, finalLetter: null });
                setScoringMatrix([]);
                setScoringAlerts([]);
                setSelectedAssignmentId(0);
                return;
            }
            try {
                await refreshScoringData(selectedCommitteeNumericId);
            } catch {
                setScoringOverview({ variance: null, varianceThreshold: null, finalScore: null, finalLetter: null });
            }
        };

        void hydrateScoringOverview();
    }, [selectedCommitteeId, selectedCommitteeNumericId]);

    useEffect(() => {
        const row = selectedMatrixRow;
        const relatedAlert = scoringAlerts.find((item) => item.assignmentId === (row?.assignmentId ?? 0)) ?? null;
        setScoringOverview({
            variance: row?.variance ?? relatedAlert?.value ?? null,
            varianceThreshold: relatedAlert?.threshold ?? null,
            finalScore: row?.finalScore ?? null,
            finalLetter: row?.finalGrade ?? null,
        });
        if (row) {
            // Only sync lock from row data when committee status is NOT 'Đang họp'
            // This prevents stale snapshot row.isLocked from overriding a just-opened session
            if (!isSessionOpened) {
                setSessionLocked(Boolean(row.isLocked));
            }
            
            // Sync myScore and myComment when row changes
            const roleCode = selectedCommittee?.roleCode;
            let currentScore = "";
            let currentComment = "";
            if (roleCode === "CT") {
                currentScore = row.scoreCt != null ? String(row.scoreCt) : "";
                currentComment = row.commentCt ?? "";
            } else if (roleCode === "UVTK") {
                currentScore = row.scoreTk != null ? String(row.scoreTk) : "";
                currentComment = row.commentTk ?? "";
            } else if (roleCode === "UVPB") {
                currentScore = row.scorePb != null ? String(row.scorePb) : "";
                currentComment = row.commentPb ?? "";
            }
            setMyScore(currentScore);
            setMyComment(currentComment);
            // If score already exists for this role, mark as submitted (but still allow editing)
            setSubmitted(currentScore !== "");
        } else {
            setMyScore("");
            setMyComment("");
            setSubmitted(false);
        }
    }, [selectedMatrixRow, scoringAlerts, selectedCommittee?.roleCode]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setRoomNow(new Date());
        }, 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (detailCommitteeId) {
            setDetailTab("overview");
        }
    }, [detailCommitteeId]);

    useEffect(() => {
        if (!joinedCommitteeId) {
            return;
        }
        const exists = committees.some((item) => item.id === joinedCommitteeId);
        if (!exists) {
            setJoinedCommitteeId("");
            if (activePanel === "grading") {
                setActivePanel("councils");
            }
        }
    }, [activePanel, committees, joinedCommitteeId]);

    useEffect(() => {
        if (!joinedCommitteeId) {
            return;
        }
        if (selectedCommitteeId !== joinedCommitteeId) {
            setSelectedCommitteeId(joinedCommitteeId);
        }
    }, [joinedCommitteeId, selectedCommitteeId]);


    useEffect(() => {
        if (activePanel !== "grading" || !selectedCommitteeId) {
            return;
        }
        if (workspaceTab !== "minutes" && workspaceTab !== "review") {
            return;
        }
        void hydrateMinutes(selectedCommitteeNumericId, selectedAssignmentId || undefined);
    }, [
        activePanel,
        selectedCommitteeId,
        selectedCommitteeNumericId,
        selectedAssignmentId,
        workspaceTab,
    ]);

    useEffect(() => {
        if (workspaceTab === "minutes" && !canViewMinutesTab) {
            setWorkspaceTab(canViewReviewTab ? "review" : "scoring");
            return;
        }

        if (workspaceTab === "review" && !canViewReviewTab) {
            setWorkspaceTab(canViewMinutesTab ? "minutes" : "scoring");
        }
    }, [canViewMinutesTab, canViewReviewTab, workspaceTab]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            window.localStorage.setItem(
                "lecturer_minutes_draft",
                JSON.stringify({
                    periodId: periodIdText,
                    selectedCommitteeId,
                    review,
                    questions,
                    answers,
                    questionAnswers,
                    strengths,
                    weaknesses,
                    recommendations,
                    chapterContents,
                    councilDiscussionConclusion,
                    chairConclusion,
                    reviewerSections,
                })
            );
            setLastAutoSave(new Date().toLocaleTimeString("vi-VN"));
        }, 30000);

        return () => window.clearInterval(timer);
    }, [
        selectedCommitteeId,
        review,
        questions,
        answers,
        questionAnswers,
        strengths,
        weaknesses,
        recommendations,
        chapterContents,
        councilDiscussionConclusion,
        chairConclusion,
        reviewerSections,
        periodIdText,
    ]);

    const formatSession = (session: SessionCode | null) => {
        if (session === "MORNING") {
            return "Buổi sáng";
        }
        if (session === "AFTERNOON") {
            return "Buổi chiều";
        }
        return "Chưa phân ca";
    };

    const formatRowTimeRange = (row: ScoringMatrixRow) => {
        if (row.startTime && row.endTime) {
            return `${row.startTime} - ${row.endTime}`;
        }
        if (row.startTime) {
            return `Từ ${row.startTime}`;
        }
        if (row.scheduledAt) {
            return formatDateTime(row.scheduledAt);
        }
        return "Chưa có khung giờ";
    };

    const openRoleWorkspace = (committee: Committee) => {
        if (committee.status !== "Đang họp") {
            notifyInfo("Phòng chấm chỉ mở khi hội đồng đang họp.");
            return;
        }
        setJoinedCommitteeId(committee.id);
        setSelectedCommitteeId(committee.id);
        setWorkspaceTab("scoring");
        setActivePanel("grading");
        navigate(`/lecturer/committees/grading?committeeId=${encodeURIComponent(committee.id)}`);
    };

    const syncCommitteeSessionStatus = (committeeId: string, nextStatus: Committee["status"]) => {
        setCommittees((prev) =>
            prev.map((committee) =>
                committee.id === committeeId ? { ...committee, status: nextStatus } : committee,
            ),
        );

        if (joinedCommitteeId === committeeId || selectedCommitteeId === committeeId) {
            setSessionLocked(nextStatus === "Đã chốt" || nextStatus === "Đã đóng");
        }
    };

    const handleChairOpenSession = async (committee: Committee) => {
        if (committee.normalizedRole !== "CT") {
            notifyInfo("Chỉ Chủ tịch hội đồng mới có thể mở phiên.");
            return;
        }
        if (committee.status === "Đang họp") {
            notifyInfo("Phiên của hội đồng này đang mở sẵn.");
            return;
        }
        if (committee.status === "Đã chốt" || committee.status === "Đã đóng") {
            notifyInfo("Phiên đã khóa, không thể mở lại từ danh sách này.");
            return;
        }

        try {
            const idempotencyKey = createIdempotencyKey(periodIdText || "NA", `chair-open-${committee.id}`);
            const response = await lecturerApi.openSessionByCommittee(committee.numericId, idempotencyKey);
            if (notifyApiFailure(response as ApiResponse<unknown>, "Mở phiên hội đồng thất bại.")) {
                return;
            }

            syncCommitteeSessionStatus(committee.id, "Đang họp");
            pushTrace("open-session", `[Chair] Mở phiên hội đồng ${committee.id}.`);

            if (selectedCommitteeId === committee.id) {
                await refreshScoringData(committee.numericId);
            }

            notifySuccess(`Đã mở phiên hội đồng ${committee.id}.`);
        } catch {
            notifyError("Mở phiên hội đồng thất bại.");
        }
    };

    const handleChairCloseSession = async (committee: Committee) => {
        if (committee.normalizedRole !== "CT") {
            notifyInfo("Chỉ Chủ tịch hội đồng mới có thể đóng phiên.");
            return;
        }
        if (committee.status !== "Đang họp") {
            notifyInfo("Chỉ phiên đang họp mới có thể đóng.");
            return;
        }

        try {
            const idempotencyKey = createIdempotencyKey(periodIdText || "NA", `chair-close-${committee.id}`);
            const response = await lecturerApi.lockSessionByCommittee(committee.numericId, idempotencyKey);
            if (notifyApiFailure(response as ApiResponse<unknown>, "Đóng phiên hội đồng thất bại.")) {
                return;
            }

            syncCommitteeSessionStatus(committee.id, "Đã chốt");
            pushTrace("lock-session", `[Chair] Đóng phiên hội đồng ${committee.id}.`);

            if (selectedCommitteeId === committee.id) {
                await refreshScoringData(committee.numericId);
            }

            notifySuccess(`Đã đóng phiên hội đồng ${committee.id}.`);
        } catch (error) {
            const missingMembers = extractMissingMemberCodes(error);
            if (missingMembers.length > 0) {
                notifyError(`Thiếu điểm từ thành viên: ${missingMembers.join(", ")}`);
                return;
            }
            notifyError("Đóng phiên hội đồng thất bại.");
        }
    };

    const pushTrace = (action: string, note?: string) => {
        const idempotencyKey = createIdempotencyKey(periodIdText || "NA", action);
        setLatestActionTrace({
            action,
            periodId: periodIdText || "NA",
            idempotencyKey,
            concurrencyToken: assignmentConcurrencyToken,
            note,
            at: new Date().toLocaleString("vi-VN"),
        });
        return idempotencyKey;
    };

    const handleSubmitScore = async () => {
        if (!canSubmitScore) {
            notifyError("Vai trò hiện tại không có quyền gửi điểm.");
            return;
        }
        if (isCurrentSessionLocked) {
            notifyError("Phiên chấm đã khóa. Vui lòng yêu cầu Chủ tịch mở lại.");
            return;
        }
        if (!isScoreValid) {
            notifyError("Điểm phải nằm trong khoảng từ 0 đến 10.");
            return;
        }
        try {
            const idempotencyKey = createIdempotencyKey(periodIdText || "NA", "lecturer-score-submit");
            const assignmentId = selectedAssignmentId;
            if (!assignmentId) {
                notifyError("Vui lòng chọn đề tài cần chấm điểm.");
                return;
            }
            const response = await lecturerApi.submitIndependentScore(selectedCommitteeNumericId, {
                assignmentId,
                score: Number(myScore),
                comment: myComment,
            }, idempotencyKey);
            if (notifyApiFailure(response as ApiResponse<unknown>, "Không gửi được điểm.")) {
                return;
            }
            setSubmitted(true);

            // Optimistic UI update: immediately reflect submitted score in the grid
            const submittedScoreValue = Number(myScore);
            const roleCode = selectedCommittee?.roleCode;
            setScoringMatrix((prev) =>
                prev.map((row) => {
                    if (row.assignmentId !== assignmentId) return row;
                    const updated = { ...row };
                    if (roleCode === "CT") updated.scoreCt = submittedScoreValue;
                    else if (roleCode === "UVTK") updated.scoreTk = submittedScoreValue;
                    else if (roleCode === "UVPB") updated.scorePb = submittedScoreValue;
                    return updated;
                }),
            );

            pushTrace("submit-score", `[UC3.2] Đã gửi điểm ${myRoleLabel}.`);
            setAssignmentConcurrencyToken(createConcurrencyToken("lecturer-assignment"));
            await refreshScoringData(selectedCommitteeNumericId);
            if (response?.idempotencyReplay ?? response?.IdempotencyReplay) {
                notifyInfo("Yêu cầu gửi điểm đã được xử lý trước đó (idempotency replay).");
            } else {
                notifySuccess(`Đã gửi điểm ${myRoleLabel} thành công.`);
            }
        } catch {
            notifyError("Không gửi được điểm. Vui lòng thử lại.");
        }
    };


    const formatDate = (value: string | null) => {
        if (!value) {
            return "-";
        }
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("vi-VN");
    };

    const formatDateTime = (value: string | null) => {
        if (!value) {
            return "-";
        }
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("vi-VN");
    };

    const formatScore = (value: number | null) =>
        value == null ? "-" : value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

    const detailTabs: Array<{
        key: CommitteeDetailTabKey;
        label: string;
        icon: React.ReactNode;
    }> = [
            { key: "overview", label: "Tổng quan", icon: <Info size={14} /> },
            { key: "members", label: "Thành viên", icon: <Users2 size={14} /> },
            { key: "topics", label: "Đề tài", icon: <ClipboardPen size={14} /> },
        ];

    const workspaceTabs: Array<{
        key: WorkspaceTabKey;
        label: string;
        icon: React.ReactNode;
    }> = [
            { key: "scoring", label: "Chấm điểm", icon: <Star size={14} /> },
            { key: "minutes", label: "Biên bản họp", icon: <ClipboardPen size={14} /> },
            { key: "review", label: "Nhận xét phản biện", icon: <MessageSquareText size={14} /> },
        ];

    if (!loadingData && councilListLocked !== null && !currentSnapshotError && !hasCommitteeAccess) {
        return (
            <div
                style={{
                    maxWidth: 1460,
                    margin: "0 auto",
                    padding: 24,
                    position: "relative",
                    fontFamily: '"Be Vietnam Pro", "Segoe UI", Tahoma, sans-serif',
                }}
                className="lecturer-revamp-root"
            >
                <div
                    style={{
                        border: "1px solid #fed7aa",
                        borderRadius: 16,
                        padding: 28,
                        background: "linear-gradient(145deg, #ffffff 0%, #fff7ed 100%)",
                        boxShadow: "0 14px 36px rgba(15, 23, 42, 0.09)",
                        color: "#9a3412",
                    }}
                >
                    <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                        Hội đồng giảng viên chưa khả dụng
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.7 }}>{accessDeniedMessage}</div>
                </div>
            </div>
        );
    }

    return (
        <div
            style={{
                maxWidth: 1360,
                margin: "0 auto",
                padding: 20,
                position: "relative",
                fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
            }}
            className="lecturer-revamp-root"
        >
            <style>
                {`
          .lecturer-revamp-root {
            --lec-accent: #f37021;
            --lec-accent-strong: #d85f1a;
            --lec-ink: #111111;
            --lec-muted: #475569;
            --lec-line: #cbd5e1;
            --lec-bg-soft: #f8fafc;
            color: var(--lec-ink);
            background: #ffffff;
          }
          .lecturer-revamp-root .content {
            position: relative;
            z-index: 1;
            display: grid;
            gap: 14px;
          }
          .lecturer-revamp-root h1,
          .lecturer-revamp-root h2,
          .lecturer-revamp-root h3 {
            line-height: 1.2;
            letter-spacing: -0.01em;
            margin: 0;
            color: #111111;
          }
          .lecturer-revamp-root .lec-heading {
            font-size: 30px;
            font-weight: 800;
            color: #111111;
          }
          .lecturer-revamp-root .lec-kicker {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #475569;
            font-weight: 700;
          }
          .lecturer-revamp-root .lec-value {
            font-size: 24px;
            font-weight: 800;
            color: #111111;
          }
          .lecturer-revamp-root .lec-tag-live {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: 1px solid #cbd5e1;
            border-radius: 999px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 600;
            background: #ffffff;
            color: #111111;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          }
          .lecturer-revamp-root .lec-pill {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            background: #ffffff;
            padding: 8px 14px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            font-weight: 600;
            color: #0f172a;
            cursor: pointer;
            transition: all .2s ease;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          }
          .lecturer-revamp-root .lec-pill:hover {
            border-color: #f37021;
            background: #fffaf5;
            color: #d85f1a;
          }
          .lecturer-revamp-root .lec-pill.active {
            border-color: #f37021;
            color: #f37021;
            background: #fff7ed;
          }
          .lecturer-revamp-root .lec-pill:disabled {
            cursor: not-allowed;
            background: #f8fafc;
            border-color: #e2e8f0;
            color: #94a3b8;
            box-shadow: none;
          }
          .lecturer-revamp-root .lec-primary,
          .lecturer-revamp-root .lec-accent {
            border-radius: 10px;
            min-height: 40px;
            padding: 0 14px;
            font-weight: 700;
            cursor: pointer;
            border: 1px solid #f37021;
            background: #f37021;
            color: #ffffff;
            font-size: 13px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all .2s ease;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
          }
          .lecturer-revamp-root .lec-soft,
          .lecturer-revamp-root .lec-ghost {
            border-radius: 10px;
            min-height: 40px;
            padding: 0 14px;
            font-weight: 700;
            cursor: pointer;
            border: 1px solid #cbd5e1;
            background: #ffffff;
            color: #0f172a;
            font-size: 13px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all .2s ease;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          }
          .lecturer-revamp-root .lec-primary:hover,
          .lecturer-revamp-root .lec-accent:hover {
            background: #d85f1a;
            border-color: #d85f1a;
          }
          .lecturer-revamp-root .lec-soft:hover,
          .lecturer-revamp-root .lec-ghost:hover {
            border-color: #f37021;
            background: #fffaf5;
            color: #d85f1a;
          }
          .lecturer-revamp-root .lec-primary:disabled,
          .lecturer-revamp-root .lec-accent:disabled,
          .lecturer-revamp-root .lec-soft:disabled,
          .lecturer-revamp-root .lec-ghost:disabled {
            cursor: not-allowed;
            background: #f8fafc;
            border-color: #e2e8f0;
            color: #94a3b8;
            box-shadow: none;
          }
          .lecturer-revamp-root .lec-input,
          .lecturer-revamp-root select,
          .lecturer-revamp-root textarea {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 10px 12px;
            font-size: 14px;
            width: 100%;
            background: #ffffff;
            color: #111111;
          }
          .lecturer-revamp-root textarea {
            min-height: 100px;
            resize: vertical;
          }
          .lecturer-revamp-root .lec-input:focus,
          .lecturer-revamp-root select:focus,
          .lecturer-revamp-root textarea:focus {
            outline: none;
            border-color: #f37021;
            box-shadow: 0 0 0 3px rgba(243, 112, 33, 0.12);
          }
          .lecturer-revamp-root .content > section {
            background: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 10px !important;
            padding: 18px !important;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08) !important;
          }
          .lecturer-revamp-root .lec-committee-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 12px;
          }
          .lecturer-revamp-root .lec-committee-card {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 16px;
            background: #ffffff;
            display: grid;
            gap: 10px;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
            transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
          }
          .lecturer-revamp-root .lec-committee-card:hover {
            transform: translateY(-1px);
            border-color: #f37021;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
          }
          .lecturer-revamp-root .lec-badge-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }
          .lecturer-revamp-root .lec-count-badge {
            display: inline-flex;
            gap: 6px;
            align-items: center;
            border: 1px solid #cbd5e1;
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 12px;
            font-weight: 600;
            color: #111111;
            background: #f8fafc;
          }
          .lecturer-revamp-root .lec-info-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #111111;
            line-height: 1.4;
          }
          .lecturer-revamp-root .lec-info-row svg {
            color: #f37021;
          }
          .lecturer-revamp-root .lec-workspace {
            display: grid;
            grid-template-columns: 340px minmax(0, 1fr);
            gap: 16px;
            align-items: start;
          }
          .lecturer-revamp-root .lec-left-pane,
          .lecturer-revamp-root .lec-right-pane {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            background: #ffffff;
            padding: 16px;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
          }
          .lecturer-revamp-root .lec-assign-list {
            display: grid;
            gap: 8px;
          }
          .lecturer-revamp-root .lec-assign-btn {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 12px;
            text-align: left;
            background: #ffffff;
            cursor: pointer;
            color: #111111;
            transition: border-color .2s ease, background .2s ease, box-shadow .2s ease;
          }
          .lecturer-revamp-root .lec-assign-btn:hover {
            border-color: #f37021;
            background: #fffaf5;
          }
          .lecturer-revamp-root .lec-assign-btn.active {
            border-color: #f37021;
            background: #fff7ed;
          }
          .lecturer-revamp-root .lec-room-header {
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            background: #ffffff;
            padding: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            flex-wrap: wrap;
          }
          .lecturer-revamp-root .lec-clock-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            border-radius: 999px;
            border: 1px solid #cbd5e1;
            background: #ffffff;
            color: #111111;
            font-size: 12px;
            font-weight: 700;
          }
          .lecturer-revamp-root .lec-room-switch {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            align-items: center;
          }
          .lecturer-revamp-root .lec-tab-bar {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 10px;
            margin-bottom: 10px;
          }
          .lecturer-revamp-root .lec-score-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
            gap: 10px;
          }
          .lecturer-revamp-root .lec-score-item {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 12px;
            background: #ffffff;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          }
          .lecturer-revamp-root button svg,
          .lecturer-revamp-root a svg {
            margin: 0 !important;
            vertical-align: middle !important;
            flex: 0 0 auto;
          }
          .lecturer-revamp-root .lec-committee-actions {
            display: grid;
            gap: 8px;
            grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          }
          .lecturer-revamp-root .lec-report-screen {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            background: #ffffff;
            padding: 16px;
            display: grid;
            gap: 10px;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          }
          .lecturer-revamp-root .lec-alert-card {
            border: 1px solid #fecaca;
            border-left: 4px solid #f37021;
            border-radius: 10px;
            padding: 18px;
            background: #fff1f2;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
            color: #9f1239;
          }
          @media (max-width: 1060px) {
            .lecturer-revamp-root .lec-workspace {
              grid-template-columns: 1fr;
            }
            .lecturer-revamp-root .lec-committee-actions {
              grid-template-columns: 1fr;
            }
          }
        `}
            </style>

            <div className="content">










                {isGradingScreen && activePanel === "grading" && !joinedCommittee && (
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            padding: "60px 20px",
                        }}
                    >
                        <div
                            style={{
                                width: 430,
                                background: "#ffffff",
                                border: "1px solid #f1f5f9",
                                borderRadius: 24,
                                padding: 42,
                                textAlign: "center",
                                boxShadow: "0 20px 50px rgba(0,0,0,0.06)",
                            }}
                        >
                            <img
                                src="/dnu_logo.png"
                                alt="Đại Nam University"
                                style={{
                                    width: 74,
                                    height: 74,
                                    objectFit: "contain",
                                    margin: "0 auto 22px",
                                    display: "block",
                                }}
                            />

                            <div
                                style={{
                                    fontSize: 24,
                                    fontWeight: 700,
                                    color: "#111827",
                                    marginBottom: 10,
                                    fontFamily: '"Inter", "Segoe UI", sans-serif',
                                    whiteSpace: "nowrap",
                                }}
                            >
                                Hệ thống quản lý bảo vệ đồ án
                            </div>

                            <div
                                style={{
                                    fontSize: 14,
                                    color: "#6b7280",
                                    lineHeight: 1.7,
                                    marginBottom: 30,
                                }}
                            >
                                Đang khởi tạo dữ liệu hội đồng, giảng viên và tiến trình chấm điểm
                            </div>

                            <div
                                style={{
                                    width: "100%",
                                    height: 8,
                                    background: "#f3f4f6",
                                    borderRadius: 999,
                                    overflow: "hidden",
                                    position: "relative",
                                }}
                            >
                                <div
                                    style={{
                                        width: `${gradingLoadingProgress}%`,
                                        height: "100%",
                                        borderRadius: 999,
                                        background: "linear-gradient(90deg, #ff8a00, #ff6b00)",
                                        transition: "width 0.15s ease-out",
                                    }}
                                />
                            </div>

                            <div
                                style={{
                                    marginTop: 18,
                                    fontSize: 14,
                                    fontWeight: 500,
                                    color: "#374151",
                                }}
                            >
                                {gradingLoadingProgress < 30
                                    ? "Đang kết nối hệ thống..."
                                    : gradingLoadingProgress < 60
                                        ? "Đang tải dữ liệu hội đồng..."
                                        : gradingLoadingProgress < 85
                                            ? "Đang chuẩn bị phòng chấm điểm..."
                                            : gradingLoadingProgress < 100
                                                ? "Sắp hoàn tất..."
                                                : "Hoàn tất!"}
                                {" "}
                                <span style={{ color: "#9ca3af" }}>{Math.round(gradingLoadingProgress)}%</span>
                            </div>

                            <div
                                style={{
                                    marginTop: 28,
                                    fontSize: 12,
                                    color: "#9ca3af",
                                    letterSpacing: 0.3,
                                }}
                            >
                                Dai Nam University • Graduation Defense Management System
                            </div>
                        </div>
                    </div>
                )}

                {isGradingScreen && activePanel === "grading" && joinedCommittee && (
                    <section style={cardStyle}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <LayoutDashboard size={18} /> Phòng chấm điểm hội đồng
                            </h2>
                            <div className="lec-room-switch">
                                <span className="lec-tag-live">{joinedCommittee.id} · {joinedCommittee.name}</span>
                                <span
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "6px 10px",
                                        borderRadius: 999,
                                        border: `1px solid ${getCommitteeStatusVisual(joinedCommittee.status).chipBorder}`,
                                        background: getCommitteeStatusVisual(joinedCommittee.status).chipBg,
                                        color: getCommitteeStatusVisual(joinedCommittee.status).chipText,
                                        fontSize: 12,
                                        fontWeight: 500,
                                    }}
                                >
                                    {getCommitteeStatusVisual(joinedCommittee.status).label}
                                </span>
                                <span className="lec-clock-chip">
                                    <Clock3 size={13} /> {roomNow.toLocaleTimeString("vi-VN", { hour12: false })}
                                </span>
                                <button
                                    type="button"
                                    className="lec-ghost"
                                    onClick={() => {
                                        const shouldLeave = window.confirm(
                                            "Bạn có chắc chắn muốn rời phòng chấm điểm hội đồng?",
                                        );
                                        if (!shouldLeave) {
                                            return;
                                        }

                                        setJoinedCommitteeId("");
                                        setSelectedCommitteeId("");
                                        setWorkspaceTab("scoring");
                                        setActivePanel("councils");
                                        notifyInfo("Đã rời phòng chấm điểm hội đồng.");
                                        navigate("/lecturer/committees");
                                    }}
                                >
                                    <ArrowRight size={14} /> Rời phòng
                                </button>
                                {/* Chair actions moved to header: Open / Lock / Unlock / Close session buttons */}
                                {isChairRole && (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        {selectedCommittee?.status === "Sắp diễn ra" && (
                                            <button
                                                type="button"
                                                className="lec-primary"
                                                disabled={!canOpenSession}
                                                onClick={async () => {
                                                    try {
                                                        const idempotencyKey = createIdempotencyKey(periodIdText || "NA", "lecturer-session-open");
                                                        const response = await lecturerApi.openSessionByCommittee(selectedCommitteeNumericId, idempotencyKey);
                                                        if (notifyApiFailure(response as ApiResponse<unknown>, "Mở phiên chấm thất bại.")) {
                                                            return;
                                                        }
                                                        setCommittees((prev) =>
                                                            prev.map((item) =>
                                                                item.id === selectedCommitteeId ? { ...item, status: "Đang họp" } : item,
                                                            ),
                                                        );
                                                        setSessionLocked(false);
                                                        pushTrace("open-session", "[UC3.1] Đã mở phiên chấm.");
                                                        await refreshScoringData(selectedCommitteeNumericId);
                                                        await refreshAllScoringRows();
                                                        notifySuccess("Đã mở phiên hội đồng.");
                                                    } catch {
                                                        notifyError("Mở phiên chấm thất bại.");
                                                    }
                                                }}
                                            >
                                                <CalendarClock size={14} /> Mở phiên
                                            </button>
                                        )}

                                        {selectedCommittee?.status === "Đang họp" && (
                                            <button
                                                type="button"
                                                className="lec-primary"
                                                disabled={!canLockSession || !allTopicsGraded}
                                                onClick={async () => {
                                                    if (!window.confirm("Bạn có chắc chắn muốn chốt điểm cho hội đồng này? Sau khi chốt, các thành viên chỉ có thể chỉnh sửa lại khi Chủ tịch mở chốt.")) {
                                                        return;
                                                    }
                                                    try {
                                                        const idempotencyKey = createIdempotencyKey(periodIdText || "NA", "lecturer-session-lock");
                                                        const response = await lecturerApi.lockSessionByCommittee(selectedCommitteeNumericId, idempotencyKey);
                                                        if (notifyApiFailure(response as ApiResponse<unknown>, "Chốt điểm thất bại.")) {
                                                            return;
                                                        }
                                                        setSessionLocked(true);
                                                        setCommittees((prev) =>
                                                            prev.map((item) =>
                                                                item.id === selectedCommitteeId ? { ...item, status: "Đã chốt" } : item,
                                                            ),
                                                        );
                                                        pushTrace("lock-session", "[UC3.5] Đã chốt điểm hội đồng.");
                                                        await refreshScoringData(selectedCommitteeNumericId);
                                                        await refreshAllScoringRows();
                                                        notifySuccess("Đã chốt điểm hội đồng thành công.");
                                                    } catch (error) {
                                                        const missingMembers = extractMissingMemberCodes(error);
                                                        if (missingMembers.length > 0) {
                                                            notifyError(`Thiếu điểm từ thành viên: ${missingMembers.join(", ")}`);
                                                            return;
                                                        }
                                                        notifyError("Chốt điểm thất bại.");
                                                    }
                                                }}
                                            >
                                                <Lock size={14} /> Chốt điểm
                                            </button>
                                        )}

                                        {selectedCommittee?.status === "Đã chốt" && (
                                            <>
                                                <button
                                                    type="button"
                                                    style={{ padding: "0 14px", minHeight: 40, borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: 700, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                                                    onClick={async () => {
                                                        if (!window.confirm("Bạn có chắc chắn muốn mở chốt điểm? Các thành viên sẽ có thể chỉnh sửa điểm.")) {
                                                            return;
                                                        }
                                                        try {
                                                            const idempotencyKey = createIdempotencyKey(periodIdText || "NA", "lecturer-session-unlock");
                                                            const response = await lecturerApi.openSessionByCommittee(selectedCommitteeNumericId, idempotencyKey);
                                                            if (notifyApiFailure(response as ApiResponse<unknown>, "Mở chốt điểm thất bại.")) {
                                                                return;
                                                            }
                                                            setSessionLocked(false);
                                                            setSubmitted(false);
                                                            setCommittees((prev) =>
                                                                prev.map((item) =>
                                                                    item.id === selectedCommitteeId ? { ...item, status: "Đang họp" } : item,
                                                                ),
                                                            );
                                                            pushTrace("unlock-session", "[UC3.5] Chủ tịch đã mở chốt điểm.");
                                                            await refreshScoringData(selectedCommitteeNumericId);
                                                            await refreshAllScoringRows();
                                                            notifySuccess("Đã mở chốt điểm. Các thành viên có thể chỉnh sửa điểm.");
                                                        } catch {
                                                            notifyError("Mở chốt điểm thất bại.");
                                                        }
                                                    }}
                                                >
                                                    <Unlock size={14} /> Mở chốt điểm
                                                </button>

                                                <button
                                                    type="button"
                                                    className="lec-primary"
                                                    style={{ background: "#1e293b", borderColor: "#1e293b" }}
                                                    onClick={async () => {
                                                        if (!window.confirm("Bạn có chắc chắn muốn đóng phiên bảo vệ? Sau khi đóng, hội đồng sẽ kết thúc hoàn toàn.")) {
                                                            return;
                                                        }
                                                        try {
                                                            const idempotencyKey = createIdempotencyKey(periodIdText || "NA", "lecturer-session-close");
                                                            const response = await lecturerApi.closeSessionByCommittee(selectedCommitteeNumericId, idempotencyKey);
                                                            if (notifyApiFailure(response as ApiResponse<unknown>, "Đóng phiên thất bại.")) {
                                                                return;
                                                            }
                                                            setCommittees((prev) =>
                                                                prev.map((item) =>
                                                                    item.id === selectedCommitteeId ? { ...item, status: "Đã đóng" } : item,
                                                                ),
                                                            );
                                                            setSessionLocked(true);
                                                            pushTrace("close-session", "[UC3.5] Đã đóng phiên hội đồng.");
                                                            await refreshScoringData(selectedCommitteeNumericId);
                                                            await refreshAllScoringRows();
                                                            notifySuccess("Đã đóng phiên bảo vệ thành công.");
                                                        } catch {
                                                            notifyError("Đóng phiên thất bại.");
                                                        }
                                                    }}
                                                >
                                                    <CheckCircle2 size={14} /> Đóng phiên
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {!selectedCommittee ? (
                            <div style={{ fontSize: 13, color: "#475569" }}>Không tìm thấy dữ liệu hội đồng đã tham gia trong snapshot hiện tại.</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                
                            <div className="lec-workspace">
                                <aside className="lec-left-pane">
                                    <div style={{ fontWeight: 800, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span>Danh sách đề tài theo ca</span>
                                        <button
                                            type="button"
                                            className="lec-soft"
                                            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: 12, borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff" }}
                                            onClick={() => setPreviewModalType("scoreSheet")}
                                        >
                                            <Eye size={14} /> Xem bảng điểm
                                        </button>
                                    </div>
                                    <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>
                                        {selectedCommittee.id} · {selectedCommittee.name}
                                    </div>

                                    <div className="lec-assign-list">
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Ca sáng</div>
                                        {morningRows.map((row) => {
                                            const isScored = row.finalScore != null && Number(row.finalScore) > 0;
                                            return (
                                            <button
                                                key={`morning-${row.assignmentId}`}
                                                type="button"
                                                className={`lec-assign-btn ${selectedAssignmentId === row.assignmentId ? "active" : ""}`}
                                                onClick={() => setSelectedAssignmentId(row.assignmentId)}
                                                style={{
                                                    background: isScored ? "#ecfdf5" : undefined,
                                                    border: isScored ? "1px solid #22c55e" : undefined,
                                                }}
                                            >
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 700 }}>{row.topicTitle}</div>
                                                        <div style={{ fontSize: 12, color: "#475569" }}>{row.studentCode} · {row.studentName}</div>
                                                        <div style={{ fontSize: 12, color: "#64748b" }}>
                                                            Lớp: <strong>{row.className ?? "-"}</strong> · Khóa: <strong>{row.cohortCode ?? "-"}</strong>
                                                        </div>
                                                    </div>
                                                    {isScored && (
                                                        <div style={{
                                                            padding: "4px 8px",
                                                            borderRadius: 6,
                                                            background: "#22c55e",
                                                            color: "#ffffff",
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            whiteSpace: "nowrap",
                                                        }}>
                                                            {formatScore(row.finalScore)}{row.finalGrade ? ` - ${row.finalGrade}` : ""}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 12, color: "#475569" }}>
                                                    Giảng viên Hướng dẫn: <strong>{row.supervisorLecturerName ?? "Chưa cập nhật"}</strong>
                                                </div>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                                    {row.topicTags.length > 0 ? (
                                                        row.topicTags.slice(0, 3).map((tag) => (
                                                            <span
                                                                key={`m-tag-${row.assignmentId}-${tag}`}
                                                                style={{
                                                                    border: "1px solid #22c55e",
                                                                    borderRadius: 999,
                                                                    padding: "1px 7px",
                                                                    fontSize: 11,
                                                                    color: "#166534",
                                                                    background: "#f0fdf4",
                                                                }}
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span style={{ fontSize: 11, color: "#94a3b8" }}>Chưa có tags</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 12, color: "#64748b" }}>
                                                    {row.committeeCode} · {row.committeeName} · {formatSession(row.session)} · {formatRowTimeRange(row)}
                                                </div>
                                            </button>
                                            );
                                        })}
                                        {morningRows.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8" }}>Chưa có đề tài ca sáng.</div>}

                                        <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginTop: 6 }}>Ca chiều</div>
                                        {afternoonRows.map((row) => {
                                            const isScored = row.finalScore != null && Number(row.finalScore) > 0;
                                            return (
                                            <button
                                                key={`afternoon-${row.assignmentId}`}
                                                type="button"
                                                className={`lec-assign-btn ${selectedAssignmentId === row.assignmentId ? "active" : ""}`}
                                                onClick={() => setSelectedAssignmentId(row.assignmentId)}
                                                style={{
                                                    background: isScored ? "#ecfdf5" : undefined,
                                                    border: isScored ? "1px solid #22c55e" : undefined,
                                                }}
                                            >
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 700 }}>{row.topicTitle}</div>
                                                        <div style={{ fontSize: 12, color: "#475569" }}>{row.studentCode} · {row.studentName}</div>
                                                        <div style={{ fontSize: 12, color: "#64748b" }}>
                                                            Lớp: <strong>{row.className ?? "-"}</strong> · Khóa: <strong>{row.cohortCode ?? "-"}</strong>
                                                        </div>
                                                    </div>
                                                    {isScored && (
                                                        <div style={{
                                                            padding: "4px 8px",
                                                            borderRadius: 6,
                                                            background: "#22c55e",
                                                            color: "#ffffff",
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            whiteSpace: "nowrap",
                                                        }}>
                                                            {formatScore(row.finalScore)}{row.finalGrade ? ` - ${row.finalGrade}` : ""}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 12, color: "#475569" }}>
                                                    Giảng viên Hướng dẫn: <strong>{row.supervisorLecturerName ?? "Chưa cập nhật"}</strong>
                                                </div>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                                    {row.topicTags.length > 0 ? (
                                                        row.topicTags.slice(0, 3).map((tag) => (
                                                            <span
                                                                key={`a-tag-${row.assignmentId}-${tag}`}
                                                                style={{
                                                                    border: "1px solid #22c55e",
                                                                    borderRadius: 999,
                                                                    padding: "1px 7px",
                                                                    fontSize: 11,
                                                                    color: "#166534",
                                                                    background: "#f0fdf4",
                                                                }}
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span style={{ fontSize: 11, color: "#94a3b8" }}>Chưa có tags</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 12, color: "#64748b" }}>
                                                    {row.committeeCode} · {row.committeeName} · {formatSession(row.session)} · {formatRowTimeRange(row)}
                                                </div>
                                            </button>
                                            );
                                        })}
                                        {afternoonRows.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8" }}>Chưa có đề tài ca chiều.</div>}

                                    </div>
                                </aside>

                                <div className="lec-right-pane">
                                    <div className="lec-room-header" style={{ marginBottom: 10 }}>
                                        <div style={{ display: "grid", gap: 4 }}>
                                            <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                                                <PencilRuler size={16} color="#f37021" /> Màn hình chấm điểm hội đồng
                                            </div>
                                            <div style={{ fontSize: 12, color: "#111111" }}>
                                                Mỗi thao tác chấm điểm, biên bản và phản biện được ghi nhận theo đề tài đang chọn.
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 10, background: "#fff7ed" }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, fontSize: 13 }}>
                                            <div>
                                                <span className="lec-kicker">Sinh viên</span>
                                                <div style={{ fontWeight: 700 }}>{selectedMatrixRow ? `${selectedMatrixRow.studentCode} - ${selectedMatrixRow.studentName}` : "-"}</div>
                                            </div>
                                            <div>
                                                <span className="lec-kicker">Đề tài</span>
                                                <div style={{ fontWeight: 700 }}>{selectedMatrixRow?.topicTitle ?? "-"}</div>
                                            </div>
                                            <div>
                                                <span className="lec-kicker">Giảng viên Hướng dẫn</span>
                                                <div style={{ fontWeight: 700 }}>{selectedMatrixRow?.supervisorLecturerName ?? "Chưa cập nhật"}</div>
                                            </div>
                                            <div>
                                                <span className="lec-kicker">Tags đề tài</span>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                                    {(selectedMatrixRow?.topicTags ?? []).length > 0 ? (
                                                        (selectedMatrixRow?.topicTags ?? []).slice(0, 4).map((tag) => (
                                                            <span
                                                                key={`selected-tag-${selectedMatrixRow?.assignmentId ?? 0}-${tag}`}
                                                                style={{
                                                                    border: "1px solid #fdba74",
                                                                    borderRadius: 999,
                                                                    padding: "1px 7px",
                                                                    fontSize: 11,
                                                                    color: "#9a3412",
                                                                    background: "#fff7ed",
                                                                }}
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span style={{ fontSize: 12, color: "#94a3b8" }}>Chưa có tags</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="lec-kicker">Hội đồng</span>
                                                <div style={{ fontWeight: 700 }}>
                                                    {selectedMatrixRow ? `${selectedMatrixRow.committeeCode} - ${selectedMatrixRow.committeeName}` : "-"}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="lec-kicker">Trạng thái khóa điểm</span>
                                                <div style={{ fontWeight: 700 }}>{selectedMatrixRow?.isLocked ? "Đã chốt" : "Đang mở"}</div>
                                            </div>
                                            <div>
                                                <span className="lec-kicker">Điểm Giảng viên Hướng dẫn</span>
                                                <div style={{ fontWeight: 700 }}>{formatScore(scoreGvhdDisplay)}</div>
                                            </div>
                                            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                                                <div style={{ textAlign: "right" }}>
                                                    <span className="lec-kicker">Báo cáo đồ án</span>
                                                    <div style={{ marginTop: 2 }}>
                                                        {selectedMatrixRow?.defenseDocuments && selectedMatrixRow.defenseDocuments.length > 0 ? (
                                                            <a
                                                                href={selectedMatrixRow.defenseDocuments[0].fileUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="lec-primary"
                                                                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none", padding: "3px 10px", fontSize: 11, borderRadius: 6, background: "#f37021", color: "#fff", border: "none" }}
                                                            >
                                                                <ExternalLink size={13} /> Xem báo cáo
                                                            </a>
                                                        ) : (
                                                            <span style={{ fontSize: 13, color: "#94a3b8" }}>Chưa nộp báo cáo</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4, borderTop: "1px solid #fed7aa", paddingTop: 10 }}>
                                                <button
                                                    type="button"
                                                    className="lec-soft"
                                                    style={{ background: "#ffffff", border: "1px solid #fdba74" }}
                                                    onClick={() => setPreviewModalType("meeting")}
                                                >
                                                    <Eye size={14} /> Xem biên bản
                                                </button>
                                                <button
                                                    type="button"
                                                    className="lec-soft"
                                                    style={{ background: "#ffffff", border: "1px solid #fdba74" }}
                                                    onClick={() => setPreviewModalType("reviewer")}
                                                >
                                                    <Eye size={14} /> Xem nhận xét
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 10, background: "#ffffff", display: "grid", gap: 10, marginTop: 10 }}>
                                        <div style={{ fontWeight: 700 }}>Thành viên tham gia hội đồng</div>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8 }}>
                                            {selectedCommittee.members.length === 0 && (
                                                <div style={{ fontSize: 13, color: "#64748b" }}>Snapshot chưa có danh sách thành viên cho hội đồng này.</div>
                                            )}
                                            {selectedCommittee.members.map((member) => {
                                                return (
                                                    <div
                                                        key={member.memberId}
                                                        style={{
                                                            border: "1px solid #cbd5e1",
                                                            borderRadius: 10,
                                                            padding: 10,
                                                            display: "grid",
                                                            gap: 6,
                                                        }}
                                                    >
                                                        <div style={{ fontWeight: 700 }}>{member.roleLabel}</div>
                                                        <div style={{ fontSize: 13, color: "#334155" }}>
                                                            {member.lecturerCode ? `${member.lecturerCode} - ` : ""}
                                                            {member.degree ? `${member.degree} ` : ""}
                                                            {member.lecturerName}
                                                        </div>
                                                        <div style={{ fontSize: 12, color: "#475569" }}>
                                                            {member.organization || "Chưa cập nhật nơi công tác"}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="lec-tab-bar">
                                        {workspaceTabs
                                            .filter((tab) => {
                                                if (tab.key === "minutes") {
                                                    return canViewMinutesTab;
                                                }
                                                if (tab.key === "review") {
                                                    return canViewReviewTab;
                                                }
                                                return true;
                                            })
                                            .map((tab) => (
                                                <button
                                                    key={tab.key}
                                                    type="button"
                                                    className={`lec-pill ${workspaceTab === tab.key ? "active" : ""}`}
                                                    onClick={() => setWorkspaceTab(tab.key)}
                                                >
                                                    {tab.icon} {tab.label}
                                                </button>
                                            ))}
                                    </div>

                                    {workspaceTab === "scoring" && (
                                        <div style={{ display: "grid", gap: 12 }}>
                                            <div className="lec-score-grid">
                                                <div className="lec-score-item">
                                                    <div className="lec-kicker">Giảng viên Hướng dẫn</div>
                                                    <div className="lec-value" style={{ fontSize: 22 }}>{formatScore(selectedMatrixRow?.scoreGvhd ?? scoreGvhdDisplay)}</div>
                                                </div>
                                                <div className="lec-score-item">
                                                    <div className="lec-kicker">Chủ tịch</div>
                                                    <div className="lec-value" style={{ fontSize: 22 }}>{formatScore(selectedMatrixRow?.scoreCt ?? null)}</div>
                                                </div>
                                                <div className="lec-score-item">
                                                    <div className="lec-kicker">Ủy viên thư ký</div>
                                                    <div className="lec-value" style={{ fontSize: 22 }}>{formatScore(selectedMatrixRow?.scoreTk ?? null)}</div>
                                                </div>
                                                <div className="lec-score-item">
                                                    <div className="lec-kicker">Ủy viên phản biện</div>
                                                    <div className="lec-value" style={{ fontSize: 22 }}>{formatScore(selectedMatrixRow?.scorePb ?? null)}</div>
                                                </div>
                                                <div className="lec-score-item">
                                                    <div className="lec-kicker">Điểm tổng hợp</div>
                                                    <div className="lec-value" style={{ fontSize: 22 }}>{formatScore(scoringOverview.finalScore)}</div>
                                                </div>
                                            </div>

                                            <div style={{
                                                border: "1px solid #e2e8f0",
                                                borderRadius: 12,
                                                padding: 14,
                                                background: canScoreNow ? "#f0fdf4" : "#f8fafc",
                                                display: "grid",
                                                gap: 10,
                                            }}>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: canScoreNow ? "#166534" : "#64748b" }}>
                                                    Chấm điểm — Vai trò: {myRoleLabel}
                                                    {isCurrentSessionLocked && (
                                                        <span style={{ color: "#b91c1c", fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                                                            (Phiên đã khóa — không thể chỉnh sửa)
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                                                    <label style={{ display: "grid", gap: 6 }}>
                                                        <span className="lec-kicker">Điểm {myRoleLabel} (0-10)</span>
                                                        <input
                                                            className="lec-input"
                                                            type="number"
                                                            step={0.1}
                                                            min={0}
                                                            max={10}
                                                            value={myScore}
                                                            onChange={(event) => setMyScore(event.target.value)}
                                                            disabled={!canScoreNow}
                                                        />
                                                    </label>
                                                </div>

                                                <label style={{ display: "grid", gap: 6 }}>
                                                    <span className="lec-kicker">Nhận xét {myRoleLabel}</span>
                                                    <textarea
                                                        value={myComment}
                                                        onChange={(event) => setMyComment(event.target.value)}
                                                        disabled={!canScoreNow}
                                                        rows={3}
                                                        placeholder={`Nhập nhận xét của ${myRoleLabel}...`}
                                                    />
                                                </label>
                                            </div>

                                            {!isScoreValid && <div style={{ color: "#b91c1c", fontSize: 13 }}>Điểm phải trong khoảng từ 0 đến 10.</div>}
                                            {hasVarianceAlert && (
                                                <div style={{ border: "1px solid #fecaca", borderRadius: 10, padding: 10, background: "#fff7ed", color: "#9a3412", fontSize: 13 }}>
                                                    Chênh lệch điểm vượt ngưỡng ({formatScore(scoringOverview.variance)} / {formatScore(scoringOverview.varianceThreshold)}).
                                                </div>
                                            )}

                                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                <button
                                                    type="button"
                                                    className="lec-primary"
                                                    onClick={async () => {
                                                        await handleSubmitScore();
                                                        await refreshAllScoringRows();
                                                    }}
                                                    disabled={!canScoreNow || !isScoreValid}
                                                >
                                                    <Save size={14} /> {submitted ? `Cập nhật điểm ${myRoleLabel}` : `Gửi điểm ${myRoleLabel}`}
                                                </button>
                                            </div>

                                            {submitted && <div style={{ fontSize: 13, color: "#166534" }}>Đã lưu điểm thành công. Bạn vẫn có thể chỉnh sửa lại điểm nếu cần.</div>}
                                        </div>
                                    )}

                                    {workspaceTab === "minutes" && (
                                        <div style={{ display: "grid", gap: 10 }}>
                                            {!canViewMinutesTab ? (
                                                <div style={{ fontSize: 13, color: "#64748b" }}>
                                                    Vai trò hiện tại không có màn hình nhập biên bản hội đồng này.
                                                </div>
                                            ) : (
                                                <>
                                                    <div style={{ fontWeight: 800, fontSize: 18, color: "#111111" }}>NỘI DUNG HỌP HỘI ĐỒNG CHẤM ĐỒ ÁN</div>
                                                    {isChairRole && !canChairSeeMinutesSections123 && (
                                                        <div style={{ fontSize: 13, color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 10, padding: 10, background: "#fff7ed" }}>
                                                            Nội dung I, II, III sẽ hiển thị cho Chủ tịch sau khi Thư ký bấm lưu biên bản.
                                                        </div>
                                                    )}

                                                    {shouldShowMinutesSections123 && (
                                                        <>

                                                            <div style={{ display: "grid", gap: 8, border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                                                                <div style={{ fontWeight: 800, color: "#111111" }}>I. Tóm tắt nội dung đồ án</div>
                                                                
                                                                <div style={{ fontWeight: 600, color: "#334155", fontSize: 13, marginTop: 4 }}>Chi tiết chương</div>
                                                                {chapterContents.length === 0 && (
                                                                    <div style={{ fontSize: 13, color: "#64748b" }}>Chưa có mục chương. Bấm "Thêm chương" để nhập Chương I, II, III, IV...n.</div>
                                                                )}
                                                                {chapterContents.map((chapter, index) => (
                                                                    <div key={`chapter-${index}`} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 8, display: "grid", gap: 6 }}>
                                                                        <div style={{ fontWeight: 700, color: "#111111" }}>{`${String.fromCharCode(97 + index)}. Chương ${toRomanNumeral(index + 1)}`}</div>
                                                                        <textarea
                                                                            value={chapter.content}
                                                                            onChange={(event) =>
                                                                                setChapterContents((prev) =>
                                                                                    prev.map((item, idx) => (idx === index ? { ...item, content: event.target.value } : item)),
                                                                                )
                                                                            }
                                                                            readOnly={!canEditMinutesSections123}
                                                                            rows={5}
                                                                        />
                                                                        {canEditMinutesSections123 && (
                                                                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                                                <button
                                                                                    type="button"
                                                                                    className="lec-soft"
                                                                                    style={{ width: "fit-content" }}
                                                                                    onClick={() => clearChapterContent(index)}
                                                                                    title="Xóa trắng nội dung chương"
                                                                                >
                                                                                    <Eraser size={14} /> Clear
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    className="lec-soft"
                                                                                    style={{ width: "fit-content" }}
                                                                                    onClick={() => deleteChapterWithConfirm(index)}
                                                                                    title="Xóa chương"
                                                                                >
                                                                                    <Trash2 size={14} /> Xóa chương
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {canEditMinutesSections123 && (
                                                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                                        <button
                                                                            type="button"
                                                                            className="lec-soft"
                                                                            style={{ width: "fit-content" }}
                                                                            onClick={() =>
                                                                                setChapterContents((prev) => [...prev, { chapterTitle: `Chương ${toRomanNumeral(prev.length + 1)}`, content: "" }])
                                                                            }
                                                                        >
                                                                            <Plus size={14} /> Thêm chương
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className="lec-soft"
                                                                            style={{ width: "fit-content" }}
                                                                            onClick={restoreDeletedChapter}
                                                                            disabled={!deletedChapterDraft}
                                                                            title={deletedChapterDraft ? "Phục hồi chương vừa xóa" : "Chưa có chương nào bị xóa"}
                                                                        >
                                                                            <Undo2 size={14} /> Phục hồi chương
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div style={{ display: "grid", gap: 8, border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                                                                <div style={{ fontWeight: 800, color: "#111111" }}>II. Ý kiến của các thành viên Hội đồng đánh giá tốt nghiệp</div>
                                                                <span className="lec-kicker">1. Ủy viên phản biện: Đọc nhận xét (có bản nhận xét kèm theo)</span>
                                                                <div style={{ display: "grid", gap: 8, paddingLeft: 12 }}>
                                                                    {getQuestionItemsBySource(QUESTION_SOURCE_REVIEWER).length === 0 && (
                                                                        <div style={{ fontSize: 13, color: "#64748b" }}>Chưa có câu hỏi.</div>
                                                                    )}
                                                                    {getQuestionItemsBySource(QUESTION_SOURCE_REVIEWER).map(({ pair, index }) => (
                                                                        <div key={`q-reviewer-${index}`} style={{ display: "grid", gap: 8, border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                                                                            <div style={{ fontWeight: 700, color: "#111111" }}>{`Câu hỏi ${index + 1}`}</div>
                                                                            <textarea
                                                                                value={stripQuestionSource(pair.question)}
                                                                                onChange={(event) =>
                                                                                    setQuestionAnswers((prev) =>
                                                                                        prev.map((item, itemIndex) =>
                                                                                            itemIndex === index
                                                                                                ? { ...item, question: composeQuestionWithSource(QUESTION_SOURCE_REVIEWER, event.target.value) }
                                                                                                : item,
                                                                                        ),
                                                                                    )
                                                                                }
                                                                                readOnly={!canEditMinutesSections123}
                                                                                rows={3}
                                                                                style={{ minHeight: 120 }}
                                                                            />
                                                                            {canEditMinutesSections123 && (
                                                                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                                                    <button
                                                                                        type="button"
                                                                                        className="lec-soft"
                                                                                        style={{ width: "fit-content" }}
                                                                                        onClick={() =>
                                                                                            setQuestionAnswers((prev) =>
                                                                                                prev.map((item, itemIndex) =>
                                                                                                    itemIndex === index ? { ...item, question: `[${QUESTION_SOURCE_REVIEWER}] ` } : item,
                                                                                                ),
                                                                                            )
                                                                                        }
                                                                                        title="Xóa trắng nội dung câu hỏi"
                                                                                    >
                                                                                        <Eraser size={14} /> Clear câu hỏi
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        className="lec-soft"
                                                                                        style={{ width: "fit-content" }}
                                                                                        onClick={() => deleteQuestionAnswerWithConfirm(index)}
                                                                                        title="Xóa câu hỏi"
                                                                                    >
                                                                                        <Trash2 size={14} /> Xóa câu hỏi
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                    {canEditMinutesSections123 && (
                                                                        <button
                                                                            type="button"
                                                                            className="lec-soft"
                                                                            style={{ width: "fit-content" }}
                                                                            onClick={() => addQuestionWithSource(QUESTION_SOURCE_REVIEWER)}
                                                                        >
                                                                            <Plus size={14} /> Thêm câu hỏi
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <div style={{ display: "grid", gap: 8 }}>
                                                                    <span className="lec-kicker">2. Các thành viên Hội đồng nhận xét và thêm câu hỏi</span>
                                                                    <div style={{ display: "grid", gap: 8, paddingLeft: 12 }}>
                                                                        {getQuestionItemsBySource(QUESTION_SOURCE_COUNCIL).length === 0 && (
                                                                            <div style={{ fontSize: 13, color: "#64748b" }}>Chưa có câu hỏi.</div>
                                                                        )}
                                                                        {getQuestionItemsBySource(QUESTION_SOURCE_COUNCIL).map(({ pair, index }) => (
                                                                            <div key={`q-council-${index}`} style={{ display: "grid", gap: 8, border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                                                                                <div style={{ fontWeight: 700, color: "#111111" }}>{`Câu hỏi ${index + 1}`}</div>
                                                                                <textarea
                                                                                    value={stripQuestionSource(pair.question)}
                                                                                    onChange={(event) =>
                                                                                        setQuestionAnswers((prev) =>
                                                                                            prev.map((item, itemIndex) =>
                                                                                                itemIndex === index
                                                                                                    ? { ...item, question: composeQuestionWithSource(QUESTION_SOURCE_COUNCIL, event.target.value) }
                                                                                                    : item,
                                                                                            ),
                                                                                        )
                                                                                    }
                                                                                    readOnly={!canEditMinutesSections123}
                                                                                    rows={3}
                                                                                    style={{ minHeight: 120 }}
                                                                                />
                                                                                {canEditMinutesSections123 && (
                                                                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                                                        <button
                                                                                            type="button"
                                                                                            className="lec-soft"
                                                                                            style={{ width: "fit-content" }}
                                                                                            onClick={() =>
                                                                                                setQuestionAnswers((prev) =>
                                                                                                    prev.map((item, itemIndex) =>
                                                                                                        itemIndex === index ? { ...item, question: `[${QUESTION_SOURCE_COUNCIL}] ` } : item,
                                                                                                    ),
                                                                                                )
                                                                                            }
                                                                                            title="Xóa trắng nội dung câu hỏi"
                                                                                        >
                                                                                            <Eraser size={14} /> Clear câu hỏi
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            className="lec-soft"
                                                                                            style={{ width: "fit-content" }}
                                                                                            onClick={() => deleteQuestionAnswerWithConfirm(index)}
                                                                                            title="Xóa câu hỏi"
                                                                                        >
                                                                                            <Trash2 size={14} /> Xóa câu hỏi
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                        {canEditMinutesSections123 && (
                                                                            <button
                                                                                type="button"
                                                                                className="lec-soft"
                                                                                style={{ width: "fit-content" }}
                                                                                onClick={() => addQuestionWithSource(QUESTION_SOURCE_COUNCIL)}
                                                                            >
                                                                                <Plus size={14} /> Thêm câu hỏi
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {canEditMinutesSections123 && (
                                                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                                        <button
                                                                            type="button"
                                                                            className="lec-soft"
                                                                            style={{ width: "fit-content" }}
                                                                            onClick={restoreDeletedQuestionAnswer}
                                                                            disabled={!deletedQuestionAnswerDraft}
                                                                            title={deletedQuestionAnswerDraft ? "Phục hồi câu hỏi vừa xóa" : "Chưa có câu hỏi nào bị xóa"}
                                                                        >
                                                                            <Undo2 size={14} /> Phục hồi câu hỏi
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div style={{ display: "grid", gap: 8, border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                                                                <div style={{ fontWeight: 800, color: "#111111" }}>III. Tác giả trả lời các câu hỏi đặt ra của Hội đồng</div>
                                                                {questionAnswers.length === 0 ? (
                                                                    <div style={{ fontSize: 13, color: "#64748b" }}>Chưa có câu hỏi ở phần II nên chưa có thứ tự để nhập câu trả lời.</div>
                                                                ) : (
                                                                    questionAnswers.map((pair, index) => (
                                                                        <div key={`a-only-${index}`} style={{ display: "grid", gap: 8, border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                                                                            <div style={{ fontWeight: 700, color: "#111111" }}>{`Trả lời câu ${index + 1}`}</div>
                                                                            <div style={{ fontSize: 13, color: "#475569" }}>
                                                                                Câu hỏi: {stripQuestionSource(pair.question)?.trim() ? stripQuestionSource(pair.question) : "(Chưa nhập câu hỏi ở phần II)"}
                                                                            </div>
                                                                            <textarea
                                                                                value={pair.answer}
                                                                                onChange={(event) =>
                                                                                    setQuestionAnswers((prev) =>
                                                                                        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, answer: event.target.value } : item)),
                                                                                    )
                                                                                }
                                                                                readOnly={!canEditMinutesSections123}
                                                                                rows={4}
                                                                                style={{ minHeight: 140 }}
                                                                            />
                                                                            {canEditMinutesSections123 && (
                                                                                <button
                                                                                    type="button"
                                                                                    className="lec-soft"
                                                                                    style={{ width: "fit-content" }}
                                                                                    onClick={() =>
                                                                                        setQuestionAnswers((prev) =>
                                                                                            prev.map((item, itemIndex) => (itemIndex === index ? { ...item, answer: "" } : item)),
                                                                                        )
                                                                                    }
                                                                                    title="Xóa trắng câu trả lời"
                                                                                >
                                                                                    <Eraser size={14} /> Clear câu trả lời
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </>
                                                    )}

                                                    {isChairRole && (
                                                        <div style={{ display: "grid", gap: 8, border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                                                            <div style={{ fontWeight: 800, color: "#111111" }}>IV. Đánh giá của Hội đồng (do Chủ tịch Hội đồng tổng hợp nhận xét)</div>
                                                            <label style={{ display: "grid", gap: 6 }}>
                                                                <span className="lec-kicker">a. Ưu điểm của đồ án</span>
                                                                <textarea value={strengths} onChange={(event) => setStrengths(event.target.value)} readOnly={!canEditMinutesSection4} rows={6} style={{ minHeight: 150 }} />
                                                            </label>
                                                            <label style={{ display: "grid", gap: 6 }}>
                                                                <span className="lec-kicker">b. Thiếu sót, tồn tại</span>
                                                                <textarea value={weaknesses} onChange={(event) => setWeaknesses(event.target.value)} readOnly={!canEditMinutesSection4} rows={6} style={{ minHeight: 150 }} />
                                                            </label>
                                                            <label style={{ display: "grid", gap: 6 }}>
                                                                <span className="lec-kicker">c. Các kiến nghị của Hội đồng</span>
                                                                <textarea value={recommendations} onChange={(event) => setRecommendations(event.target.value)} readOnly={!canEditMinutesSection4} rows={6} style={{ minHeight: 150 }} />
                                                            </label>
                                                        </div>
                                                    )}

                                                </>
                                            )}

                                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                                <div style={{ fontSize: 12, color: "#64748b" }}>{lastAutoSave ? `Autosave local: ${lastAutoSave}` : "Autosave local mỗi 30 giây"}</div>
                                                <button
                                                    type="button"
                                                    className="lec-primary"
                                                    disabled={!canSaveMinutes || !selectedAssignmentId}
                                                    onClick={async () => {
                                                        if (!selectedAssignmentId) {
                                                            notifyError("Vui lòng chọn assignment để lưu biên bản.");
                                                            return;
                                                        }
                                                        try {
                                                            const idempotencyKey = createIdempotencyKey(periodIdText || "NA", "lecturer-minutes-save");
                                                            const response = await lecturerApi.updateCommitteeMinutes(
                                                                selectedCommitteeNumericId,
                                                                {
                                                                    assignmentId: selectedAssignmentId,
                                                                    reviewerComments: review,
                                                                    committeeMemberComments: questions,
                                                                    qnaDetails: answers,
                                                                    questionAnswers,
                                                                    strengths,
                                                                    weaknesses,
                                                                    recommendations,
                                                                    chapterContents,
                                                                    councilDiscussionConclusion,
                                                                    chairConclusion,
                                                                    reviewerSections,
                                                                },
                                                                idempotencyKey,
                                                            );
                                                            if (notifyApiFailure(response as ApiResponse<unknown>, "Không lưu được biên bản.")) {
                                                                return;
                                                            }
                                                            notifySuccess("Lưu biên bản thành công.");
                                                            setMinuteSavedAt(new Date().toISOString());
                                                            setLastAutoSave(new Date().toLocaleTimeString("vi-VN"));
                                                            pushTrace("minutes-upsert", "Đã lưu biên bản họp.");
                                                            await hydrateMinutes(selectedCommitteeNumericId, selectedAssignmentId);
                                                            await refreshAllScoringRows();
                                                        } catch {
                                                            notifyError("Không lưu được biên bản.");
                                                        }
                                                    }}
                                                >
                                                    <Save size={14} /> Lưu biên bản
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {workspaceTab === "review" && (
                                        <div style={{ display: "grid", gap: 10 }}>
                                            {!canViewReviewTab ? (
                                                <div style={{ fontSize: 13, color: "#64748b" }}>
                                                    Vai trò hiện tại không có màn hình nhận xét phản biện.
                                                </div>
                                            ) : !minuteSavedAt && isChairRole ? (
                                                <div style={{ fontSize: 13, color: "#64748b" }}>
                                                    Chủ tịch chỉ xem tổng hợp nhận xét sau khi thành viên lưu biên bản/nhận xét của đề tài này.
                                                </div>
                                            ) : (
                                                <>
                                                    <div style={{ fontWeight: 800, fontSize: 18, color: "#111111" }}>NỘI DUNG NHẬN XÉT</div>
                                                    <div style={{ fontSize: 13, color: "#334155" }}>
                                                        Nhập đầy đủ 7 nội dung theo mẫu nhận xét của người phản biện đồ án.
                                                    </div>

                                                    <label style={{ display: "grid", gap: 6 }}>
                                                        <span className="lec-kicker">1. Tính cấp thiết của đề tài</span>
                                                        <textarea
                                                            value={reviewerSections.necessity}
                                                            onChange={(event) => setReviewerSections((prev) => ({ ...prev, necessity: event.target.value }))}
                                                            readOnly={!canEditReviewerComments}
                                                            rows={5}
                                                            style={{ minHeight: 150 }}
                                                        />
                                                    </label>
                                                    <label style={{ display: "grid", gap: 6 }}>
                                                        <span className="lec-kicker">2. Tính trùng và tính mới của đề tài nghiên cứu</span>
                                                        <textarea
                                                            value={reviewerSections.novelty}
                                                            onChange={(event) => setReviewerSections((prev) => ({ ...prev, novelty: event.target.value }))}
                                                            readOnly={!canEditReviewerComments}
                                                            rows={5}
                                                            style={{ minHeight: 150 }}
                                                        />
                                                    </label>
                                                    <label style={{ display: "grid", gap: 6 }}>
                                                        <span className="lec-kicker">3. Mức độ hợp lý và độ tin cậy của phương pháp nghiên cứu</span>
                                                        <textarea
                                                            value={reviewerSections.methodologyReliability}
                                                            onChange={(event) => setReviewerSections((prev) => ({ ...prev, methodologyReliability: event.target.value }))}
                                                            readOnly={!canEditReviewerComments}
                                                            rows={5}
                                                            style={{ minHeight: 150 }}
                                                        />
                                                    </label>
                                                    <label style={{ display: "grid", gap: 6 }}>
                                                        <span className="lec-kicker">4. Nội dung và các kết quả đạt được</span>
                                                        <textarea
                                                            value={reviewerSections.resultsContent}
                                                            onChange={(event) => setReviewerSections((prev) => ({ ...prev, resultsContent: event.target.value }))}
                                                            readOnly={!canEditReviewerComments}
                                                            rows={5}
                                                            style={{ minHeight: 150 }}
                                                        />
                                                    </label>
                                                    <label style={{ display: "grid", gap: 6 }}>
                                                        <span className="lec-kicker">5. Hạn chế của đồ án</span>
                                                        <textarea
                                                            value={reviewerSections.limitations}
                                                            onChange={(event) => setReviewerSections((prev) => ({ ...prev, limitations: event.target.value }))}
                                                            readOnly={!canEditReviewerComments}
                                                            rows={5}
                                                            style={{ minHeight: 150 }}
                                                        />
                                                    </label>
                                                    <label style={{ display: "grid", gap: 6 }}>
                                                        <span className="lec-kicker">6. Một vài gợi ý để tác giả nghiên cứu và hoàn thiện đề tài</span>
                                                        <textarea
                                                            value={reviewerSections.suggestions}
                                                            onChange={(event) => setReviewerSections((prev) => ({ ...prev, suggestions: event.target.value }))}
                                                            readOnly={!canEditReviewerComments}
                                                            rows={5}
                                                            style={{ minHeight: 150 }}
                                                        />
                                                    </label>
                                                    <label style={{ display: "grid", gap: 6 }}>
                                                        <span className="lec-kicker">7. Kết luận (mức độ đạt được so với mục tiêu), đồng ý hay không đồng ý thông qua đồ án của sinh viên</span>
                                                        <textarea
                                                            value={reviewerSections.overallConclusion}
                                                            onChange={(event) => setReviewerSections((prev) => ({ ...prev, overallConclusion: event.target.value }))}
                                                            readOnly={!canEditReviewerComments}
                                                            rows={5}
                                                            style={{ minHeight: 150 }}
                                                        />
                                                    </label>

                                                    <label style={{ display: "grid", gap: 6 }}>
                                                        <span className="lec-kicker">Nhận xét tổng hợp phản biện</span>
                                                        <textarea
                                                            value={review}
                                                            onChange={(event) => setReview(event.target.value)}
                                                            readOnly={!canEditReviewerComments}
                                                            rows={4}
                                                        />
                                                    </label>
                                                </>
                                            )}

                                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                <button
                                                    type="button"
                                                    className="lec-primary"
                                                    disabled={!canEditReviewerComments || !selectedAssignmentId}
                                                    onClick={async () => {
                                                        if (!selectedAssignmentId) {
                                                            notifyError("Vui lòng chọn assignment trước khi lưu nhận xét phản biện.");
                                                            return;
                                                        }
                                                        try {
                                                            const idempotencyKey = createIdempotencyKey(periodIdText || "NA", "lecturer-review-save");
                                                            const response = await lecturerApi.updateCommitteeMinutes(
                                                                selectedCommitteeNumericId,
                                                                {
                                                                    assignmentId: selectedAssignmentId,
                                                                    reviewerComments: review,
                                                                    committeeMemberComments: questions,
                                                                    qnaDetails: answers,
                                                                    questionAnswers,
                                                                    strengths,
                                                                    weaknesses,
                                                                    recommendations,
                                                                    chapterContents,
                                                                    councilDiscussionConclusion,
                                                                    chairConclusion,
                                                                    reviewerSections,
                                                                },
                                                                idempotencyKey,
                                                            );
                                                            if (notifyApiFailure(response as ApiResponse<unknown>, "Không lưu được nhận xét phản biện.")) {
                                                                return;
                                                            }
                                                            notifySuccess("Lưu nhận xét phản biện thành công.");
                                                            setMinuteSavedAt(new Date().toISOString());
                                                            pushTrace("reviewer-comments-upsert", "Đã lưu nhận xét phản biện.");
                                                            await hydrateMinutes(selectedCommitteeNumericId, selectedAssignmentId);
                                                        } catch {
                                                            notifyError("Không lưu được nhận xét phản biện.");
                                                        }
                                                    }}
                                                >
                                                    <Save size={14} /> Lưu nhận xét
                                                </button>
                                            </div>

                                            <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 10 }}>
                                                <div style={{ fontWeight: 700, marginBottom: 6 }}>Liên thông chỉnh sửa sau bảo vệ</div>
                                                <div style={{ fontSize: 13, marginBottom: 8 }}>
                                                    Revision hiện chọn: {selectedRevisionItem.topicTitle || "-"} · {selectedRevisionItem.studentCode || "-"}
                                                </div>
                                                {selectedRevisionItem.revisionFileUrl && (
                                                    <a
                                                        href={normalizeUrl(selectedRevisionItem.revisionFileUrl)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#0f172a" }}
                                                    >
                                                        <ExternalLink size={13} /> Mở tệp chỉnh sửa
                                                    </a>
                                                )}
                                                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                    <button
                                                        type="button"
                                                        className="lec-soft"
                                                        disabled={!canApproveRevision || !selectedRevisionItem.revisionId}
                                                        onClick={async () => {
                                                            const revisionId = selectedRevisionItem.revisionId || 0;
                                                            if (!revisionId) {
                                                                notifyError("Không tìm thấy revision để duyệt.");
                                                                return;
                                                            }
                                                            try {
                                                                const idempotencyKey = createIdempotencyKey(periodIdText || "NA", "lecturer-approve-revision");
                                                                const response = await lecturerApi.approveRevision(revisionId, idempotencyKey);
                                                                if (notifyApiFailure(response as ApiResponse<unknown>, "Không duyệt được bản chỉnh sửa.")) {
                                                                    return;
                                                                }
                                                                pushTrace("approve-revision", "[UC4.2] Duyệt bản chỉnh sửa.");
                                                                await refreshRevisionQueue();
                                                            } catch {
                                                                notifyError("Không duyệt được bản chỉnh sửa.");
                                                            }
                                                        }}
                                                    >
                                                        <CheckCircle2 size={14} /> Duyệt
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="lec-soft"
                                                        disabled={!canRejectRevision || !selectedRevisionItem.revisionId}
                                                        onClick={async () => {
                                                            if (!rejectReason.trim()) {
                                                                notifyError(ucError("UC4.2-REJECT_REASON_REQUIRED"));
                                                                return;
                                                            }
                                                            const revisionId = selectedRevisionItem.revisionId || 0;
                                                            if (!revisionId) {
                                                                notifyError("Không tìm thấy revision để từ chối.");
                                                                return;
                                                            }
                                                            try {
                                                                const idempotencyKey = createIdempotencyKey(periodIdText || "NA", "lecturer-reject-revision");
                                                                const response = await lecturerApi.rejectRevision(revisionId, rejectReason.trim(), idempotencyKey);
                                                                if (notifyApiFailure(response as ApiResponse<unknown>, "Không từ chối được bản chỉnh sửa.")) {
                                                                    return;
                                                                }
                                                                pushTrace("reject-revision", "[UC4.2] Từ chối bản chỉnh sửa.");
                                                                await refreshRevisionQueue();
                                                            } catch {
                                                                notifyError("Không từ chối được bản chỉnh sửa.");
                                                            }
                                                        }}
                                                    >
                                                        <XCircle size={14} /> Từ chối
                                                    </button>
                                                </div>
                                            </div>

                                            <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 10 }}>
                                                <div style={{ fontWeight: 700, marginBottom: 6 }}>Danh sách revision</div>
                                                {revisionQueue.length === 0 && <div style={{ fontSize: 13, color: "#64748b" }}>Không có bản chỉnh sửa chờ duyệt.</div>}
                                                {revisionQueue.map((item) => (
                                                    <button
                                                        key={`revision-${item.revisionId}-${item.assignmentId ?? "na"}`}
                                                        type="button"
                                                        className="lec-assign-btn"
                                                        style={{ width: "100%", marginBottom: 6 }}
                                                        onClick={() => setRevision(item)}
                                                    >
                                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                                            <span style={{ fontWeight: 700 }}>{item.topicTitle}</span>
                                                            <span style={{ fontSize: 12, color: "#475569" }}>{item.status}</span>
                                                        </div>
                                                        <div style={{ fontSize: 12, color: "#64748b" }}>
                                                            {item.studentCode} · Assignment {item.assignmentId ?? "-"} · {formatDateTime(item.lastUpdated)}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        )}
                    </section>
                )}

            {previewModalType && renderPortal(
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(15, 23, 42, 0.45)",
                        zIndex: 100000,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 18,
                    }}
                    onClick={() => setPreviewModalType(null)}
                >
                    <div
                        style={{
                            width: "min(980px, calc(100vw - 24px))",
                            maxHeight: "calc(100vh - 36px)",
                            overflowY: "auto",
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: 14,
                            padding: 16,
                            boxShadow: "0 20px 44px rgba(2, 6, 23, 0.24)",
                            display: "grid",
                            gap: 10,
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: 18 }}>
                                    {previewModalType === "meeting"
                                        ? "BIÊN BẢN HỌP HỘI ĐỒNG CHẤM LUẬN ĐỒ ÁN"
                                        : previewModalType === "reviewer"
                                            ? "NHẬN XÉT CỦA NGƯỜI PHẢN BIỆN ĐỒ ÁN"
                                            : "BẢNG ĐIỂM GHI KẾT QUẢ BẢO VỆ"}
                                </div>
                                <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                                        {previewModalType === "scoreSheet"
                                            ? "Xem trước bảng điểm của toàn bộ đề tài trong hội đồng trước khi tải file."
                                            : "Xem trước theo dữ liệu đã nhập của đề tài đang chọn trước khi tải file."}
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                <div style={{ position: "relative" }}>
                                    <button
                                        type="button"
                                        style={{ border: "1px solid #cbd5e1", background: "#0f172a", color: "#ffffff", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s" }}
                                        disabled={isDownloadingPreviewFile}
                                        onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                                    >
                                        <Download size={14} /> {isDownloadingPreviewFile ? "Đang xử lý..." : "Tải xuống"} <ChevronDown size={14} style={{ transform: showDownloadDropdown ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                                    </button>
                                    {showDownloadDropdown && (
                                        <div
                                            style={{
                                                position: "absolute",
                                                top: "calc(100% + 6px)",
                                                right: 0,
                                                background: "#ffffff",
                                                border: "1px solid #cbd5e1",
                                                borderRadius: 10,
                                                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                                                minWidth: 160,
                                                zIndex: 4100,
                                                overflow: "hidden",
                                                display: "grid",
                                                padding: 4,
                                            }}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => { setShowDownloadDropdown(false); void downloadPreviewDocument(previewModalType, "word"); }}
                                                style={{ background: "none", border: "none", padding: "10px 12px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#0f172a", cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}
                                                onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                                                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                                            >
                                                <FileText size={14} color="#2563eb" /> Xuất bản Word (.docx)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setShowDownloadDropdown(false); void downloadPreviewDocument(previewModalType, "pdf"); }}
                                                style={{ background: "none", border: "none", padding: "10px 12px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#0f172a", cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}
                                                onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                                                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                                            >
                                                <Download size={14} color="#dc2626" /> Xuất bản PDF (.pdf)
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <button type="button" style={{ border: "1px solid #cbd5e1", background: "#f8fafc", color: "#64748b", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }} onClick={() => { setPreviewModalType(null); setShowDownloadDropdown(false); }}>
                                    Đóng
                                </button>
                            </div>
                        </div>

                        {previewModalType === "meeting" ? (
                            <div style={{ display: "grid", gap: 10, fontSize: 14, lineHeight: 1.6 }}>
                                <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 16, marginBottom: 10 }}>
                                    BIÊN BẢN HỌP<br />
                                    HỘI ĐỒNG CHẤM LUẬN ĐỒ ÁN
                                </div>
                                
                                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}>
                                    <thead>
                                        <tr>
                                            <th style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>STT</th>
                                            <th style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>Họ và tên, Học vị, chức danh</th>
                                            <th style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>Trách nhiệm trong HĐ</th>
                                            <th style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>Chữ ký Thành viên Hội đồng</th>
                                            <th style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>Ghi chú</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(selectedCommittee?.members ?? []).map((member, idx) => (
                                            <tr key={`preview-member-${member.memberId}`}>
                                                <td style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>{idx + 1}</td>
                                                <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>{`${member.degree ? `${member.degree} ` : ""}${member.lecturerName}`}</td>
                                                <td style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>
                                                    {member.roleCode === "CT" ? "Chủ tịch" : member.roleCode === "UVPB" ? "UV Phản biện" : member.roleCode === "UVTK" ? "UV Thư ký" : member.roleLabel}
                                                </td>
                                                <td style={{ border: "1px solid #cbd5e1", padding: 6 }}></td>
                                                <td style={{ border: "1px solid #cbd5e1", padding: 6 }}></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div>
                                    Hội đồng đã họp vào ngày <strong>{formatDate(selectedMatrixRow?.scheduledAt ?? selectedCommittee?.date ?? null)}</strong> tại Trường Đại học Đại Nam để chấm đồ án cho sinh viên: <strong>{selectedMatrixRow?.studentName ?? ""}</strong> MSV: <strong>{selectedMatrixRow?.studentCode ?? ""}</strong>
                                </div>
                                <div>Lớp: <strong>{selectedMatrixRow?.className ?? "-"}</strong> Khóa: <strong>{selectedMatrixRow?.cohortCode ?? "-"}</strong> Ngành đào tạo: <strong>Công nghệ thông tin</strong></div>
                                <div>Về đề tài: <strong>{selectedMatrixRow?.topicTitle ?? ""}</strong></div>
                                <div>Ngành đào tạo: <strong>Công nghệ thông tin</strong> Mã số: <strong>{selectedMatrixRow?.topicCode ?? ""}</strong></div>
                                <div>Số thành viên có mặt trong phiên họp chấm đồ án tốt nghiệp là: <strong>{selectedCommittee?.members.length ?? 0}</strong> người. Số vắng mặt: <strong>0</strong> người.</div>
                                <div>Họ tên và chức danh người hướng dẫn: <strong>{selectedMatrixRow?.supervisorLecturerName ?? ""}</strong> · Nơi công tác: <strong>{selectedMatrixRow?.supervisorOrganization ?? "-"}</strong></div>

                                <div style={{ textAlign: "center", fontWeight: "bold", marginTop: 10, marginBottom: 10 }}>NỘI DUNG HỌP HỘI ĐỒNG CHẤM ĐỒ ÁN</div>

                                <div>
                                    <strong>I. Tóm tắt nội dung đồ án</strong><br />
                                    Hội đồng đã nghe tác giả trình bày tóm tắt nội dung đồ án bao gồm: <strong>{chapterContents?.length ?? 0}</strong> chương. Cụ thể:<br />
                                    {(chapterContents ?? []).map((chapter, idx) => (
                                        <div key={`preview-chapter-${idx}`} style={{ paddingLeft: 20 }}>
                                            <strong>{String.fromCharCode(97 + idx)}) Chương {toRomanNumeral(idx + 1)}:</strong> {chapter.content}
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <strong>II. Ý kiến của các thành viên Hội đồng đánh giá tốt nghiệp</strong><br />
                                    <strong>1. Uỷ viên phản biện: Đọc nhận xét (có bản nhận xét kèm theo) và đặt câu hỏi:</strong>
                                    {getQuestionItemsBySource("II.1").length === 0 ? <div style={{ paddingLeft: 20 }}>...................................................................................</div> : getQuestionItemsBySource("II.1").map(({ pair, index }) => (
                                        <div key={`preview-q1-${index}`} style={{ paddingLeft: 20 }}>- Câu hỏi {index + 1}: {stripQuestionSource(pair.question)}</div>
                                    ))}
                                    <div style={{ marginTop: 6 }}><strong>2. Các thành viên Hội đồng nhận xét và đặt câu hỏi:</strong></div>
                                    {getQuestionItemsBySource("II.2").length === 0 ? <div style={{ paddingLeft: 20 }}>...................................................................................</div> : getQuestionItemsBySource("II.2").map(({ pair, index }) => (
                                        <div key={`preview-q2-${index}`} style={{ paddingLeft: 20 }}>- Câu hỏi {index + 1}: {stripQuestionSource(pair.question)}</div>
                                    ))}
                                </div>

                                <div>
                                    <strong>III. Tác giả trả lời các câu hỏi đặt ra của Hội đồng</strong><br />
                                    <div style={{ paddingLeft: 20 }}>
                                        {(questionAnswers ?? []).length === 0 ? "..................................................................................." : (questionAnswers ?? []).map((item, idx) => (
                                            <div key={`preview-a-${idx}`}>- {stripQuestionSource(item.question)}: {item.answer}</div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <strong>IV. Đánh giá của Hội đồng (do Chủ tịch Hội đồng tổng hợp nhận xét)</strong><br />
                                    <div style={{ paddingLeft: 20 }}>
                                        <strong>a. Ưu điểm của đồ án</strong><br />
                                        {strengths || "..................................................................................."}<br />
                                        <strong>b. Thiếu sót, tồn tại</strong><br />
                                        {weaknesses || "..................................................................................."}<br />
                                        <strong>c. Các kiến nghị của Hội đồng</strong><br />
                                        {recommendations || "..................................................................................."}
                                    </div>
                                </div>

                                <div>
                                    <strong>V. Hội đồng thảo luận, thống nhất kết quả đánh giá</strong>
                                    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6, marginBottom: 6 }}>
                                        <thead>
                                            <tr>
                                                <th rowSpan={2} style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>TT</th>
                                                <th rowSpan={2} style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>Thành viên Hội đồng</th>
                                                <th colSpan={2} style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>Điểm số</th>
                                                <th rowSpan={2} style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>Ghi chú</th>
                                            </tr>
                                            <tr>
                                                <th style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>Bằng số</th>
                                                <th style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>Bằng chữ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(selectedCommittee?.members ?? []).map((member, idx) => (
                                                <tr key={`preview-score-${member.memberId}`}>
                                                    <td style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>{idx + 1}</td>
                                                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>{member.lecturerName}</td>
                                                    <td style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>
                                                        {member.roleCode === "CT" ? formatScore(selectedMatrixRow?.scoreCt ?? null) :
                                                         member.roleCode === "UVPB" ? formatScore(selectedMatrixRow?.scorePb ?? null) :
                                                         member.roleCode === "UVTK" ? formatScore(selectedMatrixRow?.scoreTk ?? null) : ""}
                                                    </td>
                                                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}></td>
                                                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}></td>
                                                </tr>
                                            ))}
                                            <tr>
                                                <td colSpan={2} style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center", fontWeight: "bold" }}>Điểm trung bình</td>
                                                <td style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center", fontWeight: "bold" }}>{formatScore(selectedMatrixRow?.finalScore ?? null)}</td>
                                                <td style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center", fontWeight: "bold" }}>{selectedMatrixRow?.finalGrade ?? ""}</td>
                                                <td style={{ border: "1px solid #cbd5e1", padding: 6 }}></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div>
                                    <strong>VI. Kết luận của Chủ tịch Hội đồng đánh giá tốt nghiệp</strong><br />
                                    - Hội đồng thống nhất đánh giá đồ án với kết quả:<br />
                                    + Bằng số: <strong>{formatScore(selectedMatrixRow?.finalScore ?? null)}</strong> (điểm)<br />
                                    + Bằng chữ: <strong>{selectedMatrixRow?.finalGrade ?? ""}</strong> (điểm)<br />
                                    Hội đồng đánh giá tốt nghiệp kết thúc vào hồi ........phút.........cùng ngày./.
                                </div>

                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30, marginBottom: 40, textAlign: "center" }}>
                                    <div style={{ width: "50%" }}>
                                        <strong>Thư ký Hội đồng</strong><br />
                                        (Ký và ghi rõ họ tên)<br /><br /><br /><br />
                                        <strong>{(selectedCommittee?.members ?? []).find(m => m.roleCode === "UVTK")?.lecturerName ?? ""}</strong>
                                    </div>
                                    <div style={{ width: "50%" }}>
                                        <strong>Chủ tịch Hội đồng</strong><br />
                                        (Ký và ghi rõ họ tên)<br /><br /><br /><br />
                                        <strong>{(selectedCommittee?.members ?? []).find(m => m.roleCode === "CT")?.lecturerName ?? ""}</strong>
                                    </div>
                                </div>
                            </div>
                        ) : previewModalType === "reviewer" ? (
                            <div style={{ display: "grid", gap: 10, fontSize: 14, lineHeight: 1.6 }}>
                                <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 16, marginBottom: 10 }}>
                                    NHẬN XÉT CỦA NGƯỜI PHẢN BIỆN ĐỒ ÁN<br />
                                    NGÀNH CÔNG NGHỆ THÔNG TIN<br />
                                    <span style={{ fontSize: 14, fontWeight: "normal" }}>(Dành cho thành viên Hội đồng)</span>
                                </div>
                                
                                <div>Họ và tên sinh viên: <strong>{selectedMatrixRow?.studentName ?? ""}</strong> MSV: <strong>{selectedMatrixRow?.studentCode ?? ""}</strong></div>
                                <div>Lớp: <strong>{selectedMatrixRow?.className ?? "-"}</strong> Khóa: <strong>{selectedMatrixRow?.cohortCode ?? "-"}</strong> Ngành học: <strong>Công nghệ thông tin</strong></div>
                                <div>Tên đề tài: <strong>{selectedMatrixRow?.topicTitle ?? ""}</strong></div>
                                <div>Học hàm/học vị - Họ và tên người phản biện: <strong>{(() => {
                                    const reviewerMember = (selectedCommittee?.members ?? []).find((x) => x.roleCode === "UVPB");
                                    if (!reviewerMember) return "";
                                    return `${reviewerMember.degree ? `${reviewerMember.degree} ` : ""}${reviewerMember.lecturerName}`.trim();
                                })()}</strong></div>
                                <div>Nơi công tác: <strong>{(selectedCommittee?.members ?? []).find((x) => x.roleCode === "UVPB")?.organization ?? "-"}</strong></div>

                                <div style={{ textAlign: "center", fontWeight: "bold", marginTop: 10, marginBottom: 10 }}>NỘI DUNG NHẬN XÉT</div>

                                <div><strong>1. Tính cấp thiết của đề tài:</strong><br /><div style={{ paddingLeft: 20 }}>{reviewerSections.necessity || "..................................................................................."}</div></div>
                                <div><strong>2. Tính trùng và tính mới của đề tài nghiên cứu:</strong><br /><div style={{ paddingLeft: 20 }}>{reviewerSections.novelty || "..................................................................................."}</div></div>
                                <div><strong>3. Mức độ hợp lý và độ tin cậy của phương pháp nghiên cứu:</strong><br /><div style={{ paddingLeft: 20 }}>{reviewerSections.methodologyReliability || "..................................................................................."}</div></div>
                                <div><strong>4. Nội dung và các kết quả đạt được:</strong><br /><div style={{ paddingLeft: 20 }}>{reviewerSections.resultsContent || "..................................................................................."}</div></div>
                                <div><strong>5. Hạn chế của đồ án:</strong><br /><div style={{ paddingLeft: 20 }}>{reviewerSections.limitations || "..................................................................................."}</div></div>
                                <div><strong>6. Một vài gợi ý để tác giả nghiên cứu và hoàn thiện đề tài:</strong><br /><div style={{ paddingLeft: 20 }}>{reviewerSections.suggestions || "..................................................................................."}</div></div>
                                <div><strong>7. Kết luận (mức độ đạt được so với mục tiêu), đồng ý hay không đồng ý thông qua đồ án của sinh viên:</strong><br /><div style={{ paddingLeft: 20 }}>{reviewerSections.overallConclusion || review || "..................................................................................."}</div></div>

                                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 30, marginBottom: 40, textAlign: "center" }}>
                                    <div style={{ width: "50%" }}>
                                        <strong>Uỷ viên</strong><br />
                                        (Ký và ghi rõ họ tên)<br /><br /><br /><br />
                                        <strong>{(selectedCommittee?.members ?? []).find(m => m.roleCode === "UVPB")?.lecturerName ?? ""}</strong>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: "grid", gap: 10, fontSize: 13, lineHeight: 1.5 }}>
                                <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 12, fontWeight: "bold" }}>BỘ GIÁO DỤC VÀ ĐÀO TẠO</div>
                                    <div style={{ fontSize: 13, fontWeight: "bold" }}>TRƯỜNG ĐẠI HỌC ĐẠI NAM</div>
                                    <div style={{ fontSize: 14, fontWeight: "bold", marginTop: 6 }}>BẢNG ĐIỂM GHI KẾT QUẢ BẢO VỆ ĐỒ ÁN</div>
                                    <div style={{ fontSize: 12, marginTop: 4 }}>NGÀNH: Công nghệ thông tin</div>
                                    <div style={{ fontSize: 12, fontWeight: "bold", marginTop: 4 }}>HỘI ĐỒNG SỐ: {selectedMatrixRow?.committeeCode ?? selectedCommittee?.name ?? "-"}   NGÀY BẢO VỆ: {formatDate(selectedCommittee?.date ?? null)}</div>
                                </div>

                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 8 }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>STT</td>
                                            <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>MSSV</td>
                                            <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>Họ và tên sinh viên</td>
                                            <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>Khoá</td>
                                            <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>Họ và tên giảng viên hướng dẫn</td>
                                            <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>Điểm GVHD</td>
                                            <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold", minWidth: 50 }}>CT</td>
                                            <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold", minWidth: 50 }}>UVTK</td>
                                            <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold", minWidth: 50 }}>UVPB</td>
                                            <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold", minWidth: 60 }}>ĐIỂM TỔNG KẾT</td>
                                        </tr>
                                        {selectedCommitteeScoreRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} style={{ border: "1px solid #000", padding: 8, textAlign: "center", color: "#64748b" }}>Chưa có dữ liệu bảng điểm cho hội đồng này.</td>
                                            </tr>
                                        ) : (
                                            selectedCommitteeScoreRows.map((row, idx) => (
                                                <tr key={`preview-score-sheet-${row.assignmentId}`}>
                                                    <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{idx + 1}</td>
                                                    <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{row.studentCode}</td>
                                                    <td style={{ border: "1px solid #000", padding: 4 }}>{row.studentName}</td>
                                                    <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{row.cohortCode ?? "-"}</td>
                                                    <td style={{ border: "1px solid #000", padding: 4 }}>{row.supervisorLecturerName ?? "-"}</td>
                                                    <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{formatScore(row.scoreGvhd)}</td>
                                                    <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{formatScore(row.scoreCt)}</td>
                                                    <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{formatScore(row.scoreTk)}</td>
                                                    <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{formatScore(row.scorePb)}</td>
                                                    <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>{formatScore(row.finalScore)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>

                                <div style={{ marginTop: 12 }}>
                                    <div style={{ fontWeight: "bold", marginBottom: 8 }}>CÁC THÀNH VIÊN HỘI ĐỒNG</div>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>STT</td>
                                                <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>Chức danh</td>
                                                <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>Họ và tên</td>
                                                <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>Ký tên</td>
                                            </tr>
                                            <tr>
                                                <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}></td>
                                                <td style={{ border: "1px solid #000", padding: 4 }}>CHỦ TỊCH</td>
                                                <td style={{ border: "1px solid #000", padding: 4 }}>{(selectedCommittee?.members ?? []).find(m => m.roleCode === "CT")?.lecturerName ?? "-"}</td>
                                                <td style={{ border: "1px solid #000", padding: 4 }}></td>
                                            </tr>
                                            <tr>
                                                <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>2</td>
                                                <td style={{ border: "1px solid #000", padding: 4 }}>ỦY VIÊN THƯ KÝ</td>
                                                <td style={{ border: "1px solid #000", padding: 4 }}>{(selectedCommittee?.members ?? []).find(m => m.roleCode === "UVTK")?.lecturerName ?? "-"}</td>
                                                <td style={{ border: "1px solid #000", padding: 4 }}></td>
                                            </tr>
                                            <tr>
                                                <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}></td>
                                                <td style={{ border: "1px solid #000", padding: 4 }}>ỦY VIÊN PHẢN BIỆN</td>
                                                <td style={{ border: "1px solid #000", padding: 4 }}>{(selectedCommittee?.members ?? []).find(m => m.roleCode === "UVPB")?.lecturerName ?? "-"}</td>
                                                <td style={{ border: "1px solid #000", padding: 4 }}></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div style={{ marginTop: 16, textAlign: "center", fontSize: 12 }}>
                                    <div>Hà Nội, ngày .........tháng.........năm 202.....</div>
                                    <div style={{ marginTop: 12, fontWeight: "bold" }}>Chủ tịch Hội đồng</div>
                                    <div style={{ fontSize: 11, fontStyle: "italic", marginTop: 2 }}>(Ký và ghi rõ họ tên)</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {detailCommittee && renderPortal(
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(15, 23, 42, 0.45)",
                        zIndex: 100000,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 18,
                    }}
                    onClick={() => setDetailCommitteeId("")}
                >
                    <div
                        style={{
                            width: "min(860px, calc(100vw - 24px))",
                            maxHeight: "calc(100vh - 36px)",
                            overflowY: "auto",
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: 14,
                            padding: 16,
                            boxShadow: "0 20px 44px rgba(2, 6, 23, 0.24)",
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div>
                                <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <Info size={18} /> Chi tiết hội đồng {detailCommittee.id}
                                </h3>
                                <div style={{ marginTop: 4, fontSize: 13, color: "#334155" }}>{detailCommittee.name}</div>
                            </div>
                            <button type="button" className="lec-ghost" onClick={() => setDetailCommitteeId("")}>Đóng</button>
                        </div>

                        <div className="lec-tab-bar">
                            {detailTabs.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    className={`lec-pill ${detailTab === tab.key ? "active" : ""}`}
                                    onClick={() => setDetailTab(tab.key)}
                                >
                                    {tab.icon} {tab.label}
                                </button>
                            ))}
                        </div>

                        {detailTab === "overview" && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                                <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 10 }}>
                                    <div className="lec-kicker">Mã hội đồng</div>
                                    <div style={{ fontWeight: 700 }}>{detailCommittee.id}</div>
                                </div>
                                <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 10 }}>
                                    <div className="lec-kicker">Vai trò của tôi</div>
                                    <div style={{ fontWeight: 700 }}>{detailCommittee.roleLabel}</div>
                                </div>
                                <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 10 }}>
                                    <div className="lec-kicker">Lịch bảo vệ</div>
                                    <div style={{ fontWeight: 700 }}>{formatDate(detailCommittee.date)} · {formatSession(detailCommittee.session)}</div>
                                </div>
                                <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 10 }}>
                                    <div className="lec-kicker">Ngành</div>
                                    <div style={{ fontWeight: 700 }}>Công nghệ thông tin</div>
                                </div>
                                <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 10 }}>
                                    <div className="lec-kicker">Phòng</div>
                                    <div style={{ fontWeight: 700 }}>{detailCommittee.room}</div>
                                </div>
                                <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 10 }}>
                                    <div className="lec-kicker">Trạng thái phiên</div>
                                    {(() => {
                                        const statusVisual = getCommitteeStatusVisual(detailCommittee.status);

                                        return (
                                            <span
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 6,
                                                    width: "fit-content",
                                                    borderRadius: 999,
                                                    padding: "5px 10px",
                                                    fontSize: 12,
                                                    fontWeight: 500,
                                                    border: `1px solid ${statusVisual.chipBorder}`,
                                                    background: statusVisual.chipBg,
                                                    color: statusVisual.chipText,
                                                }}
                                            >
                                                {statusVisual.label}
                                            </span>
                                        );
                                    })()}
                                </div>
                                <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 10 }}>
                                    <div className="lec-kicker">Số đề tài</div>
                                    <div style={{ fontWeight: 700 }}>{committeeBadgeStats.get(detailCommittee.id)?.total ?? detailCommittee.studentCount}</div>
                                </div>
                            </div>
                        )}

                        {detailTab === "members" && (
                            <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 10 }}>
                                {detailCommittee.members.length === 0 && (
                                    <div style={{ fontSize: 13, color: "#64748b" }}>Snapshot chưa có danh sách thành viên cho hội đồng này.</div>
                                )}
                                {detailCommittee.members.map((member) => (
                                    <div
                                        key={member.memberId}
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "minmax(120px, 180px) minmax(0, 1fr)",
                                            gap: 8,
                                            padding: "8px 0",
                                            borderBottom: "1px dashed #e2e8f0",
                                        }}
                                    >
                                        <div style={{ fontWeight: 700 }}>{member.roleLabel}</div>
                                        <div style={{ display: "grid", gap: 6 }}>
                                            <div style={{ fontSize: 13 }}>
                                                {member.lecturerCode ? `${member.lecturerCode} - ` : ""}
                                                {member.degree ? `${member.degree} ` : ""}
                                                {member.lecturerName}
                                            </div>
                                            <div style={{ fontSize: 12, color: "#475569" }}>
                                                {member.organization || "Chưa cập nhật nơi công tác"}
                                            </div>
                                            {(() => {
                                                const participation = getCommitteeMemberParticipation(member, detailCommitteeRows);

                                                return (
                                                    <span
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            width: "fit-content",
                                                            borderRadius: 999,
                                                            padding: "5px 10px",
                                                            fontSize: 12,
                                                            fontWeight: 500,
                                                            gap: 6,
                                                            border: `1px solid ${participation.border}`,
                                                            background: participation.bg,
                                                            color: participation.text,
                                                        }}
                                                    >
                                                        {participation.label}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {detailTab === "topics" && (
                            <div style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 10 }}>
                                {detailCommitteeRows.length === 0 && (
                                    <div style={{ fontSize: 13, color: "#64748b" }}>Chưa có assignment trong scoring matrix cho hội đồng này.</div>
                                )}
                                {detailCommitteeRows.map((row) => (
                                    <div
                                        key={`detail-topic-${row.assignmentId}`}
                                        style={{
                                            display: "grid",
                                            gap: 4,
                                            padding: "8px 0",
                                            borderBottom: "1px dashed #e2e8f0",
                                        }}
                                    >
                                        <div style={{ fontWeight: 700 }}>{row.topicTitle}</div>
                                        <div style={{ fontSize: 13, color: "#475569" }}>
                                            {row.studentCode} - {row.studentName} · {formatSession(row.session)} · {formatRowTimeRange(row)}
                                        </div>
                                        <div style={{ fontSize: 13, color: "#475569" }}>
                                            GVHD: <strong>{row.supervisorLecturerName ?? "Chưa cập nhật"}</strong> · Hội đồng: <strong>{row.committeeCode} - {row.committeeName}</strong>
                                        </div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                            {row.topicTags.length > 0 ? (
                                                row.topicTags.map((tag) => (
                                                    <span
                                                        key={`detail-tag-${row.assignmentId}-${tag}`}
                                                        style={{
                                                            border: "1px solid #fdba74",
                                                            borderRadius: 999,
                                                            padding: "1px 8px",
                                                            fontSize: 11,
                                                            color: "#9a3412",
                                                            background: "#fff7ed",
                                                        }}
                                                    >
                                                        {tag}
                                                    </span>
                                                ))
                                            ) : (
                                                <span style={{ fontSize: 12, color: "#94a3b8" }}>Chưa có tags đề tài</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" className="lec-ghost" onClick={() => setDetailCommitteeId("")}>Đóng</button>
                            <button
                                type="button"
                                className="lec-primary"
                                onClick={() => {
                                    openRoleWorkspace(detailCommittee);
                                    setDetailCommitteeId("");
                                }}
                                disabled={detailCommittee.status !== "Đang họp"}
                            >
                                <ArrowRight size={14} /> Tham gia
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

export default LecturerCommitteeGradingRoom;
