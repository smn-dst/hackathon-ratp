import { createClient } from "@supabase/supabase-js"

export default defineEventHandler(async (event) => {
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
)
    const id = getRouterParams(event).id
    const { agent_id } = await readBody(event)
    await supabase.from('signalements').update({ agent_id }).eq('id', id)
    return { ok: true }
})