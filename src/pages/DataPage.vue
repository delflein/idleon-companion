<script setup>
/* DataPage (route /data) — the data-layer control surface (docs/ARCHITECTURE.md D3/D4/D5):
 * connect, sync, auto-sync interval, snapshot inventory, rebuild-from-raws, import/export backup,
 * and the iOS-eviction storage controls (D5). Talks only to src/data/* — no core/UI reach-in.
 */
import { ref, reactive, onMounted, onUnmounted, computed } from "vue";
import { getAuth, connect, steamLoginUrl } from "../data/sync.js";
import { state, lastSync, init, syncNow, statInputs, setStatInput } from "../data/appState.js";
import { snapshotStats, getSetting, setSetting } from "../data/db.js";
import { rebuildInWorker } from "../data/workerClient.js";
import { importFile, exportFile } from "../data/importExport.js";

const AUTO_OPTIONS = [0, 1, 5, 15, 60]; // minutes; 0 = OFF

const connectedUid = ref(getAuth()?.uid ?? null);
const url = ref("");
const connecting = ref(false);
const busy = reactive({ sync: false, rebuild: false, import: false });
const message = ref("");
const errorMsg = ref("");

const snaps = ref({ count: 0, first: null, last: null });
const autoMin = ref(0);
const progress = ref(null); // {done,total} during rebuild/import
const storage = ref(null); // {usage,quota} from navigator.storage.estimate()
const persisted = ref(null); // boolean | null

let autoTimer = null;

const lastSyncLabel = computed(() => (lastSync.value ? `${lastSync.value.ts} (${lastSync.value.source})` : "never"));
const charCount = computed(() => state.value?.charNames?.length ?? state.value?.save?.charIdxs?.length ?? 0);

function flash(msg) {
  message.value = msg;
  errorMsg.value = "";
}
function fail(e) {
  errorMsg.value = e?.message || String(e);
}

async function refreshStats() {
  snaps.value = await snapshotStats();
}

async function refreshStorage() {
  if (navigator.storage?.estimate) storage.value = await navigator.storage.estimate();
  if (navigator.storage?.persisted) persisted.value = await navigator.storage.persisted();
}

function applyAutoTimer() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = null;
  if (autoMin.value > 0) {
    autoTimer = setInterval(() => {
      syncNow("auto").then(refreshStats).catch((e) => console.error("auto-sync:", e.message));
    }, autoMin.value * 60_000);
  }
}

async function onConnect() {
  connecting.value = true;
  errorMsg.value = "";
  try {
    connectedUid.value = await connect(url.value);
    url.value = "";
    flash(`Connected: uid ${connectedUid.value}`);
  } catch (e) {
    fail(e);
  } finally {
    connecting.value = false;
  }
}

async function onSync() {
  busy.sync = true;
  errorMsg.value = "";
  try {
    const r = await syncNow("manual");
    await refreshStats();
    await refreshStorage();
    flash(`Synced snapshot ${r.id} at ${r.ts} (${r.metricsCount} metrics)`);
  } catch (e) {
    fail(e);
  } finally {
    busy.sync = false;
  }
}

async function onAutoChange() {
  await setSetting("autoRefreshMin", autoMin.value);
  applyAutoTimer();
  flash(autoMin.value ? `Auto-sync every ${autoMin.value} min (while the app is open)` : "Auto-sync OFF");
}

async function onRebuild() {
  busy.rebuild = true;
  progress.value = { done: 0, total: 0 };
  errorMsg.value = "";
  try {
    const count = await rebuildInWorker((p) => (progress.value = p));
    await init(); // re-read the (unchanged raws, refreshed derived) latest snapshot into memory
    await refreshStats();
    flash(`Rebuilt daily metrics from ${count} raw snapshots`);
  } catch (e) {
    fail(e);
  } finally {
    busy.rebuild = false;
    progress.value = null;
  }
}

async function onImport(ev) {
  const file = ev.target.files?.[0];
  if (!file) return;
  busy.import = true;
  progress.value = null;
  errorMsg.value = "";
  try {
    const res = await importFile(file, { onProgress: (p) => (progress.value = p) });
    await init();
    await refreshStats();
    await refreshStorage();
    flash(res.format === "sqlite" ? `Imported ${res.snapshots} snapshots (rebuilt ${res.rebuilt})` : "Imported dexie backup");
  } catch (e) {
    fail(e);
  } finally {
    busy.import = false;
    progress.value = null;
    ev.target.value = "";
  }
}

async function onExport() {
  errorMsg.value = "";
  try {
    const blob = await exportFile();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `idleon-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    flash("Backup downloaded");
  } catch (e) {
    fail(e);
  }
}

async function onPersist() {
  try {
    if (navigator.storage?.persist) persisted.value = await navigator.storage.persist();
    flash(persisted.value ? "Storage marked persistent (eviction-protected)" : "Persistent storage denied by the browser");
  } catch (e) {
    fail(e);
  }
}

function fmtBytes(n) {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 / 1024).toFixed(1)} MiB`;
}

onMounted(async () => {
  try {
    await init();
    autoMin.value = Number(await getSetting("autoRefreshMin", "0")) || 0;
    applyAutoTimer();
    await refreshStats();
    await refreshStorage();
  } catch (e) {
    fail(e);
  }
});

onUnmounted(() => {
  if (autoTimer) clearInterval(autoTimer);
});
</script>

<template>
  <section class="data-page">
    <h2>Data</h2>

    <p
      v-if="message"
      class="status ok"
    >
      {{ message }}
    </p>
    <p
      v-if="errorMsg"
      class="status err"
    >
      {{ errorMsg }}
    </p>

    <!-- Connect (the legacy dashboard connect-modal flow: sign in on Steam, copy the redirect
         URL you land on, paste it back — the OpenID assertion is single-use, so this cannot be
         a plain one-click login) -->
    <div class="card">
      <h3>Connection</h3>
      <p
        v-if="connectedUid"
        class="muted"
      >
        Connected — uid {{ connectedUid }}
      </p>
      <ol
        v-else
        class="connect-steps"
      >
        <li>
          <a
            class="steambtn"
            :href="steamLoginUrl()"
            target="_blank"
            rel="noopener"
          >Sign in through Steam ↗</a> — log in on the page that opens.
        </li>
        <li>You'll land on <b>legendsofidleon.com/steamsso/…</b> — copy the <b>full URL</b> from the address bar.</li>
        <li>Paste it here and hit Connect:</li>
      </ol>
      <div class="row">
        <input
          v-model="url"
          type="text"
          placeholder="https://www.legendsofidleon.com/steamsso/?openid…"
          spellcheck="false"
          class="grow"
        >
        <button
          :disabled="connecting"
          @click="onConnect"
        >
          {{ connecting ? "Connecting…" : "Connect" }}
        </button>
      </div>
    </div>

    <!-- Sync -->
    <div class="card">
      <h3>Sync</h3>
      <div class="row">
        <button
          :disabled="busy.sync || !connectedUid"
          @click="onSync"
        >
          {{ busy.sync ? "Syncing…" : "Sync now" }}
        </button>
        <label class="row inline">
          Auto-sync
          <select
            v-model.number="autoMin"
            @change="onAutoChange"
          >
            <option
              v-for="m in AUTO_OPTIONS"
              :key="m"
              :value="m"
            >
              {{ m === 0 ? "OFF" : m + " min" }}
            </option>
          </select>
        </label>
      </div>
      <p class="muted">
        Last sync: {{ lastSyncLabel }}<span v-if="charCount"> · {{ charCount }} characters</span>
      </p>
    </div>

    <!-- Snapshots / rebuild -->
    <div class="card">
      <h3>Snapshots</h3>
      <p class="muted">
        {{ snaps.count }} snapshot{{ snaps.count === 1 ? "" : "s" }}
        <span v-if="snaps.count"> · {{ snaps.first.slice(0, 10) }} → {{ snaps.last.slice(0, 10) }}</span>
      </p>
      <div class="row">
        <button
          :disabled="busy.rebuild || !snaps.count"
          @click="onRebuild"
        >
          {{ busy.rebuild ? "Rebuilding…" : "Rebuild derived metrics" }}
        </button>
        <span
          v-if="progress"
          class="muted"
        >{{ progress.done }} / {{ progress.total }}</span>
      </div>
    </div>

    <!-- Backup -->
    <div class="card">
      <h3>Backup</h3>
      <div class="row">
        <label class="filebtn">
          {{ busy.import ? "Importing…" : "Import file" }}
          <input
            type="file"
            accept=".json,.gz,application/json,application/gzip"
            :disabled="busy.import"
            hidden
            @change="onImport"
          >
        </label>
        <button @click="onExport">
          Export backup
        </button>
      </div>
      <p class="muted">
        Import accepts a dexie backup or the SQLite-era idleon-export.json.gz. Export is the ongoing
        backup format — treat it as the source of truth (iOS may evict local data, D5).
      </p>
    </div>

    <!-- Storage -->
    <div class="card">
      <h3>Storage</h3>
      <p
        v-if="storage"
        class="muted"
      >
        Using {{ fmtBytes(storage.usage) }} of {{ fmtBytes(storage.quota) }}
        · persistent: {{ persisted === null ? "unknown" : persisted ? "yes" : "no" }}
      </p>
      <p
        v-else
        class="muted"
      >
        Storage estimate unavailable in this browser.
      </p>
      <button
        :disabled="persisted === true"
        @click="onPersist"
      >
        Request persistent storage
      </button>
    </div>

    <!-- Manual stat inputs (blank = honestly unknown, never guessed) -->
    <div class="card">
      <h3>Manual stat inputs</h3>
      <p class="muted">
        Values the save can't supply. Leave blank to keep the dependent stats honestly unknown.
      </p>
      <label class="field">
        Tome points
        <input
          :value="statInputs.statTomePoints"
          type="text"
          placeholder="e.g. 44931"
          @change="setStatInput('statTomePoints', $event.target.value)"
        >
      </label>
      <label class="field">
        Lab-connected char ids
        <input
          :value="statInputs.statLabConnected"
          type="text"
          placeholder="comma-separated, e.g. 0,2,5"
          @change="setStatInput('statLabConnected', $event.target.value)"
        >
      </label>
      <label class="field">
        Active vote id
        <input
          :value="statInputs.statActiveVote"
          type="text"
          placeholder="e.g. 12"
          @change="setStatInput('statActiveVote', $event.target.value)"
        >
      </label>
    </div>
  </section>
</template>

<style scoped>
.connect-steps { margin: 0 0 10px; padding-left: 20px; color: var(--ink-muted, #9aa4b8); font-size: 13px; }
.connect-steps li { margin: 4px 0; }
.steambtn {
  display: inline-block; padding: 5px 12px; border-radius: 7px; font-weight: 700; font-size: 13px;
  background: var(--series-1, #4c7dd4); color: #fff; text-decoration: none;
}

.data-page {
  max-width: 720px;
}

.card {
  background: #161922;
  border: 1px solid #262a35;
  border-radius: 8px;
  padding: 0.9rem 1rem;
  margin: 0.9rem 0;
}

.card h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}

.row {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  flex-wrap: wrap;
}

.row.inline {
  gap: 0.4rem;
}

.grow {
  flex: 1;
  min-width: 0;
}

.muted {
  color: #9aa4b8;
  font-size: 0.88rem;
  margin: 0.4rem 0 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: #9aa4b8;
  margin-top: 0.6rem;
}

input,
select {
  padding: 0.4rem 0.6rem;
  background: #1a1d26;
  border: 1px solid #2c3140;
  color: #e6e8ee;
  border-radius: 4px;
  font: inherit;
}

button,
.filebtn {
  padding: 0.4rem 0.9rem;
  background: #2c3140;
  color: #e6e8ee;
  border: 1px solid #3a4054;
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}

.status {
  font-size: 0.9rem;
  padding: 0.5rem 0.7rem;
  border-radius: 4px;
}

.status.ok {
  background: #16241a;
  color: #7ad19c;
}

.status.err {
  background: #241616;
  color: #e07a7a;
}
</style>
