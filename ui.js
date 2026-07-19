/* Shared UI: tone (color theme) persistence + options panel + sprite helper.
 * Include in <head> (not deferred) so the saved tone applies before first paint. */
"use strict";
(() => {
  const TONES = [
    { id: "timber", name: "Timber", sw: ["#191006", "#271c10", "#f0b649"] },
    { id: "ocean",  name: "Ocean",  sw: ["#08121a", "#12232f", "#4fc0e8"] },
    { id: "forest", name: "Forest", sw: ["#0d1207", "#1a2610", "#aacb4e"] },
    { id: "arcane", name: "Arcane", sw: ["#120c1a", "#1e1530", "#b791f0"] },
    { id: "slate",  name: "Slate",  sw: ["#0d0d0d", "#1a1a19", "#3987e5"] },
  ];
  const store = (() => {
    let mem = {};
    let ok = false;
    try { localStorage.setItem("_t", "1"); localStorage.removeItem("_t"); ok = true; } catch (e) {}
    return {
      get: (k) => ok ? localStorage.getItem(k) : (mem[k] ?? null),
      set: (k, v) => { try { ok ? localStorage.setItem(k, v) : (mem[k] = v); } catch (e) { mem[k] = v; } },
    };
  })();

  function applyTone(id) {
    if (id === "timber") delete document.documentElement.dataset.tone;
    else document.documentElement.dataset.tone = id;
  }
  const urlTone = new URLSearchParams(location.search).get("tone");
  const saved = urlTone || store.get("uiTone");
  if (saved && TONES.some(t => t.id === saved)) applyTone(saved);

  /* sprite helper — files live in the bundled toolbox assets, served by companion.mjs */
  function sprite(file, size, dir = "data", cls = "") {
    return `<img class="px ${cls}" src="/idleon-toolbox/public/${dir}/${file}.png" alt="" width="${size}" height="${size}" loading="lazy">`;
  }

  /* options panel — mounts into <span id="uiOptions"></span> in the header */
  function mount() {
    const host = document.getElementById("uiOptions");
    if (!host) return;
    const current = () => document.documentElement.dataset.tone || "timber";
    host.className = "opts-wrap";
    host.innerHTML = `
      <button class="ghost" id="uiOptsBtn" title="Options">⚙</button>
      <div class="opts-pop" id="uiOptsPop">
        <h4>Tone</h4>
        ${TONES.map(t => `
          <button class="tone-row ${t.id === current() ? "on" : ""}" data-tone="${t.id}">
            <span class="sw">${t.sw.map(c => `<i style="background:${c}"></i>`).join("")}</span>
            ${t.name}
          </button>`).join("")}
      </div>`;
    const pop = document.getElementById("uiOptsPop");
    document.getElementById("uiOptsBtn").onclick = (e) => { e.stopPropagation(); pop.classList.toggle("open"); };
    document.addEventListener("click", (e) => { if (!pop.contains(e.target)) pop.classList.remove("open"); });
    pop.querySelectorAll(".tone-row").forEach(b => b.onclick = () => {
      applyTone(b.dataset.tone);
      store.set("uiTone", b.dataset.tone);
      pop.querySelectorAll(".tone-row").forEach(x => x.classList.toggle("on", x === b));
    });
  }
  /* ---------- header nav (see mockups/header-bar.html, variant C: world pills) ----------
   * One IA, rendered into every page's <nav class="pages"></nav>. href present = built page
   * (link); absent = planned (dimmed row + "soon" pill). Nav order:
   * Dashboard · Account ▾ · W1 W2 W3 W4 W5 W6 · Stats ▾ */
  const sp = (file, dir) => sprite(file, 16, dir);
  const WORLDS = [
    { n: 1, name: "Blunder Hills",      items: [
        { t: "Stamps", href: "stamps.html", ic: ["UIstampB", "data"] },
        { t: "Statues", href: "statues.html", ic: ["Statue1", "data"] },
        { t: "Mining", href: "mining.html", ic: ["Copper", "afk_targets"] },
        { t: "Choppin", href: "choppin.html", ic: ["Oak_Tree", "afk_targets"] },
        { t: "Anvil", href: "anvil.html", ic: ["SmithingHammerChisel", "data"] },
        { t: "Owl", href: "owl.html", ic: ["Owl", "etc"] },
        { t: "Forge & Bribes", href: "forge.html", ic: ["ForgeA", "data"] },
    ] },
    { n: 2, name: "Yum-Yum Desert",     items: [
        { t: "Bubbles", href: "bubbles.html", ic: ["AlchBarF1", "data"] },
        { t: "Vials & Sigils", href: "vials.html", ic: ["aVials1", "data"] },
        { t: "Cauldron & Liquids", href: "cauldrons.html", ic: ["Liquid1_x1", "data"] },
        { t: "Fishing (Poppy)", href: "fishing.html", ic: ["Poppy", "afk_targets"] },
        { t: "Weekly (Ballot/Killroy/Islands)", href: "weekly.html", ic: ["KillsSkull", "data"] },
    ] },
    { n: 3, name: "Frostbite Tundra",   items: [
        { t: "Printer", href: "printer.html", ic: ["ConTower0", "data"] },
        { t: "Refinery", href: "refinery.html", ic: ["Refinery3", "data"] },
        { t: "Worship", href: "worship.html", ic: ["WorshipSkull1", "data"] },
        { t: "Buildings & Library", href: "construction.html", ic: ["ConTower1", "data"] },
        { t: "Atom Collider", href: "atoms.html", ic: ["AtomBG", "data"] },
        { t: "Shrines", href: "shrines.html", ic: ["ShrineBG", "data"] },
        { t: "Equinox", ic: ["Equinox_Mirror", "etc"] },
    ] },
    { n: 4, name: "Hyperion Nebula",    items: [
        { t: "Meal Maxing", href: "meals.html", ic: ["Cooking", "afk_targets"] },
        { t: "Kitchens & Mastery", href: "kitchens.html", ic: ["Ladle", "data"] },
        { t: "Breeding & Territory", href: "breeding.html", ic: ["PetEgg1", "data"] },
        { t: "Rift", href: "rift.html", ic: ["Rift_0", "etc"] },
        { t: "Lab", href: "lab.html", ic: ["Laboratory", "afk_targets"] },
    ] },
    { n: 5, name: "Smolderin' Plateau", items: [
        { t: "Sailing", href: "sailing.html", ic: ["Sailing", "afk_targets"] },
        { t: "Bits & Garden", href: "gaming.html", ic: ["Gaming", "afk_targets"] },
        { t: "Palette", href: "palette.html", ic: ["GamingPal", "data"] },
        { t: "Divinity", href: "divinity.html", ic: ["Divinity", "afk_targets"] },
        { t: "The Cavern", href: "cavern.html", ic: ["Cavern_0", "etc"] },
        { t: "Slab", href: "slab.html", ic: ["Slab", "etc"] },
    ] },
    { n: 6, name: "Spirited Valley",    items: [
        { t: "Summoning", href: "summoning.html", ic: ["Endless_Summoning", "etc"] },
        { t: "Sneaking", href: "sneaking.html", ic: ["Sneaking_Ninja", "etc"] },
        { t: "Emperor", href: "emperor.html", ic: ["Boss6", "data"] },
        { t: "Beanstalk", href: "beanstalk.html", ic: ["beanstalk", "etc"] },
        { t: "Farming", href: "farming.html", ic: ["FarmCrop23", "data"] },
        { t: "Land Rank", href: "landrank.html", ic: ["FarmCrop46", "data"] },
    ] },
    { n: 7, name: "Shimmerfin Deep",    items: [
        { t: "Research Grid", href: "research.html", ic: ["ResearchBG", "data"] },
        { t: "Legend Talents", href: "legends.html", ic: ["LegendTalentBG", "data"] },
        { t: "Spelunking", href: "spelunking.html", ic: ["Spelunking", "etc"] },
        { t: "Sushi Station", href: "sushi.html", ic: ["Sushi1", "data"] },
        { t: "Minehead & Glimbo", href: "minehead.html", ic: ["MineHead0", "data"] },
        { t: "Account Levers", href: "levers.html", ic: ["ZenithBG", "data"] },
    ] },
  ];
  const STATS = [
    { g: "General",    items: [{ t: "Drop Rate", href: "stats.html?recipe=dropRate" }] },
    { g: "W1", items: [
        { t: "Mining Efficiency", href: "stats.html?recipe=miningEff" },
        { t: "Choppin Efficiency", href: "stats.html?recipe=choppinEff" },
        { t: "Statue Bonus Multiplier", href: "stats.html?recipe=statueMulti" },
        { t: "Anvil Production Speed", href: "stats.html?recipe=anvilSpeed" },
        { t: "Owl Feather Rate", href: "stats.html?recipe=owlRate" },
    ] },
    { g: "W2 Alchemy", items: [
        { t: "Liquid Capacity", href: "stats.html?recipe=liquidCap" },
        { t: "Bubble LVs / Day", href: "stats.html?recipe=krukBubbles" },
        { t: "Bluefin Fish / min", href: "stats.html?recipe=fishRate" },
        { t: "Shiny Fishing Rate", href: "stats.html?recipe=shinyRate" },
    ] },
    { g: "W3", items: [
        { t: "Refinery Cycle Speed", href: "stats.html?recipe=refineryCycle" },
        { t: "Printer Output Multi", href: "stats.html?recipe=printerOutput" },
        { t: "Library Checkout Rate", href: "stats.html?recipe=libraryRate" },
        { t: "Atom Cost Reduction", href: "stats.html?recipe=atomCost" },
        { t: "Shrine EXP-gain rate", href: "stats.html?recipe=shrineExp" },
        { t: "Worship Max Charge", href: "stats.html?recipe=worshipCharge" },
    ] },
    { g: "W4", items: [
        { t: "Meal Bonus Multiplier", href: "stats.html?recipe=mealBonuses" },
        { t: "Breeding Chance (multi)", href: "stats.html?recipe=breedingChance" },
        { t: "Kitchen Cooking Speed", href: "stats.html?recipe=kitchenSpeed" },
    ] },
    { g: "W5 Sailing", items: [{ t: "Artifact Find", href: "stats.html?recipe=artifactFind" }] },
    { g: "W5 Gaming", items: [
        { t: "Bits Multiplier", href: "stats.html?recipe=gamingBits" },
        { t: "Villager EXP/hr", href: "stats.html?recipe=villagerExp" },
        { t: "Palette Luck", href: "stats.html?recipe=paletteLuck" },
    ] },
    { g: "W6 Farming", items: [{ t: "Crop Evo", href: "stats.html?recipe=cropEvo" }] },
    { g: "W6", items: [
        { t: "Summoning Winner Bonuses", href: "stats.html?recipe=winBonus" },
        { t: "Army HP Multiplier", href: "stats.html?recipe=armyHealth" },
        { t: "Army DMG Multiplier", href: "stats.html?recipe=armyDamage" },
        { t: "Ninja Stealth", href: "stats.html?recipe=stealth" },
        { t: "Emperor Bonuses", href: "stats.html?recipe=emperorBonus" },
    ] },
    { g: "W7", items: [
        { t: "Legend Talents", href: "stats.html?recipe=legendTalents" },
        { t: "Sushi Rift of Gods", href: "stats.html?recipe=sushiRoG" },
    ] },
    { g: "Account",    items: [
        { t: "Tome Score", href: "stats.html?recipe=tomeScore" },
        { t: "Cash Multiplier", href: "stats.html?recipe=cashMulti" },
        { t: "AFK Gain", href: "stats.html?recipe=afkGain" },
        { t: "Class EXP", href: "stats.html?recipe=classXp" },
        { t: "Skill EXP", href: "stats.html?recipe=skillXp" },
    ] },
  ];
  const ACCOUNT = [
    { t: "Global Stats", href: "account.html", ic: ["LootDice", "data"] },
    { t: "Achievements", href: "achievements.html", ic: ["Ribbon0", "data"] },
    { t: "Cards",        ic: ["Card_Preset_0", "etc"] },
    { t: "Companions",   ic: ["Companion_Power", "etc"] },
    { t: "Guild" },
  ];

  const fileOf = (href) => (href || "").split(/[?#]/)[0];

  function renderNav() {
    const nav = document.querySelector("nav.pages");
    if (!nav) return;
    const cur = (location.pathname.split("/").pop() || "dashboard.html") || "dashboard.html";
    const curFile = cur === "" ? "dashboard.html" : cur;
    const curFull = curFile + location.search;
    /* a link is "here" when its file matches; recipe links (with a query) must match exactly,
     * so on stats.html only the active recipe row marks — never all four. */
    const isHere = (href) => href.includes("?") ? href === curFull : fileOf(href) === curFile;

    const icon = (it) => it.ic ? sp(it.ic[0], it.ic[1]) : `<span class="dot"></span>`;
    const row = (it) => it.href
      ? `<a class="mrow${isHere(it.href) ? " here-mark" : ""}" href="${it.href}">${icon(it)}${it.t}</a>`
      : `<div class="mrow ghost">${icon(it)}${it.t}<span class="pill-soon">soon</span></div>`;

    /* Dashboard */
    let html = `<a href="dashboard.html"${curFile === "dashboard.html" ? ' class="here"' : ""}>Dashboard</a>`;

    /* Account ▾ */
    const accountHere = ACCOUNT.some((i) => i.href && fileOf(i.href) === curFile);
    html += `<span class="dd${accountHere ? " here" : ""}">
        <button class="trig">Account <span class="caret">▼</span></button>
        <div class="dd-pop" style="min-width:185px">${ACCOUNT.map(row).join("")}</div></span>`;

    /* World pills W1–W6 (all individual) */
    html += WORLDS.map(w => {
      const built = w.items.some(i => i.href);
      const here = w.items.some(i => i.href && fileOf(i.href) === curFile);
      const flyout = `<div class="dd-pop" style="min-width:185px"><div class="wname"><b>W${w.n}</b>${w.name}</div>${w.items.map(row).join("")}</div>`;
      if (built) {
        const lead = w.items.find(i => i.href && i.ic);
        return `<span class="dd wpill${here ? " here" : ""}">
          <button class="trig"><span class="wn">W${w.n}</span>${lead ? sp(lead.ic[0], lead.ic[1]) : ""}</button>
          ${flyout}</span>`;
      }
      const planned = w.items.length;
      return `<span class="dd wpill dead">
        <button class="trig"><span class="wn">W${w.n}</span><span class="planned-n">${planned}</span></button>
        ${flyout}</span>`;
    }).join("");

    /* Stats ▾ (grouped panel, anchored right so it can't clip the viewport edge) */
    html += `<span class="dd dd-right${curFile === "stats.html" ? " here" : ""}">
        <button class="trig">Stats <span class="caret">▼</span></button>
        <div class="dd-pop"><div class="wpanel">${STATS.map(g =>
          `<div class="wgroup"><h5>${g.g}</h5>${g.items.map(row).join("")}</div>`).join("")}</div></div></span>`;

    nav.innerHTML = html;

    /* dropdown plumbing: click toggles, only one open, click elsewhere closes */
    nav.querySelectorAll(".dd > button.trig").forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      const dd = b.parentNode;
      const was = dd.classList.contains("open");
      nav.querySelectorAll(".dd.open").forEach(x => x.classList.remove("open"));
      if (!was) dd.classList.add("open");
    });
    document.addEventListener("click", () => nav.querySelectorAll(".dd.open").forEach(x => x.classList.remove("open")));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { mount(); renderNav(); });
  else { mount(); renderNav(); }

  window.UI = { sprite, tones: TONES };
})();
