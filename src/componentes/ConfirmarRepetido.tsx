import { useCallback, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import { ErrorApi, type DetalleRepetido } from '../api'
import { Boton, Modal } from './ui'

/**
 * Pregunta qué hacer cuando la API avisa que el archivo ya está subido (409 "duplicado").
 *
 *   const repetido = useConfirmarRepetido()
 *   const r = await repetido.intentar((reemplazar) => api.post(ruta, datos(reemplazar)))
 *   if (r === null) return   // la persona canceló
 *   ...
 *   {repetido.nodo}
 */
export function useConfirmarRepetido() {
  const [aviso, setAviso] = useState<DetalleRepetido | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const responder = useCallback((ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setAviso(null)
  }, [])

  const intentar = useCallback(async <T,>(fn: (reemplazar: boolean) => Promise<T>): Promise<T | null> => {
    try {
      return await fn(false)
    } catch (e) {
      if (!(e instanceof ErrorApi) || !e.repetido) throw e
      const detalle = e.repetido
      const ok = await new Promise<boolean>((r) => {
        resolver.current = r
        setAviso(detalle)
      })
      return ok ? fn(true) : null
    }
  }, [])

  const nodo = (
    <Modal abierto={!!aviso} onCerrar={() => responder(false)} titulo="Este archivo ya está subido" ancho="max-w-lg">
      {aviso && (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">{aviso.mensaje}</p>
          <ul className="space-y-2">
            {aviso.existentes.map((x, i) => (
              <li key={`${x.nombre}-${i}`} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <Copy className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900" title={x.nombre}>{x.nombre}</span>
                  {x.detalle && <span className="block text-xs text-slate-600">{x.detalle}</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <Boton variante="secundario" onClick={() => responder(false)}>Cancelar</Boton>
            <Boton onClick={() => responder(true)}>{aviso.accion}</Boton>
          </div>
        </div>
      )}
    </Modal>
  )

  return { intentar, nodo }
}
