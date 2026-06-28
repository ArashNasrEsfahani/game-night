# Android (Capacitor)

The web app is wrapped into a native Android app with [Capacitor](https://capacitorjs.com).
The Vite PWA build (`dist/`) is the app's web layer; Capacitor hosts it in a native WebView.

What's already in place:

- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` installed.
- `capacitor.config.ts` — `appId: com.gamenight.party`, `appName: Game Night`, `webDir: dist`.
- `android/` — the generated native project (open it in Android Studio).
- The app uses **HashRouter** and stores everything in **IndexedDB**, so routing and saved
  content/edits work inside the WebView with no server.

## Prerequisites

- **Android Studio** (latest) with the Android SDK + a JDK 17 (Android Studio bundles one).
- An emulator or a device with USB debugging on.

## Build & run

```bash
npm run android:sync     # npm run build  +  cap sync android   (copies dist/ into android/)
npm run android:open     # opens android/ in Android Studio → press ▶ Run
# or, with a device/emulator already attached:
npm run android:run
```

In Android Studio you can then **Build → Generate Signed Bundle / APK** for a release artifact.

## Update flow

After any web change, re-sync the native project:

```bash
npm run android:sync
```

(`cap sync` runs the build, copies `dist/` into `android/app/src/main/assets/public`, and updates
native plugins.)

## App identity

Set the app name, id and icons before publishing:

- **App id**: `appId` in `capacitor.config.ts` (also the Gradle `applicationId`).
- **Display name**: `android/app/src/main/res/values/strings.xml` → `app_name`.
- **Icons / splash**: replace the launcher icons in `android/app/src/main/res/mipmap-*`, or use
  [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets) to generate them from a
  single source image.

## Notes

- The PWA service worker is bundled in `dist/`. It works inside the WebView; if you ever see stale
  content after an app update, you can disable it via `devOptions`/`selfDestroying` in
  `vite.config.ts`'s `VitePWA(...)`.
- `android/` is committed; its build outputs are ignored by the generated `android/.gitignore`.
