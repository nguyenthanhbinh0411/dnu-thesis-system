import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  CheckCheck,
  CircleAlert,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import type {
  NotificationCreatedEvent,
  NotificationPreferenceDto,
  NotificationRecipientDto,
  NotificationUnreadCountDto,
  UpdateNotificationPreferenceInput,
} from "../../types/notification";
import {
  getMyNotificationPreferences,
  getMyNotifications,
  getMyUnreadCount,
  getNotificationsHubUrl,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  updateMyNotificationPreference,
} from "../../services/notification.service";
import { getAccessToken } from "../../services/auth-session.service";
import { useToast } from "../../context/useToast";
import {
  normalizeDefensePeriodId,
  setActiveDefensePeriodId,
} from "../../utils/defensePeriod";

type NotificationTheme = "student" | "lecturer";
type PanelMode = "feed" | "preferences";
type ReadFilter = "all" | "unread";

type NotificationBellProps = {
  theme: NotificationTheme;
};

const PAGE_SIZE = 20;

const feedButtonBase: React.CSSProperties = {
  border: "none",
  borderRadius: "999px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

const formatDateTime = (iso: string): string => {
  try {
    const date = new Date(iso);
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const priorityColorMap: Record<string, string> = {
  LOW: "#64748B",
  NORMAL: "#0EA5E9",
  HIGH: "#F59E0B",
  URGENT: "#DC2626",
};

const priorityLabelMap: Record<string, string> = {
  LOW: "Thấp",
  NORMAL: "Bình thường",
  HIGH: "Cao",
  URGENT: "Khẩn",
};

const fallbackActionUrlByType: Record<string, string> = {
  OPEN_DEFENSE_STUDENT: "/student/defense-info",
  OPEN_DEFENSE_SUPERVISOR: "/lecturer/students",
  OPEN_DEFENSE_COMMITTEE: "/lecturer/committees",
};

const extractPeriodIdFromPath = (pathname: string): number | null => {
  const matchers = [
    /\/defense-periods\/(\d+)\//i,
    /\/defense-periods\/(\d+)$/i,
    /\/defense\/periods\/(\d+)\//i,
    /\/defense\/periods\/(\d+)$/i,
  ];

  for (const matcher of matchers) {
    const matched = pathname.match(matcher);
    if (!matched) {
      continue;
    }
    const normalized = normalizeDefensePeriodId(matched[1]);
    if (normalized != null) {
      return normalized;
    }
  }

  return null;
};

const attachPeriodIdQuery = (
  targetUrl: string,
  periodId: number | null,
): string => {
  if (!targetUrl || periodId == null) {
    return targetUrl;
  }

  const [pathAndQuery, hash = ""] = targetUrl.split("#");
  const [pathname, query = ""] = pathAndQuery.split("?");
  const params = new URLSearchParams(query);
  if (!params.has("periodId")) {
    params.set("periodId", String(periodId));
  }
  const queryText = params.toString();
  return `${pathname}${queryText ? `?${queryText}` : ""}${hash ? `#${hash}` : ""}`;
};

const normalizeActionTarget = (
  rawActionUrl: string,
  actionType: string,
): {
  targetUrl: string;
  isExternal: boolean;
  periodId: number | null;
} | null => {
  const fallbackTarget = fallbackActionUrlByType[actionType] || "";
  const candidate = rawActionUrl || fallbackTarget;
  if (!candidate) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(candidate, window.location.origin);
  } catch {
    return {
      targetUrl: candidate,
      isExternal: /^https?:\/\//i.test(candidate),
      periodId: null,
    };
  }

  const isExternal =
    /^https?:\/\//i.test(candidate) &&
    parsedUrl.origin.toLowerCase() !== window.location.origin.toLowerCase();

  if (isExternal) {
    return {
      targetUrl: parsedUrl.toString(),
      isExternal: true,
      periodId: null,
    };
  }

  const normalizedPath = parsedUrl.pathname.replace(/\/+$/, "") || "/";
  const periodIdFromQuery = normalizeDefensePeriodId(
    parsedUrl.searchParams.get("periodId"),
  );
  const periodIdFromPath = extractPeriodIdFromPath(normalizedPath);
  const periodId = periodIdFromQuery ?? periodIdFromPath;

  let inAppPath = normalizedPath;
  if (/^\/defense\/periods\/\d+\/student(?:\/.*)?$/i.test(normalizedPath)) {
    inAppPath = "/student/defense-info";
  } else if (
    /^\/defense-periods\/\d+\/student(?:\/.*)?$/i.test(normalizedPath)
  ) {
    inAppPath = "/student/defense-info";
  } else if (
    /^\/defense\/periods\/\d+\/lecturer(?:\/.*)?$/i.test(normalizedPath)
  ) {
    inAppPath = "/lecturer/committees";
  } else if (
    /^\/defense-periods\/\d+\/lecturer(?:\/.*)?$/i.test(normalizedPath)
  ) {
    inAppPath = "/lecturer/committees";
  }

  let targetUrl = `${inAppPath}${parsedUrl.search}${parsedUrl.hash}`;
  if (
    inAppPath === "/student/defense-info" ||
    inAppPath === "/student/schedule" ||
    inAppPath === "/lecturer/committees"
  ) {
    targetUrl = attachPeriodIdQuery(targetUrl, periodId);
  }

  return {
    targetUrl,
    isExternal: false,
    periodId,
  };
};

const resolveCategoryTarget = (
  theme: NotificationTheme,
  notifCategory: string,
): string | null => {
  const category = String(notifCategory ?? "")
    .trim()
    .toUpperCase();

  if (theme === "student") {
    if (category === "TOPIC_WORKFLOW") return "/student/topics";
    if (category === "PROGRESS_SUBMISSION") return "/student/reports";
  }

  if (theme === "lecturer") {
    if (category === "TOPIC_WORKFLOW") return "/lecturer/topic-review";
    if (category === "PROGRESS_SUBMISSION") return "/lecturer/reports";
  }

  return null;
};

function mergeByRecipientId(
  current: NotificationRecipientDto[],
  incoming: NotificationRecipientDto[],
): NotificationRecipientDto[] {
  const map = new Map<number, NotificationRecipientDto>();

  for (const item of current) {
    map.set(item.recipientID, item);
  }

  for (const item of incoming) {
    map.set(item.recipientID, item);
  }

  return Array.from(map.values()).sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function eventToRecipient(
  event: NotificationCreatedEvent,
): NotificationRecipientDto {
  return {
    recipientID: event.recipientID,
    notificationID: 0,
    targetUserID: 0,
    targetUserCode: "",
    deliveryState: "DELIVERED",
    isRead: event.isRead,
    readAt: null,
    seenAt: null,
    dismissedAt: null,
    createdAt: event.createdAtIso,
    notification: {
      notificationID: 0,
      notificationCode: event.notificationCode,
      notifChannel: "IN_APP",
      notifCategory: event.notifCategory,
      notifTitle: event.notifTitle,
      notifBody: "",
      notifPriority: event.notifPriority,
      actionType: null,
      actionUrl: event.actionUrl,
      imageUrl: null,
      relatedEntityName: null,
      relatedEntityCode: null,
      relatedEntityID: null,
      triggeredByUserCode: null,
      isGlobal: false,
      createdAt: event.createdAtIso,
      expiresAt: null,
    },
  };
}

const NotificationBell: React.FC<NotificationBellProps> = ({ theme }) => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<PanelMode>("feed");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [notifications, setNotifications] = useState<
    NotificationRecipientDto[]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferenceDto[]>(
    [],
  );
  const [loadingPreferences, setLoadingPreferences] = useState(false);
  const [updatingPreferenceCategory, setUpdatingPreferenceCategory] = useState<
    string | null
  >(null);
  const [connectionState, setConnectionState] = useState<
    "connected" | "reconnecting" | "disconnected"
  >("disconnected");

  const panelRef = useRef<HTMLDivElement | null>(null);
  const connectionRef = useRef<HubConnection | null>(null);

  const themedColor = theme === "lecturer" ? "#FFFFFF" : "#F37021";
  const themedBg =
    theme === "lecturer"
      ? "rgba(255, 255, 255, 0.1)"
      : "rgba(243, 112, 33, 0.1)";
  const themedBorder =
    theme === "lecturer"
      ? "1px solid rgba(255, 255, 255, 0.25)"
      : "1px solid rgba(243, 112, 33, 0.2)";

  const hasMore = notifications.length < totalCount;

  const categoryOptions = useMemo(() => {
    const fromFeed = notifications.map(
      (item) => item.notification.notifCategory,
    );
    const fromPreferences = preferences.map((item) => item.notifCategory);
    return Array.from(new Set([...fromFeed, ...fromPreferences])).filter(
      Boolean,
    );
  }, [notifications, preferences]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await getMyUnreadCount();
      if (!response.success || !response.data) return;
      setUnreadCount(response.data.unreadCount || 0);
    } catch {
      // ignore count errors silently
    }
  }, []);

  const fetchFeed = useCallback(
    async (nextPage: number, replace = false) => {
      if (replace) {
        setLoadingFeed(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await getMyNotifications({
          page: nextPage,
          pageSize: PAGE_SIZE,
          isRead: readFilter === "unread" ? false : undefined,
          notifCategory: categoryFilter || undefined,
          includeDismissed: false,
        });

        if (!response.success) {
          throw new Error(response.message || "Không thể tải thông báo");
        }

        const incoming = response.data || [];
        setTotalCount(response.totalCount || incoming.length);
        setPage(nextPage);

        setNotifications((prev) => {
          if (replace) {
            return mergeByRecipientId([], incoming);
          }
          return mergeByRecipientId(prev, incoming);
        });
      } catch (error) {
        console.error("Load notifications failed:", error);
        addToast("Không thể tải danh sách thông báo", "error");
      } finally {
        setLoadingFeed(false);
        setLoadingMore(false);
      }
    },
    [addToast, categoryFilter, readFilter],
  );

  const syncFeed = useCallback(async () => {
    await fetchFeed(1, true);
  }, [fetchFeed]);

  const fetchPreferences = useCallback(async () => {
    setLoadingPreferences(true);
    try {
      const response = await getMyNotificationPreferences();
      if (!response.success) {
        throw new Error(response.message || "Không thể tải tùy chọn thông báo");
      }
      setPreferences(response.data || []);
    } catch (error) {
      console.error("Load preferences failed:", error);
      addToast("Không thể tải tùy chọn thông báo", "error");
    } finally {
      setLoadingPreferences(false);
    }
  }, [addToast]);

  const markOneAsRead = useCallback(
    async (recipientID: number) => {
      const previousNotifications = notifications;
      const previousUnreadCount = unreadCount;
      const target = notifications.find(
        (item) => item.recipientID === recipientID,
      );
      if (!target || target.isRead) {
        return;
      }

      const nowIso = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((item) =>
          item.recipientID === recipientID
            ? {
                ...item,
                isRead: true,
                readAt: nowIso,
              }
            : item,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        const response = await markNotificationAsRead(recipientID);
        if (!response.success) {
          throw new Error(response.message || "Đánh dấu đã đọc thất bại");
        }
        const payload = response.data as NotificationUnreadCountDto | null;
        if (payload && typeof payload.unreadCount === "number") {
          setUnreadCount(payload.unreadCount);
        }
      } catch (error) {
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);
        console.error("Mark read failed:", error);
        addToast("Không thể đánh dấu đã đọc", "error");
      }
    },
    [addToast, notifications, unreadCount],
  );

  const handleMarkAllRead = useCallback(async () => {
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    const category = categoryFilter || undefined;

    const affectedUnreadCount = notifications.filter((item) => {
      const matchCategory =
        !category || item.notification.notifCategory === category;
      return !item.isRead && matchCategory;
    }).length;

    setNotifications((prev) =>
      prev.map((item) => {
        const matchCategory =
          !category || item.notification.notifCategory === category;
        if (!item.isRead && matchCategory) {
          return {
            ...item,
            isRead: true,
            readAt: new Date().toISOString(),
          };
        }
        return item;
      }),
    );
    setUnreadCount((prev) => Math.max(0, prev - affectedUnreadCount));

    try {
      const response = await markAllNotificationsAsRead(category);
      if (!response.success) {
        throw new Error(response.message || "Đánh dấu tất cả thất bại");
      }
      const payload = response.data as NotificationUnreadCountDto | null;
      if (payload && typeof payload.unreadCount === "number") {
        setUnreadCount(payload.unreadCount);
      }
    } catch (error) {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      console.error("Mark all read failed:", error);
      addToast("Không thể đánh dấu tất cả đã đọc", "error");
    }
  }, [addToast, categoryFilter, notifications, unreadCount]);

  const handlePreferenceSave = useCallback(
    async (
      notifCategory: string,
      payload: UpdateNotificationPreferenceInput,
    ): Promise<void> => {
      setUpdatingPreferenceCategory(notifCategory);
      const previous = preferences;
      setPreferences((prev) =>
        prev.map((item) =>
          item.notifCategory === notifCategory
            ? {
                ...item,
                ...payload,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );

      try {
        const response = await updateMyNotificationPreference(
          notifCategory,
          payload,
        );
        if (!response.success) {
          throw new Error(response.message || "Cập nhật preference thất bại");
        }
        addToast("Đã lưu tùy chọn thông báo", "success");
      } catch (error) {
        setPreferences(previous);
        console.error("Update preference failed:", error);
        addToast("Không thể lưu tùy chọn thông báo", "error");
      } finally {
        setUpdatingPreferenceCategory(null);
      }
    },
    [addToast, preferences],
  );

  const handleNotificationClick = useCallback(
    async (item: NotificationRecipientDto) => {
      if (!item.isRead) {
        await markOneAsRead(item.recipientID);
      }

      const categoryTarget = resolveCategoryTarget(
        theme,
        item.notification.notifCategory,
      );
      if (categoryTarget) {
        navigate(categoryTarget);
        setIsOpen(false);
        return;
      }

      const rawActionUrl = String(item.notification.actionUrl ?? "").trim();
      const normalizedActionType = String(item.notification.actionType ?? "")
        .trim()
        .toUpperCase();

      const resolvedTarget = normalizeActionTarget(
        rawActionUrl,
        normalizedActionType,
      );

      if (!resolvedTarget?.targetUrl) {
        return;
      }

      if (resolvedTarget.periodId != null) {
        setActiveDefensePeriodId(resolvedTarget.periodId);
      }

      if (resolvedTarget.isExternal) {
        window.location.assign(resolvedTarget.targetUrl);
        return;
      }

      navigate(
        resolvedTarget.targetUrl.startsWith("/")
          ? resolvedTarget.targetUrl
          : `/${resolvedTarget.targetUrl}`,
      );
      setIsOpen(false);
    },
    [markOneAsRead, navigate, theme],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current) return;
      if (!panelRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl(getNotificationsHubUrl(), {
        accessTokenFactory: () => getAccessToken() || "",
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(LogLevel.Warning)
      .build();

    connectionRef.current = connection;

    connection.on(
      "notification.created",
      (payload: NotificationCreatedEvent) => {
        const incoming = eventToRecipient(payload);
        setNotifications((prev) => mergeByRecipientId([incoming], prev));
        if (typeof payload.unreadCount === "number") {
          setUnreadCount(payload.unreadCount);
        } else {
          setUnreadCount((prev) => prev + (payload.isRead ? 0 : 1));
        }
      },
    );

    connection.on("notification.unreadCountChanged", (payload: unknown) => {
      if (typeof payload === "number") {
        setUnreadCount(payload);
        return;
      }

      if (payload && typeof payload === "object") {
        const count = (payload as { unreadCount?: number }).unreadCount;
        if (typeof count === "number") {
          setUnreadCount(count);
        }
      }
    });

    connection.onreconnecting(() => setConnectionState("reconnecting"));
    connection.onreconnected(async () => {
      setConnectionState("connected");
      await fetchUnreadCount();
    });
    connection.onclose(() => setConnectionState("disconnected"));

    let isMounted = true;
    const start = async () => {
      try {
        await connection.start();
        if (isMounted) {
          setConnectionState("connected");
        }
      } catch (error) {
        if (isMounted) {
          console.error("Notification hub connect failed:", error);
          setConnectionState("disconnected");
        }
      }
    };

    void start();

    return () => {
      isMounted = false;
      void (async () => {
        try {
          if (
            connectionRef.current &&
            connectionRef.current.state !== HubConnectionState.Disconnected
          ) {
            await connectionRef.current.stop();
          }
        } catch {
          // no-op
        }
      })();
    };
  }, [fetchUnreadCount]);

  useEffect(() => {
    void fetchUnreadCount();
    void fetchFeed(1, true);
  }, [fetchFeed, fetchUnreadCount]);

  useEffect(() => {
    if (!isOpen) return;
    void syncFeed();
  }, [isOpen, syncFeed]);

  useEffect(() => {
    if (!isOpen || mode !== "preferences") return;
    void fetchPreferences();
  }, [fetchPreferences, isOpen, mode]);

  useEffect(() => {
    if (!isOpen) return;
    void fetchFeed(1, true);
  }, [categoryFilter, fetchFeed, isOpen, readFilter]);

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        title="Thông báo"
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          border: themedBorder,
          background: themedBg,
          color: themedColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          position: "relative",
          transition: "all 0.2s ease",
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 999,
              background: "#DC2626",
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #FFFFFF",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: 48,
            right: 0,
            width: 420,
            maxWidth: "calc(100vw - 24px)",
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: 14,
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)",
            zIndex: 1200,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid #E5E7EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#F9FAFB",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                Thông báo
              </div>
              <div
                style={{
                  fontSize: 11,
                  color:
                    connectionState === "connected"
                      ? "#059669"
                      : connectionState === "reconnecting"
                        ? "#D97706"
                        : "#B91C1C",
                }}
              >
                {connectionState === "connected"
                  ? "Realtime đang kết nối"
                  : connectionState === "reconnecting"
                    ? "Đang reconnect..."
                    : "Mất kết nối realtime"}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                style={{
                  ...feedButtonBase,
                  background: mode === "feed" ? "#F37021" : "#E5E7EB",
                  color: mode === "feed" ? "#FFFFFF" : "#374151",
                }}
                onClick={() => setMode("feed")}
              >
                Feed
              </button>
              <button
                style={{
                  ...feedButtonBase,
                  background: mode === "preferences" ? "#F37021" : "#E5E7EB",
                  color: mode === "preferences" ? "#FFFFFF" : "#374151",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onClick={() => setMode("preferences")}
              >
                <Settings2 size={13} />
                Preferences
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#6B7280",
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {mode === "feed" ? (
            <>
              <div
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid #E5E7EB",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={{
                      ...feedButtonBase,
                      background: readFilter === "all" ? "#F37021" : "#F3F4F6",
                      color: readFilter === "all" ? "#FFFFFF" : "#374151",
                    }}
                    onClick={() => setReadFilter("all")}
                  >
                    Tất cả
                  </button>
                  <button
                    style={{
                      ...feedButtonBase,
                      background:
                        readFilter === "unread" ? "#F37021" : "#F3F4F6",
                      color: readFilter === "unread" ? "#FFFFFF" : "#374151",
                    }}
                    onClick={() => setReadFilter("unread")}
                  >
                    Chưa đọc
                  </button>
                  <button
                    style={{
                      ...feedButtonBase,
                      background: "#F3F4F6",
                      color: "#374151",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    onClick={() => void syncFeed()}
                  >
                    <RefreshCw size={12} />
                    Đồng bộ
                  </button>
                  <button
                    style={{
                      ...feedButtonBase,
                      background: "#EEF2FF",
                      color: "#3730A3",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    onClick={() => void handleMarkAllRead()}
                  >
                    <CheckCheck size={12} />
                    Mark all read
                  </button>
                </div>

                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  style={{
                    width: "100%",
                    border: "1px solid #D1D5DB",
                    borderRadius: 8,
                    padding: "8px 10px",
                    fontSize: 12,
                    color: "#374151",
                    background: "#FFFFFF",
                  }}
                >
                  <option value="">Tất cả category</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                {loadingFeed ? (
                  <div
                    style={{
                      padding: 20,
                      textAlign: "center",
                      fontSize: 13,
                      color: "#6B7280",
                    }}
                  >
                    Đang tải thông báo...
                  </div>
                ) : notifications.length === 0 ? (
                  <div
                    style={{
                      padding: 20,
                      textAlign: "center",
                      fontSize: 13,
                      color: "#6B7280",
                    }}
                  >
                    Chưa có thông báo
                  </div>
                ) : (
                  notifications.map((item) => {
                    const priority = (
                      item.notification.notifPriority || "NORMAL"
                    )
                      .toString()
                      .toUpperCase();
                    const priorityColor =
                      priorityColorMap[priority] || priorityColorMap.NORMAL;
                    const priorityLabel =
                      priorityLabelMap[priority] ||
                      item.notification.notifPriority;

                    return (
                      <button
                        key={item.recipientID}
                        onClick={() => void handleNotificationClick(item)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          border: "none",
                          borderBottom: "1px solid #F3F4F6",
                          background: item.isRead ? "#FFFFFF" : "#FFF7ED",
                          padding: "12px 14px",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 10,
                            marginBottom: 6,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: item.isRead ? 600 : 700,
                              color: "#111827",
                            }}
                          >
                            {item.notification.notifTitle}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            {!item.isRead && (
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: 999,
                                  background: "#F37021",
                                  flexShrink: 0,
                                }}
                              />
                            )}
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: priorityColor,
                                background: `${priorityColor}1A`,
                                padding: "2px 6px",
                                borderRadius: 999,
                                textTransform: "uppercase",
                              }}
                            >
                              {priorityLabel}
                            </span>
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: "#4B5563",
                            marginBottom: 6,
                            lineHeight: 1.5,
                          }}
                        >
                          {item.notification.notifBody ||
                            "Bạn có một thông báo mới."}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              color: "#6B7280",
                            }}
                          >
                            {formatDateTime(item.createdAt)}
                          </span>
                          {!item.isRead && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                void markOneAsRead(item.recipientID);
                              }}
                              style={{
                                border: "1px solid #D1D5DB",
                                background: "#FFFFFF",
                                color: "#374151",
                                borderRadius: 8,
                                padding: "4px 8px",
                                fontSize: 11,
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                cursor: "pointer",
                              }}
                            >
                              <Check size={12} />
                              Mark read
                            </button>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {hasMore && (
                <div
                  style={{
                    padding: 12,
                    borderTop: "1px solid #E5E7EB",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <button
                    onClick={() => void fetchFeed(page + 1, false)}
                    disabled={loadingMore}
                    style={{
                      border: "1px solid #D1D5DB",
                      borderRadius: 8,
                      padding: "8px 14px",
                      background: "#FFFFFF",
                      color: "#374151",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: loadingMore ? "not-allowed" : "pointer",
                      opacity: loadingMore ? 0.6 : 1,
                    }}
                  >
                    {loadingMore ? "Đang tải..." : "Xem thêm"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ maxHeight: 470, overflowY: "auto", padding: 12 }}>
              {loadingPreferences ? (
                <div
                  style={{
                    padding: 20,
                    textAlign: "center",
                    fontSize: 13,
                    color: "#6B7280",
                  }}
                >
                  Đang tải preferences...
                </div>
              ) : preferences.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    textAlign: "center",
                    fontSize: 13,
                    color: "#6B7280",
                  }}
                >
                  Chưa có cấu hình preferences
                </div>
              ) : (
                preferences.map((pref) => {
                  const saving =
                    updatingPreferenceCategory === pref.notifCategory;
                  return (
                    <div
                      key={pref.preferenceID}
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#111827",
                          }}
                        >
                          {pref.notifCategory}
                        </div>
                        <div style={{ fontSize: 10, color: "#6B7280" }}>
                          {formatDateTime(pref.updatedAt)}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                          marginBottom: 10,
                        }}
                      >
                        <label style={{ fontSize: 12, color: "#374151" }}>
                          <input
                            type="checkbox"
                            checked={pref.inAppEnabled}
                            onChange={(event) => {
                              const payload: UpdateNotificationPreferenceInput =
                                {
                                  inAppEnabled: event.target.checked,
                                  emailEnabled: pref.emailEnabled,
                                  pushEnabled: pref.pushEnabled,
                                  digestMode: pref.digestMode,
                                  quietFrom: pref.quietFrom,
                                  quietTo: pref.quietTo,
                                };
                              void handlePreferenceSave(
                                pref.notifCategory,
                                payload,
                              );
                            }}
                            disabled={saving}
                            style={{ marginRight: 6 }}
                          />
                          In-app
                        </label>

                        <label style={{ fontSize: 12, color: "#374151" }}>
                          <input
                            type="checkbox"
                            checked={pref.emailEnabled}
                            onChange={(event) => {
                              const payload: UpdateNotificationPreferenceInput =
                                {
                                  inAppEnabled: pref.inAppEnabled,
                                  emailEnabled: event.target.checked,
                                  pushEnabled: pref.pushEnabled,
                                  digestMode: pref.digestMode,
                                  quietFrom: pref.quietFrom,
                                  quietTo: pref.quietTo,
                                };
                              void handlePreferenceSave(
                                pref.notifCategory,
                                payload,
                              );
                            }}
                            disabled={saving}
                            style={{ marginRight: 6 }}
                          />
                          Email
                        </label>

                        <label style={{ fontSize: 12, color: "#374151" }}>
                          <input
                            type="checkbox"
                            checked={pref.pushEnabled}
                            onChange={(event) => {
                              const payload: UpdateNotificationPreferenceInput =
                                {
                                  inAppEnabled: pref.inAppEnabled,
                                  emailEnabled: pref.emailEnabled,
                                  pushEnabled: event.target.checked,
                                  digestMode: pref.digestMode,
                                  quietFrom: pref.quietFrom,
                                  quietTo: pref.quietTo,
                                };
                              void handlePreferenceSave(
                                pref.notifCategory,
                                payload,
                              );
                            }}
                            disabled={saving}
                            style={{ marginRight: 6 }}
                          />
                          Push
                        </label>

                        <div style={{ fontSize: 12, color: "#374151" }}>
                          Digest: <strong>{pref.digestMode}</strong>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                          marginBottom: 10,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#6B7280",
                              marginBottom: 4,
                            }}
                          >
                            Quiet from
                          </div>
                          <input
                            type="time"
                            value={pref.quietFrom || ""}
                            disabled={saving}
                            onChange={(event) => {
                              const payload: UpdateNotificationPreferenceInput =
                                {
                                  inAppEnabled: pref.inAppEnabled,
                                  emailEnabled: pref.emailEnabled,
                                  pushEnabled: pref.pushEnabled,
                                  digestMode: pref.digestMode,
                                  quietFrom: event.target.value || null,
                                  quietTo: pref.quietTo,
                                };
                              void handlePreferenceSave(
                                pref.notifCategory,
                                payload,
                              );
                            }}
                            style={{
                              width: "100%",
                              border: "1px solid #D1D5DB",
                              borderRadius: 8,
                              padding: "6px 8px",
                              fontSize: 12,
                            }}
                          />
                        </div>

                        <div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#6B7280",
                              marginBottom: 4,
                            }}
                          >
                            Quiet to
                          </div>
                          <input
                            type="time"
                            value={pref.quietTo || ""}
                            disabled={saving}
                            onChange={(event) => {
                              const payload: UpdateNotificationPreferenceInput =
                                {
                                  inAppEnabled: pref.inAppEnabled,
                                  emailEnabled: pref.emailEnabled,
                                  pushEnabled: pref.pushEnabled,
                                  digestMode: pref.digestMode,
                                  quietFrom: pref.quietFrom,
                                  quietTo: event.target.value || null,
                                };
                              void handlePreferenceSave(
                                pref.notifCategory,
                                payload,
                              );
                            }}
                            style={{
                              width: "100%",
                              border: "1px solid #D1D5DB",
                              borderRadius: 8,
                              padding: "6px 8px",
                              fontSize: 12,
                            }}
                          />
                        </div>
                      </div>

                      <button
                        disabled={saving}
                        style={{
                          width: "100%",
                          border: "none",
                          borderRadius: 8,
                          padding: "8px 10px",
                          background: saving ? "#D1D5DB" : "#F37021",
                          color: "#FFFFFF",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: saving ? "not-allowed" : "pointer",
                        }}
                        onClick={() => {
                          addToast("Preference đã được đồng bộ", "success");
                        }}
                      >
                        {saving ? "Đang lưu..." : "Đã lưu"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          <div
            style={{
              padding: "8px 12px",
              borderTop: "1px solid #E5E7EB",
              background: "#F9FAFB",
              fontSize: 11,
              color: "#6B7280",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>
              Unread badge: <strong>{unreadCount}</strong>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CircleAlert size={12} />
              realtime + api sync
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
