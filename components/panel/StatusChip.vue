<script setup lang="ts">
defineProps<{ tone: string; label: string }>()
</script>

<template>
  <span class="chip" :class="`chip-${tone}`"><i aria-hidden="true" />{{ label }}</span>
</template>
