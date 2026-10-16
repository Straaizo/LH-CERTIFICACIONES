// Prepara las fotos del ingreso: de cada original en fotos-carrusel/ genera versiones AVIF y WebP en varios
// anchos en src/assets/carrusel/ (el navegador baja solo la que necesita su pantalla).
// Corre solo antes de `npm run dev` y `npm run build`; si una foto ya está procesada, la salta.
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'

const ORIGEN = 'fotos-carrusel'
const DESTINO = 'src/assets/carrusel'
// Panel de escritorio: hasta ~1450 px de ancho a densidad 1 y ~2900 px en pantallas 2x
const ANCHOS = [800, 1400, 2000, 2800]
const EXTENSIONES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff'])

function slug(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

if (!existsSync(ORIGEN)) process.exit(0)
mkdirSync(DESTINO, { recursive: true })

const originales = readdirSync(ORIGEN).filter((f) => EXTENSIONES.has(extname(f).toLowerCase()))
const vigentes = new Set()

for (const archivo of originales) {
  const ruta = join(ORIGEN, archivo)
  const base = slug(basename(archivo, extname(archivo)))
  const fecha = statSync(ruta).mtimeMs
  try {
    const { width } = await sharp(ruta).metadata()
    const anchos = ANCHOS.filter((a) => a <= width)
    if (!anchos.length) anchos.push(width)
    for (const ancho of anchos) {
      for (const formato of ['avif', 'webp']) {
        const salida = join(DESTINO, `${base}-${ancho}.${formato}`)
        vigentes.add(basename(salida))
        if (existsSync(salida) && statSync(salida).mtimeMs >= fecha) continue
        const imagen = sharp(ruta)
          .rotate()
          .resize({ width: ancho, kernel: 'lanczos3', withoutEnlargement: true })
          // Enfoque fino tras reducir: devuelve la textura de hojas y surcos sin halos
          .sharpen({ sigma: 0.55, m1: 0.6, m2: 1.4 })
        await (formato === 'avif'
          ? imagen.avif({ quality: 58, effort: 6, chromaSubsampling: '4:4:4' })
          : imagen.webp({ quality: 84, effort: 6, smartSubsample: true })
        ).toFile(salida)
        console.log(`fotos-carrusel: ${basename(salida)}`)
      }
    }
  } catch (error) {
    console.error(`fotos-carrusel: no se pudo procesar ${archivo}: ${error.message}`)
  }
}

// Quita versiones de fotos que ya no están en fotos-carrusel/
for (const f of readdirSync(DESTINO)) {
  if (/-\d+\.(avif|webp)$/.test(f) && !vigentes.has(f)) unlinkSync(join(DESTINO, f))
}
