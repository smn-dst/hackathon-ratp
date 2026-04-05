import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!
    )

    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, nom, prenom, role, actif, created_at')
        .order('created_at', { ascending: false })

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data
})