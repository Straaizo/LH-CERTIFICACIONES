import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react'
import { X } from 'lucide-react'

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

export const RESORTE = { type: 'spring', damping: 34, stiffness: 380, mass: 0.9 } as const

// Hojas abiertas, de la más antigua a la más nueva: Escape cierra solo la de arriba
const pila: string[] = []

/**
 * Hoja inferior (bottom sheet) como en las apps nativas: entra desde abajo, se cierra arrastrándola hacia abajo,
 * tocando el fondo o con Escape. El contenido largo se desplaza dentro de la hoja.
 */
export function Hoja({ abierta, onCerrar, titulo, subtitulo, children, pie, cerrarVisible = true }: {
  abierta: boolean
  onCerrar: () => void
  titulo?: ReactNode
  subtitulo?: ReactNode
  children: ReactNode
  /** Zona fija al final (acciones) */
  pie?: ReactNode
  cerrarVisible?: boolean
}) {
  const id = useId()
  const arrastre = useDragControls()
  const hoja = useRef<HTMLDivElement>(null)
  const foco = useRef<Element | null>(null)
  // Ref: un onCerrar nuevo en cada render no debe reiniciar la hoja (ni quitar el foco del campo que se escribe)
  const alCerrar = useRef(onCerrar)
  alCerrar.current = onCerrar

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

  const soltar = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 650) onCerrar()
  }

  return createPortal(
    <AnimatePresence>
      {abierta && (
        <div className="fixed inset-0 z-[70]" data-panel>
          <motion.div
            className="velo-hoja absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onCerrar}
          />
          {/* Entrada y salida con transform completo: motion la corre en el compositor (WAAPI), no en JS cuadro a cuadro.
              Al terminar queda sin transform: en iPhone, un transform aquí desplaza el cursor al aparecer el teclado */}
          <motion.div
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg"
            initial={{ transform: 'translateY(100%)' }}
            animate={{ transform: 'translateY(0%)', transitionEnd: { transform: 'none' } }}
            exit={{ transform: 'translateY(100%)' }}
            transition={RESORTE}
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
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
