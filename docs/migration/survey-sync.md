# Can save-sync run fully client-side for a static GitHub Pages SPA?

## 1. What sync.js already does, and whether it's proven to work from a browser

`/Users/doe/Projects/Games/IdleOn/sync.js` is a self-contained `window.IdleonSync` module loaded by
`dashboard.html` (line 101) and `achievements.html` (line 74). It implements the *entire* companion.mjs
flow again, in plain browser `fetch()`:

- `connect(redirectUrl)` (sync.js:82-96): parses the pasted `steamsso` redirect URL, POSTs to
  `https://us-central1-idlemmo.cloudfunctions.net/asil` (browser `fetch`, JSON body), then POSTs to
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=<API_KEY>` — plain REST,
  no Firebase SDK. Stores `{uid, refreshToken}` in `localStorage` (via `sset`, sync.js:60) or an
  in-memory fallback if storage is blocked (sync.js:56-61).
- `sync()` (sync.js:114-143): POSTs `securetoken.googleapis.com/v1/token` (refresh-token grant, form-encoded),
  then GETs Firestore REST `_data/{uid}` with `Authorization: Bearer <id_token>`, then GETs Realtime DB
  `_uid/{uid}.json?auth=<id_token>` for char names. **It does not fetch `_comp/{uid}` (companions) or
  `_vars/_vars` (server vars)** — those two were added later, only in companion.mjs (lines 141-161), with
  comments explaining why they matter (artifact odds, vote state). This is a gap versus companion.mjs's
  feature set, not a client-vs-server limitation — the missing calls are the same REST shape and would
  work exactly like the `_uid` call already there.

**Important architectural catch — the direct-fetch path is *not* what actually runs when you visit these
pages normally.** Both pages gate on:

```js
const SERVER = location.protocol.startsWith("http");   // sync.js:54
const SRV = () => window.IdleonSync && IdleonSync.SERVER;
```

When served over `http(s)://` (i.e., via `companion.mjs`'s local server on `localhost:8317` — the
only way these pages are normally opened today), `SRV()` is `true`, and the UI calls
`IdleonSync.serverConnect/serverSyncNow/serverInit` (sync.js:174-200), which hit `/api/connect`,
`/api/sync`, `/api/state` on **companion.mjs**, not Firebase directly. The direct-browser path
(`IdleonSync.connect`/`.sync()`) only executes today when a page is opened as a bare `file://` document
(no server running) — see `dashboard.html:535-537` and `achievements.html:208-209` for the `if (SRV())
… else …` branch.

So: **there is no evidence in this repo of the direct-browser path having actually been exercised
against real CORS behavior** — it's written, but under normal usage (`http://localhost:8317`) it's
dead code; the `SERVER` flag steers everything to companion.mjs's Node-side `fetch()` calls instead,
which of course have no CORS restrictions (server-to-server). No commit message, comment, or README
note in this repo mentions CORS at all (`grep -rn "CORS\|cors\|Access-Control"` across all
`.mjs/.html/.js/.md` outside `idleon-toolbox/` returns nothing). The `file://` fallback path is
theoretically correct REST but unverified here.

That gap is exactly what part 2 closes.

## 2. How IdleonToolbox (production static web app) does it

`idleon-toolbox/` is a Next.js app built with `output: 'export'` (`idleon-toolbox/next.config.js:4`,
`images: { unoptimized: true }`) — i.e., a fully static export, `npm run build` → `./out`, `npx serve out`
locally (`package.json:12`). It is deployed straight to **GitHub Pages**:

`idleon-toolbox/.github/workflows/deploy.yml` — `next build` then
`peaceiris/actions-gh-pages@v4` with `publish_dir: ./out`, triggered on push to `main`. `CNAME` file
(`idleon-toolbox/CNAME`) points it at `idleontoolbox.com`. This is a live, real-world, high-traffic
production app running the same sync as ours, entirely from a static site with no backend of its own
for the Firebase parts. This is about as close to a direct existence-proof for our GitHub Pages goal
as it's possible to get.

### Steam SSO exchange
`idleon-toolbox/services/auth/steam.js:13-38` (`getSteamParams`) — plain browser `fetch()` POST straight
to `https://us-central1-idlemmo.cloudfunctions.net/asil`, JSON body, same three OpenID fields
(`claimedId`, `nonce`, `assocHandle`, `sig`, `signed`) as our `companion.mjs`/`sync.js`. Called directly
from a React component running in the user's browser at `idleontoolbox.com`
(`idleon-toolbox/components/common/Logins/SteamLogin.jsx:53`). **This proves the `asil` cloud function
allows cross-origin browser calls** (Cloud Functions v1 HTTP callables generally set permissive CORS
headers by default unless the function itself restricts it, and this is empirical proof it does for at
least `idleontoolbox.com`; nothing suggests `asil` allow-lists origins — it's the same public endpoint
the official game website itself uses, and Google Cloud Functions default CORS is `*` unless the function
code checks `Origin`, which typical Firebase "callable-via-onRequest" functions this old rarely do).
The Steam login popup itself is opened with `window.open(..., '_blank', 'popup')` and the user pastes the
redirect URL back in — same manual-paste UX as our tools (`SteamLogin.jsx:13-24`, `36-38`).

### Firebase initialization
`idleon-toolbox/firebase/config.js:1-14` — `initializeApp({ apiKey: "AIzaSyAU62kOE6xhSrFqoXQPv6_WHxYilmoUxDk", authDomain: "idlemmo.firebaseapp.com", databaseURL: "idlemmo.firebaseio.com", storageBucket: "idlemmo.appspot.com", projectId: "idlemmo" })`.
**Same API key** as ours (`companion.mjs:58`, `sync.js:51`, `fetch-idleon.mjs:30`) — confirms it's the
public web key baked into the game's own website, not a secret.

### Custom-token sign-in
`idleon-toolbox/firebase/index.js:76-86` (`signInWithCustom`) — uses the **Firebase JS SDK**
(`signInWithCustomToken(auth, token)`), not a raw REST call to `identitytoolkit.googleapis.com`. The SDK
does the REST call internally, plus sets up its own token-refresh machinery.

### Token storage/refresh
No explicit `setPersistence`/`indexedDB` code found anywhere in `firebase/`, `services/`, `hooks/`, or
`components/` (`grep -rn "persistence|indexedDB|setPersistence|browserLocalPersistence"` → empty). It
relies entirely on the Firebase Auth JS SDK's **default browser persistence** (IndexedDB-backed
`indexedDBLocalPersistence`, auth-state-changed listeners, silent token refresh via the SDK's internal
`securetoken.googleapis.com` calls). App code never touches `refreshToken` directly — it reads
`userData.accessToken` off the SDK's `User` object (`AppProvider.jsx:412-414`).

### Firestore reads
`idleon-toolbox/firebase/index.js` uses the **Firebase JS SDK**, not REST:
- `getDoc(doc(firestore, '_data', uid))` (line 120) — the save itself.
- `getDoc(doc(firestore, '_vars', '_vars'))` (line 111) — server vars (same doc our companion.mjs reads
  at `_vars/_vars`, and the comment in companion.mjs:147-153 says it was "discovered via IdleonToolbox" —
  confirmed, this is that exact code).
- `onSnapshot(doc(firestore, '_data', uid), ...)` (line 132) — **live-updating** subscription instead of
  polling, something the REST approach can't do without hand-rolled long-polling.
- Also reads `_TOURNAMENT`, `_T_RES_UID`, `_T_LEAD`, `_guildStat` docs (irrelevant to our save-sync scope,
  but same mechanism).

### Realtime Database reads
Also SDK, not REST: `getDatabase(app)`, `ref(database)`, `get(child(dbRef, id))` (`getSnapshot` helper,
lines 255-267). Used for:
- `_uid/{uid}` — char names (line 105), matches our `_uid/{uid}.json?auth=` REST call.
- `_comp/{uid}` — companions (line 141), matches our `_comp/{uid}.json?auth=` REST call in
  companion.mjs:142.
- `_usgu/{uid}/g`, `_guild/{guildId}` — guild data, out of scope for us.

## 3. Verdict per network call

| # | Call | Browser-callable? | Mechanism proven by IdleonToolbox | Fundamentally needs a server? |
|---|------|---|---|---|
| 1 | `asil` Steam-assertion exchange (`us-central1-idlemmo.cloudfunctions.net/asil`) | **Yes** | Plain `fetch()` POST from browser JS (`services/auth/steam.js:25-31`) — no SDK involved, it's just a Cloud Function HTTP endpoint with (apparently permissive) CORS | No |
| 2 | `identitytoolkit.googleapis.com` custom-token sign-in | **Yes** | Via Firebase Auth SDK `signInWithCustomToken` (`firebase/index.js:80`); Firebase Auth REST endpoints are explicitly designed for direct browser use (they're what the SDK itself calls) — our REST version (`sync.js:91-92`) is equally valid | No |
| 3 | `securetoken.googleapis.com` refresh-token grant | **Yes** | Not called explicitly in IdleonToolbox app code — the Auth SDK does it internally on token expiry. Confirms Google intends this endpoint for direct client (browser) use; our manual REST call (`sync.js:117-118`) does the identical thing the SDK would do under the hood | No |
| 4 | Firestore `_data/{uid}` read (the save) | **Yes** | SDK `getDoc`/`onSnapshot` (`firebase/index.js:120,132`); Firestore's REST API (what our `sync.js:122-126` uses) is the same underlying protocol and is CORS-enabled by Google for browser SDK use | No |
| 5 | Realtime DB `_uid/{uid}` (char names) + `_comp/{uid}` (companions) | **Yes** | SDK `get(child(dbRef, id))` (`firebase/index.js:105,141`); RTDB's REST `.json` suffix (our `sync.js:129,` and companion.mjs's `_comp` call) is a first-class supported access method, not a workaround | No |
| 6 | Firestore `_vars/_vars` (server vars) | **Yes** | SDK `getDoc(doc(firestore, '_vars', '_vars'))` (`firebase/index.js:111`) — literally the doc companion.mjs's own comment credits IdleonToolbox for discovering | No |

**None of the five/six calls require a server.** Every one is either already proven working from a
production static site's browser code (asil, Firestore, RTDB, Auth SDK), or is a documented public REST
surface Google ships specifically for browser clients (securetoken, identitytoolkit). There is no
"fundamentally needs a server" call in this list — the entire chain is browser-safe.

**REST vs SDK choice:** IdleonToolbox uses the Firebase JS SDK for everything past the `asil` exchange.
Our existing `sync.js`/`companion.mjs` code uses raw REST for identitytoolkit/securetoken/Firestore/RTDB
and already works today from Node (server-side, so no CORS test) and is written (but unexercised) for
`file://`. Given IdleonToolbox's `output: 'export'` GitHub Pages deployment proves the SDK path works
fine from a *real* `https://` origin under real CORS, and REST is what the SDK does internally anyway,
**both approaches are technically viable**. Trade-offs:
- **Keep REST** (minimal change from current `sync.js`): no new dependency, ~150 lines already written
  and battle-tested server-side; just needs the two missing calls (`_comp`, `_vars`) ported in and the
  `SERVER`-flag branch removed/inverted so the direct path is what actually runs on GitHub Pages. Biggest
  unknown: REST CORS headers specifically for `identitytoolkit`/`securetoken`/`firestore.googleapis.com`
  when called from an arbitrary GitHub Pages origin (`*.github.io` or a custom domain) have not been
  empirically tested by us — only Node (no CORS) and, per IdleonToolbox, the SDK path (different code
  path, same origin issue doesn't necessarily transfer 1:1, though Google's REST APIs for Firebase Auth/
  Firestore/RTDB are documented as CORS-enabled for arbitrary origins, since that's literally what the
  SDK relies on across origins/domains — there is no origin allow-list on these product APIs the way
  there sometimes is on the `asil` app-specific function).
- **Switch to Firebase SDK**: adds a real dependency (`firebase` npm package, ~formerly loaded as a
  `<script>` bundle or ESM import — doable in a static page without a build step via a CDN ESM import
  like `https://www.gstatic.com/firebasejs/.../firebase-auth.js`), but gets free token refresh/persistence
  (IndexedDB), live Firestore subscriptions instead of polling, and is the *exact* path proven in
  production by IdleonToolbox — closing the one open question (CORS on the REST endpoints) entirely,
  since the SDK's transport is what's proven, not our hand-rolled fetches.
- **Recommendation:** since this repo already has a working, understood REST implementation and the
  target is "no local Node server" not "match IdleonToolbox's stack," the pragmatic move is to try the
  REST path first (it's a ~10-line change: flip the `SERVER` gate, add the two missing calls) and only
  fall back to the Firebase SDK if a real GitHub Pages deployment hits a CORS wall on any of
  identitytoolkit/securetoken/firestore/RTDB. Given Google explicitly designs those APIs for arbitrary
  browser origins (that's the whole point of a "public web API key" model), the risk is low, but it is
  the one claim in this report that isn't independently reproduced in this codebase's own browser code —
  it's inferred from IdleonToolbox's SDK usage plus the fact that Firebase's whole model is "no origin
  allow-list, security via Firestore/RTDB rules + the API key." A single test deploy to GitHub Pages
  (even a personal fork/branch) would settle it in minutes.

## 4. Security notes

- **Refresh token in browser storage**: Both our `sync.js` (`localStorage`, key `idleonAuth`,
  sync.js:57-63) and the design goal for a static PWA would keep the long-lived refresh token in
  browser storage (localStorage or IndexedDB) with no server ever seeing it. This is standard practice
  for browser-only Firebase apps (it's exactly what the Firebase Auth SDK itself does — IndexedDB-backed
  persistence) but means anyone with script execution on the page (XSS) or physical/device access to that
  browser profile can extract it and read the user's save indefinitely until they revoke Steam access.
  Since this is a read-only token scoped to one game account's own save data, and the whole point of the
  existing companion.mjs already stores it in a plaintext file on disk (arguably weaker: any local process/
  malware, not just XSS, can read `.idleon-auth.json`), moving it into localStorage is not a regression —
  if anything it inherits the browser's origin-isolation instead of filesystem permissions.
- **API key is public** — confirmed harmless: it's the same key IdleonToolbox ships in its public,
  open-source, client-side bundle (`idleon-toolbox/firebase/config.js:8`), and the same one the official
  game website uses. Firebase web API keys are not secrets; they identify the project, not the caller.
  Actual security is enforced by Firestore/RTDB security rules server-side (which we don't control and
  don't need to — they already permit read access to `_data/{uid}` etc. for anyone holding a valid ID
  token for that `uid`, since the game's own client depends on this).
- **GitHub Pages has no server-side secrets** — irrelevant here since none of the 5 network calls need
  a secret; the only "secret" in the whole flow is the user's own long-lived refresh token, which is
  inherently a client-held credential in this model (same as it is today in `.idleon-auth.json` or
  IdleonToolbox's IndexedDB), not a service credential that would need server-side protection.
- **No CSP/CORS control on GitHub Pages**: GitHub Pages serves static files with a fixed set of response
  headers; it cannot add CORS headers to *outgoing* requests (irrelevant, CORS is enforced by the
  server being called, not the caller) nor restrict *incoming* access in any app-specific way — meaning
  anyone can view-source/reuse the client code, but since there's no secret to steal from it (public API
  key, user's own token flow), this is not a new exposure versus the current file-based tools.
