// The owner's address comes from the server configuration, never from the code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';

const { isOwnerEmail, requireOwner } = await tsImport('../lib/access.ts', import.meta.url);
const request = email =>
  new Request('https://poetio.cloud/api/poems', email ? { headers: { 'oai-authenticated-user-email': email } } : {});

test('without POETIO_OWNER_EMAIL nobody is the owner', () => {
  delete process.env.POETIO_OWNER_EMAIL;
  assert.equal(isOwnerEmail('owner@example.test'), false);
  assert.equal(isOwnerEmail(''), false);
  assert.equal(isOwnerEmail(undefined), false);
  process.env.POETIO_OWNER_EMAIL = '   ';
  assert.equal(isOwnerEmail(''), false);
  assert.throws(() => requireOwner(request('owner@example.test')), { status: 403 });
  delete process.env.POETIO_OWNER_EMAIL;
});

test('the configured address matches regardless of case and surrounding spaces', () => {
  process.env.POETIO_OWNER_EMAIL = ' Owner@Example.Test ';
  assert.equal(isOwnerEmail('owner@example.test'), true);
  assert.equal(isOwnerEmail(' OWNER@example.test'), true);
  assert.equal(isOwnerEmail('other@example.test'), false);
  assert.doesNotThrow(() => requireOwner(request('owner@example.test')));
  assert.throws(() => requireOwner(request('other@example.test')), { status: 403 });
  assert.throws(() => requireOwner(request()), { status: 401 });
  delete process.env.POETIO_OWNER_EMAIL;
});
