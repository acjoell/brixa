# backend-express-js

Plantilla backend minimalista construida con Node.js, Express y JavaScript.

## Requisitos

- Node.js `^24.0.0 || >=26.0.0`
- npm

## Instalación

```bash
npm install
```

## Variables de entorno

Copia `.env.example` a `.env` para personalizar la configuración local:

```bash
cp .env.example .env
```

- `PORT`: Puerto TCP en el que escucha el servidor HTTP (por defecto: `3000`).

## Scripts disponibles

- `npm run dev`: Inicia el servidor en desarrollo con recarga en caliente vía `node --watch`.
- `npm start`: Ejecuta el servidor con `node src/index.js`.
- `npm run lint`: Valida el código con ESLint.
- `npm run format:check`: Verifica el formato del código con Prettier.
- `npm test`: Ejecuta las pruebas automatizadas con Vitest.
