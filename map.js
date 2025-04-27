// Fonctions de géocodage et carte Leaflet
export function geocodePromise(address) {
  return fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
    .then(r => r.json())
    .then(data => data && data[0] ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null)
    .catch(() => null);
}

export function geocode(address, cb) {
  geocodePromise(address).then(cb);
}

export function createMap(elementId, center, zoom) {
  return L.map(elementId).setView(center, zoom);
}

export function addTileLayer(map) {
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);
}
