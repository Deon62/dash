# Releasing ALS

Every build runs on EAS servers, so none of this needs Android Studio, Xcode or
a Mac. Run the commands from the project root.

```bash
npx eas-cli login          # once per machine
npx eas-cli whoami         # should print ardenaprod
```

---

## What this build is

The app has **no backend**. `src/api/` exists but nothing imports it, and
`src/lib/auth.js` is an offline stand-in that accepts any six digits. Everything
on screen comes from the on-device store (`src/store/useStudyStore.js`), which
persists to AsyncStorage.

That is deliberate for internal testing: a tester can sign in with any number,
walk the whole app, add units, notes, timetable entries and events, and see
every screen. Nothing leaves the phone. Payments open real Paystack pages in the
browser, so **do not complete one** on a test build — the app cannot see the
charge and simply asks whether it went through.

---

## Profiles

`eas.json` defines three build profiles, plus one submit profile:

| Profile | Android output | Use it for |
|---|---|---|
| `development` | APK, dev client | Running Metro against a real device |
| `preview` | APK | Sideloading — WhatsApp it to a tester, they tap it |
| `production` | **AAB** | Play Store: internal testing, closed, open, production |

`preview` is the one for handing someone a file. `production` is the one for the
Play Console — Google will not accept an APK for a new app.

---

## Android

### AAB for the Play Store

```bash
npx eas-cli build --platform android --profile production
```

Takes roughly 10–20 minutes. It prints a URL you can watch, and the finished
`.aab` is downloadable from that page and from
[the project dashboard](https://expo.dev/accounts/ardenaprod/projects/als).

Add `--no-wait` to queue it and get your terminal back.

**First upload must be manual.** Google requires the app to exist in the Play
Console before anything can be pushed to it:

1. Play Console → **Create app** → name `ALS`, package `com.ardena.als`.
2. **Testing → Internal testing → Create new release**.
3. Upload the `.aab`, add testers by email, roll out.

Testers get a link, install from Play, and updates arrive the normal way.

### Later uploads, straight from the terminal

Once the app exists in the Console and a Google service-account key is attached
to the EAS project:

```bash
npx eas-cli submit --platform android --profile production --latest
```

`--latest` grabs the most recent finished build. The submit profile in
`eas.json` already targets the `internal` track as a `draft`, so nothing goes
live until you promote it in the Console.

### APK for sideloading

```bash
npx eas-cli build --platform android --profile preview
```

No Play Console, no review, no testers list. The tester has to allow
"install from unknown sources" once. Good for a same-day look; bad as a habit,
because there is no update path.

---

## iOS

Needs an Apple Developer Program membership (99 USD/year). EAS builds it in the
cloud — a Mac is not required.

### TestFlight

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production --latest
```

Then App Store Connect → TestFlight → add internal testers. Internal testers
(up to 100, all on your team) get it within minutes and skip review. External
testers need a one-time Beta App Review.

### Ad-hoc, without TestFlight

```bash
npx eas-cli build --platform ios --profile preview
```

`distribution: internal` on iOS means an ad-hoc build, which installs only on
devices whose UDIDs are registered on the provisioning profile. EAS walks you
through registering them the first time. Under about five devices this is
quicker than TestFlight; above that it is not.

---

## Versions

`eas.json` sets `"appVersionSource": "remote"`, so **EAS owns the build
numbers**. `android.versionCode` and `ios.buildNumber` are deliberately absent
from `app.json` — EAS reads them but ignores them, so leaving them in only
invites someone to bump one and wonder why nothing changed. The `production`
profile has `autoIncrement: true`, so every production build takes the next
number automatically. That matters because Play rejects a
second upload with a version code it has already seen.

What you *do* edit by hand is the human-facing version in `app.json`:

```json
"version": "1.0.0"
```

Bump it when the release is worth a name. `runtimeVersion` follows `appVersion`,
so a version bump also starts a new OTA update lane.

Check what the server thinks:

```bash
npx eas-cli build:version:get --platform android
```

---

## Size

Already configured, in `app.json` under `expo-build-properties`:

- `enableProguardInReleaseBuilds` — strips unreachable Java/Kotlin
- `enableMinifyInReleaseBuilds` — R8 minification
- `enableShrinkResourcesInReleaseBuilds` — drops unreferenced resources
- `extraProguardRules` — the keep rules, without which R8 removes classes that
  are only ever reached by reflection or from native code, and the release build
  crashes where the debug build did not. React Native core, Hermes, Expo
  modules, Reanimated, gesture-handler, svg and screens are all kept explicitly.
  `SourceFile,LineNumberTable` is kept too, so Play Console crash reports stay
  readable.

JavaScript is Hermes bytecode, not source — that is the single biggest win and
it is on by default on SDK 54.

**The `.aab` file size is not the download size.** An app bundle contains every
ABI, every screen density and every language; Play splits it per device and
serves only the slice that phone needs. Expect the installed download to be
roughly a third of the `.aab`. The Play Console shows the real figure per device
under **App bundle explorer → Downloads**, and that is the number to judge.

If it still needs to come down, the levers in order of return:

1. Drop unused native modules from `package.json` — each one is a whole library.
   `expo-speech-recognition` and `expo-local-authentication` are the two heaviest
   currently installed; both are used, but if dictation or biometrics get cut,
   remove the packages too, not just the calls.
2. Re-export the PNGs in `assets/` — icons and the splash are shipped verbatim.
3. `npx expo-doctor` flags duplicated or mismatched dependencies, which show up
   as two copies of the same native library.

---

## Before every release build

```bash
npx expo-doctor                    # config and dependency check
npx expo export -p android         # proves the bundle compiles
```

`expo export` catches what a running dev server does not: a screen that is never
opened in testing still has to bundle. It is much cheaper to find a broken
import here than 15 minutes into an EAS build.

---

## Troubleshooting

**"Slug for project identified by extra.eas.projectId does not match"** — the
EAS project's slug and `app.json`'s `slug` disagree, and every EAS command fails
until they do. Either rename the project on expo.dev (Project settings →
rename), or unlink and relink:

```bash
# delete extra.eas.projectId from app.json first, then
npx eas-cli project:init --force --non-interactive
```

Note the flags. `--force` on its own creates `@<account>/<slug>` from the slug
in `app.json`. Adding `--account` instead takes the other branch — it links an
existing project and rewrites your slug to match it, which is the opposite of
what you want here.

**Build fails at "Run gradlew"** — almost always a native module. Open the log
at the printed URL and read upward from the first red line; the failing module
is usually named.

**App installs but crashes on launch, only in release** — a ProGuard keep rule
is missing for something added since. Add it to `extraProguardRules` in
`app.json`. To confirm that is the cause, set
`enableProguardInReleaseBuilds: false` and rebuild; if the crash goes, it is a
keep rule.
