<script setup>
definePageMeta({ middleware: ['auth'] })
const { deconnexion, profile } = useAuth()
import { ref, computed, onMounted, watch } from 'vue'

const { data: signalements, refresh: refreshSignalements } = await useFetch('/api/signalements-manager')
useSignalementsRealtimeRefresh(refreshSignalements)
const { data: meteo } = await useFetch('/api/meteo')
const { data: agentsRisque } = await useFetch('/api/stats/agents-risque')
const { data: lignes } = await useFetch('/api/lignes')

const monId = computed(() => profile.value?.id || null)

const filtreStatut = ref('nouveau')
const filtreLigne = ref('')
const filtreGravite = ref('')
const filtrePeriode = ref('30')

const ficheActive = ref(null)
const ficheOuverte = ref(false)
const actionLoading = ref(false)
const zoneActive = ref(null)
const heure = ref('')
const date = ref('')

const mailPropose = ref('')
const mailSujet = ref('')
const mailMode = ref(false)
const mailEnvoye = ref(false)

const mailPhase = ref('prise_en_compte')

const matriculeAgent = ref('')
const matriculeLoading = ref(false)
const matriculeCheckError = ref('')
const recidiveResult = ref(null)
const emailAgent = ref('')
const mailAgentSujet = ref('')
const mailAgentCorps = ref('')
const mailAgentEnvoye = ref(false)

const estVerrouille = (s) =>
  s.pris_en_charge_par !== null &&
  s.pris_en_charge_par !== undefined &&
  s.pris_en_charge_par !== monId.value

onMounted(() => {
  const tick = () => {
    const now = new Date()
    heure.value = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    date.value = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  }
  tick()
  setInterval(tick, 1000)
})

const condition = computed(() => {
  const desc = meteo.value?.description?.toLowerCase() || ''
  const icon = meteo.value?.icon || ''
  if (desc.includes('orage')) return 'orage'
  if (desc.includes('neige') || desc.includes('snow')) return 'neige'
  if (desc.includes('pluie') || desc.includes('rain') || desc.includes('bruine')) return 'pluie'
  if (desc.includes('brume') || desc.includes('brouillard')) return 'brume'
  if (desc.includes('couvert') || desc.includes('overcast')) return 'couvert'
  if (desc.includes('nuage') || desc.includes('cloud')) return 'nuage'
  if (icon.startsWith('01')) return 'soleil'
  if (icon.startsWith('02') || icon.startsWith('03')) return 'nuage'
  if (icon.startsWith('04')) return 'couvert'
  if (icon.startsWith('09') || icon.startsWith('10')) return 'pluie'
  if (icon.startsWith('11')) return 'orage'
  if (icon.startsWith('13')) return 'neige'
  return 'nuage'
})

const signalementsFiltres = computed(() => {
  if (!signalements.value) return []
  const cutoff = new Date(Date.now() - parseInt(filtrePeriode.value) * 86400000)
  return signalements.value.filter(s => {
    if (filtreLigne.value && s.ligne_id !== filtreLigne.value) return false
    if (filtreGravite.value && s.gravite !== filtreGravite.value) return false
    if (filtreStatut.value && s.statut !== filtreStatut.value) return false
    if (new Date(s.heure_incident) < cutoff) return false
    return true
  })
})

const countNouveau = computed(() => signalements.value?.filter(s => s.statut === 'nouveau').length || 0)
const countEnCours = computed(() => signalements.value?.filter(s => s.statut === 'en_cours').length || 0)
const countTraite = computed(() => signalements.value?.filter(s => s.statut === 'traité').length || 0)
const countEleve = computed(() => signalements.value?.filter(s => s.gravite === 'élevé').length || 0)
const countMoyen = computed(() => signalements.value?.filter(s => s.gravite === 'moyen').length || 0)
const countFaible = computed(() => signalements.value?.filter(s => s.gravite === 'faible').length || 0)
const countPositif = computed(() => signalements.value?.filter(s => s.gravite === 'positif').length || 0)
const totalSignalements = computed(() => signalements.value?.length || 0)
const barMax = computed(() => Math.max(countEleve.value, countMoyen.value, countFaible.value, countPositif.value, 1))
const alertesUrgentes = computed(() => signalements.value?.filter(s => s.gravite === 'élevé' && s.statut === 'nouveau') || [])

const graviteColor = g => ({ 'élevé': '#e24b4a', 'moyen': '#f59e0b', 'faible': '#3b82f6', 'positif': '#4bc0ad' }[g] || '#888')
const estPositif = computed(() => ficheActive.value?.gravite === 'positif')
const estGereRH = s => s.gravite === 'moyen' || s.gravite === 'élevé'

function formatDate(iso) { return new Date(iso).toLocaleDateString('fr-FR') }
function formatLigne(s) { return s.ligne_id?.replace('L', '') || s.ligne || '—' }

function genFallback(s) {
  if (s.gravite === 'positif') {
    return `Madame, Monsieur ${s.voyageur_prenom || ''} ${s.voyageur_nom || ''},\n\nNous avons bien reçu votre retour positif du ${formatDate(s.heure_incident)} concernant un agent sur la ligne ${formatLigne(s)}.\n\nVotre témoignage a été transmis et sera valorisé. Nous vous remercions pour ce retour encourageant.\n\nCordialement,\nLe Manager du Centre Bus RATP`
  }
  return `Madame, Monsieur ${s.voyageur_prenom || ''} ${s.voyageur_nom || ''},\n\nNous avons bien reçu votre signalement du ${formatDate(s.heure_incident)} concernant un incident sur la ligne ${formatLigne(s)}.\n\nVotre dossier est en cours de traitement. Nous reviendrons vers vous dans les plus brefs délais.\n\nCordialement,\nLe Manager du Centre Bus RATP`
}
function genFallbackCloture(s) {
  if (s.gravite === 'positif') {
    return `Madame, Monsieur ${s.voyageur_prenom || ''} ${s.voyageur_nom || ''},\n\nNous vous confirmons que votre retour positif du ${formatDate(s.heure_incident)} a bien été pris en compte et transmis à l'agent concerné.\n\nMerci pour votre bienveillance.\n\nCordialement,\nLe Manager du Centre Bus RATP`
  }
  return `Madame, Monsieur ${s.voyageur_prenom || ''} ${s.voyageur_nom || ''},\n\nNous vous informons que votre signalement du ${formatDate(s.heure_incident)} sur la ligne ${formatLigne(s)} a été traité.\n\nToutes les mesures nécessaires ont été prises. Nous vous remercions pour votre vigilance.\n\nCordialement,\nLe Manager du Centre Bus RATP`
}

function genFallbackFelicitations(s) {
  return `Madame, Monsieur,\n\nNous avons reçu un retour très positif d'un voyageur vous concernant, survenu le ${formatDate(s.heure_incident)} sur la ligne ${formatLigne(s)}.\n\nVotre attitude exemplaire a été remarquée et nous tenons à vous en féliciter. Continuez ainsi !\n\nCordialement,\nLe Manager du Centre Bus RATP`
}

function ouvrirFiche(s) {
  ficheActive.value = s
  ficheOuverte.value = true
  mailEnvoye.value = false
  mailAgentEnvoye.value = false
  mailPropose.value = ''
  mailSujet.value = ''
  mailMode.value = false
  recidiveResult.value = null
  matriculeCheckError.value = ''
  matriculeAgent.value = s.agent_id || ''
  emailAgent.value = s.email_agent || ''
  mailAgentSujet.value = s.mail_agent_sujet || ''
  mailAgentCorps.value = s.mail_agent_corps || ''

  const positif = s.gravite === 'positif'

  if (estVerrouille(s)) {
    ficheActive.value = s
    ficheOuverte.value = true
    mailPhase.value = 'verrouille'
    return
  }

  if (s.statut === 'nouveau') {
    if (s.gravite === 'moyen' || s.gravite === 'élevé') {
      mailPhase.value = 'rh_only'
    } else {
      mailPhase.value = 'prise_en_compte'
    }

  } else if (s.statut === 'en_cours') {

    if (positif) {
      if (!s.agent_id) {
        mailPhase.value = 'matricule_positif'
      } else if (s.agent_traite) {
        mailPhase.value = 'traite'
      } else {
        mailPhase.value = 'agent_feliciter'
        mailAgentSujet.value = s.mail_agent_sujet || ''
        mailAgentCorps.value = s.mail_agent_corps || genFallbackFelicitations(s)
      }

    } else {
      if (s.gravite === 'moyen' || s.gravite === 'élevé') {
        mailPhase.value = 'rh_only'

      } else {
        if (s.agent_traite) {
          mailPhase.value = 'traite'
        } else if (s.recidive === true) {
          mailPhase.value = 'agent_recidive'
          recidiveResult.value = { recidive: true }
        } else if (s.recidive === false) {
          mailPhase.value = 'agent_no_recidive'
          recidiveResult.value = { recidive: false }
        } else {
          mailPhase.value = 'matricule'
        }
      }
    }

  } else if (s.statut === 'traité') {
    mailPhase.value = 'traite'
  }
}

function fermerFiche() {
  ficheOuverte.value = false
  setTimeout(() => { ficheActive.value = null }, 300)
}

async function prendreEnCharge() {
  if (!ficheActive.value) return
  actionLoading.value = true
  try {
    mailSujet.value = ficheActive.value.mail_voyageur_sujet
      || `Votre signalement du ${formatDate(ficheActive.value.heure_incident)} — Ligne ${formatLigne(ficheActive.value)}`
    mailPropose.value = ficheActive.value.mail_voyageur_draft || genFallback(ficheActive.value)
    mailPhase.value = 'prise_en_compte'
    mailMode.value = true
  } finally {
    actionLoading.value = false
  }
}

async function validerMatricule() {
  if (!ficheActive.value || !matriculeAgent.value.trim()) return
  matriculeLoading.value = true
  matriculeCheckError.value = ''
  try {
    const result = await $fetch(`/api/signalement/${ficheActive.value.id}/check-recidive`, {
      method: 'POST',
      body: { matricule: matriculeAgent.value.trim() }
    })

    recidiveResult.value = result

    if (result.recidive) {
      mailAgentSujet.value = result.mail_agent_sujet || ''
      mailAgentCorps.value = result.mail_agent_corps || ''
      mailPhase.value = 'agent_recidive'
    } else {
      mailPhase.value = 'agent_no_recidive'
    }

    await refreshSignalements()
  } catch (e) {
    const ex = e && typeof e === 'object' ? e : {}
    const data = 'data' in ex ? ex.data : undefined
    const fromData = data && typeof data === 'object' && 'message' in data ? String(data.message) : ''
    matriculeCheckError.value = fromData || (e instanceof Error ? e.message : '') || 'Impossible de vérifier la récidive.'
  } finally {
    matriculeLoading.value = false
  }
}

async function validerMatriculePositif() {
  if (!ficheActive.value || !matriculeAgent.value.trim()) return
  matriculeLoading.value = true
  try {
    await $fetch(`/api/signalement/${ficheActive.value.id}/statut`, {
      method: 'PATCH',
      body: { matricule_agent: matriculeAgent.value.trim() }
    })

    mailAgentSujet.value = ficheActive.value.mail_agent_sujet
      || `Félicitations — Retour positif d'un voyageur — Ligne ${formatLigne(ficheActive.value)}`
    mailAgentCorps.value = ficheActive.value.mail_agent_corps || genFallbackFelicitations(ficheActive.value)

    mailPhase.value = 'agent_feliciter'
    await refreshSignalements()
  } finally {
    matriculeLoading.value = false
  }
}

async function envoyerMailAgent() {
  if (!ficheActive.value || !emailAgent.value.trim()) return
  actionLoading.value = true
  try {
    await $fetch(`/api/signalement/${ficheActive.value.id}/envoyer-mail`, {
      method: 'POST',
      body: {
        sujet: mailAgentSujet.value,
        corps: mailAgentCorps.value,
        email_destinataire: emailAgent.value.trim(),
        dashboard: 'manager-agent'
      }
    })

    await $fetch(`/api/signalement/${ficheActive.value.id}/statut`, {
      method: 'PATCH',
      body: { email_agent: emailAgent.value.trim(), agent_traite: true }
    })

    mailAgentEnvoye.value = true
    mailPhase.value = 'traite'
    await refreshSignalements()
  } finally {
    actionLoading.value = false
  }
}

async function envoyerMailFelicitations() {
  if (!ficheActive.value || !emailAgent.value.trim()) return
  actionLoading.value = true
  try {
    await $fetch(`/api/signalement/${ficheActive.value.id}/envoyer-mail`, {
      method: 'POST',
      body: {
        sujet: mailAgentSujet.value,
        corps: mailAgentCorps.value,
        email_destinataire: emailAgent.value.trim(),
        dashboard: 'manager-felicitations'
      }
    })

    await $fetch(`/api/signalement/${ficheActive.value.id}/statut`, {
      method: 'PATCH',
      body: { email_agent: emailAgent.value.trim(), agent_traite: true }
    })

    mailAgentEnvoye.value = true
    mailPhase.value = 'traite'
    await refreshSignalements()
  } finally {
    actionLoading.value = false
  }
}

async function ignorerFelicitations() {
  if (!ficheActive.value) return
  actionLoading.value = true
  try {
    await $fetch(`/api/signalement/${ficheActive.value.id}/statut`, {
      method: 'PATCH',
      body: { agent_traite: true }
    })
    mailPhase.value = 'traite'
    await refreshSignalements()
  } finally {
    actionLoading.value = false
  }
}

async function confirmerPasDeRecidive() {
  if (!ficheActive.value) return
  actionLoading.value = true
  try {
    await $fetch(`/api/signalement/${ficheActive.value.id}/statut`, {
      method: 'PATCH',
      body: { agent_traite: true }
    })
    mailPhase.value = 'traite'
    await refreshSignalements()
  } finally {
    actionLoading.value = false
  }
}

async function genererMailCloture() {
  if (!ficheActive.value) return
  mailSujet.value = ficheActive.value.mail_voyageur_sujet_cloture
    || `Clôture de votre signalement du ${formatDate(ficheActive.value.heure_incident)} — Ligne ${formatLigne(ficheActive.value)}`
  mailPropose.value = ficheActive.value.mail_voyageur_draft_cloture || genFallbackCloture(ficheActive.value)
  mailMode.value = true
}

async function refuser() {
  if (!ficheActive.value) return
  actionLoading.value = true
  try {
    await $fetch(`/api/signalement/${ficheActive.value.id}/statut`, {
      method: 'PATCH', body: { statut: 'refusé', pris_en_charge_par: null }
    })
    fermerFiche()
    await refreshSignalements()
  } finally {
    actionLoading.value = false
  }
}

async function envoyerMail() {
  if (!ficheActive.value) return
  actionLoading.value = true
  try {
    await $fetch(`/api/signalement/${ficheActive.value.id}/envoyer-mail`, {
      method: 'POST',
      body: {
        sujet: mailSujet.value,
        corps: mailPropose.value,
        email_destinataire: ficheActive.value.voyageur_email,
        dashboard: 'manager'
      }
    })

    if (mailPhase.value === 'traite') {
      await $fetch(`/api/signalement/${ficheActive.value.id}/statut`, {
        method: 'PATCH', body: { statut: 'traité' }
      })
      mailEnvoye.value = true
      mailMode.value = false
      await refreshSignalements()
      const id = ficheActive.value.id
      const next = signalements.value?.find(s => s.id === id)
      if (next) ficheActive.value = next

    } else {
      await $fetch(`/api/signalement/${ficheActive.value.id}/statut`, {
        method: 'PATCH', body: { statut: 'en_cours', pris_en_charge_par: monId.value }
      })
      mailEnvoye.value = true
      mailMode.value = false
      await refreshSignalements()
      const id = ficheActive.value.id
      const next = signalements.value?.find(s => s.id === id)
      if (next) ficheActive.value = next
      mailPhase.value = estPositif.value ? 'matricule_positif' : 'matricule'
    }
  } finally {
    actionLoading.value = false
  }
}

let mapInstance = null
let layerGroup = null
let L_ref = null

watch(signalementsFiltres, () => { if (layerGroup) rafraichirMarqueurs() })

onMounted(async () => {
  L_ref = await import('leaflet')
  await import('leaflet/dist/leaflet.css')
  mapInstance = L_ref.map('map', { zoomControl: false }).setView([48.855, 2.38], 13)
  L_ref.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19
  }).addTo(mapInstance)
  L_ref.control.zoom({ position: 'bottomright' }).addTo(mapInstance)
  layerGroup = L_ref.layerGroup().addTo(mapInstance)
  mapInstance.on('click', () => { zoneActive.value = null })
  rafraichirMarqueurs()
})

/** Rayon max (px) du cercle sur la carte pour éviter les marqueurs trop grands */
const MAP_MARKER_RADIUS_MAX = 40

function rafraichirMarqueurs() {
  if (!layerGroup || !L_ref) return
  zoneActive.value = null
  layerGroup.clearLayers()
  const zones = {}
  const liste = signalementsFiltres.value || []
  liste.forEach(s => {
    if (!s.lat || !s.lng) return
    const key = `${Math.round(s.lat * 500) / 500}_${Math.round(s.lng * 500) / 500}`
    if (!zones[key]) zones[key] = { lat: s.lat, lng: s.lng, items: [] }
    zones[key].items.push(s)
  })
  Object.values(zones).forEach(zone => {
    const dominante = zone.items.reduce((acc, s) => {
      const poids = { 'élevé': 4, 'moyen': 3, 'faible': 2, 'positif': 1 }
      return (poids[s.gravite] || 0) > (poids[acc.gravite] || 0) ? s : acc
    }, zone.items[0])
    const color = graviteColor(dominante.gravite)
    const count = zone.items.length
    const radius = Math.min(12 + count * 4, MAP_MARKER_RADIUS_MAX)
    const fs = count > 99 ? 9 : count > 9 ? 11 : 13
    const icon = L_ref.divIcon({
      className: '',
      html: `<div style="width:${radius * 2}px;height:${radius * 2}px;background:${color};border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:${fs}px;font-family:'DM Sans',sans-serif;cursor:pointer">${count}</div>`,
      iconSize: [radius * 2, radius * 2],
      iconAnchor: [radius, radius]
    })
    L_ref.marker([zone.lat, zone.lng], { icon })
      .addTo(layerGroup)
      .on('click', (e) => {
        if (e.originalEvent) L_ref.DomEvent.stopPropagation(e.originalEvent)
        zoneActive.value = zone
      })
  })
}

function fermerZoneCarte() {
  zoneActive.value = null
}

function ouvrirFicheDepuisZone(s) {
  fermerZoneCarte()
  ouvrirFiche(s)
}
</script>

<template>
  <div class="dash">

    <header class="header">
      <div class="header-brand">
        <img src="/branding/ratp-mark.png" alt="RATP" class="brand-mark-header" width="120" height="34" />
        <span class="brand-text"><span class="brand-vigie">Vigie</span><span class="brand-ratp">RATP</span></span>
        <div class="brand-sep" />
        <span class="role-pill">Manager Centre Bus</span>
      </div>

      <div class="header-center">
        <Transition name="fade">
          <div v-if="alertesUrgentes.length > 0" class="alerte-banner">
            <span class="alerte-pulse" />
            <span>{{ alertesUrgentes.length }} alerte{{ alertesUrgentes.length > 1 ? 's' : '' }} urgente{{
              alertesUrgentes.length > 1 ? 's' : '' }}</span>
            <span v-for="a in alertesUrgentes.slice(0, 2)" :key="a.id" class="alerte-tag" @click="ouvrirFiche(a)">{{
              a.type_incident?.substring(0, 20) }}…</span>
          </div>
        </Transition>
      </div>

      <div class="header-right">
        <div class="clock">
          <span class="clock-time">{{ heure }}</span>
          <span class="clock-date">{{ date }}</span>
        </div>
      </div>
      <button class="btn-deconnexion" @click="deconnexion">Déconnexion</button>
    </header>

    <main class="main">

      <aside class="col-left">

        <div class="card meteo-card">
          <div class="meteo-anim">
            <div v-if="condition === 'soleil'" class="anim-soleil">
              <div class="s-core" />
              <div class="s-rays">
                <div v-for="i in 8" :key="i" class="s-ray" :style="`--i:${i}`" />
              </div>
            </div>
            <div v-else-if="condition === 'nuage'" class="anim-nuage">
              <div class="mini-sun" />
              <div class="cloud c1" />
              <div class="cloud c2" />
            </div>
            <div v-else-if="condition === 'couvert'" class="anim-couvert">
              <div class="cloud-big cb1" />
              <div class="cloud-big cb2" />
              <div class="cloud-big cb3" />
            </div>
            <div v-else-if="condition === 'pluie'" class="anim-pluie">
              <div class="cloud-dark" />
              <div class="drops">
                <div v-for="i in 10" :key="i" class="d" :style="`--i:${i}`" />
              </div>
            </div>
            <div v-else-if="condition === 'orage'" class="anim-orage">
              <div class="cloud-dark" />
              <div class="eclair">⚡</div>
              <div class="drops">
                <div v-for="i in 10" :key="i" class="d fast" :style="`--i:${i}`" />
              </div>
            </div>
            <div v-else-if="condition === 'neige'" class="anim-neige">
              <div class="cloud-big cb1" />
              <div class="flocons">
                <div v-for="i in 8" :key="i" class="fl" :style="`--i:${i}`">❄</div>
              </div>
            </div>
            <div v-else class="anim-brume">
              <div v-for="i in 3" :key="i" class="brume-l" :style="`--i:${i}`" />
            </div>
          </div>
          <div v-if="meteo" class="meteo-info">
            <span class="meteo-temp">{{ meteo.temp }}<sup>°C</sup></span>
            <span class="meteo-desc">{{ meteo.description }}</span>
            <div class="meteo-details">
              <span>💧 {{ meteo.humidity }}%</span>
              <span>💨 {{ meteo.wind }} km/h</span>
            </div>
          </div>
        </div>

        <div class="card map-card">
          <div class="card-title">Carte des incidents</div>
          <div class="map-wrap">
            <div id="map" />
            <Transition name="fade">
              <div v-if="zoneActive" class="zone-panel" @click.stop>
                <div class="zone-panel-head">
                  <span class="zone-panel-title">{{ zoneActive.items.length }} signalement{{
                    zoneActive.items.length > 1 ? 's' : '' }} à cet endroit</span>
                  <button type="button" class="zone-panel-close" aria-label="Fermer" @click="fermerZoneCarte">×</button>
                </div>
                <ul class="zone-panel-list">
                  <li v-for="s in zoneActive.items" :key="s.id" class="zone-panel-item"
                    @click="ouvrirFicheDepuisZone(s)">
                    <span class="zpi-grav" :style="`background:${graviteColor(s.gravite)}`" />
                    <div class="zpi-body">
                      <span class="zpi-type">{{ s.type_incident }}</span>
                      <span class="zpi-meta">Ligne {{ formatLigne(s) }} · {{ new Date(s.heure_incident).toLocaleString('fr-FR',
                        { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }}</span>
                    </div>
                  </li>
                </ul>
              </div>
            </Transition>
          </div>
          <div class="map-legende">
            <span class="leg"><span class="dot" style="background:#e24b4a" />Élevé</span>
            <span class="leg"><span class="dot" style="background:#f59e0b" />Moyen</span>
            <span class="leg"><span class="dot" style="background:#3b82f6" />Faible</span>
            <span class="leg"><span class="dot" style="background:#4bc0ad" />Positif</span>
          </div>
        </div>

      </aside>

      <section class="col-center">

        <div class="card tabs-card">
          <div class="tabs">
            <button v-for="t in [
              { val: 'nouveau', label: 'Nouveaux', count: countNouveau },
              { val: 'en_cours', label: 'En cours', count: countEnCours },
              { val: 'traité', label: 'Traités', count: countTraite },
            ]" :key="t.val" class="tab" :class="{ active: filtreStatut === t.val }" @click="filtreStatut = t.val">
              {{ t.label }}
              <span class="tab-count" :class="t.val">{{ t.count }}</span>
            </button>
          </div>
          <div class="tab-filters">
            <select v-model="filtreLigne" class="f-select">
              <option value="">Toutes les lignes</option>
              <option v-for="l in lignes" :key="l.id" :value="l.id">Ligne {{ l.numero }}</option>
            </select>
            <select v-model="filtreGravite" class="f-select">
              <option value="">Toutes gravités</option>
              <option value="élevé">Élevé</option>
              <option value="moyen">Moyen</option>
              <option value="faible">Faible</option>
              <option value="positif">Positif</option>
            </select>
            <select v-model="filtrePeriode" class="f-select">
              <option value="7">7 jours</option>
              <option value="30">30 jours</option>
              <option value="90">3 mois</option>
              <option value="365">12 mois</option>
            </select>
          </div>
        </div>

        <div class="sig-list">
          <div v-if="signalementsFiltres.length === 0" class="sig-empty">
            Aucun signalement dans cette catégorie
          </div>
          <TransitionGroup name="list">
            <div v-for="s in signalementsFiltres" :key="s.id" class="sig-card" @click="ouvrirFiche(s)">
              <div class="sig-grav-bar" :style="`background:${graviteColor(s.gravite)}`" />
              <div class="sig-body">
                <div class="sig-head">
                  <span class="sig-badge"
                    :style="`background:${graviteColor(s.gravite)}18;color:${graviteColor(s.gravite)};border-color:${graviteColor(s.gravite)}40`">
                    {{ s.gravite?.toUpperCase() }}
                  </span>
                  <span class="sig-type">{{ s.type_incident }}</span>
                  <span v-if="estGereRH(s)" class="rh-tag">RH/Juridique</span>
                  <span v-if="estVerrouille(s)" class="locked-tag">🔒 En cours</span>
                </div>
                <p class="sig-desc">{{ s.description?.substring(0, 80) }}{{ s.description?.length > 80 ? '…' : '' }}</p>
                <div class="sig-meta">
                  <span>{{ s.ligne_id ? `Ligne ${s.ligne_id.replace('L', '')}` : '—' }}</span>
                  <span>{{ s.direction || '—' }}</span>
                  <span>{{ new Date(s.heure_incident).toLocaleString('fr-FR',
                    { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }}</span>
                </div>
              </div>
              <div class="sig-arrow">›</div>
            </div>
          </TransitionGroup>
        </div>

      </section>

      <aside class="col-right">

        <div class="card agents-card">
          <div class="card-title">Agents à surveiller</div>
          <div v-if="!agentsRisque || agentsRisque.length === 0" class="empty-state">
            Aucun agent à risque
          </div>
          <div v-else class="agents-list">
            <div v-for="(agent, i) in agentsRisque" :key="agent.id" class="agent-row"
              :class="{ critique: agent.eleve >= 3, alerte: agent.eleve >= 1 && agent.eleve < 3 }">
              <span class="a-rank">#{{ i + 1 }}</span>
              <div class="a-info">
                <span class="a-id">{{ agent.id || 'Agent inconnu' }}</span>
                <div class="a-pills">
                  <span v-if="agent.eleve" class="ap ap-eleve">{{ agent.eleve }} élevé</span>
                  <span v-if="agent.moyen" class="ap ap-moyen">{{ agent.moyen }} moyen</span>
                  <span v-if="agent.faible" class="ap ap-faible">{{ agent.faible }} faible</span>
                </div>
              </div>
              <span class="a-total">{{ agent.total }}</span>
            </div>
          </div>
        </div>

        <div class="card chart-card">
          <div class="card-title">Répartition par gravité</div>
          <div class="chart-bars">
            <div v-for="bar in [
              { label: 'Élevé', count: countEleve, color: '#e24b4a' },
              { label: 'Moyen', count: countMoyen, color: '#f59e0b' },
              { label: 'Faible', count: countFaible, color: '#3b82f6' },
              { label: 'Positif', count: countPositif, color: '#4bc0ad' },
            ]" :key="bar.label" class="bar-row">
              <span class="bar-label">{{ bar.label }}</span>
              <div class="bar-track">
                <div class="bar-fill" :style="`width:${(bar.count / barMax) * 100}%;background:${bar.color}`" />
              </div>
              <span class="bar-count">{{ bar.count }}</span>
            </div>
          </div>
          <div class="chart-total">
            <span>Total : <strong>{{ totalSignalements }}</strong> signalements</span>
          </div>
        </div>

      </aside>
    </main>


    <Transition name="fade">
      <div v-if="ficheOuverte" class="modal-overlay" @click.self="fermerFiche" />
    </Transition>

    <Transition name="slide-up">
      <div v-if="ficheOuverte && ficheActive" class="modal">

        <div class="modal-header" :style="`--accent: ${graviteColor(ficheActive.gravite)}`">
          <div class="modal-header-left">
            <span class="badge-gravite"
              :style="`background:${graviteColor(ficheActive.gravite)}20;color:${graviteColor(ficheActive.gravite)}`">
              {{ ficheActive.gravite?.toUpperCase() }}
            </span>
            <span class="modal-title">{{ ficheActive.type_incident }}</span>
          </div>
          <div class="modal-header-right">
            <span class="badge-statut">{{ ficheActive.statut }}</span>
            <button class="btn-close" @click="fermerFiche">✕</button>
          </div>
        </div>

        <div class="modal-body">

          <template v-if="mailPhase === 'rh_only'">
            <p class="section-label">DESCRIPTION DU VOYAGEUR</p>
            <p class="description-text">{{ ficheActive.description }}</p>
            <div class="info-grid">
              <div class="info-card"><span class="info-label">LIGNE</span><span class="info-value">Ligne {{
                ficheActive.ligne_id?.replace('L', '') }}</span></div>
              <div class="info-card"><span class="info-label">DIRECTION</span><span class="info-value">{{
                ficheActive.direction }}</span></div>
              <div class="info-card"><span class="info-label">DATE &amp; HEURE</span><span class="info-value">{{ new
                Date(ficheActive.heure_incident).toLocaleString('fr-FR') }}</span></div>
              <div class="info-card"><span class="info-label">MÉTÉO</span><span class="info-value">{{ ficheActive.meteo
                  }}</span></div>
              <div class="info-card"><span class="info-label">VOYAGEUR</span><span class="info-value">{{
                ficheActive.voyageur_prenom }} {{ ficheActive.voyageur_nom }}</span></div>
              <div class="info-card"><span class="info-label">EMAIL VOYAGEUR</span><span class="info-value">{{
                ficheActive.voyageur_email }}</span></div>
              <div class="info-card"><span class="info-label">AGENT ASSIGNÉ</span><span class="info-value">{{
                ficheActive.agent_id || 'Non assigné' }}</span></div>
              <div class="info-card"><span class="info-label">SOURCE</span><span class="info-value">{{
                ficheActive.source }}</span></div>
            </div>
            <div class="rh-notice">
              <span class="rh-icon">⚖️</span>
              <div>
                <strong>Géré par le service RH / Juridique</strong>
                <p>
                  Gravité <strong>{{ ficheActive.gravite }}</strong> : pris en charge par le service RH / Juridique.
                  Affichage à titre informatif.
                </p>
              </div>
            </div>
          </template>

          <template v-if="!mailMode && mailPhase === 'prise_en_compte'">
            <p class="section-label">DESCRIPTION DU VOYAGEUR</p>
            <p class="description-text">{{ ficheActive.description }}</p>
            <div class="info-grid">
              <div class="info-card"><span class="info-label">LIGNE</span><span class="info-value">Ligne {{
                ficheActive.ligne_id?.replace('L', '') }}</span></div>
              <div class="info-card"><span class="info-label">DIRECTION</span><span class="info-value">{{
                ficheActive.direction }}</span></div>
              <div class="info-card"><span class="info-label">DATE &amp; HEURE</span><span class="info-value">{{ new
                Date(ficheActive.heure_incident).toLocaleString('fr-FR') }}</span></div>
              <div class="info-card"><span class="info-label">MÉTÉO</span><span class="info-value">{{ ficheActive.meteo
                  }}</span></div>
              <div class="info-card"><span class="info-label">VOYAGEUR</span><span class="info-value">{{
                ficheActive.voyageur_prenom }} {{ ficheActive.voyageur_nom }}</span></div>
              <div class="info-card"><span class="info-label">EMAIL VOYAGEUR</span><span class="info-value">{{
                ficheActive.voyageur_email }}</span></div>
              <div class="info-card"><span class="info-label">AGENT ASSIGNÉ</span><span class="info-value">{{
                ficheActive.agent_id || 'Non assigné' }}</span></div>
              <div class="info-card"><span class="info-label">SOURCE</span><span class="info-value">{{
                ficheActive.source }}</span></div>
            </div>
          </template>

          <template v-if="mailMode">
            <p class="section-label">
              {{ mailPhase === 'traite' ? 'MAIL DE CLÔTURE AU VOYAGEUR' : 'MAIL DE PRISE EN COMPTE AU VOYAGEUR' }}
            </p>
            <p class="mail-hint">Vous pouvez modifier ce message avant envoi.</p>
            <input v-model="mailSujet" class="mail-sujet-input" placeholder="Objet du mail" />
            <textarea v-model="mailPropose" class="mail-textarea" rows="10" />
          </template>

          <template v-if="!mailMode && mailPhase === 'matricule'">
            <div class="phase-block">
              <div class="phase-icon">🪪</div>
              <h3 class="phase-title">Renseigner le matricule du chauffeur</h3>
              <p class="phase-desc">
                La RATP a croisé ses données en interne. Renseignez le matricule du chauffeur
                pour déclencher la vérification des règles de récidive.
              </p>
              <input v-model="matriculeAgent" class="matricule-input" placeholder="Ex : AGT-042"
                :disabled="matriculeLoading" @keyup.enter="validerMatricule" />
              <p v-if="matriculeCheckError" class="matricule-error">{{ matriculeCheckError }}</p>
              <div v-if="matriculeLoading" class="loading-block">
                <span class="spinner" />
                <span>Vérification des récidives en cours…</span>
              </div>
            </div>
          </template>

          <template v-if="!mailMode && mailPhase === 'matricule_positif'">
            <div class="phase-block">
              <div class="phase-icon">🌟</div>
              <h3 class="phase-title">Identifier l'agent à féliciter</h3>
              <p class="phase-desc">
                Un voyageur a partagé un retour positif. Vous pouvez renseigner
                le matricule de l'agent concerné pour lui transmettre des félicitations.
              </p>
              <input v-model="matriculeAgent" class="matricule-input" placeholder="Ex : AGT-055 (optionnel)"
                :disabled="matriculeLoading" @keyup.enter="validerMatriculePositif" />
              <div v-if="matriculeLoading" class="loading-block">
                <span class="spinner" />
                <span>Préparation du message…</span>
              </div>
            </div>
          </template>

          <template v-if="!mailMode && mailPhase === 'agent_recidive'">
            <div class="phase-block">
              <div class="recidive-banner">
                <span class="recidive-icon">⚠️</span>
                <div>
                  <strong>Récidive détectée</strong>
                  <p>Ce chauffeur a déjà fait l'objet de signalements. Un courrier a été préparé par l'IA.</p>
                </div>
              </div>
              <p class="section-label" style="margin-top:4px">MAIL À ENVOYER AU CHAUFFEUR</p>
              <p class="mail-hint">Vous pouvez modifier ce message avant envoi.</p>
              <input v-model="mailAgentSujet" class="mail-sujet-input" placeholder="Objet du mail" />
              <textarea v-model="mailAgentCorps" class="mail-textarea" rows="8" />
              <p class="section-label" style="margin-top:4px">EMAIL DU CHAUFFEUR</p>
              <input v-model="emailAgent" class="matricule-input" type="email" placeholder="chauffeur@ratp.fr" />
            </div>
          </template>

          <template v-if="!mailMode && mailPhase === 'agent_no_recidive'">
            <div class="phase-block">
              <div class="no-recidive-banner">
                <span class="recidive-icon">✅</span>
                <div>
                  <strong>Aucune récidive détectée</strong>
                  <p v-if="recidiveResult?.agent_inconnu">
                    Ce matricule n’est pas présent dans la base agents : aucun historique n’a pu être croisé.
                    Traitez le dossier comme sans antécédent disciplinaire dans l’outil.
                  </p>
                  <p v-else-if="recidiveResult?.webhook_indisponible">
                    Le service d’analyse n’a pas répondu ; aucune récidive n’a été retenue par défaut. Vous pouvez poursuivre le traitement interne.
                  </p>
                  <p v-else>
                    Ce chauffeur n'a pas d'antécédent. Aucun courrier disciplinaire n'est nécessaire.
                    Gérez ce signalement en interne selon la procédure habituelle.
                  </p>
                </div>
              </div>
            </div>
          </template>

          <template v-if="!mailMode && mailPhase === 'agent_feliciter'">
            <div class="phase-block">
              <div class="feliciter-banner">
                <span class="recidive-icon">🌟</span>
                <div>
                  <strong>Félicitations à transmettre</strong>
                  <p>Un message de félicitations a été préparé. Renseignez l'email du chauffeur pour le lui envoyer.</p>
                </div>
              </div>
              <p class="section-label" style="margin-top:4px">MAIL DE FÉLICITATIONS</p>
              <p class="mail-hint">Vous pouvez modifier ce message avant envoi.</p>
              <input v-model="mailAgentSujet" class="mail-sujet-input" placeholder="Objet du mail" />
              <textarea v-model="mailAgentCorps" class="mail-textarea" rows="8" />
              <p class="section-label" style="margin-top:4px">EMAIL DU CHAUFFEUR</p>
              <input v-model="emailAgent" class="matricule-input" type="email" placeholder="chauffeur@ratp.fr" />
            </div>
          </template>

          <template v-if="!mailMode && mailPhase === 'traite' && ficheActive.statut !== 'traité'">
            <div class="phase-block">
              <div class="traite-banner">
                <span class="recidive-icon">⏳</span>
                <div>
                  <strong>En attente de clôture</strong>
                  <p>
                    {{ ficheActive.gravite === 'positif'
                      ? "Le message a été transmis à l'agent. Vous pouvez maintenant informer le voyageur."
                      : 'Le chauffeur a été contacté. Une fois le traitement interne terminé, prévenez le voyageur.' }}
                  </p>
                </div>
              </div>
            </div>
          </template>

          <template v-if="!mailMode && mailPhase === 'traite' && ficheActive.statut === 'traité'">
            <div class="phase-block">
              <div class="no-recidive-banner">
                <span class="recidive-icon">✅</span>
                <div>
                  <strong>Signalement clôturé</strong>
                  <p>Le voyageur a été informé. Ce dossier est archivé.</p>
                </div>
              </div>
            </div>
          </template>

          <template v-if="mailPhase === 'verrouille'">
            <div class="phase-block">
              <div class="verrouille-banner">
                <span class="recidive-icon">🔒</span>
                <div>
                  <strong>Pris en charge par un autre manager</strong>
                  <p>
                    Ce signalement est actuellement traité par un autre membre de l'équipe.
                    Vous pouvez consulter les informations mais pas modifier le statut.
                  </p>
                </div>
              </div>

              <p class="section-label" style="margin-top: 16px">DESCRIPTION DU VOYAGEUR</p>
              <p class="description-text">{{ ficheActive.description }}</p>
              <div class="info-grid">
                <div class="info-card"><span class="info-label">LIGNE</span><span class="info-value">Ligne {{
                  ficheActive.ligne_id?.replace('L', '') }}</span></div>
                <div class="info-card"><span class="info-label">DIRECTION</span><span class="info-value">{{
                  ficheActive.direction }}</span></div>
                <div class="info-card"><span class="info-label">DATE & HEURE</span><span class="info-value">{{ new
                  Date(ficheActive.heure_incident).toLocaleString('fr-FR') }}</span></div>
                <div class="info-card"><span class="info-label">GRAVITÉ</span><span class="info-value">{{
                  ficheActive.gravite }}</span></div>
              </div>
            </div>
          </template>

        </div>

        <div class="modal-footer">

          <template v-if="mailPhase === 'rh_only'">
            <button class="btn-secondary" @click="fermerFiche">
              Fermer
            </button>
          </template>

          <template v-if="!mailMode && mailPhase === 'prise_en_compte'">
            <button class="btn-primary" :disabled="actionLoading" @click="prendreEnCharge">
              <span v-if="actionLoading" class="spinner-btn" />
              📨 Prendre en charge
            </button>
            <button class="btn-danger" :disabled="actionLoading" @click="refuser">
              ✕ Rejeter
            </button>
          </template>

          <template v-if="mailPhase === 'verrouille'">
            <button class="btn-secondary" @click="fermerFiche">Fermer</button>
          </template>

          <template v-if="mailMode">
            <button class="btn-primary" :disabled="actionLoading" @click="envoyerMail">
              <span v-if="actionLoading" class="spinner-btn" />
              📨 Envoyer au voyageur
            </button>
            <button class="btn-secondary" :disabled="actionLoading" @click="mailMode = false">
              Fermer sans envoyer
            </button>
          </template>

          <template v-if="!mailMode && mailPhase === 'matricule'">
            <button class="btn-primary" :disabled="matriculeLoading || !matriculeAgent.trim()"
              @click="validerMatricule">
              <span v-if="matriculeLoading" class="spinner-btn" />
              Valider le matricule
            </button>
            <button class="btn-danger" :disabled="actionLoading" @click="refuser">
              ✕ Rejeter
            </button>
          </template>

          <template v-if="!mailMode && mailPhase === 'matricule_positif'">
            <button class="btn-success" :disabled="matriculeLoading || !matriculeAgent.trim()"
              @click="validerMatriculePositif">
              <span v-if="matriculeLoading" class="spinner-btn" />
              Identifier l'agent
            </button>
            <button class="btn-secondary" :disabled="matriculeLoading" @click="ignorerFelicitations">
              Matricule inconnu, passer
            </button>
          </template>

          <template v-if="!mailMode && mailPhase === 'agent_recidive'">
            <button class="btn-danger-fill" :disabled="actionLoading || !emailAgent.trim()" @click="envoyerMailAgent">
              <span v-if="actionLoading" class="spinner-btn" />
              📨 Envoyer au chauffeur
            </button>
          </template>

          <template v-if="!mailMode && mailPhase === 'agent_no_recidive'">
            <button class="btn-primary" :disabled="actionLoading" @click="confirmerPasDeRecidive">
              <span v-if="actionLoading" class="spinner-btn" />
              ✓ Pris en compte, continuer
            </button>
          </template>

          <template v-if="!mailMode && mailPhase === 'agent_feliciter'">
            <button class="btn-success" :disabled="actionLoading || !emailAgent.trim()"
              @click="envoyerMailFelicitations">
              <span v-if="actionLoading" class="spinner-btn" />
              🌟 Envoyer les félicitations
            </button>
            <button class="btn-secondary" :disabled="actionLoading" @click="ignorerFelicitations">
              Passer sans envoyer
            </button>
          </template>

          <template v-if="!mailMode && mailPhase === 'traite' && ficheActive.statut !== 'traité'">
            <button class="btn-primary" :disabled="actionLoading" @click="genererMailCloture">
              <span v-if="actionLoading" class="spinner-btn" />
              📨 Clôturer le signalement
            </button>
          </template>

        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.dash {
  min-height: 100vh;
  height: 100vh;
  overflow: hidden;
  background: #f0f4f8;
  font-family: 'DM Sans', sans-serif;
  color: #1a1a2e;
  display: flex;
  flex-direction: column;
}

.rh-notice {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
  margin-top: 16px;
  background: rgba(226, 75, 74, 0.04);
  border-radius: 12px;
  border: 1px solid rgba(226, 75, 74, 0.2);
}

.rh-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.rh-notice strong {
  font-size: 13px;
  color: #e24b4a;
  display: block;
  margin-bottom: 4px;
}

.rh-notice p {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.header {
  background: #004fa3;
  padding: 0 24px;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  gap: 3px;
}

.brand-vigie {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
}

.brand-ratp {
  font-size: 16px;
  font-weight: 700;
  color: #4bc0ad;
}

.brand-sep {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.2);
}

.role-pill {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.alerte-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px;
  border-radius: 999px;
  background: rgba(226, 75, 74, 0.2);
  border: 1px solid rgba(226, 75, 74, 0.4);
  font-size: 12px;
  color: #fca5a5;
  font-weight: 500;
}

.alerte-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #e24b4a;
  animation: blink 1s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes blink {

  0%,
  100% {
    opacity: 1
  }

  50% {
    opacity: 0.2
  }
}

.alerte-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(226, 75, 74, 0.3);
  cursor: pointer;
}

.header-right {
  flex-shrink: 0;
}

.clock {
  text-align: right;
}

.clock-time {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.clock-date {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: capitalize;
}

.btn-deconnexion {
  flex-shrink: 0;
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.btn-deconnexion:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.5);
}

.btn-deconnexion:focus-visible {
  outline: 2px solid #4bc0ad;
  outline-offset: 2px;
}

.main {
  display: grid;
  grid-template-columns: 395px 1fr 280px;
  gap: 16px;
  padding: 16px;
  flex: 1;
  height: calc(100vh - 56px);
  overflow: hidden;
  min-height: 0;
}

@media (max-width: 1100px) {
  .main {
    grid-template-columns: 240px 1fr 240px;
  }
}

.col-left,
.col-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  overflow: hidden;
}

.col-center {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  min-height: 0;
  height: 100%;
}

.card {
  background: #fff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.card-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  padding: 12px 16px 0;
}

.meteo-card {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.meteo-anim {
  width: 70px;
  height: 70px;
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.meteo-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.meteo-temp {
  font-size: 28px;
  font-weight: 700;
  color: #004fa3;
  line-height: 1;
}

.meteo-temp sup {
  font-size: 14px;
}

.meteo-desc {
  font-size: 12px;
  color: #64748b;
  text-transform: capitalize;
}

.meteo-details {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #94a3b8;
}

.map-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  padding-bottom: 8px;
}

.map-wrap {
  flex: 1;
  min-height: 200px;
  margin: 8px 12px 0;
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

#map {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.zone-panel {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 8px;
  z-index: 500;
  max-height: min(220px, 48%);
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.97);
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(15, 23, 42, 0.12);
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.zone-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.zone-panel-title {
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
}

.zone-panel-close {
  width: 28px;
  height: 28px;
  border: none;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 18px;
  line-height: 1;
  color: #64748b;
  cursor: pointer;
}

.zone-panel-close:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.zone-panel-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.zone-panel-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.12s;
}

.zone-panel-item:hover {
  background: #f8fafc;
}

.zpi-grav {
  width: 6px;
  min-height: 32px;
  border-radius: 3px;
  flex-shrink: 0;
}

.zpi-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.zpi-type {
  font-size: 12px;
  font-weight: 500;
  color: #334155;
}

.zpi-meta {
  font-size: 11px;
  color: #94a3b8;
}

.map-legende {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 16px 4px;
  font-size: 11px;
  color: #64748b;
}

.leg {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tabs-card {
  padding: 14px 16px 12px;
  flex-shrink: 0;
}

.tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

.tab {
  flex: 1;
  padding: 8px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.tab.active {
  background: #004fa3;
  border-color: #004fa3;
  color: #fff;
}

.tab-count {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
  min-width: 20px;
  text-align: center;
  background: rgba(255, 255, 255, 0.2);
}

.tab:not(.active) .tab-count {
  background: #f1f5f9;
  color: #475569;
}

.tab-count.nouveau {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.tab:not(.active) .tab-count.nouveau {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}

.tab-count.en_cours {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.tab:not(.active) .tab-count.en_cours {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.tab-count.traité {
  background: rgba(0, 168, 143, 0.15);
  color: #4bc0ad;
}

.tab:not(.active) .tab-count.traité {
  background: rgba(0, 168, 143, 0.12);
  color: #4bc0ad;
}

.tab-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.f-select {
  flex: 1;
  min-width: 100px;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 12px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  color: #374151;
  outline: none;
  cursor: pointer;
  font-family: inherit;
}

.f-select:focus {
  border-color: #004fa3;
}

.sig-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  padding-bottom: 12px;
}

.sig-empty {
  text-align: center;
  padding: 40px;
  color: #94a3b8;
  font-size: 14px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.sig-card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: stretch;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.15s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
  min-height: 80px;
}

.sig-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
  border-color: #cbd5e0;
}

.sig-grav-bar {
  width: 4px;
  flex-shrink: 0;
}

.sig-body {
  flex: 1;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.sig-arrow {
  padding: 12px 10px;
  color: #94a3b8;
  font-size: 18px;
  display: flex;
  align-items: center;
}

.sig-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.sig-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid;
  flex-shrink: 0;
}

.sig-type {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a2e;
  flex: 1;
  min-width: 0;
}

.rh-tag {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(226, 75, 74, 0.08);
  color: #e24b4a;
  border: 1px solid rgba(226, 75, 74, 0.2);
  flex-shrink: 0;
}

.sig-desc {
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

.sig-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #94a3b8;
  flex-wrap: wrap;
}

.agents-card {
  flex-shrink: 0;
}

.agents-list {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.empty-state {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
}

.agent-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f8fafc;
  border-left: 3px solid #e2e8f0;
}

.agent-row.critique {
  border-left-color: #e24b4a;
  background: rgba(226, 75, 74, 0.04);
}

.agent-row.alerte {
  border-left-color: #f59e0b;
  background: rgba(245, 158, 11, 0.04);
}

.a-rank {
  font-size: 10px;
  color: #94a3b8;
  width: 20px;
  flex-shrink: 0;
}

.a-info {
  flex: 1;
  min-width: 0;
}

.a-id {
  font-size: 12px;
  font-weight: 600;
  color: #1a1a2e;
  display: block;
}

.a-pills {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.ap {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 999px;
  font-weight: 600;
}

.ap-eleve {
  background: rgba(226, 75, 74, 0.12);
  color: #e24b4a;
}

.ap-moyen {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.ap-faible {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}

.a-total {
  font-size: 12px;
  font-weight: 700;
  color: #004fa3;
}

.chart-card {
  flex: 1;
}

.chart-bars {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bar-label {
  font-size: 12px;
  color: #64748b;
  width: 48px;
  flex-shrink: 0;
}

.bar-track {
  flex: 1;
  height: 8px;
  background: #f1f5f9;
  border-radius: 999px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.6s ease;
}

.bar-count {
  font-size: 12px;
  font-weight: 700;
  color: #374151;
  width: 24px;
  text-align: right;
}

.chart-total {
  padding: 8px 16px 14px;
  font-size: 12px;
  color: #64748b;
  border-top: 1px solid #f1f5f9;
}

.anim-soleil {
  position: relative;
  width: 70px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.s-core {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fcd34d;
  box-shadow: 0 0 14px #fcd34d;
  animation: sun-pulse 2s ease-in-out infinite;
  z-index: 2;
}

.s-rays {
  position: absolute;
  inset: 0;
  animation: sun-rotate 8s linear infinite;
}

.s-ray {
  position: absolute;
  width: 2.5px;
  height: 9px;
  background: #fcd34d;
  border-radius: 2px;
  top: 50%;
  left: 50%;
  transform-origin: 0 0;
  transform: rotate(calc(var(--i)*45deg)) translateX(-50%) translateY(-20px);
  opacity: 0.8;
}

@keyframes sun-pulse {

  0%,
  100% {
    box-shadow: 0 0 10px #fcd34d
  }

  50% {
    box-shadow: 0 0 22px #f59e0b
  }
}

@keyframes sun-rotate {
  to {
    transform: rotate(360deg);
  }
}

.anim-nuage {
  position: relative;
  width: 70px;
  height: 70px;
}

.mini-sun {
  position: absolute;
  top: 8px;
  right: 6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fcd34d;
  box-shadow: 0 0 8px #fcd34d;
  animation: sun-pulse 2s ease-in-out infinite;
}

.cloud {
  position: absolute;
  border-radius: 999px;
  background: #94a3b8;
}

.cloud.c1 {
  width: 40px;
  height: 20px;
  bottom: 12px;
  left: 2px;
  animation: cf 3s ease-in-out infinite;
}

.cloud.c2 {
  width: 26px;
  height: 16px;
  bottom: 24px;
  left: 14px;
  animation: cf 3s ease-in-out infinite 0.5s;
}

.anim-couvert {
  position: relative;
  width: 70px;
  height: 70px;
}

.cloud-big {
  position: absolute;
  border-radius: 999px;
  background: #94a3b8;
}

.cloud-big.cb1 {
  width: 48px;
  height: 22px;
  bottom: 10px;
  left: 2px;
  animation: cf 4s ease-in-out infinite;
}

.cloud-big.cb2 {
  width: 34px;
  height: 18px;
  bottom: 24px;
  left: 16px;
  animation: cf 4s ease-in-out infinite 1s;
}

.cloud-big.cb3 {
  width: 26px;
  height: 14px;
  bottom: 34px;
  left: 8px;
  animation: cf 4s ease-in-out infinite 2s;
}

.cloud-dark {
  position: absolute;
  border-radius: 999px;
  background: #64748b;
  width: 50px;
  height: 24px;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  animation: cf 4s ease-in-out infinite;
}

@keyframes cf {

  0%,
  100% {
    transform: translateX(0)
  }

  50% {
    transform: translateX(3px)
  }
}

.anim-pluie,
.anim-orage {
  position: relative;
  width: 70px;
  height: 70px;
  overflow: hidden;
}

.drops {
  position: absolute;
  inset: 0;
  top: 28px;
}

.d {
  position: absolute;
  width: 1.5px;
  border-radius: 2px;
  background: #60a5fa;
  opacity: 0.7;
  left: calc(var(--i)*7px - 2px);
  height: calc(7px + var(--i)*0.5px);
  animation: rain calc(0.55s + var(--i)*0.04s) linear infinite;
  animation-delay: calc(var(--i)*0.07s);
}

.d.fast {
  animation-duration: 0.28s;
}

@keyframes rain {
  0% {
    transform: translateY(-8px);
    opacity: 0
  }

  50% {
    opacity: 0.7
  }

  100% {
    transform: translateY(40px);
    opacity: 0
  }
}

.eclair {
  position: absolute;
  top: 22px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 18px;
  animation: flash-e 2s ease-in-out infinite;
  z-index: 2;
}

@keyframes flash-e {

  0%,
  100% {
    opacity: 0.2
  }

  45%,
  55% {
    opacity: 1
  }
}

.anim-neige {
  position: relative;
  width: 70px;
  height: 70px;
  overflow: hidden;
}

.flocons {
  position: absolute;
  inset: 0;
  top: 24px;
}

.fl {
  position: absolute;
  font-size: 10px;
  color: #93c5fd;
  left: calc(var(--i)*8px - 3px);
  animation: snow calc(1.4s + var(--i)*0.1s) linear infinite;
  animation-delay: calc(var(--i)*0.13s);
}

@keyframes snow {
  0% {
    transform: translateY(-8px) rotate(0deg);
    opacity: 0
  }

  50% {
    opacity: 0.8
  }

  100% {
    transform: translateY(40px) rotate(180deg);
    opacity: 0
  }
}

.anim-brume {
  position: relative;
  width: 70px;
  height: 70px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 6px;
}

.brume-l {
  height: 3px;
  border-radius: 2px;
  background: #94a3b8;
  opacity: 0.5;
  width: calc(30px + var(--i)*10px);
  animation: fog calc(1.8s + var(--i)*0.3s) ease-in-out infinite;
  animation-delay: calc(var(--i)*0.2s);
}

@keyframes fog {

  0%,
  100% {
    opacity: 0.25;
    transform: translateX(0)
  }

  50% {
    opacity: 0.55;
    transform: translateX(3px)
  }
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  /* Leaflet utilise z-index jusqu'à ~1000 (contrôles, popups) ; le modal doit rester au-dessus */
  z-index: 10000;
  backdrop-filter: blur(3px);
}

.modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10001;
  background: #fff;
  border-radius: 16px;
  width: 680px;
  max-width: 95vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 24px 16px;
  border-bottom: 3px solid var(--accent, #3b82f6);
}

.modal-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.modal-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  line-height: 1.3;
}

.badge-gravite {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
  white-space: nowrap;
  flex-shrink: 0;
}

.badge-statut {
  font-size: 12px;
  font-weight: 600;
  background: #fff8e1;
  color: #b45309;
  border: 1px solid #fcd34d;
  padding: 3px 10px;
  border-radius: 20px;
  white-space: nowrap;
}

.btn-close {
  background: #f3f4f6;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  cursor: pointer;
  font-size: 13px;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close:hover {
  background: #e5e7eb;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #6b7280;
  margin: 0 0 8px;
}

.description-text {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 20px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.info-card {
  background: #f9fafb;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #9ca3af;
}

.info-value {
  font-size: 14px;
  font-weight: 500;
  color: #1a1a2e;
}

.mail-hint {
  font-size: 12px;
  color: #9ca3af;
  margin: 0 0 10px;
}

.mail-sujet-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 14px;
  color: #1a1a2e;
  margin-bottom: 10px;
  outline: none;
}

.mail-sujet-input:focus {
  border-color: #3b82f6;
}

.mail-textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 13px;
  color: #1a1a2e;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  font-family: inherit;
}

.mail-textarea:focus {
  border-color: #3b82f6;
}

.phase-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.phase-icon {
  font-size: 36px;
  text-align: center;
}

.phase-title {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a2e;
  text-align: center;
  margin: 0;
}

.phase-desc {
  font-size: 13px;
  color: #6b7280;
  text-align: center;
  line-height: 1.6;
  margin: 0;
}

.matricule-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 15px;
  color: #1a1a2e;
  outline: none;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.matricule-input:focus {
  border-color: #3b82f6;
}

.matricule-error {
  margin-top: 8px;
  font-size: 13px;
  color: #b91c1c;
  line-height: 1.4;
}

.loading-block {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #6b7280;
  font-size: 13px;
  padding: 10px 0;
}

.recidive-banner,
.no-recidive-banner,
.traite-banner,
.feliciter-banner {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  border-radius: 12px;
  padding: 16px;
}

.recidive-banner {
  background: #fef2f2;
}

.no-recidive-banner {
  background: #f0fdf4;
}

.traite-banner {
  background: #eff6ff;
}

.feliciter-banner {
  background: #fefce8;
}

.recidive-banner strong {
  color: #b91c1c;
}

.no-recidive-banner strong {
  color: #15803d;
}

.traite-banner strong {
  color: #1d4ed8;
}

.feliciter-banner strong {
  color: #a16207;
}

.recidive-banner p,
.no-recidive-banner p,
.traite-banner p,
.feliciter-banner p {
  font-size: 13px;
  color: #6b7280;
  margin: 4px 0 0;
  line-height: 1.5;
}

.recidive-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.modal-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 16px 24px;
  border-top: 1px solid #f3f4f6;
  flex-wrap: wrap;
}

.btn-primary {
  background: #1a1a2e;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 12px 22px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary:not(:disabled):hover {
  background: #2d2d4e;
}

.btn-success {
  background: #4bc0ad;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 12px 22px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-success:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-success:not(:disabled):hover {
  background: #008f79;
}

.btn-secondary {
  background: #f3f4f6;
  color: #6b7280;
  border: none;
  border-radius: 10px;
  padding: 12px 22px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-danger {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 12px 22px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-danger:hover {
  background: #fee2e2;
}

.btn-danger-fill {
  background: #e24b4a;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 12px 22px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-danger-fill:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger-fill:not(:disabled):hover {
  background: #c73c3b;
}

.spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.spinner-btn {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.25s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, -46%);
}

.list-enter-active {
  transition: all 0.25s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.list-move {
  transition: transform 0.25s;
}

/* Signalement verrouillé dans la liste */
.sig-card.sig-locked {
  opacity: 0.65;
  cursor: default;
}

.sig-card.sig-locked:hover {
  transform: none;
  box-shadow: none;
}

.locked-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(100, 116, 139, 0.12);
  color: #64748b;
  border: 1px solid rgba(100, 116, 139, 0.2);
}

/* Banner verrou dans la modale */
.verrouille-banner {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
  background: rgba(100, 116, 139, 0.06);
  border-radius: 12px;
  border: 1px solid rgba(100, 116, 139, 0.15);
}

.verrouille-banner strong {
  font-size: 13px;
  color: #475569;
  display: block;
  margin-bottom: 4px;
}

.verrouille-banner p {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .dash {
    height: auto;
    min-height: 100vh;
    overflow: auto;
  }

  .header {
    height: auto;
    padding: 10px 16px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .header-center {
    order: 3;
    width: 100%;
    justify-content: flex-start;
  }

  .main {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
    padding: 12px;
  }

  .col-left,
  .col-right {
    height: auto;
    overflow: visible;
  }

  .col-center {
    height: auto;
    overflow: visible;
  }

  .map-card {
    height: 260px;
  }

  .map-wrap {
    min-height: 200px;
  }

  .sig-list {
    max-height: none;
    overflow: visible;
  }

  .tabs {
    flex-wrap: wrap;
  }

  .tab {
    min-width: 80px;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>