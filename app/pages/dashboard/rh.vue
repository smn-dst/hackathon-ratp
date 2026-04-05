<script setup>
definePageMeta({ middleware: ['auth'] })
const { deconnexion, profile } = useAuth()
import { ref, computed, onMounted } from 'vue'

const { data: signalements, refresh } = await useFetch('/api/signalements-rh')
useSignalementsRealtimeRefresh(refresh)
const { data: courriers } = await useFetch('/api/courriers-rh')
const { data: meteo } = await useFetch('/api/meteo')

const monId = computed(() => profile.value?.id || null)

const ficheActive = ref(null)
const ficheOuverte = ref(false)
const actionLoading = ref(false)
const heure = ref('')
const date = ref('')

const mailPropose = ref('')
const mailSujet = ref('')
const mailMode = ref(false)
const mailEnvoye = ref(false)

//  'prise_en_compte'   → accusé réception voyageur     (statut: nouveau)
//  'matricule'         → saisie matricule chauffeur     (statut: en_cours, matricule_agent null)
//  'agent_recidive'    → récidive → mail chauffeur      (statut: en_cours, recidive = true)
//  'agent_no_recidive' → pas de récidive, info seule   (statut: en_cours, recidive = false)
//  'traite'            → mail clôture voyageur          (statut: en_cours, agent step terminé)
const mailPhase = ref('prise_en_compte')

const matriculeAgent = ref('')
const matriculeLoading = ref(false)
const matriculeCheckError = ref('')
const recidiveResult = ref(null)
const emailAgent = ref('')      // champ email chauffeur (saisi par le RH)
const mailAgentSujet = ref('')      // sujet mail chauffeur (généré par IA)
const mailAgentCorps = ref('')      // corps mail chauffeur (généré par IA, éditable)
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

const sort = arr => [...(arr || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

const nouveaux = computed(() => sort(signalements.value?.filter(s => s.statut === 'nouveau')))
const enCours = computed(() => sort(signalements.value?.filter(s => s.statut === 'en_cours')))
const traites = computed(() => sort(signalements.value?.filter(s => s.statut === 'traité')))
const alertesUrgentes = computed(() => nouveaux.value.filter(s => s.gravite === 'élevé'))
const countEleve = computed(() => signalements.value?.filter(s => s.gravite === 'élevé').length || 0)
const countMoyen = computed(() => signalements.value?.filter(s => s.gravite === 'moyen').length || 0)
const barMax = computed(() => Math.max(countEleve.value, countMoyen.value, 1))

const graviteColor = g => ({ 'élevé': '#e24b4a', 'moyen': '#f59e0b' }[g] || '#888')

function formatDate(iso) { return new Date(iso).toLocaleDateString('fr-FR') }
function formatLigne(s) { return s.ligne_id?.replace('L', '') || s.ligne || '—' }

function genFallback(s) {
  return `Madame, Monsieur ${s.voyageur_prenom || ''} ${s.voyageur_nom || ''},\n\nNous avons bien reçu votre signalement du ${formatDate(s.heure_incident)} concernant un incident sur la ligne ${formatLigne(s)}.\n\nVotre dossier est en cours de traitement prioritaire par notre service RH/Juridique. Nous reviendrons vers vous dans les meilleurs délais.\n\nCordialement,\nService RH/Juridique RATP`
}
function genFallbackCloture(s) {
  return `Madame, Monsieur ${s.voyageur_prenom || ''} ${s.voyageur_nom || ''},\n\nNous avons le plaisir de vous informer que votre signalement du ${formatDate(s.heure_incident)} sur la ligne ${formatLigne(s)} a été entièrement traité.\n\nToutes les mesures nécessaires ont été prises par notre service. Nous vous remercions pour votre vigilance.\n\nCordialement,\nService RH/Juridique RATP`
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

  if (estVerrouille(s)) {
    ficheActive.value = s
    ficheOuverte.value = true
    mailPhase.value = 'verrouille'
    return
  }

  if (s.statut === 'nouveau') {
    // ➜ Jamais encore pris en charge
    mailPhase.value = 'prise_en_compte'

  } else if (s.statut === 'en_cours') {

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

  } else if (s.statut === 'traité') {
    mailPhase.value = 'traite'
  }
}

function fermerFiche() {
  ficheOuverte.value = false
  setTimeout(() => { ficheActive.value = null }, 300)
}

// ÉTAPE 1 — Prendre en charge (statut nouveau)
// ➜ Affiche le draft accusé réception — statut NE CHANGE PAS encore
// ➜ Le PATCH en_cours se fera dans envoyerMail() après envoi confirmé
async function prendreEnCharge() {
  if (!ficheActive.value) return
  actionLoading.value = true
  try {
    mailPhase.value = 'prise_en_compte'
    mailSujet.value = ficheActive.value.mail_voyageur_sujet
      || `Votre signalement du ${formatDate(ficheActive.value.heure_incident)} — Ligne ${formatLigne(ficheActive.value)}`
    mailPropose.value = ficheActive.value.mail_voyageur_draft || genFallback(ficheActive.value)
    mailMode.value = true
  } finally {
    actionLoading.value = false
  }
}

// ÉTAPE 2 — Valider le matricule
// ➜ PATCH matricule_agent en BDD
// ➜ Appel /api/signalement/:id/check-recidive → déclenche n8n
// ➜ n8n retourne : { recidive, mail_agent_sujet?, mail_agent_corps? }
// ➜ n8n PATCH aussi recidive + mail_agent_sujet + mail_agent_corps en BDD
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

    await refresh()
  } catch (e) {
    const ex = e && typeof e === 'object' ? e : {}
    const data = 'data' in ex ? ex.data : undefined
    const fromData = data && typeof data === 'object' && 'message' in data ? String(data.message) : ''
    matriculeCheckError.value = fromData || (e instanceof Error ? e.message : '') || 'Impossible de vérifier la récidive.'
  } finally {
    matriculeLoading.value = false
  }
}

// ÉTAPE 3 — Envoyer mail au chauffeur (cas récidive uniquement)
// ➜ Envoie le mail via Brevo
// ➜ PATCH email_agent + agent_traite = true en BDD
// ➜ Statut RESTE en_cours — RATP gère en interne
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
        dashboard: 'rh-agent'
      }
    })

    // Persister email_agent + marquer l'étape agent comme terminée
    await $fetch(`/api/signalement/${ficheActive.value.id}/statut`, {
      method: 'PATCH',
      body: {
        email_agent: emailAgent.value.trim(),
        agent_traite: true
        // statut INCHANGÉ → reste en_cours
      }
    })

    mailAgentEnvoye.value = true
    // Phase traite = prêt pour clôturer plus tard
    mailPhase.value = 'traite'
    await refresh()
  } finally {
    actionLoading.value = false
  }
}

// ÉTAPE 3 (cas pas de récidive) — Confirmer lecture
// ➜ Pas de mail à envoyer, PATCH agent_traite = true
// ➜ Phase → traite (bouton clôturer disponible)
async function confirmerPasDeRecidive() {
  if (!ficheActive.value) return
  actionLoading.value = true
  try {
    await $fetch(`/api/signalement/${ficheActive.value.id}/statut`, {
      method: 'PATCH',
      body: { agent_traite: true }
    })
    mailPhase.value = 'traite'
    await refresh()
  } finally {
    actionLoading.value = false
  }
}

// ÉTAPE 4 — Clôturer le signalement (quand RATP a fini en interne)
// ➜ Affiche le draft clôture voyageur — statut NE CHANGE PAS encore
// ➜ Le PATCH traité se fera dans envoyerMail() après envoi confirmé
async function genererMailCloture() {
  if (!ficheActive.value) return
  mailSujet.value = ficheActive.value.mail_voyageur_sujet_cloture
    || `Clôture de votre signalement du ${formatDate(ficheActive.value.heure_incident)} — Ligne ${formatLigne(ficheActive.value)}`
  mailPropose.value = ficheActive.value.mail_voyageur_draft_cloture || genFallbackCloture(ficheActive.value)
  mailMode.value = true
  // mailPhase reste 'traite' → envoyerMail() sait qu'il faut patcher traité
}

// Rejeter
async function refuser() {
  if (!ficheActive.value) return
  actionLoading.value = true
  try {
    await $fetch(`/api/signalement/${ficheActive.value.id}/statut`, {
      method: 'PATCH', body: { statut: 'refusé', pris_en_charge_par: null }
    })
    fermerFiche()
    await refresh()
  } finally {
    actionLoading.value = false
  }
}

// ENVOYER MAIL VOYAGEUR — Brevo d'abord, PUIS PATCH statut
//  mailPhase 'prise_en_compte' → statut en_cours → enchaîne sur 'matricule'
//  mailPhase 'traite'          → statut traité   → clôture définitive
async function envoyerMail() {
  if (!ficheActive.value) return
  actionLoading.value = true
  try {
    // 1️⃣ Envoyer le mail au voyageur via Brevo
    await $fetch(`/api/signalement/${ficheActive.value.id}/envoyer-mail`, {
      method: 'POST',
      body: {
        sujet: mailSujet.value,
        corps: mailPropose.value,
        email_destinataire: ficheActive.value.voyageur_email,
        dashboard: 'rh'
      }
    })

    // 2️⃣ PATCH statut selon la phase en cours
    if (mailPhase.value === 'traite') {
      // Dernier mail → on clôture définitivement
      await $fetch(`/api/signalement/${ficheActive.value.id}/statut`, {
        method: 'PATCH', body: { statut: 'traité' }
      })
      mailEnvoye.value = true
      mailMode.value = false
      await refresh()
      const id = ficheActive.value.id
      const next = signalements.value?.find(s => s.id === id)
      if (next) ficheActive.value = next

    } else {
      // Premier mail (prise_en_compte) → statut en_cours + enchaîner sur saisie matricule
      await $fetch(`/api/signalement/${ficheActive.value.id}/statut`, {
        method: 'PATCH', body: { statut: 'en_cours', pris_en_charge_par: monId.value }
      })
      mailEnvoye.value = true
      mailMode.value = false
      await refresh()
      const id = ficheActive.value.id
      const next = signalements.value?.find(s => s.id === id)
      if (next) ficheActive.value = next
      // La modale reste ouverte, on passe à la phase matricule
      mailPhase.value = 'matricule'
    }
  } finally {
    actionLoading.value = false
  }
}

const courriersByStatut = (statut) => (courriers.value || []).filter(c => c.statut === statut)
</script>
<template>
  <div class="dash">

    <!-- HEADER -->
    <header class="header">
      <div class="hbrand">
        <div class="logo-c">
          <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="white" stroke-width="2" />
            <path d="M8 14 Q14 6 20 14 Q14 22 8 14Z" fill="white" opacity="0.9" />
          </svg>
        </div>
        <span class="btext"><span class="bs">Signal</span><span class="br">RATP</span></span>
        <div class="bsep" />
        <span class="role-pill">⚖️ RH / Juridique</span>
      </div>

      <!-- Météo compacte -->
      <div class="hmeteo" v-if="meteo">
        <div class="hm-icon">
          <span v-if="condition === 'soleil'">☀️</span>
          <span v-else-if="condition === 'pluie' || condition === 'orage'">🌧️</span>
          <span v-else-if="condition === 'neige'">❄️</span>
          <span v-else-if="condition === 'brume'">🌫️</span>
          <span v-else>☁️</span>
        </div>
        <div class="hm-data">
          <span class="hm-temp">{{ meteo.temp }}°C</span>
          <span class="hm-desc">{{ meteo.description }}</span>
          <span class="hm-det">💧{{ meteo.humidity }}% · 💨{{ meteo.wind }}km/h</span>
        </div>
      </div>

      <!-- Alertes -->
      <div class="hcenter">
        <Transition name="fade">
          <div v-if="alertesUrgentes.length > 0" class="alerte-banner">
            <span class="ap" />
            <span>{{ alertesUrgentes.length }} cas élevé{{ alertesUrgentes.length > 1 ? 's' : '' }} en attente</span>
            <span v-for="a in alertesUrgentes.slice(0, 2)" :key="a.id" class="atag" @click="ouvrirFiche(a)">{{
              a.type_incident?.substring(0, 16) }}…</span>
          </div>
        </Transition>
      </div>

      <div class="hright">
        <div class="clock">
          <span class="ckt">{{ heure }}</span>
          <span class="ckd">{{ date }}</span>
        </div>
      </div>
      <button class="btn-deconnexion" @click="deconnexion">Déconnexion</button>
    </header>

    <!-- STATS ROW -->
    <div class="stats-row">
      <div class="sc sc-eleve"><span class="sn">{{ countEleve }}</span><span class="sl">Cas élevés</span></div>
      <div class="sc sc-moyen"><span class="sn">{{ countMoyen }}</span><span class="sl">Cas moyens</span></div>
      <div class="sc sc-nouv"><span class="sn">{{ nouveaux.length }}</span><span class="sl">Nouveaux</span></div>
      <div class="sc sc-enc"><span class="sn">{{ enCours.length }}</span><span class="sl">En cours</span></div>
      <div class="sc sc-done"><span class="sn">{{ traites.length }}</span><span class="sl">Traités</span></div>
      <div class="sc sc-courr"><span class="sn">{{ courriers?.length || 0 }}</span><span class="sl">Courriers
          générés</span></div>
      <!-- Mini chart -->
      <div class="sc sc-chart">
        <div class="chart-mini">
          <div v-for="bar in [{ c: countEleve, col: '#e24b4a' }, { c: countMoyen, col: '#f59e0b' }]" :key="bar.col"
            class="brow">
            <div class="btrack">
              <div class="bfill" :style="`width:${(bar.c / barMax) * 100}%;background:${bar.col}`" />
            </div>
            <span class="bcount">{{ bar.c }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 3 COLONNES -->
    <div class="kanban">

      <!-- NOUVEAUX -->
      <div class="kcol">
        <div class="ch ch-n">
          <span class="cht">Nouveaux</span>
          <span class="chc">{{ nouveaux.length }}</span>
        </div>
        <div class="kcards">
          <p v-if="!nouveaux.length" class="empty-col">Aucun nouveau signalement</p>
          <div v-for="s in nouveaux" :key="s.id" class="scard" @click="ouvrirFiche(s)">
            <div class="gbar" :style="`background:${graviteColor(s.gravite)}`" />
            <div class="sbody">
              <div class="shead">
                <span class="gbadge"
                  :style="`background:${graviteColor(s.gravite)}18;color:${graviteColor(s.gravite)};border-color:${graviteColor(s.gravite)}40`">{{
                    s.gravite?.toUpperCase() }}</span>
                <span class="stype">{{ s.type_incident }}</span>
                <span v-if="estVerrouille(s)" class="locked-tag">🔒 En cours</span>
              </div>
              <p class="sdesc">{{ s.description?.substring(0, 75) }}{{ s.description?.length > 75 ? '…' : '' }}</p>
              <div class="smeta">
                <span>{{ s.ligne_id ? `L${s.ligne_id.replace('L', '')}` : '—' }}</span>
                <span>{{ s.direction || '—' }}</span>
                <span>{{ new
                  Date(s.heure_incident).toLocaleString('fr-FR', {
                    day: '2-digit', month: '2-digit', hour:
                      '2-digit', minute: '2-digit'
                  })
                }}</span>
              </div>
            </div>
            <span class="sarrow">›</span>
          </div>
        </div>
      </div>

      <!-- EN COURS -->
      <div class="kcol">
        <div class="ch ch-e">
          <span class="cht">En cours</span>
          <span class="chc">{{ enCours.length }}</span>
        </div>
        <div class="kcards">
          <p v-if="!enCours.length" class="empty-col">Aucun signalement en cours</p>
          <div v-for="s in enCours" :key="s.id" class="scard" @click="ouvrirFiche(s)">
            <div class="gbar" :style="`background:${graviteColor(s.gravite)}`" />
            <div class="sbody">
              <div class="shead">
                <span class="gbadge"
                  :style="`background:${graviteColor(s.gravite)}18;color:${graviteColor(s.gravite)};border-color:${graviteColor(s.gravite)}40`">{{
                    s.gravite?.toUpperCase() }}</span>
                <span class="stype">{{ s.type_incident }}</span>
                <span class="chip-mail">✉ Mail {{ s.mail_voyageur_draft ? 'IA' : 'fallback' }}</span>
              </div>
              <p class="sdesc">{{ s.description?.substring(0, 75) }}{{ s.description?.length > 75 ? '…' : '' }}</p>
              <div class="smeta">
                <span>{{ s.ligne_id ? `L${s.ligne_id.replace('L', '')}` : '—' }}</span>
                <span>{{ s.direction || '—' }}</span>
                <span>{{ new
                  Date(s.heure_incident).toLocaleString('fr-FR', {
                    day: '2-digit', month: '2-digit', hour:
                      '2-digit', minute: '2-digit'
                  })
                }}</span>
              </div>
            </div>
            <span class="sarrow">›</span>
          </div>
        </div>
      </div>

      <!-- TRAITÉS -->
      <div class="kcol">
        <div class="ch ch-t">
          <span class="cht">Traités</span>
          <span class="chc">{{ traites.length }}</span>
        </div>
        <div class="kcards">
          <p v-if="!traites.length" class="empty-col">Aucun signalement traité</p>
          <div v-for="s in traites" :key="s.id" class="scard done" @click="ouvrirFiche(s)">
            <div class="gbar" :style="`background:${graviteColor(s.gravite)}`" />
            <div class="sbody">
              <div class="shead">
                <span class="gbadge"
                  :style="`background:${graviteColor(s.gravite)}18;color:${graviteColor(s.gravite)};border-color:${graviteColor(s.gravite)}40`">{{
                    s.gravite?.toUpperCase() }}</span>
                <span class="stype">{{ s.type_incident }}</span>
                <span class="chip-done">✓ Traité</span>
              </div>
              <p class="sdesc">{{ s.description?.substring(0, 75) }}{{ s.description?.length > 75 ? '…' : '' }}</p>
              <div class="smeta">
                <span>{{ s.ligne_id ? `L${s.ligne_id.replace('L', '')}` : '—' }}</span>
                <span>{{ new
                  Date(s.heure_incident).toLocaleString('fr-FR', {
                    day: '2-digit', month: '2-digit', hour:
                      '2-digit', minute: '2-digit'
                  })
                }}</span>
              </div>
            </div>
            <span class="sarrow">›</span>
          </div>
        </div>
      </div>

    </div>

    <!-- MODAL FICHE -->
    <!-- Overlay -->
    <Transition name="fade">
      <div v-if="ficheOuverte" class="modal-overlay" @click.self="fermerFiche" />
    </Transition>

    <!-- Modale -->
    <Transition name="slide-up">
      <div v-if="ficheOuverte && ficheActive" class="modal">

        <!-- ── HEADER ─────────────────────────────────────────────────────────── -->
        <div class="modal-header" :style="`--accent: ${graviteColor(ficheActive.gravite)}`">
          <div class="modal-header-left">
            <span class="badge-gravite"
              :style="`background: ${graviteColor(ficheActive.gravite)}20; color: ${graviteColor(ficheActive.gravite)}`">
              {{ ficheActive.gravite?.toUpperCase() }}
            </span>
            <span class="modal-title">{{ ficheActive.type_incident }}</span>
          </div>
          <div class="modal-header-right">
            <span class="badge-statut">{{ ficheActive.statut }}</span>
            <button class="btn-close" @click="fermerFiche">✕</button>
          </div>
        </div>

        <!-- ── BODY ───────────────────────────────────────────────────────────── -->
        <div class="modal-body">

          <!-- ─ PHASE : prise_en_compte ──────────────────────────────────────── -->
          <!-- Affichage de la fiche signalement + bouton prendre en charge -->
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
                ficheActive.agent_assigne || 'Non assigné' }}</span></div>
              <div class="info-card"><span class="info-label">SOURCE</span><span class="info-value">{{
                ficheActive.source }}</span></div>
            </div>
          </template>

          <!-- ─ PHASE : verrouille ─────────────────────────────────────────────────── -->
          <template v-if="mailPhase === 'verrouille'">
            <div class="phase-block">
              <div class="verrouille-banner">
                <span class="recidive-icon">🔒</span>
                <div>
                  <strong>Pris en charge par un autre rh/juridique</strong>
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

          <!-- ─ PHASE : mail voyageur (prise_en_compte ou clôture) ───────────── -->
          <!-- S'affiche quand mailMode = true, quelque soit la phase -->
          <template v-if="mailMode">
            <p class="section-label">
              {{ mailPhase === 'traite' ? 'MAIL DE CLÔTURE AU VOYAGEUR' : 'MAIL DE PRISE EN COMPTE AU VOYAGEUR' }}
            </p>
            <p class="mail-hint">Vous pouvez modifier ce message avant envoi.</p>
            <input v-model="mailSujet" class="mail-sujet-input" placeholder="Objet du mail" />
            <textarea v-model="mailPropose" class="mail-textarea" rows="10" />
          </template>

          <!-- ─ PHASE : matricule ─────────────────────────────────────────────── -->
          <template v-if="!mailMode && mailPhase === 'matricule'">
            <div class="phase-block">
              <div class="phase-icon">🪪</div>
              <h3 class="phase-title">Renseigner le matricule du chauffeur</h3>
              <p class="phase-desc">
                La RATP a croisé ses données en interne. Renseignez le matricule du chauffeur
                pour déclencher la vérification des règles de récidive.
              </p>
              <input v-model="matriculeAgent" class="matricule-input" placeholder="Ex : EMP-4872"
                :disabled="matriculeLoading" @keyup.enter="validerMatricule" />
              <p v-if="matriculeCheckError" class="matricule-error">{{ matriculeCheckError }}</p>
              <div v-if="matriculeLoading" class="loading-block">
                <span class="spinner" />
                <span>Vérification des récidives en cours…</span>
              </div>
            </div>
          </template>

          <!-- ─ PHASE : agent_recidive ────────────────────────────────────────── -->
          <template v-if="!mailMode && mailPhase === 'agent_recidive'">
            <div class="phase-block">
              <div class="recidive-banner">
                <span class="recidive-icon">⚠️</span>
                <div>
                  <strong>Récidive détectée</strong>
                  <p>Ce chauffeur a déjà fait l'objet de signalements. Un courrier a été préparé par l'IA.</p>
                </div>
              </div>

              <p class="section-label" style="margin-top: 20px">MAIL À ENVOYER AU CHAUFFEUR</p>
              <p class="mail-hint">Vous pouvez modifier ce message avant envoi.</p>
              <input v-model="mailAgentSujet" class="mail-sujet-input" placeholder="Objet du mail" />
              <textarea v-model="mailAgentCorps" class="mail-textarea" rows="8" />

              <p class="section-label" style="margin-top: 16px">EMAIL DU CHAUFFEUR</p>
              <input v-model="emailAgent" class="matricule-input" type="email" placeholder="chauffeur@ratp.fr" />
            </div>
          </template>

          <!-- ─ PHASE : agent_no_recidive ─────────────────────────────────────── -->
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
                    Ce chauffeur n'a pas d'antécédent de signalement. Aucun courrier disciplinaire n'est nécessaire.
                    Gérez ce signalement en interne selon la procédure habituelle.
                  </p>
                </div>
              </div>
            </div>
          </template>

          <!-- ─ PHASE : traite (en attente de clôture) ─────────────────────────── -->
          <template v-if="!mailMode && mailPhase === 'traite' && ficheActive.statut !== 'traité'">
            <div class="phase-block">
              <div class="traite-banner">
                <span class="recidive-icon">⏳</span>
                <div>
                  <strong>En attente de clôture</strong>
                  <p>
                    Le chauffeur a été contacté. Une fois que la RATP a terminé le traitement interne,
                    prévenez le voyageur que son signalement a été traité.
                  </p>
                </div>
              </div>
            </div>
          </template>

          <!-- ─ PHASE : traite (signalement déjà traité) ───────────────────────── -->
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

        </div><!-- /modal-body -->

        <!-- ── FOOTER ─────────────────────────────────────────────────────────── -->
        <div class="modal-footer">

          <!-- Prise en charge -->
          <template v-if="!mailMode && mailPhase === 'prise_en_compte'">
            <button class="btn-primary" :disabled="actionLoading" @click="prendreEnCharge">
              <span v-if="actionLoading" class="spinner-btn" />
              📨 Prendre en charge
            </button>
            <button class="btn-danger" :disabled="actionLoading" @click="refuser">
              ✕ Rejeter
            </button>
          </template>

          <!-- Verrouillé → bouton fermer uniquement -->
          <template v-if="mailPhase === 'verrouille'">
            <button class="btn-secondary" @click="fermerFiche">Fermer</button>
          </template>

          <!-- Mail voyageur -->
          <template v-if="mailMode">
            <button class="btn-primary" :disabled="actionLoading" @click="envoyerMail">
              <span v-if="actionLoading" class="spinner-btn" />
              📨 Envoyer au voyageur
            </button>
            <button class="btn-secondary" :disabled="actionLoading" @click="mailMode = false">
              Fermer sans envoyer
            </button>
          </template>

          <!-- Matricule -->
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

          <!-- Récidive → envoyer mail agent -->
          <template v-if="!mailMode && mailPhase === 'agent_recidive'">
            <button class="btn-primary" :disabled="actionLoading || !emailAgent.trim()" @click="envoyerMailAgent">
              <span v-if="actionLoading" class="spinner-btn" />
              📨 Envoyer au chauffeur
            </button>
          </template>

          <!-- Pas de récidive → confirmer -->
          <template v-if="!mailMode && mailPhase === 'agent_no_recidive'">
            <button class="btn-primary" :disabled="actionLoading" @click="confirmerPasDeRecidive">
              <span v-if="actionLoading" class="spinner-btn" />
              ✓ Pris en compte, continuer
            </button>
          </template>

          <!-- Prêt pour clôture -->
          <template v-if="!mailMode && mailPhase === 'traite' && ficheActive.statut !== 'traité'">
            <button class="btn-primary" :disabled="actionLoading" @click="genererMailCloture">
              <span v-if="actionLoading" class="spinner-btn" />
              📨 Clôturer le signalement
            </button>
          </template>

        </div><!-- /modal-footer -->
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
  height: 100vh;
  overflow: hidden;
  background: #f0f4f8;
  font-family: 'DM Sans', sans-serif;
  color: #1a1a2e;
  display: flex;
  flex-direction: column;
}

.header {
  background: #1b3f8b;
  padding: 0 20px;
  height: 64px;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.hbrand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.logo-c {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #00a88f;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btext {
  display: flex;
  gap: 2px;
}

.bs {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
}

.br {
  font-size: 15px;
  font-weight: 700;
  color: #00a88f;
}

.bsep {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.2);
}

.role-pill {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(226, 75, 74, 0.2);
  color: #fca5a5;
  border: 1px solid rgba(226, 75, 74, 0.4);
  white-space: nowrap;
}

/* MÉTÉO HEADER */
.hmeteo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  flex-shrink: 0;
}

.hm-icon {
  font-size: 20px;
  line-height: 1;
}

.hm-data {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.hm-temp {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.hm-desc {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  text-transform: capitalize;
}

.hm-det {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.45);
}

/* ALERTES */
.hcenter {
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
}

.ap {
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

.atag {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(226, 75, 74, 0.3);
  cursor: pointer;
}

.hright {
  flex-shrink: 0;
}

.clock {
  text-align: right;
}

.ckt {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.ckd {
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
  outline: 2px solid #00a88f;
  outline-offset: 2px;
}

.stats-row {
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  flex-shrink: 0;
  align-items: stretch;
}

.sc {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.sn {
  font-size: 20px;
  font-weight: 700;
}

.sl {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
}

.sc-eleve {
  border-top: 3px solid #e24b4a;
  flex: 0.8;
}

.sc-eleve .sn {
  color: #e24b4a;
}

.sc-moyen {
  border-top: 3px solid #f59e0b;
  flex: 0.8;
}

.sc-moyen .sn {
  color: #f59e0b;
}

.sc-nouv {
  border-top: 3px solid #3b82f6;
  flex: 0.8;
}

.sc-nouv .sn {
  color: #3b82f6;
}

.sc-enc {
  border-top: 3px solid #d97706;
  flex: 0.8;
}

.sc-enc .sn {
  color: #d97706;
}

.sc-done {
  border-top: 3px solid #00a88f;
  flex: 0.8;
}

.sc-done .sn {
  color: #00a88f;
}

.sc-courr {
  border-top: 3px solid #1b3f8b;
  flex: 0.8;
}

.sc-courr .sn {
  color: #1b3f8b;
}

.sc-chart {
  flex: 1.5;
  border-top: 3px solid #e2e8f0;
  justify-content: center;
}

.chart-mini {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.brow {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btrack {
  flex: 1;
  height: 8px;
  background: #f1f5f9;
  border-radius: 999px;
  overflow: hidden;
}

.bfill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.6s ease;
}

.bcount {
  font-size: 11px;
  font-weight: 700;
  color: #374151;
  width: 20px;
  text-align: right;
}

.kanban {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  padding: 0 14px 14px;
  overflow: hidden;
  min-height: 0;
}

.kcol {
  background: #e8edf5;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ch {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.cht {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.chc {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  color: #374151;
}

.ch-n {
  background: rgba(59, 130, 246, 0.06);
}

.ch-n .cht {
  color: #3b82f6;
}

.ch-e {
  background: rgba(245, 158, 11, 0.06);
}

.ch-e .cht {
  color: #d97706;
}

.ch-t {
  background: rgba(0, 168, 143, 0.06);
}

.ch-t .cht {
  color: #00a88f;
}

.kcards {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.empty-col {
  text-align: center;
  padding: 30px 12px;
  font-size: 12px;
  color: #94a3b8;
}

.scard {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  display: flex;
  cursor: pointer;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.15s;
  flex-shrink: 0;
}

.scard:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.09);
  transform: translateY(-1px);
  border-color: #cbd5e0;
}

.scard.done {
  opacity: 0.7;
}

.gbar {
  width: 3px;
  flex-shrink: 0;
}

.sbody {
  flex: 1;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.sarrow {
  padding: 10px 8px;
  color: #94a3b8;
  font-size: 16px;
  display: flex;
  align-items: center;
}

.shead {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.gbadge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid;
  flex-shrink: 0;
}

.stype {
  font-size: 12px;
  font-weight: 600;
  color: #1a1a2e;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-mail {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(0, 168, 143, 0.1);
  color: #00a88f;
  flex-shrink: 0;
  white-space: nowrap;
}

.chip-done {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(0, 168, 143, 0.1);
  color: #00a88f;
  flex-shrink: 0;
}

.sdesc {
  font-size: 11px;
  color: #64748b;
  line-height: 1.4;
}

.smeta {
  display: flex;
  gap: 8px;
  font-size: 10px;
  color: #94a3b8;
  flex-wrap: wrap;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 100;
  backdrop-filter: blur(3px);
}

.modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 101;
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
  border-bottom: 3px solid var(--accent, #e24b4a);
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
.traite-banner {
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

.recidive-banner strong {
  color: #b91c1c;
}

.no-recidive-banner strong {
  color: #15803d;
}

.traite-banner strong {
  color: #1d4ed8;
}

.recidive-banner p,
.no-recidive-banner p,
.traite-banner p {
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

@media (max-width: 900px) {
  .dash {
    height: auto;
    overflow: auto;
  }

  .header {
    height: auto;
    padding: 10px 14px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .hmeteo {
    order: 4;
    width: 100%;
  }

  .stats-row {
    flex-wrap: wrap;
    padding: 8px;
  }

  .sc {
    min-width: calc(33% - 6px);
  }

  .kanban {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
  }

  .kcol {
    max-height: 60vh;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>