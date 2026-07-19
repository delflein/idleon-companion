<script setup>
// Minimal dark layout shell — header + nav placeholder + router-view.
// Real navigation (per-system pages) lands in M4/M5; this is just the frame.
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <h1 class="app-title">
        IdleOn Companion
      </h1>
      <nav class="app-nav">
        <RouterLink to="/">
          Home
        </RouterLink>
        <RouterLink to="/data">
          Data
        </RouterLink>
        <RouterLink to="/sync-spike">
          Sync spike
        </RouterLink>
      </nav>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style>
:root {
  color-scheme: dark;
}

body {
  margin: 0;
  background: #111318;
  color: #e6e8ee;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}

.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid #262a35;
  background: #161922;
}

.app-title {
  font-size: 1.1rem;
  margin: 0;
}

.app-nav {
  display: flex;
  gap: 1rem;
}

.app-nav a {
  color: #9aa4b8;
  text-decoration: none;
  font-size: 0.9rem;
}

.app-nav a.router-link-active {
  color: #e6e8ee;
  font-weight: 600;
}

.app-main {
  flex: 1;
  padding: 1.25rem;
}
</style>
