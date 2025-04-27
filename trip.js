import { loadData, saveData } from './storage.js';

export function getTrips() {
  return loadData('trips') || [];
}
export function addTrip(trip) {
  const trips = getTrips();
  trips.push(trip);
  saveData('trips', trips);
}
export function getUserTrips(email) {
  return getTrips().filter(t => t.userEmail === email);
}
