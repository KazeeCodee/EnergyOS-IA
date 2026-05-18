import assert from 'node:assert/strict';
import { extractBearerToken } from './src/api/auth.js';

assert.equal(extractBearerToken(undefined), null);
assert.equal(extractBearerToken(''), null);
assert.equal(extractBearerToken('Basic abc'), null);
assert.equal(extractBearerToken('Bearer token-123'), 'token-123');
assert.equal(extractBearerToken('bearer token-456'), 'token-456');

console.log('auth helper tests passed');
