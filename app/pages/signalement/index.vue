<script setup lang="ts">
const route = useRoute()

const type = route.query.type || 'ligne'
const typeForApi = type === 'ligne' ? 'bus' : type
const ligne = route.query.ligne || ''
const arret = route.query.arret || ''

type Ligne = { id: string; numero: string | number; directions: string[] }
type TypeIncident = { valeur: string; categorie: string }
type SourceSignalement = { valeur: string }

const { data: lignes } = await useFetch<Ligne[]>('/api/lignes')
const { data: typesIncidents } = await useFetch<TypeIncident[]>('/api/types-incidents')
const { data: sourcesSignalement } = await useFetch<SourceSignalement[]>('/api/sources-signalement')

const form = ref({
  type: typeForApi,
  ligne_id: ligne ? `L${ligne}` : '',
  arret_id: arret ? `ARR-${arret}` : '',
  lat: null as number | null,
  lng: null as number | null,
  direction: '',
  type_incident: '',
  description: '',
  voyageur_nom: '',
  voyageur_prenom: '',
  voyageur_email: '',
  voyageur_telephone: '',
  heure_incident: new Date().toISOString(),
  source: 'qr',
})

const directionsDisponibles = computed(() => {
  const ligneId = form.value.ligne_id
  if (!ligneId || !lignes.value) return []
  const l = lignes.value.find(l => l.id === ligneId)
  return l?.directions || []
})

watch(() => form.value.ligne_id, () => {
  form.value.direction = ''
})

const loading = ref(false)
const confirme = ref(false)

async function soumettre() {
  loading.value = true
  try {
    if (!navigator.geolocation) {
      alert("Votre navigateur ne supporte pas la géolocalisation. Impossible d'envoyer le signalement.")
      loading.value = false
      return
    }

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
    }).catch(() => null)

    if (!position) {
      alert("La géolocalisation est nécessaire pour localiser l'incident. Veuillez autoriser l'accès à votre position.")
      loading.value = false
      return
    }

    form.value.lat = position.coords.latitude
    form.value.lng = position.coords.longitude

    await $fetch('/api/signalement', { method: 'POST', body: form.value })
    confirme.value = true
  } catch {
    alert("Erreur lors de l'envoi. Veuillez réessayer.")
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">

    <header class="header">
      <div class="header-inner">
        <div class="header-logo">
          <img src="/branding/ratp-mark.png" alt="RATP" class="header-ratp-mark" width="100" height="28" />
          <span class="logo-product"><span class="logo-vigie">Vigie</span><span class="logo-ratp-name">RATP</span></span>
        </div>
        <span class="header-title">Signalement voyageur</span>
      </div>
    </header>

    <div class="hero-band">
      <div class="hero-inner">
        <img src="/branding/ratp-logo-vertical.png" alt="RATP" class="hero-ratp-lockup" />
        <h1>Déposer un signalement</h1>
        <p>Votre retour nous aide à améliorer le service — Paris Est Centre Bus</p>
      </div>
    </div>

    <div class="container">

      <!-- Badge pré-remplissage -->
      <div class="prefill-row">
        <div v-if="ligne" class="prefill-chip">
          <span class="chip-dot" />
          Ligne {{ ligne }} détectée automatiquement
        </div>
        <div v-if="arret" class="prefill-chip">
          <span class="chip-dot" />
          Arrêt {{ arret }} détecté automatiquement
        </div>
      </div>

      <div v-if="!confirme">
        <form @submit.prevent="soumettre">

          <!-- Section transport -->
          <div class="form-section">
            <div class="section-label">
              <span class="section-num">1</span>
              Informations sur le trajet
            </div>

            <div class="field-group">
              <div class="field">
                <label>Ligne de bus <span class="required">*</span></label>
                <select v-model="form.ligne_id" required>
                  <option value="">Sélectionner une ligne</option>
                  <option v-for="l in lignes" :key="l.id" :value="l.id">
                    Ligne {{ l.numero }}
                  </option>
                </select>
              </div>

              <div class="field" v-if="form.ligne_id && directionsDisponibles.length > 0">
                <label>Direction <span class="required">*</span> <span class="hint">vers où allait le bus
                    ?</span></label>
                <select v-model="form.direction" required>
                  <option value="">Sélectionner une direction</option>
                  <option v-for="d in directionsDisponibles" :key="d" :value="d">{{ d }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Section incident -->
          <div class="form-section">
            <div class="section-label">
              <span class="section-num">2</span>
              Nature du signalement
            </div>

            <div class="field-group">
              <div class="field">
                <label>Objet du signalement <span class="required">*</span></label>
                <select v-model="form.type_incident" required>
                  <option value="">Sélectionner un objet</option>
                  <template v-if="typesIncidents && typesIncidents.length > 0">
                    <option v-for="t in typesIncidents" :key="t.valeur" :value="t.valeur">{{ t.valeur }}</option>
                  </template>
                  <template v-else>
                    <optgroup label="Comportement">
                      <option
                        value="Comportement (insubordination, clients, collègue, automobiliste, vélo, trotinette …)">
                        Comportement (insubordination, clients…)</option>
                      <option value="Laïcité">Laïcité</option>
                      <option value="Tenue non conforme">Tenue non conforme</option>
                    </optgroup>
                    <optgroup label="Réglementation">
                      <option value="Règlementation métier (IPMR, Métier …)">Réglementation métier (IPMR…)</option>
                      <option value="Règlementation UO / Entreprise : IG505C">Réglementation UO : IG505C</option>
                      <option value="Règlementation UO / Entreprise : Autre">Réglementation UO : Autre</option>
                    </optgroup>
                    <optgroup label="Service & conduite">
                      <option value="Non respect des consignes de régulation (Départ, déviation, retard sur ligne)">Non
                        respect des consignes de régulation</option>
                      <option value="Retard prise de service">Retard prise de service</option>
                      <option value="Abandon de poste">Abandon de poste</option>
                      <option value="Accidentologie">Accidentologie</option>
                      <option value="Excès de vitesse">Excès de vitesse</option>
                      <option value="Franchissement feu tricolore ou stop">Franchissement feu tricolore</option>
                      <option value="Téléphone portable et objet connectés en situation de conduite">Téléphone en
                        conduite</option>
                    </optgroup>
                    <optgroup label="Absence & administratif">
                      <option value="Absence irrégulière">Absence irrégulière</option>
                      <option
                        value="Permis/CQC : défaut, impossibilité de le présenter, pas à jour, pulse pas à jour, …etc">
                        Permis / CQC : défaut</option>
                      <option value="Fausse déclaration (chauffage défaillant, clim défaillante, ..etc)">Fausse
                        déclaration</option>
                      <option value="Fraude sociale : arret frauduleux">Fraude sociale</option>
                    </optgroup>
                    <optgroup label="Grave">
                      <option value="Alcoolémie">Alcoolémie</option>
                      <option value="Stupéfiant">Stupéfiant</option>
                      <option value="Vol">Vol</option>
                    </optgroup>
                    <optgroup label="Positif">
                      <option value="Rapport de bon service">Rapport de bon service</option>
                      <option value="Acte de bravoure">Acte de bravoure</option>
                    </optgroup>
                  </template>
                </select>
              </div>

              <div class="field">
                <label>Description <span class="required">*</span></label>
                <textarea v-model="form.description" placeholder="Décrivez précisément les faits observés..." rows="4"
                  required />
              </div>

              <div class="field">
                <label>Source du signalement <span class="required">*</span></label>
                <select v-model="form.source" required>
                  <option value="qr">QR Code (voyageur)</option>
                  <template v-if="sourcesSignalement && sourcesSignalement.length > 0">
                    <option v-for="s in sourcesSignalement" :key="s.valeur" :value="s.valeur">{{ s.valeur }}</option>
                  </template>
                  <template v-else>
                    <option value="Rapport ETR">Rapport ETR</option>
                    <option value="Rapport CRIV">Rapport CRIV</option>
                    <option value="REL/REHL">REL / REHL</option>
                    <option value="Réclamation">Réclamation</option>
                    <option value="PV">PV</option>
                    <option value="Autre">Autre</option>
                  </template>
                </select>
              </div>
            </div>
          </div>

          <!-- Section coordonnées -->
          <div class="form-section">
            <div class="section-label">
              <span class="section-num">3</span>
              Vos coordonnées
            </div>

            <div class="field-group two-col">
              <div class="field">
                <label>Prénom <span class="required">*</span></label>
                <input v-model="form.voyageur_prenom" type="text" placeholder="" required />
              </div>
              <div class="field">
                <label>Nom <span class="required">*</span></label>
                <input v-model="form.voyageur_nom" type="text" placeholder="" required />
              </div>
              <div class="field">
                <label>Email <span class="required">*</span></label>
                <input v-model="form.voyageur_email" type="email" placeholder="exemple@mail.com" required />
              </div>
              <div class="field">
                <label>Téléphone <span class="required">*</span></label>
                <input v-model="form.voyageur_telephone" type="tel" placeholder="" required />
              </div>
            </div>
          </div>

          <div class="form-footer">
            <p class="footer-note">
              <span class="required">*</span> Champs obligatoires. Vos données sont traitées conformément au RGPD et
              uniquement
              dans le cadre du traitement de votre signalement.
            </p>
            <button type="submit" :disabled="loading">
              <span v-if="loading" class="btn-spinner" />
              {{ loading ? 'Analyse en cours...' : 'Envoyer le signalement' }}
            </button>
          </div>

        </form>
      </div>

      <!-- Confirmation -->
      <div v-if="confirme" class="confirmation-card">
        <div class="confirm-icon">✓</div>
        <h2>Signalement bien reçu</h2>
        <p>Votre signalement a été transmis et sera traité dans les plus brefs délais. Vous recevrez un suivi par email.
        </p>
        <button class="btn-new" @click="confirme = false">Faire un nouveau signalement</button>
      </div>

    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.page {
  min-height: 100vh;
  background: #f4f6f9;
  font-family: 'DM Sans', system-ui, sans-serif;
  color: #1a1a2e;
}

.header {
  background: #004fa3;
  padding: 0 24px;
}

.header-inner {
  max-width: 860px;
  margin: 0 auto;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-ratp-mark {
  height: 28px;
  width: auto;
  object-fit: contain;
}

.logo-product {
  display: flex;
  gap: 2px;
  font-size: 17px;
  font-weight: 700;
}

.logo-vigie {
  color: #fff;
}

.logo-ratp-name {
  color: #4bc0ad;
}

.header-title {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin-left: 8px;
  border-left: 1px solid rgba(255, 255, 255, 0.2);
  padding-left: 16px;
}

.hero-band {
  background: #004fa3;
  padding: 24px 24px 32px;
}

.hero-inner {
  max-width: 860px;
  margin: 0 auto;
}

.hero-ratp-lockup {
  max-height: 72px;
  width: auto;
  object-fit: contain;
  margin-bottom: 14px;
  display: block;
}

.hero-inner h1 {
  font-size: 26px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 6px;
}

.hero-inner p {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.75);
}

.container {
  max-width: 860px;
  margin: -16px auto 40px;
  padding: 0 24px;
}

.prefill-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.prefill-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: #e8f5f2;
  border: 1px solid #b2ddd5;
  font-size: 13px;
  color: #1a5c50;
  font-weight: 500;
}

.chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4bc0ad;
  flex-shrink: 0;
}

form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-section {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.section-label {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.section-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #004fa3;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.field-group {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field-group.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.hint {
  font-size: 11px;
  color: #9ca3af;
  font-weight: 400;
  margin-left: auto;
}

.required {
  color: #e24b4a;
  font-weight: 700;
}

select,
input,
textarea {
  width: 100%;
  padding: 11px 14px;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #1a1a2e;
  background: #fff;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  font-family: inherit;
}

select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%236b7280' d='M4 6l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

textarea {
  resize: vertical;
  min-height: 110px;
  line-height: 1.5;
}

select:focus,
input:focus,
textarea:focus {
  border-color: #004fa3;
  box-shadow: 0 0 0 3px rgba(27, 63, 139, 0.1);
}

select:invalid,
input:invalid {
  border-color: #d1d5db;
}

.form-footer {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  flex-wrap: wrap;
}

.footer-note {
  font-size: 11px;
  color: #9ca3af;
  flex: 1;
  min-width: 200px;
  line-height: 1.5;
}

button[type="submit"] {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  background: #004fa3;
  color: #fff;
  border: none;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
  white-space: nowrap;
  font-family: inherit;
}

button[type="submit"]:hover {
  background: #163272;
  transform: translateY(-1px);
}

button[type="submit"]:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.confirmation-card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 48px 32px;
  text-align: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.confirm-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #4bc0ad;
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.confirmation-card h2 {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 10px;
}

.confirmation-card p {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.6;
  max-width: 440px;
  margin: 0 auto 24px;
}

.btn-new {
  padding: 10px 24px;
  background: #004fa3;
  color: #fff;
  border: none;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

@media (max-width: 600px) {
  .field-group.two-col {
    grid-template-columns: 1fr;
  }

  .form-footer {
    flex-direction: column;
    align-items: stretch;
  }

  button[type="submit"] {
    justify-content: center;
  }

  .hero-inner h1 {
    font-size: 22px;
  }

  .container {
    padding: 0 16px;
  }
}
</style>