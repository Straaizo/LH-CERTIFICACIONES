import { useMemo, useState } from 'react'
import { FileSpreadsheet, Search } from 'lucide-react'
import { useDatos } from '../hooks'
import { fecha } from '../formato'
import { Cargando, Insignia, MensajeError, Modal, Vacio, claseEntrada } from './ui'

interface VersionDetalle {
  id: number
  nombre: string
  vigente: boolean
  cargada_en: string | null
  archivo: string | null
  protocolo: { codigo: string; nombre: string }
  requisitos: { id: number; codigo: string; seccion: string | null; seccion_titulo: string | null; texto: string; nivel: string | null }[]
}

const NIVEL: Record<string, { texto: string; tono: 'rojo' | 'amarillo' | 'gris' }> = {
  mayor: { texto: 'Obligación mayor', tono: 'rojo' },
  menor: { texto: 'Obligación menor', tono: 'amarillo' },
  recomendacion: { texto: 'Recomendación', tono: 'gris' },
  fundamental: { texto: 'Fundamental', tono: 'rojo' },
}

/** Puntos de control de una versión de norma, agrupados por sección y con buscador (solo lectura). */
export function VerVersionNorma({ versionId, onCerrar }: { versionId: number; onCerrar: () => void }) {
  const { datos, cargando, error, recargar } = useDatos<VersionDetalle>(`/versiones/${versionId}/requisitos`)
  const [busqueda, setBusqueda] = useState('')
  const grupos = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const filtrados = (datos?.requisitos ?? []).filter(
      (r) => !q || r.codigo.toLowerCase().includes(q) || r.texto.toLowerCase().includes(q),
    )
    const mapa = new Map<string, { titulo: string; items: typeof filtrados }>()
    for (const r of filtrados) {
      const clave = r.seccion ?? '—'
      if (!mapa.has(clave)) mapa.set(clave, { titulo: r.seccion_titulo ?? '', items: [] })
      mapa.get(clave)?.items.push(r)
    }
    return [...mapa.entries()]
  }, [datos, busqueda])

  return (
    <Modal abierto titulo={datos ? `${datos.protocolo.nombre} · ${datos.nombre}` : 'Versión de la norma'} onCerrar={onCerrar} ancho="max-w-4xl">
      <MensajeError error={error} onReintentar={recargar} />
      {cargando && !datos ? (
        <Cargando variante="lista" />
      ) : datos ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            {datos.vigente ? <Insignia tono="verde">Vigente</Insignia> : <Insignia>Versión anterior</Insignia>}
            <span>{datos.requisitos.length} puntos de control</span>
            {datos.cargada_en && <span>· cargada el {fecha(datos.cargada_en)}</span>}
            {datos.archivo && (
              <span className="inline-flex min-w-0 items-center gap-1 truncate" title={datos.archivo}>
                · <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{datos.archivo}</span>
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input className={`${claseEntrada} pl-9`} placeholder="Buscar por código o texto" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          {!grupos.length ? (
            <Vacio>Ningún punto coincide con la búsqueda.</Vacio>
          ) : (
            <div className="space-y-4">
              {grupos.map(([seccion, g]) => (
                <section key={seccion}>
                  <h3 className="sticky -top-5 z-10 -mx-5 border-b border-slate-200/70 bg-superficie px-5 pb-2 pt-3 text-sm font-bold text-slate-900">
                    <span className="font-mono text-emerald-800">{seccion}</span> {g.titulo}
                    <span className="ml-2 text-xs font-normal text-slate-500">{g.items.length}</span>
                  </h3>
                  <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                    {g.items.map((r) => (
                      <li key={r.id} className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-emerald-800">{r.codigo}</span>
                          {r.nivel && NIVEL[r.nivel] && <Insignia tono={NIVEL[r.nivel].tono}>{NIVEL[r.nivel].texto}</Insignia>}
                        </div>
                        <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{r.texto}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  )
}
