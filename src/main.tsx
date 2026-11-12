import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import './index.css'
import { App } from './App'
import { ProveedorSesion } from './contexto/Sesion'
import { ProveedorPWA } from './pwa/PWA'
import { ProveedorRendimiento } from './rendimiento'

// Android: su GPU sufre con los desenfoques de fondo; index.css los cambia por un tono equivalente (.gpu-modesta)
if (/android/i.test(navigator.userAgent)) document.documentElement.classList.add('gpu-modesta')

// iPhone: Safari acerca la pantalla al tocar un campo con letra menor a 16 px y no vuelve a alejarla.
// Con maximum-scale no lo hace, y en iOS se sigue pudiendo acercar con dos dedos. En Android bloquearía
// ese zoom (y allá no existe el problema), por eso solo se aplica en iPhone y iPad.
if (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
  document.querySelector('meta[name="viewport"]')
    ?.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1, viewport-fit=cover')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {/* Animaciones: se reducen si el teléfono tiene activado "reducir movimiento" */}
      <MotionConfig reducedMotion="user">
        <ProveedorRendimiento>
          <ProveedorPWA>
            <ProveedorSesion>
              <App />
            </ProveedorSesion>
          </ProveedorPWA>
        </ProveedorRendimiento>
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>,
)
