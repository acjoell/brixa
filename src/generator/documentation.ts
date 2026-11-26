import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { UserOptions } from "../types.js";
import { DEFAULT_AUTH_TRANSPORT } from "../validation/options.js";

const code = (value: string) => "`" + value + "`";
const block = (language: string, ...lines: string[]) =>
  "```" + language + "\n" + lines.join("\n") + "\n```";
const shell = (...lines: string[]) => block("bash", ...lines);
const doc = (...sections: string[]) => sections.filter(Boolean).join("\n\n") + "\n";

export async function writeProjectDocs(options: UserOptions): Promise<void> {
  const { outputDir, modality, language, auth, i18n, apiDocs } = options;
  const front = modality !== "backend";
  const back = modality !== "frontend";
  const full = modality === "fullstack";
  const docker = back && options.docker === true;
  const database = options.database ?? "none";
  const postgres = database === "postgres";
  const sqlite = database === "sqlite";
  const db = postgres || sqlite;
  const tls = full && auth && docker;
  const cookie = (options.authTransport ?? DEFAULT_AUTH_TRANSPORT) === "cookie";
  const backend = full ? "backend/" : "";
  const frontend = full ? "frontend/" : "";
  const lang = language === "ts" ? "TypeScript" : "JavaScript";
  const dev = full && auth ? "npm run dev -- --strictPort" : "npm run dev";
  const api = full ? "/api" : "";
  const compose = tls ? "docker compose -f compose.yaml -f compose.tls.yaml" : "docker compose";
  const job =
    compose +
    " run --rm --no-deps " +
    (postgres ? "-e DATABASE_URL= -e MIGRATION_DATABASE_URL " : "");
  const entry = language === "ts" ? "dist/" : "src/";

  const readme = doc(
    "# " + path.basename(outputDir),
    [
      lang,
      front && "React, Vite y Tailwind CSS",
      back && "Express",
      postgres && "PostgreSQL y Drizzle",
      sqlite && "SQLite y Drizzle",
      auth && "Auth por " + (cookie ? "cookies" : "Bearer"),
      docker && "Docker Compose",
      i18n && "i18next",
      apiDocs && "OpenAPI y Swagger UI",
    ]
      .filter(Boolean)
      .join(" · ") + ".",
    "## Requisitos",
    "- Node.js 24.x o 26 en adelante y npm." +
      (docker ? "\n- Docker y el plugin Compose para el recorrido con contenedores." : "") +
      (tls ? "\n- Para HTTPS local: Docker Engine 28.0.0 y Compose 2.24.4 o posteriores." : "") +
      (postgres && !docker
        ? "\n- Una base PostgreSQL dedicada y acceso al operador que aprovisiona los roles."
        : ""),
    "## Primera inicialización",
    "Desde la raíz, ejecuta " +
      code("npm run setup") +
      ". En Linux es la vía recomendada. En macOS y Windows la automatización completa no está acreditada." +
      (docker
        ? " El recorrido con Compose se ofrece en una terminal Linux con daemon local. No instala dependencias npm en el host."
        : " Instala las dependencias de cada aplicación.") +
      (db ? " Aplica las migraciones ya presentes." : "") +
      (auth
        ? " Si falta el administrador, solicita sus credenciales en una terminal interactiva."
        : ""),
    back
      ? "Para preparar los servicios a mano o completar los pasos pendientes, sigue la [guía de despliegue](docs/deployment.md#primera-inicialización-manual)."
      : "Alternativa manual: ejecuta " + code("npm install") + " en esta carpeta.",
    "## Desarrollo diario",
    full
      ? "Sin contenedores, abre dos terminales desde la raíz del proyecto.\n\n" +
          shell("# Backend", "cd backend", "npm run dev") +
          "\n\n" +
          shell("# Frontend", "cd frontend", dev) +
          "\n\n" +
          "Vite sirve la aplicación en http://localhost:5173 y reenvía " +
          code("/api") +
          " a Express en http://localhost:3000. " +
          (auth ? "Usa exactamente el origen configurado para las cookies. " : "") +
          "El control de salud se consulta en " +
          code("/api/health") +
          "."
      : shell("npm run dev") +
          "\n\n" +
          (front
            ? "Frontend: http://localhost:5173."
            : "API: http://localhost:3000/health con el puerto predeterminado."),
    docker
      ? "Con Compose, consulta [arranque y mantenimiento](docs/deployment.md#operaciones-con-compose)." +
          (tls
            ? " El override HTTPS publica https://localhost:8443 por defecto."
            : auth
              ? " Prepara el proxy HTTPS externo antes de arrancar Auth."
              : " La publicación predeterminada es http://localhost:" +
                (full ? "8080." : "3000/health."))
      : "",
    "## Guías",
    "- [Desarrollo y extensión](docs/development.md)." +
      (auth ? "\n- [Autenticación](docs/authentication.md)." : "") +
      (back ? "\n- [Configuración, despliegue y mantenimiento](docs/deployment.md)." : ""),
  );

  const development = doc(
    "# Desarrollo y extensión",
    "## Estructura y primera funcionalidad",
    front
      ? "En " +
          code(frontend + "src/") +
          ", coloca un componente React junto a la funcionalidad que lo usa. " +
          "Importa el componente desde " +
          code(frontend + "src/App." + (language === "ts" ? "tsx" : "jsx")) +
          (auth
            ? " para la vista base, o registra la pantalla dentro de las rutas de " +
              code("src/features/auth/AuthApp")
            : "") +
          ". Ejecuta los scripts desde la carpeta del frontend. Por ejemplo, guarda este componente en " +
          code("Estado." + (language === "ts" ? "tsx" : "jsx")) +
          " e impórtalo donde vayas a renderizar " +
          code("<Estado />") +
          ":\n\n" +
          block(
            language === "ts" ? "tsx" : "jsx",
            "export default function Estado() {",
            "  return <p>Disponible</p>;",
            "}",
          )
      : "",
    back
      ? "Registra rutas en " +
          code(backend + "src/app." + language) +
          " antes de " +
          code("app.use(notFoundHandler)") +
          ". Por ejemplo, añade una ruta de lectura que devuelva JSON:" +
          "\n\n" +
          block(
            language,
            'app.get("/status", (_req, res) => {',
            "  res.json({ available: true });",
            "});",
          ) +
          (auth
            ? "\n\nPara recursos con sesión, sigue el [ejemplo de Auth](authentication.md#rutas-propias)."
            : "")
      : "",
    full
      ? "## Proxy de Vite\n\nEl cliente llama a rutas relativas como " +
          code("/api/health") +
          ". Vite elimina el prefijo " +
          code("/api") +
          " y reenvía a " +
          code("BACKEND_URL") +
          " (por defecto " +
          code("http://localhost:3000") +
          "). Define la variable en el entorno de Vite si cambia Express. " +
          "Este proxy es de desarrollo. En un despliegue configura el proxy inverso equivalente."
      : "",
    db
      ? "## Migraciones Drizzle\n\nDesde la carpeta del backend, modifica " +
          code("src/db/schema." + language) +
          " y revisa el SQL antes de aplicarlo. " +
          (auth
            ? "Las migraciones de Auth ya están incluidas. Genera nuevas solo al cambiar el esquema. "
            : "Define primero el esquema de negocio y genera su migración inicial. ") +
          (postgres
            ? "Proporciona al comando " +
              code("MIGRATION_DATABASE_URL") +
              " de " +
              code("table_owner") +
              " y añade al SQL las concesiones mínimas para " +
              code("app_exec") +
              ". "
            : "") +
          "\n\n" +
          shell("npm run db:generate", "npm run db:migrate") +
          "\n\nVersiona los archivos de " +
          code("drizzle/") +
          " y conserva el historial aplicado."
      : "",
    "## Comprobaciones",
    front
      ? (full ? "Frontend: " : "") +
          code("npm run lint") +
          " y " +
          code("npm run build") +
          (auth ? ", además de " + code("npm test") : "") +
          "."
      : "",
    back
      ? (full ? "Backend: " : "") +
          code("npm test") +
          ", " +
          code("npm run lint") +
          " y " +
          code("npm run format:check") +
          (language === "ts"
            ? ", " + code("npm run typecheck") + " y " + code("npm run build")
            : "") +
          (db ? ". Para comprobar la conexión configurada usa " + code("npm run test:db") : "") +
          "."
      : "",
    i18n
      ? "## Internacionalización\n\nEdita el mismo conjunto de claves en " +
          code(frontend + "src/locales/en.json") +
          " y " +
          code(frontend + "src/locales/es.json") +
          ". Conserva los marcadores de interpolación y ejecuta " +
          code("npm run check:i18n") +
          " en la carpeta del frontend."
      : "",
    apiDocs
      ? "## OpenAPI\n\nMantén " +
          code(backend + "src/docs/openapi.json") +
          " sincronizado con métodos, rutas, cuerpos, códigos y transporte. Activa " +
          code("ENABLE_API_DOCS=true") +
          " en el entorno del backend para servir Swagger UI en " +
          code(api + "/docs/") +
          ". " +
          (auth
            ? "La sesión válida es necesaria para la página y sus recursos. " +
              (cookie
                ? "Inicia sesión en el mismo origen."
                : "El cliente debe enviar Authorization en cada petición, incluidos los recursos estáticos.")
            : "")
      : "",
  );

  const authentication = doc(
    "# Autenticación",
    full
      ? "## Modos del frontend\n\nEl proyecto usa el modo " +
          code(options.authAppMode ?? "private") +
          ". El modo privado redirige la raíz al flujo de entrada. El público muestra una portada y enlaza a " +
          code("/login") +
          ". " +
          "La sesión se comprueba antes de presentar " +
          code("/app") +
          ". El guard de React solo controla la experiencia; Express autentica cada petición y el controlador autoriza el recurso."
      : "",
    "## Sesiones y transporte",
    "Usa " +
      code(api + "/auth/login") +
      ", " +
      code(api + "/auth/session") +
      ", " +
      code(api + "/auth/logout") +
      " y " +
      code(api + "/auth/password") +
      ". El servidor determina si la sesión sigue vigente o ha sido revocada.",
    cookie
      ? "El login devuelve 204 y fija una cookie HttpOnly, SameSite=Lax y Secure bajo HTTPS. Las mutaciones exigen origen válido y " +
          code("X-Requested-With: XMLHttpRequest") +
          ". Conserva las cookies del mismo origen. Si el cliente usa " +
          code("mode: 'same-origin'") +
          " con una política global " +
          code("no-referrer") +
          ", incluye " +
          code("referrerPolicy: 'same-origin'") +
          " para que Fetch envíe el origen."
      : "El login devuelve " +
          code("{ token }") +
          ". Envía " +
          code("Authorization: Bearer <token>") +
          " en cada petición protegida. Guarda el token fuera de URLs, logs y repositorios.",
    "## Rutas propias",
    "Monta las rutas antes de " +
      code("app.use(notFoundHandler)") +
      " en " +
      code(backend + "src/app." + language) +
      ":",
    block(
      language,
      'import { requireAuth } from "./auth/http-runtime.js";',
      "",
      'app.get("/business/me", requireAuth(), (req, res) => {',
      "  if (!req.auth) {",
      "    res.sendStatus(401);",
      "    return;",
      "  }",
      "  res.json({ userId: req.auth.userId });",
      "});",
    ),
    code("requireAuth()") +
      " valida sin renovar actividad. Habilita " +
      code("intentionalActivity: true") +
      " solo en mutaciones que representen actividad real. GET, HEAD y OPTIONS validan sin renovar. " +
      "Cada controlador comprueba si el usuario puede leer o modificar el recurso solicitado. La plantilla no incluye RBAC.",
    "## Administrador inicial y recuperación",
    "Aplica primero las migraciones. Sin contenedores, ejecuta " +
      code("npm run auth:bootstrap") +
      " o " +
      code("npm run auth:recover-admin") +
      " desde el backend en una terminal interactiva. " +
      "El asistente comprueba si ya existe el administrador antes de mostrar un prompt. La recuperación revoca sus sesiones. " +
      (docker
        ? "Para Compose usa los [comandos de mantenimiento](deployment.md#operaciones-con-compose)."
        : postgres
          ? "Proporciona al comando la conexión de " +
            code("table_owner") +
            ", separada de Express."
          : ""),
    "## Alta y activación",
    "El administrador autenticado envía " +
      code("{email}") +
      " a " +
      code("POST " + api + "/auth/register") +
      ". Una cuenta nueva devuelve 201 con el enlace y la caducidad. El alta repetida devuelve 200 sin otro enlace. " +
      "Comparte el enlace solo por un canal privado. Los administradores gestionan enlaces pendientes mediante " +
      code(api + "/auth/activation/revoke") +
      " y " +
      code(api + "/auth/activation/regenerate") +
      " con " +
      code("{userId}") +
      ".",
    (full
      ? "La vista " + code("/activate") + " elimina el fragmento antes de validar el token."
      : "La API genera el enlace. Integra la vista en tu cliente: elimina el fragmento de la navegación, mantén el token en memoria y envíalo en el cuerpo JSON.") +
      " " +
      code("POST " + api + "/auth/activate/validate") +
      " recibe " +
      code("{token}") +
      " y devuelve 200 con los límites de contraseña para un enlace elegible. " +
      code("POST " + api + "/auth/activate") +
      " recibe " +
      code("{token,password}") +
      " y consume el enlace atómicamente al devolver 204, sin iniciar sesión. Un enlace inválido devuelve 400.",
    "## Política de contraseñas y límites",
    "El mínimo predeterminado es 10 puntos de código Unicode y el máximo 64. Configura " +
      code("AUTH_PASSWORD_MIN_LENGTH") +
      " y " +
      code("AUTH_PASSWORD_MAX_LENGTH") +
      " con enteros de 8 a 128 y mínimo menor o igual al máximo. Se rechazan coincidencias completas con el correo, su parte local o el nombre del proyecto. " +
      "La API limita las credenciales a 128 puntos de código y 512 bytes UTF-8, y rechaza sustitutos aislados. " +
      "Un rechazo de política al activar o cambiar una contraseña devuelve 400 con " +
      code("code: PASSWORD_POLICY") +
      ".",
    "Para autenticación de factor único, el requisito de longitud mínima de NIST SP 800-63B-4 es 15. Un máximo inferior a 64 se aparta de su recomendación. Auth v1 no incluye lista de bloqueo y puede aceptar contraseñas comunes que satisfagan las demás reglas.",
    "Los presupuestos persistentes de login, validación y confirmación de activación se configuran por separado. Respeta " +
      code("Retry-After") +
      " cuando la API responda 429 y cuando lo incluya en un 503. Consulta la [configuración de Auth](deployment.md#variables-de-auth).",
    sqlite
      ? "La auditoría SQLite depende de sus triggers y del esquema incluido. Mantén esas protecciones al migrar y restringe el acceso al archivo."
      : "",
  );

  const deployment = back ? deploymentDoc() : "";
  await mkdir(path.join(outputDir, "docs"), { recursive: true });
  const write = (file: string, text: string) => writeFile(path.join(outputDir, file), text);
  await Promise.all([
    write("README.md", readme),
    write("docs/development.md", development),
    ...(auth ? [write("docs/authentication.md", authentication)] : []),
    ...(back ? [write("docs/deployment.md", deployment)] : []),
    ...(full
      ? [
          write(
            "frontend/README.md",
            doc(
              "# Frontend",
              "React y Vite. Ejecuta los comandos desde esta carpeta. Consulta el [inicio rápido](../README.md) y la [guía de desarrollo](../docs/development.md).",
            ),
          ),
          write(
            "backend/README.md",
            doc(
              "# Backend",
              "API Express. Ejecuta los comandos del backend desde esta carpeta. Consulta el [inicio rápido](../README.md) y la [configuración y operaciones](../docs/deployment.md)." +
                (postgres
                  ? " Consulta también el [aprovisionamiento PostgreSQL](ops/README.md)."
                  : ""),
            ),
          ),
        ]
      : []),
  ]);

  function deploymentDoc(): string {
    return doc(
      "# Configuración, despliegue y mantenimiento",
      "## Primera inicialización manual",
      "### Desarrollo sin contenedores",
      "Instala dependencias con " +
        code("npm install") +
        (full ? " en " + code("backend/") + " y " + code("frontend/") : " en la raíz") +
        ". Crea " +
        code(backend + ".env") +
        " a partir de " +
        code(backend + ".env.example") +
        ". " +
        "Mantén permisos 0600 en Linux. En macOS y Windows restringe manualmente el acceso mediante los permisos y las ACL del sistema.",
      postgres
        ? "El operador aprovisiona la base y los roles con la [guía PostgreSQL](../" +
            backend +
            "ops/README.md). " +
            "En el .env local establece " +
            code("DATABASE_URL") +
            " de " +
            code("app_exec") +
            ". Proporciona " +
            code("MIGRATION_DATABASE_URL") +
            " de " +
            code("table_owner") +
            " solo desde una fuente protegida al generar o aplicar migraciones." +
            (auth ? " Usa esa misma conexión para bootstrap y recuperación." : "") +
            (docker
              ? " Para desarrollo sin contenedores, usa el host y puerto accesibles desde el equipo local."
              : "")
        : "",
      sqlite
        ? "Conserva " +
            code("DATABASE_URL=file:./data/app.db") +
            " o elige otro archivo persistente. " +
            "Usa el mismo destino para servidor y migraciones" +
            (auth ? ", así como para el bootstrap." : ".")
        : "",
      auth
        ? "Genera 32 bytes aleatorios con un generador criptográfico y guarda su representación hexadecimal en " +
            code("LOGIN_ABUSE_HMAC_KEY") +
            " con un editor privado, sin imprimir ni registrar el valor. Para desarrollo local usa " +
            code("NODE_ENV=development") +
            " y el origen " +
            code(full ? "http://localhost:5173" : "http://localhost:3000") +
            ". " +
            (full
              ? "Configura " +
                code("ACTIVATION_PAGE_URL=http://localhost:5173/activate") +
                " y ejecuta Vite con " +
                code("--strictPort") +
                " para conservar el origen."
              : "Configura " +
                code("ACTIVATION_PAGE_URL") +
                " según el cliente que recibirá el enlace.")
        : "",
      db
        ? (auth
            ? "Aplica las migraciones incluidas."
            : "Define el esquema y genera la primera migración antes de aplicarla.") +
            " Desde el backend:\n\n" +
            shell(
              ...(!auth ? ["npm run db:generate"] : []),
              "npm run db:migrate",
              ...(auth ? ["npm run auth:bootstrap"] : []),
            )
        : "",
      "Arranca los procesos indicados en el [inicio rápido](../README.md#desarrollo-diario).",
      docker
        ? "### Preparación con Compose\n\n" +
            "Ejecuta Compose desde la raíz. " +
            (db || auth || apiDocs
              ? "Cuando corresponda, copia el .env.example raíz a un .env privado. "
              : "Usa los valores suministrados en compose.yaml. ") +
            "Las imágenes instalan sus dependencias durante el build. " +
            (!auth && db
              ? "Antes de construir debe existir " +
                code(backend + "drizzle/") +
                " con las migraciones. Si aún no las tienes, genéralas desde el backend con las dependencias instaladas. "
              : "") +
            (auth ? "En Compose configura la clave HMAC en el .env raíz. " : "") +
            (postgres
              ? "El único .env raíz protege " +
                code("POSTGRES_PASSWORD") +
                ", " +
                code("DATABASE_URL") +
                " de app_exec y " +
                code("MIGRATION_DATABASE_URL") +
                " de table_owner. En ambas URLs usa el host " +
                code("postgres") +
                ". Arranca solo PostgreSQL y aprovisiona según la [guía de roles](../" +
                backend +
                "ops/README.md). " +
                "Para consultar credenciales creadas por setup, abre el .env en un editor privado local. No pegues valores en comandos, tickets, historiales de terminal ni salidas de CI.\n\n" +
                "Compose entrega la contraseña administrativa a PostgreSQL y la URL app_exec al backend. Setup utiliza contenedores puntuales con variables explícitas para migrar y administrar Auth. Mantén la protección de archivos y no inyectes todo el .env al backend mediante " +
                code("env_file") +
                ". "
              : "") +
            (tls
              ? "Configura primero [HTTPS local](#https-local-con-compose)."
              : auth
                ? "Antes de publicar el backend, prepara un terminador HTTPS externo y restringe el acceso directo al servicio."
                : "")
        : "",
      tls
        ? "## HTTPS local con Compose\n\n" +
            "Usa Docker Engine 28.0.0 y Compose 2.24.4 o posteriores. " +
            "Coloca certificados y claves fuera del repositorio y de los contextos de build. Configura rutas absolutas " +
            code("TLS_CERT_PATH") +
            " y " +
            code("TLS_KEY_PATH") +
            ". El certificado debe cubrir el nombre del origen en su SAN. Monta la cadena con el certificado del sitio primero. " +
            "La clave necesita modo 0400 y acceso para el UID 101 efectivo de Nginx. El certificado público también debe ser legible por ese UID. " +
            "Con Docker Desktop o remapeo de UID, verifica la identidad que ve el contenedor. Gestiona tú los permisos y la confianza de la CA en el navegador.\n\n" +
            "Para verificar una cadena con setup, indica " +
            code("TLS_CA_PATH") +
            " fuera del proyecto. Setup puede emitir con mkcert si ya dispone de una CA local. No instala confianza. " +
            "Configura " +
            code("AUTH_PUBLIC_ORIGIN=https://localhost:8443") +
            " sin barra final y ajusta el origen si cambias " +
            code("TLS_PORT") +
            ". El override deriva la URL de activación, publica HTTPS en loopback y usa " +
            code("TLS_NGINX_IP") +
            " como proxy confiable. Si la red se solapa, ajusta juntos " +
            code("TLS_SUBNET") +
            ", " +
            code("TLS_DYNAMIC_RANGE") +
            " y " +
            code("TLS_NGINX_IP") +
            " dejando la IP dentro de la subred y fuera del rango dinámico y de la puerta de enlace. " +
            "Si ya arrancaste el Compose base, usa " +
            code("docker compose down") +
            " sin " +
            code("-v") +
            " antes del primer arranque con TLS."
        : "",
      docker
        ? "## Operaciones con Compose\n\n" +
            (postgres
              ? "Para el recorrido manual, proporciona " +
                code("MIGRATION_DATABASE_URL") +
                " de una fuente privada en el entorno de los comandos puntuales. "
              : "") +
            shell(
              compose + " config --quiet",
              ...(postgres
                ? [
                    compose + " up -d --wait postgres",
                    compose +
                      " exec -T postgres psql -X -U postgres -d app -v target=app -f - < " +
                      backend +
                      "ops/provision.sql",
                    "# Ajusta el usuario y la base si los cambiaste. Asigna las contraseñas nuevas según la guía de roles.",
                  ]
                : []),
              compose + " build",
              ...(db ? [job + "backend node " + entry + "db/migrate.js"] : []),
              ...(auth ? [job + "backend node " + entry + "auth/bootstrap-cli.js"] : []),
              ...(auth && !tls
                ? ["# Solo tras configurar y verificar el proxy HTTPS externo."]
                : []),
              compose + " up -d --wait",
              compose + " ps",
            ) +
            (auth
              ? "\n\nPara recuperación, usa " +
                code(job + "backend node " + entry + "auth/recover-admin-cli.js") +
                " en una terminal."
              : "") +
            "\n\nDetén los servicios con " +
            code(compose + " down") +
            " sin " +
            code("-v") +
            ". " +
            (db
              ? "Haz copias de los datos antes de migraciones y comprueba que puedas restaurarlas."
              : "")
        : "",
      "## Variables de aplicación",
      "- " +
        code("PORT") +
        ": puerto de Express." +
        (docker ? " En Compose el backend usa 3000." : "") +
        "\n- " +
        code("CORS_ALLOWED_ORIGINS") +
        ": lista de orígenes permitidos separados por comas. Vacía o ausente, no se emiten cabeceras CORS." +
        (full ? " Usa el proxy de mismo origen en fullstack." : "") +
        (docker ? " El Compose generado no traspasa esta variable al backend." : "") +
        (db
          ? "\n- " +
            code("DATABASE_URL") +
            ": conexión en ejecución" +
            (sqlite ? " al archivo SQLite." : " del rol app_exec.")
          : "") +
        (postgres
          ? "\n- " + code("MIGRATION_DATABASE_URL") + ": conexión puntual de table_owner."
          : "") +
        (postgres && docker
          ? "\n- " +
            code("POSTGRES_USER") +
            ", " +
            code("POSTGRES_DB") +
            " y " +
            code("POSTGRES_PASSWORD") +
            ": identidad, base dedicada y contraseña administrativa del servicio."
          : "") +
        (apiDocs
          ? "\n- " +
            code("ENABLE_API_DOCS") +
            ": activa Swagger UI. Déjala deshabilitada cuando no la necesites."
          : "") +
        (full
          ? "\n- " +
            code("BACKEND_URL") +
            ": destino de Vite en desarrollo. Configúrala en el entorno del frontend."
          : ""),
      auth
        ? "## Variables de Auth\n\n" +
            "- " +
            code("AUTH_PUBLIC_ORIGIN") +
            " y " +
            code("ACTIVATION_PAGE_URL") +
            ": origen canónico y URL del cliente, sin query ni fragmento. En modo cookie la activación comparte origen. " +
            "Solo se admite HTTP en desarrollo explícito con " +
            code("NODE_ENV=development") +
            ", origen y conexión locales.\n" +
            "- " +
            code("AUTH_TRUSTED_PROXIES") +
            ": solo IP literales de proxies controlados, separadas por comas. Vacía con conexión directa. " +
            "El proxy debe sanear las cabeceras reenviadas del cliente y emitir un único " +
            code("X-Forwarded-Proto: https") +
            " cuando termine TLS.\n" +
            "- " +
            code("SESSION_IDLE_TIMEOUT_MINUTES") +
            " y " +
            code("SESSION_MAX_LIFETIME_HOURS") +
            ": inactividad y duración absoluta.\n" +
            "- " +
            code("AUTH_PASSWORD_MIN_LENGTH") +
            " y " +
            code("AUTH_PASSWORD_MAX_LENGTH") +
            ": límites de contraseña nueva.\n" +
            "- " +
            code("ARGON2_MAX_CONCURRENT") +
            " y " +
            code("ARGON2_MAX_QUEUE") +
            ": concurrencia y cola de hashing. Una cola de cero desactiva la espera.\n" +
            "- " +
            code("LOGIN_ABUSE_HMAC_KEY") +
            ": clave hex de 32 bytes, compartida solo entre instancias que usan la misma base. Cambiarla reinicia efectivamente los presupuestos.\n" +
            "- " +
            code("LOGIN_IP_REQUEST_LIMIT") +
            ", " +
            code("LOGIN_IDENTIFIER_FAILURE_LIMIT") +
            " y " +
            code("LOGIN_ABUSE_WINDOW_MINUTES") +
            ": límites y ventana de login.\n" +
            "- " +
            code("ACTIVATION_TOKEN_EXPIRY_HOURS") +
            ": caducidad del enlace, 24 horas por defecto.\n" +
            "- " +
            code("ACTIVATION_IP_REQUEST_LIMIT") +
            " y " +
            code("ACTIVATION_ABUSE_WINDOW_MINUTES") +
            ": límite por IP y ventana de confirmación.\n" +
            "- " +
            code("ACTIVATION_VALIDATION_IP_REQUEST_LIMIT") +
            " y " +
            code("ACTIVATION_VALIDATION_ABUSE_WINDOW_MINUTES") +
            ": presupuesto independiente para la validación previa."
        : "",
      "## Recuperación y despliegue",
      "Si setup se interrumpe, lee la etapa pendiente y repite el comando con la misma configuración. No regeneres credenciales ni borres datos. " +
        "Si queda un bloqueo " +
        code(".brixa-setup") +
        ", confirma que el proceso haya terminado antes de retirarlo. Mantén protegido cualquier .env provisional. " +
        (docker
          ? "Inspecciona los servicios y trabajos pendientes con " +
            code(compose + " ps -a") +
            " y " +
            code("docker ps -a") +
            ". Nunca uses " +
            code("down -v") +
            " como paso de recuperación. "
          : "") +
        (postgres
          ? "Si PostgreSQL quedó a medio aprovisionar, revisa las credenciales y roles existentes con el operador antes de continuar. "
          : "") +
        "No publiques archivos .env, salidas de configuración interpolada ni credenciales.",
      (tls ? "El override TLS cubre HTTPS local. " : "") +
        "Un despliegue público requiere DNS, un proxy de entrada apropiado, certificados confiables y renovables, aislamiento y operación de los servicios. " +
        (docker
          ? "Si ejecutas Express fuera de Compose, "
          : "Para ejecutar Express en producción, ") +
        (language === "ts" ? "compila con " + code("npm run build") + " y " : "") +
        "arranca con " +
        code("npm start") +
        " desde el backend, con el entorno de producción configurado. " +
        (full ? "Sirve el frontend compilado y enruta /api al backend sin ese prefijo. " : "") +
        (auth
          ? "Mantén los controles de HTTPS y sesión, sanea las cabeceras reenviadas y valida en el origen público el enlace de activación y los flujos de Auth."
          : ""),
    );
  }
}
