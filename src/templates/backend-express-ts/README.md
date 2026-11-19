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
- `CORS_ALLOWED_ORIGINS`: Lista de orígenes permitidos separados por comas para CORS (opcional; desactivado por defecto si no se define). Solo admite URLs HTTP o HTTPS válidas; rechaza comodines (`*`) y `null`.

## Seguridad y cabeceras HTTP

- **Cabeceras de seguridad**: Helmet emite cabeceras de protección HTTP con una CSP estricta por defecto (`default-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action 'none'`). Si se activa la documentación de API (`ENABLE_API_DOCS=true`), la ruta `/docs` utiliza una CSP adaptada para Swagger UI con `style-src 'self' 'unsafe-inline'`.
- **HSTS no activo**: HSTS está desactivado a propósito (`hsts: false`) porque Brixa no controla dónde se termina TLS. Quien termine TLS en el servidor debe configurarlo en su proxy inverso o infraestructura de alojamiento.
- **CORS desactivado por defecto**: Se deniegan las peticiones entre orígenes a menos que se configure `CORS_ALLOWED_ORIGINS`.
- **Límite de cuerpo JSON**: `express.json` aplica un límite de `100kb`. Cuerpos mayores se rechazan con `413 Payload Too Large`.

## Validación y manejo de errores

- **Configuración validada**: Las variables de entorno se validan al inicio mediante Zod (`src/config.ts`). Errores en la configuración detienen el proceso sin exponer valores sensibles.
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

- `npm run dev`: Inicia el servidor en desarrollo con recarga en caliente vía `tsx`.
- `npm run build`: Compila el código fuente TypeScript a `dist/`.
- `npm start`: Ejecuta el servidor compilado en `dist/index.js`.
- `npm run lint`: Valida el código con ESLint.
- `npm run format:check`: Verifica el formato del código con Prettier.
- `npm run typecheck`: Valida los tipos TypeScript con `tsc --noEmit`.
- `npm test`: Ejecuta las pruebas automatizadas con Vitest.
- `npm run test:unit`: Ejecuta las pruebas rápidas excluyendo `tests/db.test.ts`.
- Con base de datos, `npm run test:db` ejecuta la prueba de conexión con `DATABASE_URL` configurada. Conserva la omisión existente si esa variable falta. `npm test` incluye ambos grupos.
