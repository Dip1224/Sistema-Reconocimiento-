let zoneState = {
  center: { lat: 0, lng: 0 },
  radius: 100
};

export function getZone() {
  return zoneState;
}

export function setZone(newState) {
  zoneState = newState;
}
