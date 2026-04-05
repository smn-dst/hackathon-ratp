<script setup>
definePageMeta({ middleware: ['auth'] })
const { deconnexion } = useAuth()

// ── Data ──────────────────────────────────────────────────────────────────────
const { data: signalements, refresh } = await useFetch('/api/signalements-com')
const { data: meteo } = await useFetch('/api/meteo')

// Realtime
useSignalementsRealtimeRefresh(refresh)

const heure = ref('')
const date = ref('')

// ── Vue active (carte par défaut : centre d’ops) ───────────────────────────────
const vueActive = ref('carte') // 'carte' | 'live' | 'analyses'

// ── Filtres ───────────────────────────────────────────────────────────────────
const filtreSource = ref('tous')   // 'tous' | 'twitter' | 'tiktok'

const signalementsFiltres = computed(() => {
  let list = signalements.value || []
  if (filtreSource.value !== 'tous') list = list.filter(s => s.source === filtreSource.value)
  return list
})

function isVersRh(g) {
  return g === 'moyen' || g === 'élevé'
}

// ── Computed stats ────────────────────────────────────────────────────────────
const versRh = computed(() => signalements.value?.filter(s => isVersRh(s.gravite)).length || 0)
const versManagerSeul = computed(() =>
  signalements.value?.filter(s => s.gravite === 'positif' || s.gravite === 'faible').length || 0)
const fromTwitter = computed(() => signalements.value?.filter(s => s.source === 'twitter').length || 0)
const fromTiktok = computed(() => signalements.value?.filter(s => s.source === 'tiktok').length || 0)

const countByGravite = computed(() => {
  const c = { positif: 0, faible: 0, moyen: 0, élevé: 0 }
  signalements.value?.forEach(s => { if (c[s.gravite] !== undefined) c[s.gravite]++ })
  return c
})

const countByGraviteFiltre = computed(() => {
  const c = { positif: 0, faible: 0, moyen: 0, élevé: 0 }
  signalementsFiltres.value?.forEach(s => { if (c[s.gravite] !== undefined) c[s.gravite]++ })
  return c
})

const totalFiltre = computed(() => signalementsFiltres.value?.length || 0)

// Zone hotspots (regroupement par ligne)
const hotspotsByLigne = computed(() => {
  const m = {}
  signalements.value?.forEach(s => {
    const key = s.ligne_id || 'Inconnue'
    if (!m[key]) m[key] = { ligne: key, total: 0, eleve: 0, moyen: 0 }
    m[key].total++
    if (s.gravite === 'élevé') m[key].eleve++
    if (s.gravite === 'moyen') m[key].moyen++
  })
  return Object.values(m).sort((a, b) => b.total - a.total).slice(0, 8)
})

// Nouveaux (dernières 2h) — pour pulsation carte & tags live
const nowMinus2h = computed(() => new Date(Date.now() - 2 * 60 * 60 * 1000))
function signalementTimestamp(s) {
  const raw = s.created_at || s.heure_incident
  return raw ? new Date(raw).getTime() : 0
}
const isRecent = (s) => signalementTimestamp(s) > nowMinus2h.value

const recentOnMapCount = computed(() =>
  (signalementsFiltres.value || []).filter(s => s.lat && s.lng && isRecent(s)).length
)

/** Récent dans le flux (filtres), toutes sources — pour panneaux carte */
const recentFluxCount = computed(() =>
  (signalementsFiltres.value || []).filter(s => isRecent(s)).length
)

const withCoordsCount = computed(() =>
  (signalementsFiltres.value || []).filter(s => s.lat && s.lng).length
)

const analyseKpis = computed(() => {
  const list = signalementsFiltres.value || []
  const n = list.length
  const scored = list.filter(s => s.scoring_ia?.score != null && !Number.isNaN(Number(s.scoring_ia.score)))
  const avg = scored.length
    ? (scored.reduce((a, s) => a + Number(s.scoring_ia.score), 0) / scored.length).toFixed(1)
    : '—'
  return [
    { label: 'Entrées (filtre)', val: n },
    { label: 'Manager + RH', val: list.filter(s => isVersRh(s.gravite)).length },
    { label: 'Score IA moy.', val: avg },
    { label: 'Géolocalisés', val: list.filter(s => s.lat && s.lng).length },
  ]
})

const graviteDonutStyle = computed(() => {
  const c = countByGraviteFiltre.value
  const t = totalFiltre.value
  if (!t) return { background: '#e2e8f0' }
  let acc = 0
  const segs = [
    ['élevé', '#e24b4a'],
    ['moyen', '#f59e0b'],
    ['faible', '#3b82f6'],
    ['positif', '#00a88f'],
  ]
  const stops = segs.map(([k, color]) => {
    const pct = (c[k] / t) * 100
    const start = acc
    acc += pct
    return `${color} ${start}% ${acc}%`
  })
  return { background: `conic-gradient(${stops.join(', ')})` }
})

const hotspotsFiltres = computed(() => {
  const m = {}
  signalementsFiltres.value?.forEach(s => {
    const key = s.ligne_id || 'Inconnue'
    if (!m[key]) m[key] = { ligne: key, total: 0, eleve: 0, moyen: 0 }
    m[key].total++
    if (s.gravite === 'élevé') m[key].eleve++
    if (s.gravite === 'moyen') m[key].moyen++
  })
  return Object.values(m).sort((a, b) => b.total - a.total).slice(0, 8)
})

const fromTwitterFiltre = computed(() => signalementsFiltres.value?.filter(s => s.source === 'twitter').length || 0)
const fromTiktokFiltre = computed(() => signalementsFiltres.value?.filter(s => s.source === 'tiktok').length || 0)

const versRhFiltre = computed(() =>
  signalementsFiltres.value?.filter(s => isVersRh(s.gravite)).length || 0)
const versManagerSeulFiltre = computed(() =>
  signalementsFiltres.value?.filter(s => s.gravite === 'positif' || s.gravite === 'faible').length || 0)

// ── Helpers ───────────────────────────────────────────────────────────────────
const graviteColor = g => ({ 'élevé': '#e24b4a', 'moyen': '#f59e0b', 'faible': '#3b82f6', 'positif': '#00a88f' }[g] || '#888')
const sourceIcon = s => s === 'tiktok' ? '🎵' : '𝕏'
const sourceColor = s => s === 'tiktok' ? '#010101' : '#1d9bf0'

function formatRelative(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'à l\'instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h}h`
  return new Date(iso).toLocaleDateString('fr-FR')
}

function formatLigne(s) { return s.ligne_id?.replace('L', '') || '—' }

// ── Modal fiche ───────────────────────────────────────────────────────────────
const ficheActive = ref(null)
const ficheOuverte = ref(false)
function ouvrirFiche(s) { ficheActive.value = s; ficheOuverte.value = true }
function fermerFiche() { ficheOuverte.value = false; setTimeout(() => ficheActive.value = null, 300) }

// ── Carte : panneau zone (plusieurs signalements au même regroupement)
const zoneActive = ref(null)
function fermerZoneCarte() { zoneActive.value = null }
function ouvrirFicheDepuisZone(s) {
  fermerZoneCarte()
  ouvrirFiche(s)
}

// ── Horloge ───────────────────────────────────────────────────────────────────
onMounted(() => {
  const tick = () => {
    const now = new Date()
    heure.value = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    date.value = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  }
  tick()
  setInterval(tick, 1000)
})

onUnmounted(() => {
  destroyMap()
})

// ── Carte Leaflet ─────────────────────────────────────────────────────────────
// v-if sur la vue carte démonte #map-com : l’instance Leaflet doit être détruite à la sortie
// et recréée au retour (invalidateSize ne suffit pas : le conteneur DOM n’existe plus).
let mapInstance = null
let layerGroup = null
let L_ref = null

function destroyMap() {
  if (mapInstance) {
    try {
      mapInstance.off()
      mapInstance.remove()
    } catch {
      /* ignore */
    }
    mapInstance = null
    layerGroup = null
  }
}

watch(signalementsFiltres, () => { if (layerGroup) rafraichirMarqueurs() })

watch(vueActive, async (val, oldVal) => {
  if (oldVal === 'carte' && val !== 'carte') {
    destroyMap()
  }
  if (val === 'carte') {
    await nextTick()
    await initMap()
  }
}, { flush: 'post', immediate: true })

async function initMap() {
  const el = typeof document !== 'undefined' ? document.getElementById('map-com') : null
  if (!el) return

  destroyMap()

  L_ref = await import('leaflet')
  await import('leaflet/dist/leaflet.css')

  mapInstance = L_ref.map(el, { zoomControl: false }).setView([48.855, 2.38], 12)
  L_ref.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19
  }).addTo(mapInstance)
  L_ref.control.zoom({ position: 'bottomright' }).addTo(mapInstance)
  layerGroup = L_ref.layerGroup().addTo(mapInstance)
  mapInstance.on('click', () => { zoneActive.value = null })
  rafraichirMarqueurs()

  requestAnimationFrame(() => {
    mapInstance?.invalidateSize()
  })
}

const MAP_MARKER_RADIUS_MAX_COM = 42

function rafraichirMarqueurs() {
  if (!layerGroup || !L_ref) return
  zoneActive.value = null
  layerGroup.clearLayers()
  const zones = {}
  const liste = signalementsFiltres.value || []
  liste.forEach(s => {
    if (!s.lat || !s.lng) return
    const key = `${Math.round(s.lat * 300) / 300}_${Math.round(s.lng * 300) / 300}`
    if (!zones[key]) zones[key] = { lat: s.lat, lng: s.lng, items: [] }
    zones[key].items.push(s)
  })

  Object.values(zones).forEach(zone => {
    const recent = zone.items.some(s => isRecent(s))
    const dominante = zone.items.reduce((acc, s) => {
      const w = { 'élevé': 4, 'moyen': 3, 'faible': 2, 'positif': 1 }
      return (w[s.gravite] || 0) > (w[acc.gravite] || 0) ? s : acc
    }, zone.items[0])

    const color = graviteColor(dominante.gravite)
    const count = zone.items.length
    const radius = Math.min(14 + count * 4, MAP_MARKER_RADIUS_MAX_COM)
    const fs = count > 99 ? 9 : count > 9 ? 11 : 13
    const ring = recent ? Math.round(radius * 2 + 16) : 0

    const pulseHtml = recent ? `
      <div class="pulse-ring" style="
        position:absolute;top:50%;left:50%;
        transform:translate(-50%,-50%);
        width:${ring}px;height:${ring}px;
        border-radius:50%;
        border:2px solid ${color};
        animation:pulse-map-com 1.5s ease-out infinite;
        opacity:0.6;pointer-events:none;">
      </div>` : ''

    const icon = L_ref.divIcon({
      className: '',
      html: `
        <div style="position:relative;width:${radius * 2}px;height:${radius * 2}px;">
          ${pulseHtml}
          <div style="
            width:${radius * 2}px;height:${radius * 2}px;
            background:${color};border-radius:50%;
            border:3px solid #fff;
            box-shadow:0 2px 12px rgba(15,23,42,0.18),0 0 0 1px rgba(15,23,42,0.06),0 0 20px ${color}44;
            display:flex;align-items:center;justify-content:center;
            color:white;font-weight:700;
            font-size:${fs}px;
            font-family:'DM Sans',sans-serif;cursor:pointer;
            position:relative;z-index:1;">
            ${count}
          </div>
        </div>`,
      iconSize: [radius * 2 + (recent ? 16 : 0), radius * 2 + (recent ? 16 : 0)],
      iconAnchor: [radius + (recent ? 8 : 0), radius + (recent ? 8 : 0)]
    })

    L_ref.marker([zone.lat, zone.lng], { icon })
      .addTo(layerGroup)
      .on('click', (e) => {
        if (e.originalEvent) L_ref.DomEvent.stopPropagation(e.originalEvent)
        if (zone.items.length === 1) ouvrirFiche(zone.items[0])
        else zoneActive.value = zone
      })
  })
}
</script>

<template>
  <div class="com-root">

    <!-- ═══ HEADER ═════════════════════════════════════════════════════════ -->
    <header class="header">
      <div class="h-brand">
        <div class="logo">
          <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="white" stroke-width="2" />
            <path d="M8 14 Q14 6 20 14 Q14 22 8 14Z" fill="white" opacity="0.9" />
          </svg>
        </div>
        <span class="brand-s">Signal</span><span class="brand-r">RATP</span>
        <div class="sep" />
        <span class="role-pill">📡 Communication</span>
      </div>

      <!-- Stats rapides header -->
      <div class="h-stats">
        <div class="hs" :class="{ urgent: versRh > 0 }">
          <span class="hs-n">{{ versRh }}</span>
          <span class="hs-l">Manager + RH</span>
        </div>
        <div class="hs">
          <span class="hs-n">{{ versManagerSeul }}</span>
          <span class="hs-l">Manager seul</span>
        </div>
        <div class="hs">
          <span class="hs-n" style="color:#1d9bf0">{{ fromTwitter }}</span>
          <span class="hs-l">Twitter</span>
        </div>
        <div class="hs">
          <span class="hs-n" style="color:#ff0050">{{ fromTiktok }}</span>
          <span class="hs-l">TikTok</span>
        </div>
      </div>

      <div class="h-right">
        <div v-if="meteo" class="meteo-mini">
          <span>{{ meteo.temp }}°C · {{ meteo.description }}</span>
        </div>
        <div class="clock-mini">{{ heure }}</div>
        <button class="btn-deconnexion" @click="deconnexion">Déconnexion</button>
      </div>
    </header>

    <!-- ═══ NAV TABS ════════════════════════════════════════════════════════ -->
    <nav class="nav-tabs">
      <button v-for="tab in [
        { key: 'carte', icon: '🗺️', label: 'Carte' },
        { key: 'live', icon: '📡', label: 'Flux live' },
        { key: 'analyses', icon: '📊', label: 'Analyses' },
      ]" :key="tab.key" class="nav-tab" :class="{ active: vueActive === tab.key }" @click="vueActive = tab.key">
        {{ tab.icon }} {{ tab.label }}
        <span v-if="tab.key === 'live' && versRh > 0" class="tab-badge">{{ versRh }}</span>
      </button>

      <!-- Filtres -->
      <div class="nav-filters">
        <select v-model="filtreSource" class="f-sel">
          <option value="tous">Toutes sources</option>
          <option value="twitter">Twitter / X</option>
          <option value="tiktok">TikTok</option>
        </select>
      </div>
    </nav>

    <!-- ═══ VUE LIVE ════════════════════════════════════════════════════════ -->
    <div v-if="vueActive === 'live'" class="view-live">

      <!-- Colonne flux -->
      <div class="flux-col">
        <div class="col-title">
          Flux entrant
          <span class="live-dot" /><span class="live-label">EN DIRECT</span>
        </div>

        <div v-if="!signalementsFiltres.length" class="empty-msg">
          Aucun signalement social pour le moment
        </div>

        <TransitionGroup name="flux" tag="div" class="flux-list">
          <div v-for="s in signalementsFiltres" :key="s.id" class="flux-card"
            :class="{ 'is-recent': isRecent(s) }" @click="ouvrirFiche(s)">

            <!-- Barre gravité -->
            <div class="gbar" :style="`background:${graviteColor(s.gravite)}`" />

            <!-- En-tête -->
            <div class="fc-head">
              <div class="fc-source" :style="`background:${sourceColor(s.source)}22;color:${sourceColor(s.source)}`">
                {{ sourceIcon(s.source) }} {{ s.source }}
              </div>
              <span class="fc-grav"
                :style="`background:${graviteColor(s.gravite)}18;color:${graviteColor(s.gravite)};border-color:${graviteColor(s.gravite)}40`">
                {{ s.gravite?.toUpperCase() }}
              </span>
              <span v-if="isRecent(s)" class="new-tag">NOUVEAU</span>
              <span v-if="isVersRh(s.gravite)" class="routing-tag">RH</span>
              <span class="fc-time">{{ formatRelative(s.created_at) }}</span>
            </div>

            <!-- Contenu -->
            <div class="fc-type">{{ s.type_incident }}</div>
            <p class="fc-desc">{{ s.resume_ia || s.description?.substring(0, 100) }}{{ (!s.resume_ia &&
              s.description?.length > 100) ? '…' : '' }}</p>

            <!-- Meta -->
            <div class="fc-meta">
              <span v-if="s.ligne_id">Ligne {{ formatLigne(s) }}</span>
              <span v-if="s.meteo">{{ s.meteo }}</span>
              <a v-if="s.lien_social" :href="s.lien_social" target="_blank" @click.stop class="fc-link">Voir le post
                →</a>
            </div>
          </div>
        </TransitionGroup>
      </div>

      <!-- Colonne stats latérale -->
      <div class="stats-col">

        <!-- Gravité donut simplifié -->
        <div class="stat-card">
          <div class="sc-title">Répartition gravité</div>
          <div class="gravite-bars">
            <div v-for="bar in [
              { label: 'Élevé', key: 'élevé', color: '#e24b4a' },
              { label: 'Moyen', key: 'moyen', color: '#f59e0b' },
              { label: 'Faible', key: 'faible', color: '#3b82f6' },
              { label: 'Positif', key: 'positif', color: '#00a88f' },
            ]" :key="bar.key" class="gbar-row">
              <span class="gbar-label">{{ bar.label }}</span>
              <div class="gbar-track">
                <div class="gbar-fill"
                  :style="`width:${totalFiltre ? (countByGraviteFiltre[bar.key] / totalFiltre) * 100 : 0}%;background:${bar.color}`" />
              </div>
              <span class="gbar-count">{{ countByGraviteFiltre[bar.key] }}</span>
            </div>
          </div>
        </div>

        <!-- Hotspots par ligne -->
        <div class="stat-card">
          <div class="sc-title">Lignes les plus signalées</div>
          <div v-if="!hotspotsFiltres.length" class="sc-empty">Aucune donnée</div>
          <div v-else class="hotspot-list">
            <div v-for="(h, i) in hotspotsFiltres" :key="h.ligne" class="hotspot-row">
              <span class="hs-rank">#{{ i + 1 }}</span>
              <span class="hs-ligne">{{ h.ligne.replace('L', '') !== 'Inconnue' ? `Ligne ${h.ligne.replace('L', '')}` :
                'Ligne ?' }}</span>
              <div class="hs-pills">
                <span v-if="h.eleve" class="hp hp-e">{{ h.eleve }}🔴</span>
                <span v-if="h.moyen" class="hp hp-m">{{ h.moyen }}🟡</span>
              </div>
              <span class="hs-total">{{ h.total }}</span>
            </div>
          </div>
        </div>

        <!-- Sources breakdown -->
        <div class="stat-card">
          <div class="sc-title">Sources</div>
          <div class="source-donut">
            <div class="sd-row">
              <div class="sd-icon" style="color:#1d9bf0">𝕏</div>
              <div class="sd-bar-wrap">
                <div class="sd-bar" style="background:#1d9bf0"
                  :style="`width:${totalFiltre ? (fromTwitterFiltre / totalFiltre) * 100 : 0}%`" />
              </div>
              <span class="sd-val">{{ fromTwitterFiltre }}</span>
            </div>
            <div class="sd-row">
              <div class="sd-icon" style="color:#ff0050">🎵</div>
              <div class="sd-bar-wrap">
                <div class="sd-bar" style="background:#ff0050"
                  :style="`width:${totalFiltre ? (fromTiktokFiltre / totalFiltre) * 100 : 0}%`" />
              </div>
              <span class="sd-val">{{ fromTiktokFiltre }}</span>
            </div>
          </div>
        </div>

        <!-- Routage dashboards -->
        <div class="stat-card">
          <div class="sc-title">Routage automatique</div>
          <div class="validation-stats">
            <div class="vs-item">
              <div class="vs-circle" style="border-color:#1b3f8b">
                <span style="color:#1b3f8b">{{ versManagerSeulFiltre }}</span>
              </div>
              <span>Manager seul</span>
            </div>
            <div class="vs-sep">+</div>
            <div class="vs-item">
              <div class="vs-circle" style="border-color:#e24b4a">
                <span style="color:#e24b4a">{{ versRhFiltre }}</span>
              </div>
              <span>Manager + RH</span>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ═══ VUE ANALYSES ════════════════════════════════════════════════════ -->
    <div v-if="vueActive === 'analyses'" class="view-analyses">
      <div class="analyses-grid">
        <div class="analyses-hero anim-fade-up">
          <h2 class="analyses-title">Pilotage & analyses</h2>
          <p class="analyses-sub">
            Synthèse sur le périmètre filtré · <strong>{{ signalementsFiltres.length }}</strong> entrée(s)
          </p>
        </div>

        <div class="analyse-kpi-row">
          <div v-for="(k, i) in analyseKpis" :key="k.label" class="an-kpi-card anim-stagger-in"
            :style="{ animationDelay: `${i * 55}ms` }">
            <span class="an-kpi-label">{{ k.label }}</span>
            <span class="an-kpi-value">{{ k.val }}</span>
          </div>
        </div>

        <div class="analyse-visual-row">
          <div class="an-vis-card anim-stagger-in" style="animation-delay: 220ms">
            <div class="an-vis-title">Répartition gravité</div>
            <div class="donut-wrap">
              <div class="donut-ring" :style="graviteDonutStyle">
                <div class="donut-hole">
                  <span class="dh-n">{{ totalFiltre }}</span>
                  <span class="dh-l">signalements</span>
                </div>
              </div>
              <ul class="donut-legend">
                <li v-for="bar in [
                  { label: 'Élevé', key: 'élevé', color: '#e24b4a' },
                  { label: 'Moyen', key: 'moyen', color: '#f59e0b' },
                  { label: 'Faible', key: 'faible', color: '#3b82f6' },
                  { label: 'Positif', key: 'positif', color: '#00a88f' },
                ]" :key="bar.key">
                  <span class="dl-dot" :style="`background:${bar.color}`" />
                  <span class="dl-t">{{ bar.label }}</span>
                  <span class="dl-n">{{ countByGraviteFiltre[bar.key] }}</span>
                </li>
              </ul>
            </div>
          </div>

          <div class="an-vis-card anim-stagger-in" style="animation-delay: 280ms">
            <div class="an-vis-title">Sources</div>
            <div class="an-vis-sources">
              <div class="sd-row">
                <div class="sd-icon" style="color:#1d9bf0">𝕏</div>
                <div class="sd-bar-wrap">
                  <div class="sd-bar sd-bar-tw" :style="`width:${totalFiltre ? (fromTwitterFiltre / totalFiltre) * 100 : 0}%`" />
                </div>
                <span class="sd-val">{{ fromTwitterFiltre }}</span>
              </div>
              <div class="sd-row">
                <div class="sd-icon" style="color:#ff0050">🎵</div>
                <div class="sd-bar-wrap">
                  <div class="sd-bar sd-bar-tt" :style="`width:${totalFiltre ? (fromTiktokFiltre / totalFiltre) * 100 : 0}%`" />
                </div>
                <span class="sd-val">{{ fromTiktokFiltre }}</span>
              </div>
            </div>
          </div>

          <div class="an-vis-card an-vis-card--lines anim-stagger-in" style="animation-delay: 340ms">
            <div class="an-vis-title">Lignes les plus citées</div>
            <div v-if="!hotspotsFiltres.length" class="sc-empty">Aucune ligne renseignée</div>
            <div v-else class="an-line-ranks">
              <div v-for="(h, i) in hotspotsFiltres.slice(0, 6)" :key="h.ligne" class="an-line-row">
                <span class="al-rank">{{ i + 1 }}</span>
                <span class="al-name">{{ h.ligne.replace('L', '') !== 'Inconnue' ? `L${h.ligne.replace('L', '')}` : '?' }}</span>
                <div class="al-bar-track">
                  <div class="al-bar-fill"
                    :style="`width:${hotspotsFiltres[0] ? (h.total / hotspotsFiltres[0].total) * 100 : 0}%;background:linear-gradient(90deg,#1b3f8b,#00a88f)`" />
                </div>
                <span class="al-n">{{ h.total }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="analyse-table-wrap anim-stagger-in" style="animation-delay: 400ms">
          <div class="at-header">
            <span>Détail des signalements</span>
            <span class="at-header-meta">{{ signalementsFiltres.length }} ligne(s)</span>
          </div>
          <table class="analyse-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Gravité</th>
                <th>Type incident</th>
                <th>Résumé IA</th>
                <th>Ligne</th>
                <th>Score IA</th>
                <th>Traitement</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in signalementsFiltres" :key="s.id" @click="ouvrirFiche(s)" class="at-row">
                <td>
                  <span class="src-badge" :style="`color:${sourceColor(s.source)}`">
                    {{ sourceIcon(s.source) }} {{ s.source }}
                  </span>
                </td>
                <td>
                  <span class="grav-dot" :style="`background:${graviteColor(s.gravite)}`" />
                  {{ s.gravite }}
                </td>
                <td class="at-type">{{ s.type_incident?.substring(0, 30) }}</td>
                <td class="at-resume">{{ s.resume_ia?.substring(0, 60) || s.description?.substring(0, 60) }}…</td>
                <td>{{ s.ligne_id ? `L${s.ligne_id.replace('L', '')}` : '—' }}</td>
                <td>
                  <span v-if="s.scoring_ia?.score" class="score-chip">
                    {{ s.scoring_ia.score }}/10
                  </span>
                  <span v-else>—</span>
                </td>
                <td>
                  <span class="status-chip" :class="isVersRh(s.gravite) ? 'validated' : 'pending'">
                    {{ isVersRh(s.gravite) ? 'Manager + RH' : 'Manager' }}
                  </span>
                </td>
                <td class="at-date">{{ formatRelative(s.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>

    <!-- ═══ VUE CARTE ═══════════════════════════════════════════════════════ -->
    <div v-if="vueActive === 'carte'" class="view-carte view-carte-ops">
      <aside class="carte-rail carte-rail-left">
        <div class="carte-panel carte-panel-highlight anim-carte-in" style="animation-delay: 0ms">
          <div class="cp-label">
            <span class="cp-live-dot" />
            Flux filtré
          </div>
          <div class="cp-value">{{ signalementsFiltres.length }}</div>
          <div class="cp-sub">signalements dans la sélection</div>
        </div>
        <div class="carte-panel anim-carte-in" style="animation-delay: 45ms">
          <div class="cp-label">Nouveaux (&lt; 2 h)</div>
          <div class="cp-value cp-accent">{{ recentFluxCount }}</div>
          <div class="cp-sub">dont {{ recentOnMapCount }} sur la carte</div>
        </div>
        <div class="carte-panel anim-carte-in" style="animation-delay: 90ms">
          <div class="cp-label">Géolocalisés</div>
          <div class="cp-value">{{ withCoordsCount }}</div>
          <div class="cp-sub">points affichés (agrégés par zone)</div>
        </div>
        <div class="carte-panel anim-carte-in" style="animation-delay: 135ms">
          <div class="cp-label">Sources (filtre)</div>
          <div class="carte-src-grid">
            <div class="csg">
              <span class="csg-ic" style="color:#1d9bf0">𝕏</span>
              <span class="csg-n">{{ fromTwitterFiltre }}</span>
            </div>
            <div class="csg">
              <span class="csg-ic" style="color:#ff0050">🎵</span>
              <span class="csg-n">{{ fromTiktokFiltre }}</span>
            </div>
          </div>
          <div class="carte-mini-bars">
            <div class="cmb-track">
              <div class="cmb-fill cmb-tw" :style="`width:${totalFiltre ? (fromTwitterFiltre / totalFiltre) * 100 : 0}%`" />
            </div>
            <div class="cmb-track">
              <div class="cmb-fill cmb-tt" :style="`width:${totalFiltre ? (fromTiktokFiltre / totalFiltre) * 100 : 0}%`" />
            </div>
          </div>
        </div>
      </aside>

      <div class="carte-center">
        <div class="carte-frame anim-map-shell">
          <div class="carte-frame-scan" aria-hidden="true" />
          <div class="carte-map-inner">
            <div class="map-wrap-com">
              <div id="map-com" />
              <Transition name="fade">
                <div v-if="zoneActive" class="zone-panel-com" @click.stop>
                  <div class="zpc-head">
                    <span class="zpc-title">{{ zoneActive.items.length }} signalement{{
                      zoneActive.items.length > 1 ? 's' : '' }}</span>
                    <button type="button" class="zpc-close" aria-label="Fermer" @click="fermerZoneCarte">×</button>
                  </div>
                  <ul class="zpc-list">
                    <li v-for="s in zoneActive.items" :key="s.id" class="zpc-item"
                      @click="ouvrirFicheDepuisZone(s)">
                      <span class="zpc-grav" :style="`background:${graviteColor(s.gravite)}`" />
                      <div class="zpc-body">
                        <span class="zpc-src">{{ sourceIcon(s.source) }} {{ s.source }}</span>
                        <span class="zpc-type">{{ s.type_incident }}</span>
                        <span class="zpc-meta">Ligne {{ formatLigne(s) }} · {{ formatRelative(s.created_at ||
                          s.heure_incident) }}</span>
                      </div>
                    </li>
                  </ul>
                </div>
              </Transition>
            </div>
          </div>
          <div class="map-legend map-legend-light">
            <div class="ml-title">Gravité</div>
            <div v-for="item in [
              { label: 'Élevé', color: '#e24b4a' },
              { label: 'Moyen', color: '#f59e0b' },
              { label: 'Faible', color: '#3b82f6' },
              { label: 'Positif', color: '#00a88f' },
            ]" :key="item.label" class="ml-item">
              <span class="ml-dot" :style="`background:${item.color}`" />
              {{ item.label }}
            </div>
            <div class="ml-sep" />
            <div class="ml-item">
              <span class="ml-pulse" />
              Animation &lt; 2 h
            </div>
          </div>
        </div>
      </div>

      <aside class="carte-rail carte-rail-right">
        <div class="carte-panel anim-carte-in" style="animation-delay: 60ms">
          <div class="cp-label">Répartition gravité</div>
          <div v-for="bar in [
            { label: 'Élevé', key: 'élevé', color: '#e24b4a' },
            { label: 'Moyen', key: 'moyen', color: '#f59e0b' },
            { label: 'Faible', key: 'faible', color: '#3b82f6' },
            { label: 'Positif', key: 'positif', color: '#00a88f' },
          ]" :key="bar.key" class="crg-row">
            <span class="crg-l">{{ bar.label }}</span>
            <div class="crg-track">
              <div class="crg-fill"
                :style="`width:${totalFiltre ? (countByGraviteFiltre[bar.key] / totalFiltre) * 100 : 0}%;background:${bar.color}`" />
            </div>
            <span class="crg-n">{{ countByGraviteFiltre[bar.key] }}</span>
          </div>
        </div>
        <div class="carte-panel anim-carte-in" style="animation-delay: 105ms">
          <div class="cp-label">Routage</div>
          <div class="carte-val-row">
            <div class="cvr">
              <span class="cvr-n" style="color:#1b3f8b">{{ versManagerSeulFiltre }}</span>
              <span class="cvr-l">Manager</span>
            </div>
            <div class="cvr-arrow">+</div>
            <div class="cvr">
              <span class="cvr-n" style="color:#e24b4a">{{ versRhFiltre }}</span>
              <span class="cvr-l">M+RH</span>
            </div>
          </div>
        </div>
        <div class="carte-panel anim-carte-in" style="animation-delay: 150ms">
          <div class="cp-label">Top lignes</div>
          <div v-if="!hotspotsFiltres.length" class="cp-empty">—</div>
          <div v-else class="carte-top-lines">
            <div v-for="(h, i) in hotspotsFiltres.slice(0, 5)" :key="h.ligne" class="ctl-row">
              <span class="ctl-i">{{ i + 1 }}</span>
              <span class="ctl-l">{{ h.ligne.replace('L', '') !== 'Inconnue' ? `L${h.ligne.replace('L', '')}` : '?' }}</span>
              <span class="ctl-t">{{ h.total }}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- ═══ MODAL FICHE ═════════════════════════════════════════════════════ -->
    <Transition name="fade">
      <div v-if="ficheOuverte" class="modal-overlay" @click.self="fermerFiche" />
    </Transition>
    <Transition name="slide-up">
      <div v-if="ficheOuverte && ficheActive" class="modal">
        <div class="modal-header" :style="`--accent:${graviteColor(ficheActive.gravite)}`">
          <div class="mh-left">
            <span class="src-badge-lg" :style="`color:${sourceColor(ficheActive.source)}`">
              {{ sourceIcon(ficheActive.source) }} {{ ficheActive.source }}
            </span>
            <span class="grav-badge"
              :style="`background:${graviteColor(ficheActive.gravite)}20;color:${graviteColor(ficheActive.gravite)}`">
              {{ ficheActive.gravite?.toUpperCase() }}
            </span>
            <span class="modal-title">{{ ficheActive.type_incident }}</span>
          </div>
          <div class="mh-right">
            <span class="badge-statut">{{ ficheActive.statut }}</span>
            <button class="btn-close" @click="fermerFiche">✕</button>
          </div>
        </div>

        <div class="modal-body">
          <!-- Résumé IA -->
          <div v-if="ficheActive.resume_ia" class="ia-summary">
            <span class="ia-icon">🤖</span>
            <p>{{ ficheActive.resume_ia }}</p>
          </div>

          <!-- Description complète -->
          <p class="section-label">CONTENU DU POST</p>
          <p class="description-text">{{ ficheActive.description }}</p>

          <!-- Lien source -->
          <a v-if="ficheActive.lien_social" :href="ficheActive.lien_social" target="_blank" class="source-link">
            Voir le post original →
          </a>

          <!-- Infos grid -->
          <div class="info-grid">
            <div class="info-card"><span class="info-label">LIGNE</span><span class="info-value">{{ ficheActive.ligne_id
              ? `Ligne ${formatLigne(ficheActive)}` : '—' }}</span></div>
            <div class="info-card"><span class="info-label">MÉTÉO</span><span class="info-value">{{ ficheActive.meteo ||
                '—' }}</span></div>
            <div class="info-card"><span class="info-label">DATE</span><span class="info-value">{{
              formatRelative(ficheActive.created_at) }}</span></div>
            <div class="info-card"><span class="info-label">SOURCE</span><span class="info-value">{{ ficheActive.source
                }}</span></div>
          </div>

          <!-- Fiche manager IA -->
          <template v-if="ficheActive.fiche_manager">
            <p class="section-label" style="margin-top:16px">ANALYSE IA — FICHE MANAGER</p>
            <div class="fiche-manager-block">
              <div class="fm-row"><span class="fm-label">Fait</span><span>{{ ficheActive.fiche_manager.fait }}</span>
              </div>
              <div class="fm-row"><span class="fm-label">Contexte</span><span>{{ ficheActive.fiche_manager.contexte
                  }}</span></div>
              <div class="fm-row"><span class="fm-label">Gravité</span><span>{{ ficheActive.fiche_manager.gravite
                  }}</span></div>
              <div class="fm-row"><span class="fm-label">Recommandation</span><span>{{
                ficheActive.fiche_manager.recommandation }}</span></div>
            </div>
          </template>

          <!-- Score IA -->
          <template v-if="ficheActive.scoring_ia">
            <p class="section-label" style="margin-top:16px">SCORING IA</p>
            <div class="scoring-block">
              <div class="score-bar-wrap">
                <div class="score-bar"
                  :style="`width:${(ficheActive.scoring_ia.score || 0) * 10}%;background:${graviteColor(ficheActive.gravite)}`" />
              </div>
              <span class="score-val">{{ ficheActive.scoring_ia.score }}/10</span>
              <span class="confiance-val">Confiance : {{ Math.round((ficheActive.scoring_ia.confiance || 0) * 100)
                }}%</span>
            </div>
          </template>

          <div class="routing-info-banner">
            <span>→</span>
            <div>
              <strong>Transmission automatique</strong>
              <p v-if="isVersRh(ficheActive.gravite)">
                Gravité moyenne ou élevée : visible dans les dashboards Manager et RH/Juridique (e-mail selon votre flux n8n).
              </p>
              <p v-else>
                Gravité faible ou positive : visible dans le dashboard Manager uniquement.
              </p>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" @click="fermerFiche">Fermer</button>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ─── ROOT (aligné dashboard Manager : fond clair, cartes blanches) ─── */
.com-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f0f4f8;
  color: #1a1a2e;
  font-family: 'DM Sans', sans-serif;
}

/* ─── HEADER (barre bleue RATP comme Manager) ─── */
.header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 24px;
  min-height: 56px;
  background: #1b3f8b;
  border-bottom: none;
  position: sticky;
  top: 0;
  z-index: 50;
}

.h-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #1b3f8b, #00a88f);
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-s {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
}

.brand-r {
  font-size: 16px;
  font-weight: 700;
  color: #00a88f;
}

.sep {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 4px;
}

.role-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.22);
}

.h-stats {
  display: flex;
  gap: 16px;
  flex: 1;
  justify-content: center;
}

.hs {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.hs.urgent .hs-n {
  color: #f59e0b;
}

.hs-n {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.hs-l {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.75);
}

.h-right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  flex-shrink: 0;
}

.meteo-mini {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.85);
}

.clock-mini {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.btn-deconnexion {
  padding: 6px 14px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
}

.btn-deconnexion:hover {
  background: rgba(255, 255, 255, 0.18);
}

/* ─── NAV TABS ─── */
.nav-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 24px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 0 rgba(27, 63, 139, 0.04);
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1.5px solid transparent;
  background: #f8fafc;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  transition: all 0.18s ease;
  position: relative;
}

.nav-tab:hover {
  background: #eff6ff;
  color: #1b3f8b;
  border-color: #dbeafe;
}

.nav-tab.active {
  background: #1b3f8b;
  color: #fff;
  border-color: #1b3f8b;
  box-shadow: 0 4px 14px rgba(27, 63, 139, 0.25);
}

.tab-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #f59e0b;
  color: #000;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-tab.active .tab-badge {
  background: #fff;
  color: #1b3f8b;
}

.nav-filters {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.f-sel {
  padding: 6px 10px;
  border-radius: 7px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #334155;
  font-size: 12px;
  font-family: 'DM Sans', sans-serif;
  outline: none;
}

/* ─── VUE LIVE ─── */
.view-live {
  display: flex;
  gap: 0;
  flex: 1;
  min-height: 0;
}

.view-carte.view-carte-ops {
  flex: 1;
  min-height: 0;
}

.flux-col {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-right: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #f8fafc 0%, #f0f4f8 100%);
}

.col-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00a88f;
  animation: blink 1.2s ease-in-out infinite;
}

.live-label {
  font-size: 10px;
  font-weight: 700;
  color: #00a88f;
  letter-spacing: 0.1em;
}

@keyframes blink {

  0%,
  100% {
    opacity: 1
  }

  50% {
    opacity: 0.3
  }
}

.empty-msg {
  text-align: center;
  padding: 60px 20px;
  color: #94a3b8;
  font-size: 14px;
}

/* FLUX CARD */
.flux-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 14px 14px 18px;
  position: relative;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}

.flux-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 8px 24px rgba(27, 63, 139, 0.08);
  transform: translateY(-1px);
}

.flux-card.is-recent {
  border-color: rgba(0, 168, 143, 0.45);
  box-shadow: 0 0 0 1px rgba(0, 168, 143, 0.15), 0 8px 20px rgba(0, 168, 143, 0.1);
  animation: card-glow-soft 2.5s ease-in-out infinite;
}

@keyframes card-glow-soft {

  0%,
  100% {
    box-shadow: 0 0 0 1px rgba(0, 168, 143, 0.12), 0 4px 12px rgba(0, 168, 143, 0.06);
  }

  50% {
    box-shadow: 0 0 0 1px rgba(0, 168, 143, 0.25), 0 8px 22px rgba(0, 168, 143, 0.12);
  }
}

.gbar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 3px 0 0 3px;
}

.fc-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.fc-source {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}

.fc-grav {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid;
}

.new-tag {
  font-size: 9px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(0, 168, 143, 0.2);
  color: #00a88f;
  letter-spacing: 0.08em;
}

.routing-tag {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(226, 75, 74, 0.12);
  color: #e24b4a;
  letter-spacing: 0.04em;
}

.fc-time {
  margin-left: auto;
  font-size: 11px;
  color: #94a3b8;
}

.fc-type {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.fc-desc {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.fc-meta {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: #94a3b8;
}

.fc-link {
  color: #00a88f;
  text-decoration: none;
  font-weight: 500;
}

.fc-link:hover {
  text-decoration: underline;
}

/* FLUX ANIMATION */
.flux-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.flux-enter-from {
  opacity: 0;
  transform: translateY(-12px);
}

/* ─── STATS COL ─── */
.stats-col {
  width: 300px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #fff;
  border-left: 1px solid #e2e8f0;
}

.stat-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  transition: box-shadow 0.2s;
}

.stat-card:hover {
  box-shadow: 0 4px 16px rgba(27, 63, 139, 0.06);
}

.sc-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  margin-bottom: 12px;
}

.sc-empty {
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
  padding: 16px 0;
}

/* Gravité bars */
.gravite-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gbar-label {
  font-size: 11px;
  color: #64748b;
  width: 48px;
  flex-shrink: 0;
}

.gbar-track {
  flex: 1;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.gbar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s;
}

.gbar-count {
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  width: 20px;
  text-align: right;
}

/* Hotspots */
.hotspot-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hotspot-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hs-rank {
  font-size: 10px;
  color: #94a3b8;
  width: 20px;
}

.hs-ligne {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  flex: 1;
}

.hs-pills {
  display: flex;
  gap: 4px;
}

.hp {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
}

.hp-e {
  background: rgba(226, 75, 74, 0.15);
}

.hp-m {
  background: rgba(245, 158, 11, 0.15);
}

.hs-total {
  font-size: 12px;
  font-weight: 700;
  color: #1b3f8b;
}

/* Source donut */
.sd-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.sd-icon {
  font-size: 16px;
  width: 24px;
  text-align: center;
}

.sd-bar-wrap {
  flex: 1;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.sd-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s;
  min-width: 4px;
}

.sd-val {
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  width: 24px;
  text-align: right;
}

/* Validation stats */
.validation-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.vs-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.vs-circle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vs-circle span {
  font-size: 20px;
  font-weight: 700;
}

.vs-item span:last-child {
  font-size: 10px;
  color: #64748b;
}

.vs-sep {
  font-size: 18px;
  color: #cbd5e1;
}

/* ─── VUE ANALYSES ─── */
.view-analyses {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 24px;
  background:
    radial-gradient(circle at 12% 18%, rgba(27, 63, 139, 0.06) 0%, transparent 42%),
    radial-gradient(circle at 88% 72%, rgba(0, 168, 143, 0.05) 0%, transparent 40%),
    #f0f4f8;
}

.analyses-grid {
  display: flex;
  flex-direction: column;
  gap: 22px;
  max-width: 1400px;
  margin: 0 auto;
}

.analyses-hero {
  padding: 4px 4px 8px;
}

.analyses-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #1b3f8b;
  letter-spacing: -0.02em;
}

.analyses-sub {
  margin: 8px 0 0;
  font-size: 13px;
  color: #64748b;
}

.analyses-sub strong {
  color: #1e293b;
}

.anim-fade-up {
  animation: fade-up 0.55s ease-out both;
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.analyse-kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

@media (max-width: 1000px) {
  .analyse-kpi-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

.an-kpi-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 6px;
  animation: stagger-in 0.5s ease-out both;
}

.an-kpi-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
}

.an-kpi-value {
  font-size: 26px;
  font-weight: 700;
  color: #1b3f8b;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.anim-stagger-in {
  animation: stagger-in 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes stagger-in {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.analyse-visual-row {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr 1fr;
  gap: 16px;
}

@media (max-width: 1100px) {
  .analyse-visual-row {
    grid-template-columns: 1fr;
  }
}

.an-vis-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 4px 18px rgba(15, 23, 42, 0.04);
}

.an-vis-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  margin-bottom: 14px;
}

.donut-wrap {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.donut-ring {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  position: relative;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 12px #fff, 0 4px 16px rgba(27, 63, 139, 0.1);
}

.donut-hole {
  position: absolute;
  inset: 18px;
  border-radius: 50%;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 1px #e2e8f0;
}

.dh-n {
  font-size: 22px;
  font-weight: 800;
  color: #1b3f8b;
  line-height: 1;
}

.dh-l {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #94a3b8;
  margin-top: 2px;
}

.donut-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 140px;
}

.donut-legend li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.dl-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dl-t {
  color: #475569;
  flex: 1;
}

.dl-n {
  font-weight: 700;
  color: #1e293b;
}

.an-vis-sources .sd-row:last-child {
  margin-bottom: 0;
}

.sd-bar-tw {
  background: #1d9bf0;
}

.sd-bar-tt {
  background: #ff0050;
}

.an-line-ranks {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.an-line-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.al-rank {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  width: 20px;
}

.al-name {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  width: 36px;
}

.al-bar-track {
  flex: 1;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.al-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s ease;
}

.al-n {
  font-size: 12px;
  font-weight: 700;
  color: #1b3f8b;
  width: 24px;
  text-align: right;
}

.analyse-table-wrap {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 6px 28px rgba(15, 23, 42, 0.06);
}

.at-header {
  padding: 14px 18px;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(90deg, #f8fafc, #fff);
}

.at-header-meta {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
}

.analyse-table {
  width: 100%;
  border-collapse: collapse;
}

.analyse-table thead th {
  padding: 10px 12px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  text-align: left;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}

.at-row {
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}

.at-row:hover {
  background: linear-gradient(90deg, rgba(27, 63, 139, 0.04), transparent);
}

.at-row td {
  padding: 10px 12px;
  font-size: 12px;
  color: #334155;
}

.at-type {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.at-resume {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #64748b;
}

.at-date {
  white-space: nowrap;
  color: #94a3b8;
}

.src-badge {
  font-size: 11px;
  font-weight: 600;
}

.grav-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 4px;
}

.score-chip {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1b3f8b;
}

.status-chip {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}

.status-chip.validated {
  background: rgba(0, 168, 143, 0.12);
  color: #00a88f;
}

.status-chip.pending {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}

/* ─── VUE CARTE — centre d’ops (données réelles + cadre type Manager) ─── */
.view-carte-ops {
  flex: 1;
  display: flex;
  gap: 0;
  min-height: 0;
  background:
    radial-gradient(circle at 0% 50%, rgba(27, 63, 139, 0.07) 0%, transparent 45%),
    radial-gradient(circle at 100% 30%, rgba(0, 168, 143, 0.06) 0%, transparent 42%),
    #eef2f7;
}

.carte-rail {
  width: 220px;
  flex-shrink: 0;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  border-right: 1px solid #e2e8f0;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(10px);
}

.carte-rail-right {
  border-right: none;
  border-left: 1px solid #e2e8f0;
}

.carte-panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.carte-panel:hover {
  box-shadow: 0 8px 24px rgba(27, 63, 139, 0.08);
}

.carte-panel-highlight {
  border-color: rgba(27, 63, 139, 0.25);
  background: linear-gradient(145deg, #fff 0%, #f0f7ff 100%);
}

.cp-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.cp-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #00a88f;
  animation: blink 1.2s ease-in-out infinite;
  box-shadow: 0 0 8px #00a88f;
}

.cp-value {
  font-size: 28px;
  font-weight: 800;
  color: #1b3f8b;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.cp-value.cp-accent {
  color: #00a88f;
}

.cp-sub {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 6px;
  line-height: 1.35;
}

.cp-empty {
  font-size: 13px;
  color: #cbd5e1;
}

.carte-src-grid {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
}

.csg {
  flex: 1;
  text-align: center;
  padding: 8px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.csg-ic {
  display: block;
  font-size: 18px;
  margin-bottom: 4px;
}

.csg-n {
  font-size: 18px;
  font-weight: 800;
  color: #1e293b;
}

.carte-mini-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cmb-track {
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.cmb-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

.cmb-tw {
  background: #1d9bf0;
}

.cmb-tt {
  background: #ff0050;
}

.crg-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.crg-row:last-child {
  margin-bottom: 0;
}

.crg-l {
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  width: 44px;
  flex-shrink: 0;
}

.crg-track {
  flex: 1;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.crg-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

.crg-n {
  font-size: 11px;
  font-weight: 700;
  color: #334155;
  width: 20px;
  text-align: right;
}

.carte-val-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.cvr {
  text-align: center;
}

.cvr-n {
  display: block;
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
}

.cvr-l {
  font-size: 10px;
  color: #64748b;
  margin-top: 4px;
}

.cvr-arrow {
  color: #cbd5e1;
  font-size: 18px;
}

.carte-top-lines {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ctl-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.ctl-i {
  width: 18px;
  font-weight: 800;
  color: #94a3b8;
}

.ctl-l {
  flex: 1;
  font-weight: 600;
  color: #334155;
}

.ctl-t {
  font-weight: 800;
  color: #1b3f8b;
}

.carte-center {
  flex: 1;
  min-width: 0;
  padding: 16px;
  display: flex;
  align-items: stretch;
}

.carte-frame {
  flex: 1;
  position: relative;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  background: #fff;
  box-shadow:
    0 4px 24px rgba(27, 63, 139, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.8);
  overflow: hidden;
  min-height: calc(100vh - 140px);
}

.anim-map-shell {
  animation: map-shell-in 0.65s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes map-shell-in {
  from {
    opacity: 0;
    transform: scale(0.985) translateY(8px);
  }

  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.carte-frame-scan {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  background: linear-gradient(
    transparent 0%,
    transparent 48%,
    rgba(27, 63, 139, 0.03) 49%,
    rgba(27, 63, 139, 0.03) 51%,
    transparent 52%,
    transparent 100%
  );
  background-size: 100% 220%;
  animation: scan-sweep 5s linear infinite;
  opacity: 0.5;
}

@keyframes scan-sweep {
  0% {
    background-position: 0 -100%;
  }

  100% {
    background-position: 0 100%;
  }
}

.carte-map-inner {
  position: absolute;
  inset: 10px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  z-index: 1;
}

.map-wrap-com {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 180px);
}

#map-com {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.anim-carte-in {
  animation: carte-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes carte-in {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.carte-rail-right .anim-carte-in {
  animation-name: carte-in-right;
}

@keyframes carte-in-right {
  from {
    opacity: 0;
    transform: translateX(8px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.zone-panel-com {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 500;
  max-height: min(240px, 42%);
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.97);
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}

.zpc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  background: #f8fafc;
}

.zpc-title {
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
}

.zpc-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: #e2e8f0;
  color: #64748b;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.zpc-close:hover {
  background: #cbd5e1;
  color: #0f172a;
}

.zpc-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.zpc-item {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.12s;
}

.zpc-item:hover {
  background: #f1f5f9;
}

.zpc-grav {
  width: 4px;
  min-height: 36px;
  border-radius: 2px;
  flex-shrink: 0;
}

.zpc-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.zpc-src {
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
}

.zpc-type {
  font-size: 12px;
  font-weight: 500;
  color: #1e293b;
}

.zpc-meta {
  font-size: 11px;
  color: #94a3b8;
}

.map-legend-light {
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 400;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 16px;
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.08);
}

.ml-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  margin-bottom: 8px;
}

.ml-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #475569;
  margin-bottom: 4px;
}

.ml-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ml-sep {
  height: 1px;
  background: #e2e8f0;
  margin: 6px 0;
}

.ml-pulse {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #00a88f;
  animation: pulse-legend 1.5s ease-out infinite;
  flex-shrink: 0;
}

@keyframes pulse-legend {
  0% {
    transform: scale(1);
    opacity: 1;
  }

  100% {
    transform: scale(2);
    opacity: 0;
  }
}

@media (max-width: 1100px) {
  .view-carte-ops {
    flex-direction: column;
  }

  .carte-rail,
  .carte-rail-right {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    border: none;
    border-bottom: 1px solid #e2e8f0;
  }

  .carte-rail-right {
    border-top: 1px solid #e2e8f0;
    order: 3;
  }

  .carte-center {
    order: 2;
  }

  .carte-panel {
    flex: 1;
    min-width: 140px;
  }
}


/* ─── MODAL ─── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 100;
  backdrop-filter: blur(4px);
}

.modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 560px;
  max-width: calc(100vw - 32px);
  max-height: 90vh;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  z-index: 101;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.18);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid #e2e8f0;
  border-top: 3px solid var(--accent);
  background: #f8fafc;
}

.mh-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.src-badge-lg {
  font-size: 13px;
  font-weight: 700;
}

.grav-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
}

.modal-title {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.mh-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-statut {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
}

.btn-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ia-summary {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  background: rgba(0, 168, 143, 0.08);
  border: 1px solid rgba(0, 168, 143, 0.2);
  border-radius: 10px;
}

.ia-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.ia-summary p {
  font-size: 13px;
  color: #334155;
  line-height: 1.5;
}

.section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
}

.description-text {
  font-size: 14px;
  color: #475569;
  line-height: 1.6;
}

.source-link {
  font-size: 12px;
  color: #00a88f;
  text-decoration: none;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.info-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.info-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
}

.info-value {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
}

.fiche-manager-block {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fm-row {
  display: flex;
  gap: 10px;
  font-size: 12px;
}

.fm-label {
  font-weight: 700;
  color: #64748b;
  width: 96px;
  flex-shrink: 0;
}

.scoring-block {
  display: flex;
  align-items: center;
  gap: 10px;
}

.score-bar-wrap {
  flex: 1;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.score-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s;
}

.score-val {
  font-size: 14px;
  font-weight: 700;
  color: #1b3f8b;
}

.confiance-val {
  font-size: 11px;
  color: #64748b;
}

.routing-info-banner {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  background: rgba(27, 63, 139, 0.06);
  border: 1px solid rgba(27, 63, 139, 0.15);
  border-radius: 10px;
  margin-top: 8px;
}

.routing-info-banner span:first-child {
  font-size: 18px;
  color: #1b3f8b;
}

.routing-info-banner strong {
  font-size: 13px;
  color: #1b3f8b;
  display: block;
  margin-bottom: 3px;
}

.routing-info-banner p {
  font-size: 12px;
  color: #64748b;
}

.modal-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.btn-secondary {
  padding: 10px 20px;
  border-radius: 9px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

/* ─── TRANSITIONS ─── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from {
  opacity: 0;
  transform: translate(-50%, -46%);
}
</style>

<style>
@keyframes pulse-map-com {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.6;
  }

  100% {
    transform: translate(-50%, -50%) scale(1.85);
    opacity: 0;
  }
}
</style>