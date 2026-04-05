import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password, nom, prenom, role } = body

  if (!email || !password || !role) {
    throw createError({ statusCode: 400, message: 'email, password et role sont requis' })
  }

  const rolesValides = ['manager', 'rh', 'com', 'admin']
  if (!rolesValides.includes(role)) {
    throw createError({ statusCode: 400, message: 'Rôle invalide' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  // service_role : création sans flux « confirmation email » côté utilisateur
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, nom, prenom }
  })

  if (authError) {
    throw createError({ statusCode: 400, message: authError.message })
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id:     authData.user.id,
      email,
      nom:    nom || null,
      prenom: prenom || null,
      role,
      actif:  true
    })

  if (profileError) {
    throw createError({ statusCode: 500, message: profileError.message })
  }

  return { success: true, id: authData.user.id }
})