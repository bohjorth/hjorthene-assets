#!/usr/bin/env bash
# Henter en stor, ensrettet pakke af app-ikoner (SVG, 512x512, transparent baggrund)
# fra selfh.st/icons via jsDelivr CDN.
# Kilde: https://github.com/selfhst/icons (CC BY 4.0 - kræver attribution, se bunden)
#
# Henter BÅDE standard-farve-udgaven OG "-light"-varianten (hvor den findes) —
# sidstnævnte er beregnet til mørke baggrunde (fx Authentik), og lægges i
# undermappen dark-theme/ med samme filnavn.
#
# Brug:
#   chmod +x get-app-icons.sh
#   ./get-app-icons.sh [output-mappe]   # default: ./app-icons

set -uo pipefail

OUTDIR="${1:-./app-icons}"
DARKDIR="$OUTDIR/dark-theme"
BASE="https://cdn.jsdelivr.net/gh/selfhst/icons/svg"
mkdir -p "$OUTDIR" "$DARKDIR"

# Format: "kategori|selfhst-reference(r),kommasepareret|lokalt-filnavn|Visningsnavn"
ICONS=(
  # --- Virtualisering ---
  "Virtualisering|proxmox-ve,proxmox|proxmox.svg|Proxmox"
  "Virtualisering|proxmox-backup-server,proxmox-backup,pbs|proxmox-backup.svg|Proxmox Backup"
  "Virtualisering|vmware-esxi,esxi|esxi.svg|ESXi"
  "Virtualisering|hyper-v,microsoft-hyper-v|hyper-v.svg|Hyper-V"
  "Virtualisering|xcp-ng,xcpng|xcp-ng.svg|XCP-ng"
  "Virtualisering|truenas|truenas.svg|TrueNAS"
  "Virtualisering|synology-dsm,synology|synology.svg|Synology"

  # --- Containers ---
  "Containers|docker|docker.svg|Docker"
  "Containers|portainer|portainer.svg|Portainer"
  "Containers|kubernetes,k8s|kubernetes.svg|Kubernetes"
  "Containers|k3s|k3s.svg|k3s"
  "Containers|rancher|rancher.svg|Rancher"

  # --- Monitoring ---
  "Monitoring|grafana|grafana.svg|Grafana"
  "Monitoring|prometheus|prometheus.svg|Prometheus"
  "Monitoring|grafana-loki,loki|loki.svg|Loki"
  "Monitoring|grafana-tempo,tempo|tempo.svg|Tempo"
  "Monitoring|alertmanager,prometheus-alertmanager|alertmanager.svg|Alertmanager"
  "Monitoring|zabbix|zabbix.svg|Zabbix"
  "Monitoring|uptime-kuma|uptime-kuma.svg|Uptime Kuma"

  # --- HomeLab ---
  "HomeLab|home-assistant|homeassistant.svg|Home Assistant"
  "HomeLab|frigate|frigate.svg|Frigate"
  "HomeLab|mqtt|mqtt.svg|MQTT"
  "HomeLab|zigbee2mqtt|zigbee2mqtt.svg|Zigbee2MQTT"
  "HomeLab|node-red,nodered|node-red.svg|Node-RED"
  "HomeLab|esphome|esphome.svg|ESPHome"
  "HomeLab|scrypted|scrypted.svg|Scrypted"

  # --- Arr-stack ---
  "Arr-stack|sonarr|sonarr.svg|Sonarr"
  "Arr-stack|radarr|radarr.svg|Radarr"
  "Arr-stack|lidarr|lidarr.svg|Lidarr"
  "Arr-stack|readarr|readarr.svg|Readarr"
  "Arr-stack|prowlarr|prowlarr.svg|Prowlarr"
  "Arr-stack|bazarr|bazarr.svg|Bazarr"

  # --- Download ---
  "Download|sabnzbd|sabnzbd.svg|SABnzbd"
  "Download|qbittorrent|qbittorrent.svg|qBittorrent"
  "Download|transmission|transmission.svg|Transmission"
  "Download|nzbget|nzbget.svg|NZBGet"

  # --- Media ---
  "Media|jellyfin|jellyfin.svg|Jellyfin"
  "Media|plex|plex.svg|Plex"
  "Media|emby|emby.svg|Emby"
  "Media|immich|immich.svg|Immich"
  "Media|photoprism|photoprism.svg|PhotoPrism"
  "Media|audiobookshelf|audiobookshelf.svg|Audiobookshelf"
  "Media|navidrome|navidrome.svg|Navidrome"

  # --- Produktivitet ---
  "Produktivitet|paperless-ngx,paperless|paperless.svg|Paperless-ngx"
  "Produktivitet|bookstack|bookstack.svg|BookStack"
  "Produktivitet|wiki-js,wikijs|wikijs.svg|Wiki.js"
  "Produktivitet|outline,getoutline|outline.svg|Outline"
  "Produktivitet|nextcloud|nextcloud.svg|Nextcloud"
  "Produktivitet|gitea|gitea.svg|Gitea"
  "Produktivitet|gitlab|gitlab.svg|GitLab"

  # --- Security ---
  "Security|authentik|authentik.svg|Authentik"
  "Security|vaultwarden|vaultwarden.svg|Vaultwarden"
  "Security|keycloak|keycloak.svg|Keycloak"
  "Security|crowdsec|crowdsec.svg|CrowdSec"
  "Security|wazuh|wazuh.svg|Wazuh"
  "Security|pi-hole,pihole|pihole.svg|Pi-hole"
  "Security|adguard-home|adguard.svg|AdGuard Home"

  # --- Microsoft ---
  "Microsoft|microsoft-365,microsoft365|m365.svg|Microsoft 365"
  "Microsoft|entra-id,entra|entra.svg|Entra ID"
  "Microsoft|microsoft-intune,intune|intune.svg|Intune"
  "Microsoft|microsoft-exchange,exchange|exchange.svg|Exchange"
  "Microsoft|microsoft-sharepoint,sharepoint|sharepoint.svg|SharePoint"
  "Microsoft|microsoft-teams,teams|teams.svg|Teams"
  "Microsoft|windows-admin-center|wac.svg|Windows Admin Center"

  # --- Networking ---
  "Networking|unifi,ubiquiti-unifi|unifi.svg|UniFi"
  "Networking|unifi-protect|unifi-protect.svg|UniFi Protect"
  "Networking|unifi-access|unifi-access.svg|UniFi Access"
  "Networking|opnsense|opnsense.svg|OPNsense"
  "Networking|pfsense|pfsense.svg|pfSense"
  "Networking|nginx-proxy-manager|npm.svg|Nginx Proxy Manager"
  "Networking|traefik|traefik.svg|Traefik"
  "Networking|haproxy|haproxy.svg|HAProxy"
  "Networking|cloudflare|cloudflare.svg|Cloudflare"
  "Networking|tailscale|tailscale.svg|Tailscale"
  "Networking|wireguard|wireguard.svg|WireGuard"
)

ok=0
fail=0
dark_ok=0
declare -A cat_ok
declare -A cat_total
failed_names=()

for entry in "${ICONS[@]}"; do
  IFS='|' read -r category refs outfile label <<< "$entry"
  cat_total[$category]=$(( ${cat_total[$category]:-0} + 1 ))
  IFS=',' read -ra ref_list <<< "$refs"
  found=0
  matched_ref=""
  for ref in "${ref_list[@]}"; do
    url="${BASE}/${ref}.svg"
    if curl -fsSL "$url" -o "$OUTDIR/$outfile" 2>/dev/null; then
      found=1
      matched_ref="$ref"
      ok=$((ok+1))
      cat_ok[$category]=$(( ${cat_ok[$category]:-0} + 1 ))
      break
    fi
  done

  if [ "$found" -eq 1 ]; then
    # Prøv at hente den mørke-tema-optimerede "-light" variant også
    light_url="${BASE}/${matched_ref}-light.svg"
    if curl -fsSL "$light_url" -o "$DARKDIR/$outfile" 2>/dev/null; then
      dark_ok=$((dark_ok+1))
      echo "✓ $label -> $outfile (+ dark-theme variant)"
    else
      rm -f "$DARKDIR/$outfile"
      echo "✓ $label -> $outfile"
    fi
  else
    echo "✗ $label -> IKKE FUNDET (prøvede: $refs)"
    fail=$((fail+1))
    failed_names+=("$label")
  fi
done

echo ""
echo "================================================================"
echo "Resultat pr. kategori:"
for cat in "${!cat_total[@]}"; do
  printf "  %-15s %d / %d\n" "$cat" "${cat_ok[$cat]:-0}" "${cat_total[$cat]}"
done
echo "================================================================"
echo "Total: $ok hentet, $fail ikke fundet, $dark_ok med dark-theme-variant."

if [ "$fail" -gt 0 ]; then
  echo ""
  echo "Slå de manglende op manuelt på https://selfh.st/icons (søgefelt):"
  for n in "${failed_names[@]}"; do echo "  - $n"; done
fi

echo ""
echo "----------------------------------------------------------------"
echo "Attribution krævet (CC BY 4.0): 'App icons courtesy of selfh.st/icons'"
echo "https://github.com/selfhst/icons - nævn det i footer/README."
echo "----------------------------------------------------------------"
