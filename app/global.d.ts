declare module "*.jpg";
declare module "*.png";
declare module "*.woff2";
declare module "*.woff";
declare module "*.ttf";
declare module "*.scss" {
  const content: Record<string, string>;
  export default content;
}

declare module "*.svg";

declare interface Window {
  /**
   * Tauri v2 global API (available when withGlobalTauri: true in tauri.conf.json).
   * Prefer importing from @tauri-apps/plugin-* instead of using this directly.
   * Use platform.ts helpers for all platform-specific operations.
   */
  __TAURI__?: Record<string, unknown>;

  /**
   * Tauri v2 internal IPC bridge – always injected by the WebView runtime,
   * regardless of withGlobalTauri setting.  Used by platform.isDesktop().
   */
  __TAURI_INTERNALS__?: unknown;
}
