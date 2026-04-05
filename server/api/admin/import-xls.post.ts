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

    function splitSmart(val: string): string[] {
        const parts: string[] = []
        let depth = 0
        let current = ''
        let i = 0

        while (i < val.length) {
            const char = val[i]
            if (char === '(') depth++
            if (char === ')') depth--

            const isCommaOutside = char === ',' && depth === 0
            const nextIsSpace = val[i + 1] === ' '
            const afterIsUpper = val[i + 2] && val[i + 2] === val[i + 2].toUpperCase() && val[i + 2] !== val[i + 2].toLowerCase()

            if (isCommaOutside && nextIsSpace && afterIsUpper) {
                const trimmed = current.trim()
                if (trimmed.length > 3) parts.push(trimmed)
                current = ''
                i += 2
                continue
            } else {
                current += char
            }
            i++
        }

        const last = current.trim()
        if (last.length > 3) parts.push(last)
        return parts
    }

    function normaliser(val: string): string {
        return val
            .replace(/Absence Irrégulière/gi, 'Absence irrégulière')
            .replace(/Exces de vitesse/gi, 'Excès de vitesse')
            .replace(/Franchissement feu tricolore ou stop/gi, "Franchissement d'un feu tricolore ou d'un STOP")
            .replace(/Non-Respect/gi, 'Non respect')
            .replace(/Non respect de la règlementation Métier/gi, 'Règlementation métier (IPMR, Métier …)')
            .replace(/Non respect de la réglementation UO \(IG505C\)/gi, 'Règlementation UO / Entreprise : IG505C')
            .replace(/Non respect de la réglementation UO \(Autre\)/gi, 'Règlementation UO / Entreprise : Autre')
            .replace(/Téléphone portable et objets connectés en situation de conduite/gi, 'Téléphone portable et objet connectés en situation de conduite')
            .trim()
    }

    function estConcatene(val: string): boolean {
        return /[a-zàâäéèêëîïôùûüç][A-ZÀÂÄÉÈÊËÎÏÔÙÛÜÇ]/.test(val)
    }

    const objetsRaw = rows
        .map(r => r['Objet'])
        .filter(Boolean)
        .map(v => String(v).trim())

    const objetsSet = new Set<string>()

    objetsRaw.forEach(val => {
        if (/^\d+$/.test(val)) return
        if (val === '0') return
        if (val.length < 4) return
        if (estConcatene(val)) return

        const parts = splitSmart(val)
        parts.forEach(p => {
            const normalized = normaliser(p)
            if (normalized.length > 3) objetsSet.add(normalized)
        })
    })

    const sourcesSet = new Set<string>()
    rows.forEach(r => {
        const source = r['Source']
        if (source && String(source).trim().length > 1) {
            const s = String(source).trim()
            if (!/^\d+$/.test(s)) sourcesSet.add(s)
        }
    })

    const typesData = Array.from(objetsSet).map((valeur, i) => ({
        valeur,
        actif: true,
        ordre: i
    }))

    const { error: errTypes } = await supabase
        .from('types_incidents')
        .upsert(typesData, { onConflict: 'valeur' })

    if (errTypes) throw createError({ statusCode: 500, message: errTypes.message })

    const sourcesData = Array.from(sourcesSet).map(valeur => ({
        valeur,
        actif: true
    }))

    const { error: errSources } = await supabase
        .from('sources_signalement')
        .upsert(sourcesData, { onConflict: 'valeur' })

    if (errSources) throw createError({ statusCode: 500, message: errSources.message })

    return {
        success: true,
        types_importes: typesData.length,
        sources_importees: sourcesData.length
    }
})