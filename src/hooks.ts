import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

type Params = Record<string, string | number | boolean | null | undefined>

/** GET con estado de carga y error. Se vuelve a pedir cuando cambian la ruta o los parámetros. */
export function useDatos<T>(ruta: string | null, params?: Params) {
  const [datos, setDatos] = useState<T | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const clave = JSON.stringify(params ?? {})
  const solicitud = useRef(0)

  const recargar = useCallback(async () => {
    if (!ruta) return
    const id = ++solicitud.current
    setCargando(true)
    try {
      const respuesta = await api.get<T>(ruta, JSON.parse(clave) as Params)
      if (id === solicitud.current) {
        setDatos(respuesta)
        setError(null)
      }
    } catch (e) {
      if (id === solicitud.current) setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      if (id === solicitud.current) setCargando(false)
    }
  }, [ruta, clave])

  useEffect(() => {
    void recargar()
  }, [recargar])

  return { datos, cargando, error, recargar, setDatos }
}

/** Ejecuta una acción mostrando su estado; devuelve true si terminó bien. */
export function useAccion() {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ejecutar = useCallback(async (fn: () => Promise<unknown>) => {
    setOcupado(true)
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error')
      return false
    } finally {
      setOcupado(false)
    }
  }, [])
  return { ocupado, error, setError, ejecutar }
}
