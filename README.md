<h1 align="center">Certificaciones VS y LH — Frontend</h1>

<p align="center">
  Aplicación web del Área de Certificaciones de <strong>Agrícola Viento Sur</strong> y <strong>Agrícola La Hornilla</strong>.
  <br/>
  Reemplaza planillas, carpetas compartidas y correos por una plataforma única, usable desde el computador y el celular, e instalable como app.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/estado-en_desarrollo-f59e0b?style=for-the-badge" alt="Estado" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/PWA-instalable-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" />
  <img src="https://img.shields.io/badge/Firebase_Hosting-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" />
</p>

---

## Contexto

El Área de Certificaciones mantiene más de diez protocolos (GLOBALG.A.P., BRCGS, PrimusGFS, GRASP, GROW, LEAF, SPRING, Tesco, SMETA, Walmart, FSMA PSR) en los campos y plantas de las dos empresas. Los certificados, procedimientos, auditorías internas, registros de terreno, análisis de laboratorio y datos de huella de carbono estaban repartidos en planillas y carpetas, sin avisos ni seguimiento.

Esta aplicación los reúne en un solo lugar:

- **Equipo de certificaciones**: administra documentos, normas, auditorías y revisa todo lo que envían las sucursales.
- **Jefes de campo, jefes de área y supervisores**: llenan registros, trabajan sus no conformidades y cargan análisis desde terreno, con la cámara del celular. Las auditorías las ven en solo lectura.

---

## Funcionalidades

### 🏠 Inicio
- Indicadores del día: registros por revisar y atrasados, vencimientos, no conformidades abiertas, reincidentes y con plazo vencido, análisis fuera de norma
- Semáforo por protocolo y empresa (al día, atención, crítico, sin información)

### 📄 Documentos fijos y vencimientos
- Procedimientos, análisis de riesgos, planes de gestión, instructivos y certificados, ordenados por sección (campo, planta, empresarial)
- Historial de versiones: cada archivo nuevo pasa a ser el vigente y los anteriores quedan guardados
- Al subir un archivo, la aplicación lo reconoce y propone si es una versión nueva de un documento existente o qué datos completar
- Ficha de cada certificado leída desde el PDF: norma, N°, vigencia, organismo y sucursales cubiertas
- Vencimientos agrupados en vencidos, 7, 30 y 60 días
- Carpeta con la evidencia para el auditor

### 📝 Registros
- Plantillas importadas desde Word (encabezado, pie, tablas y checklist)
- Llenado en terreno con firma y avance; un registro queda atrasado a los 15 días sin revisión
- Revisión y aprobación por certificaciones

### ✅ Auditorías y ⚠️ No conformidades
- Checklist oficiales de cada norma, con todas sus versiones disponibles al planificar
- Respuesta punto por punto (sí, no, N/A) con comentario y área
- Cada "No" genera una no conformidad: análisis de causa (5 porqués), acciones, evidencia con foto, revisión y cierre, con detección de reincidencias

### 🧪 Laboratorio
- Análisis de agua, suelo, hoja, fruta y residuos, comparados con sus límites
- Lectura del informe del laboratorio para completar los valores
- Vista por campo o por planta

### 🌿 Medio ambiente
- Consumos de combustibles, electricidad y fertilizantes, y reciclaje por material
- Huella de carbono y comparativa de temporadas al mismo período, con gráficos

### 📱 Aplicación instalable (PWA)
- Se instala en Android, iPhone y computador, y abre a pantalla completa
- En el celular instalado, navegación con pestañas abajo
- Abre sin señal con lo último cargado y avisa cuando no hay conexión

### 🎨 UX / Interfaz
- Identidad visual del portal La Hornilla
- Diseño responsive, del celular al escritorio
- Pantallas de carga con la forma del contenido y transiciones suaves
- Permisos visibles: lo que un perfil no puede editar se muestra como "Solo lectura"

---

## Stack tecnológico

| Categoría | Tecnología |
|---|---|
| Framework UI | React 19 + TypeScript |
| Build tool | Vite |
| Estilos | Tailwind CSS |
| Routing | React Router |
| Iconos | Lucide React |
| Estado | Context API |
| App instalable | Manifest y service worker propios |
| Hosting | Firebase Hosting |

---

## Estructura del proyecto

```
src/
├── main.tsx / App.tsx          # Entrada y rutas
├── api.ts                      # Comunicación con la API
├── contexto/
│   └── Sesion.tsx              # Usuario, catálogos y filtros (empresa, sucursal, temporada)
├── componentes/
│   ├── Layout.tsx              # Encabezado y menú
│   ├── ui.tsx                  # Botones, tarjetas, ventanas, campos y avisos
│   ├── Desplegable.tsx         # Listas desplegables
│   ├── Esqueletos.tsx          # Pantallas de carga
│   ├── graficos.tsx            # Gráficos de medio ambiente
│   ├── VersionNorma.tsx        # Puntos de control de una versión de norma
│   ├── FirmaPad.tsx            # Firma en registros
│   ├── nc.tsx                  # Piezas de no conformidades
│   └── BarraFiltros.tsx
├── pwa/
│   └── PWA.tsx                 # Instalación, conexión y pestañas del celular
├── paginas/                    # Una pantalla por módulo
│   ├── Inicio.tsx · Ingreso.tsx
│   ├── Registros.tsx · RegistroDetalle.tsx · Documentos.tsx · Vencimientos.tsx
│   ├── Auditorias.tsx · AuditoriaDetalle.tsx · NoConformidades.tsx · NoConformidadDetalle.tsx
│   ├── Laboratorio.tsx · Ambiente.tsx · AmbienteComparativa.tsx
│   └── Importar.tsx · Bitacora.tsx · Configuracion.tsx
└── hooks.ts · formato.ts · tipos.ts
public/
├── manifest.webmanifest · sw.js   # App instalable
└── icons/ · logo_lh.png
```

---

## Backend

Esta aplicación consume una API REST en **FastAPI**, desplegada en **Google Cloud Run**.

➡️ Repositorio de la API: [API-CERTIFICACIONES](https://github.com/Straaizo/API-CERTIFICACIONES)

---

<p align="center">
  Desarrollado por <strong>Enzo Sabattini</strong> · Soporte TI & Desarrollo — La Hornilla
</p>
