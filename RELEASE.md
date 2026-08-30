# Releasing ALS

Every build runs on EAS servers, so none of this needs Android Studio, Xcode or
a Mac. Run the commands from the project root.

```bash
npx eas-cli login          # once per machine
npx eas-cli whoami         # should print ardenaprod
```

---

## What this build is

The app runs against the live API at `https://als.ardena.xyz`. Sign-in texts a
real code, coursework is stored against the account and synced to the device,
the tutor answers from material the server has read, and payments are verified
server-side.

`src/store/useStudyStore.js` still persists to AsyncStorage, but as a cache and
an outbox rather than as the source of truth: every row carries `updatedAt`,
every deletion leaves a tombstone, and `src/lib/sync.js` pushes what changed
before pulling what the server has. That is what keeps the app usable on a bad
connection without making the phone the authority on anything.

Two things a tester should know:

- **Payments are real.** Checkout opens a Kora page for an actual charge. Use a
  test account and a small amount, or do not complete one.
- **Signing in takes the account over.** The server allows one live session per
  account, so signing in on a second handset signs the first one out.

Point a build at another server with `EXPO_PUBLIC_API_URL` — see `.env.example`
for that and for the Google sign-in client ids, which the sign-in screen hides
the Google button without.

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

**"Something went wrong. Check that Google Play is enabled on your device..."**
— this dialog is not ours. Nothing in the app or its dependencies draws it:
there is no Play Billing, no Play Games, no Play Core call anywhere in the
tree. It comes from **automatic protection** ("Protected with Play"), which the
Play Console applies to an uploaded bundle unless it is told not to. It adds an
installer check that runs *at launch*, and shows that dialog when it cannot
confirm Google Play installed this copy.

At launch is why it looks like a resume bug. Backgrounding the app and coming
back is a cold start whenever Android has killed the process, so the check runs
again and the dialog lands on what looks like a reopen.

It fires on a genuinely Play-installed app when the check cannot verify rather
than when it actively fails: Play Store disabled or mid-update on the handset,
a device without Play services, or an install that came from somewhere else
(a `preview` APK sideloaded over the Play copy, or internal app sharing).

To turn it off, per release, in the Play Console: **Test and release → the
release → App bundle enhancements → the info button beside automatic
protection → Turn off protection for this release**. It has to be done on every
upload — the next bundle is protected again.

**App installs but crashes on launch, only in release** — a ProGuard keep rule
is missing for something added since. Add it to `extraProguardRules` in
`app.json`. To confirm that is the cause, set
`enableProguardInReleaseBuilds: false` and rebuild; if the crash goes, it is a
keep rule.
