# Rrëy: JÏT — Inventario y producción justo a tiempo

> Plataforma de gestión de inventario, producción y proveedores para **Cervecería Rrëy** (Monterrey).
> iOS · Android · Web desde una sola base de código · Express + Prisma + PostgreSQL · Expo.
>
> *JIT inventory and production platform for a craft brewery. Built and deployed in 2026 as an independent project by Enrique Amir González Hernández.*

**En producción:** [app web](https://rrey-app-production-3717.up.railway.app) · [API `/health`](https://alexaapp-production.up.railway.app/health)

---

## Qué resuelve

Una cervecería artesanal maneja decenas de maltas, lúpulos y adjuntos con tiempos de entrega distintos por proveedor. Si un ingrediente llega tarde, la producción se detiene; si se pide de más, el capital se queda en la bodega. Rrëy: JÏT conecta las tres piezas que normalmente viven en hojas de cálculo separadas — **inventario, planes de producción y proveedores** — y calcula cuándo hay que pedir cada cosa para que llegue justo a tiempo.

## Qué incluye

- **Motor JIT** (`api/src/lib/jit.ts`): compara cobertura de stock contra la fecha del siguiente lote y el *lead time* de cada proveedor, y clasifica cada material en CRITICAL / RED / YELLOW / GREEN con buffer de seguridad configurable.
- **78 endpoints REST en 15 módulos**: inventario, materiales, producción, recetas y estilos, órdenes de compra, recepciones, proveedores, dashboard, auditoría, usuarios, configuración.
- **Control de acceso por 4 roles** (DEVELOPER · SUPERVISOR · OPERATOR · TRANSPORTER) con guarda contra escalación de privilegios.
- **Bitácora de auditoría a nivel de campo** con exportación a Excel y filtros por usuario, entidad y fecha.
- **Autenticación JWT + biométrica** en móvil (expo-local-authentication + SecureStore).
- **Importación del catálogo desde Excel** (152 materiales y 5 proveedores con su mapeo de abastecimiento primario y de emergencia) y plantilla de importación descargable desde el móvil.
- **Planes de producción con flujo de aprobación**, recetas por estilo y cálculo automático de requerimientos.
- **Configuración editable por rol** (moneda, buffers, políticas de contraseña) sin redeploy.
- **Actualizaciones OTA** con EAS Update.

## Stack

| Capa | Tecnología |
|---|---|
| App | Expo SDK 54 · React Native 0.81 · expo-router · TanStack Query · react-native-web |
| API | Node.js · Express 4 · TypeScript · zod |
| Datos | PostgreSQL 16 · Prisma 5 (15 modelos, 10 enums) |
| Seguridad | JWT · bcrypt (cost 12) · expo-secure-store · expo-local-authentication |
| Infra | Docker · Railway (API + web + Postgres) · EAS Build / Update |

## Estructura

```
rrey-jit/
├── api/            # Express + Prisma (rutas en api/src/routes, lógica JIT en api/src/lib)
├── app/            # Expo + React Native (expo-router, pantallas por rol)
├── docs/           # Guía ejecutiva e instructivo de usuarios (HTML imprimible)
├── ARCHITECTURE.md # Referencia técnica completa: arquitectura, modelo de datos, API, escalamiento
└── docker-compose.yml
```

## Documentación

- [`docs/guia-ejecutiva.html`](docs/guia-ejecutiva.html) — qué es, qué problema resuelve y cómo se usa, sin tecnicismos.
- [`docs/instructivo-usuarios.html`](docs/instructivo-usuarios.html) — manual paso a paso para supervisores y operadores.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — arquitectura, seguridad, modelo de datos, referencia de la API y plan de escalamiento.

---

## Inicio rápido (local)

Requisitos: Node.js 18+, Docker Desktop, Expo CLI.

```bash
git clone https://github.com/Quique2/rrey-jit.git
cd rrey-jit
npm install                 # instala api/ y app/

docker-compose up -d        # PostgreSQL local (rrey_db / rrey / rrey_secret)
cd api && cp .env.example .env && cd ..

npm run db:push             # crea las tablas
npm run db:seed             # carga materiales, proveedores y planes de prueba
npm run api                 # API en http://localhost:3000  (health: /health)

cd app && npm start         # web en el navegador; QR para iOS/Android con Expo Go
```

Para apuntar la app a otra API: `EXPO_PUBLIC_API_URL=http://<tu-ip>:3000/api` en `app/.env.local`.

Para elevar una cuenta a DEVELOPER después del seed: `DEVELOPER_EMAIL=correo@dominio npm run db:seed:rbac` (o el script equivalente en `api/`).

## Deploy en Railway

1. Servicio **PostgreSQL** (Railway provee `DATABASE_URL`).
2. Servicio **API** desde este repo con `Root directory: api/` (`api/railway.toml` configura build y start). Variables: `DATABASE_URL`, `PORT`, `CORS_ORIGIN`, `JWT_SECRET`.
3. Servicio **web** desde `app/Dockerfile` con `EXPO_PUBLIC_API_URL` apuntando a la API pública.

---

## Diseño

Identidad oscura y editorial: fondo `#0C0C0C`, dorado `#C9A84C`, crema `#F2EBD9`, logotipo serif "Rrëy".

| Alerta | Significado | Acción |
|---|---|---|
| 🔴 Roja / crítica | Cobertura menor al tiempo de entrega | Pedir hoy |
| 🟡 Amarilla | Cobertura por debajo del punto de reorden | Planear pedido |
| 🟢 Verde | Stock suficiente | Nada |
| ⬜ Gris | Sin consumo cargado | Actualizar consumo |

## Siguientes pasos

- Notificaciones push cuando aparece una alerta roja (Expo Notifications).
- Rol de transportista (vista previa incluida en el instructivo).
- Modo offline con sincronización.
- Avisos a proveedores por WhatsApp.

---

**Autor:** Enrique Amir González Hernández · [enrique-portfolio-production.up.railway.app](https://enrique-portfolio-production.up.railway.app) · [github.com/Quique2](https://github.com/Quique2)
