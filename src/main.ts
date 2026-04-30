import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const pinia = createPinia()
createApp(App).use(pinia).mount('#app')

declare global {
  interface Window {
    __pinia: ReturnType<typeof createPinia>
  }
}
window.__pinia = pinia
