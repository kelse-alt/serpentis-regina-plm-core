// Display conversions only: the approved house record always remains in inches.
export function formatMeasurementInUnit(valueInches, unit = 'in', signed = false) {
  if (unit !== 'in' && unit !== 'cm') throw new RangeError('Unsupported measurement unit');
  if (valueInches === null) return '—';
  if (typeof valueInches !== 'number' || !Number.isFinite(valueInches)) {
    throw new TypeError('Measurement must be a finite number or null');
  }
  const converted = valueInches * (unit === 'cm' ? 2.54 : 1);
  const rounded = Number(converted.toFixed(6));
  // Converting the canonical value afresh avoids rounding drift on unit switches.
  return signed && rounded > 0 ? '+' + rounded : String(rounded === 0 ? 0 : rounded);
}
