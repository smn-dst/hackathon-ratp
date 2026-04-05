import { createClient } from "@supabase/supabase-js"

export default defineEventHandler(async (event) => {
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!
    )

    const id = getRouterParams(event).id
    const { sujet, corps, email_destinataire, dashboard, statut_apres } = await readBody(event)

    if (!process.env.BREVO_API_KEY) {
        throw createError({ statusCode: 500, message: 'BREVO_API_KEY manquant dans .env' })
    }

    if (!email_destinataire) {
        throw createError({ statusCode: 400, message: 'Email du voyageur manquant' })
    }

    const senderName = dashboard === 'rh'
        ? 'Service RH/Juridique RATP'
        : 'Manager Centre Bus RATP'

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            sender: {
                name: senderName,
                email: process.env.BREVO_SENDER_EMAIL || 'simon.dousset@ecole-decode.fr'
            },
            to: [{ email: email_destinataire }],
            subject: sujet || 'Votre signalement RATP',
            textContent: corps || ''
        })
    })

    if (!brevoRes.ok) {
        const errBody = await brevoRes.json().catch(() => ({ message: `HTTP ${brevoRes.status}` }))
        console.error('[Brevo] Erreur envoi mail:', JSON.stringify(errBody))
        throw createError({
            statusCode: 500,
            message: `Brevo: ${errBody.message || errBody.code || 'Erreur inconnue'}`
        })
    }

    const nouveauStatut = statut_apres || 'traité'
    return { ok: true, sender: senderName, statut: nouveauStatut }
})