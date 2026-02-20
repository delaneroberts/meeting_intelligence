Run on iPhone without USB (no Lightning cable)

Overview

If you cannot connect the iPhone to your Mac via USB, the easiest way to run your app with native modules is to install a development build (dev-client) on the device over-the-air (OTA). The recommended path uses EAS (Expo Application Services) to produce a signed dev build you can install on the phone (TestFlight/internal distribution or direct install link). This doc summarizes the options, prerequisites, and exact commands.

Important caveats

- Installing an iOS dev-build OTA (without Xcode) typically requires an Apple Developer Program (paid) account if you want easy installation via TestFlight or App Store Connect. Without a paid account you can only run on device via Xcode (USB) or with special provisioning that includes the device UDID (not practical from a non-Mac machine).
- If you do not have an Apple Developer account, the two alternatives are: 1) use an Android device instead (APK install is easier OTA), or 2) repair the lightning port / borrow a Mac to run Xcode once.
- Expo Go will NOT work if your app uses native modules not included in Expo Go (your app already depends on packages like react-native-fs and expo-dev-client). You must install a dev-client with your native modules included.

Prerequisites

- Node and npm installed on your machine (you already have this for Metro).
- The project configured with expo and `expo-dev-client` dependency (already present in package.json).
- An Expo account (free) for EAS and eas-cli usage.
- For building for iOS OTA installs: an Apple Developer Program account (paid) is strongly recommended.

Paths (choose one)

Option A — EAS development build + install via TestFlight / internal distribution (recommended if you have Apple Developer account)

1. Install eas-cli and login

```zsh
# install if you don't have it
npm install -g eas-cli

# login to your Expo account
cd mobile_app
eas login
```

2. Configure eas.json (if not present)

- If `eas.json` doesn't exist, run `eas build:init` and follow the prompts. For a development workflow you can use the `development` profile.

3. Start a development build for iOS

```zsh
cd mobile_app
# development builds are intended for dev-client usage
eas build --platform ios --profile development
```

- Follow the prompts. EAS will request Apple credentials to manage certificates/profiles. It can manage credentials for you.
- When the build completes, the EAS web UI will provide an install link or upload to TestFlight depending on options. Use that link on your iPhone to install the development build.

4. Start Metro for dev-client on your machine (so the installed dev client can connect)

```zsh
cd mobile_app
# preferred: tunnel if your phone can't reach the machine LAN
npx expo start --dev-client --tunnel
# or use the script we added:
./scripts/start_metro_dev_client.sh
```

5. Open the installed dev client on the iPhone and connect to Metro — either scan the terminal QR or choose the URL inside the dev client.

Notes on EAS and Apple account

- To upload to TestFlight automatically you will need an Apple Developer Program account. EAS will guide you to authenticate and can also manage credentials.
- If you want to avoid TestFlight but still install OTA, you can create an Ad Hoc build containing the device UDID(s), but that requires registering devices in your Developer account — heavier setup.

Option B — EAS build + internal distribution (dev-client install via direct link)

- Similar to Option A, but you may choose to distribute a build via an installable link in the EAS build page. This still generally requires Apple Developer membership for signing and installation to a physical device.

Option C — If you don't have an Apple Developer account

- Use an Android device for testing (install dev client from the EAS build or use the debug APK link). Android allows easier OTA testing.
- Repair the lightning port or borrow a Mac to run `npx expo run:ios` once to install the dev client via Xcode.

Quick commands summary

```zsh
# install eas-cli (once)
npm install -g eas-cli

# login to Expo
cd mobile_app
eas login

# start an iOS development build (EAS will walk you through credentials)
eas build --platform ios --profile development

# once build is available, install the dev client on your iPhone using the EAS build page link

# start Metro for dev-client locally (tunnel is recommended when phone cannot reach LAN)
npx expo start --dev-client --tunnel
# OR use the repository script
./scripts/start_metro_dev_client.sh
```

Troubleshooting and tips

- If Metro QR doesn't connect, confirm Metro is running with `npx expo start` and that you're using `--dev-client` when connecting with a dev build.
- If the dev build install fails or EAS can't manage credentials, you'll see instructions in the terminal — follow them. EAS can often handle credential creation, but it needs Apple account access.
- If you see the red "native module doesn't exist" screen after installing a build, that indicates the installed app is still Expo Go (not the dev client) or the dev build doesn't match the JS version — make sure the dev client you installed was produced from this repo and you're running Metro with `--dev-client`.

If you'd like, I can:
- Start an `eas build` for you (I can run commands here) — note: eas-cli will prompt for interactive login and possibly Apple credential flow requiring you to enter credentials in the terminal or browser. I can run it and show the logs, but you will need to interact for credential consent.
- Or, if you prefer not to use EAS, I can help craft the minimal change to remove/rework the native modules so Expo Go will work (this may need code changes).

Which path do you want: EAS dev build (I can start it and walk you through the prompts), or help with an Android test or refactor to remove native modules so Expo Go works?