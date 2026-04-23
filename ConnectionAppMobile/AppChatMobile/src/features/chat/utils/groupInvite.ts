import Constants from "expo-constants";

const WEB_APP_URL_ENV_KEY = "EXPO_PUBLIC_WEB_APP_URL";

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

const normalizeUrl = (value: string): string => {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  return withProtocol.replace(/\/+$/, "");
};

const resolveMobileWebAppOrigin = (apiBaseUrl?: string | null): string | null => {
  const configuredWebUrl = getExpoEnv(WEB_APP_URL_ENV_KEY);
  if (configuredWebUrl) {
    return normalizeUrl(configuredWebUrl);
  }

  if (!apiBaseUrl) {
    return null;
  }

  try {
    const parsed = new URL(apiBaseUrl);
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";

    if (parsed.port === "8080") {
      parsed.port = "5173";
    }

    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
};

export const buildMobileGroupInviteUrl = (
  inviteToken?: string | null,
  apiBaseUrl?: string | null,
): string | null => {
  const trimmedToken = inviteToken?.trim();
  if (!trimmedToken) {
    return null;
  }

  const origin = resolveMobileWebAppOrigin(apiBaseUrl);
  if (!origin) {
    return null;
  }

  return `${origin}/groups/join/${encodeURIComponent(trimmedToken)}`;
};

export const extractInviteTokenFromGroupLink = (
  rawValue: string,
): string | null => {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const groupsIndex = segments.findIndex((segment) => segment === "groups");
    if (groupsIndex === -1 || segments[groupsIndex + 1] !== "join") {
      return null;
    }

    const inviteToken = segments[groupsIndex + 2];
    return inviteToken ? decodeURIComponent(inviteToken) : null;
  } catch {
    return null;
  }
};
