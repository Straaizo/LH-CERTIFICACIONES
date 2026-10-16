import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, CalendarClock, ChevronDown, ChevronsLeft, ChevronsRight, ClipboardCheck, Eye, FileText, FlaskConical,
  Download, HardHat, History, LayoutDashboard, Leaf, LogOut, Menu, Settings, ShieldCheck, Smartphone, Upload, X,
  type LucideIcon,
} from 'lucide-react'
import { AUTH_MODO, api } from '../api'
import { useSesionActiva } from '../contexto/Sesion'
import type { Usuario } from '../tipos'
import { BarraContexto, SelectoresSucursal } from './BarraFiltros'
import { Desplegable } from './Desplegable'
import { ContextoMiga } from './ui'
import { AvisoInstalar, BarraConexion, BarraPestanas, usaPestanas, usePWA } from '../pwa/PWA'

const ROLES = { certificaciones: 'Certificaciones', encargado: 'Encargado', lectura: 'Solo lectura' }
const CLAVE_COLAPSADO = 'certificaciones.menuColapsado'

interface Enlace {
  a: string
  texto: string
  icono: LucideIcon
}

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

export function Layout() {
  const { esCertificaciones } = useSesionActiva()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [colapsado, setColapsado] = useState(leerColapsado)
  const { pathname } = useLocation()
  const { modoApp } = usePWA()
  // Como app instalada (o su vista simulada), el celular navega con pestañas abajo en vez del menú hamburguesa
  const pestanas = usaPestanas(pathname, modoApp)
  const contenido = useRef<HTMLDivElement>(null)
  // Al cambiar de página, el contenido vuelve arriba (antes lo hacía el navegador con la ventana)
  useEffect(() => {
    contenido.current?.scrollTo({ top: 0 })
  }, [pathname])

  const grupos: { titulo: string; enlaces: Enlace[] }[] = [
    {
      titulo: 'Operación',
      enlaces: [
        { a: '/', texto: 'Inicio', icono: LayoutDashboard },
        { a: '/registros', texto: 'Registros', icono: FileText },
        { a: '/vencimientos', texto: 'Vencimientos', icono: CalendarClock },
        { a: '/laboratorio', texto: 'Laboratorio', icono: FlaskConical },
        { a: '/auditorias', texto: 'Auditorías', icono: ClipboardCheck },
        { a: '/no-conformidades', texto: 'No conformidades', icono: AlertTriangle },
        { a: '/ambiente', texto: 'Medio ambiente', icono: Leaf },
      ],
    },
    ...(esCertificaciones
      ? [{ titulo: 'Configuración', enlaces: [{ a: '/importar', texto: 'Importar planillas', icono: Upload }] }]
      : []),
    {
      titulo: 'Sistema',
      enlaces: [
        ...(esCertificaciones ? [{ a: '/bitacora', texto: 'Bitácora', icono: History }] : []),
        { a: '/configuracion', texto: 'Configuración', icono: Settings },
      ],
    },
  ]

  const actual = grupos
    .flatMap((g) => g.enlaces.map((e) => ({ grupo: g.titulo, ...e })))
    .filter((e) => (e.a === '/' ? pathname === '/' : pathname.startsWith(e.a)))
    .sort((x, y) => y.a.length - x.a.length)[0]
  const miga = actual ? `${actual.grupo} · ${actual.texto}` : ''

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
            {g.enlaces.map(({ a, texto, icono: Icono }) => (
              <NavLink
                key={a}
                to={a}
                end={a === '/'}
                title={compacto ? texto : undefined}
                onClick={() => setMenuAbierto(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl border px-3 py-2.5 text-[15px] font-medium transition-colors ${
                    compacto ? 'justify-center' : ''
                  } ${
                    isActive
                      ? 'border-white/25 bg-white/15 text-white shadow-sm'
                      : 'border-transparent text-white/85 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icono className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                {!compacto && texto}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )

  const marca = (compacto: boolean) => (
    <div className={`flex h-[72px] shrink-0 items-center gap-3 border-b border-white/10 ${compacto ? 'justify-center px-2' : 'px-5'}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-0.5 shadow-sm">
        <img src="/logo_lh.png" alt="La Hornilla" className="h-full w-full object-contain" />
      </span>
      {!compacto && (
        <div className="min-w-0 leading-tight text-white">
          <p className="truncate text-[16px] font-bold tracking-tight">Portal Certificaciones</p>
          <p className="truncate font-mono text-[11px] uppercase tracking-[0.2em] text-white/70">Viento Sur · La Hornilla</p>
        </div>
      )}
    </div>
  )

  const fondoVerde = 'bg-gradient-to-b from-emerald-700 to-emerald-900'

  return (
    <ContextoMiga.Provider value={{ miga, filtros: actual && pathname === actual.a ? <BarraContexto /> : null }}>
      <div className="h-dvh overflow-hidden">
        {/* Menú lateral (escritorio) */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 hidden flex-col ${fondoVerde} transition-[width] lg:flex ${colapsado ? 'w-20' : 'w-72'}`}
        >
          {marca(colapsado)}
          <div className="scroll-oscuro flex-1 overflow-y-auto">{navegacion(colapsado)}</div>
          <button
            onClick={cambiarColapsado}
            className="flex items-center justify-center gap-2 border-t border-white/10 py-4 text-sm text-white/80 hover:text-white"
          >
            {colapsado ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Colapsar</>}
          </button>
        </aside>

        {/* Menú lateral (celular) */}
        {menuAbierto && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 lg:hidden" onClick={() => setMenuAbierto(false)}>
            <aside
              className={`flex h-full w-80 max-w-[85vw] flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] ${fondoVerde}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pr-3">
                {marca(false)}
                <button onClick={() => setMenuAbierto(false)} className="rounded-lg p-2 text-white" aria-label="Cerrar menú">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-col items-start gap-2 border-b border-white/10 p-4">
                <SelectoresSucursal />
                {AUTH_MODO === 'demo' && <div className="max-w-full lg:hidden"><VerComo enMenu /></div>}
              </div>
              <div className="scroll-oscuro flex-1 overflow-y-auto">{navegacion(false)}</div>
            </aside>
          </div>
        )}

        <div className={`flex h-dvh flex-col transition-[padding] ${colapsado ? 'lg:pl-20' : 'lg:pl-72'}`}>
          <header className="relative z-30 shrink-0 bg-gradient-to-r from-emerald-700 to-emerald-800 pt-[env(safe-area-inset-top)] text-white shadow-[0_1px_0_rgba(0,0,0,0.08)]">
            <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6">
              <button
                onClick={() => setMenuAbierto(true)}
                className={`rounded-xl p-2 hover:bg-white/10 lg:hidden ${pestanas ? 'hidden' : ''}`}
                aria-label="Abrir menú"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden min-w-0 sm:block">
                <SelectoresSucursal />
              </div>
              <div className="min-w-0 sm:hidden">
                <SelectoresSucursal soloSucursal />
              </div>
              <div className="ml-auto flex items-center gap-2 sm:gap-3">
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
              <div key={pathname} className="animar-pagina">
                <Outlet />
              </div>
            </main>
          </div>
          {pestanas && <BarraPestanas esCertificaciones={esCertificaciones} onMas={() => setMenuAbierto(true)} />}
        </div>
      </div>
      <AvisoInstalar />
    </ContextoMiga.Provider>
  )
}

/** Temporal: previsualizar la aplicación con otro perfil (jefe de área, jefe de campo, auditor…). Solo en modo demo. */
function VerComo({ enMenu = false }: { enMenu?: boolean }) {
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
      tono="ambar"
      alinear={enMenu ? 'izquierda' : 'derecha'}
      icono={<Eye className="h-4 w-4" />}
      className={enMenu ? 'max-w-full' : 'hidden max-w-[17rem] lg:block xl:max-w-[24rem]'}
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
  const [abierto, setAbierto] = useState(false)
  const ref = useClicFuera(abierto, () => setAbierto(false))
  const inicial = usuario.nombre.trim().charAt(0).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAbierto((a) => !a)}
        className="flex items-center gap-3 rounded-full py-1 pl-1 pr-2 hover:bg-white/10"
        aria-expanded={abierto}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-emerald-800">
          {inicial}
        </span>
        <span className="hidden max-w-44 text-left leading-tight xl:block">
          <span className="block truncate text-sm font-bold" title={usuario.nombre}>{usuario.nombre}</span>
          <span className="block truncate font-mono text-[11px] uppercase tracking-wider text-white/75">{ROLES[usuario.rol]}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 opacity-80 xl:block" />
      </button>
      {abierto && (
        <div className="absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-xl">
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
              <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${simulada ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${simulada ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
              </span>
            </button>
          )}
          <button
            onClick={() => void salir()}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
