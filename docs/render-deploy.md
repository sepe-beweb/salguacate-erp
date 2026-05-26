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
TURSO_DATABASE_URL=...
TURSO_AUTH_TOKEN=...
GEMINI_API_KEY=...
JWT_SECRET=...
```

Genera `JWT_SECRET` con:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Usa Turso en producción. Si no configuras Turso, el backend cae a SQLite local y los datos pueden perderse en redeploys o reinicios.

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

## 5. Comprobaciones

Backend:

```text
https://salguacate-backend.onrender.com/api/usuarios/public
```

Frontend:

```text
https://salguacate-frontend.onrender.com
```

Si una ruta interna como `/inventario` da 404 al refrescar, revisa que la regla rewrite `/* -> /index.html` esté activa en el servicio estático.
