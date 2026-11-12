// Modo celular (npm run dev:celular): el teléfono entra por la red local y Vite le pasa /api a la API local
const MODO_CELULAR = import.meta.env.MODE === 'celular'
const API_URL = MODO_CELULAR ? window.location.origin : (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

/** Modo celular: las URLs firmadas que arma la API local apuntan a localhost, que en el teléfono no existe. */
function alcanzable(url: string): string {
  return MODO_CELULAR ? url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, window.location.origin) : url
}

// En desarrollo el frontend nunca puede apuntar a la API de producción
if (import.meta.env.DEV && !MODO_CELULAR && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(API_URL)) {
  throw new Error(`VITE_API_URL debe ser localhost en desarrollo (actual: "${API_URL}")`)
}

/** demo: perfiles de ejemplo | jwt: usuario o correo + clave del portal web (como LH Inventario) */
export const AUTH_MODO: 'demo' | 'jwt' =
  import.meta.env.VITE_AUTH_MODO ?? (import.meta.env.DEV || MODO_CELULAR ? 'demo' : 'jwt')

let obtenerCabeceraAuth: () => Promise<Record<string, string>> = async () => ({})

// ---------- Sesión con tokens (AUTH_MODO=jwt) ----------

const CLAVE_ACCESS = 'certificaciones.access'
const CLAVE_REFRESH = 'certificaciones.refresh'

export interface Tokens {
  access_token: string
  refresh_token: string
}

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

export function guardarTokens(tokens: Tokens | null) {
  vaciarMemoria()
  try {
    if (tokens) {
      localStorage.setItem(CLAVE_ACCESS, tokens.access_token)
      localStorage.setItem(CLAVE_REFRESH, tokens.refresh_token)
    } else {
      localStorage.removeItem(CLAVE_ACCESS)
      localStorage.removeItem(CLAVE_REFRESH)
    }
  } catch {
    /* almacenamiento no disponible */
  }
}

export function tokenAcceso(): string | null {
  return leer(CLAVE_ACCESS)
}

let refrescando: Promise<boolean> | null = null

/** Renueva el par de tokens con el refresh; una sola petición aunque fallen varias a la vez. */
function refrescarTokens(): Promise<boolean> {
  const refresh = leer(CLAVE_REFRESH)
  if (!refresh) return Promise.resolve(false)
  refrescando ??= fetch(armarUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  })
    .then(async (r) => {
      if (!r.ok) {
        guardarTokens(null)
        return false
      }
      guardarTokens((await r.json()) as Tokens)
      return true
    })
    .catch(() => false)
    .finally(() => {
      refrescando = null
    })
  return refrescando
}

// Demo publicada: clave de acceso que pide la API (se guarda en este navegador)
const CLAVE_ACCESO = 'certificaciones.claveDemo'

export function guardarClaveDemo(clave: string | null) {
  try {
    if (clave) localStorage.setItem(CLAVE_ACCESO, clave)
    else localStorage.removeItem(CLAVE_ACCESO)
  } catch {
    /* almacenamiento no disponible */
  }
}

function cabeceraClaveDemo(): Record<string, string> {
  if (AUTH_MODO !== 'demo') return {}
  try {
    const clave = localStorage.getItem(CLAVE_ACCESO)
    return clave ? { 'X-Clave-Demo': clave } : {}
  } catch {
    return {}
  }
}

/** La API pide (o rechazó) la clave de acceso de la demo publicada. */
export function esErrorClaveDemo(e: unknown): boolean {
  return e instanceof ErrorApi && e.estado === 401 && /clave de acceso/i.test(e.message)
}

export function configurarAuth(fn: () => Promise<Record<string, string>>) {
  obtenerCabeceraAuth = fn
}

/** Aviso de archivo repetido (409): qué ya existe y qué ofrece hacer la API */
export interface DetalleRepetido {
  codigo: 'duplicado'
  mensaje: string
  existentes: { nombre: string; detalle: string }[]
  accion: string
}

export class ErrorApi extends Error {
  constructor(public estado: number, mensaje: string, public repetido?: DetalleRepetido) {
    super(mensaje)
  }
}

type Params = Record<string, string | number | boolean | null | undefined>

function armarUrl(ruta: string, params?: Params): string {
  // Todas las rutas de la API van bajo /api (estructura de API-BASE-LH)
  const url = new URL(`${API_URL}/api${ruta}`)
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  })
  return url.toString()
}

// ---------- Memoria de lecturas (solo en esta pestaña, nunca en el teléfono) ----------
// Al volver a una pantalla ya vista se muestra al instante lo último leído y se actualiza por detrás (useDatos).
// Cualquier cambio (POST, PUT, PATCH, DELETE) y todo inicio o cierre de sesión la vacían: nunca se ve un dato
// viejo después de guardar, ni datos de otra persona.
const memoria = new Map<string, unknown>()
let generacion = 0
const MAXIMO_MEMORIA = 80

export function leerMemoria<T>(clave: string): T | undefined {
  return memoria.get(clave) as T | undefined
}

/** Guarda solo si nada se modificó desde que empezó la lectura (si no, el dato podría estar viejo). */
export function guardarMemoria(clave: string, valor: unknown, generacionInicio: number): void {
  if (generacionInicio !== generacion) return
  memoria.delete(clave)
  memoria.set(clave, valor)
  if (memoria.size > MAXIMO_MEMORIA) memoria.delete(memoria.keys().next().value as string)
}

export function generacionMemoria(): number {
  return generacion
}

export function vaciarMemoria(): void {
  generacion++
  memoria.clear()
}

async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown, params?: Params, reintento = true): Promise<T> {
  if (metodo !== 'GET') vaciarMemoria()
  const esForm = cuerpo instanceof FormData
  let respuesta: Response
  try {
    respuesta = await fetch(armarUrl(ruta, params), {
      method: metodo,
      headers: {
        ...cabeceraClaveDemo(),
        ...(await obtenerCabeceraAuth()),
        ...(cuerpo !== undefined && !esForm ? { 'Content-Type': 'application/json' } : {}),
      },
      body: cuerpo === undefined ? undefined : esForm ? cuerpo : JSON.stringify(cuerpo),
    })
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con la API. ¿Está corriendo?')
  }
  // Token vencido: se renueva una vez y se repite la petición
  if (respuesta.status === 401 && AUTH_MODO === 'jwt' && reintento && !ruta.startsWith('/auth/')) {
    if (await refrescarTokens()) return pedir<T>(metodo, ruta, cuerpo, params, false)
  }
  if (!respuesta.ok) {
    let mensaje = `Error ${respuesta.status}`
    let repetido: DetalleRepetido | undefined
    try {
      const datos = await respuesta.json()
      if (typeof datos.detail === 'string') mensaje = datos.detail
      else if (Array.isArray(datos.detail)) mensaje = datos.detail.map((d: { msg: string }) => d.msg).join('; ')
      else if (datos.detail?.codigo === 'duplicado') {
        repetido = datos.detail as DetalleRepetido
        mensaje = repetido.mensaje
      }
    } catch {
      /* respuesta sin JSON */
    }
    throw new ErrorApi(respuesta.status, mensaje, repetido)
  }
  if (respuesta.status === 204) return undefined as T
  return respuesta.json() as Promise<T>
}

export const api = {
  get: <T>(ruta: string, params?: Params) => pedir<T>('GET', ruta, undefined, params),
  post: <T>(ruta: string, cuerpo?: unknown, params?: Params) => pedir<T>('POST', ruta, cuerpo ?? {}, params),
  put: <T>(ruta: string, cuerpo: unknown) => pedir<T>('PUT', ruta, cuerpo),
  patch: <T>(ruta: string, cuerpo: unknown) => pedir<T>('PATCH', ruta, cuerpo),
  delete: <T>(ruta: string) => pedir<T>('DELETE', ruta),
}

/** Descarga un archivo generado por la API (Excel, ZIP) con las cabeceras de autenticación. */
export async function descargarArchivo(ruta: string, params?: Params, nombrePorDefecto = 'archivo') {
  const respuesta = await fetch(armarUrl(ruta, params), { headers: { ...cabeceraClaveDemo(), ...(await obtenerCabeceraAuth()) } })
  if (!respuesta.ok) {
    let mensaje = `Error ${respuesta.status}`
    try {
      mensaje = (await respuesta.json()).detail ?? mensaje
    } catch {
      /* sin JSON */
    }
    throw new ErrorApi(respuesta.status, mensaje)
  }
  const disposicion = respuesta.headers.get('Content-Disposition') ?? ''
  const nombre = /filename="([^"]+)"/.exec(disposicion)?.[1] ?? nombrePorDefecto
  const url = URL.createObjectURL(await respuesta.blob())
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)
}

/** Abre una URL firmada que entrega la API (documento, informe, evidencia). */
export async function abrirUrlFirmada(ruta: string) {
  const { url } = await api.get<{ url: string }>(ruta)
  window.open(alcanzable(url), '_blank', 'noopener')
}

/** Carga en dos pasos: URL firmada desde la API y PUT directo al almacenamiento. Devuelve la clave. */
export async function subirArchivo(archivo: File, prefijo: 'documentos' | 'analisis' | 'evidencias' | 'registros') {
  const tipo = archivo.type || 'application/octet-stream'
  const { clave, url, cabeceras, max_bytes } = await api.post<{
    clave: string
    url: string
    cabeceras?: Record<string, string>
    max_bytes?: number
  }>('/archivos/url-subida', {
    prefijo,
    nombre_archivo: archivo.name,
    tipo_contenido: tipo,
  })
  if (max_bytes && archivo.size > max_bytes) {
    throw new ErrorApi(413, `El archivo supera el máximo de ${Math.round(max_bytes / 1048576)} MB`)
  }
  // Las cabeceras van firmadas en la URL (tamaño máximo): sin ellas, Cloud Storage rechaza la subida
  const respuesta = await fetch(alcanzable(url), { method: 'PUT', headers: { ...cabeceras, 'Content-Type': tipo }, body: archivo })
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, 'No se pudo subir el archivo')
  return { clave, nombre: archivo.name, tipo }
}
