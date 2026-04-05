<template>
  <div>
    <h1>Test Supabase</h1>
    <pre>{{ signalements }}</pre>
  </div>
</template>

<script setup>
const { data: signalements } = await useFetch('/api/signalements')
</script>