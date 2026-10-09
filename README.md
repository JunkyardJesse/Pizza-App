# Pizza-App
## iOS and Android apps

The same web app is packaged for the App Store and Google Play with [Capacitor](https://capacitorjs.com). The website keeps working as before; the app build copies the web files into `www/` and wraps them.

- `capacitor.config.json` holds the app ID and name; `assets/` holds the app icon and splash screen sources.
- `native.js` adds app-only features and does nothing in a normal browser.
- `privacy.html` is the privacy policy that both stores ask for. Link it from GitHub Pages.
- **GitHub Actions** (`.github/workflows/app-builds.yml`) builds both apps on every push, with no Mac needed. Download the Android test APK from the run's *Artifacts*. To make store builds, add the signing secrets listed at the top of the workflow, then run it from the Actions tab with **release** ticked.

To build locally, run `npm install` and then `bash scripts/native-setup.sh all`. After that, `npx cap open ios` or `npx cap open android` opens the project. iOS needs a Mac with Xcode.
