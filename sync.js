/* sync.js — in-browser IdleOn cloud-save sync (shared by dashboard.html & achievements.html)
 * Same mechanism as IdleOn Toolbox (MIT, github.com/Morta1/IdleonToolbox):
 * Steam OpenID -> game cloud function mints Firebase custom token -> refresh token stored
 * locally -> Firestore REST read of _data/{uid}. Read-only, your own credentials.
 */
/* achievement index maps (268 real slots of 420; 60 steam-exclusive read from SteamAchieve) */
window.ACH_REAL_IDX=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,280,281,282,283,284,285,286,287,288,289,290,291,292,293,294,295,296,297,298,299,300,301,302,303,304,305,306,307,308,309,310,311,350,351,352,353,354,355,356,357,358,359,360,361,362,363,364,365,366,367,368,369,370,371,372,373,374,375,376,377,378,379,380,381,382,383,384];
window.ACH_STEAM_MAP=[[0,42],[1,14],[2,46],[3,45],[5,43],[7,3],[9,9],[11,0],[12,20],[13,17],[14,44],[19,4],[25,33],[28,27],[29,23],[31,28],[35,12],[36,25],[38,29],[39,30],[43,36],[50,39],[51,40],[52,38],[53,41],[55,24],[70,1],[71,5],[72,10],[73,15],[85,18],[86,21],[88,31],[89,32],[90,34],[91,47],[92,51],[105,26],[106,37],[140,2],[141,6],[142,16],[149,52],[150,53],[161,11],[164,13],[165,7],[167,54],[168,55],[172,19],[174,22],[175,35],[177,48],[182,56],[210,60],[214,8],[217,58],[223,59],[236,49],[237,57]];
window.ACH_HARD_IDX=[28,33,38,39,54,61,62,88,89,93,98,100,104,107,110,121,122,145,148,152,156,157,160,167,178,181,184,188,219,221,230,238,239,240,241,282,286,289,295,302,303,304,308,353,357,373,377,378,384];

/* proper achievement count: steam-exclusive entries live in SteamAchieve[steamIndex] */
window.achievesDone = function (achieveReg, steamAchieve) {
  if (!window.ACH_REAL_IDX) return (achieveReg||[]).filter(x=>x===-1).length;
  const steam = Object.fromEntries(window.ACH_STEAM_MAP);
  return window.ACH_REAL_IDX.filter(i => (i in steam) ? steamAchieve[steam[i]]===-1 : achieveReg[i]===-1).length;
};

/* shared metric snapshot (keep in sync with fetch-idleon.mjs) */
window.extractMetrics = function (raw) {
  const J = (v)=>{ if (typeof v==="string"){ try{ return JSON.parse(v);}catch(e){ return v; } } return v; };
  const dictVals = (o)=>Object.keys(o).filter(k=>k!=="length").map(k=>o[k]);
  const sumPos = (a)=>a.reduce((s,x)=>s+(typeof x==="number"&&x>0?x:0),0);
  const P = (k)=>J(raw[k]);
  const m = {};
  let accountLv=0, skillsLv=0;
  for (let i=0;i<13;i++){ if(!(("Lv0_"+i) in raw)) continue; const lv=J(raw["Lv0_"+i]); accountLv+=lv[0]; skillsLv+=sumPos(lv.slice(1)); }
  m.accountLv=accountLv; m.skillsLv=skillsLv;
  const ci=P("CauldronInfo")||[]; let bl=0;
  for (let i=0;i<4&&i<ci.length;i++){ const arr=Array.isArray(ci[i])?ci[i]:dictVals(ci[i]||{}); bl+=sumPos(arr.map(Number).filter(x=>!isNaN(x))); }
  m.bubbleLv=Math.round(bl);
  const st=P("StampLv");
  const stampVals=(Array.isArray(st)?st:[st]).flatMap(pg=>Array.isArray(pg)?pg:(pg&&typeof pg==="object"?dictVals(pg):[pg]));
  m.stampLv=Math.round(sumPos(stampVals.map(Number).filter(x=>!isNaN(x))));
  m.vaultLv=sumPos((P("UpgVault")||[]).slice(0,90));
  const wb=P("WeeklyBoss")||{};
  m.dreamsDone=Object.keys(wb).filter(k=>k.startsWith("d_")&&wb[k]===-1).length;
  m.achievesDone=window.achievesDone(P("AchieveReg")||[], P("SteamAchieve")||[]);
  m.artifactScore=((P("Sailing")||[])[3]||[]).slice(0,41).reduce((s,x)=>s+x,0);
  m.atomLvTotal=sumPos((P("Atoms")||[]).slice(0,15));
  m.greenstacks=(P("GreenStacks")||[]).length;
  m.mealLvTotal=sumPos(((P("Meals")||[])[0]||[]).filter(x=>typeof x==="number").slice(0,74));
  m.cardsFound=Object.keys(P("Cards0")||{}).length;
  m.researchNodes=(((P("Research")||[])[0])||[]).filter(x=>x>0).length;
  m.spelunkZones=(((P("Spelunk")||[])[0])||[]).filter(x=>x>0).length;
  m.emperorShowdown=(P("OptLacc")||[])[369]||0;
  return m;
};

window.IdleonSync = (() => {
  "use strict";
  const API_KEY = "AIzaSyAU62kOE6xhSrFqoXQPv6_WHxYilmoUxDk"; // idlemmo public web key
  const STEAM_RETURN = "https://www.legendsofidleon.com/steamsso/";
  /* server mode: pages served by companion.mjs talk to its API instead of Firebase directly */
  const SERVER = location.protocol.startsWith("http");

  /* guarded storage (falls back to memory when storage is unavailable) */
  const mem = {};
  const canStore = (() => { try { localStorage.setItem("_t","1"); localStorage.removeItem("_t"); return true; } catch(e){ return false; } })();
  const sget = (k) => canStore ? localStorage.getItem(k) : (mem[k] ?? null);
  const sset = (k,v) => { try { if (canStore) localStorage.setItem(k,v); else mem[k]=v; } catch(e){ mem[k]=v; } };
  const sdel = (k) => { if (canStore) localStorage.removeItem(k); delete mem[k]; };

  const getAuth = () => { const a = sget("idleonAuth"); return a ? JSON.parse(a) : null; };

  const steamLoginUrl = () => "https://steamcommunity.com/openid/login?" + new URLSearchParams({
    "openid.ns":"http://specs.openid.net/auth/2.0", "openid.mode":"checkid_setup",
    "openid.claimed_id":"http://specs.openid.net/auth/2.0/identifier_select",
    "openid.identity":"http://specs.openid.net/auth/2.0/identifier_select",
    "openid.return_to":STEAM_RETURN, "openid.realm":STEAM_RETURN
  }).toString();

  async function post(url, body, form) {
    const res = await fetch(url, { method:"POST",
      headers: { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" },
      body: form ? new URLSearchParams(body).toString() : JSON.stringify(body) });
    const j = await res.json().catch(()=> ({}));
    if (!res.ok) throw new Error((j.error && (j.error.message||j.error)) || ("HTTP "+res.status));
    return j;
  }

  /* one-time: exchange the pasted steamsso redirect URL for a stored refresh token */
  async function connect(redirectUrl) {
    if (!redirectUrl || !redirectUrl.startsWith(STEAM_RETURN)) throw new Error("Paste the full legendsofidleon.com/steamsso/… URL");
    const p = Object.fromEntries(new URL(redirectUrl).searchParams);
    const claimedId = (p["openid.claimed_id"]||"").match(/\/(\d+)$/)?.[1];
    if (!claimedId) throw new Error("No SteamID in that URL");
    const fn = await post("https://us-central1-idlemmo.cloudfunctions.net/asil", { data: {
      claimedId, nonce: p["openid.response_nonce"], assocHandle: p["openid.assoc_handle"],
      sig: p["openid.sig"], signed: p["openid.signed"] } });
    if (!fn.result) throw new Error("Token exchange failed (assertion may be expired — sign in again)");
    const auth = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
      { token: fn.result, returnSecureToken: true });
    const uid = JSON.parse(atob(auth.idToken.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).user_id;
    sset("idleonAuth", JSON.stringify({ uid, refreshToken: auth.refreshToken, createdAt: new Date().toISOString() }));
    return uid;
  }

  function disconnect(){ sdel("idleonAuth"); }

  /* Firestore typed JSON -> plain JS */
  function fromFs(v){
    if (v == null) return null;
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return v.doubleValue;
    if ("booleanValue" in v) return v.booleanValue;
    if ("nullValue" in v) return null;
    if ("arrayValue" in v) return (v.arrayValue.values||[]).map(fromFs);
    if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,fromFs(x)]));
    return v;
  }

  /* fetch fresh save; persists copy + daily history snapshot in browser storage */
  async function sync() {
    const a = getAuth();
    if (!a) throw new Error("Not connected");
    const t = await post(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
      { grant_type:"refresh_token", refresh_token:a.refreshToken }, true);
    if (t.refresh_token && t.refresh_token !== a.refreshToken)
      sset("idleonAuth", JSON.stringify({ ...a, refreshToken: t.refresh_token }));
    const uid = t.user_id || a.uid;
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/idlemmo/databases/(default)/documents/_data/${uid}`,
      { headers: { Authorization: "Bearer "+t.id_token } });
    if (!res.ok) throw new Error("Save read failed: HTTP "+res.status);
    const doc = await res.json();
    const raw = Object.fromEntries(Object.entries(doc.fields||{}).map(([k,v])=>[k,fromFs(v)]));
    let charNames = null;
    try {
      const r2 = await fetch(`https://idlemmo.firebaseio.com/_uid/${uid}.json?auth=${t.id_token}`);
      if (r2.ok) { const j = await r2.json(); if (j) charNames = Object.values(j); }
    } catch(e){}
    const meta = { fetchedAt: new Date().toISOString(), charNames, source: "browser" };
    try { sset("idleonRawSave", JSON.stringify(raw)); sset("idleonRawMeta", JSON.stringify(meta)); } catch(e){ mem.idleonRawSave = JSON.stringify(raw); }
    // daily history snapshot (browser-side)
    if (window.extractMetrics) {
      const hist = JSON.parse(sget("idleonHistLocal") || "[]");
      const snap = { ts: meta.fetchedAt, metrics: window.extractMetrics(raw) };
      const last = hist[hist.length-1];
      if (last && last.ts.slice(0,10) === snap.ts.slice(0,10)) hist[hist.length-1] = snap; else hist.push(snap);
      sset("idleonHistLocal", JSON.stringify(hist.slice(-400)));
    }
    return { raw, meta };
  }

  /* newest available save: browser-synced copy vs bundled savedata.js */
  function loadBest() {
    let stored = null, storedMeta = null;
    try { const s = sget("idleonRawSave"); if (s) { stored = JSON.parse(s); storedMeta = JSON.parse(sget("idleonRawMeta")||"{}"); } } catch(e){}
    const fileTime = window.SAVEMETA && window.SAVEMETA.fetchedAt ? Date.parse(window.SAVEMETA.fetchedAt) : 0;
    const storeTime = storedMeta && storedMeta.fetchedAt ? Date.parse(storedMeta.fetchedAt) : 0;
    if (stored && storeTime >= fileTime) return { raw: stored, meta: storedMeta };
    if (window.SAVEGAME) return { raw: window.SAVEGAME, meta: window.SAVEMETA || null };
    return null;
  }

  /* file-based history (history.js) merged with browser-side snapshots, by day */
  function mergedHistory() {
    const byDay = {};
    (window.SAVEHISTORY||[]).forEach(h => byDay[h.ts.slice(0,10)] = h);
    let local = []; try { local = JSON.parse(sget("idleonHistLocal")||"[]"); } catch(e){}
    local.forEach(h => byDay[h.ts.slice(0,10)] = h);
    return Object.keys(byDay).sort().map(k => byDay[k]);
  }

  function downloadSave() {
    const best = loadBest(); if (!best) return;
    const blob = new Blob([JSON.stringify(best.raw)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "savegame.json"; a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---------- server-mode implementations (companion.mjs API) ---------- */
  async function api(path, opts) {
    const res = await fetch(path, opts);
    const j = await res.json().catch(()=> ({}));
    if (!res.ok || j.ok === false) throw new Error(j.error || ("HTTP "+res.status));
    return j;
  }
  let serverState = null; // cache of /api/state
  async function serverInit() {
    serverState = await api("/api/state");
    return serverState;
  }
  async function serverSyncNow() {
    await api("/api/sync", { method:"POST" });
    return serverInit();
  }
  async function serverConnect(redirectUrl) {
    const j = await api("/api/connect", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ url: redirectUrl }) });
    return j.uid;
  }
  async function serverHistory(keys) {
    const j = await api("/api/history" + (keys ? "?keys="+keys.join(",") : ""));
    return j.series;
  }
  async function serverSettings(patch) {
    if (patch) return api("/api/settings", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(patch) });
    return api("/api/settings");
  }

  return { getAuth, steamLoginUrl, connect, disconnect, sync, loadBest, mergedHistory, downloadSave, canStore,
           SERVER, serverInit, serverSyncNow, serverConnect, serverHistory, serverSettings };
})();
