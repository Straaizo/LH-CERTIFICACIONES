import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Gauge, Zap } from 'lucide-react'

/*
  Modo liviano de animaciones.
  En iPhone con el modo de bajo consumo, iOS limita las páginas web a ~30 cuadros por segundo y ninguna web puede
  saltárselo; tampoco se puede preguntar si está activo (Safari no expone la batería). Se detecta por su efecto:
  se mide el ritmo típico entre cuadros (mediana, para que un instante de carga no confunda). A ~30 fps las hojas y
  menús usan recorridos cortos con desvanecimiento, que a ese ritmo se ven fluidos; a ~60 vuelven a lo normal.
  Se avisa al usuario solo cuando cambia de un modo al otro.
*/

const MUESTRA_MS = 600
const CADA_MS = 60_000
// Con margen entre ambos para no ir y volver por una medición dudosa
const LENTO_MS = 25 // mediana sobre 25 ms entre cuadros (bajo 40 fps) → liviano
const NORMAL_MS = 21 // mediana bajo 21 ms (sobre 48 fps) → normal

const ContextoRendimiento = createContext(false)

/** true cuando el teléfono está limitando las animaciones (por ejemplo, por el ahorro de batería). */
export function useLiviano(): boolean {
  return useContext(ContextoRendimiento)
}

/** Mediana de los intervalos entre cuadros durante MUESTRA_MS (null si la pestaña se ocultó o no hubo cuadros). */
function medir(): Promise<number | null> {
  return new Promise((resolver) => {
    const tiempos: number[] = []
    const inicio = performance.now()
    const paso = (t: number) => {
      if (document.visibilityState !== 'visible') return resolver(null)
      tiempos.push(t)
      if (t - inicio < MUESTRA_MS) requestAnimationFrame(paso)
      else {
        const intervalos = tiempos.slice(1).map((v, i) => v - tiempos[i]).sort((a, b) => a - b)
        resolver(intervalos.length >= 5 ? intervalos[Math.floor(intervalos.length / 2)] : null)
      }
    }
    requestAnimationFrame(paso)
  })
}

export function ProveedorRendimiento({ children }: { children: ReactNode }) {
  const [liviano, setLiviano] = useState(false)
  const [aviso, setAviso] = useState<'liviano' | 'normal' | null>(null)
  const actual = useRef(false)

  useEffect(() => {
    let vivo = true
    let midiendo = false
    const revisar = async () => {
      if (midiendo || document.visibilityState !== 'visible') return
      midiendo = true
      const mediana = await medir()
      midiendo = false
      if (!vivo || mediana === null) return
      const nuevo = actual.current ? mediana > NORMAL_MS : mediana > LENTO_MS
      if (nuevo === actual.current) return
      actual.current = nuevo
      setLiviano(nuevo)
      setAviso(nuevo ? 'liviano' : 'normal')
    }
    // Primera medición cuando la app ya terminó de cargar; luego cada minuto y al volver a la app
    const primera = window.setTimeout(() => void revisar(), 2500)
    const intervalo = window.setInterval(() => void revisar(), CADA_MS)
    const alVolver = () => {
      if (document.visibilityState === 'visible') window.setTimeout(() => void revisar(), 1000)
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      vivo = false
      window.clearTimeout(primera)
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [])

  // Marca en la página para las animaciones hechas con CSS (index.css)
  useEffect(() => {
    try {
      if (liviano) document.documentElement.dataset.liviano = '1'
      else delete document.documentElement.dataset.liviano
    } catch {
      /* sin acceso al documento */
    }
  }, [liviano])

  useEffect(() => {
    if (!aviso) return
    const t = window.setTimeout(() => setAviso(null), 6000)
    return () => window.clearTimeout(t)
  }, [aviso])

  return (
    <ContextoRendimiento.Provider value={liviano}>
      {children}
      {aviso && (
        <div role="status" aria-live="polite"
          className="animar-subir fixed inset-x-3 bottom-[calc(1rem+var(--alto-pestanas,0px))] z-[60] mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl sm:inset-x-auto sm:right-6">
          {aviso === 'liviano'
            ? <Gauge className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            : <Zap className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />}
          <p className="min-w-0 flex-1">
            <span className="block font-semibold">{aviso === 'liviano' ? 'Modo liviano activado' : 'Modo normal'}</span>
            <span className="block text-white/75">
              {aviso === 'liviano'
                ? 'Tu teléfono está limitando las animaciones, por ejemplo por el ahorro de batería. Ajustamos la app para que siga fluida; desactiva el modo de bajo consumo para verla completa.'
                : 'Tu teléfono volvió a su rendimiento completo: las animaciones vuelven a la normalidad.'}
            </span>
          </p>
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso"
            className="-my-1 -mr-1 min-h-9 shrink-0 rounded-lg px-2 text-white/70 hover:text-white">✕</button>
        </div>
      )}
    </ContextoRendimiento.Provider>
  )
}
