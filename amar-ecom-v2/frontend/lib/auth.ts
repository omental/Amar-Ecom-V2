export type AuthUser = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

const TOKEN_KEY = "amar_token";
const USER_KEY = "amar_user";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function saveToken(token: string) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export function saveUser(user: AuthUser) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): AuthUser | null {
  if (!canUseStorage()) return null;

  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearUser() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(USER_KEY);
}

export function logout() {
  clearToken();
  clearUser();
}

export function isAuthenticated() {
  return Boolean(getToken());
}
