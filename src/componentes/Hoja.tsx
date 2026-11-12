import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, useDragControls, type PanInfo } from 'motion/react'
import { X } from 'lucide-react'
import { useLiviano } from '../rendimiento'

/** true en pantallas chicas (por defecto, bajo 1024 px: donde la app usa la navegación de celular). */
export function useEsMovil(consulta = '(max-width: 1023px)'): boolean {
  const [movil, setMovil] = useState(() => window.matchMedia(consulta).matches)
  useEffect(() => {
    const m = window.matchMedia(consulta)
    const cambio = () => setMovil(m.matches)
    m.addEventListener('change', cambio)
    return () => m.removeEventListener('change', cambio)
  }, [consulta])
  return movil
}

// Firme y corto: la hoja llega en ~0,3 s sin rebote perceptible
export const RESORTE = { type: 'spring', damping: 38, stiffness: 520, mass: 0.8 } as const
// Modo liviano (rendimiento.tsx): corto y sin resorte
export const LIVIANO = { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] } as const

// Hojas abiertas, de la más antigua a la más nueva: Escape cierra solo la de arriba
const pila: string[] = []

/** Ejecuta fn cuando el navegador esté desocupado (Safari no tiene requestIdleCallback: espera un momento). */
function cuandoDesocupado(fn: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(fn, { timeout: 2000 })
    return () => window.cancelIdleCallback(id)
  }
  const t = setTimeout(fn, 600)
  return () => clearTimeout(t)
}

/**
 * Hoja inferior (bottom sheet) como en las apps nativas: entra desde abajo, se cierra arrastrándola hacia abajo,
 * tocando el fondo o con Escape. El contenido largo se desplaza dentro de la hoja.
 *
 * Rendimiento (iPhone): la hoja no se crea al abrirla. Se crea cerrada (al primer uso, o antes con `premontar`) y
 * queda creada; abrir solo cambia el destino de la animación. Antes, armar la hoja en el mismo instante bloqueaba
 * el primer cuadro: la animación ya había avanzado cuando por fin se dibujaba y la hoja aparecía a media pantalla.
 */
export function Hoja({ abierta, onCerrar, titulo, subtitulo, children, pie, cerrarVisible = true, premontar = false }: {
  abierta: boolean
  onCerrar: () => void
  titulo?: ReactNode
  subtitulo?: ReactNode
  children: ReactNode
  /** Zona fija al final (acciones) */
  pie?: ReactNode
  cerrarVisible?: boolean
  /** Crearla cerrada apenas el navegador esté desocupado, para que incluso la primera apertura sea inmediata */
  premontar?: boolean
}) {
  const id = useId()
  const arrastre = useDragControls()
  const hoja = useRef<HTMLDivElement>(null)
  const foco = useRef<Element | null>(null)
  // Ref: un onCerrar nuevo en cada render no debe reiniciar la hoja (ni quitar el foco del campo que se escribe)
  const alCerrar = useRef(onCerrar)
  alCerrar.current = onCerrar

  // creada: existe en la página · lista: ya se dibujó cerrada (se puede animar sin salto) · oculta: no se ve
  const [creada, setCreada] = useState(abierta)
  const [lista, setLista] = useState(false)
  const [oculta, setOculta] = useState(true)
  const [animando, setAnimando] = useState(false)
  // Teléfono limitado a ~30 fps (ahorro de batería): recorrido corto con desvanecimiento, que a ese ritmo se ve fluido
  const liviano = useLiviano()

  // Destino de la animación, calculado en el mismo render en que se pide abrir: sin vueltas extra de React
  const visible = abierta && lista
  if (visible && oculta) setOculta(false)

  // Recién creada: queda lista cuando el navegador ya la dibujó cerrada (dos cuadros)
  useEffect(() => {
    if (!creada) {
      setLista(false)
      return
    }
    let segundo = 0
    const primero = requestAnimationFrame(() => {
      segundo = requestAnimationFrame(() => setLista(true))
    })
    return () => {
      cancelAnimationFrame(primero)
      cancelAnimationFrame(segundo)
    }
  }, [creada])

  // Premontar: se crea cerrada cuando el navegador está desocupado
  useEffect(() => {
    if (!premontar || creada) return
    return cuandoDesocupado(() => setCreada(true))
  }, [premontar, creada])

  // Primer uso sin premontar: se crea al pedirla. Y cerrada y oculta, se borra como antes (las listas no guardan
  // lo escrito); las premontadas quedan creadas
  useEffect(() => {
    if (abierta && !creada) setCreada(true)
    else if (!abierta && oculta && creada && !premontar) setCreada(false)
  }, [abierta, oculta, creada, premontar])

  useEffect(() => {
    if (!abierta) return
    foco.current = document.activeElement
    pila.push(id)
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pila[pila.length - 1] === id) alCerrar.current()
    }
    window.addEventListener('keydown', tecla)
    // Si el contenido ya tomó el foco (por ejemplo, una lista de opciones), no se le quita
    const t = window.setTimeout(() => {
      if (!hoja.current?.contains(document.activeElement)) hoja.current?.focus({ preventScroll: true })
    }, 30)
    return () => {
      window.removeEventListener('keydown', tecla)
      window.clearTimeout(t)
      pila.splice(pila.indexOf(id), 1)
      if (foco.current instanceof HTMLElement) foco.current.focus({ preventScroll: true })
    }
  }, [abierta, id])

  // Terminó de cerrarse: se oculta; si no se premonta, se borra como antes (las listas no guardan lo escrito)
  const alTerminar = () => {
    setAnimando(false)
    if (!visible) setOculta(true)
  }

  const soltar = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 650) onCerrar()
  }

  if (!creada) return null

  return createPortal(
    // Cerrada: queda en la página pero invisible, sin recibir toques ni foco (inert) y oculta a lectores de pantalla
    <div className="fixed inset-0 z-[70]" data-panel inert={!abierta} aria-hidden={!abierta}
      style={{ pointerEvents: abierta ? undefined : 'none', visibility: oculta ? 'hidden' : 'visible' }}>
      <motion.div
        className="velo-hoja absolute inset-0 touch-none bg-slate-950/50"
        initial={false}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.22 }}
        onClick={onCerrar}
      />
      {/* Entrada y salida con transform completo: motion la corre en el compositor (WAAPI), no en JS cuadro a cuadro.
          Al terminar de abrir queda sin transform: en iPhone, un transform aquí desplaza el cursor al aparecer el
          teclado. will-change solo mientras se mueve */}
      <motion.div
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg"
        initial={false}
        style={{ willChange: animando ? 'transform' : 'auto' }}
        animate={visible
          ? { transform: liviano ? 'translateY(0px)' : 'translateY(0%)', opacity: 1, transitionEnd: { transform: 'none' } }
          : liviano ? { transform: 'translateY(24px)', opacity: 0 } : { transform: 'translateY(100%)', opacity: 1 }}
        transition={liviano ? LIVIANO : RESORTE}
        onAnimationStart={() => setAnimando(true)}
        onAnimationComplete={alTerminar}
      >
      <motion.div
        ref={hoja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titulo ? id : undefined}
        tabIndex={-1}
        className="flex max-h-[88dvh] w-full flex-col rounded-t-[28px] bg-superficie shadow-[0_-12px_48px_-12px_rgba(12,17,11,0.35)] outline-none"
        drag="y"
        dragListener={false}
        dragControls={arrastre}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.7 }}
        onDragEnd={soltar}
      >
        {/* Asa y encabezado: desde aquí se arrastra para cerrar */}
        <div
          className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={(e) => arrastre.start(e)}
        >
          <div className="flex justify-center pb-1 pt-2.5">
            <span className="h-1.5 w-10 rounded-full bg-slate-300" />
          </div>
          {(titulo || cerrarVisible) && (
            <div className="flex items-start gap-3 px-5 pb-3 pt-1">
              <div className="min-w-0 flex-1">
                {titulo && <h2 id={id} className="text-[19px] font-bold leading-tight tracking-tight text-slate-950">{titulo}</h2>}
                {subtitulo && <p className="mt-0.5 text-sm text-slate-500">{subtitulo}</p>}
              </div>
              {cerrarVisible && (
                <button
                  type="button"
                  onClick={onCerrar}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="Cerrar"
                  className="-mr-2 -mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 active:bg-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 ${pie ? 'pb-3' : 'pb-[max(1rem,env(safe-area-inset-bottom))]'}`}>
          {children}
        </div>
        {pie && (
          <div className="shrink-0 border-t border-slate-200/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{pie}</div>
        )}
      </motion.div>
      </motion.div>
    </div>,
    document.body,
  )
}
