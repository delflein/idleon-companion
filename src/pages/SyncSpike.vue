<script setup>
/* CORS spike (docs/ARCHITECTURE.md D4/D5): proves the real save-sync network calls reach Google's
 * endpoints from a *.github.io origin. No save parsing happens here — this only proves the
 * network layer works; src/data/sync.js's exported API is what later packages build the real
 * sync feature on.
 *
 * Six calls, matching the ARCHITECTURE.md D4/D5 tally (RTDB _uid + _comp count as one row there):
 *   1. Steam asil exchange     4. Firestore _data (the save)
 *   2. Firebase custom sign-in 5. RTDB _uid + _comp
 *   3. securetoken refresh     6. Firestore _vars
 */
import { ref } from "vue";
import {
  getAuth,
  connect,
  steamExchange,
  signInWithCustomToken,
  refreshSecureToken,
  fetchSaveDoc,
  fetchCharNames,
  fetchCompanions,
  fetchServerVars,
} from "../data/sync.js";

const url = ref("");
const connecting = ref(false);
const connectError = ref("");
const connectedUid = ref(getAuth()?.uid ?? null);

const STEPS = [
  "Steam asil exchange",
  "Firebase custom-token sign-in",
  "securetoken refresh",
  "Firestore _data (save)",
  "RTDB _uid + _comp",
  "Firestore _vars",
];

const rows = ref(STEPS.map((label) => ({ label, status: "idle", ms: 0, detail: "", error: "" })));
const running = ref(false);

/** fetch() rejects with a generic TypeError for both CORS blocks and plain network failures —
 * the browser deliberately hides which, for security. This is the best a page can do to flag it. */
function describeError(e) {
  if (e instanceof TypeError) return `network/CORS error: ${e.message}`;
  return e.message || String(e);
}

async function timeRow(i, fn) {
  const row = rows.value[i];
  row.status = "running";
  row.error = "";
  row.detail = "";
  const t0 = performance.now();
  try {
    const detail = await fn();
    row.ms = Math.round(performance.now() - t0);
    row.status = "pass";
    row.detail = detail || "";
    return { ok: true };
  } catch (e) {
    row.ms = Math.round(performance.now() - t0);
    row.status = "fail";
    row.error = describeError(e);
    return { ok: false, error: e };
  }
}

function skipRow(i, reason) {
  const row = rows.value[i];
  row.status = "skip";
  row.ms = 0;
  row.detail = reason;
  row.error = "";
}

async function onConnect() {
  connecting.value = true;
  connectError.value = "";
  try {
    connectedUid.value = await connect(url.value);
  } catch (e) {
    connectError.value = e.message || String(e);
  } finally {
    connecting.value = false;
  }
}

async function runSpike() {
  running.value = true;
  rows.value = STEPS.map((label) => ({ label, status: "idle", ms: 0, detail: "", error: "" }));

  let customToken = null;
  let uid = null;
  let idToken = null;

  // Rows 1-2 need a freshly pasted URL (Steam OpenID assertions are single-use). If the box is
  // empty but we already have a persisted session, skip straight to the refresh leg (row 3).
  if (url.value.trim()) {
    const r1 = await timeRow(0, async () => {
      customToken = await steamExchange(url.value);
      return `custom token: ${customToken.length} chars`;
    });
    if (r1.ok) {
      const r2 = await timeRow(1, async () => {
        const signIn = await signInWithCustomToken(customToken);
        uid = signIn.uid;
        idToken = signIn.idToken;
        return `uid ${uid}`;
      });
      if (!r2.ok) uid = null;
    } else {
      skipRow(1, "asil exchange failed");
    }
  } else {
    skipRow(0, "no URL pasted — reusing stored session");
    skipRow(1, "no URL pasted — reusing stored session");
  }

  // Row 3: securetoken refresh. Uses the id/refresh token pair we just minted above if rows 1-2
  // ran, otherwise the persisted session from a previous Connect / page load.
  const auth = getAuth();
  const refreshTok = idToken ? null : auth?.refreshToken;
  if (idToken) {
    rows.value[2].status = "skip";
    rows.value[2].detail = "used the token pair from rows 1-2 directly";
  } else if (!refreshTok) {
    skipRow(2, "not connected — paste a URL and click Connect, or fill the box above and Run spike");
  } else {
    const r3 = await timeRow(2, async () => {
      const t = await refreshSecureToken(refreshTok);
      uid = t.uid || auth.uid;
      idToken = t.idToken;
      return `uid ${uid}`;
    });
    if (!r3.ok) { uid = null; idToken = null; }
  }

  if (!uid || !idToken) {
    skipRow(3, "no valid session");
    skipRow(4, "no valid session");
    skipRow(5, "no valid session");
    running.value = false;
    return;
  }

  await timeRow(3, async () => {
    const raw = await fetchSaveDoc(uid, idToken);
    return `_data: ${Object.keys(raw).length} keys`;
  });

  await timeRow(4, async () => {
    const [charNames, comp] = await Promise.all([fetchCharNames(uid, idToken), fetchCompanions(uid, idToken)]);
    const compDesc = comp ? `${Object.keys(comp).length} keys` : "absent (empty doc)";
    return `_uid: ${charNames ? charNames.length : 0} chars, _comp: ${compDesc}`;
  });

  await timeRow(5, async () => {
    const vars = await fetchServerVars(idToken);
    return `_vars: ${Object.keys(vars).length} keys`;
  });

  running.value = false;
}
</script>

<template>
  <section>
    <h2>Sync spike</h2>
    <p>
      Proves the six save-sync network calls (docs/ARCHITECTURE.md D4) actually reach Google's
      endpoints from this GitHub Pages origin, before anything real is built on them. No save
      parsing happens here.
    </p>

    <div class="connect-row">
      <input
        v-model="url"
        type="text"
        placeholder="Paste the legendsofidleon.com/steamsso/… redirect URL"
        class="url-input"
      >
      <button
        :disabled="connecting"
        @click="onConnect"
      >
        {{ connecting ? "Connecting…" : "Connect" }}
      </button>
      <button
        :disabled="running"
        @click="runSpike"
      >
        {{ running ? "Running…" : "Run spike" }}
      </button>
    </div>
    <p
      v-if="connectedUid"
      class="status-line"
    >
      Connected: uid {{ connectedUid }}
    </p>
    <p
      v-if="connectError"
      class="status-line error"
    >
      Connect failed: {{ connectError }}
    </p>

    <table class="spike-table">
      <thead>
        <tr>
          <th>Call</th>
          <th>Status</th>
          <th>ms</th>
          <th>Detail / error</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.label"
          :class="'row-' + row.status"
        >
          <td>{{ row.label }}</td>
          <td>{{ row.status }}</td>
          <td>{{ row.ms || "" }}</td>
          <td>{{ row.error || row.detail }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.connect-row {
  display: flex;
  gap: 0.5rem;
  margin: 1rem 0;
}

.url-input {
  flex: 1;
  min-width: 0;
  padding: 0.4rem 0.6rem;
  background: #1a1d26;
  border: 1px solid #2c3140;
  color: #e6e8ee;
  border-radius: 4px;
}

button {
  padding: 0.4rem 0.9rem;
  background: #2c3140;
  color: #e6e8ee;
  border: 1px solid #3a4054;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}

.status-line {
  font-size: 0.9rem;
  color: #9aa4b8;
}

.status-line.error {
  color: #e07a7a;
}

.spike-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.spike-table th,
.spike-table td {
  text-align: left;
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid #262a35;
}

.row-pass {
  color: #7ad19c;
}

.row-fail {
  color: #e07a7a;
}

.row-skip {
  color: #6b7280;
}
</style>
