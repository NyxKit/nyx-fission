import { createApp } from 'vue'
import { NyxKit } from 'nyx-kit'
import 'nyx-kit/style.css'
import App from './App.vue'
import './style.scss'

createApp(App).use(NyxKit).mount('#app')
