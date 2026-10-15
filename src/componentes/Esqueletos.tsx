/*
  Esqueletos de carga: siluetas con brillo que anticipan la forma del contenido.
  Solo se ven en la primera carga; al recargar se mantiene lo ya mostrado (atenuado), sin parpadeo.
*/

export type VarianteCarga = 'lista' | 'tabla' | 'tarjetas' | 'panel' | 'detalle' | 'formulario'

/** Bloque base con brillo animado (se detiene con "reducir movimiento"). */
export function Hueso({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`hueso rounded-md ${className}`} style={style} aria-hidden />
}

function Envoltorio({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="animar-desvanecer-rapido">
      <span className="sr-only">{texto}</span>
      {children}
    </div>
  )
}

export function EsqueletoLista({ filas = 5 }: { filas?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/70 p-4" style={{ opacity: 1 - i * 0.12 }}>
          <Hueso className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Hueso className="h-3.5 w-2/5" />
            <Hueso className="h-3 w-3/4" />
          </div>
          <Hueso className="hidden h-7 w-20 rounded-lg sm:block" />
        </div>
      ))}
    </div>
  )
}

export function EsqueletoTabla({ filas = 6, columnas = 5 }: { filas?: number; columnas?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70">
      <div className="flex gap-4 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        {Array.from({ length: columnas }, (_, j) => <Hueso key={j} className={`h-3 ${j === 1 ? 'flex-[2]' : 'flex-1'}`} />)}
      </div>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-4 py-4 last:border-0" style={{ opacity: 1 - i * 0.1 }}>
          {Array.from({ length: columnas }, (_, j) => (
            <div key={j} className={`space-y-1.5 ${j === 1 ? 'flex-[2]' : 'flex-1'}`}>
              <Hueso className={`h-3.5 ${j === 1 ? 'w-4/5' : j === columnas - 1 ? 'w-1/2' : 'w-3/4'}`} />
              {j === 1 && <Hueso className="h-3 w-1/2" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function EsqueletoTarjetas({ cantidad = 6 }: { cantidad?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/70 p-5">
          <div className="flex items-start justify-between gap-3">
            <Hueso className="h-4 w-3/5" />
            <Hueso className="h-5 w-16 rounded-md" />
          </div>
          <Hueso className="h-3 w-4/5" />
          <Hueso className="h-3 w-2/5" />
          <Hueso className="mt-2 h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}

/** Panel con indicadores arriba, un gráfico grande y dos bloques. */
export function EsqueletoPanel() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/70 p-4">
            <Hueso className="h-8 w-16" />
            <Hueso className="h-3 w-3/4" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5">
        <Hueso className="h-4 w-48" />
        <div className="mt-6 flex h-52 items-end gap-2">
          {[45, 62, 38, 70, 55, 82, 64, 48, 74, 58, 66, 40].map((h, i) => (
            <Hueso key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <EsqueletoLista filas={3} />
        <EsqueletoLista filas={3} />
      </div>
    </div>
  )
}

/** Página de detalle: volver, título, metadatos, cuerpo y columna lateral. */
export function EsqueletoDetalle() {
  return (
    <div>
      <Hueso className="h-4 w-28" />
      <Hueso className="mt-5 h-3 w-40" />
      <Hueso className="mt-3 h-9 w-2/3 max-w-xl" />
      <Hueso className="mt-3 h-4 w-1/2 max-w-md" />
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/70 p-5">
            <Hueso className="h-4 w-32" />
            <div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }, (_, i) => <Hueso key={i} className="h-16 rounded-xl" />)}</div>
          </div>
          <EsqueletoLista filas={4} />
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/70 p-5">
          <Hueso className="h-4 w-36" />
          {Array.from({ length: 5 }, (_, i) => <Hueso key={i} className="h-3 w-full" />)}
        </div>
      </div>
    </div>
  )
}

export function EsqueletoFormulario({ campos = 4 }: { campos?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: campos }, (_, i) => (
        <div key={i} className="space-y-2">
          <Hueso className="h-3 w-24" />
          <Hueso className="h-11 w-full rounded-xl" />
        </div>
      ))}
    </div>
  )
}

export function EsqueletoCarga({ variante = 'lista', texto = 'Cargando…' }: { variante?: VarianteCarga; texto?: string }) {
  const contenido = {
    lista: <EsqueletoLista />,
    tabla: <EsqueletoTabla />,
    tarjetas: <EsqueletoTarjetas />,
    panel: <EsqueletoPanel />,
    detalle: <EsqueletoDetalle />,
    formulario: <EsqueletoFormulario />,
  }[variante]
  return <Envoltorio texto={texto}>{contenido}</Envoltorio>
}

/** Primera carga de la aplicación: la misma estructura (menú, encabezado y contenido) mientras inicia la sesión. */
export function EsqueletoApp() {
  return (
    <div role="status" aria-busy="true" className="flex h-dvh overflow-hidden bg-fondo">
      <span className="sr-only">Iniciando la aplicación…</span>
      <aside className="hidden w-72 shrink-0 flex-col bg-gradient-to-b from-emerald-700 to-emerald-900 p-5 lg:flex">
        <div className="flex items-center gap-3">
          <div className="hueso hueso-oscuro h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2"><div className="hueso hueso-oscuro h-3.5 w-3/4 rounded" /><div className="hueso hueso-oscuro h-2.5 w-1/2 rounded" /></div>
        </div>
        <div className="mt-10 space-y-3">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="hueso hueso-oscuro h-9 w-full rounded-xl" style={{ opacity: 1 - i * 0.07 }} />)}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[72px] shrink-0 items-center gap-3 bg-gradient-to-r from-emerald-700 to-emerald-800 px-6">
          <div className="hueso hueso-oscuro h-8 w-36 rounded-full" />
          <div className="hueso hueso-oscuro hidden h-8 w-40 rounded-full sm:block" />
          <div className="hueso hueso-oscuro ml-auto h-10 w-10 rounded-full" />
        </div>
        <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-8">
          <Hueso className="h-3 w-40" />
          <Hueso className="mt-3 h-10 w-64" />
          <Hueso className="mt-3 h-4 w-96 max-w-full" />
          <div className="mt-8"><EsqueletoPanel /></div>
        </div>
      </div>
    </div>
  )
}
