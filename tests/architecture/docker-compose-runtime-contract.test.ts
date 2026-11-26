/**
 * Finding #19 / N-1 — Stage A Compose must satisfy the real runtime contract.
 *
 * The audited defect was that `docker-compose.stage-a.yml` declared an `api`
 * service while passing only part of the environment required by
 * `loadRuntimeConfig()`, so the container died on the first missing secret with
 * `RUNTIME_ENV_INVALID` instead of serving `/healthz`.
 *
 * This test does not hard-code a list of variable names. It drives the real
 * `loadRuntimeConfig()` against the environment Compose actually declares and
 * lets the validator itself reveal the required set, so a newly required
 * variable cannot be added to the runtime contract without Compose being
 * updated in the same change.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadRuntimeConfig } from '../../apps/server/api/src/runtime-env.js';

const COMPOSE_PATH = 'docker-compose.stage-a.yml';
const SERVICE = 'api';

/** Compose-level fixtures for values interpolated into other values. */
const COMPOSE_FIXTURES: Record<string, string> = {
  POSTGRES_SUPERUSER_PASSWORD: 'compose-superuser-fixture',
  POSTGRES_MIGRATOR_PASSWORD: 'compose-migrator-fixture',
  POSTGRES_APP_PASSWORD: 'compose-app-fixture',
};

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

/**
 * Extract the lines belonging to one top-level Compose service.
 * Fails closed: a missing `services:` block or missing service is an error, not
 * an empty result, so a renamed service cannot silently pass this guard.
 */
function serviceBlockLines(lines: readonly string[], service: string): string[] {
  const servicesIndex = lines.findIndex((line) => /^services:\s*$/.test(line));
  if (servicesIndex < 0) {
    throw new Error(`compose: top-level "services:" block not found in ${COMPOSE_PATH}`);
  }

  const serviceIndent = 2;
  const matcher = new RegExp(`^${service}:\\s*$`);
  let start = -1;
  for (let i = servicesIndex + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (indentOf(line) === 0) break;
    if (indentOf(line) === serviceIndent && matcher.test(trimmed)) {
      start = i;
      break;
    }
  }
  if (start < 0) {
    throw new Error(`compose: service "${service}" not found at indent ${serviceIndent}`);
  }

  const block: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (!line.trim()) {
      block.push(line);
      continue;
    }
    if (indentOf(line) <= serviceIndent) break;
    block.push(line);
  }
  return block;
}

/** Parse the `environment:` mapping/list of a service into a key -> raw value map. */
function parseServiceEnvironment(block: readonly string[], service: string): Map<string, string> {
  const envIndex = block.findIndex((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return false;
    return /^environment:\s*$/.test(trimmed);
  });
  if (envIndex < 0) {
    throw new Error(`compose: service "${service}" declares no environment: mapping`);
  }

  const envIndent = indentOf(block[envIndex] ?? '');
  const entries = new Map<string, string>();

  for (let i = envIndex + 1; i < block.length; i += 1) {
    const line = block[i] ?? '';
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (indentOf(line) <= envIndent) break;

    if (trimmed.startsWith('- ')) {
      const pair = trimmed.slice(2).trim();
      const separator = pair.indexOf('=');
      if (separator < 0) {
        throw new Error(`compose: unsupported list environment entry "${pair}"`);
      }
      entries.set(unquote(pair.slice(0, separator)), unquote(pair.slice(separator + 1)));
      continue;
    }

    const separator = trimmed.indexOf(':');
    if (separator < 0) {
      throw new Error(`compose: unsupported environment entry "${trimmed}"`);
    }
    const key = unquote(trimmed.slice(0, separator));
    entries.set(key, unquote(trimmed.slice(separator + 1)));
  }

  if (entries.size === 0) {
    throw new Error(`compose: service "${service}" environment: mapping is empty`);
  }
  return entries;
}

const PLACEHOLDER = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::?-([^}]*))?\}/g;

function interpolate(raw: string, lookup: (name: string) => string | undefined): string {
  return raw.replace(PLACEHOLDER, (_match, name: string, fallback: string | undefined) => {
    const value = lookup(name);
    if (value !== undefined) return value;
    return fallback ?? '';
  });
}

function fixtureValue(key: string): string {
  // TTL variables are validated as positive integers; every other required
  // variable is a non-blank string with a minimum length.
  return key.endsWith('_TTL_SECONDS') ? '600' : 'x'.repeat(64);
}

function apiEnvironment(): Map<string, string> {
  const compose = readFileSync(COMPOSE_PATH, 'utf8');
  return parseServiceEnvironment(serviceBlockLines(compose.split(/\r?\n/), SERVICE), SERVICE);
}

interface ContractResult {
  /** Keys the runtime contract rejected until Compose supplied them. */
  satisfiedKeys: string[];
}

/**
 * Prove that the Compose-declared environment alone satisfies
 * `loadRuntimeConfig()`. Each RUNTIME_ENV_INVALID response names the first
 * unsatisfied variable; if Compose does not provide it, that is the defect.
 */
function assertComposeSatisfiesRuntimeContract(): ContractResult {
  const composeEnv = apiEnvironment();
  const fixtures = new Map<string, string>(Object.entries(COMPOSE_FIXTURES));
  const satisfiedKeys: string[] = [];
  const attempted = new Set<string>();
  const MAX_ITERATIONS = 64;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const env: NodeJS.ProcessEnv = {};
    for (const [key, raw] of composeEnv) {
      env[key] = interpolate(raw, (name) => fixtures.get(name));
    }

    try {
      loadRuntimeConfig(env);
      return { satisfiedKeys };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const named = /RUNTIME_ENV_INVALID: ([A-Z0-9_]+)/.exec(message);
      if (!named) throw error;

      const key = named[1] as string;
      if (!composeEnv.has(key)) {
        throw new Error(
          `compose service "${SERVICE}" does not provide required runtime variable ${key}: ${message}`
        );
      }
      if (attempted.has(key)) {
        throw new Error(
          `compose service "${SERVICE}" declares ${key} but the value is rejected by the runtime contract: ${message}`
        );
      }

      attempted.add(key);
      satisfiedKeys.push(key);
      fixtures.set(key, fixtureValue(key));
    }
  }

  throw new Error(
    `runtime contract did not converge after ${MAX_ITERATIONS} iterations; last keys: ${satisfiedKeys.join(', ')}`
  );
}

describe('Finding #19 N-1 — Stage A Compose satisfies the runtime contract', () => {
  it('declares an api service with a parseable environment mapping', () => {
    const env = apiEnvironment();
    expect(env.size).toBeGreaterThan(0);
    expect(env.has('DATABASE_URL')).toBe(true);
  });

  it('supplies every variable required by loadRuntimeConfig()', () => {
    // Throws with a named variable if any required key is absent from Compose.
    expect(() => assertComposeSatisfiesRuntimeContract()).not.toThrow();
  });

  it('supplies the identity-binding and participation runtime variables audited in Finding #19', () => {
    const env = apiEnvironment();
    for (const key of [
      'IDENTITY_BINDING_SECRET',
      'IDENTITY_BINDING_CONTEXT_TTL_SECONDS',
      'IDENTITY_BINDING_ATTEMPT_TTL_SECONDS',
      'IDENTITY_BINDING_PAIRING_TTL_SECONDS',
      'PARTICIPATION_INVITE_TTL_SECONDS',
      'PARTICIPATION_INVITE_TOKEN_SECRET',
    ]) {
      expect(env.has(key), `api service must pass ${key}`).toBe(true);
    }
  });

  it('never invents a fallback value for a Compose-provided variable', () => {
    const env = apiEnvironment();
    const withDefaults = [...env.entries()]
      .filter(([, raw]) => /\$\{[A-Za-z_][A-Za-z0-9_]*:?-[^}]*\}/.test(raw))
      .map(([key, raw]) => `${key}=${raw}`);

    // A `:-`/`-` fallback would let an unconfigured deployment start with a
    // repository-controlled secret or TTL instead of failing closed.
    expect(withDefaults).toEqual([]);
  });
});
