import { useMemo, useState } from 'react'
import { useDatos } from '../hooks'
import { fechaYHora } from '../formato'
import { Campo, Cargando, EncabezadoPagina, MensajeError, Tarjeta, Vacio, claseEntrada } from '../componentes/ui'
import { Selector } from '../componentes/Desplegable'

interface RegistroBitacora {
  id: number
  fecha_hora: string
  usuario: string
  accion: string
  entidad: string
  entidad_id: number | null
  detalle: unknown
}

function valorCompacto(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (Array.isArray(v)) return v.map(valorCompacto).join(', ')
  if (typeof v === 'object') return detalleLegible(v)
  if (typeof v === 'boolean') return v ? 'sí' : 'no'
  return String(v)
}

function detalleLegible(detalle: unknown): string {
  if (detalle === null || detalle === undefined) return ''
  if (typeof detalle !== 'object' || Array.isArray(detalle)) return valorCompacto(detalle)
  return Object.entries(detalle as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${valorCompacto(v)}`)
    .join(' · ')
}

export function Bitacora() {
  const { datos, cargando, error, recargar } = useDatos<RegistroBitacora[]>('/bitacora', { limite: 300 })
  const [entidad, setEntidad] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const entidades = useMemo(() => [...new Set((datos ?? []).map((r) => r.entidad))].sort(), [datos])
  const filas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return (datos ?? [])
      .map((r) => ({ ...r, detalleTexto: detalleLegible(r.detalle) }))
      .filter((r) => !entidad || r.entidad === entidad)
      .filter(
        (r) =>
          !texto ||
          [r.usuario, r.accion, r.entidad, String(r.entidad_id ?? ''), r.detalleTexto].some((c) => c.toLowerCase().includes(texto)),
      )
  }, [datos, entidad, busqueda])

  return (
    <div className="space-y-4">
      <EncabezadoPagina sinFiltros titulo="Bitácora" descripcion="Últimos 300 cambios de datos de negocio (usuario, fecha y hora)" />
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <Campo etiqueta="Entidad">
          <Selector className={claseEntrada} value={entidad} onChange={(e) => setEntidad(e.target.value)}>
            <option value="">Todas</option>
            {entidades.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Buscar">
          <input
            type="search"
            className={claseEntrada}
            placeholder="Usuario, acción, detalle…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </Campo>
      </div>

      <Tarjeta>
        {cargando && !datos ? (
          <Cargando variante="tabla" />
        ) : error && !datos ? (
          <MensajeError error={error} onReintentar={recargar} />
        ) : !filas.length ? (
          <Vacio>Sin registros</Vacio>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2 pr-3 font-medium">Fecha y hora</th>
                    <th className="px-3 py-2 font-medium">Usuario</th>
                    <th className="px-3 py-2 font-medium">Acción</th>
                    <th className="px-3 py-2 font-medium">Entidad</th>
                    <th className="px-3 py-2 font-medium">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 align-top">
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-slate-600">{fechaYHora(r.fecha_hora)}</td>
                      <td className="px-3 py-2 text-slate-800">{r.usuario}</td>
                      <td className="px-3 py-2 text-slate-700">{r.accion}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {r.entidad}
                        {r.entidad_id !== null && ` #${r.entidad_id}`}
                      </td>
                      <td className="break-words px-3 py-2 text-xs text-slate-600">{r.detalleTexto || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {filas.map((r) => (
                <li key={r.id} className="py-2">
                  <p className="text-xs tabular-nums text-slate-500">{fechaYHora(r.fecha_hora)}</p>
                  <p className="text-sm text-slate-800">
                    <span className="font-medium">{r.usuario}</span> · {r.accion} · {r.entidad}
                    {r.entidad_id !== null && ` #${r.entidad_id}`}
                  </p>
                  {r.detalleTexto && <p className="break-words text-xs text-slate-600">{r.detalleTexto}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </Tarjeta>
    </div>
  )
}
