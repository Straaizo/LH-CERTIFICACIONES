import { useState } from 'react'
import { useSesionActiva } from '../contexto/Sesion'
import { num } from '../formato'
import { EncabezadoPagina, Insignia, Pestanas, Tarjeta, Vacio } from '../componentes/ui'

type Vista = 'sitios' | 'protocolos' | 'categorias' | 'analisis' | 'agua'

const AMBITOS: Record<string, string> = {
  ambos: 'Campo y planta', campo: 'Campo', planta: 'Planta', social: 'Social' }

function etiquetaAmbito(a: string) {
  return AMBITOS[a] ?? a
}

function Sitios() {
  const { catalogos } = useSesionActiva()
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {catalogos.empresas.map((e) => {
        const unidades = catalogos.unidades.filter((u) => u.empresa_id === e.id)
        // Agrupadas por tipo de sucursal (general_dim_sucursaltipo): Campo, Packing…
        const tipos = [...new Set(unidades.map((u) => u.tipo_nombre))]
        return (
          <Tarjeta key={e.id} titulo={`${e.codigo} · ${e.nombre}`}>
            {!unidades.length ? (
              <Vacio>Sin sucursales visibles</Vacio>
            ) : (
              <ul className="space-y-3">
                {tipos.map((tipo) => (
                  <li key={tipo}>
                    <p className="text-sm font-semibold text-slate-800">{tipo}</p>
                    <ul className="mt-1 space-y-2 border-l-2 border-slate-200 pl-3">
                      {unidades
                        .filter((u) => u.tipo_nombre === tipo)
                        .map((u) => {
                          const normas = catalogos.protocolos.filter((p) => p.unidades_aplica.includes(u.id))
                          const areas = catalogos.areas.filter((a) => a.unidad_id === u.id)
                          return (
                            <li key={u.id}>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm text-slate-800">{u.nombre}</span>
                                <span className="font-mono text-[11px] text-slate-400">#{u.id}</span>
                              </div>
                              {normas.length > 0 && (
                                <p className="mt-0.5 text-xs text-slate-500">{normas.map((p) => p.nombre).join(' · ')}</p>
                              )}
                              {areas.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {areas.map((a) => (
                                    <Insignia key={a.id}>{a.nombre}</Insignia>
                                  ))}
                                </div>
                              )}
                            </li>
                          )
                        })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        )
      })}
    </div>
  )
}

function Protocolos() {
  const { catalogos } = useSesionActiva()
  const ambitos = [...new Set(catalogos.protocolos.map((p) => p.ambito))]
  return (
    <div className="space-y-4">
      {ambitos.map((a) => (
        <Tarjeta key={a} titulo={etiquetaAmbito(a)}>
          <ul className="divide-y divide-slate-100">
            {catalogos.protocolos
              .filter((p) => p.ambito === a)
              .map((p) => (
                <li key={p.id} className="py-2">
                  <p className="text-sm font-medium text-slate-800">
                    {p.nombre} <span className="font-normal text-slate-500">({p.codigo})</span>
                  </p>
                  {p.solo_unidades.length > 0 && (
                    <p className="text-xs text-slate-500">
                      Solo en: {catalogos.unidades.filter((u) => p.solo_unidades.includes(u.id)).map((u) => u.nombre).join(', ')}
                    </p>
                  )}
                  {p.versiones.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.versiones.map((v) => (
                        <Insignia key={v.id} tono={v.vigente ? 'verde' : 'gris'} titulo={v.vigente ? 'Versión vigente' : 'Versión anterior'}>
                          {v.nombre} · {v.requisitos} requisitos
                        </Insignia>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Sin versiones cargadas</p>
                  )}
                </li>
              ))}
          </ul>
        </Tarjeta>
      ))}
    </div>
  )
}

function Categorias() {
  const { catalogos } = useSesionActiva()
  return (
    <Tarjeta>
      <ul className="divide-y divide-slate-100">
        {catalogos.categorias.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div>
              <p className="text-sm text-slate-800">{c.nombre}</p>
              <p className="text-xs text-slate-500">{etiquetaAmbito(c.ambito)}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {c.requiere_vencimiento && <Insignia tono="amarillo">Exige vencimiento</Insignia>}
              {c.requiere_codigo && <Insignia tono="azul">Exige código</Insignia>}
            </div>
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}

function TiposAnalisis() {
  const { catalogos } = useSesionActiva()
  const rango = (min: number | null, max: number | null) =>
    min !== null && max !== null ? `${num(min)} – ${num(max)}` : min !== null ? `≥ ${num(min)}` : max !== null ? `≤ ${num(max)}` : '—'
  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Los límites están pendientes de confirmar. Si necesitas cambiarlos, comunícate con TI.
      </p>
      {catalogos.tipos_analisis.map((t) => {
        const limites = catalogos.limites.filter((l) => l.tipo_analisis_id === t.id)
        return (
          <Tarjeta
            key={t.id}
            titulo={t.nombre}
            acciones={
              <>
                <Insignia>{etiquetaAmbito(t.ambito)}</Insignia>
                {t.usa_fuente_agua && <Insignia tono="azul">Por fuente de agua</Insignia>}
              </>
            }
          >
            {!limites.length ? (
              <p className="text-sm text-slate-500">Sin límites definidos</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-2 pr-3 font-medium">Parámetro</th>
                      <th className="px-3 py-2 font-medium">Rango permitido</th>
                      <th className="px-3 py-2 font-medium">Unidad</th>
                      <th className="px-3 py-2 font-medium">Norma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {limites.map((l) => (
                      <tr key={l.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-slate-800">{l.parametro}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-700">{rango(l.minimo, l.maximo)}</td>
                        <td className="px-3 py-2 text-slate-600">{l.unidad_medida ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{l.norma ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>
        )
      })}
    </div>
  )
}

function FuentesAgua() {
  const { catalogos } = useSesionActiva()
  if (!catalogos.fuentes_agua.length) return <Vacio>Sin fuentes de agua visibles</Vacio>
  return (
    <Tarjeta>
      <ul className="divide-y divide-slate-100">
        {catalogos.fuentes_agua.map((f) => (
          <li key={f.id} className="py-2">
            <p className="text-sm font-medium text-slate-800">{f.nombre}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {f.unidades.map((id) => (
                <Insignia key={id}>{catalogos.unidades.find((u) => u.id === id)?.nombre ?? `Unidad #${id}`}</Insignia>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}

export function Configuracion() {
  const [vista, setVista] = useState<Vista>('sitios')
  return (
    <div className="space-y-4">
      <EncabezadoPagina sinFiltros titulo="Configuración" descripcion="Catálogos del sistema (solo lectura)" />
      <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
        Sucursales, empresas y temporadas vienen de las tablas generales de la empresa. Los usuarios, sus permisos y sucursales se administran en el portal web.
      </p>
      <Pestanas
        opciones={[
          { valor: 'sitios', etiqueta: 'Sucursales' },
          { valor: 'protocolos', etiqueta: 'Protocolos' },
          { valor: 'categorias', etiqueta: 'Categorías de documentos' },
          { valor: 'analisis', etiqueta: 'Tipos de análisis' },
          { valor: 'agua', etiqueta: 'Fuentes de agua' },
        ]}
        valor={vista}
        onCambio={setVista}
      />
      {vista === 'sitios' && <Sitios />}
      {vista === 'protocolos' && <Protocolos />}
      {vista === 'categorias' && <Categorias />}
      {vista === 'analisis' && <TiposAnalisis />}
      {vista === 'agua' && <FuentesAgua />}
    </div>
  )
}
