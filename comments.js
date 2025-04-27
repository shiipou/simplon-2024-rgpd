import { loadData, saveData } from './storage.js';

export function getComments() {
  return loadData('comments') || [];
}
export function addComment(comment) {
  const comments = getComments();
  comments.push(comment);
  saveData('comments', comments);
}
export function getUserComments(email) {
  return getComments().filter(c => c.targetEmail === email);
}
