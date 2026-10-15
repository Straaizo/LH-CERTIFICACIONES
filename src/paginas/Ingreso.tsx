import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { AUTH_MODO, api, esErrorClaveDemo, guardarClaveDemo } from '../api'
import { useSesion } from '../contexto/Sesion'
import { Boton, Campo, Cargando, MensajeError, claseEntrada } from '../componentes/ui'
import { useAccion } from '../hooks'
import type { Usuario } from '../tipos'

const ROLES = { certificaciones: 'Equipo de certificaciones', encargado: 'Encargado de campo o planta', lectura: 'Solo lectura' }

export function Ingreso() {
  const { ingresarDemo, ingresarFirebase, error: errorSesion } = useSesion()
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
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
    void ejecutar(() => ingresarFirebase(email, clave))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-700 to-emerald-900 p-4">
      <div className="w-full max-w-md rounded-3xl bg-superficie p-7 shadow-2xl">
        <div className="mb-7 flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <img src="/logo_lh.png" alt="La Hornilla" className="h-full w-full object-contain" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-950">Certificaciones</h1>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">Viento Sur · La Hornilla</p>
          </div>
        </div>
        <MensajeError error={error ?? errorSesion} />
        {AUTH_MODO === 'demo' && pideClave ? (
          <form onSubmit={entrarConClave} className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">Esta es una versión de prueba con datos reales. Ingresa la clave de acceso que te entregaron.</p>
            <Campo etiqueta="Clave de acceso">
              <input type="password" required autoFocus autoComplete="current-password" className={claseEntrada}
                value={claveDemo} onChange={(e) => setClaveDemo(e.target.value)} />
            </Campo>
            <Boton type="submit" icono={<KeyRound className="h-4 w-4" />} ocupado={usuarios === null}>
              Entrar
            </Boton>
          </form>
        ) : AUTH_MODO === 'demo' ? (
          <>
            <p className="mb-3 text-sm text-slate-600">
              <strong>Modo demo.</strong> Elige con qué perfil entrar para ver qué puede hacer cada rol.
            </p>
            {usuarios === null ? (
              <Cargando />
            ) : (
              <div className="flex flex-col gap-2">
                {usuarios.map((u) => (
                  <button
                    key={u.id}
                    disabled={ocupado}
                    onClick={() => void ejecutar(() => ingresarDemo(u.id))}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    <p className="text-sm font-semibold text-slate-900">{u.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {ROLES[u.rol]}
                      {u.unidades.length > 0 && ` · ${u.unidades.map((x) => x.nombre).join(', ')}`}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <form onSubmit={enviar} className="flex flex-col gap-3">
            <Campo etiqueta="Correo">
              <input type="email" required autoComplete="username" className={claseEntrada} value={email} onChange={(e) => setEmail(e.target.value)} />
            </Campo>
            <Campo etiqueta="Contraseña">
              <input type="password" required autoComplete="current-password" className={claseEntrada} value={clave} onChange={(e) => setClave(e.target.value)} />
            </Campo>
            <Boton type="submit" ocupado={ocupado}>
              Ingresar
            </Boton>
          </form>
        )}
      </div>
    </div>
  )
}
