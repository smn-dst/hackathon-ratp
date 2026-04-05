import { createClient } from '@supabase/supabase-js'

type RecidiveApiResponse = {
    recidive: boolean
    regle?: string | null
    priorite?: string | null
    mail_agent_sujet?: string | null
    mail_agent_corps?: string | null
    agent_inconnu?: boolean
    webhook_indisponible?: boolean
}

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const body = await readBody(event)
    const { matricule } = body

    if (!id || !matricule?.trim()) {
        throw createError({ statusCode: 400, message: 'id et matricule requis' })
    }

    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!
    )

    const m = matricule.trim()

    const { data: agentRow, error: agentErr } = await supabase
        .from('agents')
        .select('id')
        .eq('id', m)
        .maybeSingle()

    if (agentErr) {
        throw createError({ statusCode: 500, message: 'Erreur lecture agents : ' + agentErr.message })
    }

    if (!agentRow) {
        await supabase
            .from('signalements')
            .update({ recidive: false, regle_recidive: 'R1' })
            .eq('id', id)
        return {
            recidive: false,
            regle: 'R1',
            priorite: 'faible',
            mail_agent_sujet: null,
            mail_agent_corps: null,
            agent_inconnu: true,
        } satisfies RecidiveApiResponse
    }

    const { error: patchError } = await supabase
        .from('signalements')
        .update({ agent_id: m })
        .eq('id', id)

    if (patchError) {
        throw createError({ statusCode: 500, message: 'Erreur enregistrement matricule : ' + patchError.message })
    }

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_RECIDIVE?.trim()
    if (!n8nWebhookUrl) {
        throw createError({ statusCode: 500, message: 'N8N_WEBHOOK_RECIDIVE non configuré' })
    }

    const payload = {
        signalement_id: id,
        matricule: m,
        body: { signalement_id: id, matricule: m },
    }

    let n8nResponse: RecidiveApiResponse
    try {
        n8nResponse = await $fetch<RecidiveApiResponse>(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
        })
    } catch (e: unknown) {
        const err = e as { status?: number; statusCode?: number; data?: { message?: string }; message?: string }
        const status = err.statusCode ?? err.status ?? 0
        if (status === 404) {
            throw createError({
                statusCode: 502,
                statusMessage: 'Service récidive indisponible',
                message: 'Réponse 404 : URL ou configuration du webhook incorrecte.',
            })
        }
        console.error('[check-recidive] n8n:', status, err.data?.message || err.message || e)
        await supabase
            .from('signalements')
            .update({ recidive: false, regle_recidive: 'R1' })
            .eq('id', id)
        return {
            recidive: false,
            regle: 'R1',
            priorite: 'faible',
            mail_agent_sujet: null,
            mail_agent_corps: null,
            webhook_indisponible: true,
        } satisfies RecidiveApiResponse
    }

    const recidive = Boolean(n8nResponse.recidive)
    const regle = n8nResponse.regle != null && n8nResponse.regle !== '' ? String(n8nResponse.regle) : null
    const sync: Record<string, unknown> = { recidive, regle_recidive: regle }
    if (n8nResponse.mail_agent_sujet) sync.mail_agent_sujet = n8nResponse.mail_agent_sujet
    if (n8nResponse.mail_agent_corps) sync.mail_agent_corps = n8nResponse.mail_agent_corps
    await supabase.from('signalements').update(sync).eq('id', id)

    return {
        recidive,
        regle,
        priorite: n8nResponse.priorite ?? null,
        mail_agent_sujet: n8nResponse.mail_agent_sujet ?? null,
        mail_agent_corps: n8nResponse.mail_agent_corps ?? null,
    }
})
