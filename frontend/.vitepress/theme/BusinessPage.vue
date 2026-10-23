<script setup>
import { onMounted } from "vue";
import pages from "../../generated/pages.json";
const props = defineProps({ page: String });
// Trusted build-owned markup only. Submitted HTML is never inserted here;
// it continues to run in the existing sandbox iframe.
onMounted(async () => {
  document.body.dataset.page = props.page;
  const dialogs = document.createElement("div");
  dialogs.className = "pelican-business";
  for (const selector of ["#prompt-dialog", "#toast"]) {
    const node = document.querySelector(selector);
    if (node) dialogs.append(node);
  }
  document.body.append(dialogs);
  try {
    const { initBusinessPage } = await import("../../../site/assets/app.js");
    await initBusinessPage();
  } finally {
    document.dispatchEvent(new Event("site-loading-ready"));
  }
});
</script>
<template><div class="pelican-business" v-html="pages[page]"></div></template>
