import { parseArgs } from 'node:util';
import { parseInteger, parseNumber } from '../shared/parse-number.ts';
import type { FaultRates, StopFault } from './faults.ts';

export interface SimulatorConfig {
  devices: number;
  firstId: number;
  rateHz: number;
  host: string;
  port: number;
  faults: FaultRates;
  stop: StopFault;
  overheat: number;
}

// Every simulator parameter lives here, with its default; any of them can be overridden on the command line
const OPTIONS = {
  devices: { type: 'string', default: '50' },
  'first-id': { type: 'string', default: '1' },
  rate: { type: 'string', default: '20' },
  host: { type: 'string', default: '127.0.0.1' },
  port: { type: 'string', default: '9000' },
  'bad-checksum': { type: 'string', default: '0' },
  duplicate: { type: 'string', default: '0' },
  reorder: { type: 'string', default: '0' },
  anomaly: { type: 'string', default: '0' },
  stop: { type: 'string', default: '0' },
  'stop-after': { type: 'string', default: '10' },
  overheat: { type: 'string', default: '0' },
} as const;

// Throws on unknown options or out-of-range values, so a typo never silently runs the default
export function parseSimulatorConfig(args: string[]): SimulatorConfig {
  const { values } = parseArgs({ args, options: OPTIONS, strict: true });
  const devices = parseInteger('--devices', values.devices, 1, 65_535);
  const firstId = parseInteger('--first-id', values['first-id'], 1, 65_535);
  // deviceId is a uint16: several simulators can run side by side as long as their id ranges fit and do not overlap
  if (firstId + devices - 1 > 65_535) throw new Error('--first-id and --devices go past device id 65535');

  return {
    devices,
    firstId,
    rateHz: parseNumber('--rate', values.rate, 0.1, 1000),
    host: values.host,
    port: parseInteger('--port', values.port, 1, 65_535),
    faults: {
      badChecksum: parseNumber('--bad-checksum', values['bad-checksum'], 0, 1),
      duplicate: parseNumber('--duplicate', values.duplicate, 0, 1),
      reorder: parseNumber('--reorder', values.reorder, 0, 1),
      anomaly: parseNumber('--anomaly', values.anomaly, 0, 1),
    },
    stop: {
      devices: parseInteger('--stop', values.stop, 0, 65_535),
      afterMs: parseNumber('--stop-after', values['stop-after'], 0, 86_400) * 1000,
    },
    overheat: parseInteger('--overheat', values.overheat, 0, 65_535),
  };
}
