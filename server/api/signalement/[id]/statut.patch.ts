import { createClient } from '@supabase/supabase-js'

const ALLOWED = [
    'statut',
    'pris_en_charge_par',
    'email_agent',
    'agent_traite',
    'recidive',
    'regle_recidive',
    'mail_agent_sujet',
    'mail_agent_corps',
    'agent_id',
] as const

export default defineEventHandler(async (event) => {
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!
    )
    const id = getRouterParams(event).id
    const body = (await readBody(event)) as Record<string, unknown>

    const update: Record<string, unknown> = {}
    for (const key of ALLOWED) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
            update[key] = body[key]
        }
    }

    if (Object.keys(update).length === 0) {
        throw createError({ statusCode: 400, message: 'Aucun champ reconnu à mettre à jour' })
    }

    const { error } = await supabase.from('signalements').update(update).eq('id', id)
    if (error) throw createError({ statusCode: 500, message: error.message })
    return { ok: true }
})
