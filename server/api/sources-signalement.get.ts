import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async () => {
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!
    )

    const { data, error } = await supabase
        .from('sources_signalement')
        .select('valeur')
        .eq('actif', true)

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data
})