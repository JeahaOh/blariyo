<script setup lang="ts">
const route = useRoute();
const detail = computed(() => /^\/[^/]+\/posts\/[^/]+$/.test(route.path));
const brand = useRuntimeConfig().public;
</script>
<template>
  <div class="shell" :class="{ 'admin-shell': route.path === '/admin' }">
    <header v-if="!detail">
      <NuxtLink to="/meme">{{ brand.siteName }}</NuxtLink
      ><span>{{ brand.homeTagline }}</span>
    </header>
    <NuxtPage /><SiteFooter />
  </div>
</template>
<style>
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: #3a4a5a;
  color: #262626;
  font-family: system-ui, sans-serif;
  line-height: 1.6;
}
a {
  color: inherit;
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
}
button,
input,
textarea,
select {
  font: inherit;
}
button {
  cursor: pointer;
  padding: 8px 14px;
  border: 1px solid #8b9fa8;
  background: #f9f9f9;
  border-radius: 5px;
}
button:hover {
  background: #e2f4f3;
}
:focus-visible {
  outline: 3px solid #00a19b;
  outline-offset: 2px;
}
.shell {
  max-width: 760px;
  margin: auto;
  background: #f9f9f9;
  min-height: 100vh;
}
.admin-shell {
  max-width: 1000px;
}
header {
  padding: 20px 28px;
  background: #f9f9f9;
  color: #262626;
  display: flex;
  align-items: center;
  gap: 24px;
}
header > a {
  font-size: 25px;
  font-weight: 800;
}
header span {
  font-size: 13px;
}
main {
  padding: 24px;
  min-height: 60vh;
}
h1 {
  font-size: 24px;
  overflow-wrap: anywhere;
}
footer {
  padding: 32px 24px;
  background: #d4dce0;
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  font-size: 13px;
}
.post-row {
  padding: 14px 10px;
  display: grid;
  grid-template-columns: 55px 1fr auto;
  gap: 14px;
  border-bottom: 1px solid #d4dce0;
  align-items: center;
}
.post-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.post-meta,
.post-number,
.muted {
  font-size: 12px;
  color: #565f64;
}
.post-row:hover,
.current {
  background: #e2f4f3;
}
.pinned {
  background: #f8f0da;
}
.current {
  border-left: 3px solid #00a19b;
}
.pagination {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin: 24px 0;
  flex-wrap: wrap;
}
.pagination [aria-current] {
  border: 2px solid #c74b50;
  font-weight: bold;
}
.empty {
  padding: 60px 0;
  text-align: center;
  color: #565f64;
}
.detail-nav {
  position: sticky;
  top: 0;
  background: #f9f9f9;
  display: flex;
  gap: 20px;
  align-items: center;
  border-bottom: 1px solid #d4dce0;
  padding: 10px 0;
}
.detail-nav strong {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
article {
  padding: 20px 0 40px;
}
article img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 20px auto;
}
.body-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
dialog {
  position: fixed;
  top: 25%;
  border: 1px solid #8b9fa8;
  border-radius: 8px;
  max-width: calc(100vw - 32px);
  z-index: 20;
  padding: 24px;
  box-shadow: 0 10px 80px #0006;
}
dialog button,
dialog a {
  margin: 5px;
}
label {
  display: block;
  margin: 12px 0;
}
input,
textarea,
select {
  max-width: 100%;
  padding: 10px;
  border: 1px solid #8b9fa8;
  border-radius: 4px;
}
textarea {
  width: 100%;
  min-height: 110px;
}
@media (max-width: 600px) {
  header {
    padding: 16px;
  }
  header span {
    display: none;
  }
  main {
    padding: 14px;
  }
  .post-row {
    grid-template-columns: 36px 1fr;
    gap: 6px;
    padding: 12px 4px;
  }
  .post-meta {
    grid-column: 2;
  }
  .post-number {
    grid-row: 1 / 3;
  }
  .post-row strong {
    font-size: 15px;
  }
  h1 {
    font-size: 22px;
  }
  footer {
    gap: 12px;
    padding: 24px 14px;
  }
}
</style>
