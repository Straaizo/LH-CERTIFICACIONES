import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlertTriangle, ArrowDown, CheckCircle2, ClipboardCheck, Download, FileText, FlaskConical, LayoutDashboard, Menu, PlusSquare,
  RefreshCw, Share, Smartphone, Sparkles, Wifi, WifiOff, X, Zap, type LucideIcon,
} from 'lucide-react'
import { FondoOrganico } from '../componentes/Escena'
import { Boton } from '../componentes/ui'

const CLAVE_SIMULADA = 'certificaciones.vistaApp'
const CLAVE_DESCARTE = 'certificaciones.pwa.descartado'
const CLAVE_VERSION = 'certificaciones.pwa.version'
/** Estirar para recargar sin versión nueva: Layout vuelve a montar la pantalla y esta pide sus datos de nuevo. */
export const EVENTO_REFRESCAR = 'certificaciones:refrescar'
const DIAS_SIN_INSISTIR = 14

/** Evento que Chrome y Edge entregan cuando la aplicación se puede instalar. */
interface EventoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface EstadoPWA {
  /** La interfaz se muestra como aplicación instalada (instalada de verdad o simulada en la demo) */
  modoApp: boolean
  instalada: boolean
  simulada: boolean
  setSimulada: (v: boolean) => void
  /** El navegador ofrece su diálogo de instalación */
  puedeInstalar: boolean
  /** iPhone o iPad: no hay diálogo, se instala desde Compartir → Agregar a inicio */
  esIOS: boolean
  instalar: () => Promise<boolean>
  enLinea: boolean
  /** Abre la guía de instalación (diálogo del navegador o pasos en iPhone) */
  pedirInstalacion: () => void
  guiaAbierta: boolean
  cerrarGuia: () => void
  /** Versión de este build (fecha ISO) */
  version: string
  /** Hay una versión más nueva publicada */
  hayActualizacion: boolean
  /** Revisa si hay versión nueva; devuelve true si la hay */
  buscarActualizacion: () => Promise<boolean>
  /** Activa la versión nueva y recarga la aplicación */
  actualizar: () => void
}

const CADA_CUANTO = 15 * 60_000

const ContextoPWA = createContext<EstadoPWA | null>(null)

export function usePWA(): EstadoPWA {
  const ctx = useContext(ContextoPWA)
  if (!ctx) throw new Error('usePWA fuera de ProveedorPWA')
  return ctx
}

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function guardar(clave: string, valor: string | null): void {
  try {
    if (valor === null) localStorage.removeItem(clave)
    else localStorage.setItem(clave, valor)
  } catch {
    /* almacenamiento no disponible */
  }
}

function estaInstalada(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** ?modo=app activa la vista de app instalada en el navegador (para presentarla); ?modo=web la apaga. */
function simuladaInicial(): boolean {
  const pedido = new URLSearchParams(window.location.search).get('modo')
  if (pedido === 'app') guardar(CLAVE_SIMULADA, '1')
  if (pedido === 'web') guardar(CLAVE_SIMULADA, null)
  return leer(CLAVE_SIMULADA) === '1'
}

export function ProveedorPWA({ children }: { children: ReactNode }) {
  const [instalada, setInstalada] = useState(estaInstalada)
  const [simulada, setSimuladaEstado] = useState(simuladaInicial)
  const [evento, setEvento] = useState<EventoInstalar | null>(null)
  const [enLinea, setEnLinea] = useState(() => navigator.onLine)
  const [guiaAbierta, setGuiaAbierta] = useState(false)
  const [hayActualizacion, setHayActualizacion] = useState(false)
  const registro = useRef<ServiceWorkerRegistration | null>(null)
  const esIOS = useMemo(
    () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    [],
  )
  const modoApp = instalada || simulada

  useEffect(() => {
    // Solo en producción: en desarrollo la caché del service worker escondería los cambios
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((r) => { registro.current = r }).catch(() => undefined)
    }
    const medio = window.matchMedia('(display-mode: standalone)')
    const alCambiarModo = () => setInstalada(estaInstalada())
    const alOfrecer = (e: Event) => {
      e.preventDefault()
      setEvento(e as EventoInstalar)
    }
    const alInstalar = () => {
      setEvento(null)
      setInstalada(estaInstalada())
    }
    const conectado = () => setEnLinea(true)
    const desconectado = () => setEnLinea(false)
    medio.addEventListener('change', alCambiarModo)
    window.addEventListener('beforeinstallprompt', alOfrecer)
    window.addEventListener('appinstalled', alInstalar)
    window.addEventListener('online', conectado)
    window.addEventListener('offline', desconectado)
    return () => {
      medio.removeEventListener('change', alCambiarModo)
      window.removeEventListener('beforeinstallprompt', alOfrecer)
      window.removeEventListener('appinstalled', alInstalar)
      window.removeEventListener('online', conectado)
      window.removeEventListener('offline', desconectado)
    }
  }, [])

  // En modo app: sin rebote al estirar, sin destello al tocar y sin selección accidental en las barras
  useEffect(() => {
    document.documentElement.classList.toggle('modo-app', modoApp)
  }, [modoApp])

  const setSimulada = useCallback((v: boolean) => {
    guardar(CLAVE_SIMULADA, v ? '1' : null)
    setSimuladaEstado(v)
  }, [])

  const instalar = useCallback(async () => {
    if (!evento) return false
    await evento.prompt()
    const { outcome } = await evento.userChoice
    setEvento(null)
    return outcome === 'accepted'
  }, [evento])

  // Versión nueva: se compara la de este build con /version.json (sin caché), que cambia en cada despliegue
  const buscarActualizacion = useCallback(async () => {
    if (!import.meta.env.PROD) return false
    try {
      const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
      const { version } = (await r.json()) as { version: string }
      const nueva = !!version && version !== __VERSION_APP__
      setHayActualizacion(nueva)
      if (nueva) void registro.current?.update()
      return nueva
    } catch {
      return false
    }
  }, [])

  const actualizar = useCallback(() => {
    const r = registro.current
    const recargar = () => window.location.reload()
    if (r?.waiting) {
      navigator.serviceWorker.addEventListener('controllerchange', recargar, { once: true })
      r.waiting.postMessage('activar')
      setTimeout(recargar, 1500)
    } else {
      void (r ? r.update().catch(() => undefined) : Promise.resolve()).finally(recargar)
    }
  }, [])

  // Se revisa al abrir, al volver a la app (desde segundo plano), al recuperar la señal y cada 15 minutos
  useEffect(() => {
    if (!import.meta.env.PROD) return
    void buscarActualizacion()
    const alVolver = () => { if (document.visibilityState === 'visible') void buscarActualizacion() }
    const intervalo = setInterval(() => void buscarActualizacion(), CADA_CUANTO)
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('online', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('online', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [buscarActualizacion])

  const pedirInstalacion = useCallback(() => {
    if (evento) void instalar()
    else setGuiaAbierta(true)
  }, [evento, instalar])

  const valor: EstadoPWA = {
    modoApp, instalada, simulada, setSimulada, puedeInstalar: !!evento, esIOS, instalar, enLinea,
    pedirInstalacion, guiaAbierta, cerrarGuia: () => setGuiaAbierta(false),
    version: __VERSION_APP__, hayActualizacion, buscarActualizacion, actualizar,
  }
  return (
    <ContextoPWA.Provider value={valor}>
      {children}
      <SoloVertical />
    </ContextoPWA.Provider>
  )
}

// ---------- Celulares y tablets solo en vertical ----------

/** Celular o tablet: pantalla táctil sin mouse. En el computador se usa en cualquier orientación. */
const esTactil = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches

/** Orientación del equipo (no de la ventana: con el teclado abierto la ventana queda más ancha que alta). */
function estaHorizontal(): boolean {
  // Android intercambia ancho y alto de la pantalla al girar (el teclado no los cambia); iPhone y iPad no, ahí basta el tipo
  const esIOS = /iphone|ipod|ipad/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (screen.orientation?.type) return screen.orientation.type.startsWith('landscape') && (esIOS || screen.width > screen.height)
  const grados = Number((window as Window & { orientation?: number }).orientation ?? 0)
  return Math.abs(grados) === 90
}

/**
 * En celulares y tablets la aplicación se usa en vertical. Android (app instalada) bloquea el giro; iPhone, iPad y los
 * navegadores no lo permiten, así que si el equipo se gira se pide volver a ponerlo vertical.
 */
function SoloVertical() {
  const [horizontal, setHorizontal] = useState(false)
  useEffect(() => {
    if (!esTactil()) return
    try {
      const bloqueo = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
      bloqueo?.lock?.('portrait').catch(() => undefined)
    } catch {
      /* sin soporte para fijar la orientación */
    }
    const revisar = () => setHorizontal(estaHorizontal())
    revisar()
    screen.orientation?.addEventListener('change', revisar)
    window.addEventListener('orientationchange', revisar)
    return () => {
      screen.orientation?.removeEventListener('change', revisar)
      window.removeEventListener('orientationchange', revisar)
    }
  }, [])
  if (!horizontal) return null
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="titulo-vertical"
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden px-[max(1.5rem,env(safe-area-inset-left))] text-center text-white">
      <FondoOrganico />
      <div className="relative max-w-sm">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
          <Smartphone className="h-8 w-8 animate-[girar-vertical_2.4s_ease-in-out_infinite] motion-reduce:animate-none" strokeWidth={1.8} />
        </span>
        <h2 id="titulo-vertical" className="mt-4 text-2xl font-bold tracking-[-0.02em]">Gira tu equipo</h2>
        <p className="mt-1.5 text-[15px] text-white/85">Certificaciones se usa en modo vertical.</p>
      </div>
    </div>
  )
}

// ---------- Invitación a instalar ----------

const BENEFICIOS: { icono: LucideIcon; texto: string }[] = [
  { icono: Smartphone, texto: 'Se abre desde tu pantalla de inicio, a pantalla completa' },
  { icono: Zap, texto: 'Carga más rápido, también en terreno' },
  { icono: WifiOff, texto: 'Abre sin señal; para guardar cambios necesita conexión' },
]

function descartadaHacePoco(): boolean {
  const cuando = Number(leer(CLAVE_DESCARTE))
  return !!cuando && Date.now() - cuando < DIAS_SIN_INSISTIR * 86_400_000
}

function IconoApp({ tam = 'h-14 w-14' }: { tam?: string }) {
  return (
    <span className={`flex ${tam} shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200`}>
      <img src="/icons/icon-192.png" alt="" className="h-full w-full object-contain" />
    </span>
  )
}

/** Pasos en iPhone y iPad, donde el navegador no tiene botón de instalar. */
function PasosIOS() {
  const pasos: { icono: LucideIcon; texto: ReactNode }[] = [
    { icono: Share, texto: <>Toca <strong>Compartir</strong> en la barra del navegador</> },
    { icono: PlusSquare, texto: <>Elige <strong>Agregar a inicio</strong></> },
    { icono: CheckCircle2, texto: <>Confirma con <strong>Agregar</strong></> },
  ]
  return (
    <ol className="space-y-2">
      {pasos.map(({ icono: Icono, texto }, i) => (
        <li key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-emerald-700 ring-1 ring-slate-200">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1">{texto}</span>
          <Icono className="h-5 w-5 shrink-0 text-slate-500" />
        </li>
      ))}
    </ol>
  )
}

/**
 * Invitación discreta a instalar: aparece sola una vez (y no vuelve por 14 días si se descarta),
 * o cuando el usuario la pide desde su menú. En iPhone muestra los pasos.
 */
export function AvisoInstalar() {
  const { instalada, simulada, puedeInstalar, esIOS, instalar, guiaAbierta, cerrarGuia } = usePWA()
  const [automatico, setAutomatico] = useState(false)
  const [instaladaRecien, setInstaladaRecien] = useState(false)
  const disponible = !instalada && !simulada && (puedeInstalar || esIOS)

  useEffect(() => {
    if (!disponible || descartadaHacePoco()) return
    const t = setTimeout(() => setAutomatico(true), 4000)
    return () => clearTimeout(t)
  }, [disponible])

  useEffect(() => {
    if (!instaladaRecien) return
    const t = setTimeout(() => setInstaladaRecien(false), 3500)
    return () => clearTimeout(t)
  }, [instaladaRecien])

  const cerrar = (recordar: boolean) => {
    if (recordar) guardar(CLAVE_DESCARTE, String(Date.now()))
    setAutomatico(false)
    cerrarGuia()
  }

  if (instaladaRecien) {
    return (
      <div role="status" className="animar-subir fixed inset-x-4 bottom-[calc(1rem+var(--alto-pestanas,0px))] z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" /> Aplicación instalada. Ábrela desde tu pantalla de inicio.
      </div>
    )
  }
  if (!(automatico || guiaAbierta) || instalada) return null

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="titulo-instalar"
      className="animar-subir fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-5 text-slate-800 shadow-[0_24px_60px_-12px_rgba(16,40,16,0.35)] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[400px]"
    >
      <div className="flex items-start gap-4">
        <IconoApp />
        <div className="min-w-0 flex-1">
          <h2 id="titulo-instalar" className="text-[17px] font-bold tracking-tight text-slate-900">Instala Portal Certificaciones</h2>
          <p className="mt-0.5 text-sm text-slate-600">Úsala como una aplicación más de tu celular o computador.</p>
        </div>
        <button type="button" onClick={() => cerrar(true)} aria-label="Cerrar" className="-mr-2 -mt-2 rounded-xl p-2 text-slate-500 hover:bg-slate-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      {esIOS && !puedeInstalar ? (
        <div className="mt-4">
          <PasosIOS />
          <Boton variante="secundario" className="mt-4 w-full" onClick={() => cerrar(true)}>Entendido</Boton>
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-2.5">
            {BENEFICIOS.map(({ icono: Icono, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-sm text-slate-700">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Icono className="h-4 w-4" />
                </span>
                {texto}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
            <Boton variante="secundario" className="sm:flex-1" onClick={() => cerrar(true)}>Ahora no</Boton>
            <Boton
              className="sm:flex-1"
              icono={<Download className="h-4 w-4" />}
              onClick={() => void instalar().then((ok) => { cerrar(false); if (ok) setInstaladaRecien(true) })}
            >
              Instalar
            </Boton>
          </div>
        </>
      )}
    </section>
  )
}

// ---------- Conexión ----------

/** Aviso fino bajo el encabezado cuando se pierde la señal, y uno breve cuando vuelve. */
export function BarraConexion() {
  const { enLinea } = usePWA()
  const [volvio, setVolvio] = useState(false)
  const anterior = useRef(enLinea)

  useEffect(() => {
    if (enLinea && !anterior.current) {
      setVolvio(true)
      const t = setTimeout(() => setVolvio(false), 3000)
      anterior.current = enLinea
      return () => clearTimeout(t)
    }
    anterior.current = enLinea
  }, [enLinea])

  if (enLinea && !volvio) return null
  return (
    <div
      role="status"
      className={`flex shrink-0 items-center justify-center gap-2 px-4 py-2 text-center text-[13px] font-medium ${
        enLinea ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
      }`}
    >
      {enLinea ? <Wifi className="h-4 w-4 shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
      {enLinea ? 'Conexión restablecida' : 'Sin conexión: puedes revisar lo que ya abriste, pero los cambios no se guardarán hasta que vuelva la señal.'}
    </div>
  )
}

// ---------- Actualización ----------

/** "1 de nov. 2026, 11:42" a partir de la versión (fecha ISO del build). */
export function textoVersion(version: string): string {
  const fecha = new Date(version)
  if (Number.isNaN(fecha.getTime())) return 'desarrollo'
  return fecha.toLocaleString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Aviso flotante cuando hay una versión nueva publicada. */
export function AvisoActualizacion({ sobrePestanas = false }: { sobrePestanas?: boolean }) {
  const { hayActualizacion, actualizar, version } = usePWA()
  const [despues, setDespues] = useState(false)
  const [actualizando, setActualizando] = useState(false)
  // iPhone suele cerrar la app en segundo plano: al abrirla de nuevo ya carga la versión nueva sin pasar por el aviso.
  // Se avisa igual que quedó actualizada, comparando con la última versión que abrió este teléfono.
  const [recienActualizada, setRecienActualizada] = useState(false)
  useEffect(() => {
    if (!import.meta.env.PROD) return
    const anterior = leer(CLAVE_VERSION)
    guardar(CLAVE_VERSION, version)
    if (!anterior || anterior === version) return
    setRecienActualizada(true)
    const t = setTimeout(() => setRecienActualizada(false), 4000)
    return () => clearTimeout(t)
  }, [version])
  const abajo = sobrePestanas ? 'bottom-[calc(76px+env(safe-area-inset-bottom))]' : 'bottom-[max(1rem,env(safe-area-inset-bottom))]'
  return (
    <AnimatePresence>
      {recienActualizada && !hayActualizacion && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className={`fixed inset-x-3 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl sm:inset-x-auto sm:right-6 ${abajo}`}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
          <p className="min-w-0">
            <span className="block font-semibold">Aplicación actualizada</span>
            <span className="block text-white/70">Versión del {textoVersion(version)}</span>
          </p>
        </motion.div>
      )}
      {hayActualizacion && !despues && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className={`fixed inset-x-3 z-[60] mx-auto flex max-w-md flex-col gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-2xl sm:inset-x-auto sm:right-6 sm:flex-row sm:items-center ${abajo}`}
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <p className="min-w-0 text-sm">
              <span className="block font-semibold">Hay una versión nueva</span>
              <span className="block text-white/70">Actualiza para ver los últimos cambios.</span>
            </p>
          </div>
          <div className="flex shrink-0 justify-end gap-2">
          <button type="button" onClick={() => setDespues(true)} className="min-h-10 rounded-lg px-2 text-sm text-white/70 hover:text-white">
            Después
          </button>
          <button type="button" disabled={actualizando} onClick={() => { setActualizando(true); actualizar() }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-70">
            <RefreshCw className={`h-4 w-4 ${actualizando ? 'animate-spin' : ''}`} /> Actualizar
          </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Estirar hacia abajo para recargar (app instalada): sin barra del navegador no hay botón de recargar.
 * Solo arriba de la página y fuera de hojas y diálogos; al soltar pasado el umbral, busca la versión nueva y recarga.
 */
export function TirarParaRecargar() {
  const { actualizar, buscarActualizacion } = usePWA()
  const [distancia, setDistancia] = useState(0)
  const [recargando, setRecargando] = useState(false)
  const inicio = useRef<number | null>(null)
  const ultima = useRef(0)
  const UMBRAL = 80

  // Con versión nueva se recarga la app para instalarla. Si no, solo se vuelven a pedir los datos de la pantalla:
  // en el iPhone, recargar la página completa dentro de la app instalada deja una franja vacía bajo las pestañas.
  const refrescar = useCallback(async () => {
    setRecargando(true)
    if (await buscarActualizacion()) {
      actualizar()
      return
    }
    window.dispatchEvent(new Event(EVENTO_REFRESCAR))
    setTimeout(() => {
      setRecargando(false)
      setDistancia(0)
    }, 700)
  }, [actualizar, buscarActualizacion])

  useEffect(() => {
    // El contenido se desplaza dentro de .scroll-principal (Layout), no en la ventana
    const arriba = () => (document.querySelector('.scroll-principal')?.scrollTop ?? window.scrollY) <= 0
    const alTocar = (e: TouchEvent) => {
      const objetivo = e.target as Element | null
      const enCapa = objetivo?.closest('[role="dialog"], [data-hoja], [data-panel], input, textarea, select')
      inicio.current = arriba() && !enCapa && e.touches.length === 1 ? e.touches[0].clientY : null
    }
    const alMover = (e: TouchEvent) => {
      if (inicio.current === null) return
      const d = e.touches[0].clientY - inicio.current
      ultima.current = d <= 0 || !arriba() ? 0 : Math.min(140, d * 0.5)
      setDistancia(ultima.current)
    }
    const alSoltar = () => {
      if (inicio.current === null) return
      inicio.current = null
      if (ultima.current >= UMBRAL) {
        setDistancia(UMBRAL)
        void refrescar()
      } else setDistancia(0)
      ultima.current = 0
    }
    window.addEventListener('touchstart', alTocar, { passive: true })
    window.addEventListener('touchmove', alMover, { passive: true })
    // Pasivos: Safari no espera al JS para empezar a desplazar
    window.addEventListener('touchend', alSoltar, { passive: true })
    window.addEventListener('touchcancel', alSoltar, { passive: true })
    return () => {
      window.removeEventListener('touchstart', alTocar)
      window.removeEventListener('touchmove', alMover)
      window.removeEventListener('touchend', alSoltar)
      window.removeEventListener('touchcancel', alSoltar)
    }
  }, [refrescar])

  if (!distancia && !recargando) return null
  const listo = distancia >= UMBRAL
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[65] flex justify-center"
      style={{ transform: `translateY(${Math.max(8, distancia - 24)}px)` }} aria-live="polite">
      <span className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-lg ring-1 ring-slate-200">
        {recargando || listo
          ? <RefreshCw className={`h-4 w-4 ${recargando ? 'animate-spin' : ''}`} />
          : <ArrowDown className="h-4 w-4" style={{ transform: `rotate(${(distancia / UMBRAL) * 180}deg)` }} />}
        {recargando ? 'Actualizando…' : listo ? 'Suelta para actualizar' : 'Estira para actualizar'}
      </span>
    </div>
  )
}

// ---------- Barra de pestañas (celular, como app instalada) ----------

interface Pestana {
  a: string
  texto: string
  icono: LucideIcon
}

/** Pantallas de detalle: tienen su propio "volver" y barra de acciones, así que la barra de pestañas se oculta. */
const DETALLE = /^\/(registros\/r\/|auditorias\/\d|auditorias-externas\/\d|no-conformidades\/\d)/

export function usaPestanas(pathname: string, modoApp: boolean): boolean {
  return modoApp && !DETALLE.test(pathname)
}

/** Las 4 pestañas fijas; el resto de las secciones va en la hoja "Más". */
export function PESTANAS(esCertificaciones: boolean): Pestana[] {
  return [
    { a: '/', texto: 'Inicio', icono: LayoutDashboard },
    { a: '/registros', texto: 'Registros', icono: FileText },
    esCertificaciones
      ? { a: '/auditorias', texto: 'Auditorías', icono: ClipboardCheck }
      : { a: '/laboratorio', texto: 'Laboratorio', icono: FlaskConical },
    { a: '/no-conformidades', texto: 'NC', icono: AlertTriangle },
  ]
}

export function BarraPestanas({ esCertificaciones, masAbierto, onMas }: {
  esCertificaciones: boolean
  masAbierto: boolean
  onMas: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const pestanas = PESTANAS(esCertificaciones)
  const activaRuta = pestanas.find((p) => (p.a === '/' ? pathname === '/' : pathname === p.a || pathname.startsWith(`${p.a}/`)))?.a
  // Con la hoja "Más" abierta (o en una sección que no está en las pestañas), la activa es "Más"
  const activa = masAbierto || !activaRuta ? 'mas' : activaRuta

  // Los avisos flotantes se apoyan sobre la barra, no debajo de ella
  useEffect(() => {
    const raiz = document.documentElement
    const medir = () => raiz.style.setProperty('--alto-pestanas', `${ref.current?.offsetHeight ?? 0}px`)
    medir()
    const obs = new ResizeObserver(medir)
    if (ref.current) obs.observe(ref.current)
    return () => {
      obs.disconnect()
      raiz.style.removeProperty('--alto-pestanas')
    }
  }, [])

  const clase = (sel: boolean) =>
    `group flex min-h-[64px] w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold tracking-tight transition-colors duration-200 ${
      sel ? 'text-emerald-800' : 'text-slate-600'
    }`
  // Rebote al tocar y píldora con transiciones CSS de transform: corren en el compositor, sin medir el layout en cada cuadro
  const icono = (Icono: LucideIcon, sel: boolean) => (
    <span className="relative flex h-8 w-14 items-center justify-center transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-active:scale-[0.86]">
      <Icono className="relative h-[22px] w-[22px]" strokeWidth={sel ? 2.2 : 1.8} />
    </span>
  )
  const indice = activa === 'mas' ? pestanas.length : pestanas.findIndex((p) => p.a === activa)

  return (
    <nav
      ref={ref}
      aria-label="Navegación principal"
      className="shrink-0 bg-fondo px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 lg:hidden"
    >
      <ul className="relative mx-auto grid max-w-lg grid-cols-5 rounded-full border border-slate-200 bg-white px-1 shadow-[0_8px_24px_-10px_rgba(15,30,19,0.3)]">
        {/* Misma estructura que una pestaña (ícono + texto invisible) para que la píldora calce exacto bajo el ícono */}
        <li aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-1 flex w-[calc((100%-0.5rem)/5)] flex-col items-center justify-center gap-1 text-[11px] font-semibold tracking-tight transition-transform duration-[450ms] ease-[cubic-bezier(0.34,1.3,0.64,1)]"
          style={{ transform: `translateX(${indice * 100}%)` }}>
          <span className="h-8 w-14 rounded-full bg-emerald-100" />
          <span className="invisible">Más</span>
        </li>
        {pestanas.map(({ a, texto, icono: Icono }) => (
          <li key={a}>
            <NavLink to={a} end={a === '/'} className={clase(activa === a)} aria-current={activa === a ? 'page' : undefined}>
              {icono(Icono, activa === a)}
              {texto}
            </NavLink>
          </li>
        ))}
        <li>
          <button type="button" onClick={onMas} className={clase(activa === 'mas')} aria-label="Más secciones"
            aria-expanded={masAbierto}>
            {icono(Menu, activa === 'mas')}
            Más
          </button>
        </li>
      </ul>
    </nav>
  )
}
