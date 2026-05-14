import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchData, getAvatarUrl } from "../../api/fetchData";
import { useToast } from "../../context/useToast";
import { useAuth } from "../../hooks/useAuth";
import type { ApiResponse } from "../../types/api";
import type { LecturerProfile } from "../../types/lecturer-profile";
import type { Department } from "../../types/department";
import type { LecturerTag, Tag } from "../../types/tag";
import {
  ArrowLeft,
  User,
  Edit,
  Save,
  GraduationCap,
  Building,
  Users,
  BookOpen,
  AlertTriangle,
} from "lucide-react";

const LecturerProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { addToast } = useToast();
  const [profile, setProfile] = useState<LecturerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<LecturerProfile>>(
    {}
  );
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadLecturerProfile = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get lecturer profile list
      const listRes = await fetchData(
        `/LecturerProfiles/get-list?UserCode=${auth.user?.userCode}`
      );
      const listData = (listRes as ApiResponse<LecturerProfile[]>)?.data || [];

      if (listData.length > 0) {
        const lecturerCode = listData[0].lecturerCode;

        if (!lecturerCode) {
          setError("Không tìm thấy mã giảng viên trong dữ liệu");
          return;
        }

        // Get detailed profile - try but fallback to list data if fails
        let profileData = listData[0];
        try {
          const detailRes = await fetchData(
            `/LecturerProfiles/get-update/${lecturerCode}`
          );
          const detailData = (detailRes as ApiResponse<LecturerProfile>)?.data;

          if (detailData && Object.keys(detailData).length > 0) {
            profileData = detailData;
            // Preserve profileImage from list data if detail data doesn't have it
            if (!detailData.profileImage && listData[0].profileImage) {
              profileData = {
                ...detailData,
                profileImage: listData[0].profileImage,
              };
            }
          }
        } catch (detailErr) {
          console.error(
            "Error fetching detailed profile, using list data:",
            detailErr
          );
        }

        // Ensure lecturerCode is set
        profileData = { ...profileData, lecturerCode };

        setProfile(profileData);
        setEditedProfile(profileData);

        // Load departments
        const deptRes = await fetchData("/Departments/get-list");
        setDepartments((deptRes as ApiResponse<Department[]>)?.data || []);
      } else {
        setError("Không tìm thấy thông tin giảng viên");
      }
    } catch (err) {
      console.error("Error loading lecturer profile:", err);
      setError("Có lỗi xảy ra khi tải thông tin giảng viên");
    } finally {
      setLoading(false);
    }
  }, [auth.user?.userCode]);

  useEffect(() => {
    if (auth.user?.userCode) {
      loadLecturerProfile();
    }
  }, [loadLecturerProfile, auth.user?.userCode]);

  // Load tag names
  useEffect(() => {
    const loadTagNames = async () => {
      if (!profile?.lecturerCode) {
        return;
      }

      try {
        // Get lecturer tags
        const lecturerTagRes = await fetchData(
          `/LecturerTags/list?LecturerCode=${profile.lecturerCode}`
        );
        const lecturerTags =
          (lecturerTagRes as ApiResponse<LecturerTag[]>)?.data || [];

        if (lecturerTags.length === 0) {
          setTagNames([]);
          return;
        }

        // Get tag names for each tag code
        const tagNamesPromises = lecturerTags.map(async (lt) => {
          try {
            const tagRes = await fetchData(`/Tags/list?TagCode=${lt.tagCode}`);
            const tagData = (tagRes as ApiResponse<Tag[]>)?.data || [];
            return tagData.length > 0 ? tagData[0].tagName : lt.tagCode;
          } catch (err) {
            console.error(`Error loading tag ${lt.tagCode}:`, err);
            return lt.tagCode;
          }
        });

        const names = await Promise.all(tagNamesPromises);
        setTagNames(names);
      } catch (err) {
        console.error("Error loading tag names:", err);
        setTagNames([]);
      }
    };

    if (profile?.lecturerCode) {
      loadTagNames();
    }
  }, [profile?.lecturerCode]);

  const handleSubmit = async () => {
    if (!profile || !profile.lecturerCode) {
      setError("Không thể cập nhật: thiếu thông tin mã giảng viên");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const updatedProfile = { ...editedProfile };

      // If there's a selected file, upload it first
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);

        // Upload avatar
        await fetchData(
          `/LecturerProfiles/upload-avatar/${profile.lecturerCode}`,
          {
            method: "POST",
            body: formData,
          }
        );

        // Reload profile to get the new avatar URL
        await loadLecturerProfile();
      }

      // Save profile changes (exclude profileImage since it's handled by upload API)
      const profileDataToUpdate = { ...updatedProfile };
      delete profileDataToUpdate.profileImage;
      await fetchData(`/LecturerProfiles/update/${profile.lecturerCode}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileDataToUpdate),
      });

      // Reload profile again to get the latest data including any changes
      await loadLecturerProfile();

      setIsEditing(false);
      setSelectedFile(null);
      setImagePreview(null);
      addToast("Cập nhật thông tin thành công!", "success");
    } catch (err) {
      console.error("Error updating profile:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Có lỗi xảy ra khi cập nhật thông tin";
      setError(errorMessage);
      addToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile || {});
    setIsEditing(false);
    setImagePreview(null);
    setSelectedFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Kiểm tra loại file
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/bmp",
      ];
      if (!allowedTypes.includes(file.type)) {
        setError("Chỉ chấp nhận file ảnh (jpg, jpeg, png, gif, bmp)");
        return;
      }

      // Kiểm tra kích thước file (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Kích thước file không được vượt quá 5MB");
        return;
      }

      setSelectedFile(file);
      // Tạo preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const getDepartmentName = (departmentCode: string) => {
    const dept = departments.find((d) => d.departmentCode === departmentCode);
    return dept?.name || departmentCode;
  };

  if (loading && !profile) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "100px",
          gap: "16px",
          background: "linear-gradient(135deg, #002855 0%, #003d82 100%)",
          borderRadius: "16px",
          border: "1px solid #f37021",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            border: "3px solid #f37021",
            borderTop: "3px solid #ffffff",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <span style={{ color: "#ffffff", fontSize: "18px", fontWeight: "500" }}>
          ĐANG TẢI THÔNG TIN...
        </span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ padding: "32px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "20px",
            background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
            border: "1px solid #f37021",
            borderRadius: "12px",
          }}
        >
          <AlertTriangle size={20} color="#ffffff" />
          <span
            style={{ color: "#ffffff", fontSize: "16px", fontWeight: "500" }}
          >
            {error || "KHÔNG TÌM THẤY THÔNG TIN GIẢNG VIÊN"}
          </span>
        </div>
        <button
          onClick={() => navigate("/lecturer")}
          style={{
            marginTop: "20px",
            padding: "12px 24px",
            background: "linear-gradient(135deg, #002855 0%, #003d82 100%)",
            color: "white",
            border: "1px solid #f37021",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "500",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              "linear-gradient(135deg, #003d82 0%, #002855 100%)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              "linear-gradient(135deg, #002855 0%, #003d82 100%)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "32px",
        maxWidth: "1200px",
        margin: "0 auto",
        background: "#ffffff",
        minHeight: "100vh",
      }}
    >
      {/* Page Title and Action Buttons */}
      <div style={{ marginBottom: "32px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            onClick={() => navigate("/lecturer")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 20px",
              background: "linear-gradient(135deg, #002855 0%, #003d82 100%)",
              color: "white",
              border: "1px solid #f37021",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "linear-gradient(135deg, #003d82 0%, #002855 100%)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                "linear-gradient(135deg, #002855 0%, #003d82 100%)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <ArrowLeft size={18} />
            Quay lại
          </button>

          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: "700",
                color: "#002855",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
              }}
            >
              <User size={36} color="#f37021" />
              THÔNG TIN GIẢNG VIÊN
            </h1>
            <p
              style={{
                fontSize: "18px",
                color: "#003d82",
                margin: 0,
                fontWeight: "400",
              }}
            >
              QUẢN LÝ THÔNG TIN CÁ NHÂN
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <button
              onClick={() => (isEditing ? handleSubmit() : setIsEditing(true))}
              disabled={loading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 20px",
                background: isEditing
                  ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                  : "linear-gradient(135deg, #f37021 0%, #ea580c 100%)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                opacity: loading ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(243, 112, 33, 0.3)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }
              }}
            >
              {isEditing ? <Save size={16} /> : <Edit size={16} />}
              {isEditing ? "Lưu thay đổi" : "Chỉnh sửa"}
            </button>

            {isEditing && (
              <button
                onClick={handleCancel}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 20px",
                  background:
                    "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                Hủy
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: "32px",
          marginBottom: "32px",
        }}
      >
        {/* Profile Image & Basic Info - Left Column */}
        <div
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
            borderRadius: "16px",
            padding: "32px",
            border: "2px solid #f37021",
            textAlign: "center",
            height: "fit-content",
            boxShadow: "0 8px 32px rgba(0, 40, 85, 0.1)",
          }}
        >
          <div
            style={{
              width: "150px",
              height: "150px",
              borderRadius: "50%",
              margin: "0 auto 24px",
              overflow: "hidden",
              border: "4px solid #f37021",
              boxShadow: "0 4px 12px rgba(243, 112, 33, 0.3)",
            }}
          >
            {imagePreview || profile.profileImage ? (
              imagePreview ? (
                <img
                  src={imagePreview}
                  alt={profile.fullName}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <img
                  src={getAvatarUrl(profile.profileImage)}
                  alt={profile.fullName}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              )
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background:
                    "linear-gradient(135deg, #002855 0%, #003d82 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "48px",
                  fontWeight: "bold",
                }}
              >
                {profile.fullName.charAt(0)}
              </div>
            )}
          </div>

          <h2
            style={{
              fontSize: "24px",
              fontWeight: "600",
              color: "#002855",
              marginBottom: "8px",
            }}
          >
            {profile.fullName}
          </h2>
          <p
            style={{
              fontSize: "16px",
              color: "#f37021",
              marginBottom: "16px",
            }}
          >
            {profile.degree}
            <br></br>
            {getDepartmentName(profile.departmentCode)}
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "8px 16px",
              marginBottom: "16px",
              background:
                profile.currentGuidingCount < profile.guideQuota
                  ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                  : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              color: "white",
              borderRadius: "20px",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background:
                  profile.currentGuidingCount < profile.guideQuota
                    ? "#ffffff"
                    : "#ffffff",
              }}
            />
            {profile.currentGuidingCount}/{profile.guideQuota} đề tài đang hướng
            dẫn
          </div>

          {isEditing && (
            <div style={{ marginTop: "24px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "12px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#002855",
                }}
              >
                Tải ảnh đại diện
              </label>

              {/* Hidden file input */}
              <input
                id="lecturer-avatar-upload"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/bmp"
                onChange={handleFileChange}
                style={{
                  position: "absolute",
                  opacity: 0,
                  pointerEvents: "none",
                  width: "1px",
                  height: "1px",
                }}
              />

              {/* Custom upload button */}
              <label
                htmlFor="lecturer-avatar-upload"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "12px 20px",
                  background: "#f37021",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: "0 2px 8px rgba(243, 112, 33, 0.2)",
                  width: "100%",
                  textAlign: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#ea580c";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(243, 112, 33, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#f37021";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(243, 112, 33, 0.2)";
                }}
              >
                Chọn ảnh
              </label>

              <p
                style={{
                  fontSize: "12px",
                  color: "#6B7280",
                  marginTop: "8px",
                  textAlign: "center",
                }}
              >
                Chấp nhận: JPG, JPEG, PNG, GIF, BMP (tối đa 5MB)
              </p>
            </div>
          )}
        </div>

        {/* Personal Information - Right Column */}
        <div
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
            borderRadius: "16px",
            padding: "32px",
            border: "2px solid #f37021",
            boxShadow: "0 8px 32px rgba(0, 40, 85, 0.1)",
          }}
        >
          <h3
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#002855",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <User size={24} color="#f37021" />
            Thông tin cá nhân
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "20px",
            }}
          >
            {/* Full Name */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#002855",
                }}
              >
                Họ và tên *
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedProfile.fullName || ""}
                  onChange={(e) =>
                    setEditedProfile({
                      ...editedProfile,
                      fullName: e.target.value,
                    })
                  }
                  required
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "2px solid #f37021",
                    borderRadius: "8px",
                    fontSize: "14px",
                    background: "#FFFFFF",
                    boxShadow: "0 2px 4px rgba(243, 112, 33, 0.1)",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: "12px",
                    background: "#F9FAFB",
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: "#111827",
                  }}
                >
                  {profile.fullName}
                </div>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#002855",
                }}
              >
                Email *
              </label>
              {isEditing ? (
                <input
                  type="email"
                  value={editedProfile.email || ""}
                  onChange={(e) =>
                    setEditedProfile({
                      ...editedProfile,
                      email: e.target.value,
                    })
                  }
                  required
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "2px solid #f37021",
                    borderRadius: "8px",
                    fontSize: "14px",
                    background: "#FFFFFF",
                    boxShadow: "0 2px 4px rgba(243, 112, 33, 0.1)",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: "12px",
                    background: "#F9FAFB",
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: "#111827",
                  }}
                >
                  {profile.email}
                </div>
              )}
            </div>

            {/* Phone Number */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#002855",
                }}
              >
                Số điện thoại
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={editedProfile.phoneNumber || ""}
                  onChange={(e) =>
                    setEditedProfile({
                      ...editedProfile,
                      phoneNumber: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "2px solid #f37021",
                    borderRadius: "8px",
                    fontSize: "14px",
                    background: "#FFFFFF",
                    boxShadow: "0 2px 4px rgba(243, 112, 33, 0.1)",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: "12px",
                    background: "#F9FAFB",
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: "#111827",
                  }}
                >
                  {profile.phoneNumber || "Chưa cập nhật"}
                </div>
              )}
            </div>

            {/* Gender */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#002855",
                }}
              >
                Giới tính
              </label>
              {isEditing ? (
                <select
                  value={editedProfile.gender || ""}
                  onChange={(e) =>
                    setEditedProfile({
                      ...editedProfile,
                      gender: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "2px solid #f37021",
                    borderRadius: "8px",
                    fontSize: "14px",
                    background: "#FFFFFF",
                    boxShadow: "0 2px 4px rgba(243, 112, 33, 0.1)",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                >
                  <option value="">Chọn giới tính</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              ) : (
                <div
                  style={{
                    padding: "12px",
                    background: "#F9FAFB",
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: "#111827",
                  }}
                >
                  {profile.gender || "Chưa cập nhật"}
                </div>
              )}
            </div>

            {/* Date of Birth */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#002855",
                }}
              >
                Ngày sinh
              </label>
              {isEditing ? (
                <input
                  type="date"
                  value={
                    editedProfile.dateOfBirth
                      ? new Date(editedProfile.dateOfBirth)
                          .toISOString()
                          .split("T")[0]
                      : ""
                  }
                  onChange={(e) =>
                    setEditedProfile({
                      ...editedProfile,
                      dateOfBirth: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "2px solid #f37021",
                    borderRadius: "8px",
                    fontSize: "14px",
                    background: "#FFFFFF",
                    boxShadow: "0 2px 4px rgba(243, 112, 33, 0.1)",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: "12px",
                    background: "#F9FAFB",
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: "#111827",
                  }}
                >
                  {profile.dateOfBirth
                    ? new Date(profile.dateOfBirth).toLocaleDateString("vi-VN")
                    : "Chưa cập nhật"}
                </div>
              )}
            </div>

            {/* Address */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#002855",
                }}
              >
                Địa chỉ
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedProfile.address || ""}
                  onChange={(e) =>
                    setEditedProfile({
                      ...editedProfile,
                      address: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "2px solid #f37021",
                    borderRadius: "8px",
                    fontSize: "14px",
                    background: "#FFFFFF",
                    boxShadow: "0 2px 4px rgba(243, 112, 33, 0.1)",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: "12px",
                    background: "#F9FAFB",
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: "#111827",
                  }}
                >
                  {profile.address || "Chưa cập nhật"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Academic Information - Full Width Below */}
      <div
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          borderRadius: "16px",
          padding: "32px",
          border: "2px solid #f37021",
          boxShadow: "0 8px 32px rgba(0, 40, 85, 0.1)",
        }}
      >
        <h3
          style={{
            fontSize: "20px",
            fontWeight: "600",
            color: "#002855",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <GraduationCap size={24} color="#f37021" />
          Thông tin công tác
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "20px",
          }}
        >
          {/* Department */}
          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "500",
                color: "#002855",
              }}
            >
              <Building size={16} color="#f37021" />
              Khoa
            </label>
            <div
              style={{
                padding: "12px",
                background: "#F9FAFB",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#111827",
              }}
            >
              {getDepartmentName(profile.departmentCode)}
            </div>
          </div>

          {/* Degree */}
          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "500",
                color: "#002855",
              }}
            >
              <GraduationCap size={16} color="#f37021" />
              Học vị
            </label>
            <div
              style={{
                padding: "12px",
                background: "#F9FAFB",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#111827",
              }}
            >
              {profile.degree}
            </div>
          </div>

          {/* Guide Quota */}
          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "500",
                color: "#002855",
              }}
            >
              <Users size={16} color="#f37021" />
              Hạn mức hướng dẫn
            </label>
            <div
              style={{
                padding: "12px",
                background: "#F9FAFB",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#111827",
              }}
            >
              {profile.guideQuota} đề tài
            </div>
          </div>

          {/* Defense Quota */}
          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "500",
                color: "#002855",
              }}
            >
              <BookOpen size={16} color="#f37021" />
              Hạn mức phản biện
            </label>
            <div
              style={{
                padding: "12px",
                background: "#F9FAFB",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#111827",
              }}
            >
              {profile.defenseQuota} đề tài
            </div>
          </div>

          {/* Current Guiding Count */}
          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "500",
                color: "#002855",
              }}
            >
              <Users size={16} color="#f37021" />
              Đang hướng dẫn
            </label>
            <div
              style={{
                padding: "12px",
                background: "#F9FAFB",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#111827",
              }}
            >
              {profile.currentGuidingCount} đề tài
            </div>
          </div>

          {/* Specialties */}
          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "500",
                color: "#002855",
              }}
            >
              <BookOpen size={16} color="#f37021" />
              Chuyên ngành
            </label>
            <div
              style={{
                padding: "12px",
                background: "#F9FAFB",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#111827",
              }}
            >
              {tagNames.length > 0 ? tagNames.join(", ") : "Chưa có thẻ"}
            </div>
          </div>
        </div>

        {profile.notes && (
          <div style={{ marginTop: "24px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "500",
                color: "#002855",
              }}
            >
              Ghi chú
            </label>
            {isEditing ? (
              <textarea
                value={editedProfile.notes || ""}
                onChange={(e) =>
                  setEditedProfile({
                    ...editedProfile,
                    notes: e.target.value,
                  })
                }
                rows={4}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "2px solid #f37021",
                  borderRadius: "8px",
                  fontSize: "14px",
                  background: "#FFFFFF",
                  boxShadow: "0 2px 4px rgba(243, 112, 33, 0.1)",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  resize: "vertical",
                }}
              />
            ) : (
              <div
                style={{
                  padding: "12px",
                  background: "#F9FAFB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: "#111827",
                  lineHeight: "1.5",
                }}
              >
                {profile.notes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LecturerProfilePage;
