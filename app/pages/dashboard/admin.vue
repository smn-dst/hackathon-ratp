<script setup>
definePageMeta({ middleware: ['auth'] })

import QRCode from 'qrcode'

const { deconnexion, profile } = useAuth()
const { data: lignes } = await useFetch('/api/lignes')

const ongletActif = ref('users')

const { data: users, refresh } = await useFetch('/api/admin/users')
const roleActif = ref('tous')

const usersFiltres = computed(() => {
  if (!users.value) return []
  if (roleActif.value === 'tous') return users.value
  return users.value.filter(u => u.role === roleActif.value)
})

const countParRole = computed(() => {
  const c = { tous: 0, manager: 0, rh: 0, com: 0, admin: 0 }
  users.value?.forEach(u => { c.tous++; if (c[u.role] !== undefined) c[u.role]++ })
  return c
})

const editingUserId = ref(null)
const editingRole = ref('')

function startEditRole(user) {
  editingUserId.value = user.id
  editingRole.value = user.role
}

function cancelEditRole() {
  editingUserId.value = null
  editingRole.value = ''
}

async function saveRole(user) {
  if (editingRole.value === user.role) { cancelEditRole(); return }
  actionLoading.value = user.id
  try {
    await $fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      body: { role: editingRole.value }
    })
    await refresh()
  } finally {
    actionLoading.value = null
    cancelEditRole()
  }
}

const showModal = ref(false)
const formEmail = ref('')
const formPassword = ref('')
const formNom = ref('')
const formPrenom = ref('')
const formRole = ref('manager')
const formLoading = ref(false)
const formErreur = ref('')
const formSuccess = ref('')

function ouvrirModal() {
  showModal.value = true
  formEmail.value = formPassword.value = formNom.value = formPrenom.value = ''
  formRole.value = 'manager'; formErreur.value = formSuccess.value = ''
}

async function creerUser() {
  if (!formEmail.value || !formPassword.value) { formErreur.value = 'Email et mot de passe requis.'; return }
  formLoading.value = true; formErreur.value = formSuccess.value = ''
  try {
    await $fetch('/api/admin/users', {
      method: 'POST',
      body: { email: formEmail.value.trim(), password: formPassword.value, nom: formNom.value.trim() || null, prenom: formPrenom.value.trim() || null, role: formRole.value }
    })
    formSuccess.value = `Compte créé pour ${formEmail.value}`
    await refresh()
    setTimeout(() => { showModal.value = false }, 1500)
  } catch (e) { formErreur.value = e.data?.message || e.message || 'Erreur lors de la création.' }
  finally { formLoading.value = false }
}

const actionLoading = ref(null)

async function toggleActif(user) {
  actionLoading.value = user.id
  try { await $fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', body: { actif: !user.actif } }); await refresh() }
  finally { actionLoading.value = null }
}

async function supprimerUser(user) {
  if (!confirm(`Supprimer ${user.email} ? Cette action est irréversible.`)) return
  actionLoading.value = user.id
  try { await $fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' }); await refresh() }
  finally { actionLoading.value = null }
}

const roleLabel = r => ({ manager: 'Manager', rh: 'RH / Juridique', com: 'COM', admin: 'Admin' }[r] || r)
const roleColor = r => ({ manager: '#3b82f6', rh: '#e24b4a', com: '#f59e0b', admin: '#4bc0ad' }[r] || '#888')
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const BASE_URL = 'http://localhost:3000/signalement'
const ongletQR = ref('lignes')
const generatingAll = ref(false)
const generatingAllArrets = ref(false)

const arretsMock = [
  { id: 'ARR-NATION', nom: 'Nation', ville: 'Paris 11e / 12e' },
  { id: 'ARR-GAMBETTA', nom: 'Gambetta', ville: 'Paris 20e' },
  { id: 'ARR-VINCENNES', nom: 'Vincennes', ville: 'Vincennes' },
  { id: 'ARR-GARE-LYON', nom: 'Gare de Lyon', ville: 'Paris 12e' },
  { id: 'ARR-MONTREUIL', nom: 'Mairie de Montreuil', ville: 'Montreuil' },
]

async function genererQR(canvasId, url) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return
  await QRCode.toCanvas(canvas, url, { width: 160, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
}
async function telecharger(url, nom) {
  const canvas = document.createElement('canvas')
  await QRCode.toCanvas(canvas, url, { width: 600, margin: 2 })
  const link = document.createElement('a'); link.download = `qr-${nom}.png`; link.href = canvas.toDataURL('image/png'); link.click()
}
async function telechargerToutLignes() {
  generatingAll.value = true
  for (const l of lignes.value || []) { await telecharger(`${BASE_URL}?type=ligne&ligne=${l.numero}`, `ligne-${l.numero}`); await new Promise(r => setTimeout(r, 300)) }
  generatingAll.value = false
}
async function telechargerToutArrets() {
  generatingAllArrets.value = true
  for (const a of arretsMock) { await telecharger(`${BASE_URL}?type=arret&arret=${encodeURIComponent(a.nom)}&arret_id=${a.id}`, `arret-${a.id}`); await new Promise(r => setTimeout(r, 300)) }
  generatingAllArrets.value = false
}
async function genererTousQR() {
  await nextTick()
  if (ongletQR.value === 'lignes') {
    for (const l of lignes.value || []) await genererQR(`qr-ligne-${l.id}`, `${BASE_URL}?type=ligne&ligne=${l.numero}`)
  } else {
    for (const a of arretsMock) await genererQR(`qr-arret-${a.id}`, `${BASE_URL}?type=arret&arret=${encodeURIComponent(a.nom)}&arret_id=${a.id}`)
  }
}

const isDragging = ref(false); const importing = ref(false); const importResult = ref(null); const importError = ref(null)
const isDraggingArrets = ref(false); const importingArrets = ref(false); const importResultArrets = ref(null); const importErrorArrets = ref(null)

async function handleDrop(e) { isDragging.value = false; const f = e.dataTransfer.files[0]; if (f) await uploadFile(f) }
async function handleFile(e) { const f = e.target.files[0]; if (f) await uploadFile(f) }
async function uploadFile(file) {
  importing.value = true; importError.value = null
  try { const fd = new FormData(); fd.append('file', file); importResult.value = await $fetch('/api/admin/import-xls', { method: 'POST', body: fd }) }
  catch (e) { importError.value = e?.data?.message || e.message || 'Erreur inconnue' }
  finally { importing.value = false }
}
async function handleDropArrets(e) { isDraggingArrets.value = false; const f = e.dataTransfer.files[0]; if (f) await uploadArrets(f) }
async function handleFileArrets(e) { const f = e.target.files[0]; if (f) await uploadArrets(f) }
async function uploadArrets(file) {
  importingArrets.value = true; importErrorArrets.value = null
  try { const fd = new FormData(); fd.append('file', file); importResultArrets.value = await $fetch('/api/admin/import-arrets', { method: 'POST', body: fd }) }
  catch (e) { importErrorArrets.value = e?.data?.message || e.message || 'Erreur inconnue' }
  finally { importingArrets.value = false }
}

watch(ongletQR, () => genererTousQR())
watch(ongletActif, async (val) => { if (val === 'qr') { await nextTick(); genererTousQR() } })
onMounted(() => { if (ongletActif.value === 'qr') genererTousQR() })
</script>

<template>
  <div class="admin-root">

    <aside class="sidebar">
      <div class="sidebar-brand">
        <img src="/branding/ratp-mark.png" alt="RATP" class="sidebar-ratp-mark" width="100" height="28" />
        <div>
          <div><span class="brand-vigie">Vigie</span><span class="brand-r">RATP</span></div>
          <div class="brand-sub">Administration</div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <button v-for="item in [
          { key: 'users', label: 'Utilisateurs' },
          { key: 'qr', label: 'QR Codes' },
          { key: 'xls', label: 'Import XLS' },
        ]" :key="item.key" class="nav-item" :class="{ active: ongletActif === item.key }"
          @click="ongletActif = item.key">
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="profile-pill">
          <div class="profile-avatar">{{ profile?.email?.[0]?.toUpperCase() }}</div>
          <div class="profile-info">
            <span class="profile-email">{{ profile?.email }}</span>
            <span class="profile-role">Admin</span>
          </div>
        </div>
        <button class="btn-logout" @click="deconnexion">
          <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
            <path d="M13 3h4a1 1 0 011 1v12a1 1 0 01-1 1h-4M8 14l4-4-4-4M12 10H3" stroke="currentColor"
              stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Déconnexion
        </button>
      </div>
    </aside>

    <main class="main">

      <template v-if="ongletActif === 'users'">
        <div class="page-header">
          <div>
            <h1 class="page-title">Utilisateurs</h1>
            <p class="page-sub">{{ users?.length || 0 }} compte{{ users?.length > 1 ? 's' : '' }} au total</p>
          </div>
          <button class="btn-create" @click="ouvrirModal">
            <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
              <path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            Créer un compte
          </button>
        </div>

        <div class="role-tabs">
          <button v-for="tab in [
            { key: 'tous', label: 'Tous' },
            { key: 'manager', label: 'Manager' },
            { key: 'rh', label: 'RH / Juridique' },
            { key: 'com', label: 'COM' },
            { key: 'admin', label: 'Admin' },
          ]" :key="tab.key" class="role-tab" :class="{ active: roleActif === tab.key }"
            :style="roleActif === tab.key && tab.key !== 'tous' ? `--tc:${roleColor(tab.key)}` : ''"
            @click="roleActif = tab.key">
            {{ tab.label }}
            <span class="tab-count">{{ countParRole[tab.key] }}</span>
          </button>
        </div>

        <div class="table-wrap">
          <div v-if="!usersFiltres.length" class="empty-state">Aucun utilisateur dans cette catégorie</div>
          <table v-else class="table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Créé le</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in usersFiltres" :key="u.id" :class="{ inactive: !u.actif }">

                <td>
                  <div class="user-cell">
                    <div class="user-avatar" :style="`background:${roleColor(u.role)}22;color:${roleColor(u.role)}`">{{
                      u.email?.[0]?.toUpperCase() }}</div>
                    <div>
                      <div class="user-name">{{ u.prenom || '' }} {{ u.nom || '' }}<span v-if="!u.nom && !u.prenom"
                          class="no-name">Sans nom</span></div>
                      <div class="user-email">{{ u.email }}</div>
                    </div>
                  </div>
                </td>

                <td>
                  <div v-if="editingUserId === u.id" class="role-edit-wrap">
                    <select v-model="editingRole" class="role-select">
                      <option value="manager">Manager</option>
                      <option value="rh">RH / Juridique</option>
                      <option value="com">COM</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button class="btn-save" :disabled="actionLoading === u.id" @click="saveRole(u)"
                      title="Enregistrer">✓</button>
                    <button class="btn-cancel-edit" @click="cancelEditRole" title="Annuler">✕</button>
                  </div>
                  <div v-else class="role-display">
                    <span class="role-badge"
                      :style="`background:${roleColor(u.role)}18;color:${roleColor(u.role)};border-color:${roleColor(u.role)}40`">{{
                      roleLabel(u.role) }}</span>
                    <button class="btn-edit-role" @click="startEditRole(u)" title="Modifier le rôle">
                      <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
                        <path d="M11.5 2.5a1.414 1.414 0 012 2L5 13H2v-3L11.5 2.5z" stroke="currentColor"
                          stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </button>
                  </div>
                </td>

                <td class="date-cell">{{ formatDate(u.created_at) }}</td>

                <td><span class="statut-badge" :class="u.actif ? 'actif' : 'inactif'">{{ u.actif ? 'Actif' : 'Désactivé'
                    }}</span></td>

                <td>
                  <div class="actions-cell">
                    <button class="btn-action" :class="u.actif ? 'btn-warn' : 'btn-ok'"
                      :disabled="actionLoading === u.id" @click="toggleActif(u)"
                      :title="u.actif ? 'Désactiver' : 'Réactiver'">{{ u.actif ? '⏸' : '▶' }}</button>
                    <button class="btn-action btn-del" :disabled="actionLoading === u.id || u.email === profile?.email"
                      @click="supprimerUser(u)" title="Supprimer">🗑</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-if="ongletActif === 'qr'">
        <div class="page-header">
          <div>
            <h1 class="page-title">QR Codes</h1>
            <p class="page-sub">Génération des QR codes imprimables par ligne et arrêt</p>
          </div>
          <button class="btn-create" @click="ongletQR === 'lignes' ? telechargerToutLignes() : telechargerToutArrets()"
            :disabled="generatingAll || generatingAllArrets">
            {{ (generatingAll || generatingAllArrets) ? 'Génération...' : 'Tout télécharger' }}
          </button>
        </div>
        <div class="card">
          <div class="tabs-bar">
            <button class="tab" :class="{ active: ongletQR === 'lignes' }" @click="ongletQR = 'lignes'">Lignes ({{
              lignes?.length || 0 }})</button>
            <button class="tab" :class="{ active: ongletQR === 'arrets' }" @click="ongletQR = 'arrets'">Arrêts ({{
              arretsMock.length }})</button>
          </div>
          <div class="qr-grid">
            <template v-if="ongletQR === 'lignes'">
              <div v-for="ligne in lignes" :key="ligne.id" class="qr-card">
                <canvas :id="`qr-ligne-${ligne.id}`" />
                <div class="qr-info"><span class="qr-num">Ligne {{ ligne.numero }}</span><span class="qr-nom">{{
                    ligne.nom }}</span></div>
                <a class="qr-url" :href="`${BASE_URL}?type=ligne&ligne=${ligne.numero}`" target="_blank">{{
                  `${BASE_URL}?type=ligne&ligne=${ligne.numero}` }}</a>
                <button class="btn-dl"
                  @click="telecharger(`${BASE_URL}?type=ligne&ligne=${ligne.numero}`, `ligne-${ligne.numero}`)">Télécharger</button>
              </div>
            </template>
            <template v-if="ongletQR === 'arrets'">
              <div v-for="arret in arretsMock" :key="arret.id" class="qr-card">
                <canvas :id="`qr-arret-${arret.id}`" />
                <div class="qr-info"><span class="qr-num">{{ arret.nom }}</span><span class="qr-nom">{{ arret.ville
                    }}</span></div>
                <a class="qr-url"
                  :href="`${BASE_URL}?type=arret&arret=${encodeURIComponent(arret.nom)}&arret_id=${arret.id}`"
                  target="_blank">{{
                    `${BASE_URL}?type=arret&arret=${encodeURIComponent(arret.nom)}&arret_id=${arret.id}` }}</a>
                <button class="btn-dl"
                  @click="telecharger(`${BASE_URL}?type=arret&arret=${encodeURIComponent(arret.nom)}&arret_id=${arret.id}`, `arret-${arret.id}`)">Télécharger</button>
              </div>
            </template>
          </div>
        </div>
      </template>

      <template v-if="ongletActif === 'xls'">
        <div class="page-header">
          <div>
            <h1 class="page-title">Import XLS</h1>
            <p class="page-sub">Glissez vos fichiers Excel pour mettre à jour la base de données</p>
          </div>
        </div>
        <div class="xls-grid">
          <div class="card">
            <div class="card-header"><span class="section-num">1</span><span>Types d'incidents &amp; sources</span>
            </div>
            <div class="card-body">
              <p class="section-desc">Importe le fichier XLS de la BDD signalements RATP pour mettre à jour le
                formulaire voyageur.</p>
              <div class="drop-zone" :class="{ active: isDragging, success: !!importResult }"
                @dragover.prevent="isDragging = true" @dragleave="isDragging = false" @drop.prevent="handleDrop">
                <div v-if="!importResult && !importing" class="drop-content">
                  <div class="drop-icon-wrap">+</div>
                  <p>Glisse le fichier XLS ici</p><label class="drop-btn">Parcourir<input type="file"
                      accept=".xlsx,.xls" @change="handleFile" hidden /></label>
                </div>
                <div v-if="importing" class="drop-loading"><span class="spinner-sm" />Analyse en cours...</div>
                <div v-if="importResult" class="drop-success">
                  <div class="success-icon">✓</div>
                  <p><strong>{{ importResult.types_importes }}</strong> types d'incidents</p>
                  <p><strong>{{ importResult.sources_importees }}</strong> sources</p><button class="btn-reset"
                    @click="importResult = null">Réimporter</button>
                </div>
              </div>
              <div v-if="importError" class="error-banner">{{ importError }}</div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><span class="section-num">2</span><span>Arrêts RATP</span></div>
            <div class="card-body">
              <p class="section-desc">Importe le fichier arrets.xlsx pour mettre à jour les coordonnées GPS.</p>
              <div class="drop-zone" :class="{ active: isDraggingArrets, success: !!importResultArrets }"
                @dragover.prevent="isDraggingArrets = true" @dragleave="isDraggingArrets = false"
                @drop.prevent="handleDropArrets">
                <div v-if="!importResultArrets && !importingArrets" class="drop-content">
                  <div class="drop-icon-wrap">+</div>
                  <p>Glisse le fichier XLS ici</p><label class="drop-btn">Parcourir<input type="file"
                      accept=".xlsx,.xls" @change="handleFileArrets" hidden /></label>
                </div>
                <div v-if="importingArrets" class="drop-loading"><span class="spinner-sm" />Import en cours...</div>
                <div v-if="importResultArrets" class="drop-success">
                  <div class="success-icon">✓</div>
                  <p><strong>{{ importResultArrets.arrets_importes }}</strong> arrêts importés</p><button
                    class="btn-reset" @click="importResultArrets = null">Réimporter</button>
                </div>
              </div>
              <div v-if="importErrorArrets" class="error-banner">{{ importErrorArrets }}</div>
            </div>
          </div>
        </div>
      </template>

    </main>

    <Transition name="fade">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal">
          <div class="modal-header">
            <h2>Créer un compte</h2><button class="btn-close" @click="showModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="field"><label>Prénom</label><input v-model="formPrenom" type="text" placeholder="Jean" />
              </div>
              <div class="field"><label>Nom</label><input v-model="formNom" type="text" placeholder="Dupont" /></div>
            </div>
            <div class="field"><label>Email <span class="required">*</span></label><input v-model="formEmail"
                type="email" placeholder="jean.dupont@ratp.fr" /></div>
            <div class="field"><label>Mot de passe <span class="required">*</span></label><input v-model="formPassword"
                type="password" placeholder="Minimum 6 caractères" /></div>
            <div class="field">
              <label>Rôle <span class="required">*</span></label>
              <div class="role-selector">
                <button v-for="r in ['manager', 'rh', 'com', 'admin']" :key="r" type="button" class="role-opt"
                  :class="{ selected: formRole === r }" :style="formRole === r ? `--rc:${roleColor(r)}` : ''"
                  @click="formRole = r">
                  {{ roleLabel(r) }}
                </button>
              </div>
            </div>
            <Transition name="fade">
              <div v-if="formErreur" class="alert alert-err">{{ formErreur }}</div>
            </Transition>
            <Transition name="fade">
              <div v-if="formSuccess" class="alert alert-ok">✓ {{ formSuccess }}</div>
            </Transition>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="showModal = false">Annuler</button>
            <button class="btn-confirm" :disabled="formLoading" @click="creerUser">
              <span v-if="formLoading" class="spinner" /><span v-else>Créer le compte</span>
            </button>
          </div>
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

.admin-root {
  display: flex;
  min-height: 100vh;
  background: #f0f4f8;
  font-family: 'DM Sans', sans-serif;
  color: #1a1a2e;
}

/* SIDEBAR */
.sidebar {
  width: 240px;
  flex-shrink: 0;
  background: #1a1a2e;
  display: flex;
  flex-direction: column;
  padding: 24px 0;
  position: sticky;
  top: 0;
  height: 100vh;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-ratp-mark {
  height: 28px;
  width: auto;
  max-width: 100px;
  object-fit: contain;
  flex-shrink: 0;
}

.brand-vigie {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
}

.brand-r {
  font-size: 15px;
  font-weight: 700;
  color: #4bc0ad;
}

.brand-sub {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 0.05em;
}

.sidebar-nav {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: none;
  background: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.45);
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  transition: all 0.15s;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.8);
}

.nav-item.active {
  background: rgba(0, 168, 143, 0.15);
  color: #4bc0ad;
}

.nav-icon {
  font-size: 16px;
}

.sidebar-footer {
  padding: 16px 12px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.profile-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px 14px;
}

.profile-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 168, 143, 0.2);
  color: #4bc0ad;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.profile-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.profile-email {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-role {
  font-size: 10px;
  color: #4bc0ad;
  font-weight: 600;
}

.btn-logout {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-radius: 8px;
  border: 1px solid rgba(226, 75, 74, 0.2);
  background: rgba(226, 75, 74, 0.06);
  color: #fca5a5;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  transition: all 0.15s;
}

.btn-logout:hover {
  background: rgba(226, 75, 74, 0.14);
}

/* MAIN */
.main {
  flex: 1;
  padding: 32px;
  overflow-y: auto;
  min-height: 100vh;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a2e;
}

.page-sub {
  font-size: 13px;
  color: #94a3b8;
  margin-top: 3px;
}

.btn-create {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  background: #1a1a2e;
  color: #fff;
  border: none;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}

.btn-create:hover:not(:disabled) {
  background: #2d2d4e;
}

.btn-create:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ROLE TABS */
.role-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.role-tab {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  border-radius: 999px;
  border: 1.5px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.role-tab.active {
  background: var(--tc, #1a1a2e);
  border-color: var(--tc, #1a1a2e);
  color: #fff;
}

.role-tab:first-child.active {
  background: #1a1a2e;
  border-color: #1a1a2e;
}

.tab-count {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
}

.role-tab:not(.active) .tab-count {
  background: #f1f5f9;
  color: #64748b;
}

/* TABLE */
.table-wrap {
  background: #fff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table thead th {
  padding: 12px 16px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #94a3b8;
  text-align: left;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.table tbody tr {
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.1s;
}

.table tbody tr:last-child {
  border-bottom: none;
}

.table tbody tr:hover {
  background: #f8fafc;
}

.table tbody tr.inactive {
  opacity: 0.5;
}

.table tbody td {
  padding: 12px 16px;
  font-size: 14px;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}

.user-email {
  font-size: 12px;
  color: #94a3b8;
}

.no-name {
  font-weight: 400;
  color: #94a3b8;
  font-style: italic;
}

.date-cell {
  color: #64748b;
  font-size: 13px;
}

/* ROLE EDIT INLINE */
.role-display {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-edit-role {
  padding: 4px;
  border: none;
  background: none;
  cursor: pointer;
  color: #94a3b8;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: color 0.15s;
  opacity: 0;
}

.table tbody tr:hover .btn-edit-role {
  opacity: 1;
}

.btn-edit-role:hover {
  color: #1a1a2e;
}

.role-edit-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}

.role-select {
  padding: 5px 8px;
  border-radius: 7px;
  border: 1.5px solid #1a1a2e;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #1a1a2e;
  background: #fff;
  outline: none;
  cursor: pointer;
}

.btn-save {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: none;
  background: #4bc0ad;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-save:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-cancel-edit {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.role-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid;
}

.statut-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
}

.statut-badge.actif {
  background: rgba(0, 168, 143, 0.1);
  color: #4bc0ad;
}

.statut-badge.inactif {
  background: rgba(100, 116, 139, 0.1);
  color: #64748b;
}

.actions-cell {
  display: flex;
  gap: 6px;
}

.btn-action {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.btn-action:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-warn {
  background: rgba(245, 158, 11, 0.1);
}

.btn-warn:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.2);
}

.btn-ok {
  background: rgba(0, 168, 143, 0.1);
}

.btn-ok:hover:not(:disabled) {
  background: rgba(0, 168, 143, 0.2);
}

.btn-del {
  background: rgba(226, 75, 74, 0.08);
}

.btn-del:hover:not(:disabled) {
  background: rgba(226, 75, 74, 0.18);
}

.empty-state {
  padding: 60px;
  text-align: center;
  font-size: 14px;
  color: #94a3b8;
}

/* CARDS */
.card {
  background: #fff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.card-header {
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

.card-body {
  padding: 20px;
}

.tabs-bar {
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 20px;
}

.tab {
  padding: 12px 20px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #9ca3af;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  margin-bottom: -1px;
  transition: all 0.15s;
  font-family: 'DM Sans', sans-serif;
}

.tab.active {
  color: #004fa3;
  border-bottom-color: #004fa3;
}

.qr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 14px;
  padding: 20px;
}

.qr-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.qr-card canvas {
  border-radius: 6px;
  background: #fff;
  border: 1px solid #e2e8f0;
}

.qr-info {
  text-align: center;
}

.qr-num {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #1a1a2e;
}

.qr-nom {
  display: block;
  font-size: 10px;
  color: #9ca3af;
  margin-top: 2px;
}

.qr-url {
  font-size: 8px;
  color: #c0c9d8;
  word-break: break-all;
  text-align: center;
  text-decoration: none;
  line-height: 1.4;
}

.qr-url:hover {
  color: #4bc0ad;
}

.btn-dl {
  width: 100%;
  padding: 7px;
  background: #004fa3;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
}

.btn-dl:hover {
  background: #163272;
}

.xls-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.section-num {
  width: 24px;
  height: 24px;
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

.section-desc {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 14px;
  line-height: 1.6;
}

.drop-zone {
  border: 1.5px dashed #d1d5db;
  border-radius: 10px;
  padding: 24px 16px;
  text-align: center;
  transition: all 0.2s;
  background: #f9fafb;
  cursor: pointer;
}

.drop-zone.active {
  border-color: #4bc0ad;
  background: #f0faf8;
}

.drop-zone.success {
  border-color: #4bc0ad;
  border-style: solid;
  background: #f0faf8;
}

.drop-content p {
  font-size: 12px;
  color: #9ca3af;
  margin: 8px 0;
}

.drop-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e8f5f2;
  color: #4bc0ad;
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
}

.drop-btn {
  display: inline-block;
  padding: 7px 18px;
  background: #4bc0ad;
  color: #fff;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  margin-top: 8px;
}

.drop-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: #9ca3af;
  padding: 8px 0;
}

.drop-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}

.success-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #4bc0ad;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.drop-success p {
  font-size: 13px;
  color: #374151;
}

.btn-reset {
  margin-top: 6px;
  padding: 6px 16px;
  background: #f4f6f9;
  border: 1px solid #e2e8f0;
  color: #6b7280;
  border-radius: 999px;
  font-size: 11px;
  cursor: pointer;
}

.error-banner {
  margin-top: 12px;
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-size: 12px;
  color: #dc2626;
}

/* MODAL */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(3px);
  padding: 20px;
}

.modal {
  background: #fff;
  border-radius: 16px;
  width: 480px;
  max-width: 100%;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #f1f5f9;
}

.modal-header h2 {
  font-size: 17px;
  font-weight: 700;
  color: #1a1a2e;
}

.btn-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 16px 24px;
  border-top: 1px solid #f1f5f9;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.field input {
  padding: 10px 12px;
  border-radius: 9px;
  border: 1.5px solid #e2e8f0;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  color: #1a1a2e;
  outline: none;
}

.field input:focus {
  border-color: #1a1a2e;
}

.required {
  color: #e24b4a;
}

.role-selector {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.role-opt {
  padding: 7px 14px;
  border-radius: 8px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.role-opt.selected {
  background: var(--rc, #1a1a2e);
  border-color: var(--rc, #1a1a2e);
  color: #fff;
}

.alert {
  padding: 10px 14px;
  border-radius: 9px;
  font-size: 13px;
}

.alert-err {
  background: rgba(226, 75, 74, 0.1);
  color: #b91c1c;
  border: 1px solid rgba(226, 75, 74, 0.2);
}

.alert-ok {
  background: rgba(0, 168, 143, 0.1);
  color: #00695c;
  border: 1px solid rgba(0, 168, 143, 0.2);
}

.btn-cancel {
  padding: 10px 20px;
  border-radius: 9px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-confirm {
  padding: 10px 20px;
  border-radius: 9px;
  background: #1a1a2e;
  color: #fff;
  border: none;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 130px;
  justify-content: center;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-confirm:not(:disabled):hover {
  background: #2d2d4e;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid #e2e8f0;
  border-top-color: #4bc0ad;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
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

@media (max-width: 900px) {
  .xls-grid {
    grid-template-columns: 1fr;
  }

  .sidebar {
    display: none;
  }
}
</style>