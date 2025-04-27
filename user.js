import { loadData, saveData } from './storage.js';

export function getCurrentUser() {
  return loadData('currentUser');
}
export function setCurrentUser(user) {
  saveData('currentUser', user);
}
export function logout() {
  localStorage.removeItem('currentUser');
}
export function getUsers() {
  return loadData('users') || [];
}
export function addUser(user) {
  const users = getUsers();
  const idx = users.findIndex(u => u.email === user.email);
  if (idx !== -1) {
    users[idx] = user;
  } else {
    users.push(user);
  }
  saveData('users', users);
}
export function findUserByEmail(email) {
  return getUsers().find(u => u.email === email);
}
