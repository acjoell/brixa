# backend-express-ts

Plantilla backend minimalista construida con Node.js, Express y TypeScript.

## Requisitos

- Node.js `^24.0.0 || >=26.0.0`
- npm

## Instalación

```bash
npm install
```

## Nota sobre scripts de instalación

Este proyecto deniega por defecto el script de instalación de `esbuild` (lo trae `tsx`), por seguridad de la cadena de suministro. `tsx` funciona sin él. Si algún entorno lo necesitara, se puede aprobar con `npm install-scripts approve esbuild`.

## Variables de entorno

Copia `.env.example` a `.env` para personalizar la configuración local:

```bash
cp .env.example .env
```

- `PORT`: Puerto TCP en el que escucha el servidor HTTP (por defecto: `3000`).

## Scripts disponibles

- `npm run dev`: Inicia el servidor en desarrollo con recarga en caliente vía `tsx`.
- `npm run build`: Compila el código fuente TypeScript a `dist/`.
- `npm start`: Ejecuta el servidor compilado en `dist/index.js`.
- `npm run lint`: Valida el código con ESLint.
- `npm run format:check`: Verifica el formato del código con Prettier.
- `npm run typecheck`: Valida los tipos TypeScript con `tsc --noEmit`.
- `npm test`: Ejecuta las pruebas automatizadas con Vitest.
