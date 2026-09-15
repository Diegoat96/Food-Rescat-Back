# Foodrescat Backend — REST API

Backend de **Foodrescat** (apps anti-desperdicio de alimentos) construido con:

- **NestJS 11** (TypeScript)
- **Prisma 6** ORM + **PostgreSQL 16**
- **Passport/JWT** para autenticación (Bearer token)
- **Swagger** para documentación interactiva

La API está pensada para exponer un conjunto de recursos a una **aplicación de
consumo (frontend o app móvil)**. Este documento explica cómo funciona, cómo
conectarse y qué esperar de cada endpoint.

---

## Tabla de contenidos

1. [Puesta en marcha](#puesta-en-marcha)
2. [Variables de entorno](#variables-de-entorno)
3. [Convenciones de la API](#convenciones-de-la-api)
4. [Autenticación y roles](#autenticación-y-roles)
5. [Enumeraciones del dominio](#enumeraciones-del-dominio)
6. [Endpoints por módulo](#endpoints-por-módulo)
7. [Flujo completo del negocio](#flujo-completo-del-negocio)
8. [Configuración del frontend](#configuración-del-frontend)

---

## Puesta en marcha

### Requisitos

- Node.js 22+
- pnpm 11+
- Docker + Docker Compose (para PostgreSQL y build del backend)
- Java/Node disponibles solo si vas a usar los scripts de desarrollo

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Configurar entorno

Copia el archivo `.env.example` a `.env` y ajusta los valores:

```bash
# Windows
copy .env.example .env

# Linux/macOS
cp .env.example .env
```

Ver [Variables de entorno](#variables-de-entorno).

### 3. Levantar PostgreSQL

```bash
docker compose up -d postgres
```

### 4. Aplicar migraciones de base de datos

```bash
pnpm prisma:migrate
```

Esto aplica todas las migraciones de `prisma/migrations` sobre la base de datos
de `DATABASE_URL`.

> **Importante**: ya no existe `prisma/seed.ts`. **No ejecutes `prisma db seed`.**
> Los usuarios (incluido el administrador) se crean directamente en la base de
> datos o mediante el registro de la API + promoción manual de rol. Ver
> [Autenticación y roles](#autenticación-y-roles).

### 5. Arrancar el servidor

```bash
pnpm start:dev        # desarrollo con watch
pnpm start:prod       # compilado: node dist/main
```

O bien todo el stack en Docker:

```bash
docker compose up --build
```

### 6. Verificar

- API base: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`
- Prisma Studio (interfaz de la BD): `pnpm prisma:studio`

---

## Variables de entorno

| Variable               | Obligatoria | Por defecto               | Descripción                                              |
| ---------------------- | ----------- | ------------------------- | -------------------------------------------------------- |
| `PORT`                 | No          | `3000`                    | Puerto HTTP de la API                                    |
| `DATABASE_URL`         | Sí          | —                         | Cadena de conexión PostgreSQL                            |
| `JWT_SECRET`           | Sí          | —                         | Secreto para firmar tokens JWT (la app falla si está vacío) |
| `JWT_EXPIRES_IN`       | No          | `1d`                      | Expiración del token (p. ej. `1d`, `8h`)                 |
| `CORS_ORIGIN`          | No          | `http://localhost:4200`   | Origen(es) permitidos, separados por coma                 |
| `UPLOADS_ROOT`         | No          | `./uploads`               | Carpeta donde se guardan licencias y fotos               |
| `CRON_EXPIRACION_CADA_MINUTOS` | No    | `5`                       | Minutos entre ejecuciones del cron de expiración         |

Ejemplo de `.env`:

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://Foodrescat:foodrescat_dev@localhost:5432/Foodrescat?schema=public
JWT_SECRET=una-cadena-larga-y-aleatoria
JWT_EXPIRES_IN=1d
CORS_ORIGIN=http://localhost:4200
UPLOADS_ROOT=./uploads
```

---

## Convenciones de la API

### Prefijo global

Todas las rutas cuelgan de `/api`. Ejemplo: `POST https://host:3000/api/auth/login`.

### Formato de respuesta

Todas las respuestas exitosas viajan dentro de un envoltorio uniforme:

```json
{
  "success": true,
  "data": { /* recurso o lista */ }
}
```

### Formato de error

Todos los errores usan el mismo molde:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "descripción legible del error",
  "error": "BadRequest"
}
```

### Roles del sistema

En `Authorization: Bearer <token>` **omitido** para endpoints públicos.

| Rol        | Descripción                                                     |
| ---------- | --------------------------------------------------------------- |
| `CLIENT`   | Usuario final; reserva paquetes, puntúa, guarda favoritos        |
| `BUSINESS` | Comercio/negocio; gestiona sucursales, paquetes y reservas       |
| `ADMIN`    | Administración de la plataforma y aprobación de negocios         |

---

## Autenticación y roles

### Registro

`POST /api/auth/register` crea **siempre** un usuario con rol `CLIENT`.

> **Seguridad**: el body **no** acepta un campo `role`. Forzar un rol desde el
> registro público permitiría escalar privilegios, así que se ignora por diseño.

```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "password": "secreto123",
  "phone": "+502 1234 5678"  // opcional
}
```

Respuesta `201`:

```json
{
  "success": true,
  "data": {
    "id": "ba7f1f9e-…",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "role": "CLIENT",
    "phone": "+502 1234 5678",
    "isActive": true,
    "createdAt": "2026-09-04T00:00:00.000Z",
    "updatedAt": "2026-09-04T00:00:00.000Z"
  }
}
```

Errores: `409` si el email ya está registrado, `400` si el body es inválido.

### Login

`POST /api/auth/login` devuelve el token JWT y el usuario:

```json
{
  "email": "juan@example.com",
  "password": "secreto123"
}
```

Respuesta:

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs…",
    "user": { "id": "…", "name": "Juan Pérez", "role": "CLIENT", "isActive": true }
  }
}
```

Errores: `401` si las credenciales no son válidas o el usuario está suspendido.

### ¿Cómo se crean los roles BUSINESS / ADMIN?

El registro público solo produce `CLIENT`. Para que un usuario sea `BUSINESS` o
`ADMIN`:

1. **ADMIN**: se crea manualmente en la base de datos (inserción SQL con el
   hash de la contraseña, o a través de Prisma Studio). Ejemplo:

   ```sql
   -- en postgres (hash = bcrypt de la contraseña elegida)
   INSERT INTO users (id, name, email, "passwordHash", role, "isActive", "createdAt", "updatedAt")
   VALUES (gen_random_uuid(), 'Admin Foodrescat', 'admin@foodrescat.local',
           '<hash bcrypt>', 'ADMIN', true, now(), now());
   ```

2. **BUSINESS**: se obtiene a través del flujo de aprobación de negocios
   (ver [Flujo completo del negocio](#flujo-completo-del-negocio)). El admin
   aprueba una solicitud y el usuario pasa de `CLIENT` a `BUSINESS`.

---

## Enumeraciones del dominio

### `PackageStatus`

| Valor        | Significado                                        |
| ------------ | -------------------------------------------------- |
| `AVAILABLE`  | Publicado y con stock disponible                   |
| `RESERVED`   | Tiene reservas pendientes                          |
| `PICKED_UP`  | Completado (el cliente lo recogió)                 |
| `EXPIRED`    | Venció el plazo de recogida (cron)                 |
| `CANCELLED`  | Cancelado por el negocio                           |

### `ReservationStatus`

| Valor        | Significado                                        |
| ------------ | -------------------------------------------------- |
| `PENDING`    | Reserva activa, esperando recogida                 |
| `COMPLETED`  | El negocio la marcó como completada                |
| `CANCELED`   | Cancelada                                          |
| `EXPIRED`    | Venció su `pickupDeadline` (cron)                  |

### `PaymentMethod`

`CASH` | `CARD` | `OTHER`

### `BusinessRequestStatus`

| Valor      | Significado                                        |
| ---------- | -------------------------------------------------- |
| `PENDING`  | Pendiente de revisión por un admin                 |
| `APPROVED` | Aprobada; el usuario fue promovido a `BUSINESS`    |
| `REJECTED` | Rechazada con `reason` (el usuario puede re-aplicar) |

---

## Endpoints por módulo

> Leyenda: (público) público · (auth) autenticado · (rol: nombre_del_rol) rol específico (mismo rol en
> `data.user.role`). `Bearer <token>` en el header `Authorization`.

### A) Autenticación — `/api/auth`

| Método | Ruta   | Acceso | Descripción                       | Respuesta |
| ------ | ------ | ------ | --------------------------------- | --------- |
| POST   | `register` | (público) | Registra un usuario `CLIENT`     | `201` |
| POST   | `login`     | (público) | Inicia sesión → `{ accessToken, user }` | `200` |
| GET    | `me`        | (auth) | Usuario actual autenticado        | `200` |

---

### B) Categorías — `/api/categories`

| Método | Ruta      | Acceso | Descripción                            | Respuesta |
| ------ | --------- | ------ | -------------------------------------- | --------- |
| GET    | `/`       | (público) | Lista todas las categorías (para selects del frontend) | `200` |
| POST   | `/`       | (rol: ADMIN) | Crea una categoría                    | `201` |
| PATCH  | `/:id`    | (rol: ADMIN) | Renombra una categoría                | `200` |
| DELETE | `/:id`    | (rol: ADMIN) | Elimina una categoría                 | `200` |

Body de creación/actualización:

```json
{ "name": "Panadería" }
```

---

### C) Solicitudes de negocio (Business Requests) — `/api/business-requests`

**Cliente — envía su solicitud** (`multipart/form-data`, rol `CLIENT`):

`POST /api/business-requests`

```json
// campos de formulario (no JSON):
{
  "businessName": "Panadería Doña Mela",   // obligatorio, máx 120
  "address": "3a Avenida 1-45, Zona 1, Guatemala", // obligatorio, máx 300
  "businessLicense": "<archivo>",           // obligatorio (PDF o imagen jpeg/png, máx 5 MB)
  "photo": "<archivo>"                      // opcional (imagen jpeg/png/webp)
}
```

- `201` → solicitud creada (estado `PENDING`).
- `409` → ya existe una solicitud `PENDING` del mismo usuario.
- `400` → falta la licencia, tipo de archivo no permitido o body inválido.
- `413` → archivo mayor al máximo permitido (5 MB).

| Método | Ruta | Acceso | Descripción | Respuesta |
| ------ | ---- | ------ | ----------- | --------- |
| POST   | `/`                    | (rol: CLIENT) | Crea la solicitud (multipart)  | `201` |
| GET    | `me`                   | (rol: CLIENT) | Devuelve la solicitud más reciente del usuario | `200` |

**Admin — gestiona las solicitudes:**

| Método | Ruta                        | Acceso  | Descripción                                          | Respuesta |
| ------ | --------------------------- | ------- | ---------------------------------------------------- | --------- |
| GET    | `/api/admin/business-requests` | (rol: ADMIN) | Lista/filtra solicitudes por `status` + paginación (`skip`, `take`) | `200` |
| PATCH  | `/api/admin/business-requests/:id/approve` | (rol: ADMIN) | Aprueba una `PENDING` y promueve al usuario a `BUSINESS` | `200` |
| PATCH  | `/api/admin/business-requests/:id/reject`  | (rol: ADMIN) | Rechaza con `reason` obligatorio (máx 500)           | `200` |

Body de rechazo:

```json
{ "reason": "La póliza de licencia no es legible." }
```

Errores comunes de approve/reject: `403` (no admin), `404` (no existe el id), `409` (ya no está `PENDING`).

Al aprobar se notifica al cliente con `BUSINESS_REQUEST_APPROVED`; al rechazar,
con `BUSINESS_REQUEST_REJECTED`.

---

### D) Sucursales — `/api/branches`

Todas las rutas requieren rol `BUSINESS`.

| Método | Ruta   | Descripción                                              | Respuesta |
| ------ | ------ | -------------------------------------------------------- | --------- |
| POST   | `/`    | Crea una sucursal del negocio autenticado                 | `201` |
| GET    | `/`    | Lista las sucursales del negocio autenticado              | `200` |
| GET    | `/:id` | Obtiene una sucursal propia (`403` si es de otro negocio, `404` si no existe) | `200` |
| PATCH  | `/:id` | Actualiza una sucursal propia                             | `200` |
| DELETE | `/:id` | Elimina una sucursal propia                               | `200` |

Body de creación (todos string; `name` y `address` obligatorios):

```json
{
  "name": "Sucursal Centro",
  "address": "123 Main Street",
  "city": "Guatemala",
  "phone": "+502 5555 5555",
  "openingHours": "Mon-Sat 08:00-18:00"
}
```

> **No se acepta `businessId` en el body**: el dueño se toma del token JWT.

**Ratings públicos de una sucursal** (sin autenticación):

`GET /api/branches/:id/ratings` → lista de valoraciones + promedio.

---

### E) Paquetes de comida — `/api/packages`

| Método | Ruta            | Acceso      | Descripción                                   | Respuesta |
| ------ | --------------- | ----------- | --------------------------------------------- | --------- |
| GET    | `/`             | (público) | Lista paquetes con filtros y paginación         | `200` |
| GET    | `/:id`          | (público) | Obtiene un paquete por id                       | `200` |
| POST   | `/`             | (rol: BUSINESS) | Publica un paquete de una sucursal propia        | `201` |
| PATCH  | `/:id`          | (rol: BUSINESS) | Actualiza un paquete propio                     | `200` |
| POST   | `/:id/reserve`  | (rol: CLIENT) | Reserva un paquete de forma atómica              | `201` |

**Listado público** — `GET /api/packages?...`:

| Query        | Tipo   | Descripción                                   | Default |
| ------------ | ------ | --------------------------------------------- | ------- |
| `city`       | string | Filtra por ciudad de la sucursal              | — |
| `categoryId` | uuid   | Filtra por categoría                          | — |
| `status`     | enum   | `PackageStatus` (p. ej. `AVAILABLE`)          | `AVAILABLE` |
| `skip`       | int ≥0 | Paginación: salta N registros                 | `0` |
| `take`       | int ≥1 | Paginación: trae N registros                  | `20` |

**Crear paquete** (BUSINESS):

```json
{
  "name": "Pan artesanal x10",
  "description": "Baguettes, croissants y sourdough",
  "originalPrice": 50.0,
  "discountedPrice": 25.0,
  "estimatedWeightKg": 2.5,
  "quantity": 3,
  "pickupDeadline": "2026-08-28T20:00:00.000Z",
  "branchId": "f47ac10b-…",
  "categoryId": "f47ac10b-…"
}
```

- `quantity` opcional (default `1`).
- Los precios usan 2 decimales máx; no se aceptan negativos.

**Reservar** — `POST /api/packages/:id/reserve` (CLIENT):

```json
{ "paymentMethod": "CASH" }
```

- `201` → crea la reserva (decrementa el stock atómico) y devuelve un
  `verificationCode` (p. ej. `RC-VVKS`).
- `409` → el paquete ya no tiene disponibilidad.
- El servidor crea automáticamente una notificación `RESERVATION_CONFIRMED`.

---

### F) Reservas — `/api/reservations` (rol `BUSINESS`)

| Método | Ruta            | Descripción                                          | Respuesta |
| ------ | --------------- | ---------------------------------------------------- | --------- |
| POST   | `verify`        | Verifica una reserva `PENDING` por `verificationCode` | `200` |
| PATCH  | `/:id/complete` | Completa la reserva → paquete `PICKED_UP`, notifica al cliente (`RESERVATION_COMPLETED`) | `200` |
| GET    | `pending`       | Lista las reservas `PENDING` del negocio              | `200` |

Body de `verify`:

```json
{ "verificationCode": "RC-VVKS" }
```

Errores: `403` si la reserva pertenece a otra sucursal del mismo owner que no
la maneja (ownership), `404` si no existe.

---

### G) Valoraciones — `/api/ratings`

| Método | Ruta | Acceso | Descripción                                               | Respuesta |
| ------ | ---- | ------ | --------------------------------------------------------- | --------- |
| POST   | `/`  | (rol: CLIENT) | Valora una reserva **completada** propia                  | `201` |
| GET    | `/api/branches/:id/ratings` | (público) | Ratings + promedio de una sucursal | `200` |

Body de `POST /api/ratings`:

```json
{
  "score": 5,
  "comment": "¡Excelente comida, volveré!",
  "reservationId": "f47ac10b-…"
}
```

Reglas:
- `score` entre `1` y `5` (int).
- `reservationId` debe ser una reserva `COMPLETED` del propio cliente.
- `409` si esa reserva ya fue valorada (una reserva = una valoración).
- `403` si se intenta valorar una reserva ajena.

---

### H) Favoritos — `/api/favorites` (rol `CLIENT`)

| Método | Ruta               | Descripción                             | Respuesta |
| ------ | ------------------ | --------------------------------------- | --------- |
| POST   | `/:branchId`       | Agrega una sucursal a favoritos         | `201` |
| DELETE | `/:branchId`       | Quita una sucursal de favoritos         | `200` |
| GET    | `/`                | Lista las sucursales favoritas          | `200` |

Errores: `404` sucursal inexistente · `409` ya está en favoritos.

---

### I) Notificaciones — `/api/notifications` (auth)

| Método | Ruta         | Descripción                                            | Respuesta |
| ------ | ------------ | ------------------------------------------------------ | --------- |
| GET    | `/`          | Lista notificaciones del usuario (recientes primero)   | `200` |
| PATCH  | `/:id/read`  | Marca como leída (solo las propias; `403` si es ajena) | `200` |

Tipos de notificación emitidas por el backend:

| Tipo                        | Cuándo                                             |
| --------------------------- | -------------------------------------------------- |
| `RESERVATION_CONFIRMED`     | El cliente reserva un paquete                      |
| `RESERVATION_COMPLETED`     | El negocio completa la reserva                     |
| `PACKAGE_EXPIRING`          | Cron: faltan < 30 min para la recogida             |
| `BUSINESS_REQUEST_APPROVED` | El admin aprueba la solicitud del dueño            |
| `BUSINESS_REQUEST_REJECTED` | El admin rechaza la solicitud con `reason`         |

---

### J) Administración — `/api/admin` (rol `ADMIN`)

| Método | Ruta               | Descripción                                      | Respuesta |
| ------ | ------------------ | ------------------------------------------------ | --------- |
| GET    | `users`            | Lista/filtra/ordena usuarios + paginación        | `200` |
| PATCH  | `users/:id`        | Suspende (`isActive:false`) o reactiva un usuario | `200` |
| GET    | `statistics`       | Estadísticas globales de la plataforma           | `200` |

**List users** — query params: `search` (nombre o email), `role`, `isActive`,
`skip`, `take`.

**Cambiar estado**:

```json
{ "isActive": false }
```

Errores: `403` si no eres ADMIN **o** intentas suspenderte a ti mismo/otro ADMIN;
`404` si el usuario no existe.

---

### K) Estadísticas por rol

| Método | Ruta                                | Acceso       | Descripción                                  |
| ------ | ----------------------------------- | ------------ | -------------------------------------------- |
| GET    | `/api/merchants/me/statistics/kpis` | (rol: BUSINESS)    | KPIs del negocio (dashboard)                 |
| GET    | `/api/customers/me/statistics`      | (rol: CLIENT)      | Estadísticas de impacto del cliente          |
| GET    | `/api/businesses/me/stats/today`    | (rol: BUSINESS)    | Estadísticas del día del negocio             |
| GET    | `/api/admin/statistics`             | (rol: ADMIN)       | Estadísticas globales de la plataforma       |

---

### L) Archivos subidos — `/api/static`

Archivos (licencias y fotos) se sirven de forma pública pero con **control de
directorio** para evitar path traversal:

- `GET /api/static/business-licenses/<archivo>`
- `GET /api/static/business-photos/<archivo>`

Las URLs de estos archivos son las que devuelve el backend en los campos
`businessLicenseUrl` y `photoUrl` de una solicitud de negocio.

---

## Flujo completo del negocio

Este es el recorrido que conecta **cliente → negocio → administración**:

1. **Registro**: `POST /api/auth/register` → usuario `CLIENT`.
2. **Login**: `POST /api/auth/login` → `accessToken`.
3. **Solicitud**: `POST /api/business-requests` (multipart: `businessName`,
   `address`, `businessLicense` obligatorio, `photo` opcional) → `PENDING`.
   - Solo puede existir una solicitud `PENDING` por usuario (duplicada → `409`).
4. **Consulta del cliente**: `GET /api/business-requests/me` → estado actual.
5. **Moderación del admin**:
   - `GET /api/admin/business-requests?status=PENDING` → lista para revisar.
   - Aprobar: `PATCH /api/admin/business-requests/:id/approve`
     → el usuario es promovido a `BUSINESS` y recibe la notificación aprobatoria.
   - Rechazar: `PATCH /api/admin/business-requests/:id/reject` con `reason`
     → el cliente puede corregir y volver a aplicar (nuevo `201`).
6. **Ya como `BUSINESS`**, el frontend debe **re-loguear** (el JWT anterior no
   incluye el nuevo rol): `POST /api/auth/login` → el `user.role` ahora es
   `BUSINESS`.
7. **Operación del negocio**: crear sucursales (`POST /api/branches`), publicar
   paquetes (`POST /api/packages`) y gestionar reservas (`POST /api/reservations/verify`,
   `PATCH /api/reservations/:id/complete`).
8. **Circuito del cliente**: explorar (`GET /api/packages?...`), reservar
   (`POST /api/packages/:id/reserve`), y al completarse valorar
   (`POST /api/ratings`). Todo esto queda reflejado en notificaciones y stats.

---

## Configuración del frontend

### Interceptor de respuestas

Todas las respuestas van envueltas. En el frontend conviene un helper así:

```ts
// Ejemplo (Angular)
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}
```

### Manejo de errores

El frontend puede confiar en `error.statusCode` / `error.status` de HTTP para
decidir:

| Código | Situación típica                                                     |
| ------ | -------------------------------------------------------------------- |
| `400`  | Body inválido (validación `class-validator`)                        |
| `401`  | Token ausente, inválido o expirado → redirigir a login              |
| `403`  | Rol insuficiente **o** recurso ajeno. **Contrato**: el recurso existe pero no es tuyo → `403`; el recurso no existe → `404` |
| `404`  | Recurso inexistente                                                  |
| `409`  | Conflicto de negocio: duplicado, solicitud ya revisada, sin stock…   |
| `413`  | Archivo demasiado grande (multer)                                   |
| `422`/`500` | Error no manejado (revisar logs)                                  |

### CORS

El backend acepta orígenes configurados en `CORS_ORIGIN` (separados por coma).
Por defecto permite `http://localhost:4200` (Angular por CLI).

### Swagger

La especificación interactiva está en `http://localhost:3000/api/docs`.
Desde ahí puedes probar cada endpoint con el botón **Authorize** (pega el
`accessToken`).

---

## Notas

- Los usuarios `ADMIN` no se crean por la API (el registro solo genera `CLIENT`);
  se insertan directamente en la BD (ver [Autenticación y roles](#autenticación-y-roles)).
- El backend no incluye archivos de pruebas en producción: el repositorio de
  despliegue es la versión limpia (sin `test/`, sin `*.spec.ts`, sin `seed.ts`).
- El cron de expiración marca como `EXPIRED` los paquetes/reservas cuya
  `pickupDeadline` ya pasó y notifica a los clientes con reservas por vencer
  (`PACKAGE_EXPIRING`).

-Primer deploy-