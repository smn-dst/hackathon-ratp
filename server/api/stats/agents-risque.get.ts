import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async () => {
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!
    )

    const { data, error } = await supabase
        .from('signalements')
        .select('agent_id, gravite')
        .gte('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())

    if (error) throw createError({ statusCode: 500, message: error.message })

    const agentMap: Record<string, { eleve: number; moyen: number; faible: number; total: number }> = {}
    data?.forEach((s: any) => {
        if (!agentMap[s.agent_id]) agentMap[s.agent_id] = { eleve: 0, moyen: 0, faible: 0, total: 0 }
        agentMap[s.agent_id].total++
        if (s.gravite === 'élevé') agentMap[s.agent_id].eleve++
        if (s.gravite === 'moyen') agentMap[s.agent_id].moyen++
        if (s.gravite === 'faible') agentMap[s.agent_id].faible++
    })

    return Object.entries(agentMap)
        .map(([id, stats]) => ({ id, ...stats }))
        .sort((a, b) => b.eleve - a.eleve || b.total - a.total)
        .slice(0, 5)
})