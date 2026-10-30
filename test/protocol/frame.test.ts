import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xorChecksum } from '../../src/protocol/frame.ts';

// Example frame from the spec (HEARTBEAT, device 7, seq 1, uptime 1000 ms), without its checksum
const SPEC_HEARTBEAT_BODY = Buffer.from('50480102000700000001000003e800', 'hex');

test('xorChecksum de la trame exemple du sujet vaut 0xF6', () => {
  assert.equal(xorChecksum(SPEC_HEARTBEAT_BODY), 0xf6);
});
