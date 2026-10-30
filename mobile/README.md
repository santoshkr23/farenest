# FareNest mobile app (Android + iOS)

One Expo / React Native codebase for both stores. It talks to the FareNest server in the repo root (`/api/search/...`) and opens deals through your affiliate `/go/` links in an in-app browser.

**Screens:** Search (flights, hotels, car hire) · Results with Best / Cheapest / Fastest sort, filters and "Compare N sites" · Saved (starred + recent searches, stored on the device) · Settings (server address, privacy, terms, support, affiliate disclosure). Light and dark mode, haptics, Android back button.

## 1. Try it on your phone (5 minutes)

```bash
cd mobile
npm install
npx expo start          # scan the QR code with the Expo Go app
```
With `extra.apiUrl` empty the app shows **sample prices**. To use your server, open Settings in the app and enter its address (e.g. `https://farenest-api.onrender.com`).

> The date picker uses a native module. If Expo Go can't open it, make a development build: `npx eas-cli@latest build --profile development --platform android`.

## 2. Before you submit (required)

1. **Deploy the backend** (repo root) to a Node host such as Render or Railway, with HTTPS. Store reviewers reject apps that only show sample data.
2. In `app.json`:
   - `extra.apiUrl` → your server address
   - `extra.showServerSetting` → `false` (hides the server box from users)
   - `ios.bundleIdentifier` and `android.package` → your own reverse domain, e.g. `in.yourname.farenest`. **This can never be changed after the first upload.**
3. Replace the support email placeholder in `support.html` and `public/support.html` (repo root).
4. Check the privacy, terms and support pages open: `https://santoshkr23.github.io/farenest/privacy.html`.

## 3. Accounts you need

| Store | Cost | Sign up |
|---|---|---|
| Google Play Console | US$25 once | play.google.com/console |
| Apple Developer Program | US$99 / year | developer.apple.com/programs |
| Expo (builds iOS in the cloud, no Mac needed) | Free tier | expo.dev/signup |

## 4. Build

```bash
npm install -g eas-cli        # or prefix each command with: npx eas-cli@latest
eas login
eas init                       # links the project to your Expo account (adds projectId to app.json)

eas build --platform android --profile production   # .aab for Google Play
eas build --platform ios --profile production       # .ipa; EAS asks for your Apple login and creates certificates
```
Test build for Android phones: `eas build -p android --profile preview` gives an installable .apk.

## 5. Submit

**Google Play:** create the app in Play Console, fill in the store listing, content rating, Data safety (see table below) and target audience. Upload the first `.aab` by hand once. After that, create a service-account key, save it as `mobile/google-play-service-account.json` (it is git-ignored), and run `eas submit -p android`.

**App Store:** create the app in App Store Connect with the same bundle ID, put its numeric Apple ID into `eas.json → submit.production.ios.ascAppId`, then run `eas submit -p ios`. Add screenshots (6.7" and 6.5" iPhone, plus iPad because tablets are supported), the privacy policy URL, and in **App Review notes** write: *"FareNest compares prices from travel partners. Tapping Select opens the partner's site, where booking happens. No account is needed."*

### Privacy answers for both stores

| Data | Collected? | Notes |
|---|---|---|
| Name, email, phone, payment | No | |
| Search queries (places, dates) | Yes, not linked to identity | App functionality |
| Device / IP on deal clicks | Yes, not linked to identity | Analytics, affiliate attribution |
| Tracking across other companies' apps | No | No ATT prompt needed |
| Location, contacts, photos | No | |

## 6. Updates

JavaScript-only changes can ship without a new store review using `eas update`. Changes to native packages or `app.json` need a new `eas build` + submit; the build number increases automatically.

## Tips to pass review

- Apple guideline 4.2 rejects "website in a box" apps. This app is fully native, keeps saved searches offline and uses haptics, which helps.
- Make sure every partner you list has real prices and working links on the day you submit.
- Keep the affiliate disclosure in Settings and on the search screen.
