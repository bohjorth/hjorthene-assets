// Katalog over app-ikoner der kan importeres fra selfh.st/icons (CC BY 4.0).
// Kilde: https://github.com/selfhst/icons - kræver attribution ved brug.
// refs: liste af reference-navne der prøves i rækkefølge (nogle apps har uklar/skiftende navngivning).
module.exports = [
  // --- Virtualisering ---
  { category: 'Virtualisering', refs: ['proxmox-ve', 'proxmox'], filename: 'proxmox.svg', label: 'Proxmox' },
  { category: 'Virtualisering', refs: ['proxmox-backup-server', 'proxmox-backup', 'pbs'], filename: 'proxmox-backup.svg', label: 'Proxmox Backup' },
  { category: 'Virtualisering', refs: ['vmware-esxi', 'esxi'], filename: 'esxi.svg', label: 'ESXi' },
  { category: 'Virtualisering', refs: ['hyper-v', 'microsoft-hyper-v'], filename: 'hyper-v.svg', label: 'Hyper-V' },
  { category: 'Virtualisering', refs: ['xcp-ng', 'xcpng'], filename: 'xcp-ng.svg', label: 'XCP-ng' },
  { category: 'Virtualisering', refs: ['truenas'], filename: 'truenas.svg', label: 'TrueNAS' },
  { category: 'Virtualisering', refs: ['synology-dsm', 'synology'], filename: 'synology.svg', label: 'Synology' },

  // --- Containers ---
  { category: 'Containers', refs: ['docker'], filename: 'docker.svg', label: 'Docker' },
  { category: 'Containers', refs: ['portainer'], filename: 'portainer.svg', label: 'Portainer' },
  { category: 'Containers', refs: ['kubernetes', 'k8s'], filename: 'kubernetes.svg', label: 'Kubernetes' },
  { category: 'Containers', refs: ['k3s'], filename: 'k3s.svg', label: 'k3s' },
  { category: 'Containers', refs: ['rancher'], filename: 'rancher.svg', label: 'Rancher' },

  // --- Monitoring ---
  { category: 'Monitoring', refs: ['grafana'], filename: 'grafana.svg', label: 'Grafana' },
  { category: 'Monitoring', refs: ['prometheus'], filename: 'prometheus.svg', label: 'Prometheus' },
  { category: 'Monitoring', refs: ['grafana-loki', 'loki'], filename: 'loki.svg', label: 'Loki' },
  { category: 'Monitoring', refs: ['grafana-tempo', 'tempo'], filename: 'tempo.svg', label: 'Tempo' },
  { category: 'Monitoring', refs: ['alertmanager', 'prometheus-alertmanager'], filename: 'alertmanager.svg', label: 'Alertmanager' },
  { category: 'Monitoring', refs: ['zabbix'], filename: 'zabbix.svg', label: 'Zabbix' },
  { category: 'Monitoring', refs: ['uptime-kuma'], filename: 'uptime-kuma.svg', label: 'Uptime Kuma' },

  // --- HomeLab ---
  { category: 'HomeLab', refs: ['home-assistant'], filename: 'homeassistant.svg', label: 'Home Assistant' },
  { category: 'HomeLab', refs: ['frigate'], filename: 'frigate.svg', label: 'Frigate' },
  { category: 'HomeLab', refs: ['mqtt'], filename: 'mqtt.svg', label: 'MQTT' },
  { category: 'HomeLab', refs: ['zigbee2mqtt'], filename: 'zigbee2mqtt.svg', label: 'Zigbee2MQTT' },
  { category: 'HomeLab', refs: ['node-red', 'nodered'], filename: 'node-red.svg', label: 'Node-RED' },
  { category: 'HomeLab', refs: ['esphome'], filename: 'esphome.svg', label: 'ESPHome' },
  { category: 'HomeLab', refs: ['scrypted'], filename: 'scrypted.svg', label: 'Scrypted' },

  // --- Arr-stack ---
  { category: 'Arr-stack', refs: ['sonarr'], filename: 'sonarr.svg', label: 'Sonarr' },
  { category: 'Arr-stack', refs: ['radarr'], filename: 'radarr.svg', label: 'Radarr' },
  { category: 'Arr-stack', refs: ['lidarr'], filename: 'lidarr.svg', label: 'Lidarr' },
  { category: 'Arr-stack', refs: ['readarr'], filename: 'readarr.svg', label: 'Readarr' },
  { category: 'Arr-stack', refs: ['prowlarr'], filename: 'prowlarr.svg', label: 'Prowlarr' },
  { category: 'Arr-stack', refs: ['bazarr'], filename: 'bazarr.svg', label: 'Bazarr' },

  // --- Download ---
  { category: 'Download', refs: ['sabnzbd'], filename: 'sabnzbd.svg', label: 'SABnzbd' },
  { category: 'Download', refs: ['qbittorrent'], filename: 'qbittorrent.svg', label: 'qBittorrent' },
  { category: 'Download', refs: ['transmission'], filename: 'transmission.svg', label: 'Transmission' },
  { category: 'Download', refs: ['nzbget'], filename: 'nzbget.svg', label: 'NZBGet' },

  // --- Media ---
  { category: 'Media', refs: ['jellyfin'], filename: 'jellyfin.svg', label: 'Jellyfin' },
  { category: 'Media', refs: ['plex'], filename: 'plex.svg', label: 'Plex' },
  { category: 'Media', refs: ['emby'], filename: 'emby.svg', label: 'Emby' },
  { category: 'Media', refs: ['immich'], filename: 'immich.svg', label: 'Immich' },
  { category: 'Media', refs: ['photoprism'], filename: 'photoprism.svg', label: 'PhotoPrism' },
  { category: 'Media', refs: ['audiobookshelf'], filename: 'audiobookshelf.svg', label: 'Audiobookshelf' },
  { category: 'Media', refs: ['navidrome'], filename: 'navidrome.svg', label: 'Navidrome' },

  // --- Produktivitet ---
  { category: 'Produktivitet', refs: ['paperless-ngx', 'paperless'], filename: 'paperless.svg', label: 'Paperless-ngx' },
  { category: 'Produktivitet', refs: ['bookstack'], filename: 'bookstack.svg', label: 'BookStack' },
  { category: 'Produktivitet', refs: ['wiki-js', 'wikijs'], filename: 'wikijs.svg', label: 'Wiki.js' },
  { category: 'Produktivitet', refs: ['outline', 'getoutline'], filename: 'outline.svg', label: 'Outline' },
  { category: 'Produktivitet', refs: ['nextcloud'], filename: 'nextcloud.svg', label: 'Nextcloud' },
  { category: 'Produktivitet', refs: ['gitea'], filename: 'gitea.svg', label: 'Gitea' },
  { category: 'Produktivitet', refs: ['gitlab'], filename: 'gitlab.svg', label: 'GitLab' },

  // --- Security ---
  { category: 'Security', refs: ['authentik'], filename: 'authentik.svg', label: 'Authentik' },
  { category: 'Security', refs: ['vaultwarden'], filename: 'vaultwarden.svg', label: 'Vaultwarden' },
  { category: 'Security', refs: ['keycloak'], filename: 'keycloak.svg', label: 'Keycloak' },
  { category: 'Security', refs: ['crowdsec'], filename: 'crowdsec.svg', label: 'CrowdSec' },
  { category: 'Security', refs: ['wazuh'], filename: 'wazuh.svg', label: 'Wazuh' },
  { category: 'Security', refs: ['pi-hole', 'pihole'], filename: 'pihole.svg', label: 'Pi-hole' },
  { category: 'Security', refs: ['adguard-home'], filename: 'adguard.svg', label: 'AdGuard Home' },

  // --- Microsoft ---
  { category: 'Microsoft', refs: ['microsoft-365', 'microsoft365'], filename: 'm365.svg', label: 'Microsoft 365' },
  { category: 'Microsoft', refs: ['entra-id', 'entra'], filename: 'entra.svg', label: 'Entra ID' },
  { category: 'Microsoft', refs: ['microsoft-intune', 'intune'], filename: 'intune.svg', label: 'Intune' },
  { category: 'Microsoft', refs: ['microsoft-exchange', 'exchange'], filename: 'exchange.svg', label: 'Exchange' },
  { category: 'Microsoft', refs: ['microsoft-sharepoint', 'sharepoint'], filename: 'sharepoint.svg', label: 'SharePoint' },
  { category: 'Microsoft', refs: ['microsoft-teams', 'teams'], filename: 'teams.svg', label: 'Teams' },
  { category: 'Microsoft', refs: ['windows-admin-center'], filename: 'wac.svg', label: 'Windows Admin Center' },

  // --- Networking ---
  { category: 'Networking', refs: ['unifi', 'ubiquiti-unifi'], filename: 'unifi.svg', label: 'UniFi' },
  { category: 'Networking', refs: ['unifi-protect'], filename: 'unifi-protect.svg', label: 'UniFi Protect' },
  { category: 'Networking', refs: ['unifi-access'], filename: 'unifi-access.svg', label: 'UniFi Access' },
  { category: 'Networking', refs: ['opnsense'], filename: 'opnsense.svg', label: 'OPNsense' },
  { category: 'Networking', refs: ['pfsense'], filename: 'pfsense.svg', label: 'pfSense' },
  { category: 'Networking', refs: ['nginx-proxy-manager'], filename: 'npm.svg', label: 'Nginx Proxy Manager' },
  { category: 'Networking', refs: ['traefik'], filename: 'traefik.svg', label: 'Traefik' },
  { category: 'Networking', refs: ['haproxy'], filename: 'haproxy.svg', label: 'HAProxy' },
  { category: 'Networking', refs: ['cloudflare'], filename: 'cloudflare.svg', label: 'Cloudflare' },
  { category: 'Networking', refs: ['tailscale'], filename: 'tailscale.svg', label: 'Tailscale' },
  { category: 'Networking', refs: ['wireguard'], filename: 'wireguard.svg', label: 'WireGuard' },
];
