const TOKEN_KEY = "auth_token";

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getToken().length > 0;
}

export function redirectToLogin(): void {
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}
