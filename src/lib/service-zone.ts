export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export function isValidGeoPoint(point: GeoPoint): boolean {
  return Number.isFinite(point.latitude)
    && Number.isFinite(point.longitude)
    && point.latitude >= -90
    && point.latitude <= 90
    && point.longitude >= -180
    && point.longitude <= 180;
}

/** Great-circle distance in kilometres using the mean Earth radius. */
export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const latitude1 = radians(from.latitude);
  const latitude2 = radians(to.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  const bounded = Math.min(1, Math.max(0, haversine));
  return 6371.0088 * 2 * Math.asin(Math.sqrt(bounded));
}

export function isWithinServiceRadius(
  destination: GeoPoint,
  center: GeoPoint,
  radiusKm: number,
): boolean {
  if (!isValidGeoPoint(destination) || !isValidGeoPoint(center)) return false;
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 100) return false;
  return distanceKm(center, destination) <= radiusKm;
}
