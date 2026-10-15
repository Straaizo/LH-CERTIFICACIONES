import { useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Search } from 'lucide-react'
import {
  ChipPlazo,
  ETIQUETA_PLAN,
  Esqueleto,
  InsigniaReincidente,
  TONO_ESTADO_NC,
  TONO_PLAN,
  estadoPlan,
} from '../componentes/nc'
import { EncabezadoPagina, Insignia, MensajeError, TextoConEnlaces, claseEntrada } from '../componentes/ui'
import { useSesionActiva } from '../contexto/Sesion'
import { ETIQUETA_ESTADO_NC } from '../formato'
import { useDatos } from '../hooks'
import type { NoConformidad } from '../tipos'

type Filtro = 'pendientes' | 'revision' | 'devueltas' | 'cerradas' | 'todas'

const FILTROS: { valor: Filtro; etiqueta: string; prueba: (nc: NoConformidad) => boolean }[] = [
  { valor: 'pendientes', etiqueta: 'Pendientes', prueba: (nc) => nc.estado !== 'cerrada' },
  { valor: 'revision', etiqueta: 'En revisión', prueba: (nc) => estadoPlan(nc) === 'enviado' },
  { valor: 'devueltas', etiqueta: 'Devueltas', prueba: (nc) => estadoPlan(nc) === 'devuelta' },
  { valor: 'cerradas', etiqueta: 'Cerradas', prueba: (nc) => nc.estado === 'cerrada' },
  { valor: 'todas', etiqueta: 'Todas', prueba: () => true },
]

const PRIORIDAD_CERTIFICACIONES = { enviado: 0, devuelta: 1, borrador: 2, pendiente: 2, cerrada: 3 }
const PRIORIDAD_ENCARGADO = { devuelta: 0, pendiente: 1, borrador: 1, enviado: 2, cerrada: 3 }

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function NoConformidades() {
  const [parametros] = useSearchParams()
  const ncAntigua = Number(parametros.get('nc')) || null
  if (ncAntigua) return <Navigate to={`/no-conformidades/${ncAntigua}`} replace />
  return <ListaNoConformidades />
}

function ListaNoConformidades() {
  const { filtros, esCertificaciones, usuario } = useSesionActiva()
  const esEncargado = usuario.rol === 'encargado'
  const [filtro, setFiltro] = useState<Filtro>('pendientes')
  const [busqueda, setBusqueda] = useState('')
  const [soloReincidentes, setSoloReincidentes] = useState(false)
  const { datos, cargando, error, recargar } = useDatos<NoConformidad[]>('/no-conformidades', { ...filtros })
  const { datos: codigos } = useDatos<Record<string, number>>('/documentos/codigos')

  const base = useMemo(() => {
    const texto = normalizar(busqueda.trim())
    return (datos ?? []).filter((nc) => {
      if (soloReincidentes && nc.reincidencias <= 0) return false
      if (!texto) return true
      return normalizar(
        [nc.requisito.codigo, nc.protocolo.codigo, nc.auditoria.titulo, nc.descripcion, nc.unidad.nombre, nc.clausula].join(' '),
      ).includes(texto)
    })
  }, [datos, busqueda, soloReincidentes])

  const contadores = useMemo(
    () => Object.fromEntries(FILTROS.map((f) => [f.valor, base.filter(f.prueba).length])) as Record<Filtro, number>,
    [base],
  )

  const lista = useMemo(() => {
    const prioridad = esCertificaciones ? PRIORIDAD_CERTIFICACIONES : PRIORIDAD_ENCARGADO
    const prueba = FILTROS.find((f) => f.valor === filtro)!.prueba
    return base.filter(prueba).sort((a, b) => {
      const p = prioridad[estadoPlan(a)] - prioridad[estadoPlan(b)]
      if (p) return p
      return (a.dias_para_plazo ?? Infinity) - (b.dias_para_plazo ?? Infinity)
    })
  }, [base, filtro, esCertificaciones])

  return (
    <div>
      <EncabezadoPagina
        titulo={esEncargado ? 'Mis no conformidades' : 'No conformidades'}
        descripcion={
          esEncargado
            ? 'Completa el análisis, las acciones y la evidencia de cada una y envíala a certificaciones.'
            : "Cada 'No' de una auditoría genera una. Revisa lo enviado por los jefes de área y cierra con evidencia."
        }
      />

      <div className="mb-4 space-y-3">
        <div role="group" aria-label="Filtrar por estado" className="sin-barra -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {FILTROS.map((f) => {
            const activo = filtro === f.valor
            return (
              <button
                key={f.valor}
                type="button"
                aria-pressed={activo}
                onClick={() => setFiltro(f.valor)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:min-h-9 ${
                  activo
                    ? 'bg-emerald-700 text-white ring-emerald-700'
                    : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
                }`}
              >
                {f.etiqueta}
                <span
                  className={`min-w-6 rounded-full px-1.5 text-center text-xs tabular-nums ${
                    activo ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {datos ? contadores[f.valor] : '–'}
                </span>
              </button>
            )
          })}
        </div>
        <div className="grid gap-2 sm:flex sm:items-center sm:gap-4">
          <label className="relative block sm:w-80">
            <span className="sr-only">Buscar</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
            <input
              type="search"
              className={`${claseEntrada} min-h-11 pl-9 sm:min-h-0`}
              placeholder="Buscar por código, auditoría o texto"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700 sm:min-h-0">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-700"
              checked={soloReincidentes}
              onChange={(e) => setSoloReincidentes(e.target.checked)}
            />
            Solo reincidentes
          </label>
        </div>
      </div>

      {cargando && !datos ? (
        <ul className="space-y-2" aria-busy="true" aria-label="Cargando no conformidades">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="rounded-xl border border-slate-200 bg-white p-4">
              <Esqueleto className="h-4 w-40" />
              <Esqueleto className="mt-2 h-3 w-64" />
              <Esqueleto className="mt-3 h-3 w-full" />
              <Esqueleto className="mt-1.5 h-3 w-2/3" />
            </li>
          ))}
        </ul>
      ) : error ? (
        <MensajeError error={error} onReintentar={recargar} />
      ) : !lista.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">
            {datos?.length ? 'Nada coincide con estos filtros' : 'No hay no conformidades'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {datos?.length
              ? 'Prueba con otro estado o limpia la búsqueda.'
              : esEncargado
                ? 'Aparecen aquí cuando se emite el informe de una auditoría.'
                : 'Se generan al responder "No" en una auditoría.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {lista.map((nc) => (
            <FilaNc key={nc.id} nc={nc} codigos={codigos ?? {}} esCertificaciones={esCertificaciones} />
          ))}
        </ul>
      )}
    </div>
  )
}

function FilaNc({ nc, codigos, esCertificaciones }: {
  nc: NoConformidad
  codigos: Record<string, number>
  esCertificaciones: boolean
}) {
  const plan = estadoPlan(nc)
  const porRevisar = esCertificaciones && plan === 'enviado'
  const accionJefe = !esCertificaciones && (plan === 'devuelta' || plan === 'pendiente' || plan === 'borrador')
  return (
    <li>
      <Link
        to={`/no-conformidades/${nc.id}`}
        className={`group flex gap-3 rounded-xl border bg-white p-4 shadow-sm transition-colors hover:border-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
          porRevisar ? 'border-emerald-300 ring-1 ring-emerald-200' : plan === 'devuelta' && !esCertificaciones ? 'border-red-200' : 'border-slate-200'
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="flex min-w-0 items-baseline gap-2">
              <span className="font-mono text-sm font-semibold text-slate-900">{nc.requisito.codigo}</span>
              <span className="text-xs font-medium text-slate-500">{nc.protocolo.codigo}</span>
              {porRevisar && <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-semibold text-white">Por revisar</span>}
              {accionJefe && plan === 'devuelta' && (
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">Corregir</span>
              )}
            </p>
            <ChipPlazo nc={nc} />
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500" title={nc.auditoria.titulo}>{nc.auditoria.titulo}</p>
          <p className="mt-2 line-clamp-2 text-sm text-slate-700">
            <TextoConEnlaces texto={nc.descripcion} codigos={codigos} />
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="mr-1 font-medium text-slate-600">{nc.unidad.nombre}</span>
            <Insignia tono={TONO_ESTADO_NC[nc.estado]}>{ETIQUETA_ESTADO_NC[nc.estado]}</Insignia>
            {plan !== 'cerrada' && nc.auditoria.emitida_en && <Insignia tono={TONO_PLAN[plan]}>{ETIQUETA_PLAN[plan]}</Insignia>}
            {!nc.auditoria.emitida_en && <Insignia>Informe sin emitir</Insignia>}
            <InsigniaReincidente nc={nc} />
          </div>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 self-center text-slate-300 group-hover:text-emerald-600" aria-hidden />
      </Link>
    </li>
  )
}
