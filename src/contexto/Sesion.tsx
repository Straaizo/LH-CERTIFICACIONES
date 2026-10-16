import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { AUTH_MODO, api, configurarAuth, guardarTokens, tokenAcceso, type Tokens } from '../api'
import type { Catalogos, Filtros, Permiso, Usuario } from '../tipos'

interface ValorSesion {
  usuario: Usuario | null
  catalogos: Catalogos | null
  cargando: boolean
  error: string | null
  filtros: Filtros
  setFiltros: (f: Filtros) => void
  ingresarDemo: (id: string) => Promise<void>
  ingresar: (usuario: string, clave: string) => Promise<void>
  salir: () => Promise<void>
  esCertificaciones: boolean
  puedeEscribir: boolean
  /** Puede editar en el módulo: tiene el permiso del portal web o es administrador */
  puede: (permiso: Permiso) => boolean
  recargarCatalogos: () => Promise<void>
}

const ContextoSesion = createContext<ValorSesion | null>(null)
const CLAVE_DEMO = 'certificaciones.usuarioDemo'
const CLAVE_FILTROS = 'certificaciones.filtros'

function leerLocal(clave: string): string | null {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function guardarLocal(clave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(clave)
    else localStorage.setItem(clave, valor)
  } catch {
    /* almacenamiento no disponible */
  }
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtros, setFiltrosEstado] = useState<Filtros>(() => {
    try {
      return JSON.parse(leerLocal(CLAVE_FILTROS) ?? '{}') as Filtros
    } catch {
      return {}
    }
  })

  const setFiltros = useCallback((f: Filtros) => {
    setFiltrosEstado(f)
    guardarLocal(CLAVE_FILTROS, JSON.stringify(f))
  }, [])

  const cargarSesion = useCallback(async () => {
    try {
      const [yo, cat] = await Promise.all([api.get<Usuario>('/yo'), api.get<Catalogos>('/catalogos')])
      setUsuario(yo)
      setCatalogos(cat)
      setError(null)
      setFiltrosEstado((prev) => {
        // Temporada actual por defecto; se descartan filtros de unidades sin acceso
        const unidadValida = prev.unidad_id && cat.unidades.some((u) => u.id === prev.unidad_id)
        return {
          ...prev,
          unidad_id: unidadValida ? prev.unidad_id : undefined,
          protocolo_id: undefined,
          temporada_id: prev.temporada_id ?? cat.temporadas.find((t) => t.actual)?.id,
        }
      })
    } catch (e) {
      setUsuario(null)
      setError(e instanceof Error ? e.message : 'Error al iniciar sesión')
      throw e
    }
  }, [])

  useEffect(() => {
    const iniciar = async () => {
      try {
        if (AUTH_MODO === 'demo') {
          const id = leerLocal(CLAVE_DEMO)
          configurarAuth(async () => {
            const actual = leerLocal(CLAVE_DEMO)
            return actual ? { 'X-Usuario-Demo': actual } : ({} as Record<string, string>)
          })
          if (id) await cargarSesion()
        } else {
          configurarAuth(async () => {
            const token = tokenAcceso()
            return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)
          })
          if (tokenAcceso()) await cargarSesion()
        }
      } catch {
        guardarLocal(CLAVE_DEMO, null)
        guardarTokens(null)
      } finally {
        setCargando(false)
      }
    }
    void iniciar()
  }, [cargarSesion])

  const ingresarDemo = async (id: string) => {
    guardarLocal(CLAVE_DEMO, id)
    setFiltros({})
    await cargarSesion()
  }

  const ingresar = async (identificador: string, clave: string) => {
    guardarTokens(await api.post<Tokens>('/auth/login', { usuario: identificador.trim(), clave }))
    setFiltros({})
    await cargarSesion()
  }

  const salir = async () => {
    if (AUTH_MODO === 'demo') guardarLocal(CLAVE_DEMO, null)
    else guardarTokens(null)
    setUsuario(null)
    setCatalogos(null)
  }

  const puede = useCallback(
    (permiso: Permiso) => !!usuario && (usuario.rol === 'certificaciones' || usuario.permisos.includes(permiso)),
    [usuario],
  )

  const recargarCatalogos = async () => {
    setCatalogos(await api.get<Catalogos>('/catalogos'))
  }

  return (
    <ContextoSesion.Provider
      value={{
        usuario,
        catalogos,
        cargando,
        error,
        filtros,
        setFiltros,
        ingresarDemo,
        ingresar,
        salir,
        esCertificaciones: usuario?.rol === 'certificaciones',
        puedeEscribir: !!usuario && usuario.rol !== 'lectura',
        puede,
        recargarCatalogos,
      }}
    >
      {children}
    </ContextoSesion.Provider>
  )
}

export function useSesion(): ValorSesion {
  const valor = useContext(ContextoSesion)
  if (!valor) throw new Error('useSesion fuera de ProveedorSesion')
  return valor
}

/** Sesión ya iniciada: usuario y catálogos garantizados. */
export function useSesionActiva() {
  const s = useSesion()
  if (!s.usuario || !s.catalogos) throw new Error('Sesión no iniciada')
  return { ...s, usuario: s.usuario, catalogos: s.catalogos }
}
