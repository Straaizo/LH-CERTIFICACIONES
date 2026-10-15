import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { App } from './App'
import { ProveedorSesion } from './contexto/Sesion'
import { ProveedorPWA } from './pwa/PWA'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorPWA>
        <ProveedorSesion>
          <App />
        </ProveedorSesion>
      </ProveedorPWA>
    </BrowserRouter>
  </StrictMode>,
)
