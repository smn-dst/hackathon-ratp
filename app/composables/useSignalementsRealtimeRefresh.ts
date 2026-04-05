export function useSignalementsRealtimeRefresh(refresh: () => void | Promise<void>) {
  const supabase = useSupabaseClient()
  let channel: ReturnType<typeof supabase.channel> | null = null

  onMounted(() => {
    channel = supabase
      .channel(`signalements-${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'signalements' },
        () => {
          void refresh()
        }
      )
      .subscribe()
  })

  onUnmounted(() => {
    if (channel) {
      void supabase.removeChannel(channel)
      channel = null
    }
  })
}
