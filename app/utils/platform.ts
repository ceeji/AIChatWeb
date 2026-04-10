/**
 * Platform abstraction layer.
 *
 * All Tauri v2 / web branching lives here so that the rest of the codebase
 * stays platform-agnostic.  Add new desktop-only capabilities here and import
 * them from any component – they degrade gracefully to no-ops or browser
 * equivalents when running in a regular browser.
 */

// ─── Detection ───────────────────────────────────────────────────────────────

/**
 * Returns true when running inside a Tauri v2 WebView.
 * Uses the low-level IPC bridge injected by Tauri regardless of
 * `withGlobalTauri` setting, so it is reliable in both dev and prod.
 */
export function isDesktop(): boolean {
  return (
    typeof window !== "undefined" &&
    // __TAURI_INTERNALS__ is always injected by Tauri v2
    !!(window as any).__TAURI_INTERNALS__
  );
}

// ─── Clipboard ───────────────────────────────────────────────────────────────

/**
 * Write text to the clipboard.
 * Desktop: uses tauri-plugin-clipboard-manager.
 * Web: uses navigator.clipboard (throws in insecure contexts).
 */
export async function writeToClipboard(text: string): Promise<void> {
  if (isDesktop()) {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    return writeText(text);
  }
  return navigator.clipboard.writeText(text);
}

// ─── File save ───────────────────────────────────────────────────────────────

/**
 * Open a native save-file dialog and return the chosen path, or null if the
 * user cancelled.  Only available on desktop.
 */
export async function saveFileDialog(
  defaultPath: string,
  ext: string,
): Promise<string | null> {
  if (!isDesktop()) return null;
  const { save } = await import("@tauri-apps/plugin-dialog");
  return save({
    defaultPath,
    filters: [
      { name: `${ext.toUpperCase()} files`, extensions: [ext] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
}

/**
 * Write raw bytes to a file path on the local filesystem.
 * Only meaningful on desktop (after obtaining a path via saveFileDialog).
 */
export async function writeDesktopFile(
  path: string,
  data: Uint8Array,
): Promise<void> {
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  return writeFile(path, data);
}

// ─── Notifications ───────────────────────────────────────────────────────────

/**
 * Show a system notification.
 * Desktop: uses tauri-plugin-notification (requests permission if needed).
 * Web: uses the Notification Web API if permission is already granted.
 */
export async function showNotification(
  title: string,
  body: string,
): Promise<void> {
  if (isDesktop()) {
    const { isPermissionGranted, requestPermission, sendNotification } =
      await import("@tauri-apps/plugin-notification");

    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }
    if (granted) {
      sendNotification({ title, body });
    }
    return;
  }

  // Web fallback – only fires if the user has already granted permission
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

// ─── IPC bridge (reserved for future features) ───────────────────────────────

/**
 * Call a custom Rust command registered with `#[tauri::command]`.
 * Use this as the extension point for local model integration, file indexing,
 * or any other native capability added to src-tauri/src/main.rs.
 *
 * @example
 *   const result = await invokeCommand<string>("launch_local_model", { modelPath });
 */
export async function invokeCommand<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}
