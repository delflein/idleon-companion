/* src/data/sync.js — save-sync network layer, ported from companion.mjs's connectSteam/syncNow
 * flow to run entirely client-side (docs/ARCHITECTURE.md D4). No Node APIs, no Firebase SDK —
 * the same plain REST calls companion.mjs already used server-side, now issued via browser
 * `fetch()` from the GitHub Pages origin. Framework-free: no Vue imports here (layering rule in
 * the repo-root CLAUDE.md) so this module is reusable from a Web Worker later (D3's rebuild path).
 *
 * Auth is persisted in localStorage under 'idleon-auth' — same trust level as today's plaintext
 * .idleon-auth.json (a refreshToken grants full read of the save; there is no server to hide it
 * behind either way).
 *
 * M1 status: this is also the CORS spike (src/pages/SyncSpike.vue) exercising every call below
 * from the *.github.io origin for real, per docs/ARCHITECTURE.md D4's "settled by an M1 spike
 * deploy" note.
 */

const API_KEY = "AIzaSyAU62kOE6xhSrFqoXQPv6_WHxYilmoUxDk";
const STEAM_RETURN = "https://www.legendsofidleon.com/steamsso/";
const PROJECT = "idlemmo";
const AUTH_KEY = "idleon-auth";

/* ---------- storage (guarded so importing this module never throws — e.g. under Node for a
 * syntax check, or a browser with storage blocked/disabled) ---------- */
function hasStorage() {
  try {
    return typeof localStorage !== "undefined" && localStorage !== null;
  } catch {
    return false;
  }
}

/** Persisted `{uid, refreshToken, createdAt}`, or null if never connected / storage unavailable. */
export function getAuth() {
  if (!hasStorage()) return null;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistAuth(uid, refreshToken) {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ uid, refreshToken, createdAt: new Date().toISOString() }));
  } catch {
    /* storage full/blocked — auth just won't survive a reload; nothing else to do client-side */
  }
}

/** Forget the persisted session (sign out). */
export function clearAuth() {
  if (!hasStorage()) return;
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    /* ignore */
  }
}

/* ---------- low-level HTTP helpers (mirror companion.mjs's post()/fetch() calls exactly) ---------- */
async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.error && (j.error.message || j.error)) || `HTTP ${res.status}`);
  return j;
}

async function postForm(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.error && (j.error.message || j.error)) || `HTTP ${res.status}`);
  return j;
}

async function getJson(url, headers) {
  const res = await fetch(url, { headers });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return j;
}

/** Firestore REST field-value decoding — identical to companion.mjs's `fromFs`. */
function fromFs(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFs);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFs(x)]));
  return v;
}
function docToObject(doc) {
  return Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, fromFs(v)]));
}

/** Decode a Firebase ID token's payload without node:buffer — `atob` + UTF-8 fixup. */
function decodeJwtPayload(idToken) {
  const b64 = idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(b64)
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
  );
  return JSON.parse(json);
}

/* ---------- individual network steps — exported so the CORS spike page can time and report
 * each one separately; the composed functions below are what real features should call. ---------- */

/**
 * The Steam OpenID sign-in URL (ported from legacy sync.js). Open this in a new tab: the user
 * logs in on Steam, Steam redirects to legendsofidleon.com/steamsso/?openid… — and THAT full
 * address-bar URL is what gets pasted back into connect(). The assertion in it is single-use
 * and short-lived, hence the copy-paste dance instead of a stored link.
 */
export function steamLoginUrl() {
  return "https://steamcommunity.com/openid/login?" + new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.return_to": STEAM_RETURN,
    "openid.realm": STEAM_RETURN,
  });
}

/** Step 1/6 — exchange the pasted steamsso redirect URL for a Firebase custom token. */
export async function steamExchange(redirectUrl) {
  if (!redirectUrl?.startsWith(STEAM_RETURN)) throw new Error("Paste the full legendsofidleon.com/steamsso/… URL");
  const p = Object.fromEntries(new URL(redirectUrl).searchParams);
  const claimedId = (p["openid.claimed_id"] || "").match(/\/(\d+)$/)?.[1];
  if (!claimedId) throw new Error("No SteamID in that URL");
  const fn = await postJson("https://us-central1-idlemmo.cloudfunctions.net/asil", {
    data: {
      claimedId,
      nonce: p["openid.response_nonce"],
      assocHandle: p["openid.assoc_handle"],
      sig: p["openid.sig"],
      signed: p["openid.signed"],
    },
  });
  if (!fn.result) throw new Error("Token exchange failed (assertion expired? sign in again)");
  return fn.result; // Firebase custom token
}

/** Step 2/6 — trade the custom token for a Firebase ID/refresh token pair. */
export async function signInWithCustomToken(customToken) {
  const auth = await postJson(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
    token: customToken,
    returnSecureToken: true,
  });
  const uid = decodeJwtPayload(auth.idToken).user_id;
  return { uid, idToken: auth.idToken, refreshToken: auth.refreshToken };
}

/** Step 3/6 — exchange a refresh token for a fresh ID token (also rotates the refresh token). */
export async function refreshSecureToken(refreshTok) {
  const t = await postForm(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
    grant_type: "refresh_token",
    refresh_token: refreshTok,
  });
  return { idToken: t.id_token, refreshToken: t.refresh_token, uid: t.user_id };
}

/** Step 4/6 — Firestore `_data/{uid}`: the save itself. */
export async function fetchSaveDoc(uid, idToken) {
  const doc = await getJson(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/_data/${uid}`, {
    Authorization: `Bearer ${idToken}`,
  });
  return docToObject(doc);
}

/** Step 5/6a — Realtime DB `_uid/{uid}`: character names, best-effort (null on failure). */
export async function fetchCharNames(uid, idToken) {
  const j = await getJson(`https://idlemmo.firebaseio.com/_uid/${uid}.json?auth=${idToken}`);
  return j ? Object.values(j) : null;
}

/** Step 5/6b — Realtime DB `_comp/{uid}`: companion ownership (native-bridge data, not in the save). */
export async function fetchCompanions(uid, idToken) {
  const j = await getJson(`https://idlemmo.firebaseio.com/_comp/${uid}.json?auth=${idToken}`);
  return j ?? null;
}

/** Step 6/6 — Firestore `_vars/_vars`: server-side remote config (active vote, artifact odds). */
export async function fetchServerVars(idToken) {
  const doc = await getJson(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/_vars/_vars`, {
    Authorization: `Bearer ${idToken}`,
  });
  return docToObject(doc);
}

/* ---------- composed API — what real features (later packages) should import ---------- */

/** One-time login: paste the steamsso redirect URL, get connected. Persists the session. */
export async function connect(redirectUrl) {
  const customToken = await steamExchange(redirectUrl);
  const { uid, refreshToken } = await signInWithCustomToken(customToken);
  persistAuth(uid, refreshToken);
  return uid;
}

/** Refresh the persisted session. Rotates the stored refresh token if the server issues a new one. */
export async function refreshToken() {
  const a = getAuth();
  if (!a) throw new Error("Not connected — call connect(url) first");
  const t = await refreshSecureToken(a.refreshToken);
  const uid = t.uid || a.uid;
  if (t.refreshToken && t.refreshToken !== a.refreshToken) persistAuth(uid, t.refreshToken);
  return { uid, idToken: t.idToken };
}

/**
 * fetchSave() — the real sync call. Mirrors companion.mjs's `syncNow()` merge semantics exactly:
 *
 *  - `charNames`: best-effort from RTDB `_uid/{uid}`; null on failure (callers fall back to slot
 *    indices, never fake a name).
 *  - `raw.__companions` / `raw.__serverVars`: merged INTO `raw` (not a side channel) because a
 *    later rebuild replays the parser over the *stored* raw — anything outside `raw` would be
 *    invisible to that replay and silently produce companion-less / vars-less history. `__` is
 *    safe because zero real save keys start with an underscore.
 *  - On failure of either, the key is left ABSENT — never set to an empty/zero value. Absent is
 *    read by the stat recipes as "unknown" (or "falls back to calibrated"); it must never be
 *    mistaken for "owns nothing" / "no vote running", which would silently under-report. See
 *    companion.mjs:132-161 and README.md's "Ground rules for game logic" — this is the same
 *    honesty contract, unchanged by the migration.
 *
 * @returns {Promise<{raw: object, charNames: string[]|null}>}
 */
export async function fetchSave() {
  const { uid, idToken } = await refreshToken();
  const raw = await fetchSaveDoc(uid, idToken);

  let charNames = null;
  try {
    charNames = await fetchCharNames(uid, idToken);
  } catch {
    /* best-effort only — charNames stays null */
  }

  try {
    const comp = await fetchCompanions(uid, idToken);
    if (comp) raw.__companions = comp;
    else console.warn("companions: _comp doc empty");
  } catch (e) {
    console.warn("companions: _comp fetch failed:", e.message, "— artifact odds will be a lower bound");
  }

  try {
    raw.__serverVars = await fetchServerVars(idToken);
  } catch (e) {
    console.warn("serverVars: _vars fetch failed:", e.message, "— vote/odds fall back to unknown/calibrated");
  }

  return { raw, charNames };
}
