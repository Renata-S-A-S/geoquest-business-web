# Contratos propuestos — Portal B2B → Backend `Business`

**De:** Jose David (frontend, `geoquest-business-web`) · **Para:** Derek (backend, `geoquest`, slice `004-business-rewards`)
**Estado:** Revisado por Derek el 31 ago 2026 ([comentario en PR #8](https://github.com/Renata-S-A-S/geoquest-business-web/pull/8)) — correcciones aplicadas más abajo. El módulo `Business` ya existe y está implementado (Work Units A-G del slice `004-business-rewards`, mergeados 29-31 ago 2026); este documento deja de ser una propuesta pura y pasa a documentar qué del contrato original se confirmó, qué cambió, y qué sigue sin resolver.

Fuente: el ERD de Confluence (`🗺️ Modelo de Datos`) da las **entidades**; los flujos B-01 a B-05 (`🏢 Flujos del Negocio`) dan los **flujos**. Ninguno de los dos da **endpoints** — eso es lo que este documento propone.

Los schemas Zod ejecutables (fuente de verdad del shape, más completos que las tablas de abajo) viven en `src/shared/schemas/` del repo: `business.ts`, `place.ts`, `reward.ts`, `user-reward.ts`, `commission.ts`, `subscription.ts`, `problem-details.ts`.

---

## 1. Convención general

- Errores en formato `problem+json` (RFC7807), igual que el resto del backend: `{ title, detail?, status }`.
- Todos los endpoints requieren sesión de `BusinessStaff` autenticado (mismo `Identity` que `Explorer`, claim de rol distinto — ver §4.1) salvo que se indique lo contrario.
- IDs: UUID. Fechas: ISO 8601 UTC (`datetime`), coherente con ADR-023.
- Las relaciones cruzadas entre módulos son **soft references** (Guid sin FK de BD) — el contrato no debe asumir joins ni datos embebidos que el backend no vaya a poder resolver barato (ver nota del ERD).

## 2. Endpoints propuestos

### 2.1 Business

| Verbo   | Path                 | Body                                                               | Response                                  | Fuente                                                                |
| ------- | -------------------- | ------------------------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------- |
| `GET`   | `/business/me`       | —                                                                  | `Business`                                | Resuelve el negocio del `BusinessStaff` autenticado                   |
| `PATCH` | `/business/me`       | subconjunto editable — ver detalle en §2.1.1                       | `Business`                                | B-01 (edición post-registro, no cubierto por el flujo pero implícito) |
| `POST`  | `/business/register` | datos legales + documento (ver §3, pregunta de subida de archivos) | `Business` (status `Pending`)             | B-01                                                                  |
| `GET`   | `/business-staff/me` | —                                                                  | `BusinessStaffMe` — ver detalle en §2.1.2 | Identidad del `BusinessStaff` autenticado (#72, PR4)                  |

`Business.status` — **solo `Suspended` está citado literalmente** en Confluence (RN-BIZ-04). `Pending`/`Active` son propuesta del frontend a partir del SLA de 48h de verificación (B-01, RN-BIZ-01) — confirmar los nombres exactos.

#### 2.1.1 Detalle — `PATCH /business/me`

Propuesta del frontend (ADR-048-BF: contratos definidos por el frontend, validados por el backend), pendiente de confirmación por el backend — sin cita de Confluence propia, porque no hay ningún flujo B-0X que cubra la edición del perfil (B-01 solo cubre el registro inicial). Preguntas abiertas registradas en [`Renata-S-A-S/geoquest#182`](https://github.com/Renata-S-A-S/geoquest/issues/182).

```
PATCH /business/me
Auth:    BusinessStaff bearer, mismo sesión que el resto de §1.
         Requiere rol Owner (403 en caso contrario) — el gate de rol
         llega con GET /business-staff/me (#72, PR siguiente); este mock
         todavía no lo aplica, ver nota de implementación más abajo.
Type:    application/json

Body — todas las claves opcionales; una clave omitida significa "no
        tocar"; un body vacío es 400.
  displayName  string, 1..120
  category     string, 1..caracteres       ← taxonomía sin confirmar,
                                              ver business-category-options.ts
  email        string, formato email        ← el CONTACTO PÚBLICO del
                                              negocio (ej. contacto@cafe70.co),
                                              NO la credencial de acceso del
                                              BusinessStaff que inicia sesión
                                              (esa vive en Identity, es un
                                              campo distinto y no tiene
                                              endpoint de edición propuesto
                                              acá — confundirlas sería un bug
                                              de seguridad, no una decisión
                                              de alcance)

200 → Business (el agregado completo, misma forma que GET /business/me)
      Se devuelve el agregado completo en vez de un eco del patch para que
      quien llama pueda reemplazar su caché con la verdad del servidor
      (`setQueryData`) en vez de adivinar el resultado del merge.

Errores (problem+json, RFC7807: { title, detail?, status })
  400 ValidationFailed  el body no cumple el shape/longitud, o está vacío
  403 Forbidden         el BusinessStaff autenticado no es el Owner
                         (documentado acá; la verificación de rol llega en
                         la PR que agrega GET /business-staff/me — este mock
                         no la aplica todavía)
  404 BusinessNotFound  la sesión no resuelve a ningún negocio
                         (documentado acá; el mock es single-tenant — siempre
                         hay un `db.business` — así que este caso no es
                         reproducible con el mock actual)
  409 ReadOnlyField      el request intentó modificar un campo congelado por
                         verificación (`legalName`, `legalDocumentType`,
                         `legalDocumentNumber` — RN-BIZ-01) o un campo que
                         solo escribe el servidor (`status`, `trustScore`,
                         `trustStatus`, `totalRedemptions`, `totalReports`,
                         `isPlatformOwned`, `commercialAgreementSignedAt`,
                         `createdAt`, `id`) — ver
                         `BUSINESS_READONLY_FIELDS` en business.ts
```

**Por qué 409 y no ignorar el campo en silencio:** RN-BIZ-01 verifica el negocio contra su documento legal. Un backend que descarta en silencio un intento de cambiar `legalName` deja al cliente creyendo que el cambio se aplicó — la misma razón por la que esos campos son de solo lectura en primer lugar. El mock de este repo implementa y testea este rechazo para `legalName`/`legalDocumentNumber` (ver `handlers.test.ts`).

**`Business.email` sí queda en el subconjunto editable** (a diferencia de una versión anterior de este documento, que lo excluía como pregunta abierta) — confirmado por el Product Owner: el contacto público del negocio es editable, la credencial de login del `BusinessStaff` no. `description` **no** forma parte de este PATCH — no existe en `businessSchema`, en este contrato ni en el ERD; si debería existir es una pregunta abierta, ver `Renata-S-A-S/geoquest#182`.

⚠️ **Formato del `title` de error — sin confirmar.** El mock de este repo emite títulos sin punto, PascalCase (`ValidationFailed`, `ReadOnlyField` — mismo estilo que `InvalidCredentials` en `POST /auth/login`), por consistencia interna con el resto de `handlers.ts`. El backend real del Explorer (`geoquest-web`) usa códigos con punto (`Validation.Failed`). Como el backend de `Business` para este endpoint todavía no existe, se prioriza la consistencia interna — `Renata-S-A-S/geoquest#182` pide unificar el criterio antes de implementar contra un backend real.

**Ruteo al backend:** el PO pidió sumar este contrato a `Renata-S-A-S/geoquest#164` — ese issue documenta la subida de archivos de ADR-048 (§4.4), no edición de perfil. Sin confirmar si corresponde ahí o en un issue propio — no se abre ninguno desde este documento.

#### 2.1.2 Detalle — `GET /business-staff/me`

Propuesta del frontend (ADR-048-BF), sin confirmar contra el backend — sin cita de Confluence propia, mismo motivo que §2.1.1 (no hay flujo B-0X que cubra la identidad del staff). Resuelve la identidad del `BusinessStaff` autenticado: es la fuente tanto del gate de edición Owner-only (`canEditBusinessProfile`, decisión D4 del diseño de #72) como del bloque de usuario de `/configuracion` (PR6).

```
GET /business-staff/me
Auth: BusinessStaff bearer, misma sesión que el resto de §1.

200 → {
  id, businessId, fullName, username, email, role, status, createdAt
}
      role ∈ Owner | Manager | Staff — mismo enum que el backend ya
      define en BusinessStaffRole.cs (Owner = 0, Manager = 1, Staff = 2,
      PascalCase). Ver businessStaffRoleSchema.

404 BusinessStaffNotFound  la Identity autenticada no tiene una fila
                           BusinessStaff asociada (documentado acá; el
                           mock es single-tenant — siempre hay un
                           `db.businessStaff` — así que este caso no es
                           reproducible con el mock actual)
```

**`role`** reutiliza el mismo enum que `businessStaffSchema.role` — ya no es `z.string()` (ver corrección de casing más abajo). Hoy `role` es siempre `Owner`: el registro (BA-1) crea exactamente un `BusinessStaff` Owner y ningún comando asigna Manager/Staff todavía (gestión de staff adicional, fuera de alcance de #72).

⚠️ **`username` — sin confirmar.** `username` NO es un campo de `BusinessStaff` — vive en el mismo `Identity` que usa el Explorer, enlazado vía `BusinessStaff.ExplorerId` (§4.1). Si esa proyección es alcanzable para una cuenta que es SOLO `BusinessStaff` (sin `ExplorerProfile`) es la pregunta abierta de `Renata-S-A-S/geoquest#182`. Se propone incluirlo acá (y se semilla un valor en el mock, `SEED_BUSINESS_STAFF_USERNAME`) porque es la única forma de que `/configuracion` funcione de punta a punta bajo `VITE_USE_MOCKS=true` mientras se confirma — si la respuesta es negativa, la consecuencia queda confinada a un campo menos en PR6, no a un rediseño de este contrato.

⚠️ **Casing de `role` corregido en este PR.** El mock previo a #72-PR4 seedeaba `role: 'owner'` en minúscula; el backend usa PascalCase (`BusinessStaffRole.cs`). Con `role` como `z.string()`, ese desfase no producía ningún error de tipo — recién con `businessStaffRoleSchema` (`z.enum(['Owner', 'Manager', 'Staff'])`) se vuelve un error de validación detectable. Corregido en `seed.ts`; verificado que ningún otro archivo del repo comparaba contra el valor en minúscula.

### 2.2 Place (B2B)

| Verbo   | Path                   | Body                            | Response                                                     | Fuente                            |
| ------- | ---------------------- | ------------------------------- | ------------------------------------------------------------ | --------------------------------- |
| `GET`   | `/business/me/places`  | —                               | `Place[]`                                                    | B-02                              |
| `POST`  | `/business/me/places`  | `CreatePlaceInput` (ver schema) | `Place` (status `Draft`, `placeType: BusinessVenue` forzado) | B-02                              |
| `PATCH` | `/places/{id}`         | subconjunto editable            | `Place`                                                      | B-02                              |
| `POST`  | `/places/{id}/publish` | —                               | `Place` (status `Active`)                                    | B-02, paso "publica directamente" |

⚠️ **Desfase confirmado con el flujo B-02 de Confluence:** el paso 6 todavía dice _"Define el `pointsReward` que otorgará el lugar (mínimo 50 puntos — se acreditan por igual a XP y GeoPoints)"_. Eso **ya no es cierto** — ADR-041 y ADR-043 (28 ago 2026) lo reemplazaron:

- `Place.pointsReward` no existe más. Se partió en `xpReward` + `geoPointsReward`.
- Un `Place` creado desde el portal es siempre `placeType: BusinessVenue`.
- Un `BusinessVenue` otorga **0 XP** siempre (RN-GAM-03) y **GeoPoints fijados por la plataforma**, no por el negocio: 25% del baseline de 50 = **12 GeoPoints** (RN-GAM-10, confirmado literal en Confluence).
- El negocio **no configura sus GeoPoints** — el racional (RN-GAM-10) es evitar que compita subiendo el número, ya que esos puntos son canjeables en toda la red.
- El formulario de B-02 debe **eliminar** el campo de puntos por completo, no solo cambiar su default.

`checkInRadiusMeters`: 50–1000, default 100 (B-02, confirmado). `photos`: máximo 5 (ADR-048, la 6ta la rechaza el endpoint). **Corrección (#29):** el mínimo de 1 se valida al PUBLICAR (`POST /places/{id}/publish`), no al crear ni al leer — un `Place` en `Draft` existe legítimamente sin fotos mientras la subida de archivos (#31) sigue bloqueada por BL-014. `createPlaceInputSchema` (§2.2, tabla) ya no exige `photos` en el `POST`.

### 2.3 Reward

| Verbo   | Path                    | Body                 | Response                   | Fuente |
| ------- | ----------------------- | -------------------- | -------------------------- | ------ |
| `GET`   | `/business/me/rewards`  | —                    | `Reward[]`                 | B-03   |
| `POST`  | `/business/me/rewards`  | `CreateRewardInput`  | `Reward` (status `Draft`)  | B-03   |
| `PATCH` | `/rewards/{id}`         | subconjunto editable | `Reward`                   | B-03   |
| `POST`  | `/rewards/{id}/publish` | —                    | `Reward` (status `Active`) | B-03   |

`type`: `Discount \| FreeProduct \| Experience \| Upgrade` — **citados literalmente** en B-03 paso 2 ("Descuento / Producto Gratis / Experiencia / Upgrade"), traducidos a PascalCase inglés por convención del resto del backend — **confirmar los nombres exactos, no la existencia de los 4 valores**.

`rewardCategory`: `General \| Special` — **citados literalmente** (RN-REW-03/03B). Una `Special` requiere `linkedTouristPlaceId` + `linkedPlaceWindowDays` (regla de negocio, no solo de UI — el schema del frontend ya la valida con un `.refine()`, pero el backend debe hacerla cumplir también).

`status`: `Exhausted` confirmado literal (RN-REW-05, cuando `stockRedeemed === stock`). `Paused` confirmado literal (RN-BIZ-04, cascada de negocio suspendido). `Draft`/`Active` propuestos.

### 2.4 UserReward — validar canje (B-04)

| Verbo  | Path                                  | Body                                    | Response                                                                                                                            | Fuente         |
| ------ | ------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `GET`  | `/user-rewards/by-qr-token/{qrToken}` | —                                       | `UserReward` (con datos del explorador embebidos: nombre, foto — shape exacto sin definir, detalle de implementación no bloqueante) | B-04 pasos 2–3 |
| `POST` | `/user-rewards/{id}/redeem`           | `RedeemUserRewardInput` (`{ qrToken }`) | `UserReward` (status `Redeemed`)                                                                                                    | B-04 paso 4    |

RN-REW-04: el QR es válido 30 min desde su generación, un solo uso, token firmado server-side — **el portal nunca genera el token, solo lo valida**. RN-REW-06: solo `BusinessStaff` del negocio dueño de la `Reward` puede validar — el backend debe rechazar si `businessId` no coincide, no confiar en que el frontend no lo intente.

`origin: Purchased | Granted` (ADR-045, RN-REW-10) determina si el canje descuenta `geoPointsCost` — **el portal debe mostrar esta distinción en B-04**, no solo el monto, para que el staff entienda por qué una `UserReward` "otorgada" no resta saldo.

### 2.5 Commission — se expone en el portal, confirmado por Derek

| Verbo | Path                       | Body | Response       | Fuente                  |
| ----- | -------------------------- | ---- | -------------- | ----------------------- |
| `GET` | `/business/me/commissions` | —    | `Commission[]` | RN-BIZ-06, nota del ERD |

⚠️ **`src/shared/schemas/commission.ts` y `subscription.ts` (ya en `main`) quedaron con el modelo viejo** — comisión variable por plan (`commissionRate: number`, tramos 5–10%) y `Subscription.businessId`, ambos obsoletos desde ADR-046 (28 ago 2026). El modelo real, confirmado en [🏢 RN-BIZ — Negocios](https://renatageoquest.atlassian.net/wiki/spaces/CDP/pages/1277955):

- **Comisión fija del 10%** sobre `Reward.estimatedValueCop`, sin tramos ni planes (RN-BIZ-06 reescrita). Se genera solo al pasar a `Redeemed`.
- **`Subscription` ya no debería tener `businessId`** — no hay planes de negocio, RN-BIZ-05 fue **eliminada** por ADR-046. Habría que revisar si `Subscription` como entidad sigue teniendo sentido del lado negocio en absoluto, o si queda acotada a exploradores (Premium, ver ADR-047 sin sufijo).
- Toggle de cobro real (`PlatformCommissionSetting.IsEnabled`) ya implementado en el backend, solo un Admin lo cambia, nunca retroactivo.
- `Reward.estimatedValueCop` pasa a derivarse de un menú con precios visible al explorador (RN-BIZ-08), no un campo libre — agrega `Reward.menuItemId` (nullable) al modelo, todavía no reflejado en `reward.ts` del frontend. Construcción real diferida a la prueba piloto, no al slice 004.

**Pendiente, sin abrir todavía:** un PR que alinee `commission.ts`/`subscription.ts`/`reward.ts` con este modelo — no incluido en este documento a propósito, para no mezclar la corrección de contrato con la implementación del fix.

### 2.6 Analytics (B-05)

No hay entidad `Analytics` en el ERD — B-05 describe métricas agregadas (visitantes, canjes del mes, TrustScore, comparativa semanal), probablemente calculadas por el backend a partir de `CheckIn`, `UserReward` y `Business.trustScore`, no una tabla propia. **Sin propuesta de shape todavía** — recomiendo que este endpoint se diseñe recién cuando B-05 entre en alcance de un slice real, no ahora; listarlo acá es solo para que quede registrado como pendiente.

---

## 3. Reglas de negocio que el backend debe hacer cumplir

No solo validar el shape — estas son invariantes de negocio, citadas con su fuente:

- **RN-BIZ-01/02**: verificación por documento legal + cruce Google Maps, SLA 48h.
- **RN-BIZ-03**: ningún negocio publica `Reward` sin haber firmado el Acuerdo Comercial (checkbox + timestamp).
- **RN-BIZ-04**: cascada de desactivación — negocio `Suspended` ⇒ sus `Place` pasan a `Paused`, sus `Reward` activas pasan a `Paused`. Las `UserReward` ya `Earned` sobreviven y pueden canjearse si el negocio vuelve a `Active`.
- ~~**RN-BIZ-05**: límites de plan (Places/Rewards activos máx.)~~ — **eliminada por ADR-046** (28 ago 2026). No hay planes de negocio, no hay límites derivados de plan. Si hiciera falta un tope, sería operativo (antiabuso), nunca por suscripción.
- **RN-BIZ-06** (reescrita — ADR-046): comisión **fija del 10%** sobre `estimatedValueCop`, sin tramos por plan — `status = Waived` durante el piloto (ADR-016), con toggle admin-only ya implementado para activar el cobro real.
- **RN-GAM-03/10**: `xpReward`/`geoPointsReward` de un `BusinessVenue` los fija la plataforma, nunca el input del negocio — rechazar cualquier intento del frontend de setearlos directamente.
- **RN-REW-04**: QR de 30 min, un solo uso, firmado server-side.
- **RN-REW-05**: `stockRedeemed === stock` ⇒ `Exhausted` automático, sin nuevas `UserReward`.
- **RN-REW-06**: solo `BusinessStaff` del negocio dueño valida el canje.
- **RN-REW-08**: `trustScore` = promedio ponderado de `experienceRating`, ventana de 90 días; umbrales → `trustStatus` (Premium ≥4.5, Active 3.5–4.4, UnderReview 2.5–3.4, Suspended <2.5).
- **RN-REW-10 / ADR-045**: `UserReward.origin === 'Granted'` no descuenta `geoPointsCost` al canjear.

---

## 4. Preguntas abiertas

### Resueltas (revisión de Derek, 31 ago 2026 · ADR-048, 2 sep 2026)

1. ✅ **Autenticación de `BusinessStaff`** — mismo `Identity` que `Explorer`, con claim de rol distinto, misma cuenta (`ApplicationUser : IdentityUser<Guid>`, `BusinessStaff.ExplorerId` enlaza a la cuenta, `RoleManager` ya cableado). **No hace falta un mecanismo de auth separado** — el `SessionPort` del frontend (`src/shared/lib/session-port.ts`) ya es la abstracción correcta; cuando se implemente la sesión real, es una sola clase nueva, nada más del código se entera.
2. ✅ **`Commission` sí se expone al portal** durante el MVP, aunque muestre `status = Waived` (comisión registrada pero no cobrada) durante el piloto — ver §2.5 y §3 para el modelo real (10% fijo, no por plan).
3. ✅ ~~**Límites de plan configurables**~~ — **pregunta anulada**, no solo respondida: RN-BIZ-05 fue eliminada (ADR-046), no existen planes de negocio ni límites derivados de plan. No hace falta ningún endpoint de config para esto.
4. ✅ **Subida de archivos** (documento legal NIT/RUT/RFC, video de 30s de verificación, logo, fotos de `Place`, imagen de `Reward`) — resuelta el 2 sep 2026 por [**ADR-048**](https://renatageoquest.atlassian.net/wiki/spaces/CDP/pages/13238273). La dicotomía original era falsa: **Azure Blob nunca fue el stack**. El almacenamiento es **Cloudflare R2** (S3-compatible, vía `AmazonS3Client`; MinIO en local y en Testcontainers), y el patrón es **mediado por el backend** — un endpoint que recibe `multipart/form-data`, **no** un PUT directo desde el cliente con SAS/presigned URL.
   - **Buckets**: `geoquest-business-documents` (privado, se sirve con presigned URL con expiración — documento legal y video de verificación) y `geoquest-business-assets` (público — logo, fotos de `Place`, imagen de `Reward`).
   - **Límites**: documento legal PDF/JPG/PNG 5 MB · logo JPG/PNG/WebP 2 MB · foto de `Place` e imagen de `Reward` JPG/PNG/WebP 5 MB · video de verificación MP4/WebM 50 MB, con **MOV excluido explícitamente** y los 30s **no validados server-side**. Ya reflejados client-side en `src/shared/lib/upload-limits.ts`.
   - **Implementación**: se sigue en [`Renata-S-A-S/geoquest#164`](https://github.com/Renata-S-A-S/geoquest/issues/164). Hasta que aterrice, **BL-014** (Derek, 2 sep 2026) bloquea #22/#26/#31 — no se cierran contra el `Uploader` mock como si fuera la implementación final.
   - **Alcance**: ADR-048 no enumera el menú con precios de RN-BIZ-08, que la pregunta original incluía — su construcción real está diferida a la prueba piloto (ver §2.5), así que no bloquea el slice 004.
   - ⚠️ **Colisión de numeración**: hay **dos** ADR distintos con el número 048. Este es **ADR-048** sin sufijo (subida de archivos). **ADR-048-BF** es otra decisión —contratos definidos por el frontend, validados por el backend— y no dice nada sobre archivos.

### Genuinamente sin resolver — no es un error del documento, falta documentarse en Confluence antes de implementar (nota de Derek)

5. **Shape de `coordinates` en `Place`**: el ERD dice `json coordinates` sin más detalle. El frontend propuso `{ lat: number, lng: number }` — sin definición registrada de si es eso, GeoJSON `Point`, o `{ latitude, longitude }`.
6. **`Commission.billingPeriod`**: sin convención registrada — ¿facturación mes vencido, semana ISO, o rango de fechas? (RN-BIZ-06 confirma que la facturación es "mensual consolidada" vía sweep, pero no el shape exacto del campo).

---

## 5. Cómo consume el frontend estos contratos hoy (mock-first)

- Todos los schemas están en `src/shared/schemas/*.ts` (Zod), con comentario de fuente por campo — cada uno distingue explícitamente valores **confirmados** (citados literalmente en Confluence) de valores **propuestos** (inferidos, a validar acá).
- Los mocks (`src/shared/mocks/handlers.ts`) implementan un subconjunto de estos endpoints (`GET/POST /business/me/places`, `GET /business/me`, `PATCH /business/me`, `GET /business-staff/me`, `GET /rewards`) contra `localStorage`, sirviendo exactamente estos shapes — sirve como spec ejecutable, no solo este documento en prosa. ⚠️ `GET /rewards` mantiene el mismo desfase de path que tenía `/places` antes de esta corrección (la tabla de §2.3 dice `/business/me/rewards`) — queda fuera de alcance de esta corrección, corresponde a #36.
- `VITE_USE_MOCKS=true` es el default. Cuando el backend real tenga aunque sea un endpoint, se apaga por env var y `apiClient` (`src/shared/lib/api-client.ts`) empieza a pegarle a `VITE_API_BASE_URL` sin cambiar una línea del resto de la app.
- Auth: `src/shared/lib/session-port.ts` + `session-interceptor.ts` — el cliente Axios adjunta el bearer token y reintenta tras 401 contra un `SessionPort` inyectable, nunca contra un endpoint concreto. La implementación mock hoy vive en `session-port.mock.ts`; el día que exista el mecanismo real, se agrega una implementación nueva y se cambia una sola línea en `session-port.instance.ts`.

---

## 6. Cómo revisar esto

No hace falta leer todo el repo. Con estos 4 archivos alcanza para validar o corregir el contrato:

1. `src/shared/schemas/place.ts` — el más importante, tiene el desfase de ADR-041/043 corregido y testeado.
2. `src/shared/schemas/reward.ts` y `user-reward.ts`.
3. Este documento (`contratos-portal-b2b.md`), especialmente §4.
4. `src/shared/mocks/handlers.ts` si querés ver el contrato "vivo" corriendo.

Dejá comentarios en el PR o en el Issue [#1](https://github.com/Renata-S-A-S/geoquest-business-web/issues/1) — cualquier corrección se refleja primero acá y en los schemas, no en el backend directamente, para que quede trazable.
