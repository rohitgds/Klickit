import { resolveClientApiBase, type ClientRuntimeMode } from "@klickit/shared";

export interface DesktopLaunchInput {
  mode: ClientRuntimeMode;
  gatewayUrl?: string;
  cloudUrl?: string;
}

export interface DesktopLaunchResult {
  started: boolean;
  provider: "tauri" | "browser-fallback";
  apiBase: string | null;
}

export async function isTauriAvailable(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

export async function launchDesktopShell(input: DesktopLaunchInput): Promise<DesktopLaunchResult> {
  const apiBase = resolveClientApiBase({
    mode: input.mode,
    gatewayUrl: input.gatewayUrl,
    cloudUrl: input.cloudUrl,
  });

  if (await isTauriAvailable()) {
    return { started: true, provider: "tauri", apiBase };
  }

  return { started: true, provider: "browser-fallback", apiBase };
}
