import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

const ACCESS_TOKEN_KEY = "accessToken";
const API_BASE_URL_KEY = "apiBaseUrl";

const normalizeApiBaseUrl = (url: string): string => {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
};

const migrateLegacyPort = (url: string): string => {
  return url.replace(":8082", ":8080");
};

const getExpoDebugHost = (): string | null => {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ??
    (Constants as any)?.manifest?.debuggerHost ??
    null;

  if (!hostUri || typeof hostUri !== "string") return null;
  return hostUri.split(":")[0] || null;
};

const isTunnelHost = (host: string): boolean => {
  const lower = host.toLowerCase();
  return (
    lower.includes("exp.direct") ||
    lower.includes("ngrok") ||
    lower.includes("trycloudflare")
  );
};

const getDefaultApiBaseUrl = (): string => {
  const expoHost = getExpoDebugHost();

  if (
    expoHost &&
    expoHost !== "localhost" &&
    expoHost !== "127.0.0.1" &&
    !isTunnelHost(expoHost)
  ) {
    return `http://${expoHost}:8080/api`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:8080/api";
  }

  return "http://localhost:8080/api";
};

export interface User {
  id: number;
  username: string;
  displayName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  gender?: string;
  role: string;
  status: string;
}

interface SignInResponse {
  accessToken: string;
}

export class AuthService {
  private accessToken: string | null = null;
  private apiBaseUrl: string = getDefaultApiBaseUrl();

  private buildUrl(path: string): string {
    return `${this.apiBaseUrl}${path}`;
  }

  private async safeFetch(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        credentials: "include",
      });
    } catch {
      throw new Error(`Không thể kết nối backend tại ${this.apiBaseUrl}.`);
    }
  }

  private async parseError(
    response: Response,
    fallback: string,
  ): Promise<Error> {
    try {
      const data = await response.json();
      const message = data?.message || data?.error || fallback;
      return new Error(message);
    } catch {
      return new Error(fallback);
    }
  }

  async initializeSession(): Promise<string | null> {
    const storedBaseUrl = await AsyncStorage.getItem(API_BASE_URL_KEY);
    if (storedBaseUrl) {
      const migrated = migrateLegacyPort(storedBaseUrl);
      this.apiBaseUrl = normalizeApiBaseUrl(migrated);
      if (migrated !== storedBaseUrl) {
        await AsyncStorage.setItem(API_BASE_URL_KEY, this.apiBaseUrl);
      }
    } else {
      await AsyncStorage.setItem(API_BASE_URL_KEY, this.apiBaseUrl);
    }

    const stored = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    this.accessToken = stored;
    return stored;
  }

  getApiBaseUrl(): string {
    return this.apiBaseUrl;
  }

  async setApiBaseUrl(url: string): Promise<void> {
    const normalized = normalizeApiBaseUrl(url);
    this.apiBaseUrl = normalized;
    await AsyncStorage.setItem(API_BASE_URL_KEY, normalized);
  }

  getWebSocketUrl(): string {
    const root = this.apiBaseUrl.replace(/\/api$/, "");
    return `${root.replace(/^http/i, "ws")}/ws-native`;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  private async setAccessToken(token: string | null): Promise<void> {
    this.accessToken = token;
    if (token) {
      await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);
      return;
    }
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  async signUp(
    firstName: string,
    lastName: string,
    username: string,
    email: string,
    password: string,
  ): Promise<void> {
    const response = await this.safeFetch(this.buildUrl("/auth/signup"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName,
        lastName,
        username,
        email,
        password,
      }),
    });

    if (!response.ok) {
      throw await this.parseError(response, "Đăng ký thất bại");
    }
  }

  async signIn(username: string, password: string): Promise<void> {
    const response = await this.safeFetch(this.buildUrl("/auth/signin"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw await this.parseError(response, "Đăng nhập thất bại");
    }

    const data = (await response.json()) as SignInResponse;
    await this.setAccessToken(data.accessToken);
  }

  async fetchMe(): Promise<User> {
    const response = await this.authFetch("/users/profile", { method: "GET" });
    if (!response.ok) {
      throw await this.parseError(response, "Không tải được hồ sơ người dùng");
    }
    return (await response.json()) as User;
  }

  async refreshAccessToken(): Promise<string> {
    const response = await this.safeFetch(this.buildUrl("/auth/refresh"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw await this.parseError(response, "Phiên đăng nhập đã hết hạn");
    }

    const data = (await response.json()) as SignInResponse;
    await this.setAccessToken(data.accessToken);
    return data.accessToken;
  }

  async authFetch(
    path: string,
    init: RequestInit = {},
    retried = false,
  ): Promise<Response> {
    const headers = new Headers(init.headers ?? {});

    if (this.accessToken) {
      headers.set("Authorization", `Bearer ${this.accessToken}`);
    }

    const response = await this.safeFetch(this.buildUrl(path), {
      ...init,
      headers,
    });

    if (response.status === 401 && !retried) {
      try {
        await this.refreshAccessToken();
        return this.authFetch(path, init, true);
      } catch {
        await this.setAccessToken(null);
      }
    }

    return response;
  }

  async signOut(): Promise<void> {
    try {
      await this.authFetch("/auth/logout", { method: "POST" }, true);
    } finally {
      await this.setAccessToken(null);
    }
  }
}

export const authService = new AuthService();
