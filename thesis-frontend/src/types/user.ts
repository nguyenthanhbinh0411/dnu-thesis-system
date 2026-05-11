export type Role = "STUDENT" | "LECTURER" | "ADMIN" | "STUDENTSERVICE" | string;

export interface User {
  userID?: number;
  userCode?: string;
  username?: string;
  fullName?: string;
  email?: string;
  role?: Role;
  roles?: Role[];
  activeRole?: Role;
  topicCode?: string;
  createdAt?: string;
  lastUpdated?: string;
  // có thể có thêm các field khác từ API
}
