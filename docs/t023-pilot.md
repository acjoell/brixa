# T-023 — Piloto TypeScript → JavaScript

Última comprobación: **2026-11-19**. El bloqueo de auditoría por picomatch ha
desaparecido tras la retirada oficial del aviso el 2026-11-18. La ejecución
integral local registra 32 variantes y 47 auditorías estrictas correctas. Los
resultados del 2026-11-17 se conservan abajo como historial; ya no describen un
bloqueo vigente. T-023 continúa EN PROGRESO por los criterios restantes.
El responsable confirmó CI remota verde del piloto committed. El incremento
React main descrito más abajo tiene comprobaciones ligeras propias y validación
integral manual confirmada por el responsable; la CI de este incremento está pendiente.

## Alcance y uso

Cobertura explícita: `database-postgres` (`src/db/client`, `src/db/migrate`,
`src/db/schema`, `tests/db.test`, `vitest.config`) y el único par React
`frontend-react-ts/src/main.tsx` → `frontend-react-js/src/main.jsx`. TypeScript es la fuente;
JavaScript permanece versionado. El generador sigue copiando archivos desde disco.

- `npm run derive:js`: actualiza estos seis archivos JS/JSX.
- `npm run check:sync` o `npm run verify:sync`: compara el contenido exacto sin
  escribir, ejecutando también ESLint sobre la derivación esperada con la
  configuración real del backend JavaScript y lint ligero de main.jsx.
  Cualquier warning o error falla.
- CI ejecuta `verify:sync` en su matriz existente; no certifica otros overlays.

Se mantienen manualmente `package.json`, `drizzle.config.{ts,js}`, Dockerfiles,
ESLint y archivos exclusivos TS. No se cambia ninguna de estas configuraciones.
En PostgreSQL no hay reescrituras de literales: los imports relativos ya usan `.js`,
y las referencias de migración no contienen extensiones dependientes del lenguaje.
El import explícito de `URL` se incorpora a TS para preservar el JS existente.
Los cinco archivos derivados coinciden byte a byte con el JavaScript anterior.

## Elección técnica

D-098, no D-066, aprueba AST/Babel y el modelo híbrido. D-066 exige versiones
exactas. Se añaden únicamente `@babel/core` y `@babel/plugin-transform-typescript`
como dependencias de desarrollo, con lockfile. La serie Babel 7 respeta el mínimo
Node 24.0 de Brixa; Babel 8 exige Node 24.11. Prettier ya existía.
`onlyRemoveTypeImports` exige disciplina `import type`; Babel no verifica tipos.
Documentación consultada: [transform-typescript](https://babeljs.io/docs/babel-plugin-transform-typescript).
Se desactiva la búsqueda de configuraciones Babel externas y se preservan líneas
antes del formateo para minimizar el diff. No se transforma código mediante regex.
El piloto comprueba la existencia de referencias locales runtime mediante AST
(imports, reexports e imports dinámicos literales), exige `.js` y contempla los
archivos del backend base que proporciona la composición. No resuelve de forma
general los exports nominales ni los subpaths de paquetes externos. El incremento
React habilita TSX/JSX y adapta únicamente referencias de módulos relativas por AST.

## Prerrequisitos

La rama inicial `feat/t023-js-ts-derivator` estaba limpia, en `32e3707`.
El tag anotado local `v0.1.0` conserva el commit
`fc1949068373220cc1048deb6f0f6eb0ac88870f` (T-019/D-060). T-019 permite cambios
posteriores sin moverlo; su preflight de creación no se vuelve a aplicar a una
rama de desarrollo. No se verificó remotamente el Release ni se publicó nada.

T-018 no está integrada en esta rama: no existen `verify:security` ni `verify:all`.
La ficha de T-023 enumera D-098 como dependencia directa; el orden de trabajo
conjunto exige conservar pendiente la validación global de T-018. El piloto es
independiente y no incorpora cambios de esa tarea ni desbloquea Auth/RBAC.

## Validación técnica del piloto (2026-11-17)

Entorno: Linux, Node 24.22.1. No se incorporaron cambios de T-018 ni se alteró el
arnés, sus auditorías, los umbrales de seguridad o los controles de CI.

### Arnés obligatorio

Se ejecutaron por separado:

```sh
npm run verify:generated -- backend+ts+postgres
npm run verify:generated -- backend+js+postgres
```

Ambos: build de Brixa correcto, 32 variantes coincidentes, contenedor PostgreSQL
iniciado y listo, generación e instalación independientes correctas. Ambos
terminan con código **1** en `npm audit --audit-level=moderate`, antes de las
comprobaciones funcionales: **11 high en TS, 5 high en JS**, por picomatch,
[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).
Se limpiaron proyectos y contenedores. No se aplicó `audit fix --force`.

### Diagnóstico funcional separado, con auditoría fallida visible

Para aislar la paridad se generaron otras dos copias temporales con el generador
real compilado y se ejecutó la misma secuencia de comandos y la prueba de
`tests/db.test` existentes, sin editar el arnés. Cada instalación fue seguida por
la auditoría completa, que volvió a fallar; las comprobaciones posteriores son
**evidencia funcional adicional, no una ejecución aprobada de verify:generated**.
El diagnóstico mantuvo código global **1**, aunque sus pasos funcionales pasaron.

| Comprobación | TypeScript | JavaScript |
|---|---|---|
| Generación sin lockfile inicial y sin dependencias Babel | Correcta | Correcta |
| `npm install --no-audit`, seguido de auditoría separada | Instalación correcta; audit 1 | Instalación correcta; audit 1 |
| `npm run build`, `npm run typecheck` | Ambos 0 | No existen estos scripts; ejecución directa con Node |
| `npm run lint`, `npm run format:check` | Ambos 0 | Ambos 0 |
| `npm run db:generate` | 0; SQL generado | 0; SQL generado |
| `npm run db:migrate` con DATABASE_URL temporal | 0; migración aplicada | 0; migración aplicada |
| Tabla test_items, INSERT y SELECT con psql | Correctos en base aislada pilot_ts | Correctos en base aislada pilot_js |
| `npm test` con DATABASE_URL definida | 5 archivos, 47 pruebas aprobadas, sin omisiones | 5 archivos, 47 pruebas aprobadas, sin omisiones |
| Servidor real, GET /health | 200, `{"status":"ok"}` | 200, `{"status":"ok"}` |
| Resultado global, incluida auditoría | **1, fallo** | **1, fallo** |

Se utilizó PostgreSQL vía Docker (`postgres:17-alpine`), con puerto publicado
únicamente en loopback, credenciales efímeras y bases separadas. La tabla de
prueba y la secuencia generate/migrate/tests proceden de
`verifyDatabaseIntegration` en `scripts/verify-generated.js`. Se detuvo el
contenedor y se eliminaron las copias temporales. No se construyeron imágenes de
las aplicaciones generadas ni se ejecutó Docker Compose: esos escenarios siguen
pendientes. El arnés usa `postgres:17-alpine`, mientras las plantillas fijan
`postgres:17.4-alpine`; la diferencia P-015 ya pertenece a T-018 y no se modificó.

Evidencia local adicional (fuera de Git): script
`/tmp/brixa-t023-diagnostics.mjs` y registro
`/tmp/brixa-t023-diagnostics.log`. Son auxiliares de esta sesión, no comandos
permanentes del producto. Para reproducir el diagnóstico manual: generar backend
TS/JS con PostgreSQL en directorios distintos; instalar y auditar cada uno;
ejecutar build/typecheck en TS, lint y format:check en ambos; iniciar PostgreSQL
como hace el arnés; definir test_items con id serial y title text en el esquema
temporal; ejecutar db:generate, db:migrate, comprobar INSERT/SELECT y ejecutar
npm test con DATABASE_URL; arrancar dist/index.js (TS) o src/index.js (JS) y
comprobar /health. El fallo de audit siempre debe conservarse en el informe.

### Imports, exports y referencias

| Archivo del piloto | Contrato observado y verificado |
|---|---|
| src/db/client | Conserva import default de pg, drizzle, namespace de ./schema.js, URL de node:url y exports pool/db |
| src/db/migrate | Conserva fs/path/URL, pg, drizzle, migrator y ../redact.js; este último procede del backend base; sin exports públicos |
| src/db/schema | Solo comentarios en la plantilla; los ejemplos y literales se conservan; las pruebas temporales añaden testItems como hace el arnés |
| tests/db.test | Conserva imports de vitest e import dinámico ../src/db/client.js; prueba SELECT 1 ejecutada con PostgreSQL real |
| vitest.config | Conserva defineConfig y export default con fileParallelism false |
| Archivos manuales | Drizzle apunta a schema.ts/schema.js; db:migrate usa tsx migrate.ts / node migrate.js; tipos solo en TS; configuraciones excluidas intactas |

Las rutas relativas `.js` de las fuentes TS corresponden a la salida NodeNext;
no se sustituyen extensiones en literales o comentarios. Los cinco resultados
siguen coincidiendo byte a byte con el JavaScript anterior al piloto.

Se reprodujo un defecto: check:sync aceptaba un reexport hacia un archivo local
inexistente después de derivarlo. Se corrigió la validación de referencias locales
por AST, después de eliminar tipos, con pruebas negativas de import estático,
export nominal, export *, import dinámico y extensión `.ts` incorrecta. Se
consideran destinos previstos los cinco archivos derivados, para permitir que
derive:js restaure archivos ausentes. Las referencias que escapan del overlay se
rechazan. Los imports dinámicos deben ser literales.

Una prueba ejecuta la salida Babel y la salida del compilador TypeScript de una
misma fixture: compara claves exportadas, export default, valores nominales,
namespace import, reexport, export * e import dinámico; el import type y export
type desaparecen sin cargar el módulo de tipos inexistente. Esto comprueba esos
casos concretos; no demuestra equivalencia universal de cualquier TypeScript.

`onlyRemoveTypeImports` no infiere usos solo de tipos. Es obligatorio usar
`import type`; no se añade reescritura heurística de imports vacíos. La validación
estática no garantiza todos los nombres exportados por paquetes externos o por
cualquier grafo futuro: el grafo actual se comprueba además en ejecución.

### Sincronización, JSX/TSX y calidad local

Se probó con los comandos reales, sobre un archivo guardado y restaurado:

1. Añadir un comentario manual a js/src/db/client.js.
2. `npm run check:sync`: código 1 y mensaje de desincronización; archivo intacto.
3. `npm run derive:js`: código 0; contenido original restaurado exactamente.
4. `npm run check:sync`: código 0.

Los tests comprueban también archivo ausente, cambios en TS, determinismo,
comentarios, marcador @@INSERT, literales intactos, lint negativo e import duplicado.

La prueba exploratoria JSX/TSX fallaba con un error de parser. Se hizo explícito
el límite: derive rechaza nombres `.tsx` y `.jsx` con un error del piloto, cubierto
por dos tests. No se activaron plugins JSX, ni se derivó otra plantilla. Preservar
JSX sigue siendo un criterio pendiente de D-098/T-023 antes de una expansión.

`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`,
`npm run build`, `npm run verify:sync` y `git diff --check`: correctos.
La suite completa tiene **167 pruebas**, incluidas **11 del piloto**.

## Separación de ejecución funcional y auditoría (2026-11-17)

Esta comprobación posterior sustituye los pendientes de ejecución funcional
indicados en el diagnóstico anterior, sin convertir su auditoría fallida en éxito.
Se reutiliza `scripts/verify-generated.js`, sin modificar T-018 ni dependencias:

- `npm run verify:generated`: modo integral original. Instala, audita con
  `npm audit --audit-level=moderate` y verifica funcionamiento. Sigue fallando
  ante errores de auditoría, sin excepciones por advisory o severidad.
- `npm run verify:generated:functional`: instala y ejecuta las comprobaciones
  funcionales existentes. Declara expresamente «seguridad NO EVALUADA».
- `npm run verify:generated:audit`: genera, instala y audita con el mismo comando
  estricto; no ejecuta pruebas funcionales ni necesita arrancar Docker.

Los tres conservan filtros de variantes y particiones portables. Los modos
explícitos no se pueden combinar. Las instalaciones son independientes, sin
introducir lockfiles en las plantillas. En CI se distinguen pasos funcionales y
de auditoría en portable y full. La auditoría usa `!cancelled()` para ejecutarse
también tras un fallo funcional; no usa `continue-on-error`. Un fallo de cualquiera
mantiene rojo el job y el workflow. La matriz remota aún no se ha ejecutado.

| Comando ejecutado | Resultado real |
|---|---|
| `verify:generated:functional -- backend+ts+postgres backend+js+postgres backend+ts+postgres+docker backend+js+postgres+docker` | Código 0, cuatro variantes completas, 208,48 s |
| `verify:generated:functional -- fullstack+ts+postgres fullstack+js+postgres` | Código 0, ambas variantes completas, incluido proxy Vite |
| `verify:generated:audit -- backend+ts+postgres` | Código 1, 11 paquetes high por picomatch |
| `verify:generated:audit -- backend+js+postgres` | Código 1, 5 paquetes high por picomatch |
| `verify:generated -- backend+js+postgres` | Código 1 en audit; comportamiento integral estricto conservado |

En las cuatro variantes sin contenedores de aplicación se ejecutaron instalación,
lint, formato, build/typecheck cuando corresponden, migraciones, comprobación de
tabla y 47 pruebas por backend con PostgreSQL Docker. Backend JS/TS respondió
/health; fullstack JS/TS respondió /api/health mediante Vite. En las dos variantes
Docker Compose se construyeron y arrancaron imágenes de aplicación, se aplicaron
migraciones y se comprobaron HTTP y la tabla real, con postgres:17.4-alpine.
El arnés detuvo los contenedores y limpió los directorios temporales.

Registros locales: `/tmp/brixa-t023-functional-current.log`,
`/tmp/brixa-t023-fullstack-current.log`, `/tmp/brixa-t023-audit-ts-current.log`,
`/tmp/brixa-t023-audit-js-current.log` y `/tmp/brixa-t023-integral-current.log`.
No se encontraron defectos funcionales adicionales del derivador.

La suite local pasa con **172 pruebas** (las 167 anteriores más cinco casos de
selección de modo, separación y propagación de errores). También pasan tipos,
lint, formato, verify:sync y git diff --check. No se modificó package-lock.json
durante esta continuación ni se intentó corregir picomatch.

## Revalidación tras la retirada del aviso (2026-11-19)

GitHub marca [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
como **Withdrawn**, con fecha de retirada **2026-11-18**. El
[PR externo #181](https://github.com/ahliweb/awcms-astro/pull/181) corrobora la
retirada, pero no se trasladó ninguna modificación de ese proyecto a Brixa.

Se comprobó contra https://registry.npmjs.org/, en Linux con Node 24.22.1 y
npm 11.19.1. `npm ls picomatch --all` sigue mostrando picomatch 4.0.7: no se
actualizaron dependencias, lockfiles ni código funcional. No se ejecutó audit fix
ni se añadieron overrides o excepciones; tampoco se limpiaron cachés para alterar
los resultados.

| Comando / comprobación | Código de salida y resultado observado |
|---|---|
| `npm audit --audit-level=moderate --json --logs-max=0` en Brixa | 0; cero vulnerabilidades en todas las severidades |
| `verify:generated:audit -- backend+ts+postgres backend+js+postgres` | 0; ambas auditorías con cero vulnerabilidades |
| `npm run verify:generated` sin flags, 32 variantes | Registro final de éxito, 1152,19 s; 32/32 variantes y 47/47 auditorías aprobadas, sin omisiones ni errores. El reinicio del servidor perdió la sesión y no se recuperó el código numérico del shell de esta ejecución |
| `verify:generated -- backend+ts+postgres backend+js+postgres`, repetido tras completar el anterior | 0 capturado directamente; auditorías, migraciones, tablas, HTTP y 47 pruebas por variante correctas |
| `typecheck`, `lint`, `format:check`, `npm test`, `verify:sync`, `git diff --check` | Todos 0; 172 pruebas locales aprobadas |
| `npm pack --dry-run --ignore-scripts --json --logs-max=0` | Primer intento 226, EROFS en caché npm por sandbox; repetido con permisos: 0, 188 archivos y ninguno en src/, scripts/, .agents/ o node_modules/ |

El arnés completo verificó PostgreSQL y SQLite, backend y fullstack, Docker
Compose, documentación de API e i18n. Su registro contiene las 47 invocaciones
esperadas de `npm audit --audit-level=moderate`, todas satisfactorias, sin
`NO VERIFICADO`, timeouts ni errores funcionales o de seguridad. Las instalaciones
usan `--no-audit` únicamente para evitar la consulta implícita duplicada; cada una
es seguida por su auditoría explícita en el modo integral. No se usó el modo
funcional para declarar aprobada esta ejecución integral.

Los únicos avisos restantes son deprecaciones de `@esbuild-kit/esm-loader@2.6.5`
y `@esbuild-kit/core-utils@3.3.2` (integrados en tsx), y la notificación de nueva
versión de npm 11.19.1 → 12.2.3. No son hallazgos de npm audit y no se aplicaron
actualizaciones. Los incidentes de infraestructura fueron el reinicio y el
primer intento de pack restringido; no son defectos funcionales de T-023.

Evidencia local: `/tmp/brixa-t023-audit-root-20261119.json`,
`/tmp/brixa-t023-audit-variants-20261119.log`,
`/tmp/brixa-t023-integral-full-20261119.log`,
`/tmp/brixa-t023-integral-pilot-20261119.log` y
`/tmp/brixa-t023-pack-20261119.json`.
Los hashes SHA-256 de package.json y package-lock.json son los mismos que antes
de ejecutar los comandos. La auditoría estricta del arnés y los pasos de CI
permanecen intactos. No existe verify:all en esta rama, no se incorporó T-018 y
no se ejecutó CI remota ni la matriz Windows/macOS/Node 26.

## Incremento mínimo React main: TSX → JSX (2026-11-19)

D-098 exige preservar JSX y usar TypeScript como fuente del código aplicativo.
Se eligió únicamente `main`: elimina la aserción no nula de `getElementById` y
adapta `./App.tsx` a `./App.jsx`, manteniendo exactamente su ejecución. El diff
del main JavaScript anterior es solo de comillas y punto y coma de Prettier.

Babel usa `isTSX` del plugin TypeScript ya instalado. Conserva JSX sin convertirlo
a llamadas ni añadir imports de jsx-runtime: Vite y @vitejs/plugin-react siguen
compilándolo con las configuraciones existentes (`react-jsx` en TypeScript).
La sincronización comparte comparación, lint y validación de referencias con
PostgreSQL. No se toca el generador, package.json, lockfile, Vite, ESLint de las
plantillas ni CI; el verify:sync ya integrado cubre automáticamente el nuevo par.

Solo en fuentes JSX/TSX se adaptan imports, reexports e imports dinámicos literales
relativos terminados en `.tsx`/`.ts` a `.jsx`/`.js`. Los textos JSX, strings de
aplicación y comentarios quedan intactos. Se valida la existencia de las
referencias actuales de main (.jsx y .css), sin resolver universalmente módulos.
App.jsx y useAppContent.jsx siguen manuales; este último tiene además un texto
visible `src/App.jsx` que difiere de su fuente TSX y requiere tratamiento explícito
cuando se incorpore. No se han derivado otros archivos frontend u overlays.

Comprobaciones ejecutadas, todas con código 0:

- `npm test -- scripts/derive-react.test.js scripts/derive-postgres.test.js`:
  16 casos, incluidos cinco nuevos. Cubren fragmentos/JSX, genéricos y tipos
  borrados, import type, imports/reexports/dynamic import, strings y texto JSX
  intactos, comentarios/marcadores, determinismo, edición manual, archivo ausente,
  restauración, fuente modificada, referencia inexistente y lint negativo.
- Comparación del main real con la salida de TypeScript en modo JSX Preserve,
  normalizada sintácticamente; no es una prueba de render ni un typecheck React.
- Prueba focalizada del compositor de inserciones i18n sobre el main derivado,
  sin generación de proyectos.
- `typecheck` de Brixa, `lint`, `format:check`, `verify:sync`, `git diff --check`.

El lint ligero JSX usa @eslint/js recommended y el parser TypeScript existente;
comprueba main.jsx sin instalar paquetes. No sustituye el lint completo del
proyecto React con react-hooks/react-refresh, cuyos plugins no están instalados
en Brixa. Tampoco se ejecutó el build/typecheck de la plantilla frontend, que
requiere sus dependencias React. No hubo instalaciones, nuevas dependencias,
auditorías omitidas, matrices ni ejecuciones integrales en este incremento.

Validación manual realizada por el responsable, que confirmó ambos comandos sin
errores (no repetida por el agente en la revisión de commit):

```sh
npm run verify:generated -- frontend+ts frontend+js
npm run verify:generated -- frontend+ts+i18n fullstack+js+sqlite+i18n
```

Estos comandos cubren ambas bases y la inserción de i18n para TS/JS usando
variantes ya existentes. Incluyen sus auditorías, build, tipos donde corresponden,
lint React y funcionamiento. No se recibieron logs ni códigos numéricos adicionales;
la evidencia se atribuye a la confirmación del responsable. La CI verde confirmada
corresponde al piloto previo; no acredita este diff nuevo. T-023 sigue EN PROGRESO.

## Inventario de cobertura restante para D-098

La inspección estática identifica 31 pares TS/TSX → JS/JSX existentes. Seis están
cubiertos (cinco de PostgreSQL y React main); dos son Drizzle config, excluidos
expresamente por D-098. Quedan **23 pares** sin sincronización automática:

| Directorios fuente → destino bajo src/templates/ | Pares manuales pendientes |
|---|---|
| backend-express-ts → backend-express-js | src/app, src/config, src/errors, src/index, src/redact; tests/config.test, tests/cors.test, tests/errors.test, tests/health.test (.ts → .js): 9 |
| frontend-react-ts → frontend-react-js | src/App y src/useAppContent (.tsx → .jsx): 2 |
| database-sqlite/ts → database-sqlite/js | src/db/client, src/db/migrate, src/db/schema y tests/db.test (.ts → .js): 4 |
| api-docs/ts → api-docs/js | src/docs/swagger, src/docs/validate-env y tests/docs.test (.ts → .js): 3 |
| i18n/ts → i18n/js | src/i18n (.ts → .js), src/components/LanguageSelector y src/useAppContent (.tsx → .jsx): 3 |
| Configuraciones sin divergencia estructural actual | frontend-react-ts/vite.config.ts → frontend-react-js/vite.config.js; database-sqlite/ts/vitest.config.ts → database-sqlite/js/vitest.config.js: 2 |

Los primeros 21 pares son código aplicativo o pruebas y entran directamente en
el modelo fuente TS de D-098: no son ampliaciones opcionales del producto. Las dos
configuraciones restantes son equivalentes y no tienen una excepción documentada;
deben entrar en sincronización o recibir una justificación concreta de divergencia,
sin asumir una excepción general para cualquier archivo de configuración.

Los cuatro fragmentos api-docs/_fragments/{app.imports,app.routes,index.imports,
index.startup} están duplicados y son idénticos entre ts/js. Son código de
composición, sin extensión TS/JS: deben conservar una fuente/control de igualdad
al incorporar api-docs, sin exigir un nuevo formato o reescritura del compositor.
También son idénticas las dos copias i18n/{ts,js}/scripts/check-i18n.mjs; ya son
JavaScript en ambos árboles. D-098 no exige convertirlas artificialmente a TS ni
deduplicarlas como condición de la derivación TS → JS.

Se mantienen las excepciones aprobadas para package.json, Dockerfiles, ESLint,
Drizzle config y archivos exclusivamente de tipos/TypeScript, incluido
frontend-react-ts/src/appContent.types.ts. CSS, assets, HTML, locales JSON,
openapi.json y documentación no son pares de código TS → JS. Su deduplicación,
un resolver universal o capacidades futuras de Auth/RBAC no son requisitos de
cierre de T-023. Sí se exige que los imports de los pares incorporados sean
válidos, con import type y excepciones explícitas para literales/rutas divergentes.

## Matriz de aceptación T-023 / D-098 y D-066

| Requisito | Estado | Evidencia / pendiente |
|---|---|---|
| Derivación AST determinista, comentarios y marcadores | Cumplido en la cobertura actual | PostgreSQL y React main; Babel/Prettier y pruebas focalizadas |
| check:sync / verify:sync solo lectura y detección de deriva | Cumplido en el piloto | Prueba CLI 1 → derive 0 → check 0; tests de archivos ausentes y TS cambiado |
| Fallo ante imports inválidos | Parcial | Parser y referencias locales cubiertos; resolución general de paquetes y exports nominales pendiente |
| JS versionado, lint y pruebas de plantillas | Cumplido en la cobertura actual | PostgreSQL verificado y cuatro variantes React aprobadas manualmente según el responsable |
| CLI copia preconstruidos; sin Babel en proyectos generados | Cumplido en el piloto | Generación real de ambos proyectos y revisión de manifests; generador intacto |
| Typecheck TS y paridad funcional PostgreSQL TS/JS | Cumplido localmente | Revalidación integral del 2026-11-19 con auditorías satisfactorias |
| Paridad completa mediante verify:generated | Piloto previo y React comprobados; cobertura completa pendiente | Registro previo de 32/32 y 47/47 auditorías; cuatro variantes React confirmadas por el responsable; nuevos pares aún no incorporados |
| PostgreSQL vía Docker | Cumplido localmente | BD real, imágenes y Compose backend/fullstack JS/TS, incluida documentación de API |
| JSX/TSX preservado | Cumplido en main/fixtures y variantes manuales comprobadas | JSX conservado e imports adaptados por AST; pendiente aplicar la capacidad a los pares TSX del inventario |
| Integración de verify:sync en CI | CI verde del piloto confirmada por responsable | Nuevo par incluido por el mismo comando; CI del incremento pendiente |
| Alcance completo T-023 / integración posterior con T-018 | Pendiente | 21 pares aplicativos/pruebas y dos configuraciones del inventario aún manuales; controlar fragmentos api-docs al incorporarlos; T-018 intacta |
| D-066: versiones directas exactas | Cumplido en componentes revisados | 8/14 dependencias en backend JS/TS y 3/4 en overlay JS/TS; ningún rango directo |
| D-066: imágenes exactas y sin lockfile generado por CLI | Cumplido en plantillas revisadas | node:24.22.1-slim y postgres:17.4-alpine; ambas generaciones inicialmente sin lockfile |
| D-066: revisión de seguridad y validación antes de adoptar actualizaciones | Sin bloqueo externo de auditoría vigente | Auditorías y ejecución integral local satisfactorias; ninguna dependencia actualizada |

**Recomendación:** mantener T-023 **EN PROGRESO**. El bloqueo externo de picomatch
ha desaparecido y la validación integral local ya tiene evidencia positiva sin
exenciones. JSX/TSX ya tiene un caso real mínimo validado también manualmente;
faltan CI del incremento y la cobertura del inventario con sus imports y pruebas
negativas de sincronización. No se declara cerrada T-023 ni se desbloquea Auth/RBAC.
