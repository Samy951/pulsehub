import { parseArgs } from 'node:util';
import type { FaultRates, StopFault } from './faults.ts';

export interface SimulatorConfig {
  devices: number;
  rateHz: number;
  host: string;
  port: number;
  faults: FaultRates;
  stop: StopFault;
}

// Every simulator parameter lives here, with its default; any of them can be overridden on the command line
const OPTIONS = {
  devices: { type: 'string', default: '50' },
  rate: { type: 'string', default: '20' },
  host: { type: 'string', default: '127.0.0.1' },
  port: { type: 'string', default: '9000' },
  'bad-checksum': { type: 'string', default: '0' },
  duplicate: { type: 'string', default: '0' },
  reorder: { type: 'string', default: '0' },
  anomaly: { type: 'string', default: '0' },
  stop: { type: 'string', default: '0' },
  'stop-after': { type: 'string', default: '10' },
} as const;

function toNumber(name: string, raw: string, min: number, max: number): number {
  const value = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`--${name} must be a number between ${min} and ${max} (got "${raw}")`);
  }
  return value;
}

function toInteger(name: string, raw: string, min: number, max: number): number {
  const value = toNumber(name, raw, min, max);
  if (!Number.isInteger(value)) throw new Error(`--${name} must be a whole number (got "${raw}")`);
  return value;
}

// Throws on unknown options or out-of-range values, so a typo never silently runs the default
export function parseSimulatorConfig(args: string[]): SimulatorConfig {
  const { values } = parseArgs({ args, options: OPTIONS, strict: true });

  return {
    devices: toInteger('devices', values.devices, 1, 65_535),
    rateHz: toNumber('rate', values.rate, 0.1, 1000),
    host: values.host,
    port: toInteger('port', values.port, 1, 65_535),
    faults: {
      badChecksum: toNumber('bad-checksum', values['bad-checksum'], 0, 1),
      duplicate: toNumber('duplicate', values.duplicate, 0, 1),
      reorder: toNumber('reorder', values.reorder, 0, 1),
      anomaly: toNumber('anomaly', values.anomaly, 0, 1),
    },
    stop: {
      devices: toInteger('stop', values.stop, 0, 65_535),
      afterMs: toNumber('stop-after', values['stop-after'], 0, 86_400) * 1000,
    },
  };
}
