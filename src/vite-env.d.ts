/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  /** demo: perfiles de ejemplo | jwt: usuario o correo + clave del portal web */
  readonly VITE_AUTH_MODO?: 'demo' | 'jwt'
}
