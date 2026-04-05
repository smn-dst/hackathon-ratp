import { createClient } from "@supabase/supabase-js";

export default defineEventHandler(async (event) => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const body = await readBody(event);
  const normalizedType = body.type === "ligne" ? "bus" : body.type;

  if (!["bus", "arret"].includes(normalizedType)) {
    throw createError({
      statusCode: 400,
      message: "Type invalide. Valeurs attendues: bus ou arret.",
    });
  }

  let historique_agent = "Aucun signalement sur les 12 derniers mois";
  if (body.agent_id) {
    const { data: hist } = await supabase
      .from("signalements")
      .select("gravite, created_at")
      .eq("agent_id", body.agent_id)
      .gte(
        "created_at",
        new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      );

    if (hist && hist.length > 0) {
      const counts = hist.reduce((acc: any, s: any) => {
        acc[s.gravite] = (acc[s.gravite] || 0) + 1;
        return acc;
      }, {});
      historique_agent = `${hist.length} signalement(s) : ${JSON.stringify(
        counts,
      )}`;
    }
  }

  let meteo = "Non disponible";
  try {
    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=Paris&appid=${process.env.OPENWEATHER_API_KEY}&lang=fr&units=metric`,
    );
    const weatherData = await weatherRes.json();
    meteo = `${weatherData.weather?.[0]?.description}, ${weatherData.main?.temp}°C`;
  } catch {}

  const heure = new Date(body.heure_incident).getHours();
  const heurePointe =
    (heure >= 7 && heure <= 9) || (heure >= 17 && heure <= 19)
      ? "heure de pointe"
      : "heure creuse";

  let openai: any = null;
  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_KEY) {
    try {
      const { AzureOpenAI } = await import("openai");
      openai = new AzureOpenAI({
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiKey: process.env.AZURE_OPENAI_KEY,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION,
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
      });
    } catch (e) {
      console.error("Azure OpenAI indisponible, fallback sans IA:", e);
    }
  }

  let scoring_ia = null;
  let gravite = "faible";

  try {
    const prompt1 = `Tu es un assistant spécialisé dans l'analyse des signalements de transport en commun pour la RATP.

CONTEXTE REÇU :
- Texte du signalement : ${body.description}
- Type d'incident : ${body.type_incident}
- Heure du signalement : ${body.heure_incident} (${heurePointe})
- Météo au moment des faits : ${meteo}
- Historique de l'agent sur 12 mois : ${historique_agent}

RÈGLES DE SCORING :
- ÉLEVÉ : agression verbale ou physique, insultes, mise en danger, comportement discriminatoire
- MOYEN : refus d'arrêt, porte fermée délibérée, attitude irrespectueuse sans insulte
- FAIBLE : bus en retard, conduite brusque, problème technique
- POSITIF : aide passager, service exemplaire

FACTEURS AGGRAVANTS :
- Heure de pointe = +1 niveau si FAIBLE
- Récidive sur 12 mois = +1 niveau automatiquement
- Météo difficile = facteur atténuant possible si FAIBLE

Réponds UNIQUEMENT en JSON sans texte autour :
{
  "niveau": "faible | moyen | élevé | positif",
  "justification": "2-3 phrases maximum",
  "facteurs_pris_en_compte": ["liste des éléments"]
}`;

    if (!openai) {
      throw new Error("Client Azure OpenAI non initialisé");
    }

    const response1 = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt1 }],
      max_tokens: 500,
    });

    const content1 = response1.choices[0]?.message?.content || "";
    const clean1 = content1.replace(/```json|```/g, "").trim();
    scoring_ia = JSON.parse(clean1);
    gravite = scoring_ia.niveau;
  } catch (e) {
    console.error("Erreur Azure OpenAI scoring:", e);
  }

  let fiche_manager = null;
  try {
    const prompt2 = `Tu es un assistant qui synthétise les signalements RATP pour les managers de centre bus.

DONNÉES REÇUES :
- Texte du signalement : ${body.description}
- Niveau de gravité : ${gravite}
- Justification IA : ${scoring_ia?.justification}
- Ligne concernée : ${body.ligne_id}
- Heure et lieu : ${body.heure_incident} — ${body.arret_id || body.direction}
- Historique agent (12 mois) : ${historique_agent}

Réponds UNIQUEMENT en JSON sans texte autour :
{
  "fiche_manager": {
    "fait": "1 phrase — ce qui s'est passé",
    "contexte": "1 phrase — ligne, heure, lieu",
    "historique": "1 phrase — bilan des 12 derniers mois",
    "gravite": "1 phrase — niveau et pourquoi",
    "recommandation": "1 phrase — action suggérée"
  }
}`;

    if (!openai) {
      throw new Error("Client Azure OpenAI non initialisé");
    }

    const response2 = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt2 }],
      max_tokens: 500,
    });

    const content2 = response2.choices[0]?.message?.content || "";
    const clean2 = content2.replace(/```json|```/g, "").trim();
    fiche_manager = JSON.parse(clean2);
  } catch (e) {
    console.error("Erreur Azure OpenAI fiche manager:", e);
  }

  const { data, error } = await supabase
    .from("signalements")
    .insert([
      {
        type: normalizedType,
        ligne_id: body.ligne_id || null,
        arret_id: body.arret_id || null,
        direction: body.direction || null,
        lat: body.lat || null,
        lng: body.lng || null,
        type_incident: body.type_incident,
        gravite: gravite,
        scoring_ia: scoring_ia,
        fiche_manager: fiche_manager,
        meteo: meteo,
        description: body.description,
        voyageur_nom: body.voyageur_nom || null,
        voyageur_prenom: body.voyageur_prenom || null,
        voyageur_email: body.voyageur_email || null,
        voyageur_telephone: body.voyageur_telephone || null,
        heure_incident: body.heure_incident,
        source: body.source || "qr",
        statut: "nouveau",
      },
    ])
    .select()
    .single();

  if (error) throw createError({ statusCode: 500, message: error.message });
  return data;
});
