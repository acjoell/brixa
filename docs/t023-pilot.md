# T-023 — Piloto TypeScript → JavaScript

Última comprobación: **2026-11-19**. El bloqueo de auditoría por picomatch ha
desaparecido tras la retirada oficial del aviso el 2026-11-18. La ejecución
integral local registra 32 variantes y 47 auditorías estrictas correctas. Los
resultados del 2026-11-17 se conservan abajo como historial; ya no describen un
bloqueo vigente. T-023 continúa EN PROGRESO por los criterios restantes.

## Alcance y uso

Piloto limitado a `database-postgres`: `src/db/client`, `src/db/migrate`,
`src/db/schema`, `tests/db.test` y `vitest.config`. TypeScript es la fuente;
JavaScript permanece versionado. El generador sigue copiando archivos desde disco.

- `npm run derive:js`: actualiza estos cinco archivos JavaScript.
- `npm run check:sync` o `npm run verify:sync`: compara el contenido exacto sin
  escribir, ejecutando también ESLint sobre la derivación esperada con la
  configuración real del backend JavaScript. Cualquier warning o error falla.
- CI ejecuta `verify:sync` en su matriz existente; no certifica otros overlays.

Se mantienen manualmente `package.json`, `drizzle.config.{ts,js}`, Dockerfiles,
ESLint y archivos exclusivos TS. No se cambia ninguna de estas configuraciones.
No hay reescrituras de literales: los imports relativos actuales ya usan `.js`,
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
general los exports nominales ni los subpaths de paquetes externos. No soporta
JSX/TSX: ahora los rechaza explícitamente; no se amplía a frontend.

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

## Matriz de aceptación T-023 / D-098 y D-066

| Requisito | Estado | Evidencia / pendiente |
|---|---|---|
| Derivación AST determinista, comentarios y marcadores | Cumplido en el piloto | Cinco salidas idénticas, Babel/Prettier y tests |
| check:sync / verify:sync solo lectura y detección de deriva | Cumplido en el piloto | Prueba CLI 1 → derive 0 → check 0; tests de archivos ausentes y TS cambiado |
| Fallo ante imports inválidos | Parcial | Parser y referencias locales cubiertos; resolución general de paquetes y exports nominales pendiente |
| JS versionado, lint y pruebas de plantillas | Cumplido en el piloto | JS existente en Git; lint y 47 pruebas por backend en cuatro variantes del arnés funcional |
| CLI copia preconstruidos; sin Babel en proyectos generados | Cumplido en el piloto | Generación real de ambos proyectos y revisión de manifests; generador intacto |
| Typecheck TS y paridad funcional PostgreSQL TS/JS | Cumplido localmente | Revalidación integral del 2026-11-19 con auditorías satisfactorias |
| Paridad completa mediante verify:generated | Completada localmente; CI remota pendiente | Registro de 32/32 variantes y 47/47 auditorías; repetición integral del piloto con salida 0 capturada |
| PostgreSQL vía Docker | Cumplido localmente | BD real, imágenes y Compose backend/fullstack JS/TS, incluida documentación de API |
| JSX/TSX preservado | Pendiente explícito | Rechazado con error y tests; fuera de este piloto |
| Integración de verify:sync en CI | Implementada, ejecución remota pendiente | Paso en matriz existente; ejecución local correcta |
| Alcance completo T-023 / integración posterior con T-018 | Pendiente | Solo database-postgres; no se importó T-018 ni se expandió el piloto |
| D-066: versiones directas exactas | Cumplido en componentes revisados | 8/14 dependencias en backend JS/TS y 3/4 en overlay JS/TS; ningún rango directo |
| D-066: imágenes exactas y sin lockfile generado por CLI | Cumplido en plantillas revisadas | node:24.22.1-slim y postgres:17.4-alpine; ambas generaciones inicialmente sin lockfile |
| D-066: revisión de seguridad y validación antes de adoptar actualizaciones | Sin bloqueo externo de auditoría vigente | Auditorías y ejecución integral local satisfactorias; ninguna dependencia actualizada |

**Recomendación:** mantener T-023 **EN PROGRESO**. El bloqueo externo de picomatch
ha desaparecido y la validación integral local ya tiene evidencia positiva sin
exenciones. Siguen pendientes CI remota y los criterios de la tarea completa que
exceden el piloto PostgreSQL, incluidos JSX/TSX y la cobertura de imports al
ampliar el alcance. No se declara cerrada T-023 ni se desbloquea Auth/RBAC.
