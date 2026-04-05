export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  routeRules: {
    "/admin": { redirect: "/dashboard/admin" },
  },
  css: ["~/assets/css/global.css"],
  modules: ["@nuxtjs/supabase"],
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
    redirectOptions: {
      login:    '/',
      callback: '/auth/callback',
      exclude:  ['/']
    }
  }
})