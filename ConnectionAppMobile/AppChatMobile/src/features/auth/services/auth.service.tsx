import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

const ACCESS_TOKEN_KEY = "accessToken";
const API_BASE_URL_KEY = "apiBaseUrl";
const DEV_SERVER_HOST_ENV_KEY = "EXPO_PUBLIC_DEV_SERVER_HOST";
const API_BASE_URL_ENV_KEY = "EXPO_PUBLIC_API_BASE_URL";
const USE_FORWARDED_API_ENV_KEY = "EXPO_PUBLIC_USE_FORWARDED_API";
const FORWARDED_API_BASE_URL_ENV_KEY = "EXPO_PUBLIC_FORWARDED_API_BASE_URL";

const getExpoEnv = (key: string): string | null => {
  const processValue = (globalThis as any)?.process?.env?.[key];
  if (typeof processValue === "string" && processValue.trim().length > 0) {
    return processValue.trim();
  }

  const extra = Constants.expoConfig?.extra as
    | Record<string, unknown>
    | undefined;
  const extraValue = extra?.[key] ?? extra?.[key.replace(/^EXPO_PUBLIC_/, "")];
  if (typeof extraValue === "string" && extraValue.trim().length > 0) {
    return extraValue.trim();
  }

  return null;
};

const normalizeApiBaseUrl = (url: string): string => {
  const compact = url.trim().replace(/\s+/g, "");

  if (!compact) {
    throw new Error("URL backend khong hop le");
  }

  const withProtocol = /^https?:\/\//i.test(compact)
    ? compact
    : `http://${compact}`;
  const withoutTrailingSlash = withProtocol.replace(/\/+$/, "");
  const withApiPath = withoutTrailingSlash.endsWith("/api")
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;

  let parsed: URL;
  try {
    parsed = new URL(withApiPath);
  } catch {
    throw new Error("URL backend khong hop le");
  }

  if (!parsed.hostname) {
    throw new Error("URL backend khong hop le");
  }

  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
};

const parseBooleanEnv = (value: string | null): boolean => {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

const shouldUseForwardedApi = (): boolean =>
  parseBooleanEnv(getExpoEnv(USE_FORWARDED_API_ENV_KEY));

const getConfiguredForwardedApiBaseUrl = (): string | null => {
  const value = getExpoEnv(FORWARDED_API_BASE_URL_ENV_KEY);
  if (!value) {
    return null;
  }

  try {
    return normalizeApiBaseUrl(value);
  } catch {
    return null;
  }
};

const getConfiguredLanApiBaseUrl = (): string | null => {
  const value = getExpoEnv(API_BASE_URL_ENV_KEY);
  if (!value) {
    return null;
  }

  try {
    return normalizeApiBaseUrl(value);
  } catch {
    return null;
  }
};

const migrateLegacyPort = (url: string): string =>
  url.replace(":8082", ":8080");

const isLocalhostHost = (host: string): boolean => {
  const normalized = host.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1";
};

const isPrivateIpv4 = (host: string): boolean => {
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = host.match(ipv4Pattern);
  if (!match) return false;

  const octets = match.slice(1).map(Number);
  if (octets.some((value) => value < 0 || value > 255)) return false;

  const [first, second] = octets;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
};

const getExpoDebugHost = (): string | null => {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ??
    (Constants as any)?.manifest?.debuggerHost ??
    null;

  if (!hostUri || typeof hostUri !== "string") {
    return null;
  }

  return hostUri.split(":")[0] || null;
};

const isTunnelHost = (host: string): boolean => {
  const lower = host.toLowerCase();
  return (
    lower.includes("exp.direct") ||
    lower.includes("ngrok") ||
    lower.includes("trycloudflare") ||
    lower.includes("devtunnels.ms")
  );
};

const getConfiguredDevServerHost = (): string | null => {
  const host = getExpoEnv(DEV_SERVER_HOST_ENV_KEY);
  if (!host || isLocalhostHost(host)) {
    return null;
  }

  return host;
};

const getPreferredLanHost = (): string | null => {
  const configuredHost = getConfiguredDevServerHost();
  if (configuredHost) {
    return configuredHost;
  }

  const expoHost = getExpoDebugHost();
  if (expoHost && !isLocalhostHost(expoHost) && !isTunnelHost(expoHost)) {
    return expoHost;
  }

  return null;
};

const buildLanApiBaseUrl = (host: string): string => `http://${host}:8080/api`;

const getSuggestedLanApiBaseUrl = (): string | null => {
  const preferredHost = getPreferredLanHost();
  return preferredHost ? buildLanApiBaseUrl(preferredHost) : null;
};

const isLikelyAndroidEmulatorBaseUrl = (baseUrl: string): boolean => {
  try {
    return new URL(baseUrl).hostname === "10.0.2.2";
  } catch {
    return false;
  }
};

export const getDevRuntimeConnectionWarning = (
  baseUrl: string,
): string | null => {
  if (shouldUseForwardedApi() && !getConfiguredForwardedApiBaseUrl()) {
    return "Dang bat EXPO_PUBLIC_USE_FORWARDED_API=true nhung chua dat EXPO_PUBLIC_FORWARDED_API_BASE_URL hop le.";
  }

  if (!__DEV__) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return null;
  }

  if (!isLocalhostHost(parsed.hostname)) {
    return null;
  }

  if (Platform.OS === "android") {
    const suggestedLanBaseUrl = getSuggestedLanApiBaseUrl();
    if (suggestedLanBaseUrl) {
      return `Android development build khong the dung localhost. Hay chay Metro bang LAN va dat backend ve ${suggestedLanBaseUrl}, hoac bat forwarded backend URL trong VS Code.`;
    }

    return "Android development build khong the dung localhost. Hay dat EXPO_PUBLIC_DEV_SERVER_HOST hoac EXPO_PUBLIC_API_BASE_URL theo IP LAN cua may dev, hoac dung EXPO_PUBLIC_FORWARDED_API_BASE_URL.";
  }

  return null;
};

const getDefaultApiBaseUrl = (): string => {
  const forwardedBaseUrl = getConfiguredForwardedApiBaseUrl();
  if (shouldUseForwardedApi() && forwardedBaseUrl) {
    return forwardedBaseUrl;
  }

  const envBaseUrl = getConfiguredLanApiBaseUrl();
  if (envBaseUrl) {
    return envBaseUrl;
  }

  const preferredLanHost = getPreferredLanHost();
  if (preferredLanHost) {
    return buildLanApiBaseUrl(preferredLanHost);
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:8080/api";
  }

  return "http://localhost:8080/api";
};

const syncApiBaseUrlWithCurrentLanHost = (baseUrl: string): string => {
  if (shouldUseForwardedApi()) {
    const forwardedBaseUrl = getConfiguredForwardedApiBaseUrl();
    if (forwardedBaseUrl) {
      return forwardedBaseUrl;
    }
  }

  const suggestedLanBaseUrl = getSuggestedLanApiBaseUrl();
  if (!suggestedLanBaseUrl) {
    return baseUrl;
  }

  const expoHost = new URL(suggestedLanBaseUrl).hostname;
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return baseUrl;
  }

  if (parsed.hostname === expoHost) {
    return baseUrl;
  }

  if (isLocalhostHost(parsed.hostname)) {
    parsed.hostname = expoHost;
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  }

  if (!isPrivateIpv4(parsed.hostname)) {
    return baseUrl;
  }

  parsed.hostname = expoHost;
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
};

export interface User {
  id: number;
  username: string;
  displayName: string;
  email: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  gender?: string;
  role: string;
  status: string;
}

export class AuthApiError extends Error {
  code?: string;
  status?: number;
  remainingMinutes?: number;
  lockUntil?: string;

  constructor(
    message: string,
    code?: string,
    status?: number,
    remainingMinutes?: number,
    lockUntil?: string,
  ) {
    super(message);
    this.name = "AuthApiError";
    this.code = code;
    this.status = status;
    this.remainingMinutes = remainingMinutes;
    this.lockUntil = lockUntil;
  }
}

interface SignInResponse {
  accessToken: string;
}

export class AuthService {
  private accessToken: string | null = null;
  private apiBaseUrl: string = getDefaultApiBaseUrl();
  private unauthorizedHandler: (() => void) | null = null;

  setUnauthorizedHandler(handler: (() => void) | null): void {
    this.unauthorizedHandler = handler;
  }

  private buildUrl(path: string): string {
    return `${this.apiBaseUrl}${path}`;
  }

  getDevRuntimeConnectionWarning(): string | null {
    return getDevRuntimeConnectionWarning(this.apiBaseUrl);
  }

  private async safeFetch(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        credentials: "include",
      });
    } catch {
      const warning = this.getDevRuntimeConnectionWarning();
      throw new Error(
        warning
          ? `Khong the ket noi backend tai ${this.apiBaseUrl}. ${warning}`
          : `Khong the ket noi backend tai ${this.apiBaseUrl}.`,
      );
    }
  }

  private async parseError(
    response: Response,
    fallback: string,
  ): Promise<Error> {
    try {
      const data = await response.json();
      const code = data?.code;
      const remainingMinutes = Number(data?.remainingMinutes);
      const lockUntil = data?.lockUntil;
      let message = data?.message || data?.error || fallback;

      if (code === "ACCOUNT_TEMP_LOCKED" && remainingMinutes > 0) {
        message = `${message}. Con ${remainingMinutes} phut de go khoa.`;
      }

      return new AuthApiError(
        message,
        code,
        response.status,
        Number.isFinite(remainingMinutes) ? remainingMinutes : undefined,
        lockUntil,
      );
    } catch {
      return new AuthApiError(fallback, undefined, response.status);
    }
  }

  async initializeSession(): Promise<string | null> {
    const preferredEnvBaseUrl = getDefaultApiBaseUrl();
    const storedBaseUrl = await AsyncStorage.getItem(API_BASE_URL_KEY);
    if (storedBaseUrl) {
      try {
        const migrated = migrateLegacyPort(storedBaseUrl);
        const normalized = normalizeApiBaseUrl(migrated);
        this.apiBaseUrl = syncApiBaseUrlWithCurrentLanHost(normalized);

        if (this.apiBaseUrl !== preferredEnvBaseUrl) {
          this.apiBaseUrl = preferredEnvBaseUrl;
        }

        const warning = getDevRuntimeConnectionWarning(this.apiBaseUrl);
        if (
          warning &&
          Platform.OS === "android" &&
          !isLikelyAndroidEmulatorBaseUrl(this.apiBaseUrl) &&
          !shouldUseForwardedApi()
        ) {
          const suggestedLanBaseUrl = getSuggestedLanApiBaseUrl();
          if (suggestedLanBaseUrl) {
            this.apiBaseUrl = suggestedLanBaseUrl;
          }
        }

        if (
          migrated !== storedBaseUrl ||
          this.apiBaseUrl !== storedBaseUrl ||
          this.apiBaseUrl !== normalized
        ) {
          await AsyncStorage.setItem(API_BASE_URL_KEY, this.apiBaseUrl);
        }
      } catch {
        this.apiBaseUrl = preferredEnvBaseUrl;
        await AsyncStorage.setItem(API_BASE_URL_KEY, this.apiBaseUrl);
      }
    } else {
      this.apiBaseUrl = preferredEnvBaseUrl;
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
    this.apiBaseUrl = syncApiBaseUrlWithCurrentLanHost(normalized);
    await AsyncStorage.setItem(API_BASE_URL_KEY, this.apiBaseUrl);
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

  async sendSignupOtp(username: string, email: string): Promise<void> {
    const response = await this.safeFetch(
      this.buildUrl("/auth/signup/send-otp"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email }),
      },
    );

    if (!response.ok) {
      throw await this.parseError(response, "Khong the gui ma OTP");
    }
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
      throw await this.parseError(response, "Dang ky that bai");
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const response = await this.safeFetch(
      this.buildUrl("/auth/forgot-password"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      },
    );

    if (!response.ok) {
      throw await this.parseError(
        response,
        "Khong the gui yeu cau quen mat khau",
      );
    }
  }

  async verifyOtp(email: string, otp: string): Promise<void> {
    const response = await this.safeFetch(this.buildUrl("/auth/verify-otp"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, otp }),
    });

    if (!response.ok) {
      throw await this.parseError(response, "Ma OTP khong hop le");
    }
  }

  async resetPassword(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<void> {
    const response = await this.safeFetch(
      this.buildUrl("/auth/reset-password"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, otp, newPassword }),
      },
    );

    if (!response.ok) {
      throw await this.parseError(response, "Dat lai mat khau that bai");
    }
  }

  async changePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const params = new URLSearchParams({
      oldPassword,
      newPassword,
    });

    const response = await this.authFetch(
      `/users/change-password?${params.toString()}`,
      { method: "POST" },
    );

    if (!response.ok) {
      throw await this.parseError(response, "Doi mat khau that bai");
    }
  }

  async requestDeleteOtp(): Promise<void> {
    const response = await this.authFetch("/users/delete/request-otp", {
      method: "POST",
    });

    if (!response.ok) {
      throw await this.parseError(response, "Khong the gui ma OTP");
    }
  }

  async confirmDeleteAccount(otp: string): Promise<void> {
    const params = new URLSearchParams({ otp });
    const response = await this.authFetch(
      `/users/delete/confirm?${params.toString()}`,
      {
        method: "POST",
      },
    );

    if (!response.ok) {
      throw await this.parseError(
        response,
        "Ma OTP khong chinh xac hoac da het han",
      );
    }
  }

  async deleteAccount(userId: number): Promise<void> {
    const response = await this.authFetch(`/users/${userId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw await this.parseError(response, "Xoá tài khoản thất bại");
    }
  }

  async lockAccount(userId: number): Promise<void> {
    const response = await this.authFetch(`/users/${userId}/lock`, {
      method: "POST",
    });

    if (!response.ok) {
      throw await this.parseError(response, "Khoá tài khoản thất bại");
    }
  }

  async requestManualUnlockOtp(
    usernameOrEmail: string,
    email: string,
  ): Promise<void> {
    const response = await this.safeFetch(
      this.buildUrl("/auth/manual-lock/request-otp"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ usernameOrEmail, email }),
      },
    );

    if (!response.ok) {
      throw await this.parseError(response, "Không thể gửi mã OTP");
    }
  }

  async verifyManualUnlockOtp(
    usernameOrEmail: string,
    email: string,
    otp: string,
  ): Promise<void> {
    const response = await this.safeFetch(
      this.buildUrl("/auth/manual-lock/verify-otp"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ usernameOrEmail, email, otp }),
      },
    );

    if (!response.ok) {
      throw await this.parseError(response, "Mã OTP không hợp lệ");
    }
  }

  async signIn(username: string, password: string): Promise<void> {
    const response = await this.safeFetch(this.buildUrl("/auth/signin"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password, platform: "MOBILE" }),
    });

    if (!response.ok) {
      throw await this.parseError(response, "Dang nhap that bai");
    }

    const data = (await response.json()) as SignInResponse;
    await this.setAccessToken(data.accessToken);
  }

  async fetchMe(): Promise<User> {
    const response = await this.authFetch("/users/profile", { method: "GET" });
    if (!response.ok) {
      throw await this.parseError(response, "Khong tai duoc ho so nguoi dung");
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
      throw await this.parseError(response, "Phien dang nhap da het han");
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
    const isFormData =
      init.body instanceof FormData ||
      (init.body !== null &&
        typeof init.body === "object" &&
        typeof (init.body as any).append === "function");

    console.log(`[AuthService] authFetch(${path}) - isFormData:`, isFormData);
    console.log(`[AuthService] body type:`, typeof init.body);
    if (init.body && typeof init.body === "object") {
      console.log(
        `[AuthService] body instanceof FormData:`,
        init.body instanceof FormData,
      );
      console.log(
        `[AuthService] body.append fn:`,
        typeof (init.body as any).append,
      );
    }

    let requestInit: RequestInit;

    if (isFormData) {
      requestInit = {
        ...init,
        headers: {
          ...(this.accessToken
            ? { Authorization: `Bearer ${this.accessToken}` }
            : {}),
          Accept: "application/json",
        },
      };
      console.log("[AuthService] Using FormData headers with auth token");
    } else {
      const headers = new Headers(init.headers ?? {});
      if (this.accessToken) {
        headers.set("Authorization", `Bearer ${this.accessToken}`);
      }
      headers.set("Accept", "application/json");
      requestInit = { ...init, headers };
      console.log("[AuthService] Using regular headers");
    }

    const response = await this.safeFetch(this.buildUrl(path), requestInit);

    if (response.status === 401 && !retried) {
      try {
        await this.refreshAccessToken();
        return this.authFetch(path, init, true);
      } catch {
        await this.setAccessToken(null);
        this.unauthorizedHandler?.();
      }
    }

    if (response.status === 401) {
      await this.setAccessToken(null);
      this.unauthorizedHandler?.();
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
