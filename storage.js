// Fonctions de stockage local
export function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
export function loadData(key) {
  return JSON.parse(localStorage.getItem(key) || 'null');
}
