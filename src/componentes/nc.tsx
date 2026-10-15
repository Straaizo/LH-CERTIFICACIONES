import { CalendarClock, CheckCircle2 } from 'lucide-react'
import { fecha } from '../formato'
import type { NoConformidad, PlanNc } from '../tipos'
import { Insignia, type Tono } from './ui'

export const PORQUES = 5

export const TONO_ESTADO_NC: Record<NoConformidad['estado'], Tono> = {
  abierta: 'rojo',
  en_proceso: 'amarillo',
  cerrada: 'verde',
}

export type EstadoPlan = 'pendiente' | 'borrador' | 'enviado' | 'devuelta' | 'cerrada'

export const ETIQUETA_PLAN: Record<EstadoPlan, string> = {
  pendiente: 'Plan pendiente',
  borrador: 'Borrador',
  enviado: 'Plan enviado',
  devuelta: 'Devuelta',
  cerrada: 'Cerrada',
}

export const TONO_PLAN: Record<EstadoPlan, Tono> = {
  pendiente: 'gris',
  borrador: 'azul',
  enviado: 'verde',
  devuelta: 'rojo',
  cerrada: 'verde',
}

export function tieneContenido(plan: PlanNc): boolean {
  return plan.causa_raiz.some((p) => p.trim()) || !!plan.accion_correctiva || !!plan.accion_preventiva
}

export function estadoPlan(nc: NoConformidad): EstadoPlan {
  if (nc.estado === 'cerrada') return 'cerrada'
  if (nc.plan.enviado_en) return 'enviado'
  if (nc.ultima_revision?.resultado === 'no_cumple') return 'devuelta'
  return tieneContenido(nc.plan) ? 'borrador' : 'pendiente'
}

export function textoPlazo(dias: number | null): string {
  if (dias === null) return ''
  if (dias < 0) return `Vencido hace ${-dias} ${-dias === 1 ? 'día' : 'días'}`
  if (dias === 0) return 'Vence hoy'
  return `Quedan ${dias} ${dias === 1 ? 'día' : 'días'}`
}

type Urgencia = 'vencido' | 'pronto' | 'normal'

function urgencia(dias: number | null): Urgencia {
  if (dias === null) return 'normal'
  if (dias < 0) return 'vencido'
  return dias <= 7 ? 'pronto' : 'normal'
}

const CLASE_URGENCIA: Record<Urgencia, string> = {
  vencido: 'bg-red-50 text-red-800 ring-red-200',
  pronto: 'bg-amber-50 text-amber-900 ring-amber-200',
  normal: 'bg-slate-50 text-slate-700 ring-slate-200',
}

/** Plazo compacto para listas: fecha + días restantes con color semántico. */
export function ChipPlazo({ nc }: { nc: NoConformidad }) {
  if (nc.estado === 'cerrada') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Cerrada {nc.cerrada_en ? fecha(nc.cerrada_en) : ''}
      </span>
    )
  }
  if (!nc.plazo) return <span className="text-xs text-slate-500">Sin plazo</span>
  const u = urgencia(nc.dias_para_plazo)
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CLASE_URGENCIA[u]}`}
    >
      <CalendarClock className="h-3.5 w-3.5" aria-hidden />
      {fecha(nc.plazo)}
      {nc.dias_para_plazo !== null && <span className="font-semibold">· {textoPlazo(nc.dias_para_plazo)}</span>}
    </span>
  )
}

/** Plazo destacado para el encabezado del detalle. */
export function BloquePlazo({ nc }: { nc: NoConformidad }) {
  if (nc.estado === 'cerrada') {
    return (
      <div className="rounded-lg bg-emerald-50 px-3 py-2 ring-1 ring-inset ring-emerald-200">
        <p className="text-xs font-medium text-emerald-800">Cerrada</p>
        <p className="text-sm font-semibold text-emerald-900">{nc.cerrada_en ? fecha(nc.cerrada_en) : '—'}</p>
      </div>
    )
  }
  if (!nc.plazo) {
    return (
      <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-inset ring-slate-200">
        <p className="text-xs font-medium text-slate-600">Plazo de 28 días</p>
        <p className="text-sm text-slate-700">Se fija al emitir el informe</p>
      </div>
    )
  }
  const u = urgencia(nc.dias_para_plazo)
  return (
    <div className={`rounded-lg px-3 py-2 ring-1 ring-inset ${CLASE_URGENCIA[u]}`}>
      <p className="text-xs font-medium">Fecha límite</p>
      <p className="text-base font-semibold tabular-nums">{fecha(nc.plazo)}</p>
      {nc.dias_para_plazo !== null && <p className="text-xs font-semibold">{textoPlazo(nc.dias_para_plazo)}</p>}
    </div>
  )
}

export function InsigniaReincidente({ nc }: { nc: NoConformidad }) {
  if (nc.reincidencias <= 0) return null
  return (
    <Insignia tono="rojo" titulo={nc.ultima_revision?.observacion ?? undefined}>
      Reincidente ×{nc.reincidencias}
    </Insignia>
  )
}

export function Esqueleto({ className = '' }: { className?: string }) {
  return <div className={`hueso rounded-md ${className}`} aria-hidden />
}
