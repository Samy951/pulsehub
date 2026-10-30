import { parseInteger, parseNumber } from '../shared/parse-number.ts';

export interface HubConfig {
  udpPort: number;
  httpPort: number;
  refreshMs: number;
  silentAfterMs: number;
  hotTemperature: number; // hundredths of °C, the protocol unit
}

// Every hub parameter with its default; override any of them through the environment or a .env file
const DEFAULTS = {
  PULSEHUB_UDP_PORT: '9000',
  PULSEHUB_HTTP_PORT: '8080',
  PULSEHUB_REFRESH_MS: '500',
  PULSEHUB_SILENT_AFTER_MS: '2000',
  PULSEHUB_HOT_CELSIUS: '70',
} as const;

type Setting = keyof typeof DEFAULTS;

export function loadHubConfig(env: Partial<Record<string, string>>): HubConfig {
  const read = (name: Setting): string => env[name] ?? DEFAULTS[name];

  return {
    udpPort: parseInteger('PULSEHUB_UDP_PORT', read('PULSEHUB_UDP_PORT'), 1, 65_535),
    httpPort: parseInteger('PULSEHUB_HTTP_PORT', read('PULSEHUB_HTTP_PORT'), 1, 65_535),
    refreshMs: parseInteger('PULSEHUB_REFRESH_MS', read('PULSEHUB_REFRESH_MS'), 50, 60_000),
    silentAfterMs: parseInteger('PULSEHUB_SILENT_AFTER_MS', read('PULSEHUB_SILENT_AFTER_MS'), 100, 3_600_000),
    hotTemperature: Math.round(parseNumber('PULSEHUB_HOT_CELSIUS', read('PULSEHUB_HOT_CELSIUS'), -50, 300) * 100),
  };
}
