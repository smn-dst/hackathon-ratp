<script setup>
const props = defineProps({
  meteo: { type: Object, default: null },
  /** header = texte clair sur fond bleu ; panel = style carte claire */
  variant: { type: String, default: 'panel' },
  /** rail = compact type colonne manager (carte latérale) */
  size: { type: String, default: 'default' },
})

const condition = computed(() => {
  const m = props.meteo
  if (!m) return 'nuage'
  const desc = (m.description || '').toLowerCase()
  const icon = m.icon || ''
  if (desc.includes('orage')) return 'orage'
  if (desc.includes('neige') || desc.includes('snow')) return 'neige'
  if (desc.includes('pluie') || desc.includes('rain') || desc.includes('bruine')) return 'pluie'
  if (desc.includes('brume') || desc.includes('brouillard')) return 'brume'
  if (desc.includes('couvert') || desc.includes('overcast')) return 'couvert'
  if (desc.includes('nuage') || desc.includes('cloud')) return 'nuage'
  if (icon.startsWith('01')) return 'soleil'
  if (icon.startsWith('02') || icon.startsWith('03')) return 'nuage'
  if (icon.startsWith('04')) return 'couvert'
  if (icon.startsWith('09') || icon.startsWith('10')) return 'pluie'
  if (icon.startsWith('11')) return 'orage'
  if (icon.startsWith('13')) return 'neige'
  return 'nuage'
})
</script>

<template>
  <div
    v-if="meteo"
    class="mac-root"
    :class="{ 'mac-root--header': variant === 'header', 'mac-root--rail': size === 'rail' }"
  >
    <div class="mac-anim">
      <div v-if="condition === 'soleil'" class="ma-soleil ma-scene">
        <div class="ma-s-core" />
        <div class="ma-s-rays">
          <div v-for="i in 8" :key="i" class="ma-s-ray" :style="`--i:${i}`" />
        </div>
      </div>
      <div v-else-if="condition === 'nuage'" class="ma-nuage ma-scene">
        <div class="ma-mini-sun" />
        <div class="ma-cloud ma-c1" />
        <div class="ma-cloud ma-c2" />
      </div>
      <div v-else-if="condition === 'couvert'" class="ma-couvert ma-scene">
        <div class="ma-cloud-big ma-cb1" />
        <div class="ma-cloud-big ma-cb2" />
        <div class="ma-cloud-big ma-cb3" />
      </div>
      <div v-else-if="condition === 'pluie'" class="ma-pluie ma-scene">
        <div class="ma-cloud-dark" />
        <div class="ma-drops">
          <div v-for="i in 10" :key="i" class="ma-d" :style="`--i:${i}`" />
        </div>
      </div>
      <div v-else-if="condition === 'orage'" class="ma-orage ma-scene">
        <div class="ma-cloud-dark" />
        <div class="ma-eclair" />
        <div class="ma-drops">
          <div v-for="i in 10" :key="i" class="ma-d ma-fast" :style="`--i:${i}`" />
        </div>
      </div>
      <div v-else-if="condition === 'neige'" class="ma-neige ma-scene">
        <div class="ma-cloud-big ma-cb1" />
        <div class="ma-flocons">
          <div v-for="i in 8" :key="i" class="ma-fl" :style="`--i:${i}`" />
        </div>
      </div>
      <div v-else class="ma-brume ma-scene">
        <div v-for="i in 3" :key="i" class="ma-brume-l" :style="`--i:${i}`" />
      </div>
    </div>
    <div class="mac-info">
      <span class="mac-temp">{{ meteo.temp }}<sup>°C</sup></span>
      <span class="mac-desc">{{ meteo.description }}</span>
      <div class="mac-details">
        <span>{{ meteo.humidity }}% humidité</span>
        <span>{{ meteo.wind }} km/h</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mac-root {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-shrink: 0;
}

.mac-root--header .mac-info {
  color: rgba(255, 255, 255, 0.95);
}

.mac-root--header .mac-temp {
  color: #fff;
}

.mac-root--header .mac-desc {
  color: rgba(255, 255, 255, 0.88);
}

.mac-root--header .mac-details {
  color: rgba(255, 255, 255, 0.75);
}

.mac-anim {
  width: 96px;
  height: 96px;
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mac-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mac-temp {
  font-size: 34px;
  font-weight: 700;
  color: #004fa3;
  line-height: 1;
}

.mac-temp sup {
  font-size: 16px;
}

.mac-desc {
  font-size: 13px;
  color: #64748b;
  text-transform: capitalize;
}

.mac-details {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #94a3b8;
}

.ma-soleil {
  position: relative;
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ma-s-core {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #fcd34d;
  box-shadow: 0 0 16px #fcd34d;
  animation: ma-sun-pulse 2s ease-in-out infinite;
  z-index: 2;
}

.ma-s-rays {
  position: absolute;
  inset: 0;
  animation: ma-sun-rotate 8s linear infinite;
}

.ma-s-ray {
  position: absolute;
  width: 3px;
  height: 11px;
  background: #fcd34d;
  border-radius: 2px;
  top: 50%;
  left: 50%;
  transform-origin: 0 0;
  transform: rotate(calc(var(--i) * 45deg)) translateX(-50%) translateY(-28px);
  opacity: 0.85;
}

@keyframes ma-sun-pulse {
  0%,
  100% {
    box-shadow: 0 0 12px #fcd34d;
  }
  50% {
    box-shadow: 0 0 26px #f59e0b;
  }
}

@keyframes ma-sun-rotate {
  to {
    transform: rotate(360deg);
  }
}

.ma-nuage {
  position: relative;
  width: 96px;
  height: 96px;
}

.ma-mini-sun {
  position: absolute;
  top: 10px;
  right: 8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fcd34d;
  box-shadow: 0 0 10px #fcd34d;
  animation: ma-sun-pulse 2s ease-in-out infinite;
}

.ma-cloud {
  position: absolute;
  border-radius: 999px;
  background: #94a3b8;
}

.ma-c1 {
  width: 48px;
  height: 24px;
  bottom: 14px;
  left: 4px;
  animation: ma-cf 3s ease-in-out infinite;
}

.ma-c2 {
  width: 32px;
  height: 18px;
  bottom: 30px;
  left: 18px;
  animation: ma-cf 3s ease-in-out infinite 0.5s;
}

.ma-couvert {
  position: relative;
  width: 96px;
  height: 96px;
}

.ma-cloud-big {
  position: absolute;
  border-radius: 999px;
  background: #94a3b8;
}

.ma-cb1 {
  width: 56px;
  height: 26px;
  bottom: 12px;
  left: 4px;
  animation: ma-cf 4s ease-in-out infinite;
}

.ma-cb2 {
  width: 40px;
  height: 20px;
  bottom: 30px;
  left: 20px;
  animation: ma-cf 4s ease-in-out infinite 1s;
}

.ma-cb3 {
  width: 30px;
  height: 16px;
  bottom: 42px;
  left: 10px;
  animation: ma-cf 4s ease-in-out infinite 2s;
}

.ma-cloud-dark {
  position: absolute;
  border-radius: 999px;
  background: #64748b;
  width: 58px;
  height: 28px;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  animation: ma-cf-dark 4s ease-in-out infinite;
}

@keyframes ma-cf {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(4px);
  }
}

@keyframes ma-cf-dark {
  0%,
  100% {
    transform: translateX(-50%);
  }
  50% {
    transform: translateX(calc(-50% + 3px));
  }
}

.ma-pluie,
.ma-orage {
  position: relative;
  width: 96px;
  height: 96px;
  overflow: hidden;
}

.ma-drops {
  position: absolute;
  inset: 0;
  top: 36px;
}

.ma-d {
  position: absolute;
  width: 2px;
  border-radius: 2px;
  background: #60a5fa;
  opacity: 0.75;
  left: calc(var(--i) * 9px - 4px);
  height: calc(9px + var(--i) * 0.6px);
  animation: ma-rain calc(0.55s + var(--i) * 0.04s) linear infinite;
  animation-delay: calc(var(--i) * 0.07s);
}

.ma-fast {
  animation-duration: 0.28s;
}

@keyframes ma-rain {
  0% {
    transform: translateY(-10px);
    opacity: 0;
  }
  50% {
    opacity: 0.75;
  }
  100% {
    transform: translateY(52px);
    opacity: 0;
  }
}

.ma-eclair {
  position: absolute;
  top: 26px;
  left: 50%;
  width: 4px;
  height: 18px;
  margin-left: -2px;
  background: linear-gradient(180deg, #fde047, #facc15);
  border-radius: 1px;
  box-shadow: 0 0 12px #facc15;
  animation: ma-flash 2s ease-in-out infinite;
  z-index: 2;
}

@keyframes ma-flash {
  0%,
  100% {
    opacity: 0.15;
  }
  45%,
  55% {
    opacity: 1;
  }
}

.ma-neige {
  position: relative;
  width: 96px;
  height: 96px;
  overflow: hidden;
}

.ma-flocons {
  position: absolute;
  inset: 0;
  top: 32px;
}

.ma-fl {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #e0f2fe;
  left: calc(var(--i) * 11px - 6px);
  animation: ma-snow calc(1.4s + var(--i) * 0.1s) linear infinite;
  animation-delay: calc(var(--i) * 0.13s);
}

@keyframes ma-snow {
  0% {
    transform: translateY(-10px);
    opacity: 0;
  }
  50% {
    opacity: 0.85;
  }
  100% {
    transform: translateY(52px);
    opacity: 0;
  }
}

.ma-brume {
  position: relative;
  width: 96px;
  height: 96px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  padding: 8px;
}

.ma-brume-l {
  height: 4px;
  border-radius: 2px;
  background: #94a3b8;
  opacity: 0.55;
  width: calc(36px + var(--i) * 14px);
  animation: ma-fog calc(1.8s + var(--i) * 0.3s) ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.2s);
}

@keyframes ma-fog {
  0%,
  100% {
    opacity: 0.3;
    transform: translateX(0);
  }
  50% {
    opacity: 0.6;
    transform: translateX(4px);
  }
}

.mac-root--rail {
  gap: 12px;
}

.mac-root--rail .mac-anim {
  width: 70px;
  height: 70px;
}

.mac-root--rail .mac-anim .ma-scene {
  transform: scale(0.72916667);
  transform-origin: center center;
}

.mac-root--rail .mac-temp {
  font-size: 28px;
}

.mac-root--rail .mac-temp sup {
  font-size: 14px;
}

.mac-root--rail .mac-desc {
  font-size: 12px;
}

.mac-root--rail .mac-details {
  font-size: 11px;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
