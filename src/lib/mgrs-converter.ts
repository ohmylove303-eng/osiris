/**
 * OSIRIS — MGRS (Military Grid Reference System) & UTM Coordinate Converter
 * Standard NATO / US DoD / ROK Armed Forces Land Navigation & Targeting Format
 * 
 * Provides 10-digit 1-meter precision MGRS grid conversion for any Lat/Lng coordinates.
 */

const NUM_LETTERS = "CDEFGHJKLMNPQRSTUVWX";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SET_ORIGIN_COLUMN_LETTERS = ["AJ", "SA", "JS"];
const SET_ORIGIN_ROW_LETTERS = ["A", "F"];

// WGS84 Ellipsoid Constants
const A = 6378137.0; // semi-major axis
const F = 1 / 298.257223563; // flattening
const E2 = 2 * F - F * F; // first eccentricity squared
const E2_PRIME = E2 / (1 - E2);
const K0 = 0.9996; // UTM scale factor

export function latLngToUTM(lat: number, lng: number): { zone: number; band: string; easting: number; northing: number; utmString: string } {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  // Determine Zone Number
  let zone = Math.floor((lng + 180) / 6) + 1;
  if (lat >= 56.0 && lat < 64.0 && lng >= 3.0 && lng < 12.0) zone = 32;

  // Special zones for Svalbard
  if (lat >= 72.0 && lat < 84.0) {
    if (lng >= 0.0 && lng < 9.0) zone = 31;
    else if (lng >= 9.0 && lng < 21.0) zone = 33;
    else if (lng >= 21.0 && lng < 33.0) zone = 35;
    else if (lng >= 33.0 && lng < 42.0) zone = 37;
  }

  const lng0 = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180); // Central meridian

  // Latitude Band Letter
  let bandIndex = Math.floor((lat + 80) / 8);
  if (bandIndex < 0) bandIndex = 0;
  if (bandIndex >= NUM_LETTERS.length) bandIndex = NUM_LETTERS.length - 1;
  const band = NUM_LETTERS.charAt(bandIndex);

  const N = A / Math.sqrt(1 - E2 * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = E2_PRIME * Math.cos(latRad) * Math.cos(latRad);
  const A_val = Math.cos(latRad) * (lngRad - lng0);

  const M = A * (
    (1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 * E2 * E2) / 256) * latRad -
    ((3 * E2) / 8 + (3 * E2 * E2) / 32 + (45 * E2 * E2 * E2) / 1024) * Math.sin(2 * latRad) +
    ((15 * E2 * E2) / 256 + (45 * E2 * E2 * E2) / 1024) * Math.sin(4 * latRad) -
    ((35 * E2 * E2 * E2) / 3072) * Math.sin(6 * latRad)
  );

  let easting = K0 * N * (
    A_val +
    ((1 - T + C) * Math.pow(A_val, 3)) / 6 +
    ((5 - 18 * T + T * T + 72 * C - 58 * E2_PRIME) * Math.pow(A_val, 5)) / 120
  ) + 500000.0;

  let northing = K0 * (
    M +
    N * Math.tan(latRad) * (
      (A_val * A_val) / 2 +
      ((5 - T + 9 * C + 4 * C * C) * Math.pow(A_val, 4)) / 24 +
      ((61 - 58 * T + T * T + 600 * C - 330 * E2_PRIME) * Math.pow(A_val, 6)) / 720
    )
  );

  if (lat < 0) northing += 10000000.0; // False northing for southern hemisphere

  const roundEasting = Math.round(easting);
  const roundNorthing = Math.round(northing);

  return {
    zone,
    band,
    easting: roundEasting,
    northing: roundNorthing,
    utmString: `${zone}${band} ${roundEasting}mE ${roundNorthing}mN`,
  };
}

export function latLngToMGRS(lat: number, lng: number): string {
  const utm = latLngToUTM(lat, lng);
  const { zone, band, easting, northing } = utm;

  // 100km Grid Square Column Letter
  const set = (zone - 1) % 3;
  const colIndex = Math.floor(easting / 100000) - 1;
  const colLetter = get100kColumnLetter(set, colIndex);

  // 100km Grid Square Row Letter
  const rowIndex = Math.floor((northing % 2000000) / 100000);
  const rowLetter = get100kRowLetter(set, rowIndex);

  // 5-digit easting and northing offsets (1-meter precision)
  const eVal = Math.floor(easting % 100000).toString().padStart(5, '0');
  const nVal = Math.floor(northing % 100000).toString().padStart(5, '0');

  return `${zone}${band} ${colLetter}${rowLetter} ${eVal} ${nVal}`;
}

function get100kColumnLetter(set: number, colIndex: number): string {
  // Letters I and O skipped
  const validLetters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const startCol = set === 0 ? 0 : set === 1 ? 8 : 16;
  const index = (startCol + colIndex) % 24;
  return validLetters.charAt(index);
}

function get100kRowLetter(set: number, rowIndex: number): string {
  const validLetters = "ABCDEFGHJKLMNPQRSTUV";
  const startRow = set % 2 === 0 ? 0 : 5;
  const index = (startRow + rowIndex) % 20;
  return validLetters.charAt(index);
}

export function formatMilitaryCoordinates(lat: number, lng: number): {
  mgrs: string;
  utm: string;
  latLng: string;
  mgrsFormatted: string;
} {
  const mgrs = latLngToMGRS(lat, lng);
  const utm = latLngToUTM(lat, lng);
  const latStr = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`;

  return {
    mgrs,
    utm: utm.utmString,
    latLng: `${latStr}, ${lngStr}`,
    mgrsFormatted: `MGRS: ${mgrs} (NATO 10-Digit / 1m Precision)`,
  };
}
