import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './styles/tokens.css'
import App from './App.vue'
import { createAdminRouter } from './router'

const app = createApp(App)
const pinia = createPinia()
const router = createAdminRouter()

app.use(pinia)
app.use(router)
app.use(ElementPlus)
app.mount('#app')
