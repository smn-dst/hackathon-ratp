export default defineNuxtRouteMiddleware(async (to) => {
    const supabase = useSupabaseClient()
    const user = useSupabaseUser()
    const { chargerProfil, routeParRole } = useAuth()

    const publiques = ['/', '/auth/callback']
    if (publiques.includes(to.path)) return

    /** useSupabaseUser() peut être vide juste après signIn ; getSession() reflète déjà la session. */
    const { data: { session } } = await supabase.auth.getSession()
    const uid = user.value?.id ?? session?.user?.id
    if (!uid) return navigateTo('/')

    const profile = await chargerProfil(uid)
    if (!profile) return navigateTo('/')
    if (!profile.actif) return navigateTo('/')

    const routesAutorisees: Record<string, string[]> = {
        '/dashboard/manager': ['manager', 'admin'],
        '/dashboard/rh': ['rh', 'admin'],
        '/dashboard/com': ['com', 'admin'],
        '/dashboard/admin': ['admin']
    }

    const regleRoute = Object.keys(routesAutorisees).find(r => to.path.startsWith(r))

    if (regleRoute) {
        const rolesAutorises = routesAutorisees[regleRoute]!
        if (!rolesAutorises.includes(profile.role)) {
            return navigateTo(routeParRole(profile.role))
        }
    }
})