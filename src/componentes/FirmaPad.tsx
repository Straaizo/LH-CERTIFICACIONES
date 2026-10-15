import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Check, Eraser } from 'lucide-react'
import { Boton } from './ui'

/** Firma en pantalla con dedo, lápiz o mouse. Entrega un PNG listo para subir. */
export function FirmaPad({ onFirmar, ocupado = false }: { onFirmar: (archivo: File) => void; ocupado?: boolean }) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const dibujando = useRef(false)
  const [conTrazo, setConTrazo] = useState(false)

  useEffect(() => {
    const canvas = lienzo.current
    if (!canvas) return
    const proporcion = window.devicePixelRatio || 1
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = width * proporcion
    canvas.height = height * proporcion
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(proporcion, proporcion)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
  }, [])

  const punto = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const iniciar = (e: PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext('2d')
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dibujando.current = true
    const { x, y } = punto(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 0.1, y + 0.1)
    ctx.stroke()
    setConTrazo(true)
  }

  const mover = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return
    const ctx = e.currentTarget.getContext('2d')
    if (!ctx) return
    const { x, y } = punto(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const terminar = () => {
    dibujando.current = false
  }

  const limpiar = () => {
    const canvas = lienzo.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    setConTrazo(false)
  }

  const usar = () => {
    lienzo.current?.toBlob((blob) => {
      if (blob) onFirmar(new File([blob], 'firma.png', { type: 'image/png' }))
    }, 'image/png')
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={lienzo}
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        onPointerLeave={terminar}
        className="h-44 w-full touch-none rounded-lg border-2 border-dashed border-slate-300 bg-white"
      />
      <p className="text-xs text-slate-500">Firme dentro del recuadro con el dedo o el mouse.</p>
      <div className="flex flex-wrap gap-2">
        <Boton type="button" variante="secundario" icono={<Eraser className="h-4 w-4" />} onClick={limpiar} disabled={!conTrazo}>
          Limpiar
        </Boton>
        <Boton type="button" icono={<Check className="h-4 w-4" />} onClick={usar} disabled={!conTrazo} ocupado={ocupado}>
          Usar firma
        </Boton>
      </div>
    </div>
  )
}
