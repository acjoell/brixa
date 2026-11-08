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

## Validación y manejo de errores

- **Configuración validada**: Las variables de entorno se validan al inicio mediante Zod (`src/config.js`). Errores en la configuración detienen el proceso sin exponer valores sensibles.
- **Contrato de errores uniforme**:
  - `400`: Solicitud incorrecta (`{"error": "Bad Request"}`). Si proviene de validación de entrada (`ValidationError`), incluye `details: [{ path, code }]` sin exponer valores recibidos.
  - `401`: `{"error": "Unauthorized"}`
  - `403`: `{"error": "Forbidden"}`
  - `404`: Ruta no registrada (`{"error": "Not Found"}`).
  - `413`: `{"error": "Payload Too Large"}`
  - `500`: Cualquier error interno o no reconocido responde `{"error": "Internal Server Error"}` sin filtrar mensajes ni trazas al cliente.
- **Convención de propiedades desconocidas**:
  - `body` y `params` se validan con `z.strictObject` (rechaza propiedades desconocidas).
  - `query` se valida con `z.object` (descarta propiedades desconocidas).

## Scripts disponibles

- `npm run dev`: Inicia el servidor en desarrollo con recarga en caliente vía `node --watch`.
- `npm start`: Ejecuta el servidor con `node src/index.js`.
- `npm run lint`: Valida el código con ESLint.
- `npm run format:check`: Verifica el formato del código con Prettier.
- `npm test`: Ejecuta las pruebas automatizadas con Vitest.
