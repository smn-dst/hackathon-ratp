import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) throw createError({ statusCode: 400, message: 'id requis' })

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { error } = await supabase
    .from('profiles')
    .update(body)
    .eq('id', id)

  if (error) throw createError({ statusCode: 500, message: error.message })
  return { success: true }
})