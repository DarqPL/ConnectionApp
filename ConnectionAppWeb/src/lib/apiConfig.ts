const trimEnv = (value: string | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeUrl = (value: string): string => {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  return withProtocol.replace(/\/+$/, "");
};

const normalizeApiBaseUrl = (value: string): string => {
  const withoutTrailingSlash = normalizeUrl(value);
  return withoutTrailingSlash.endsWith("/api")
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;
};

export const resolvePublicAppUrl = (): string | null => {
  const configuredPublicUrl = trimEnv(import.meta.env.VITE_PUBLIC_APP_URL);
  return configuredPublicUrl ? normalizeUrl(configuredPublicUrl) : null;
};

export const resolveShareAppUrl = (): string | null => {
  const configuredPublicUrl = resolvePublicAppUrl();
  if (configuredPublicUrl) {
    return configuredPublicUrl;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return normalizeUrl(window.location.origin);
};

export const buildGroupInviteUrl = (
  inviteToken?: string | null,
): string | null => {
  const appUrl = resolveShareAppUrl();
  const trimmedToken = inviteToken?.trim();

  if (!appUrl || !trimmedToken) {
    return null;
  }

  return `${appUrl}/groups/join/${encodeURIComponent(trimmedToken)}`;
};

export const resolveApiBaseUrl = (): string => {
  const configuredBaseUrl = trimEnv(import.meta.env.VITE_API_BASE_URL);
  if (configuredBaseUrl) {
    return normalizeApiBaseUrl(configuredBaseUrl);
  }

  const configuredHost = trimEnv(import.meta.env.VITE_DEV_SERVER_HOST);
  if (configuredHost) {
    return `http://${configuredHost}:8080/api`;
  }

  return import.meta.env.DEV ? "http://localhost:8080/api" : "/api";
};

export const getCallMediaEnvironmentWarning = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const suggestedPublicUrl = resolvePublicAppUrl();
  const secureTarget = suggestedPublicUrl
    ? `Hay mo app bang URL HTTPS forwarded cua web: ${suggestedPublicUrl}`
    : "Hay mo app bang URL HTTPS forwarded cua web";

  if (!window.isSecureContext) {
    return `Trinh duyet dang mo app trong insecure context (${window.location.origin}). ${secureTarget}.`;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return `Trinh duyet khong ho tro cap quyen microphone/camera o origin hien tai. ${secureTarget}.`;
  }

  return null;
};
