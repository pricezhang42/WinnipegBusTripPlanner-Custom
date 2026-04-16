### Development Notes

Set up enviornment:
https://docs.expo.dev/get-started/set-up-your-environment/?mode=development-build&buildEnv=local

Create a development build:
https://docs.expo.dev/develop/development-builds/create-a-build/

Initialized an expo project:
```npx expo init```

Build on Local Machine:
```npx expo run:android```

Note: Don't use a very deep project path, the length limit is 100.

### Backend

The app requires [BusTripPlanner-backend](../BusTripPlanner-backend) to be running. It holds the Mapbox and Winnipeg Transit API keys and serves route polylines from the GTFS feed.

Dev workflow:

```bash
# In ../BusTripPlanner-backend
cp .env.example .env     # fill in MAPBOX_TOKEN and WT_API_KEY
npm install
npm run dev              # starts http://localhost:8787
```

The client's [constants/Backend.ts](constants/Backend.ts) defaults to `http://10.0.2.2:8787` on Android emulators (the emulator's alias for the host's localhost) and `http://localhost:8787` elsewhere. Override at build time with `EXPO_PUBLIC_BACKEND_URL`.

For a physical device on the same Wi-Fi, point it at the host machine's LAN IP (e.g. `EXPO_PUBLIC_BACKEND_URL=http://192.168.1.42:8787 npx expo run:android`).

### Google Play Release Note

```bash
$env:EXPO_PUBLIC_BACKEND_URL = 'https://bustripplanner-backend.fly.dev'
npx expo run:android --variant release
```

Update versionCode and versionName in android\app\build.gradle:
```javascript
    namespace 'com.anonymous.BusTripPlanner'
    defaultConfig {
        applicationId 'com.anonymous.BusTripPlanner'
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 8
        versionName "1.3.3"
    }
```

```bash
cd android
.\gradlew.bat app:bundleRelease
```

The AAB will appear at android\app\build\outputs\bundle\release\app-release.aab
