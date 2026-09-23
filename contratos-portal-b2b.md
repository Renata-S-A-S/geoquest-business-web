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

| Verbo   | Path                 | Body                                                               | Response                      | Fuente                                                                |
| ------- | -------------------- | ------------------------------------------------------------------ | ----------------------------- | --------------------------------------------------------------------- |
| `GET`   | `/business/me`       | —                                                                  | `Business`                    | Resuelve el negocio del `BusinessStaff` autenticado                   |
| `PATCH` | `/business/me`       | subconjunto editable (`displayName`, `email`, `category`)          | `Business`                    | B-01 (edición post-registro, no cubierto por el flujo pero implícito) |
| `POST`  | `/business/register` | datos legales + documento (ver §3, pregunta de subida de archivos) | `Business` (status `Pending`) | B-01                                                                  |

`Business.status` — **solo `Suspended` está citado literalmente** en Confluence (RN-BIZ-04). `Pending`/`Active` son propuesta del frontend a partir del SLA de 48h de verificación (B-01, RN-BIZ-01) — confirmar los nombres exactos.

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

`checkInRadiusMeters`: 50–1000, default 100 (B-02, confirmado). `photos`: 1–5 (B-02, confirmado).

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
- Los mocks (`src/shared/mocks/handlers.ts`) implementan un subconjunto de estos endpoints (`GET/POST /places`, `GET /business/me`, `GET /rewards`) contra `localStorage`, sirviendo exactamente estos shapes — sirve como spec ejecutable, no solo este documento en prosa.
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
