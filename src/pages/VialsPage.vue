<script setup>
/**
 * VialsPage — the vials.html port. Legacy vials.html is two independent tables (no shared recipe
 * module — no `stats`/`history` fetch at all; docs/migration/survey-pages.md: "entities.w2.vials[],
 * entities.w2.sigils[]; GLOSS.vialEffects/sigilEffects ... (no stats/history)"). `TIER_NAMES` and
 * `VIAL_MAX_LEVEL=13` are lookup/display constants, not formulas (survey: "duplicate knowledge that
 * ideally lives in gamedata-w2-vials.mjs/gamedata-w2-sigils.mjs" but not flagged as a page-local
 * calculation) — kept here verbatim, same as legacy, rather than invented as new src/core work.
 */
import { computed } from "vue";
import { entities } from "../data/appState.js";
import { w2Glossary } from "../data/derived.js";
import ShowMore from "../ui/ShowMore.vue";
import LevelBar from "../ui/LevelBar.vue";
import Chip from "../ui/Chip.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";
import { fmt, niceItem } from "../ui/fmt.js";

const VIAL_MAX_LEVEL = 13; // gamedata-w2-vials.mjs: AlchemyVialQTYreq has 14 entries (levels 0-13)

const GLOSS = w2Glossary();
const vialGloss = new Map((GLOSS.vialEffects || []).map((v) => [v.idx, v]));
const sigilGloss = new Map((GLOSS.sigilEffects || []).map((s) => [s.idx, s]));

const w2 = computed(() => entities.value?.w2 ?? null);
const vials = computed(() => w2.value?.vials ?? []); // already filtered to level>0 by domain.mjs
const sigils = computed(() => w2.value?.sigils ?? []);
const sigilsUnlocked = computed(() => sigils.value.filter((s) => s.tier >= 0).length);

const vialsSorted = computed(() => vials.value.slice().sort((a, b) => b.level - a.level));
const sigilsSorted = computed(() => sigils.value.slice().sort((a, b) => (b.tier - a.tier) || (b.progress - a.progress)));

function nextSigilCost(tier, g) {
  if (!g) return null;
  if (tier < 0) return { name: "Unlocked", cost: g.unlockCost };
  if (tier === 0) return { name: "Boost", cost: g.boostCost };
  if (tier === 1) return { name: "Jade", cost: g.jadeCost };
  if (tier === 2) return { name: "Ethereal", cost: g.etherealCost };
  if (tier === 3) return { name: "Eclectic", cost: g.eclecticCost };
  return null; // tier 4 = maxed
}
function tierVariant(tier) {
  return tier < 0 ? "dead" : tier >= 4 ? "live" : tier >= 2 ? "user" : "none";
}
function progressPct(progress, cost) {
  return Math.max(0, Math.min(100, (progress / cost) * 100));
}
</script>

<template>
  <header class="app">
    <h1>Vials &amp; Sigils</h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <template v-if="w2">
    <div class="cards">
      <div class="tile">
        <SpriteIcon
          file="aVials1"
          dir="data"
          :size="28"
        />
        <div class="label">
          Vials leveled
        </div>
        <div class="value">
          {{ vials.length }}<span class="of">/86</span>
        </div>
        <div class="sub">
          up to level 13 each
        </div>
      </div>
      <div class="tile">
        <SpriteIcon
          file="SigilSyrup"
          dir="data"
          :size="28"
        />
        <div class="label">
          Sigils unlocked
        </div>
        <div class="value">
          {{ sigilsUnlocked }}<span class="of">/24</span>
        </div>
        <div class="sub">
          tier Unlocked or higher
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>
        Vials &amp; Sigils
        <span class="hint">Vials: material-only levels, no RNG once unlocked (13 levels). Sigils: a charge meter that fills over time and unlocks progressively higher tiers.</span>
      </h2>

      <h2 class="subhead">
        Vials <span class="of">{{ vials.length }}/86 unlocked</span>
      </h2>
      <ShowMore
        v-slot="{ items }"
        :items="vialsSorted"
        :cap="12"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Vial</th><th>Level</th><th class="num">
                Bonus
              </th><th>Effect</th><th>Status</th>
            </tr>
            <tr
              v-for="v in items"
              :key="v.idx"
            >
              <td><b>{{ niceItem(v.name) }}</b></td>
              <td>
                <LevelBar
                  :level="v.level"
                  :max-level="VIAL_MAX_LEVEL"
                />
              </td>
              <td class="num">
                {{ v.bonus ? "+" + fmt(v.bonus) : "—" }}
              </td>
              <td class="note">
                {{ vialGloss.get(v.idx)?.desc || "" }}
              </td>
              <td><Chip :status="v.status" /></td>
            </tr>
          </table>
        </div>
      </ShowMore>

      <h2
        class="subhead"
        style="margin-top:16px"
      >
        Sigils <span class="of">{{ sigilsUnlocked }}/24 unlocked</span>
        <span
          class="tip"
          title="Sigils unlock and then upgrade through 5 tiers (Unlocked → Boost → Jade → Ethereal → Eclectic) as a charge meter fills — Jade/Ethereal/Eclectic each additionally require a one-time gate elsewhere (Ninja Emporium, Spelunking lore, Lab research)."
        >ⓘ</span>
      </h2>
      <ShowMore
        v-slot="{ items }"
        :items="sigilsSorted"
        :cap="12"
      >
        <div class="scroll">
          <table>
            <tr>
              <th>Sigil</th><th>Tier</th><th class="num">
                Bonus
              </th><th>Progress</th><th>Effect</th><th>Status</th>
            </tr>
            <tr
              v-for="s in items"
              :key="s.idx"
            >
              <td><b>{{ niceItem(s.name) }}</b></td>
              <td>
                <Chip
                  :variant="tierVariant(s.tier)"
                  force
                >
                  {{ s.tierName }}
                </Chip>
              </td>
              <td class="num">
                {{ s.tier >= 0 ? "+" + fmt(s.bonus) : "—" }}
              </td>
              <td>
                <template v-if="nextSigilCost(s.tier, sigilGloss.get(s.idx))">
                  {{ fmt(s.progress) }}<span class="of">/{{ fmt(nextSigilCost(s.tier, sigilGloss.get(s.idx)).cost) }}</span>
                  → {{ nextSigilCost(s.tier, sigilGloss.get(s.idx)).name }}
                  <div
                    class="bar-bg"
                    style="margin-top:3px"
                  >
                    <div
                      class="bar-fill"
                      :style="{ width: progressPct(s.progress, nextSigilCost(s.tier, sigilGloss.get(s.idx)).cost) + '%' }"
                    />
                  </div>
                </template>
                <span
                  v-else
                  class="note"
                >maxed</span>
              </td>
              <td class="note">
                {{ sigilGloss.get(s.idx)?.effect || "" }}
              </td>
              <td><Chip :status="s.status" /></td>
            </tr>
          </table>
        </div>
      </ShowMore>
    </section>
  </template>
  <p
    v-else
    class="note"
  >
    No <code>w2</code> entity on this snapshot yet.
  </p>
</template>

<style scoped>
.subhead { font-size: 13px; margin: 4px 0 8px; }
.tip { cursor: help; color: var(--accent); font-weight: 700; border-bottom: 1px dotted var(--accent); }
</style>
