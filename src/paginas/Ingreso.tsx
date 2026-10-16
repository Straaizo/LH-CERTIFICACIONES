import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, ClipboardCheck, Eye, EyeOff, FileText, FlaskConical, KeyRound, Leaf } from 'lucide-react'
import { AUTH_MODO, api, esErrorClaveDemo, guardarClaveDemo } from '../api'
import { useSesion } from '../contexto/Sesion'
import { FondoCarrusel, IndicadoresCarrusel, useCarrusel } from '../componentes/Carrusel'
import { Cargando, MensajeError } from '../componentes/ui'
import { useAccion } from '../hooks'
import type { Usuario } from '../tipos'

const ROLES = { certificaciones: 'Equipo de certificaciones', encargado: 'Encargado de campo o packing', lectura: 'Solo lectura' }

const MODULOS = [
  { icono: FileText, texto: 'Documentos' },
  { icono: ClipboardCheck, texto: 'Auditorías' },
  { icono: FlaskConical, texto: 'Laboratorio' },
  { icono: Leaf, texto: 'Medio ambiente' },
]

// En el celular no se enfoca solo: abriría el teclado tapando la pantalla
const ESCRITORIO = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

const claseCampo =
  'h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-700/15'

function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-0.5 shadow-sm ring-1 ring-black/5">
        <img src="/logo_lh.png" alt="" className="h-full w-full object-contain" />
      </span>
      <div className="leading-tight">
        <p className={`text-[15px] font-bold tracking-tight ${claro ? 'text-white' : 'text-slate-950'}`}>La Hornilla</p>
        <p className={`font-mono text-[11px] uppercase tracking-[0.2em] ${claro ? 'text-white/70' : 'text-slate-500'}`}>
          Portal Certificaciones
        </p>
      </div>
    </div>
  )
}

/** Mensaje principal sobre las fotos (panel izquierdo en escritorio, banda superior en el celular). */
function Portada({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className="text-white">
      <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Viento Sur · La Hornilla
      </span>
      <h1 className={`mt-5 font-bold leading-[1.05] tracking-tight ${compacta ? 'text-[28px]' : 'text-[44px] xl:text-[52px]'}`}>
        Toda la certificación
        <span className="block text-white/70">en un solo lugar.</span>
      </h1>
      {!compacta && (
        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/80">
          Documentos y vencimientos, registros, auditorías y no conformidades, laboratorio y medio ambiente de cada
          sucursal, listos para la próxima auditoría.
        </p>
      )}
    </div>
  )
}

function Modulos() {
  return (
    <ul className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-white/15 pt-7 sm:grid-cols-4">
      {MODULOS.map(({ icono: Icono, texto }) => (
        <li key={texto} className="text-white">
          <Icono className="h-5 w-5 text-emerald-300" strokeWidth={1.75} />
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/70">{texto}</p>
        </li>
      ))}
    </ul>
  )
}

export function Ingreso() {
  const { ingresarDemo, ingresar, error: errorSesion } = useSesion()
  const carrusel = useCarrusel()
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [identificador, setIdentificador] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [ayudaClave, setAyudaClave] = useState(false)
  const { ocupado, error, setError, ejecutar } = useAccion()
  // Demo publicada: la API pide una clave de acceso antes de mostrar los perfiles
  const [pideClave, setPideClave] = useState(false)
  const [claveDemo, setClaveDemo] = useState('')

  const cargarPerfiles = useCallback(() => {
    setUsuarios(null)
    setError(null)
    api
      .get<Usuario[]>('/usuarios-demo')
      .then((u) => {
        setPideClave(false)
        setUsuarios(u)
      })
      .catch((e: Error) => {
        setUsuarios([])
        if (esErrorClaveDemo(e)) {
          setPideClave(true)
          if (/incorrecta/i.test(e.message)) setError(e.message)
        } else setError(e.message)
      })
  }, [setError])

  useEffect(() => {
    if (AUTH_MODO === 'demo') cargarPerfiles()
  }, [cargarPerfiles])

  const entrarConClave = (e: FormEvent) => {
    e.preventDefault()
    guardarClaveDemo(claveDemo.trim())
    cargarPerfiles()
  }

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    void ejecutar(() => ingresar(identificador, clave))
  }

  const formulario = (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      <div>
        <label htmlFor="usuario" className="mb-2 block text-sm font-medium text-slate-800">Usuario</label>
        <input id="usuario" type="text" required autoFocus={ESCRITORIO} autoComplete="username" autoCapitalize="none" spellCheck={false}
          placeholder="Inicial y apellido, o tu correo" className={claseCampo}
          value={identificador} onChange={(e) => setIdentificador(e.target.value)} />
      </div>
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <label htmlFor="clave" className="text-sm font-medium text-slate-800">Contraseña</label>
          <button type="button" onClick={() => setAyudaClave((v) => !v)} aria-expanded={ayudaClave}
            className="text-[13px] text-slate-500 underline-offset-4 hover:text-emerald-800 hover:underline">
            ¿Olvidaste tu clave?
          </button>
        </div>
        <div className="relative">
          <input id="clave" type={verClave ? 'text' : 'password'} required autoComplete="current-password"
            className={`${claseCampo} pr-12`} value={clave} onChange={(e) => setClave(e.target.value)} />
          <button type="button" onClick={() => setVerClave((v) => !v)} aria-label={verClave ? 'Ocultar clave' : 'Mostrar clave'}
            className="absolute inset-y-0 right-1 my-1 flex w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            {verClave ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        </div>
        {ayudaClave && (
          <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-[13px] text-slate-600">
            Es la misma clave del portal La Hornilla. Para recuperarla, contacta a soporte TI.
          </p>
        )}
      </div>
      <button type="submit" disabled={ocupado}
        className="group mt-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/30 disabled:bg-emerald-700/60">
        {ocupado ? 'Entrando…' : 'Entrar'}
        {!ocupado && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
      </button>
    </form>
  )

  const demo = pideClave ? (
    <form onSubmit={entrarConClave} className="flex flex-col gap-5">
      <p className="text-sm text-slate-600">Esta es una versión de prueba. Ingresa la clave de acceso que te entregaron.</p>
      <div>
        <label htmlFor="clave-demo" className="mb-2 block text-sm font-medium text-slate-800">Clave de acceso</label>
        <input id="clave-demo" type="password" required autoFocus autoComplete="current-password" className={claseCampo}
          value={claveDemo} onChange={(e) => setClaveDemo(e.target.value)} />
      </div>
      <button type="submit" disabled={usuarios === null}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 text-[15px] font-semibold text-white hover:bg-emerald-800 disabled:bg-emerald-700/60">
        <KeyRound className="h-4 w-4" /> Entrar
      </button>
    </form>
  ) : usuarios === null ? (
    <Cargando variante="lista" />
  ) : (
    <div className="flex flex-col gap-2">
      <p className="mb-1 text-sm text-slate-600"><strong>Modo demo.</strong> Elige con qué perfil entrar.</p>
      {usuarios.map((u) => (
        <button key={u.id} disabled={ocupado} onClick={() => void ejecutar(() => ingresarDemo(u.id))}
          className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-emerald-600 hover:bg-emerald-50 disabled:opacity-50">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">{u.nombre}</span>
            <span className="block truncate text-xs text-slate-500">
              {ROLES[u.rol]}{u.unidades.length > 0 && ` · ${u.unidades.map((x) => x.nombre).join(', ')}`}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-700" />
        </button>
      ))}
    </div>
  )

  return (
    <div className="min-h-dvh bg-fondo lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Escritorio: panel de fotos */}
      <aside className="relative hidden overflow-hidden lg:flex lg:min-h-dvh lg:flex-col lg:justify-between lg:p-10 xl:p-14">
        <FondoCarrusel imagenes={carrusel.imagenes} actual={carrusel.actual} />
        <div className="relative"><Marca claro /></div>
        <div className="relative max-w-xl space-y-10">
          <Portada />
          <Modulos />
        </div>
        <div className="relative flex items-center justify-between gap-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">Equipo TI · La Hornilla</p>
          <IndicadoresCarrusel total={carrusel.total} actual={carrusel.actual} ir={carrusel.ir} />
        </div>
      </aside>

      {/* Celular y tablet: banda de fotos arriba */}
      <header className="relative overflow-hidden px-5 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))] lg:hidden">
        <FondoCarrusel imagenes={carrusel.imagenes} actual={carrusel.actual} />
        <div className="relative"><Marca claro /></div>
        <div className="relative mt-10"><Portada compacta /></div>
        <div className="relative mt-6"><IndicadoresCarrusel total={carrusel.total} actual={carrusel.actual} ir={carrusel.ir} /></div>
      </header>

      <main className="relative -mt-8 flex justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] lg:mt-0 lg:min-h-dvh lg:items-center lg:px-10 lg:pb-10">
        <div className="w-full max-w-[400px] rounded-3xl bg-superficie p-6 shadow-[0_24px_60px_-20px_rgba(16,40,16,0.35)] sm:p-8 lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
          <h2 className="text-[26px] font-bold tracking-tight text-slate-950">Iniciar sesión</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {AUTH_MODO === 'demo' ? 'Versión de prueba del Portal Certificaciones.' : 'Usa tus credenciales del portal La Hornilla.'}
          </p>
          <div className="mt-7">
            <MensajeError error={error ?? errorSesion} />
            {AUTH_MODO === 'demo' ? demo : formulario}
          </div>
          <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400 sm:text-[11px] sm:tracking-[0.18em]">
            Desarrollado por Equipo TI · La Hornilla
          </p>
        </div>
      </main>
    </div>
  )
}
