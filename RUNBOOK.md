# PDA06 — Runbook de despliegue

App: `github.com/NightMare2210/pda06-despliegue` (copia de pda03-stack-mean) · Express + TS en `backend/` · MongoDB Atlas
Ruta en servidor: `/var/www/pda03-api` · Proceso PM2: `pda03-api`

> ⚠️ Diferencias con la guía (a propósito):
> - `ecosystem.config.cjs` (no `.js`): `backend/package.json` tiene `"type": "module"`.
> - Secretos en `/var/www/pda03-api/shared/.env` (servidor), NO en el ecosystem → el ecosystem sí se commitea.
> - NO se hace `git clone` manual en la carpeta: `pm2 deploy setup` crea `source/`, `current/`, `shared/`.
> - `post-deploy` compila TS (`npm run build`) y corre `dist/index.js`.

---

## Fase 0 — MongoDB Atlas
1. Crear cluster **M0 (free)**.
2. *Database Access* → usuario + password.
3. *Network Access* → agregar la **IP elástica** de la EC2 (después de la Fase 1). Para la prueba local, tu IP.
4. *Connect → Drivers* → copiar URI: `mongodb+srv://USER:PASS@cluster.xxxx.mongodb.net/empleados?retryWrites=true&w=majority`

## Fase 1 — AWS (consola)
1. EC2 Ubuntu 24.04, t2.micro, par de llaves `.pem` → guardarlo en `~/.ssh/` y `chmod 400`.
2. Security Group (inbound): HTTP 80 `0.0.0.0/0` · HTTPS 443 `0.0.0.0/0` · SSH 22 **Mi IP**. **3000 cerrado.**
3. Elastic IP → Asignar → Asociar a la instancia. Anotar `IP`.

## Fase 2 — Servidor (ssh -i ~/.ssh/LLAVE.pem ubuntu@IP)
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs git build-essential nginx
node -v && npm -v
sudo ufw allow 'Nginx Full' && sudo ufw allow OpenSSH   # si activás ufw, OpenSSH ANTES o te quedás afuera
```
> La guía dice `nodesource.com | bash` → la URL real es `deb.nodesource.com/setup_lts.x`. Y `nodejs` ya trae npm: NO instales `npm` por apt (choca).

Nginx → `sudo nano /etc/nginx/sites-available/default`:
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Fase 3 — GitHub deploy key + carpeta
```bash
ssh-keygen -t ed25519 -C "servidor-produccion"   # ENTER x3
cat ~/.ssh/id_ed25519.pub     # → GitHub repo > Settings > Deploy keys > Add (sin write)
ssh -T git@github.com         # 'yes'
sudo mkdir -p /var/www/pda03-api
sudo chown -R ubuntu:ubuntu /var/www/pda03-api
```

## Fase 4 — PM2 + secretos (servidor)
```bash
sudo npm install -g pm2
mkdir -p /var/www/pda03-api/shared/logs
nano /var/www/pda03-api/shared/.env
#   MONGO_URI=mongodb+srv://USER:PASS@cluster.xxxx.mongodb.net/empleados
chmod 600 /var/www/pda03-api/shared/.env
pm2 startup systemd    # copiar y ejecutar el comando sudo que imprime (revive PM2 al reiniciar la EC2)
```

## Fase 5 — CI/CD (PC local, en la raíz del repo)
1. En `ecosystem.config.cjs` reemplazar `TU_IP_ELASTICA` y `~/.ssh/TU_LLAVE_AWS.pem`.
2. Commit + push:
   ```bash
   git add . && git commit -m "feat: add pm2 production deployment config" && git push origin main
   ```
3. Desplegar:
   ```bash
   npm install -g pm2
   pm2 deploy ecosystem.config.cjs production setup
   pm2 deploy ecosystem.config.cjs production
   ```
4. En el servidor: `pm2 list` → `pda03-api` en cluster, `online`.

## Fase 6 — Alertas + logs (servidor)
Slack: App Directory → *Incoming WebHooks* → canal `#alertas-servidor` → copiar URL `https://hooks.slack.com/...`
> ⚠️ La guía usa `pm2-notify`, pero ese paquete es un notificador **SMTP (email)** (`npm view pm2-notify description`).
> Para Slack se usa el módulo `pm2-slack` (Discord: `pm2-discord`).
```bash
pm2 install pm2-slack
pm2 set pm2-slack:slack_url "https://hooks.slack.com/services/..."
pm2 set pm2-slack:servername "aws-pda03"
pm2 set pm2-slack:stop true         # la prueba de resiliencia usa 'pm2 stop'
pm2 set pm2-slack:exit true         # caídas / crash
pm2 set pm2-slack:error true
pm2 save --force                    # la guía tiene "–force" con guion largo: falla
pm2 install pm2-logrotate
```

---

## Pruebas (evidencia para el informe)
| Prueba | Cómo | Esperado |
|---|---|---|
| Red | `http://IP/` y `http://IP/api/v1/employees` | JSON `{status:"ok"}` y lista; `http://IP:3000` **no** responde |
| Resiliencia | `pm2 stop pda03-api` → `pm2 start pda03-api` | Alerta en Slack |
| CI/CD | Cambiar `service` en la ruta `/` de `backend/src/app.ts`, push, `pm2 deploy ecosystem.config.cjs production` | Cambio visible sin entrar a AWS |

## Troubleshooting
- `pm2 logs pda03-api` · `tail -f /var/www/pda03-api/shared/logs/err.log`
- `Falta MONGO_URI` → revisar `shared/.env` y `DOTENV_PATH` en el ecosystem.
- `MongooseServerSelectionError` → la IP elástica no está en Atlas Network Access.
- 502 Bad Gateway → la app no está arriba en :3000 (`pm2 list`).

## Fase 7 — HTTPS con dominio (Recomendación de la guía)
1. https://www.duckdns.org → login → reCAPTCHA → subdominio `pda06-brando` → current ip `15.229.143.47`.
2. Servidor:
   ```bash
   sudo sed -i "s/server_name _;/server_name pda06-brando.duckdns.org;/" /etc/nginx/sites-available/default
   sudo nginx -t && sudo systemctl reload nginx
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d pda06-brando.duckdns.org --agree-tos --register-unsafely-without-email --redirect
   sudo certbot renew --dry-run      # renovación automática vía certbot.timer
   ```
3. Resultado: `https://pda06-brando.duckdns.org` (Let's Encrypt, HTTP → 301 → HTTPS).
4. Hardening extra: `app.disable('x-powered-by')` en `backend/src/app.ts` (no revelar el framework).
5. ⚠️ Certbot deja el bloque :80 con `return 404` para cualquier Host ≠ dominio → `http://IP` deja de andar.
   Reemplazar ese bloque por:
   ```nginx
   server {
       listen 80 default_server;
       listen [::]:80 default_server;
       server_name _;
       return 301 https://pda06-brando.duckdns.org$request_uri;
   }
   ```
6. ⚠️ dotenv v18 imprime `◇ injected env` por **stderr** → `pm2-slack` lo manda como `error` (falso positivo).
   Fix: `DOTENV_QUIET: 'true'` en `env_production` del ecosystem.

## Fase 8 — Notificador propio (reemplaza pm2-slack)
`pm2-slack` tiene formato fijo (`pda03-api exit null`) y manda un mensaje por worker.
`alerts/notifier.cjs` escucha el bus de PM2 (`process:event`, `process:exception`, `log:err`) y envía a Slack un mensaje legible,
agrupando los workers del cluster (buffer 3 s) y avisando también cuando la app se recupera (✅).
- Corre como app `pda03-alertas` (fork, 1 instancia) desde el mismo `ecosystem.config.cjs` → se despliega por CI/CD.
- Webhook en el servidor: `SLACK_WEBHOOK_URL=...` en `/var/www/pda03-api/shared/.env`.
- `pm2 uninstall pm2-slack` para no duplicar alertas.
- Mensaje manual: `curl -X POST -H 'Content-type: application/json' --data '{"text":"hola"}' "$(grep SLACK_WEBHOOK_URL /var/www/pda03-api/shared/.env | cut -d= -f2-)"`

## Fase 9 — Frontend Angular en Azure (Storage static website)
URL: https://pda06empleadosweb.z47.web.core.windows.net/ → consume https://pda06-brando.duckdns.org/api/v1
- `frontend/`: Angular 22 (standalone, zoneless, OnPush). Reto 3: `EmployeeService` con `BehaviorSubject` privados + updates inmutables. Reto 4: `EmployeesPage` (smart, `async` pipe) + `EmployeeForm` / `EmployeeTable` (dumb, `@Input`/`@Output`).
- ⚠️ Azure for Students solo permite `northcentralus, mexicocentral, francecentral, chilecentral, spaincentral` y **Static Web Apps no existe en ninguna** → se usa **Storage Account static website** en `chilecentral`.
- Recursos: RG `rg-pda06`, Storage `pda06empleadosweb` (StorageV2, LRS, HTTPS only, TLS 1.2, sin acceso público a blobs), static website con 404 → `index.html` (fallback SPA).
- Suscripción nueva: registrar providers antes (`az provider register -n Microsoft.Storage --wait`), si no → `SubscriptionNotFound`.
- CI/CD: `.github/workflows/frontend-azure.yml` → build Node 24 + `az storage blob upload-batch` con **SAS solo sobre `$web`** (secrets `AZURE_STORAGE_ACCOUNT`, `AZURE_STORAGE_SAS`, vence 2027-02-28). Assets con hash → cache 1 año; `index.html` → `no-cache`.
- Storage no permite headers → CSP va en `<meta http-equiv>` y se desactiva `inlineCritical` (su `onload` inline sería bloqueado por la CSP y la app quedaría sin estilos).
- ⚠️ Subir archivos a `.github/workflows` por git requiere el scope `workflow` en el token de `gh`; alternativa: crear el workflow desde la web de GitHub.
