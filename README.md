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

## Thumbnails, EXIF, dubletdetektion og tekstsøgning (OCR/PDF)

Ved upload af billeder:
- Der genereres automatisk en rigtig thumbnail (400px, JPEG) via `sharp` - grid-visningen
  henter den lette thumbnail i stedet for at skalere det fulde billede i browseren.
- EXIF-data (kamera, dato taget, GPS) udtrækkes via `exifr` og vises i detaljevisningen,
  hvis billedet indeholder det.
- SHA256-hashen bruges til at opdage dubletter: prøver du at uploade en fil hvis indhold
  allerede findes, springes den automatisk over (du får besked om hvilken eksisterende fil
  den matcher).

Ved upload af billeder og PDF'er udtrækkes søgbar tekst i baggrunden (blokerer ikke selve
uploadet):
- **PDF'er:** indlejret tekst udtrækkes direkte (`pdf-parse`) - hurtigt og præcist for
  "rigtige" PDF'er (Word/Office-eksport, browser-print osv.). Scannede/billedbaserede
  PDF'er OCR'es ikke i denne version.
- **Billeder:** OCR via `tesseract.js` (sprog: dansk + engelsk), kører 100% lokalt på
  serveren - ingen data sendes til en cloud-tjeneste.

Den udtrukne tekst indgår automatisk i den globale søgning, og kan ses (foldet sammen)
under et assets metadata i detaljevisningen.

**Ingen nye systemkrav** for thumbnails/EXIF/PDF-tekst (rene npm-pakker). OCR bruger
Tesseract.js' egen WASM-motor og downloader sprogdata (dan+eng) automatisk ved første
brug - kræver blot udgående internetadgang første gang.

## AI-tagging (eksperimentel, selvhostet)

Under **Indstillinger** kan admin slå **AI-tagging** til (fra som standard). Når aktiveret,
foreslår en lokal CLIP-model (`Xenova/clip-vit-base-patch32` via `@huggingface/transformers`,
kører i Node via WASM/ONNX - ingen Python, ingen cloud-kald) automatisk 0-3 danske tags for
nye billede-uploads, ud fra en fast liste af ~30 begreber (logo, kvittering, menukort,
person, bygning, produktfoto osv. - se `backend/src/utils/aiTagging.js` for at
tilføje/ændre kategorier). Asset'et tagges desuden altid med `ai-foreslået`, så I nemt kan
filtrere på hvilke tags der kom fra AI'en, og fjerne dem I er uenige i via normal
tag-redigering.

**Ressourceforbrug:** modellen downloades til `backend/data/models/` ved første brug
(~150-300 MB, kræver internetadgang den ene gang), og bruger et par sekunders CPU-tid pr.
billede. Kører i baggrunden efter upload - blokerer ikke selve uploadet, og fejler stille
(logges, men stopper aldrig uploadet) hvis modellen ikke kan indlæses.

## Bulk-handlinger og ZIP-download

I både grid- og listevisning kan flere assets markeres via afkrydsningsfelter (synlige
ved hover, eller altid synlige når noget er valgt). Med markerede assets viser en
værktøjslinje øverst i resultaterne:
- **Download som ZIP** - streamer en ZIP med de valgte filer (ingen midlertidig fil på
  serveren, streames direkte)
- **Flyt til mappe** (Editor+)
- **Tilføj tag** (Editor+) - tilføjer til alle valgte uden at fjerne eksisterende tags
- **Slet** (Editor+)

## Diskplads-advarsel og automatisk backup

**Administration**-siden viser nu reelt diskforbrug for den partition uploads ligger på
(ikke kun størrelsen af selve uploads-mappen), med farvet advarsel ved 75%/90% brug.

Der følger et selvstændigt backup-script (`scripts/backup.sh`) med, som tager en
konsistent SQLite-backup (via `sqlite3 .backup`, med fallback til filkopi) og en
komprimeret kopi af uploads-mappen, samt rydder op i backups ældre end 30 dage
(justerbart via `BACKUP_RETENTION_DAYS`). Aktivér den daglige, automatiske kørsel:

```bash
sudo cp nginx/hjorthene-assets-backup.service /etc/systemd/system/
sudo cp nginx/hjorthene-assets-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hjorthene-assets-backup.timer

# Test at den virker med det samme, uden at vente til kl. 03:00:
sudo systemctl start hjorthene-assets-backup.service
sudo journalctl -u hjorthene-assets-backup.service -n 20 --no-pager
```

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
