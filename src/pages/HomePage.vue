<script setup>
// M1 hello-shell — real dashboard content lands in M5+ as pages migrate off the legacy
// root *.html files (docs/ARCHITECTURE.md migration plan).
</script>

<template>
  <section>
    <h2>Welcome</h2>
    <p>
      This is the M1 scaffold: Vite + Vue 3.5 + vue-router (hash mode) + a PWA manifest, deployed
      to GitHub Pages. Nothing else lives here yet.
    </p>
    <p>
      Use <RouterLink to="/sync-spike">
        Sync spike
      </RouterLink> to verify the CORS-facing save-sync
      network calls run from this origin before any real feature is built on them.
    </p>
  </section>
</template>
