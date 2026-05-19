import Constants from "expo-constants";
import { Platform } from "react-native";
import type { ComponentType } from "react";
import type { User } from "../../auth/services/auth.service";

// Workaround for Zego SDK bug: Platform is not imported internally
if (typeof global !== "undefined" && !(global as any).Platform) {
  (global as any).Platform = Platform;
}

// Static require to avoid Metro bundler issues with dynamic imports
let ZegoServiceModule: any;
let ZegoZimModule: any;
let ZegoZpnsModule: any;

try {
  ZegoServiceModule = require("@zegocloud/zego-uikit-prebuilt-call-rn");
  ZegoZimModule = require("zego-zim-react-native");
  ZegoZpnsModule = require("zego-zpns-react-native");
} catch (e) {
  console.warn("[ZEGO] Static require failed:", e);
}

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

export type ZegoRoomModule = {
  ZegoUIKitPrebuiltCall: ComponentType<any>;
  ONE_ON_ONE_VIDEO_CALL_CONFIG?: Record<string, unknown>;
  ONE_ON_ONE_VOICE_CALL_CONFIG?: Record<string, unknown>;
  GROUP_VIDEO_CALL_CONFIG?: Record<string, unknown>;
  GROUP_VOICE_CALL_CONFIG?: Record<string, unknown>;
};

type ZegoDependencyLoadResult = {
  service: ZegoCallServiceModule;
  plugins: unknown[];
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
let loadedRoomModule: ZegoRoomModule | null = null;

const normalizeErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  return "Unknown SDK error";
};

const buildZegoDependencyLoadError = (error: unknown): Error => {
  const reason = normalizeErrorMessage(error);
  const lowerReason = reason.toLowerCase();

  if (
    lowerReason.includes("native module") ||
    lowerReason.includes("cannot find native module") ||
    lowerReason.includes("was not found in the ui manager") ||
    lowerReason.includes("could not be found") ||
    lowerReason.includes("requirenativecomponent")
  ) {
    return new Error(
      `ZEGO native modules are unavailable in this development build. Rebuild and reinstall the Android development build after adding ZEGO dependencies. Original error: ${reason}`,
    );
  }

  return new Error(reason);
};

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

const isWebRuntime = (): boolean => Platform.OS === "web";

export const isZegoRuntimeAvailable = (): boolean =>
  !isExpoGoRuntime() && !isWebRuntime();

export const loadZegoDependencies = async (): Promise<ZegoDependencyLoadResult> => {
  if (loadedService && loadedPlugins) {
    return {
      service: loadedService,
      plugins: loadedPlugins,
    };
  }

  if (!ZegoServiceModule || !ZegoZimModule || !ZegoZpnsModule) {
    throw new Error("Zego modules failed to load at startup");
  }

  try {
    const service = (ZegoServiceModule.default ?? ZegoServiceModule) as ZegoCallServiceModule;
    const zim = ZegoZimModule;
    const zpns = ZegoZpnsModule;

    loadedService = service;
    loadedPlugins = [zim, zpns];

    return {
      service,
      plugins: loadedPlugins,
    };
  } catch (error) {
    console.error("[ZEGO] loadZegoDependencies failed:", error);
    throw buildZegoDependencyLoadError(error);
  }
};

export const loadZegoRoomModule = async (): Promise<ZegoRoomModule> => {
  if (loadedRoomModule) {
    return loadedRoomModule;
  }

  if (!ZegoServiceModule) {
    throw new Error("Zego service module failed to load at startup");
  }

  try {
    const roomComponent = (ZegoServiceModule as any).ZegoUIKitPrebuiltCall;

    if (!roomComponent) {
      throw new Error(
        "ZegoUIKitPrebuiltCall named export is unavailable in the current runtime",
      );
    }

    const exportedModule = {
      ZegoUIKitPrebuiltCall: roomComponent,
      ONE_ON_ONE_VIDEO_CALL_CONFIG: (ZegoServiceModule as any)
        .ONE_ON_ONE_VIDEO_CALL_CONFIG,
      ONE_ON_ONE_VOICE_CALL_CONFIG: (ZegoServiceModule as any)
        .ONE_ON_ONE_VOICE_CALL_CONFIG,
      GROUP_VIDEO_CALL_CONFIG: (ZegoServiceModule as any).GROUP_VIDEO_CALL_CONFIG,
      GROUP_VOICE_CALL_CONFIG: (ZegoServiceModule as any).GROUP_VOICE_CALL_CONFIG,
    } as ZegoRoomModule;

    loadedRoomModule = exportedModule;
    return exportedModule;
  } catch (error) {
    console.error("[ZEGO] loadZegoRoomModule failed:", error);
    throw buildZegoDependencyLoadError(error);
  }
};

export const initZegoCallKit = (user: User): Promise<void> => {
  if (!isZegoRuntimeAvailable()) {
    return Promise.resolve();
  }

  const appId = readCallKitAppId();
  const appSign = readCallKitAppSign();

  if (!appId || !appSign || appSign.trim().length === 0) {
    return Promise.reject(
      new Error("Thieu cau hinh ZEGO_APP_ID hoac ZEGO_APP_SIGN"),
    );
  }

  if (!user?.id) {
    return Promise.reject(new Error("User ID is missing for ZEGO init"));
  }

  const userId = String(user.id);
  const userName = buildDisplayName(user);

  if (!userId || typeof userId !== "string" || userId.length === 0) {
    return Promise.reject(new Error("ZEGO userId is invalid"));
  }
  if (!userName || typeof userName !== "string" || userName.length === 0) {
    return Promise.reject(new Error("ZEGO userName is invalid"));
  }

  const initKey = `${appId}:${userId}`;

  if (currentInitPromise && currentInitKey === initKey) {
    return currentInitPromise;
  }

  currentInitKey = initKey;
  currentInitPromise = loadZegoDependencies()
    .then(({ service, plugins }) => {
      console.log(
        "[ZEGO] service.init() params:",
        "appId:",
        appId,
        "type:",
        typeof appId,
        "appSign:",
        appSign?.substring(0, 8) + "...",
        "type:",
        typeof appSign,
        "userId:",
        userId,
        "type:",
        typeof userId,
        "userName:",
        userName,
        "type:",
        typeof userName,
        "plugins count:",
        plugins.length,
        "plugins[0]:",
        typeof plugins[0],
        "plugins[1]:",
        typeof plugins[1],
      );

      if (!systemUiConfigured) {
        service.useSystemCallingUI(plugins);
        systemUiConfigured = true;
      }

      try {
        const initResult = service.init(appId, appSign, userId, userName, plugins, {
          ringtoneConfig: {
            incomingCallFileName: "zego_incoming.mp3",
            outgoingCallFileName: "zego_outgoing.mp3",
          },
          androidNotificationConfig: {
            channelID: "CallInvitation",
            channelName: "CallInvitation",
          },
        });
        return initResult;
      } catch (error) {
        console.error("[ZEGO] service.init() threw error:", error);
        throw error;
      }
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
