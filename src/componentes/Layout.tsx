import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import {
  AlertTriangle, CalendarClock, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, ClipboardCheck, Eye, FileText,
  ArrowLeft, FlaskConical, Download, HardHat, History, LayoutDashboard, Leaf, LogOut, Menu, Settings, ShieldCheck,
  RefreshCw, Smartphone, Upload, X, type LucideIcon,
} from 'lucide-react'
import { AUTH_MODO, api } from '../api'
import { useSesionActiva } from '../contexto/Sesion'
import type { Usuario } from '../tipos'
import { BarraContexto, SelectoresSucursal } from './BarraFiltros'
import { Desplegable } from './Desplegable'
import { Hoja, RESORTE, useEsMovil } from './Hoja'
import { ContextoMiga, Cargando } from './ui'
import { FondoOrganico } from './Escena'
import {
  AvisoActualizacion, AvisoInstalar, BarraConexion, BarraPestanas, EVENTO_REFRESCAR, PESTANAS, TirarParaRecargar, textoVersion, usaPestanas, usePWA,
} from '../pwa/PWA'

const ROLES = { certificaciones: 'Certificaciones', encargado: 'Encargado', lectura: 'Solo lectura' }
const CLAVE_COLAPSADO = 'certificaciones.menuColapsado'


interface Subenlace {
  a: string
  texto: string
  /** Nombre en la cuadrícula "Más" del celular */
  corto: string
  /** Solo activo en esa ruta exacta (no en sus subrutas) */
  exacto?: boolean
}

interface Enlace {
  a: string
  texto: string
  icono: LucideIcon
  /** Subsecciones: el ítem se despliega en el menú lateral */
  hijos?: Subenlace[]
}

/** La ruta actual está en este enlace (por segmentos: /auditorias no incluye /auditorias-externas). */
function enRuta(pathname: string, a: string, exacto = false): boolean {
  if (a === '/') return pathname === '/'
  return pathname === a || (!exacto && pathname.startsWith(`${a}/`))
}

const CLAVE_DESPLEGADOS = 'certificaciones.menuDesplegados'

/** Preferencia guardada; sin ella, en tablets horizontales (menos de 1280 px) parte colapsado para dar espacio. */
function leerColapsado(): boolean {
  try {
    const guardado = localStorage.getItem(CLAVE_COLAPSADO)
    if (guardado !== null) return guardado === '1'
  } catch {
    /* almacenamiento no disponible */
  }
  return window.innerWidth < 1280
}

/** Cierra un menú desplegable al hacer clic fuera de él. */
function useClicFuera(abierto: boolean, cerrar: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const alClic = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cerrar()
    }
    document.addEventListener('mousedown', alClic)
    return () => document.removeEventListener('mousedown', alClic)
  }, [abierto, cerrar])
  return ref
}

function useGrupos(): { titulo: string; enlaces: Enlace[] }[] {
  const { esCertificaciones, veHistorial, puedeVer } = useSesionActiva()
  return [
    {
      titulo: 'Operación',
      enlaces: [
        { a: '/', texto: 'Inicio', icono: LayoutDashboard },
        // Registros agrupa los documentos fijos y los registros: se ve con cualquiera de los dos
        ...(puedeVer('REGISTROS') || puedeVer('DOCUMENTOS') ? [{ a: '/registros', texto: 'Registros', icono: FileText }] : []),
        ...(puedeVer('DOCUMENTOS') ? [{ a: '/vencimientos', texto: 'Vencimientos', icono: CalendarClock }] : []),
        ...(puedeVer('LABORATORIO') ? [{
          a: '/laboratorio', texto: 'Laboratorio', icono: FlaskConical,
          hijos: [
            { a: '/laboratorio', texto: 'Análisis', corto: 'Laboratorio', exacto: true },
            { a: '/laboratorio/residuos', texto: 'Residuos y destinos (MRL)', corto: 'Residuos MRL' },
          ],
        }] : []),
        ...(puedeVer('AUDITORIAS') ? [{
          a: '/auditorias', texto: 'Auditorías', icono: ClipboardCheck,
          // Las externas son documentos de consulta de certificaciones
          hijos: esCertificaciones
            ? [
                { a: '/auditorias', texto: 'Internas', corto: 'Auditorías internas' },
                { a: '/auditorias-externas', texto: 'Externas', corto: 'Auditorías externas' },
              ]
            : undefined,
        }] : []),
        ...(puedeVer('NC') ? [{ a: '/no-conformidades', texto: 'No conformidades', icono: AlertTriangle }] : []),
        ...(puedeVer('AMBIENTE') ? [{ a: '/ambiente', texto: 'Medio ambiente', icono: Leaf }] : []),
      ],
    },
    ...(esCertificaciones
      ? [{ titulo: 'Configuración', enlaces: [{ a: '/importar', texto: 'Importar planillas', icono: Upload }] }]
      : []),
    {
      titulo: 'Sistema',
      enlaces: [
        ...(veHistorial ? [{ a: '/historial', texto: 'Historial', icono: History }] : []),
        { a: '/configuracion', texto: 'Configuración', icono: Settings },
      ],
    },
  ]
}

function Marca({ compacto = false }: { compacto?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${compacto ? 'justify-center' : ''}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-0.5 shadow-sm">
        <img src="/logo_lh.png" alt="La Hornilla" className="h-full w-full object-contain" />
      </span>
      {!compacto && (
        <div className="min-w-0 leading-tight text-white">
          <p className="truncate text-[16px] font-bold tracking-tight">Portal Certificaciones</p>
          <p className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-white/70">La Hornilla · Viento Sur</p>
        </div>
      )}
    </div>
  )
}

export function Layout() {
  const { esCertificaciones } = useSesionActiva()
  const grupos = useGrupos()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [masAbierto, setMasAbierto] = useState(false)
  const [colapsado, setColapsado] = useState(leerColapsado)
  const { pathname } = useLocation()
  const { modoApp } = usePWA()
  // Estirar para recargar: se vuelve a montar la pantalla (pide sus datos de nuevo) sin recargar la página
  const [refrescos, setRefrescos] = useState(0)
  useEffect(() => {
    const alRefrescar = () => setRefrescos((n) => n + 1)
    window.addEventListener(EVENTO_REFRESCAR, alRefrescar)
    return () => window.removeEventListener(EVENTO_REFRESCAR, alRefrescar)
  }, [])
  // Como app instalada (o su vista simulada), el celular navega con pestañas abajo en vez del menú hamburguesa
  const pestanas = usaPestanas(pathname, modoApp)
  const contenido = useRef<HTMLDivElement>(null)
  const navegar = useNavigate()
  const cerrarMenu = useCallback(() => setMenuAbierto(false), [])
  const cerrarMas = useCallback(() => setMasAbierto(false), [])

  // Al cambiar de página: contenido arriba y menús cerrados
  useEffect(() => {
    contenido.current?.scrollTo({ top: 0 })
    setMenuAbierto(false)
    setMasAbierto(false)
  }, [pathname])

  const actual = grupos
    .flatMap((g) => g.enlaces.flatMap((e) => [
      { grupo: g.titulo, a: e.a, texto: e.texto, exacto: false },
      ...(e.hijos ?? []).map((h) => ({ grupo: g.titulo, a: h.a, texto: `${e.texto} · ${h.texto}`, exacto: !!h.exacto })),
    ]))
    .filter((e) => enRuta(pathname, e.a, e.exacto))
    .sort((x, y) => y.a.length - x.a.length || y.texto.length - x.texto.length)[0]
  const miga = actual ? `${actual.grupo} · ${actual.texto}` : ''

  // Subsecciones abiertas en el menú: las que el usuario abrió y la de la página actual
  const [desplegados, setDesplegados] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(CLAVE_DESPLEGADOS) ?? '[]') as string[])
    } catch {
      return new Set()
    }
  })
  const alternarDesplegado = (a: string) =>
    setDesplegados((s) => {
      const n = new Set(s)
      if (n.has(a)) n.delete(a)
      else n.add(a)
      try {
        localStorage.setItem(CLAVE_DESPLEGADOS, JSON.stringify([...n]))
      } catch {
        /* almacenamiento no disponible */
      }
      return n
    })

  const cambiarColapsado = () => {
    setColapsado((c) => {
      try {
        localStorage.setItem(CLAVE_COLAPSADO, c ? '0' : '1')
      } catch {
        /* almacenamiento no disponible */
      }
      return !c
    })
  }

  const navegacion = (compacto: boolean) => (
    <nav className="flex flex-col gap-5 px-3 py-5">
      {grupos.map((g) => (
        <div key={g.titulo}>
          {compacto ? (
            <div className="mx-auto mb-2 h-px w-6 bg-white/20" />
          ) : (
            <p className="mb-2 px-3 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">{g.titulo}</p>
          )}
          <div className="flex flex-col gap-1">
            {g.enlaces.map(({ a, texto, icono: Icono, hijos }) => {
              const claseItem = (activo: boolean) =>
                `flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-[15px] font-medium transition-colors lg:min-h-0 lg:py-2.5 ${
                  compacto ? 'justify-center' : ''
                } ${
                  activo
                    ? 'border-white/25 bg-white/15 text-white shadow-sm'
                    : 'border-transparent text-white/85 hover:bg-white/10 hover:text-white active:bg-white/15'
                }`
              // Sin subsecciones (o con el menú colapsado): un enlace directo
              if (!hijos || compacto) {
                return (
                  <NavLink key={a} to={a} end={a === '/'} title={compacto ? texto : undefined}
                    className={({ isActive }) => claseItem(isActive || (!!hijos && hijos.some((h) => enRuta(pathname, h.a, h.exacto))))}>
                    <Icono className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                    {!compacto && texto}
                  </NavLink>
                )
              }
              const dentro = hijos.some((h) => enRuta(pathname, h.a, h.exacto))
              const abierto = dentro || desplegados.has(a)
              return (
                <div key={a}>
                  <button type="button" aria-expanded={abierto} onClick={() => alternarDesplegado(a)}
                    className={claseItem(dentro && !abierto)}>
                    <Icono className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                    <span className="flex-1 text-left">{texto}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {abierto && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="overflow-hidden">
                        <div className="ml-[22px] mt-1 flex flex-col gap-0.5 border-l border-white/20 pl-3">
                          {hijos.map((h) => (
                            <NavLink key={h.a} to={h.a} end={h.exacto}
                              className={({ isActive }) =>
                                `flex min-h-11 items-center rounded-lg px-3 text-[14px] transition-colors lg:min-h-0 lg:py-2 ${
                                  isActive ? 'bg-white/15 font-semibold text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                                }`
                              }>
                              {h.texto}
                            </NavLink>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )

  const fondoVerde = 'bg-emerald-700'

  return (
    <ContextoMiga.Provider value={{ miga, filtros: actual && pathname === actual.a ? <BarraContexto /> : null }}>
      {/* Alto de la pantalla visible; como app instalada, el del documento (ver .modo-app en index.css) */}
      <div className="h-dvh overflow-hidden [@media(display-mode:standalone)]:h-full">
        {/* Menú lateral (escritorio) */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 hidden flex-col ${fondoVerde} transition-[width] lg:flex ${colapsado ? 'w-20' : 'w-72'}`}
        >
          {/* Escena lh_ui en todo el menú: círculos arriba y lomas escalonadas abajo */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <FondoOrganico vertical />
          </div>
          <div className={`relative flex h-[72px] shrink-0 items-center border-b border-white/10 ${colapsado ? 'justify-center px-2' : 'px-5'}`}>
            <Marca compacto={colapsado} />
          </div>
          <div className="scroll-oscuro relative flex-1 overflow-y-auto">{navegacion(colapsado)}</div>
          <button
            onClick={cambiarColapsado}
            className="relative flex items-center justify-center gap-2 border-t border-white/10 py-4 text-sm text-white/80 hover:text-white"
          >
            {colapsado ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Colapsar</>}
          </button>
        </aside>

        {/* Menú lateral (celular, vista web): entra deslizándose y se cierra arrastrándolo a la izquierda */}
        <CajonMovil abierto={menuAbierto} onCerrar={cerrarMenu} fondo={fondoVerde}>
          {navegacion(false)}
        </CajonMovil>

        <div className={`flex h-dvh flex-col transition-[padding] [@media(display-mode:standalone)]:h-full ${colapsado ? 'lg:pl-20' : 'lg:pl-72'}`}>
          <header className="relative z-30 shrink-0 bg-emerald-700 pt-[env(safe-area-inset-top)] text-white shadow-[0_1px_0_rgba(0,0,0,0.08)]">
            <div className="flex h-16 items-center gap-2 px-3 sm:h-[72px] sm:gap-3 sm:px-6">
              {modoApp && !pestanas ? (
                // App: en las pantallas de detalle se vuelve atrás, como en una app nativa
                <button
                  onClick={() => (window.history.length > 1 ? navegar(-1) : navegar('/'))}
                  className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10 active:bg-white/15 lg:hidden"
                  aria-label="Volver"
                >
                  <ArrowLeft className="h-[22px] w-[22px]" />
                </button>
              ) : !pestanas && (
                <button
                  onClick={() => setMenuAbierto(true)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10 active:bg-white/15 lg:hidden"
                  aria-label="Abrir menú"
                >
                  <Menu className="h-[22px] w-[22px]" />
                </button>
              )}
              <div className="hidden min-w-0 sm:block">
                <SelectoresSucursal />
              </div>
              <div className="min-w-0 sm:hidden">
                <SelectoresSucursal soloSucursal />
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
                {AUTH_MODO === 'demo' && <VerComo />}
                <MenuUsuario />
              </div>
            </div>
          </header>
          <BarraConexion />
          {/* Solo el contenido se desplaza: la barra queda bajo el encabezado, no encima */}
          <div ref={contenido} className="scroll-principal min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8">
              {/* La llave por ruta hace que cada página entre con una transición suave */}
              <div key={`${pathname}#${refrescos}`} className="animar-pagina">
                {/* Si la pantalla todavía no se precargó, se muestra el esqueleto mientras llega */}
                <Suspense fallback={<Cargando />}>
                  <Outlet />
                </Suspense>
              </div>
            </main>
          </div>
          {pestanas && (
            <BarraPestanas esCertificaciones={esCertificaciones} masAbierto={masAbierto} onMas={() => setMasAbierto(true)} />
          )}
        </div>
      </div>
      <HojaMas abierta={masAbierto} onCerrar={cerrarMas} />
      <AvisoInstalar />
      <AvisoActualizacion sobrePestanas={pestanas} />
      {modoApp && <TirarParaRecargar />}
    </ContextoMiga.Provider>
  )
}

function CajonMovil({ abierto, onCerrar, fondo, children }: {
  abierto: boolean
  onCerrar: () => void
  fondo: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!abierto) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [abierto, onCerrar])

  const soltar = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -80 || info.velocity.x < -500) onCerrar()
  }

  return (
    <AnimatePresence>
      {abierto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.div
            className="absolute inset-0 bg-slate-950/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onCerrar}
          />
          {/* Transform completo: el deslizamiento corre en el compositor; el arrastre para cerrar va en el panel */}
          <motion.div
            className="absolute inset-y-0 left-0 w-[min(20rem,86vw)]"
            initial={{ transform: 'translateX(-100%)' }}
            animate={{ transform: 'translateX(0%)', transitionEnd: { transform: 'none' } }}
            exit={{ transform: 'translateX(-100%)' }}
            transition={RESORTE}
          >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
            className={`relative flex h-full w-full flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-2xl ${fondo}`}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.7, right: 0.02 }}
            style={{ touchAction: 'pan-y' }}
            onDragEnd={soltar}
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <FondoOrganico vertical />
            </div>
            <div className="relative flex h-16 shrink-0 items-center gap-2 border-b border-white/10 pl-4 pr-2">
              <div className="min-w-0 flex-1"><Marca /></div>
              <button
                onClick={onCerrar}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/10 active:bg-white/15"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative flex flex-col items-stretch gap-2 border-b border-white/10 p-4">
              <SelectoresSucursal />
              {AUTH_MODO === 'demo' && <VerComo enMenu />}
            </div>
            <div className="scroll-oscuro relative flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </motion.aside>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/** Celular como app: todo lo que no cabe en las pestañas (secciones, filtros, cuenta), en una hoja inferior. */
function HojaMas({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const grupos = useGrupos()
  const { pathname } = useLocation()
  const { esCertificaciones } = useSesionActiva()
  const enPestanas = new Set(PESTANAS(esCertificaciones).map((p) => p.a))
  // Las subsecciones van como mosaicos propios (Residuos MRL, Auditorías externas)
  const secciones = grupos
    .flatMap((g) => g.enlaces.flatMap((e) => e.hijos ? e.hijos.map((h) => ({ a: h.a, texto: h.corto, icono: e.icono, exacto: h.exacto }))
      : [{ a: e.a, texto: e.texto, icono: e.icono, exacto: false }]))
    .filter((e) => !enPestanas.has(e.a))

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Más" pie={<BotonSalir />}>
      <div className="space-y-6 px-2 pt-1">
        <TarjetaCuenta />
        <section>
          <TituloSeccion>Secciones</TituloSeccion>
          <div className="grid grid-cols-3 gap-2">
            {secciones.map(({ a, texto, icono: Icono, exacto }) => {
              const activa = enRuta(pathname, a, exacto)
              return (
                <NavLink
                  key={a}
                  to={a}
                  className={`flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center text-[13px] font-semibold leading-tight transition-colors active:scale-[0.97] ${
                    activa ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200/80 bg-white text-slate-700 active:bg-slate-50'
                  }`}
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${activa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    <Icono className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  {texto}
                </NavLink>
              )
            })}
          </div>
        </section>
        <section>
          <TituloSeccion>Mostrar datos de</TituloSeccion>
          <SelectoresSucursal enLista />
        </section>
        <AccionesApp />
      </div>
    </Hoja>
  )
}

function TituloSeccion({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 px-1 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">{children}</h3>
}

function TarjetaCuenta() {
  const { usuario } = useSesionActiva()
  return (
    <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-emerald-700 p-4 text-white">
      <FondoOrganico />
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-lg font-bold text-emerald-800">
        {usuario.nombre.trim().charAt(0).toUpperCase()}
      </span>
      <div className="relative min-w-0 flex-1">
        <p className="truncate font-semibold">{usuario.nombre}</p>
        <p className="truncate text-sm text-white/75">{usuario.email}</p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-emerald-200">
          {ROLES[usuario.rol]}
          {usuario.rol !== 'certificaciones' && usuario.unidades.length > 0 && ` · ${usuario.unidades.map((u) => u.nombre).join(', ')}`}
        </p>
      </div>
    </div>
  )
}

/** Instalar, vista de app (demo) y perfil de demo: filas de ajustes. */
function AccionesApp() {
  const { instalada, simulada, setSimulada, puedeInstalar, esIOS, pedirInstalacion, version, buscarActualizacion, actualizar } = usePWA()
  const [revisando, setRevisando] = useState(false)
  const [alDia, setAlDia] = useState(false)
  const filas = []
  filas.push(
    <button key="actualizar" disabled={revisando} onClick={async () => {
      setRevisando(true)
      setAlDia(false)
      if (await buscarActualizacion()) actualizar()
      else { setRevisando(false); setAlDia(true) }
    }} className="flex min-h-[54px] w-full items-center gap-3 px-4 py-2 text-left text-[15px] font-medium text-slate-800 active:bg-slate-50">
      <RefreshCw className={`h-[18px] w-[18px] shrink-0 text-emerald-700 ${revisando ? 'animate-spin' : ''}`} />
      <span className="min-w-0 flex-1">
        {revisando ? 'Buscando actualizaciones…' : 'Buscar actualizaciones'}
        <span className="block text-xs font-normal text-slate-500">
          {alDia ? 'Ya tienes la versión más reciente' : `Versión del ${textoVersion(version)}`}
        </span>
      </span>
    </button>,
  )
  if (!instalada && (puedeInstalar || esIOS)) {
    filas.push(
      <button key="instalar" onClick={pedirInstalacion} className="flex min-h-[54px] w-full items-center gap-3 px-4 text-left text-[15px] font-medium text-slate-800 active:bg-slate-50">
        <Download className="h-[18px] w-[18px] text-emerald-700" />
        <span className="flex-1">Instalar aplicación</span>
        <ChevronRight className="h-4 w-4 text-slate-400" />
      </button>,
    )
  }
  if (AUTH_MODO === 'demo' && !instalada) {
    filas.push(
      <button key="vista" role="switch" aria-checked={simulada} onClick={() => setSimulada(!simulada)}
        className="flex min-h-[54px] w-full items-center gap-3 px-4 py-2 text-left text-[15px] font-medium text-slate-800 active:bg-slate-50">
        <Smartphone className="h-[18px] w-[18px] shrink-0 text-emerald-700" />
        <span className="min-w-0 flex-1">
          Vista de app instalada
          <span className="block text-xs font-normal text-slate-500">Demo: así se ve una vez instalada</span>
        </span>
        <Interruptor activo={simulada} />
      </button>,
    )
  }
  return (
    <>
      {AUTH_MODO === 'demo' && (
        <section>
          <TituloSeccion>Demo</TituloSeccion>
          <VerComo enLista />
        </section>
      )}
      {filas.length > 0 && (
        <section>
          <TituloSeccion>Aplicación</TituloSeccion>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">{filas}</div>
        </section>
      )}
    </>
  )
}

function Interruptor({ activo }: { activo: boolean }) {
  return (
    <span className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors ${activo ? 'bg-emerald-600' : 'bg-slate-300'}`}>
      <motion.span
        className="absolute top-[3px] h-6 w-6 rounded-full bg-white shadow"
        animate={{ x: activo ? 23 : 3 }}
        transition={RESORTE}
      />
    </span>
  )
}

function BotonSalir() {
  const { salir } = useSesionActiva()
  return (
    <button
      onClick={() => void salir()}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-[15px] font-semibold text-white transition-colors hover:bg-red-700 active:bg-red-800"
    >
      <LogOut className="h-[18px] w-[18px]" /> Cerrar sesión
    </button>
  )
}

/** Temporal: previsualizar la aplicación con otro perfil (jefe de área, jefe de campo, auditor…). Solo en modo demo. */
function VerComo({ enMenu = false, enLista = false }: { enMenu?: boolean; enLista?: boolean }) {
  const { usuario, ingresarDemo } = useSesionActiva()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const navegar = useNavigate()

  useEffect(() => {
    api.get<Usuario[]>('/usuarios-demo').then(setUsuarios).catch(() => setUsuarios([]))
  }, [])

  if (usuarios.length < 2) return null
  const iconoRol = { certificaciones: ShieldCheck, encargado: HardHat, lectura: Eye }
  return (
    <Desplegable
      titulo="Previsualizar como"
      etiqueta="Ver como"
      tono={enLista ? 'fila' : 'ambar'}
      alinear={enMenu || enLista ? 'izquierda' : 'derecha'}
      icono={<Eye className={enLista ? 'h-[18px] w-[18px] text-amber-600' : 'h-4 w-4'} />}
      className={enMenu || enLista ? 'w-full max-w-full' : 'hidden max-w-[17rem] lg:block xl:max-w-[24rem]'}
      valor={String(usuario.id)}
      opciones={usuarios.map((u) => {
        const Icono = iconoRol[u.rol]
        return {
          valor: String(u.id),
          etiqueta: u.nombre,
          detalle: [ROLES[u.rol], ...u.unidades.map((x) => x.nombre)].join(' · '),
          icono: <Icono className="h-4 w-4" />,
        }
      })}
      onCambio={(v) => void ingresarDemo(v).then(() => navegar('/'))}
    />
  )
}

function MenuUsuario() {
  const { usuario, salir } = useSesionActiva()
  const { instalada, simulada, setSimulada, puedeInstalar, esIOS, pedirInstalacion } = usePWA()
  const movil = useEsMovil()
  const [abierto, setAbierto] = useState(false)
  const cerrar = useCallback(() => setAbierto(false), [])
  const ref = useClicFuera(abierto && !movil, cerrar)
  const inicial = usuario.nombre.trim().charAt(0).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAbierto((a) => !a)}
        className="flex items-center gap-3 rounded-full p-0.5 transition-colors hover:bg-white/15 active:bg-white/20 xl:border xl:border-white/25 xl:bg-white/10 xl:py-1 xl:pl-1 xl:pr-3"
        aria-expanded={abierto}
        aria-label="Tu cuenta"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-emerald-800">
          {inicial}
        </span>
        <span className="hidden max-w-44 text-left leading-tight xl:block">
          <span className="block truncate text-[15px] font-bold uppercase tracking-wide" title={usuario.nombre}>{usuario.nombre.trim()}</span>
          <span className="block truncate text-xs text-white/75">{usuario.usuario}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 opacity-80 xl:block" />
      </button>

      {movil ? (
        <Hoja abierta={abierto} onCerrar={cerrar} titulo="Tu cuenta" pie={<BotonSalir />}>
          <div className="space-y-6 px-2 pt-1">
            <TarjetaCuenta />
            <AccionesApp />
          </div>
        </Hoja>
      ) : (
        <AnimatePresence>
          {abierto && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="absolute right-0 top-full mt-2 w-72 origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-xl"
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="font-semibold">{usuario.nombre}</p>
                <p className="text-sm text-slate-500">{usuario.email}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-emerald-700">{ROLES[usuario.rol]}</p>
                {usuario.rol === 'encargado' && (
                  <p className="mt-1 text-xs text-slate-500">{usuario.unidades.map((u) => u.nombre).join(', ')}</p>
                )}
              </div>
              {!instalada && (puedeInstalar || esIOS) && (
                <button
                  onClick={() => { setAbierto(false); pedirInstalacion() }}
                  className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" /> Instalar aplicación
                </button>
              )}
              {AUTH_MODO === 'demo' && !instalada && (
                <button
                  role="switch"
                  aria-checked={simulada}
                  onClick={() => setSimulada(!simulada)}
                  className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Smartphone className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    Vista de app instalada
                    <span className="block text-xs font-normal text-slate-500">Demo: así se ve en el celular una vez instalada</span>
                  </span>
                  <Interruptor activo={simulada} />
                </button>
              )}
              <button
                onClick={() => void salir()}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 active:bg-red-100"
              >
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}
