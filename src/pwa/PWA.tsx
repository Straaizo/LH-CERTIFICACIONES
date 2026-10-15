import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle2, ClipboardCheck, Download, FileText, FlaskConical, LayoutDashboard, Menu, PlusSquare,
  Share, Smartphone, Wifi, WifiOff, X, Zap, type LucideIcon,
} from 'lucide-react'
import { Boton } from '../componentes/ui'

const CLAVE_SIMULADA = 'certificaciones.vistaApp'
const CLAVE_DESCARTE = 'certificaciones.pwa.descartado'
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
}

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
  const esIOS = useMemo(
    () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    [],
  )
  const modoApp = instalada || simulada

  useEffect(() => {
    // Solo en producción: en desarrollo la caché del service worker escondería los cambios
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined)
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

  const pedirInstalacion = useCallback(() => {
    if (evento) void instalar()
    else setGuiaAbierta(true)
  }, [evento, instalar])

  const valor: EstadoPWA = {
    modoApp, instalada, simulada, setSimulada, puedeInstalar: !!evento, esIOS, instalar, enLinea,
    pedirInstalacion, guiaAbierta, cerrarGuia: () => setGuiaAbierta(false),
  }
  return <ContextoPWA.Provider value={valor}>{children}</ContextoPWA.Provider>
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
          <h2 id="titulo-instalar" className="text-[17px] font-bold tracking-tight text-slate-900">Instala Certificaciones</h2>
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

// ---------- Barra de pestañas (celular, como app instalada) ----------

interface Pestana {
  a: string
  texto: string
  icono: LucideIcon
}

/** Pantallas de detalle: tienen su propio "volver" y barra de acciones, así que la barra de pestañas se oculta. */
const DETALLE = /^\/(registros\/r\/|auditorias\/\d|no-conformidades\/\d)/

export function usaPestanas(pathname: string, modoApp: boolean): boolean {
  return modoApp && !DETALLE.test(pathname)
}

export function BarraPestanas({ esCertificaciones, onMas }: { esCertificaciones: boolean; onMas: () => void }) {
  const ref = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const pestanas: Pestana[] = [
    { a: '/', texto: 'Inicio', icono: LayoutDashboard },
    { a: '/registros', texto: 'Registros', icono: FileText },
    esCertificaciones
      ? { a: '/auditorias', texto: 'Auditorías', icono: ClipboardCheck }
      : { a: '/laboratorio', texto: 'Laboratorio', icono: FlaskConical },
    { a: '/no-conformidades', texto: 'NC', icono: AlertTriangle },
  ]
  const enOtra = !pestanas.some((p) => (p.a === '/' ? pathname === '/' : pathname.startsWith(p.a)))

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

  const clase = (activa: boolean) =>
    `group flex min-h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-semibold tracking-tight transition-colors ${
      activa ? 'text-emerald-800' : 'text-slate-500 active:text-slate-700'
    }`
  const indicador = (activa: boolean) =>
    `flex h-8 w-14 items-center justify-center rounded-full transition-colors ${activa ? 'bg-emerald-100' : 'group-active:bg-slate-100'}`

  return (
    <nav
      ref={ref}
      aria-label="Navegación principal"
      className="shrink-0 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 px-1">
        {pestanas.map(({ a, texto, icono: Icono }) => (
          <li key={a}>
            <NavLink to={a} end={a === '/'} className={({ isActive }) => clase(isActive)}>
              {({ isActive }) => (
                <>
                  <span className={indicador(isActive)}>
                    <Icono className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.2 : 1.8} />
                  </span>
                  {texto}
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li>
          <button type="button" onClick={onMas} className={`w-full ${clase(enOtra)}`} aria-label="Más secciones">
            <span className={indicador(enOtra)}>
              <Menu className="h-[22px] w-[22px]" strokeWidth={enOtra ? 2.2 : 1.8} />
            </span>
            Más
          </button>
        </li>
      </ul>
    </nav>
  )
}
