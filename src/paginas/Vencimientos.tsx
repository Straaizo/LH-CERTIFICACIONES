import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, BadgeCheck, CalendarClock, ChevronRight, Clock, FolderOpen, Search } from 'lucide-react'
import { useSesionActiva } from '../contexto/Sesion'
import { useDatos } from '../hooks'
import { fecha } from '../formato'
import type { Vencimiento } from '../tipos'
import { Cargando, EncabezadoPagina, MensajeError, Vacio, claseEntrada } from '../componentes/ui'

interface RespuestaVencimientos {
  grupos: string[]
  items: Vencimiento[]
}

type Grupo = 'vencido' | '7' | '30' | '60' | 'vigente'
// Orden explícito: en un objeto, JavaScript pone primero las claves numéricas ('7', '30', '60')
const ORDEN: Grupo[] = ['vencido', '7', '30', '60', 'vigente']

/** Estados del panel, de más a menos urgente. */
const ESTADOS: Record<Grupo, { titulo: string; corto: string; icono: typeof Clock; tarjeta: string; numero: string; pildora: string }> = {
  vencido: {
    titulo: 'Vencidos', corto: 'Vencido', icono: AlertTriangle,
    tarjeta: 'border-red-200 bg-red-50/60', numero: 'text-red-700', pildora: 'bg-red-50 text-red-700 ring-red-200',
  },
  '7': {
    titulo: 'Vencen en 7 días', corto: 'Vence pronto', icono: Clock,
    tarjeta: 'border-amber-200 bg-amber-50/60', numero: 'text-amber-700', pildora: 'bg-amber-50 text-amber-800 ring-amber-200',
  },
  '30': {
    titulo: 'Vencen en 30 días', corto: 'Por vencer', icono: CalendarClock,
    tarjeta: 'border-slate-200 bg-superficie', numero: 'text-amber-700', pildora: 'bg-amber-50 text-amber-800 ring-amber-200',
  },
  '60': {
    titulo: 'Vencen en 60 días', corto: 'Por vencer', icono: CalendarClock,
    tarjeta: 'border-slate-200 bg-superficie', numero: 'text-slate-900', pildora: 'bg-slate-100 text-slate-700 ring-slate-200',
  },
  vigente: {
    titulo: 'Vigentes', corto: 'Vigente', icono: BadgeCheck,
    tarjeta: 'border-slate-200 bg-superficie', numero: 'text-emerald-700', pildora: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  },
}

function textoEstado(v: Vencimiento): string {
  if (v.dias < 0) return `Venció hace ${-v.dias} ${-v.dias === 1 ? 'día' : 'días'}`
  if (v.dias === 0) return 'Vence hoy'
  return `Vence en ${v.dias} ${v.dias === 1 ? 'día' : 'días'}`
}

/** Línea secundaria: empresa, N° de certificado y sucursales que cubre (o su código si no tiene ficha). */
function detalleCertificado(v: Vencimiento): string {
  const c = v.certificado
  if (!c) return [v.empresa, v.codigo].filter(Boolean).join(' · ')
  const sucursales = c.unidades.length === 0 ? null
    : c.unidades.length <= 2 ? c.unidades.map((u) => u.nombre).join(' y ')
      : `${c.unidades.length} sucursales`
  return [v.empresa, c.numero && `N° ${c.numero}`, sucursales].filter(Boolean).join(' · ')
}

function EstadoPildora({ v }: { v: Vencimiento }) {
  const e = ESTADOS[(v.grupo as Grupo) ?? 'vigente'] ?? ESTADOS.vigente
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${e.pildora}`}>
      {textoEstado(v)}
    </span>
  )
}

export function Vencimientos() {
  const { filtros, esCertificaciones } = useSesionActiva()
  const navegar = useNavigate()
  const [grupo, setGrupo] = useState<Grupo | ''>('')
  const [busqueda, setBusqueda] = useState('')
  const { datos, cargando, error, recargar } = useDatos<RespuestaVencimientos>('/vencimientos', {
    empresa_id: filtros.empresa_id,
    unidad_id: filtros.unidad_id,
  })

  const items = datos?.items ?? []
  const cuenta = (g: Grupo) => items.filter((i) => i.grupo === g).length
  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return items.filter((i) =>
      (!grupo || i.grupo === grupo) &&
      (!q || i.titulo.toLowerCase().includes(q) || (i.codigo ?? '').toLowerCase().includes(q) ||
        (i.certificado?.numero ?? '').toLowerCase().includes(q)))
  }, [items, grupo, busqueda])
  const abrir = (v: Vencimiento) => navegar(`/registros?doc=${v.id}`)

  return (
    <div>
      <EncabezadoPagina
        sinFiltros
        titulo="Vencimientos"
        descripcion="Certificados subidos como documentos fijos, ordenados por fecha de vencimiento. Para agregar o renovar un certificado, súbelo en Documentos fijos con la categoría Certificados."
        acciones={esCertificaciones && (
          <Link
            to="/registros"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
          >
            <FolderOpen className="h-4 w-4" /> Ir a documentos fijos
          </Link>
        )}
      />

      <MensajeError error={error} onReintentar={recargar} />
      {cargando && !datos ? (
        <Cargando variante="panel" />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {ORDEN.map((g) => {
              const e = ESTADOS[g]
              const Icono = e.icono
              const activo = grupo === g
              return (
                <button
                  key={g}
                  onClick={() => setGrupo(activo ? '' : g)}
                  aria-pressed={activo}
                  className={`rounded-2xl border p-4 text-left shadow-[0_1px_2px_rgba(16,40,16,0.04)] transition ${e.tarjeta} ${
                    activo ? 'ring-2 ring-emerald-600 ring-offset-1' : 'hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-3xl font-bold tabular-nums ${e.numero}`}>{cuenta(g)}</span>
                    <Icono className={`h-5 w-5 ${e.numero}`} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{e.titulo}</p>
                </button>
              )
            })}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                className={`${claseEntrada} pl-9`}
                placeholder="Buscar certificado, código o N°"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            {grupo && (
              <button onClick={() => setGrupo('')} className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
                Ver todos ({items.length})
              </button>
            )}
          </div>

          {!items.length ? (
            <Vacio>
              No hay certificados con fecha de vencimiento. Súbelos en Documentos fijos con la categoría Certificados.
            </Vacio>
          ) : !lista.length ? (
            <Vacio>Ningún certificado coincide con el filtro.</Vacio>
          ) : (
            <>
              {/* Celular */}
              <ul className="space-y-3 md:hidden">
                {lista.map((v) => (
                  <li key={v.id}>
                    <button
                      onClick={() => abrir(v)}
                      className="block w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <EstadoPildora v={v} />
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                      </div>
                      <p className="mt-2 font-semibold text-slate-900">{v.titulo}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {v.unidad} · {detalleCertificado(v)}
                      </p>
                      <p className="mt-2 text-sm text-slate-700">Vence el <strong>{fecha(v.vence)}</strong></p>
                    </button>
                  </li>
                ))}
              </ul>

              {/* Tablet y escritorio */}
              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">Certificado</th>
                      <th className="px-4 py-2.5">Sección</th>
                      <th className="px-4 py-2.5">Versión</th>
                      <th className="px-4 py-2.5">Vence</th>
                      <th className="px-4 py-2.5">Estado</th>
                      <th className="px-4 py-2.5"><span className="sr-only">Abrir</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lista.map((v) => (
                      <tr key={v.id} onClick={() => abrir(v)} className="cursor-pointer hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{v.titulo}</p>
                          <p className="text-xs text-slate-500">{detalleCertificado(v)}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{v.unidad}</td>
                        <td className="px-4 py-3 text-slate-600">{v.certificado?.norma_version ?? `v${v.version}`}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{fecha(v.vence)}</td>
                        <td className="px-4 py-3"><EstadoPildora v={v} /></td>
                        <td className="px-4 py-3 text-right"><ChevronRight className="ml-auto h-4 w-4 text-slate-400" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <p className="mt-6 text-xs text-slate-500">
            Aviso por correo a 60, 30 y 7 días del vencimiento: lo enviará un proceso diario (servicio de correo pendiente de definir).
          </p>
        </>
      )}
    </div>
  )
}
