import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id requis' })

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  // auth.admin.deleteUser : le profil suit si FK ON DELETE CASCADE sur profiles.id
  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) throw createError({ statusCode: 500, message: error.message })

  return { success: true }
})