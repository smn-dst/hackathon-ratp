// server/api/signalement/[id]/valider-com.post.ts
// Valide ou rejette un signalement social depuis le dashboard COM

import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const id   = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { action, user_id } = body
  // action: 'valider' | 'rejeter'

  if (!id || !action) {
    throw createError({ statusCode: 400, message: 'id et action requis' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  if (action === 'valider') {
    const { error } = await supabase
      .from('signalements')
      .update({
        valide_com:      true,
        valide_com_par:  user_id || null,
        valide_com_at:   new Date().toISOString()
      })
      .eq('id', id)

    if (error) throw createError({ statusCode: 500, message: error.message })
    return { success: true, action: 'valide' }

  } else if (action === 'rejeter') {
    const { error } = await supabase
      .from('signalements')
      .update({ statut: 'refusé' })
      .eq('id', id)

    if (error) throw createError({ statusCode: 500, message: error.message })
    return { success: true, action: 'rejeté' }

  } else {
    throw createError({ statusCode: 400, message: 'action invalide' })
  }
})