// server/api/signalements-com.get.ts
// Retourne les signalements Twitter/TikTok pour le dashboard COM.
// Colonne URL du post : lien_social (à utiliser aussi dans n8n / REST, pas lien_source).

import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async () => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data, error } = await supabase
    .from('signalements')
    .select(`
      id, type, gravite, type_incident, description, resume_ia,
      ligne_id, arret_id, agent_id, direction,
      heure_incident, lat, lng,
      meteo, statut, source, lien_social,
      voyageur_nom, voyageur_prenom, voyageur_email,
      scoring_ia, fiche_manager,
      mail_voyageur_sujet, mail_voyageur_draft,
      recidive, regle_recidive,
      pris_en_charge_par, created_at
    `)
    .in('source', ['twitter', 'tiktok'])
    .neq('statut', 'refusé')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})