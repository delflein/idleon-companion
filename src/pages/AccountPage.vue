<script setup>
/**
 * AccountPage — the account.html port. Legacy account.html is an account-infrastructure tile strip
 * (guild / family / obols / star signs, read straight from entities) followed by the generic
 * recipe-breakdown module rendered five times (dropRate, cashMulti, afkGain, classXp, skillXp).
 * The survey confirms account.html carries NO page-local domain logic — its inline JS was a
 * verbatim copy of the shared recipe renderer, which is now StatModule.vue. So this page is five
 * StatModules + the infra strip; every number comes from appState computeds (stats / entities),
 * never a re-implemented formula.
 */
import { computed } from "vue";
import { state, entities, stats, useHistory } from "../data/appState.js";
import StatModule from "../ui/StatModule.vue";
import SpriteIcon from "../ui/SpriteIcon.vue";

const charNames = computed(() => state.value?.charNames ?? []);
const e = computed(() => entities.value ?? null);

/* Same five recipes account.html's RECIPE_MODULES listed, same icons/blurbs. */
const MODULES = [
  { name: "dropRate", title: "Drop Rate", icon: { file: "LootDice", dir: "data" },
    blurb: "Everything adding to or multiplying your loot chance on every kill — additive sources share one pool, multipliers stack on top of it." },
  { name: "cashMulti", title: "Cash Multiplier", icon: { file: "Cash", dir: "data" },
    blurb: "Every source of bonus gold from monster kills and idle income." },
  { name: "afkGain", title: "AFK Gain", icon: { file: "UIafkclaim", dir: "data" },
    blurb: "What multiplies the stats and gold banked while a character is away from the keyboard." },
  { name: "classXp", title: "Class EXP", icon: { file: "ClassIcons0", dir: "data" },
    blurb: "Class experience multiplier — per-character, from talents, cards, and account bonuses." },
  { name: "skillXp", title: "Skill EXP", icon: { file: "SkillInfo1", dir: "data" },
    blurb: "The shared all-skill EXP pool that multiplies every skilling action account-wide." },
];

/** Each module's live stat entry, or null (StatModule renders its "recipe pending" state). */
const statFor = (name) => computed(() => stats.value?.[name] ?? null);
const moduleStats = MODULES.map((m) => ({ ...m, stat: statFor(m.name) }));

/* History keys for every registered module's total + its non-unknown terms (legacy loadHistory). */
const historyKeys = computed(() => {
  const keys = [];
  for (const m of MODULES) {
    const st = stats.value?.[m.name];
    if (!st) continue;
    keys.push(`stat.${m.name}`);
    for (const t of st.collapsed.terms) if (t.status !== "unknown") keys.push(`stat.${m.name}.${t.id}`);
  }
  return keys;
});
const { series } = useHistory(() => historyKeys.value);

/* ---- account infrastructure strip (entities.guild/family/obols/starSigns) ----
 * These entity shapes are now known (src/core/domain.mjs): guild {level:null, bonusPoints},
 * family {count,total}, obols {filled,total}, starSigns {unlocked,equipped,total}. Guild's account
 * "level" isn't in the save (always null), so — unlike legacy account.html, which then showed the
 * tile as "not parsed yet" — we surface the datum that IS parsed (bonus points spent). Each tile
 * still degrades to "not parsed yet" if its whole entity is missing on the snapshot. */
const infra = computed(() => {
  if (!e.value) return null;
  const g = e.value.guild, fam = e.value.family, ob = e.value.obols, ss = e.value.starSigns;
  return [
    g
      ? { icon: { file: "Guild", dir: "etc" }, label: "Guild bonus pts", value: String(g.bonusPoints ?? 0), sub: "points spent on guild bonuses" }
      : { icon: { file: "Guild", dir: "etc" }, label: "Guild", pending: true },
    fam && fam.count != null
      ? { icon: { file: "CharFam0", dir: "etc" }, label: "Family bonuses", value: String(fam.count), sub: fam.total != null ? `of ${fam.total} tiers` : "active family bonuses" }
      : { icon: { file: "CharFam0", dir: "etc" }, label: "Family bonuses", pending: true },
    ob && ob.filled != null
      ? { icon: { file: "ObolEmpty1", dir: "etc" }, label: "Obol slots", value: `${ob.filled}${ob.total != null ? ` / ${ob.total}` : ""}`, sub: ob.total != null ? `${ob.total - ob.filled} empty across your characters` : "filled across your characters" }
      : { icon: { file: "ObolEmpty1", dir: "etc" }, label: "Obol slots", pending: true },
    ss && ss.unlocked != null
      ? { icon: { file: "Star4", dir: "etc" }, label: "Star signs", value: `${ss.equipped ?? "—"}${ss.unlocked != null ? ` / ${ss.unlocked}` : ""}`, sub: ss.total != null ? `${ss.unlocked} of ${ss.total} unlocked` : "equipped / unlocked" }
      : { icon: { file: "Star4", dir: "etc" }, label: "Star signs", pending: true },
  ];
});
</script>

<template>
  <header class="app">
    <h1>
      <SpriteIcon
        file="Tome_0"
        dir="etc"
        :size="26"
      />
      Account
    </h1>
  </header>
  <div
    id="err"
    class="err"
  />

  <section
    v-if="infra"
    class="panel"
  >
    <h2>
      Account infrastructure
      <span class="hint">levers that aren't stat recipes — read straight from the save</span>
    </h2>
    <div class="cards">
      <div
        v-for="(t, i) in infra"
        :key="i"
        class="tile"
        :class="{ pending: t.pending }"
      >
        <SpriteIcon
          :file="t.icon.file"
          :dir="t.icon.dir"
          :size="28"
        />
        <div class="label">
          {{ t.label }}
        </div>
        <div class="value">
          {{ t.pending ? "—" : t.value }}
        </div>
        <div class="sub">
          {{ t.pending ? "not parsed yet" : t.sub }}
        </div>
      </div>
    </div>
  </section>

  <StatModule
    v-for="m in moduleStats"
    :key="m.name"
    :stat="m.stat.value"
    :title="m.title"
    :icon="m.icon"
    :blurb="m.blurb"
    :char-names="charNames"
    :series="series"
  />
</template>

<style scoped>
.tile.pending { opacity: .5; }
section.panel { margin-bottom: var(--gap); }
</style>
