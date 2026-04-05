import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

export default defineEventHandler(async (event) => {
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!
    )

    const formData = await readMultipartFormData(event)
    if (!formData || formData.length === 0) {
        throw createError({ statusCode: 400, message: 'Aucun fichier reçu' })
    }

    const file = formData[0]
    if (!file.data) {
        throw createError({ statusCode: 400, message: 'Fichier invalide' })
    }

    const workbook = XLSX.read(file.data, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet)

    function parseGeopoint(geopoint: string) {
        try {
            const [lat, lng] = geopoint.split(',')
            return { lat: parseFloat(lat.trim()), lng: parseFloat(lng.trim()) }
        } catch {
            return null
        }
    }

    const arrets = rows
        .filter(r => r['ArRType'] === 'bus' && r['ArRGeopoint'])
        .map(r => {
            const coords = parseGeopoint(String(r['ArRGeopoint']))
            if (!coords) return null
            return {
                id: `ARR-${r['ArRId']}`,
                nom: String(r['ArRName'] || '').trim(),
                adresse: String(r['ArRTown'] || '').trim(),
                lat: coords.lat,
                lng: coords.lng,
                lignes: []
            }
        })
        .filter(Boolean)

    if (arrets.length === 0) {
        throw createError({ statusCode: 400, message: 'Aucun arrêt bus trouvé dans le fichier' })
    }

    const BATCH = 500
    let imported = 0

    for (let i = 0; i < arrets.length; i += BATCH) {
        const batch = arrets.slice(i, i + BATCH)
        const { error } = await supabase
            .from('arrets')
            .upsert(batch, { onConflict: 'id' })

        if (error) throw createError({ statusCode: 500, message: error.message })
        imported += batch.length
    }

    return {
        success: true,
        arrets_importes: imported
    }
})