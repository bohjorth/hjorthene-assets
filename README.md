# Hjorthene Assets

Digital Asset Management (DAM) til `assets.hjorthene.dk`.

- **Backend:** Node.js / Express / SQLite (better-sqlite3), login via Authentik (OIDC)
- **Frontend:** Vanilla HTML/CSS/JS (ingen build-step), serveres statisk af nginx
- **v1.0-status:** Dashboard, Upload, Asset Management, Mapper, Tags, Kategorier, Søgning,
  Filtrering, Preview, Download, Metadata, Authentik-login, Roller, Indstillinger,
  Administration, Log, samt **Collections** (bonus-feature fra spec'en).

## Mappestruktur

```
hjorthene-assets/
├── backend/           Node/Express API + SQLite
│   ├── src/
│   │   ├── routes/    dashboard, assets, folders, tags, categories, collections, settings, admin, logs, auth
│   │   ├── auth/       Authentik OIDC-klient
│   │   ├── middleware/ auth/roller + upload (multer)
│   │   └── utils/      kategorisering, logging
│   ├── uploads/        Uploadede filer (ikke i git)
│   └── data/           SQLite-database + backups (ikke i git)
├── frontend/          Statisk SPA (index.html + css/js)
└── nginx/             Eksempel nginx-config + systemd service
```

## 1. Authentik-opsætning

I Authentik, opret en **OAuth2/OpenID Provider** + **Application**:

1. Providers → Create → OAuth2/OpenID Provider
   - Client type: `Confidential`
   - Redirect URI: `https://assets.hjorthene.dk/auth/callback`
   - Scopes: `openid`, `email`, `profile`, og `groups` (tilføj evt. custom scope-mapping så `groups` claim inkluderes i ID-token)
2. Applications → Create → knyt til provideren ovenfor, slug fx `hjorthene-assets`
3. Noter **Client ID**, **Client Secret** og **Issuer URL** (typisk
   `https://authentik.hjorthene.dk/application/o/hjorthene-assets/`)
4. Opret to grupper i Authentik, fx `Hjorthene Assets Admins` og `Hjorthene Assets Editors`.
   Alle andre logged-in brugere får automatisk rollen `viewer`.

## 2. Backend-opsætning

```bash
cd backend
cp .env.example .env
# udfyld AUTHENTIK_*, SESSION_SECRET, BASE_URL osv. i .env
npm install
npm start
```

Backend lytter som standard på port 4000 og opretter selv SQLite-databasen
(`data/hjorthene.db`) og upload-mappen (`uploads/`) ved første kørsel.

For produktion: brug den medfølgende systemd-service (`nginx/hjorthene-assets.service`)
i stedet for `npm start` direkte, så den genstarter automatisk ved fejl/reboot.

## 3. Frontend

Frontend er ren statisk HTML/CSS/JS — ingen build-step. Den skal blot ligge et sted
nginx kan servere den fra (se nginx-config), og kalder backend'en via `/api` og `/auth`,
som nginx proxy'er videre.

## 4. Nginx

Se `nginx/assets.hjorthene.dk.conf` for et komplet eksempel:
- Server statisk frontend fra `/var/www/hjorthene-assets/frontend`
- Proxy `/api/` og `/auth/` til `127.0.0.1:4000`
- `client_max_body_size` sat højt til store filuploads — match med `MAX_UPLOAD_SIZE_MB`

## 5. Deployment på serveren (kort version)

```bash
# På serveren, efter git clone/pull:
cd /var/www/hjorthene-assets/backend
npm install --omit=dev
cp .env.example .env   # og udfyld den, første gang
sudo cp ../nginx/hjorthene-assets.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hjorthene-assets

sudo cp ../nginx/assets.hjorthene.dk.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/assets.hjorthene.dk.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Import af app-ikoner fra selfhosted-katalog

Under **Assets** findes knappen **"Importér fra selfhosted"** (Editor+), som henter
~75 officielle app-logoer (Proxmox, Docker, Grafana, Authentik, m.fl.) direkte fra
[selfh.st/icons](https://selfh.st/icons) (CC BY 4.0) og opretter dem som assets i
mappen `App-ikoner/<kategori>`, tagget `selfhosted`. Kataloget udvides ved at
redigere `backend/src/data/selfhostedIcons.js`. Der findes også en fri søgning i
hele biblioteket (7000+ ikoner) via Iconifys offentlige API.

Da import-endpointet kalder ud til internettet fra backend-serveren, kræver det at
serveren har udgående netværksadgang til `cdn.jsdelivr.net` og `api.iconify.design`.

### Auto-beskæring af ikoner (kræver Chromium)

Nogle kilde-SVG'er fra selfh.st har meget "luft" omkring selve logoet, da hele
samlingen normaliseres til et kvadratisk 1:1-lærred uanset det enkelte logos
naturlige proportioner. Ved import beskæres hver SVG derfor automatisk ind til
sit visuelle indhold (via en headless Chromium-rendering, der måler den rigtige
bounding box), så ikoner fylder deres flise ensartet i fx Authentiks
application-oversigt.

Dette kræver at Chromium er installeret på serveren:
```bash
sudo apt-get update && sudo apt-get install -y chromium
```
Sti kan justeres via `CHROMIUM_PATH` i `.env` (default `/usr/bin/chromium`).
**Mangler Chromium, fejler importen ikke** — beskæring springes bare over, og
ikonerne importeres uændrede.

Et alternativt CLI-script (`scripts/get-app-icons.sh`) findes også, hvis du hellere
vil hente ikonerne som rå filer uden om appen (fx til et andet dashboard) - dette
script beskærer ikke automatisk.
Husk attribution ved brug: *"App icons courtesy of selfh.st/icons"*.

## Roller

| Rolle | Rettigheder |
|---|---|
| **Viewer** | Se, søge, filtrere, downloade |
| **Editor** | + Upload, rediger metadata, opret/slet mapper/tags/collections, slet assets |
| **Admin** | + Indstillinger, Administration (db-status, backup, log) |

Rollen sættes automatisk ud fra Authentik-gruppen ved login (se `.env`:
`ROLE_GROUP_ADMIN` / `ROLE_GROUP_EDITOR`).

## Ikke inkluderet i v1.0 (jf. spec'en)

Lagt til v1.1/v2 i roadmappet: ZIP-download af flere filer, OCR, AI-tagging,
automatisk thumbnail-generator, versionering, REST-API til 3. part, webhooks,
EXIF, ansigtsgenkendelse, duplicate finder, AI-søgning, watermarking, video-transcoding.

## Næste skridt herfra

- [ ] Udfyld `.env` med rigtige Authentik-værdier og en stærk `SESSION_SECRET`
- [ ] Test login-flow end-to-end mod Authentik
- [ ] Opret første mapper/kategorier og lav et par test-uploads
- [ ] Sæt cron/systemd-timer op til automatisk `POST /api/admin/backup`
