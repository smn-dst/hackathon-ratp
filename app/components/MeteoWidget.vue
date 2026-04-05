<template>
    <div class="meteo-card">
        <div class="meteo-scene">
            <!-- SOLEIL -->
            <div v-if="condition === 'soleil'" class="scene-soleil">
                <div class="soleil-core" />
                <div class="soleil-rays">
                    <div v-for="i in 8" :key="i" class="ray" :style="`--i: ${i}`" />
                </div>
            </div>

            <!-- NUAGEUX -->
            <div v-else-if="condition === 'nuage'" class="scene-nuage">
                <div class="nuage n1" />
                <div class="nuage n2" />
                <div class="soleil-small" />
            </div>

            <!-- COUVERT -->
            <div v-else-if="condition === 'couvert'" class="scene-couvert">
                <div class="nuage-big n1" />
                <div class="nuage-big n2" />
                <div class="nuage-big n3" />
            </div>

            <!-- PLUIE -->
            <div v-else-if="condition === 'pluie'" class="scene-pluie">
                <div class="nuage-big dark" />
                <div class="pluie-drops">
                    <div v-for="i in 12" :key="i" class="drop" :style="`--i: ${i}`" />
                </div>
            </div>

            <!-- ORAGE -->
            <div v-else-if="condition === 'orage'" class="scene-orage">
                <div class="nuage-big dark" />
                <div class="eclair">⚡</div>
                <div class="pluie-drops">
                    <div v-for="i in 12" :key="i" class="drop fast" :style="`--i: ${i}`" />
                </div>
            </div>

            <!-- NEIGE -->
            <div v-else-if="condition === 'neige'" class="scene-neige">
                <div class="nuage-big" />
                <div class="flocons">
                    <div v-for="i in 10" :key="i" class="flocon" :style="`--i: ${i}`">❄</div>
                </div>
            </div>

            <!-- BRUME -->
            <div v-else class="scene-brume">
                <div class="brume-line" v-for="i in 4" :key="i" :style="`--i: ${i}`" />
            </div>
        </div>

        <div class="meteo-infos">
            <div class="meteo-temp-big">{{ temp }}°<span>C</span></div>
            <div class="meteo-desc-text">{{ description }}</div>
            <div class="meteo-details">
                <div class="detail-item">
                    <span class="detail-icon">💧</span>
                    <span class="detail-val">{{ humidity }}%</span>
                    <span class="detail-lbl">humidité</span>
                </div>
                <div class="detail-sep" />
                <div class="detail-item">
                    <span class="detail-icon">💨</span>
                    <span class="detail-val">{{ wind }}</span>
                    <span class="detail-lbl">km/h</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
    temp: Number,
    description: String,
    humidity: Number,
    wind: Number,
    icon: String
})

const condition = computed(() => {
    const desc = props.description?.toLowerCase() || ''
    const icon = props.icon || ''
    if (desc.includes('orage') || desc.includes('thunder')) return 'orage'
    if (desc.includes('neige') || desc.includes('snow')) return 'neige'
    if (desc.includes('pluie') || desc.includes('rain') || desc.includes('bruine')) return 'pluie'
    if (desc.includes('brume') || desc.includes('brouillard') || desc.includes('fog') || desc.includes('mist')) return 'brume'
    if (desc.includes('couvert') || desc.includes('overcast')) return 'couvert'
    if (desc.includes('nuage') || desc.includes('cloud') || desc.includes('partiellement')) return 'nuage'
    if (icon.startsWith('01')) return 'soleil'
    if (icon.startsWith('02') || icon.startsWith('03')) return 'nuage'
    if (icon.startsWith('04')) return 'couvert'
    if (icon.startsWith('09') || icon.startsWith('10')) return 'pluie'
    if (icon.startsWith('11')) return 'orage'
    if (icon.startsWith('13')) return 'neige'
    if (icon.startsWith('50')) return 'brume'
    return 'nuage'
})
</script>

<style scoped>
.meteo-card {
    background: linear-gradient(135deg, #0f1e2d 0%, #1a2a3a 100%);
    border: 1px solid #2d3748;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 220px;
}

.meteo-scene {
    width: 70px;
    height: 70px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

/* SOLEIL */
.scene-soleil {
    position: relative;
    width: 70px;
    height: 70px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.soleil-core {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #FCD34D;
    box-shadow: 0 0 16px #FCD34D;
    animation: pulse-sun 2s ease-in-out infinite;
    position: relative;
    z-index: 2;
}

.soleil-rays {
    position: absolute;
    inset: 0;
    animation: rotate-sun 8s linear infinite;
}

.ray {
    position: absolute;
    width: 3px;
    height: 10px;
    background: #FCD34D;
    border-radius: 2px;
    top: 50%;
    left: 50%;
    transform-origin: 0 0;
    transform: rotate(calc(var(--i) * 45deg)) translateX(-50%) translateY(-22px);
    opacity: 0.7;
}

@keyframes pulse-sun {

    0%,
    100% {
        box-shadow: 0 0 12px #FCD34D
    }

    50% {
        box-shadow: 0 0 24px #F59E0B
    }
}

@keyframes rotate-sun {
    to {
        transform: rotate(360deg)
    }
}

/* NUAGE */
.scene-nuage {
    position: relative;
    width: 70px;
    height: 70px;
}

.soleil-small {
    position: absolute;
    top: 10px;
    right: 8px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #FCD34D;
    box-shadow: 0 0 10px #FCD34D;
    animation: pulse-sun 2s ease-in-out infinite;
}

.nuage {
    position: absolute;
    border-radius: 999px;
    background: #cbd5e0;
}

.nuage.n1 {
    width: 40px;
    height: 22px;
    bottom: 14px;
    left: 4px;
    animation: float-cloud 3s ease-in-out infinite;
}

.nuage.n2 {
    width: 28px;
    height: 16px;
    bottom: 24px;
    left: 16px;
    animation: float-cloud 3s ease-in-out infinite 0.5s;
}

/* COUVERT */
.scene-couvert {
    position: relative;
    width: 70px;
    height: 70px;
}

.nuage-big {
    position: absolute;
    border-radius: 999px;
    background: #718096;
}

.nuage-big.n1 {
    width: 48px;
    height: 24px;
    bottom: 16px;
    left: 2px;
    animation: float-cloud 4s ease-in-out infinite;
}

.nuage-big.n2 {
    width: 36px;
    height: 18px;
    bottom: 26px;
    left: 18px;
    animation: float-cloud 4s ease-in-out infinite 1s;
}

.nuage-big.n3 {
    width: 30px;
    height: 16px;
    bottom: 32px;
    left: 8px;
    animation: float-cloud 4s ease-in-out infinite 2s;
}

.nuage-big.dark {
    background: #4a5568;
    width: 54px;
    height: 26px;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    animation: float-cloud 4s ease-in-out infinite;
}

@keyframes float-cloud {

    0%,
    100% {
        transform: translateX(0)
    }

    50% {
        transform: translateX(4px)
    }
}

/* PLUIE */
.scene-pluie {
    position: relative;
    width: 70px;
    height: 70px;
    overflow: hidden;
}

.pluie-drops {
    position: absolute;
    inset: 0;
    top: 30px;
}

.drop {
    position: absolute;
    width: 1.5px;
    border-radius: 2px;
    background: #63b3ed;
    opacity: 0.7;
    left: calc(var(--i) * 6px - 2px);
    height: calc(8px + var(--i) * 1px);
    animation: tomber calc(0.6s + var(--i) * 0.05s) linear infinite;
    animation-delay: calc(var(--i) * 0.08s);
}

.drop.fast {
    animation-duration: 0.3s;
}

@keyframes tomber {
    0% {
        transform: translateY(-10px);
        opacity: 0
    }

    50% {
        opacity: 0.7
    }

    100% {
        transform: translateY(40px);
        opacity: 0
    }
}

/* ORAGE */
.scene-orage {
    position: relative;
    width: 70px;
    height: 70px;
    overflow: hidden;
}

.eclair {
    position: absolute;
    top: 26px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 18px;
    z-index: 2;
    animation: flash 2s ease-in-out infinite;
}

@keyframes flash {

    0%,
    100% {
        opacity: 0.3
    }

    50% {
        opacity: 1
    }
}

/* NEIGE */
.scene-neige {
    position: relative;
    width: 70px;
    height: 70px;
    overflow: hidden;
}

.flocons {
    position: absolute;
    inset: 0;
    top: 26px;
}

.flocon {
    position: absolute;
    font-size: 10px;
    color: #bee3f8;
    opacity: 0.8;
    left: calc(var(--i) * 7px - 4px);
    animation: neiger calc(1.5s + var(--i) * 0.1s) linear infinite;
    animation-delay: calc(var(--i) * 0.15s);
}

@keyframes neiger {
    0% {
        transform: translateY(-10px) rotate(0deg);
        opacity: 0
    }

    50% {
        opacity: 0.8
    }

    100% {
        transform: translateY(40px) rotate(180deg);
        opacity: 0
    }
}

/* BRUME */
.scene-brume {
    position: relative;
    width: 70px;
    height: 70px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    padding: 8px;
}

.brume-line {
    height: 3px;
    border-radius: 2px;
    background: #718096;
    opacity: 0.5;
    width: calc(40px + var(--i) * 6px);
    animation: brume-anim calc(2s + var(--i) * 0.3s) ease-in-out infinite;
    animation-delay: calc(var(--i) * 0.2s);
}

@keyframes brume-anim {

    0%,
    100% {
        opacity: 0.3;
        transform: translateX(0)
    }

    50% {
        opacity: 0.6;
        transform: translateX(4px)
    }
}

/* INFOS */
.meteo-infos {
    flex: 1;
}

.meteo-temp-big {
    font-size: 32px;
    font-weight: 700;
    color: #fff;
    line-height: 1;
}

.meteo-temp-big span {
    font-size: 18px;
    color: #a0aec0;
}

.meteo-desc-text {
    font-size: 12px;
    color: #718096;
    text-transform: capitalize;
    margin: 4px 0 10px;
}

.meteo-details {
    display: flex;
    align-items: center;
    gap: 10px;
}

.detail-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
}

.detail-icon {
    font-size: 14px;
}

.detail-val {
    font-size: 13px;
    font-weight: 600;
    color: #e2e8f0;
}

.detail-lbl {
    font-size: 10px;
    color: #4a5568;
}

.detail-sep {
    width: 1px;
    height: 30px;
    background: #2d3748;
}
</style>