// Shared by every configuration source (CLI flags, environment variables): a bad value fails loudly, naming its setting
export function parseNumber(name: string, raw: string, min: number, max: number): number {
  const value = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a number between ${min} and ${max} (got "${raw}")`);
  }
  return value;
}

export function parseInteger(name: string, raw: string, min: number, max: number): number {
  const value = parseNumber(name, raw, min, max);
  if (!Number.isInteger(value)) throw new Error(`${name} must be a whole number (got "${raw}")`);
  return value;
}
