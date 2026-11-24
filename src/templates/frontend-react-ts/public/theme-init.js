{
  const root = document.documentElement;
  let preference = "system";

  try {
    const saved = globalThis.localStorage.getItem("brixa-theme");
    if (saved === "light" || saved === "dark") preference = saved;
  } catch {
    // The system preference is available even when storage is blocked.
  }
  root.dataset.themePreference = preference;
  root.dataset.theme =
    preference === "system"
      ? globalThis.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : preference;
}
