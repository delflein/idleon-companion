<script setup>
/**
 * DivinityPage — the divinity.html port. Legacy divinity.html is a KPI tile + one expandable
 * 10-god table (level/cost-to-next/major-value/minor-link bonus/linked chars) — no recipe module,
 * no per-char selector (docs/migration/survey-pages.md: "entities.w5.divinity; GLOSS.gods/
 * godRankMax... expandable god table (hand-rolled expander, not via shared module), tooltips").
 * `entities.w5.divinity` is already the fully-derived per-god shape domain.mjs builds — this page
 * only picks how to lay it out, no page-local math.
 */
import { computed, ref } from "vue";
import { state, entities } from "../data/appState.js";
import { w5Glossary } from "../data/derived.js";
import SpriteIcon from "../ui/SpriteIcon.vue";
import LevelBar from "../ui/LevelBar.vue";
import { fmt } from "../ui/fmt.js";

const GLOSS = w5Glossary();

const w5 = computed(() => entities.value?.w5 ?? null);
const divinity = computed(() => w5.value?.divinity ?? null);

/* Entity text already has "_" -> " " (domain.mjs); this strips the N.js value-placeholder
 * punctuation ("{", "}", "#", etc.) that domain.mjs leaves untouched. Ports legacy `stripPh()`
 * (divinity.html/palette.html/slab.html) — a small display-text cleaner, not domain logic, so it
 * stays local rather than growing a new src/core/ module or touching the shared fmt.js. */
function stripPh(s) {
  return String(s ?? "").replace(/[{}<>$@#]/g, "").replace(/\s+/g, " ").trim();
}

const CURRENCY_LABEL = { bits: "Bits", sailingGold: "Sailing Gold", coins: "Coins", particles: "Particles" };

function currencyLabel(c) {
  return CURRENCY_LABEL[c] ?? c;
}

function afford(g) {
  if (g.currencyOnHand == null || g.costToNext == null) return { text: "unknown", cls: "soon" };
  if (g.currencyOnHand >= g.costToNext) return { text: "can afford", cls: "live" };
  return { text: `need ${fmt(g.costToNext - g.currencyOnHand)} more`, cls: null };
}

function charName(i) {
  return state.value?.charNames?.[i] ?? "char " + i;
}

function godGloss(idx) {
  return GLOSS?.gods?.find((x) => x.idx === idx) ?? null;
}

const expanded = ref(new Set());
function toggle(idx) {
  const next = new Set(expanded.value);
  next.has(idx) ? next.delete(idx) : next.add(idx);
  expanded.value = next;
}
</script>

<template>
  <header class="app">
    <h1>Divinity</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="divinity">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="Divinity"
          dir="afk_targets"
          :size="28"
        />
        <div class="label">
          God Rank
        </div>
        <div class="value">
          {{ divinity.godRank }}<span class="of">/{{ GLOSS?.godRankMax ?? 10 }}</span>
        </div>
        <div class="sub">
          {{ fmt(divinity.particles) }} particles
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        <SpriteIcon
          file="Divinity"
          dir="afk_targets"
          :size="20"
        />
        Divinity
        <span class="hint">
          The Altar — 10 gods, each with a MINOR passive (from linking) and a levelable MAJOR
          blessing paid in that god's own currency.
          <span
            class="tip"
            :title="`God Rank (0-${GLOSS?.godRankMax ?? 10}) gates which gods are even selectable — it advances via the Offering mini-game, which spends Divinity Points (not bits/gold/coins) at a tiered risk/reward chance you pick each attempt. Once every god is unlocked (rank 10), a Jade Emporium node scales every MAJOR blessing further.`"
          >ⓘ</span>
        </span>
      </h2>
      <div
        class="cards"
        style="margin-bottom:10px"
      >
        <div class="tile">
          <SpriteIcon
            file="Divinity"
            dir="afk_targets"
            :size="28"
          />
          <div class="label">
            God Rank
          </div>
          <div class="value">
            {{ divinity.godRank }}<span class="of">/{{ GLOSS?.godRankMax ?? 10 }}</span>
          </div>
          <div class="sub">
            gates which gods are selectable
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Divinity Points
          </div>
          <div class="value">
            {{ fmt(divinity.points) }}
          </div>
          <div class="sub">
            spent on Offerings (God Rank) &amp; CoralKid
          </div>
        </div>
        <div class="tile">
          <div class="label">
            Particles
          </div>
          <div class="value">
            {{ fmt(divinity.particles) }}
          </div>
          <div class="sub">
            currency for 3 gods' blessings
          </div>
        </div>
      </div>

      <div class="scroll">
        <table>
          <tr>
            <th>God</th><th>Major blessing level</th><th>Cost to next</th><th class="num">
              Major value
            </th><th>Minor (link) bonus</th><th>Linked chars</th>
          </tr>
          <template
            v-for="g in divinity.gods"
            :key="g.idx"
          >
            <tr
              class="expander"
              @click="toggle(g.idx)"
            >
              <td>
                <b>{{ g.name }}</b>
                <span
                  v-if="g.maxLevelLowerBound"
                  class="chip soon"
                  title="Cap can rise further from CoralKid/Minehead/Vault sources not fully derivable yet."
                >cap may be higher</span>
              </td>
              <td>
                <LevelBar
                  :level="g.level"
                  :max-level="g.maxLevel"
                  extended-note="Above the recorded max level."
                />
              </td>
              <td>
                {{ fmt(g.costToNext) }} <span class="of">{{ currencyLabel(g.currency) }}</span>
                <div class="expr">
                  <span
                    class="chip"
                    :class="afford(g).cls"
                  >{{ afford(g).text }}</span>
                </div>
              </td>
              <td class="num">
                <span v-if="g.majorValueKnown">+{{ fmt(g.majorValue) }}%</span>
                <span
                  v-else
                  class="chip soon"
                  title="Bespoke [0.1x,1.8x] efficiency-driven curve, not the generic level x multi x emporium form every other god uses — not modeled."
                >unmodeled</span>
              </td>
              <td class="note">
                {{ stripPh(g.minorDesc) }}
              </td>
              <td class="note">
                {{ g.linkedChars.length ? g.linkedChars.map(charName).join(", ") : "—" }}
              </td>
            </tr>
            <tr
              v-if="expanded.has(g.idx)"
              class="parts"
            >
              <td colspan="6">
                <div class="partrow">
                  <b>Fixed ability (always on, not level-scaled):</b> {{ godGloss(g.idx) ? stripPh(godGloss(g.idx).majorDesc) : "" }}
                </div>
                <div class="partrow">
                  The <b>Major value</b> column is a SEPARATE levelable percent that feeds
                  Divinity's own output-multiplier chain for some gods — it does not scale the
                  fixed-ability text above.
                </div>
                <div
                  v-if="godGloss(g.idx)?.giftFlavor"
                  class="partrow expr"
                >
                  "{{ godGloss(g.idx).giftFlavor }}"
                </div>
              </td>
            </tr>
          </template>
        </table>
      </div>
      <p
        class="note"
        style="margin-top:6px"
      >
        Click a row for its full blessing description. Minor-link bonus is a documented LOWER
        BOUND on the account page's Divinity numbers (the BIG_P alchemy bubble and a CoralKid
        upgrade aren't fully read from the save yet) — not re-derived here.
      </p>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w5</code> entity on this snapshot yet.
  </p>
</template>
