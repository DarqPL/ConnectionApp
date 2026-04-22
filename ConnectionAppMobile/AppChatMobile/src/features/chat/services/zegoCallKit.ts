import Constants from "expo-constants";
import type { User } from "../../auth/services/auth.service";

type ZegoCallServiceModule = {
  init: (
    appId: number,
    appSign: string,
    userId: string,
    userName: string,
    plugins: unknown[],
    config: Record<string, unknown>,
  ) => Promise<void>;
  uninit: () => void;
  useSystemCallingUI: (plugins: unknown[]) => void;
};

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

const parseAppId = (rawValue: string | null): number | null => {
  if (!rawValue) {
    return null;
  }

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const readCallKitAppId = (): number | null =>
  parseAppId(getExpoEnv("EXPO_PUBLIC_ZEGO_APP_ID"));

const readCallKitAppSign = (): string | null =>
  getExpoEnv("EXPO_PUBLIC_ZEGO_APP_SIGN");

let currentInitKey: string | null = null;
let currentInitPromise: Promise<void> | null = null;
let systemUiConfigured = false;
let loadedService: ZegoCallServiceModule | null = null;
let loadedPlugins: unknown[] | null = null;

const buildDisplayName = (user: User): string => {
  const preferredName = user.displayName?.trim() || user.username?.trim();
  return preferredName && preferredName.length > 0
    ? preferredName
    : `user_${user.id}`;
};

export const isZegoCallKitConfigured = (): boolean =>
  readCallKitAppId() != null && Boolean(readCallKitAppSign());

const isExpoGoRuntime = (): boolean => {
  const executionEnvironment = (Constants as any).executionEnvironment;
  const appOwnership = (Constants as any).appOwnership;
  return executionEnvironment === "storeClient" || appOwnership === "expo";
};

export const isZegoRuntimeAvailable = (): boolean => !isExpoGoRuntime();

const loadZegoDependencies = async (): Promise<{
  service: ZegoCallServiceModule;
  plugins: unknown[];
}> => {
  if (loadedService && loadedPlugins) {
    return {
      service: loadedService,
      plugins: loadedPlugins,
    };
  }

  const serviceModule = await import("@zegocloud/zego-uikit-prebuilt-call-rn");
  const zimModule = await import("zego-zim-react-native");
  const zpnsModule = await import("zego-zpns-react-native");

  const service = ((serviceModule as any).default ??
    serviceModule) as ZegoCallServiceModule;
  const zim = ((zimModule as any).default ?? zimModule) as unknown;
  const zpns = ((zpnsModule as any).default ?? zpnsModule) as unknown;

  loadedService = service;
  loadedPlugins = [zim, zpns];

  return {
    service,
    plugins: loadedPlugins,
  };
};

export const initZegoCallKit = (user: User): Promise<void> => {
  if (!isZegoRuntimeAvailable()) {
    return Promise.resolve();
  }

  const appId = readCallKitAppId();
  const appSign = readCallKitAppSign();

  if (!appId || !appSign) {
    return Promise.reject(
      new Error("Thieu cau hinh ZEGO_APP_ID hoac ZEGO_APP_SIGN"),
    );
  }

  const userId = String(user.id);
  const userName = buildDisplayName(user);
  const initKey = `${appId}:${userId}`;

  if (currentInitPromise && currentInitKey === initKey) {
    return currentInitPromise;
  }

  currentInitKey = initKey;
  currentInitPromise = loadZegoDependencies()
    .then(({ service, plugins }) => {
      if (!systemUiConfigured) {
        service.useSystemCallingUI(plugins);
        systemUiConfigured = true;
      }

      return service.init(appId, appSign, userId, userName, plugins, {
        androidNotificationConfig: {
          channelID: "CallInvitation",
          channelName: "CallInvitation",
        },
        ringtoneConfig: {
          incomingCallFileName: "zego_incoming.mp3",
          outgoingCallFileName: "zego_outgoing.mp3",
        },
        notifyWhenAppRunningInBackgroundOrQuit: true,
      });
    })
    .catch((error) => {
      currentInitPromise = null;
      currentInitKey = null;
      throw error;
    });

  return currentInitPromise;
};

export const uninitZegoCallKit = (): void => {
  currentInitKey = null;
  currentInitPromise = null;
  if (!isZegoRuntimeAvailable()) {
    return;
  }

  try {
    loadedService?.uninit();
  } catch (error) {
    console.warn("[ZEGO] Failed to uninit call kit", error);
  }
};
