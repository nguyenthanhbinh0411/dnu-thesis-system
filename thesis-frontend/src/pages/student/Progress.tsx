import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  Circle,
  Clock,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { fetchData } from "../../api/fetchData";
import { useAuth } from "../../hooks/useAuth";
import type { ApiResponse } from "../../types/api";
import type { MilestoneTemplate } from "../../types/milestoneTemplate";
import type { ProgressMilestone } from "../../types/progressMilestone";
import type { Topic } from "../../types/topic";

interface Milestone {
  id: number;
  title: string;
  description: string;
  deadline: string;
  status: "completed" | "in-progress" | "pending" | "overdue" | "waiting-for-committee";
  completedDate?: string;
  ordinal: number; // Add ordinal
}

const Progress: React.FC = () => {
  const auth = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [progressAnimated, setProgressAnimated] = useState(false);

  useEffect(() => {
    const loadProgress = async () => {
      if (!auth.user?.userCode) {
        setLoading(false);
        return;
      }

      try {
        // First, fetch the student's topic
        console.log("Fetching topics for userCode:", auth.user.userCode);
        const topicsRes = (await fetchData(
          `/Topics/get-list?ProposerUserCode=${auth.user.userCode}`,
        )) as ApiResponse<Topic[]>;
        console.log("Topics response:", topicsRes);
        console.log("Topics data:", topicsRes.data);
        const hasTopic = topicsRes.data && topicsRes.data.length > 0;
        const topic = hasTopic && topicsRes.data ? topicsRes.data[0] : null;
        const topicCode = topic?.topicCode;
        console.log("Topic code:", topicCode);

        // Fetch all milestone templates - always show templates even without topic
        console.log("Fetching milestone templates...");
        const templatesRes = (await fetchData(
          "/MilestoneTemplates/get-list",
        )) as ApiResponse<MilestoneTemplate[]>;
        console.log("Templates response:", templatesRes);
        if (!templatesRes.data || templatesRes.data.length === 0) {
          console.error("Failed to fetch milestone templates");
          setMilestones([]);
          setLoading(false);
          return;
        }
        const templates = templatesRes.data;
        console.log("Templates:", templates.length);

        let progressMilestones: ProgressMilestone[] = [];
        if (hasTopic && topicCode) {
          // Fetch progress milestones only if student has a topic
          console.log("Fetching progress milestones...");
          const progressRes = (await fetchData(
            `/ProgressMilestones/get-list?TopicCode=${topicCode}`,
          )) as ApiResponse<ProgressMilestone[]>;
          console.log("Progress response:", progressRes);
          progressMilestones = progressRes.data || [];
          console.log("Progress milestones:", progressMilestones.length);
        }

        // Create milestones array - always show all templates
        const milestonesData: Milestone[] = templates.map(
          (template: MilestoneTemplate) => {
            // Find progress milestone by ordinal since milestoneTemplateCode might be null
            const progressMilestone = progressMilestones.find(
              (pm) => pm.ordinal === template.ordinal,
            );

            let status:
              | "completed"
              | "in-progress"
              | "pending"
              | "overdue"
              | "waiting-for-committee" = "pending";
            let completedDate: string | undefined;
            const deadline: string = template.deadline;

            if (progressMilestone) {
              // Map completedAt based on milestoneTemplateCode
              let specificCompletedAt: string | null = null;
              switch (template.milestoneTemplateCode) {
                case "MS_REG":
                  specificCompletedAt = progressMilestone.completedAt1;
                  break;
                case "MS_PROG1":
                  specificCompletedAt = progressMilestone.completedAt2;
                  break;
                case "MS_PROG2":
                  specificCompletedAt = progressMilestone.completedAt3;
                  break;
                case "MS_FULL":
                  specificCompletedAt = progressMilestone.completedAt4;
                  break;
                default:
                  // Fallback: check if any completedAt is set
                  specificCompletedAt =
                    progressMilestone.completedAt1 ||
                    progressMilestone.completedAt2 ||
                    progressMilestone.completedAt3 ||
                    progressMilestone.completedAt4;
                  break;
              }

              // Priority 1: Check if this is the final milestone waiting for committee
              const state = progressMilestone.state.toLowerCase();
              if (state === "waitingforcommittee" && template.ordinal === 4) {
                status = "waiting-for-committee";
                if (specificCompletedAt) completedDate = specificCompletedAt.split("T")[0];
              }
              // Priority 2: Check if actually completed
              else if (specificCompletedAt) {
                status = "completed";
                completedDate = specificCompletedAt.split("T")[0];
              } 
              // Priority 3: Other states
              else {
                if (
                  state === "đang thực hiện" ||
                  state === "đang tiến hành" ||
                  state === "hoạt động" ||
                  state === "in progress" ||
                  state === "active"
                ) {
                  status = "in-progress";
                } else {
                  status = "pending";
                }
              }
            }

            return {
              id: template.milestoneTemplateID,
              title: template.name,
              description: template.description,
              deadline,
              status,
              completedDate,
              ordinal: template.ordinal,
            };
          },
        );

        // Logic: Mark milestones as completed based on completedAt fields
        // Only apply this logic if there are actual progress milestones
        let finalMilestones = milestonesData;
        if (progressMilestones.length > 0) {
          // Find the progress milestone (assuming there's only one per topic)
          const progressMilestone = progressMilestones[0];

          finalMilestones = milestonesData.map((milestone) => {
            let isCompleted = false;
            let completedDate: string | undefined;

            // Check completion based on completedAt fields
            switch (milestone.ordinal) {
              case 1: // MS_REG
                isCompleted = !!progressMilestone.completedAt1;
                if (isCompleted) {
                  completedDate = progressMilestone.completedAt1?.split("T")[0];
                }
                break;
              case 2: // MS_PROG1
                isCompleted = !!progressMilestone.completedAt2;
                if (isCompleted) {
                  completedDate = progressMilestone.completedAt2?.split("T")[0];
                }
                break;
              case 3: // MS_PROG2
                isCompleted = !!progressMilestone.completedAt3;
                if (isCompleted) {
                  completedDate = progressMilestone.completedAt3?.split("T")[0];
                }
                break;
              case 4: // MS_FULL
                isCompleted = !!progressMilestone.completedAt4;
                if (isCompleted) {
                  completedDate = progressMilestone.completedAt4?.split("T")[0];
                }
                break;
            }

            if (isCompleted) {
              return {
                ...milestone,
                status: "completed" as const,
                completedDate,
              };
            }

            return milestone;
          });
        }

        console.log("Milestones data:", finalMilestones);
        setMilestones(finalMilestones);
        // Trigger progress animation after data loads
        setTimeout(() => setProgressAnimated(true), 500);
      } catch (error) {
        console.error("Error loading progress:", error);
        setMilestones([]);
      } finally {
        setLoading(false);
      }
    };

    loadProgress();
  }, [auth.user?.userCode]);

  if (loading) {
    return (
      <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header Skeleton */}
        <div style={{ marginBottom: "32px" }}>
          <div
            style={{
              height: "32px",
              width: "200px",
              borderRadius: "4px",
              marginBottom: "8px",
            }}
            className="loading-skeleton"
          />
          <div
            style={{
              height: "14px",
              width: "300px",
              borderRadius: "4px",
            }}
            className="loading-skeleton"
          />
        </div>

        {/* Progress Overview Skeleton */}
        <div
          style={{
            height: "200px",
            borderRadius: "16px",
            marginBottom: "32px",
          }}
          className="loading-skeleton"
        />

        {/* Timeline Skeleton */}
        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "32px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
          }}
        >
          <div
            style={{
              height: "24px",
              width: "150px",
              borderRadius: "4px",
              marginBottom: "24px",
            }}
            className="loading-skeleton"
          />
          {/* Multiple milestone skeletons */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{ display: "flex", gap: "24px", marginBottom: "24px" }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                }}
                className="loading-skeleton"
              />
              <div
                style={{
                  flex: 1,
                  height: "100px",
                  borderRadius: "12px",
                }}
                className="loading-skeleton"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const completedCount = milestones.filter(
    (m) => m.status === "completed" || m.status === "waiting-for-committee",
  ).length;
  const totalCount = milestones.length;
  const progressPercentage = Math.round((completedCount / totalCount) * 100);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#22c55e";
      case "in-progress":
        return "#f37021";
      case "overdue":
        return "#ef4444";
      case "waiting-for-committee":
        return "#22c55e";
      default:
        return "#94a3b8";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle size={24} color="#22c55e" />;
      case "in-progress":
        return <Clock size={24} color="#f37021" />;
      case "overdue":
        return <AlertCircle size={24} color="#ef4444" />;
      case "waiting-for-committee":
        return <CheckCircle size={24} color="#22c55e" />;
      default:
        return <Circle size={24} color="#94a3b8" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Hoàn thành";
      case "in-progress":
        return "Đang thực hiện";
      case "overdue":
        return "Quá hạn";
      case "waiting-for-committee":
        return "Chờ tạo hội đồng và bảo vệ";
      default:
        return "Chưa bắt đầu";
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <style>
        {`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes progressFill {
            from {
              width: 0%;
            }
            to {
              width: ${progressPercentage}%;
            }
          }

          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 0 0 0 rgba(243, 112, 33, 0.4);
            }
            50% {
              transform: scale(1.05);
              box-shadow: 0 0 0 10px rgba(243, 112, 33, 0);
            }
          }

          @keyframes bounceIn {
            0% {
              opacity: 0;
              transform: scale(0.3);
            }
            50% {
              opacity: 1;
              transform: scale(1.05);
            }
            70% {
              transform: scale(0.9);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes slideInLeft {
            from {
              opacity: 0;
              transform: translateX(-50px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          .progress-header {
            animation: fadeInUp 0.8s ease-out;
          }

          .progress-overview {
            animation: fadeInUp 1s ease-out 0.2s both;
          }

          .progress-bar-fill {
            animation: progressFill 2s ease-out 1s both;
          }

          .timeline-container {
            animation: fadeInUp 1.2s ease-out 0.4s both;
          }

          .milestone-card {
            animation: slideInLeft 0.6s ease-out both;
          }

          .milestone-in-progress {
            animation: pulse 2s infinite;
          }

          .progress-circle {
            animation: bounceIn 1s ease-out 0.8s both;
          }

          @keyframes shimmer {
            0% {
              background-position: -200px 0;
            }
            100% {
              background-position: calc(200px + 100%) 0;
            }
          }

          .loading-skeleton {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200px 100%;
            animation: shimmer 1.5s infinite;
          }
        `}
      </style>
      {/* Header */}
      <div style={{ marginBottom: "32px" }} className="progress-header">
        <h1
          style={{
            fontSize: "28px",
            fontWeight: "700",
            color: "#1a1a1a",
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <TrendingUp size={32} color="#f37021" />
          Tiến độ đồ án
        </h1>
        <p style={{ fontSize: "14px", color: "#666" }}>
          Theo dõi tiến độ thực hiện đồ án tốt nghiệp của bạn
        </p>
      </div>

      {/* Progress Overview */}
      <div
        style={{
          background: "linear-gradient(135deg, #fff5f0 0%, #ffe8dc 100%)",
          border: "2px solid #f37021",
          borderRadius: "16px",
          padding: "32px",
          marginBottom: "32px",
          boxShadow: "0 4px 12px rgba(243, 112, 33, 0.1)",
        }}
        className="progress-overview"
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "600",
                color: "#1a1a1a",
                marginBottom: "8px",
              }}
            >
              Tổng quan tiến độ
            </h2>
            <p style={{ fontSize: "14px", color: "#666" }}>
              {completedCount} / {totalCount} mốc đã hoàn thành
            </p>
          </div>
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              background: `conic-gradient(#f37021 ${progressPercentage}%, #e5e7eb ${progressPercentage}%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
            className="progress-circle"
          >
            <div
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                backgroundColor: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
              }}
            >
              <span
                style={{
                  fontSize: "28px",
                  fontWeight: "700",
                  color: "#f37021",
                }}
                className="progress-percentage"
              >
                {progressPercentage}%
              </span>
              <span style={{ fontSize: "12px", color: "#666" }}>
                Hoàn thành
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div
          style={{
            width: "100%",
            height: "12px",
            backgroundColor: "#e5e7eb",
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: progressAnimated ? `${progressPercentage}%` : "0%",
              height: "100%",
              background: "linear-gradient(90deg, #f37021 0%, #ff8838 100%)",
              transition: progressAnimated ? "none" : "width 0.5s ease",
            }}
            className={progressAnimated ? "progress-bar-fill" : ""}
          />
        </div>
      </div>

      {/* Timeline */}
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "32px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
        }}
        className="timeline-container"
      >
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "600",
            color: "#1a1a1a",
            marginBottom: "24px",
          }}
        >
          Chi tiết các mốc
        </h2>

        <div style={{ position: "relative" }}>
          {/* Timeline line */}
          <div
            style={{
              position: "absolute",
              left: "20px",
              top: "0",
              bottom: "0",
              width: "2px",
              background: "linear-gradient(180deg, #f37021 0%, #e5e7eb 100%)",
            }}
          />

          {/* Milestones */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "24px" }}
          >
            {milestones.map((milestone, index) => (
              <div
                key={`${milestone.id}-${index}`}
                style={{
                  display: "flex",
                  gap: "24px",
                  position: "relative",
                  animationDelay: `${0.6 + index * 0.1}s`,
                }}
                className="milestone-card"
              >
                {/* Icon */}
                <div
                  style={{
                    flexShrink: 0,
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                    border: `3px solid ${getStatusColor(milestone.status)}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1,
                  }}
                  className={
                    milestone.status === "in-progress"
                      ? "milestone-in-progress"
                      : ""
                  }
                >
                  {getStatusIcon(milestone.status)}
                </div>

                {/* Content */}
                <div
                  style={{
                    flex: 1,
                    padding: "20px",
                    background:
                      milestone.status === "completed" || milestone.status === "waiting-for-committee"
                        ? "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"
                        : milestone.status === "in-progress"
                          ? "linear-gradient(135deg, #fff5f0 0%, #ffe8dc 100%)"
                          : "#fafafa",
                    border: `2px solid ${getStatusColor(milestone.status)}`,
                    borderRadius: "12px",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform =
                      "translateX(8px) scale(1.02)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 25px rgba(0,0,0,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateX(0) scale(1)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "12px",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          fontSize: "18px",
                          fontWeight: "600",
                          color: "#1a1a1a",
                          marginBottom: "4px",
                        }}
                      >
                        {milestone.title}
                      </h3>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 12px",
                          backgroundColor: getStatusColor(milestone.status),
                          color: "#fff",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "600",
                        }}
                      >
                        {getStatusText(milestone.status)}
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#666",
                          marginBottom: "4px",
                        }}
                      >
                        Hạn chót
                      </div>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: "600",
                          color: "#1a1a1a",
                        }}
                      >
                        {new Date(milestone.deadline).toLocaleDateString(
                          "vi-VN",
                        )}
                      </div>
                    </div>
                  </div>

                  <p
                    style={{
                      fontSize: "14px",
                      color: "#666",
                      marginBottom: milestone.completedDate ? "12px" : "0",
                    }}
                  >
                    {milestone.description}
                  </p>

                  {milestone.completedDate && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "13px",
                        color: "#22c55e",
                        fontWeight: "600",
                      }}
                    >
                      <CheckCircle size={16} />
                      Hoàn thành ngày:{" "}
                      {new Date(milestone.completedDate).toLocaleDateString(
                        "vi-VN",
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tips */}
      <div
        style={{
          marginTop: "24px",
          padding: "20px",
          background: "#fef3c7",
          border: "1px solid #fcd34d",
          borderRadius: "12px",
        }}
        className="tips-section"
      >
        <h3
          style={{
            fontSize: "14px",
            fontWeight: "600",
            color: "#92400e",
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={18} />
          Gợi ý
        </h3>
        <ul
          style={{
            margin: 0,
            paddingLeft: "20px",
            fontSize: "13px",
            color: "#92400e",
            lineHeight: "1.8",
          }}
        >
          <li>Thường xuyên cập nhật tiến độ với giảng viên hướng dẫn</li>
          <li>Hoàn thành các mốc trước thời hạn để có thời gian dự phòng</li>
          <li>Lưu trữ và sao lưu tài liệu thường xuyên</li>
          <li>Liên hệ khoa nếu gặp khó khăn trong quá trình thực hiện</li>
        </ul>
      </div>
    </div>
  );
};

export default Progress;
