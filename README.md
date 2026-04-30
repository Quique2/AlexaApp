# Rrëy Cervecería — App de Inventario JIT

App multiplataforma (iOS, Android, Web) para gestionar el inventario JIT de la cervecería Rrëy.

## Estructura del proyecto

```
rrey-app/
├── api/          # Backend Express + TypeScript + Prisma + PostgreSQL
└── app/          # Frontend Expo + React Native + TypeScript
```

---

## 🚀 Inicio rápido (local)

### Requisitos previos
- Node.js 18+
- Docker Desktop (para PostgreSQL local)
- Expo CLI: `npm install -g expo-cli`
- EAS CLI (opcional, para build nativo): `npm install -g eas-cli`

### 1. Clonar e instalar

```bash
git clone <repo-url>
cd rrey-app
npm install          # instala dependencias de api/ y app/
```

### 2. Levantar la base de datos

```bash
docker-compose up -d
```

Esto crea un PostgreSQL en `localhost:5432` con:
- DB: `rrey_db`
- Usuario: `rrey`
- Password: `rrey_secret`

### 3. Configurar el backend

```bash
cd api
cp .env.example .env
# El .env ya viene configurado para Docker local
```

### 4. Inicializar la base de datos

```bash
# Desde la raíz del proyecto:
npm run db:push     # crea las tablas
npm run db:seed     # carga los 152 materiales + 5 proveedores + planes de prueba
```

### 5. (Opcional) Importar datos reales del Excel

```bash
npm run import:excel
# Lee Inventario_Rrey_v4.xlsx desde la raíz del repo
```

### 6. Arrancar la API

```bash
npm run api
# → API disponible en http://localhost:3000
# → Health: http://localhost:3000/health
```

### 7. Arrancar la app Expo

```bash
cd app
# Configura la URL de la API para desarrollo:
# Edita app/services/api.ts o crea .env con EXPO_PUBLIC_API_URL=http://localhost:3000/api

npm start
# → Abre en navegador (web), escanea QR para iOS/Android con Expo Go
```

---

## 📡 API Endpoints

Base URL: `http://localhost:3000/api` (local) o tu URL de Railway en producción.

### Dashboard
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/dashboard/summary` | KPIs: alertas JIT, producción próxima, gasto mensual |
| GET | `/dashboard/spend` | Historial de gasto mensual |

### Inventario
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/inventory` | Lista completa (`?alert=RED&type=MALTA&search=citra`) |
| GET | `/inventory/alerts` | Solo materiales RED y YELLOW |
| GET | `/inventory/:materialId` | Detalle de un material |
| PUT | `/inventory/:materialId` | Actualizar stock, consumo, notas (recalcula alerta JIT) |

### Materiales
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/materials` | Catálogo (`?type=LUPULO&search=mosaic`) |
| GET | `/materials/:id` | Detalle con historial de pedidos |
| POST | `/materials` | Crear material nuevo |
| PUT | `/materials/:id` | Editar material |
| DELETE | `/materials/:id` | Eliminar material |

### Plan de Producción
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/production` | Todos los planes (`?from=2026-05-01&to=2026-05-31`) |
| GET | `/production/upcoming` | Próximos 7 días |
| POST | `/production` | Crear nuevo lote |
| PUT | `/production/:id` | Editar lote |
| DELETE | `/production/:id` | Eliminar lote |

### Pedidos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/orders` | Lista (`?status=PENDING`) |
| GET | `/orders/summary/monthly` | Resumen de gasto por mes |
| POST | `/orders` | Crear pedido |
| PUT | `/orders/:id` | Actualizar estado, datos |
| DELETE | `/orders/:id` | Eliminar pedido |

### Recepciones
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/receptions` | Lista (`?orderId=...`) |
| POST | `/receptions` | Registrar recepción (actualiza stock automáticamente) |

### Proveedores
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/suppliers` | Lista de proveedores |
| GET | `/suppliers/:id` | Detalle con materiales |
| PUT | `/suppliers/:id` | Editar proveedor |

### Configuración JIT
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/config` | Parámetros JIT actuales |
| PUT | `/config` | Actualizar parámetros JIT |

---

## 🚂 Deploy en Railway

### 1. Crear proyecto en Railway

1. Ve a [railway.app](https://railway.app) y crea un proyecto nuevo.
2. Agrega un servicio **PostgreSQL** (clic en "+ New" → "Database" → "PostgreSQL").
3. Copia la variable `DATABASE_URL` que Railway genera automáticamente.

### 2. Deploy del backend

```bash
# Desde la raíz del repo:
railway login
railway link        # vincula con tu proyecto Railway

# Deploy solo el directorio api/
railway up --service rrey-api --directory api
```

O conecta el repositorio en el dashboard de Railway:
- Source: GitHub repo
- Root directory: `api/`
- El archivo `api/railway.toml` configura el build y start automáticamente.

### 3. Variables de entorno en Railway

En el panel de Railway → Variables, agrega:
```
DATABASE_URL=<auto-provided by Railway PostgreSQL>
PORT=3000
CORS_ORIGIN=https://tu-app.expo.dev,http://localhost:8081
```

### 4. URL de la API

Railway te da una URL pública tipo `https://rrey-api-production.up.railway.app`.

Actualiza la app con esta URL:
```typescript
// app/services/api.ts o variable de entorno
EXPO_PUBLIC_API_URL=https://rrey-api-production.up.railway.app/api
```

---

## 🎨 Diseño y UI

### Identidad visual
- **Logo**: Tipografía serif negra "Rrëy" — premium, editorial, artesanal.
- **Paleta**: Fondo negro `#0C0C0C`, dorado `#C9A84C`, crema `#F2EBD9`.
- **Tema**: Oscuro por defecto, minimalista, sin decoraciones innecesarias.

### Sistema de alertas JIT
| Color | Estado | Acción |
|-------|--------|--------|
| 🔴 Rojo | Stock crítico o = 0 días de cobertura vs. tiempo de entrega | Pedir HOY |
| 🟡 Amarillo | Cobertura < punto de reorden | Planear pedido |
| 🟢 Verde | Stock suficiente | No hacer nada |
| ⬜ Gris | Sin consumo cargado | Actualizar consumo |

### Pantallas
1. **Dashboard** — KPIs de alertas, producción próxima, gasto mensual
2. **Inventario** — Lista filtrable por tipo y alerta, edición inline de stock
3. **Plan de Producción** — Lotes semanales, formulario para agregar
4. **Pedidos** — Historial de pedidos con avance de estado

---

## 🗄️ Modelo de datos

```
Supplier (P1–P5)
  └─ Material (I001–I152)
       └─ Inventory (stock, consumo, alerta JIT)
       └─ Order (pedido)
            └─ Reception (recepción de mercancía)

ProductionPlan (lotes semanales)
JITConfig (parámetros del sistema)
```

### Lógica JIT automática
Cuando actualizas stock o consumo en `PUT /inventory/:id`:
1. Se calcula `coverageDays = currentStock / dailyConsumption`
2. Se compara con `reorderPointDays` y `supplier.daysToOrder`
3. Se actualiza `alertStatus` (RED/YELLOW/GREEN/NONE)
4. Se calcula `quantityToOrder` y `estimatedOrderCost`

---

## 📱 Configurar API URL en la app

**Desarrollo local (móvil):** usa la IP de tu máquina en lugar de `localhost`:
```
EXPO_PUBLIC_API_URL=http://192.168.1.X:3000/api
```

**Producción:** Railway URL:
```
EXPO_PUBLIC_API_URL=https://rrey-api-production.up.railway.app/api
```

Puedes crear `app/.env.local` con esta variable (no se commitea).

---

## 🔮 Próximos pasos sugeridos

- [ ] Autenticación (JWT) para proteger la API
- [ ] Roles: admin vs. operador de planta
- [ ] Notificaciones push cuando hay alertas RED (Expo Notifications)
- [ ] Exportar reportes a PDF/Excel
- [ ] Histórico de movimientos de inventario
- [ ] Integración con WhatsApp para notificaciones a proveedores
- [ ] App offline-first con sincronización cuando hay conexión
