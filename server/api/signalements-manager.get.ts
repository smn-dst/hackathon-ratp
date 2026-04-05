import { createClient } from "@supabase/supabase-js"

// Tous les signalements non refusés (formulaire + réseaux), sans filtre valide_com :
// les entrées Twitter/TikTok sont visibles ici dès insertion, en parallèle du dashboard COM.
export default defineEventHandler(async () => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data, error } = await supabase
    .from("signalements")
    .select("id, type, gravite, type_incident, description, ligne_id, arret_id, direction, agent_id, statut, source, lien_social, resume_ia, meteo, lat, lng, heure_incident, voyageur_nom, voyageur_prenom, voyageur_email, scoring_ia, fiche_manager, mail_voyageur_sujet, mail_voyageur_draft, mail_voyageur_sujet_cloture, mail_voyageur_draft_cloture, recidive, regle_recidive, mail_agent_sujet, mail_agent_corps, email_agent, agent_traite, historique_convocation, pris_en_charge_par, created_at")
    .neq("statut", "refusé")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})