import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { vWheelStep } from './directives/vWheelStep'

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.directive('wheel-step', vWheelStep)
app.mount('#app')

declare global {
  interface Window {
    __pinia: ReturnType<typeof createPinia>
  }
}
window.__pinia = pinia
