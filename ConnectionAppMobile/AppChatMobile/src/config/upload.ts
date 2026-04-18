import Constants from "expo-constants";

const DEFAULT_MAX_UPLOAD_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const parsePositiveInt = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const expoPublicEnvValue = parsePositiveInt(
  (globalThis as any)?.process?.env?.EXPO_PUBLIC_MAX_UPLOAD_FILE_SIZE_BYTES,
);

const appConfigExtra =
  (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ?? {};
const appConfigValue = parsePositiveInt(
  appConfigExtra.maxUploadFileSizeBytes != null
    ? String(appConfigExtra.maxUploadFileSizeBytes)
    : undefined,
);

export const MAX_UPLOAD_FILE_SIZE_BYTES =
  expoPublicEnvValue ?? appConfigValue ?? DEFAULT_MAX_UPLOAD_FILE_SIZE_BYTES;

export const MAX_UPLOAD_FILE_SIZE_LABEL = formatBytes(
  MAX_UPLOAD_FILE_SIZE_BYTES,
);
