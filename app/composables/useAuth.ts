export const useAuth = () => {
    const supabase = useSupabaseClient()
    const user = useSupabaseUser()

    const profile = useState<{
        id: string
        email: string
        nom: string | null
        prenom: string | null
        role: 'manager' | 'rh' | 'com' | 'admin'
        actif: boolean
    } | null>('profile', () => null)

    /** Après signIn, passer `userId` : useSupabaseUser() peut encore être null un court instant. */
    async function chargerProfil(userId?: string) {
        const uid = userId ?? user.value?.id
        if (!uid) return null
        if (profile.value?.id === uid) return profile.value

        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, nom, prenom, role, actif')
            .eq('id', uid)
            .maybeSingle()

        if (error) {
            console.error('[useAuth] lecture profiles:', error.message, error)
            profile.value = null
            return null
        }
        if (!data) {
            profile.value = null
            return null
        }

        profile.value = data
        return data
    }

    function routeParRole(role: string) {
        const routes: Record<string, string> = {
            manager: '/dashboard/manager',
            rh: '/dashboard/rh',
            com: '/dashboard/com',
            admin: '/dashboard/admin'
        }
        return routes[role] || '/dashboard/manager'
    }

    async function connexion(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error

        const uid = data.user?.id
        if (!uid) throw new Error('Session invalide après connexion.')

        const p = await chargerProfil(uid)
        if (!p) {
            throw new Error(
                'Profil introuvable : ajoutez une ligne dans public.profiles avec id = votre UUID Auth, ou vérifiez les politiques RLS (SELECT).'
            )
        }
        if (!p.actif) {
            await supabase.auth.signOut()
            throw new Error('Compte désactivé — contactez votre administrateur')
        }

        return routeParRole(p.role)
    }

    async function deconnexion() {
        await supabase.auth.signOut()
        profile.value = null
        await navigateTo('/')
    }

    return {
        user,
        profile,
        chargerProfil,
        routeParRole,
        connexion,
        deconnexion
    }
}