# Despliegue En Render

El repositorio incluye `render.yaml` para crear dos servicios con Render Blueprint:

- `salguacate-backend`: API Express en Node.
- `salguacate-frontend`: sitio estático Vite/React.

## 1. Crear El Blueprint

1. En Render, entra en `New` -> `Blueprint`.
2. Conecta el repositorio `salguacate-erp`.
3. Selecciona la rama `main`.
4. Render detectará `render.yaml` y propondrá crear backend y frontend.

## 2. Variables Del Backend

Configura estas variables en `salguacate-backend`:

```env
NODE_ENV=production
SQLITE_DATABASE_PATH=/opt/render/project/src/server/persistent/database.sqlite
UPLOADS_DIR=/opt/render/project/src/server/persistent/uploads
GEMINI_API_KEY=...
JWT_SECRET=...
```

Genera `JWT_SECRET` con:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Para que SQLite conserve datos en Render, el backend necesita un disco persistente montado en:

```text
/opt/render/project/src/server/persistent
```

Render puede requerir un plan de pago para discos persistentes. Sin disco persistente, SQLite y los uploads funcionarán, pero los datos pueden perderse en redeploys o reinicios.

## 3. Variable Del Frontend

Configura esta variable en `salguacate-frontend`:

```env
VITE_API_URL=https://salguacate-backend.onrender.com
```

Si Render genera otra URL para el backend, actualiza `VITE_API_URL` con la URL real y redepliega el frontend.

## 4. Automatización Con Deploy Hooks

Render puede autodesplegar al hacer push a `main`. Además, este repo incluye `.github/workflows/render-deploy.yml` para disparar deploys por Deploy Hook.

Para activarlo:

1. En Render, abre cada servicio.
2. Copia su `Deploy Hook`.
3. En GitHub, ve a `Settings` -> `Secrets and variables` -> `Actions`.
4. Añade estos secrets:

```env
RENDER_BACKEND_DEPLOY_HOOK_URL=...
RENDER_FRONTEND_DEPLOY_HOOK_URL=...
```

Después, cada push a `main` o ejecución manual de `Trigger Render Deploy` llamará a ambos hooks.

## 5. Automatización Local Con La API De Render

Render no publica un CLI oficial en npm. El repo incluye un cliente mínimo en `scripts/render-create-services.cjs` que llama a la API oficial de Render para crear los dos servicios.

Primero crea una API Key en Render:

```text
Account Settings -> API Keys -> Create API Key
```

También necesitas el `ownerId` del workspace, disponible en la configuración del workspace de Render.

Ejemplo en PowerShell:

```powershell
$env:RENDER_API_KEY="rnd_..."
$env:GEMINI_API_KEY="..."
$env:JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
node scripts/render-create-services.cjs
```

Si tu API key tiene acceso a un solo owner/workspace, el script detecta `RENDER_OWNER_ID` automáticamente. Si tienes varios, te mostrará la lista y deberás definir:

```powershell
$env:RENDER_OWNER_ID="tea_..."
```

Opcionales:

```powershell
$env:RENDER_REPO_URL="https://github.com/sepe-beweb/salguacate-erp"
$env:RENDER_BRANCH="main"
$env:RENDER_BACKEND_NAME="salguacate-backend"
$env:RENDER_FRONTEND_NAME="salguacate-frontend"
$env:RENDER_BACKEND_PLAN="starter"
$env:RENDER_BACKEND_REGION="oregon"
```

Por defecto el script crea disco persistente para SQLite y uploads. Para forzar un servicio sin disco:

```powershell
$env:RENDER_ENABLE_DISK="false"
```

Sin disco, SQLite será efímero en Render.

Para revisar el payload sin crear servicios:

```powershell
node scripts/render-create-services.cjs --dry-run
```

## 6. Comprobaciones

Backend:

```text
https://salguacate-backend.onrender.com/api/usuarios/public
```

Frontend:

```text
https://salguacate-frontend.onrender.com
```

Si una ruta interna como `/inventario` da 404 al refrescar, revisa que la regla rewrite `/* -> /index.html` esté activa en el servicio estático.
