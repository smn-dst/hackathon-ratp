export default defineEventHandler(async () => {
    try {
        const res = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=Paris&appid=${process.env.OPENWEATHER_API_KEY}&lang=fr&units=metric`
        )
        const data = await res.json()
        return {
            temp: Math.round(data.main?.temp),
            description: data.weather?.[0]?.description,
            icon: data.weather?.[0]?.icon,
            humidity: data.main?.humidity,
            wind: Math.round(data.wind?.speed * 3.6)
        }
    } catch {
        return { temp: null, description: 'Non disponible', icon: null }
    }
})