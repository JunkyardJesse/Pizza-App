// Small bridge to native features when running inside the App Store / Google Play app.
// In a normal browser window.Capacitor is absent and every helper falls back to web behaviour.
(function () {
  const cap = window.Capacitor;
  const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const P = (cap && cap.Plugins) || {};

  // Save a text file and open the share sheet (Files, Drive, email…).
  // Returns true when handled natively; false means the caller should use its web fallback.
  async function shareTextFile(name, text, title) {
    if (!isNative || !P.Filesystem || !P.Share) return false;
    const res = await P.Filesystem.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
    try { await P.Share.share({ title: title || name, files: [res.uri] }); } catch (e) { /* user cancelled */ }
    return true;
  }

  window.NativeApp = { isNative, shareTextFile };
})();
