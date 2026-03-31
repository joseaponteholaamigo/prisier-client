# Prisier Client

Portal cliente de la plataforma Prisier — React SPA para usuarios de tenants.

**URL produccion:** `app.prisier.com`

## Stack

- React 18 + TypeScript
- Vite 8
- Tailwind CSS 3
- React Router DOM
- TanStack React Query + Axios
- React Hook Form + Zod
- Plotly.js (graficos)
- Lucide React (iconos)

## Requisitos

- Node.js 22+
- npm

## Inicio rapido

```bash
npm install
npm run dev
```

Disponible en `http://localhost:5174`

## Build de produccion

```bash
npm run build
```

Los archivos estaticos se generan en `dist/`.

## Docker (produccion)

```bash
docker compose up -d
```

Sirve la app con nginx en el puerto `3002`.

## Roles con acceso

- `cliente_comercial` — modulos consumo masivo (1-4)
- `cliente_educacion` — modulos educacion (E1-E3)
# pricer-client
