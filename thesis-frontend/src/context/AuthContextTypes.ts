import { createContext } from "react";
import type { User } from "../types/user";

export type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isSwitching?: boolean;
  switchProgress?: number;
  login: (user: User | null) => void;
  logout: () => void;
  switchRole: (role: string) => void;
};

const defaultState: AuthState = {
  user: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
  switchRole: () => {},
};

export const AuthContext = createContext<AuthState>(defaultState);
