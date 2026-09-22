import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { resolveApiBaseUrl } from './api-url';

test('production defaults to the same-origin API, never the visitor localhost', () => {
  assert.equal(resolveApiBaseUrl(undefined, 'production'), '/api');
});

test('development and unit tests preserve the existing local backend default', () => {
  for (const environment of ['development', 'test', undefined]) {
    assert.equal(resolveApiBaseUrl(undefined, environment), 'http://localhost:3001/api');
  }
});

test('explicit local production and isolated E2E API URLs remain supported', () => {
  for (const port of [3001, 3101]) {
    const configured = `http://localhost:${port}/api`;
    assert.equal(resolveApiBaseUrl(configured, 'production'), configured);
  }
  assert.equal(resolveApiBaseUrl('http://127.0.0.1:3101/api', 'test'), 'http://127.0.0.1:3101/api');
  assert.equal(resolveApiBaseUrl('http://[::1]:3101/api', 'test'), 'http://[::1]:3101/api');
});

test('an explicit same-origin path works in every environment', () => {
  for (const environment of ['production', 'development', 'test']) {
    assert.equal(resolveApiBaseUrl('/api', environment), '/api');
    assert.equal(resolveApiBaseUrl('/clinicview/api', environment), '/clinicview/api');
  }
});

test('normalizes trailing slashes and outer whitespace without duplicate separators', () => {
  assert.equal(resolveApiBaseUrl(' /api/// ', 'production'), '/api');
  assert.equal(resolveApiBaseUrl(' https://api.example.test/api/ ', 'production'), 'https://api.example.test/api');
  assert.equal(resolveApiBaseUrl('https://api.example.test/', 'production'), 'https://api.example.test');
});

test('accepts explicit HTTPS origins and preserves non-default ports', () => {
  assert.equal(resolveApiBaseUrl('https://api.example.test:8443/api', 'production'), 'https://api.example.test:8443/api');
});

test('rejects a present but empty value instead of silently changing its destination', () => {
  for (const value of ['', ' ', '\t\n']) {
    assert.throws(() => resolveApiBaseUrl(value, 'production'), /NEXT_PUBLIC_API_URL/);
    assert.throws(() => resolveApiBaseUrl(value, 'development'), /NEXT_PUBLIC_API_URL/);
  }
});

test('rejects relative and protocol-relative destinations', () => {
  for (const value of ['api', './api', '../api', '//other.example/api', '///other.example/api', '/', '////']) {
    assert.throws(() => resolveApiBaseUrl(value, 'production'), /NEXT_PUBLIC_API_URL/);
  }
});

test('rejects malformed URLs, unsupported schemes and ambiguous backslashes', () => {
  for (const value of ['http://', 'https:/api.example.test', 'https:///api.example.test/api', 'ftp://api.example.test/api', 'javascript:alert(1)', 'data:text/plain,api', 'https://api.example.test\\api', '/\\other.example/api']) {
    assert.throws(() => resolveApiBaseUrl(value, 'production'), /NEXT_PUBLIC_API_URL/);
  }
});

test('rejects credentials without exposing the configuration in the error', () => {
  const configured = 'https://synthetic-user:DO_NOT_ECHO@api.example.test/api';
  assert.throws(() => resolveApiBaseUrl(configured, 'production'), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /NEXT_PUBLIC_API_URL/);
    assert.ok(!error.message.includes('DO_NOT_ECHO'));
    assert.ok(!error.message.includes('synthetic-user'));
    return true;
  });
});

test('rejects query strings and fragments, including empty delimiters', () => {
  for (const value of ['/api?key=not-a-secret', '/api#section', '/api?', '/api#', 'https://api.example.test/api?debug=1', 'https://api.example.test/api#']) {
    assert.throws(() => resolveApiBaseUrl(value, 'production'), /NEXT_PUBLIC_API_URL/);
  }
});

test('rejects embedded whitespace or control characters instead of letting URL remove them', () => {
  for (const value of ['/api path', '/ap\ti', '/ap\ni', '/api\u0000x', '/api\u007fx', 'https://api.example.test/ap\ri']) {
    assert.throws(() => resolveApiBaseUrl(value, 'production'), /NEXT_PUBLIC_API_URL/);
  }
});
