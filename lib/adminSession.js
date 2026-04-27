let adminSessionActive = false;
let adminAccessIntroPlayed = false;
let adminAccessExiting = false;

export function getAdminSession() {
  return adminSessionActive;
}

export function setAdminSession(value) {
  adminSessionActive = value;
  adminAccessExiting = false;
  adminAccessIntroPlayed = false;
  window.dispatchEvent(new Event("mint-lane-admin-session-updated"));
}

export function getAdminAccessExiting() {
  return adminAccessExiting;
}

export function startAdminAccessExit() {
  adminAccessExiting = true;
  window.dispatchEvent(new Event("mint-lane-admin-session-updated"));
}

export function getAdminAccessIntroPlayed() {
  return adminAccessIntroPlayed;
}

export function markAdminAccessIntroPlayed() {
  adminAccessIntroPlayed = true;
}
