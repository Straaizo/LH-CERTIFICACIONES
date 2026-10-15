const fechaCorta = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fechaHora = new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' })
const numero = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 })

/** Fechas ISO 'AAAA-MM-DD' se interpretan como fecha local, sin desfase de zona horaria. */
export function fecha(valor: string | null | undefined): string {
  if (!valor) return '—'
  const [a, m, d] = valor.slice(0, 10).split('-').map(Number)
  return fechaCorta.format(new Date(a, m - 1, d))
}

export function fechaYHora(valor: string | null | undefined): string {
  if (!valor) return '—'
  return fechaHora.format(new Date(valor))
}

export function num(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : numero.format(valor)
}

export function hoyIso(): string {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
}

export function textoDias(dias: number | null | undefined): string {
  if (dias === null || dias === undefined) return ''
  if (dias < 0) return `venció hace ${-dias} d`
  if (dias === 0) return 'vence hoy'
  return `vence en ${dias} d`
}

export const ETIQUETA_RESULTADO: Record<string, string> = { si: 'Sí', no: 'No', na: 'N/A' }
export const ETIQUETA_ESTADO_NC: Record<string, string> = {
  abierta: 'Abierta',
  en_proceso: 'En proceso',
  cerrada: 'Cerrada',
}
export const ETIQUETA_ESTADO_AUDITORIA: Record<string, string> = {
  planificada: 'Planificada',
  en_curso: 'En curso',
  cerrada: 'Cerrada',
}
export const ETIQUETA_NIVEL: Record<string, string> = {
  mayor: 'Mayor',
  menor: 'Menor',
  recomendacion: 'Recomendación',
  fundamental: 'Fundamental',
}
