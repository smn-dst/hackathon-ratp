export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  app: {
    head: {
      title: "Vigie RATP",
      meta: [
        {
          name: "description",
          content: "Pilotage des signalements — Paris Est Centre Bus",
        },
      ],
    },
  },
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