/**
 * T1004 — Server-owned feature identity.
 *
 * Proves that policy selection cannot be driven by a client/page/prompt string,
 * that conflicting registrations fail, and that no Scene-specific product
 * branch exists in the Common Core compliance package.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ComplianceFeatureRegistrationError,
  ComplianceFeatureRegistry,
  createServerFeatureDescriptor,
  type ComplianceFeatureRegistration,
} from '@xiaoshuyin/compliance';

const REGISTRATION: ComplianceFeatureRegistration = {
  featureCode: 'TEST_CAPABILITY_CORE',
  featureContractRevision: 'v1',
  capabilityLabel: 'Test capability',
};

function registryWith(
  registrations: readonly ComplianceFeatureRegistration[]
): ComplianceFeatureRegistry {
  return new ComplianceFeatureRegistry(registrations);
}

describe('server-owned compliance feature identity', () => {
  it('resolves a registered identity exactly', () => {
    const registry = registryWith([REGISTRATION]);
    const resolved = registry.resolve({
      featureCode: 'TEST_CAPABILITY_CORE',
      featureContractRevision: 'v1',
    });

    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.descriptor.featureCode).toBe('TEST_CAPABILITY_CORE');
      expect(resolved.descriptor.featureContractRevision).toBe('v1');
      expect(Object.isFrozen(resolved.descriptor)).toBe(true);
    }
  });

  it('rejects an unregistered client string as COMPLIANCE_FEATURE_UNKNOWN', () => {
    const registry = registryWith([REGISTRATION]);
    const resolved = registry.resolve({
      featureCode: 'CLIENT_SUPPLIED_PAGE_NAME',
      featureContractRevision: 'v1',
    });

    expect(resolved).toEqual({
      ok: false,
      reasonCode: 'COMPLIANCE_FEATURE_UNKNOWN',
    });
  });

  it('rejects a mismatched revision as COMPLIANCE_FEATURE_REVISION_STALE (no fallback)', () => {
    const registry = registryWith([REGISTRATION]);
    const resolved = registry.resolve({
      featureCode: 'TEST_CAPABILITY_CORE',
      featureContractRevision: 'v0',
    });

    expect(resolved).toEqual({
      ok: false,
      reasonCode: 'COMPLIANCE_FEATURE_REVISION_STALE',
    });
  });

  it('rejects malformed identity shapes as unknown', () => {
    const registry = registryWith([REGISTRATION]);
    for (const candidate of [
      { featureCode: 'lowercase_code', featureContractRevision: 'v1' },
      { featureCode: 'HAS SPACE', featureContractRevision: 'v1' },
      { featureCode: '', featureContractRevision: 'v1' },
      { featureCode: 'TEST_CAPABILITY_CORE', featureContractRevision: 'V1 UPPER' },
    ]) {
      expect(registry.resolve(candidate).ok).toBe(false);
    }
  });

  it('rejects two conflicting current revisions for the same code', () => {
    expect(() =>
      registryWith([
        REGISTRATION,
        { ...REGISTRATION, featureContractRevision: 'v2', capabilityLabel: 'Conflict' },
      ])
    ).toThrowError(ComplianceFeatureRegistrationError);

    try {
      registryWith([
        REGISTRATION,
        { ...REGISTRATION, featureContractRevision: 'v2', capabilityLabel: 'Conflict' },
      ]);
    } catch (error) {
      expect((error as ComplianceFeatureRegistrationError).code).toBe(
        'COMPLIANCE_FEATURE_REGISTRATION_CONFLICT'
      );
    }
  });

  it('accepts duplicate identical registrations without creating a second identity', () => {
    const registry = registryWith([REGISTRATION, { ...REGISTRATION }]);
    expect(registry.listRegisteredCodes()).toEqual(['TEST_CAPABILITY_CORE']);
    expect(registry.resolve({ featureCode: 'TEST_CAPABILITY_CORE', featureContractRevision: 'v1' }).ok).toBe(
      true
    );
  });

  it('rejects an invalid server registration', () => {
    expect(() =>
      createServerFeatureDescriptor({
        featureCode: 'bad code',
        featureContractRevision: 'v1',
        capabilityLabel: 'bad',
      })
    ).toThrowError(ComplianceFeatureRegistrationError);
  });

  it('contains no Scene-specific / Digital Use product branch in Common Core', () => {
    const sourceDir = join(process.cwd(), 'packages', 'compliance', 'src');
    const files = readdirSync(sourceDir).filter((name) => name.endsWith('.ts'));
    const branchPattern = /===\s*['"](?:A4003|DIGITAL_USE_[A-Z0-9_]*)['"]/;
    const sceneLiteralPattern = /\bA4003\b|\bDIGITAL_USE_[A-Z0-9_]+\b/;

    for (const file of files) {
      const content = readFileSync(join(sourceDir, file), 'utf-8');
      const codeLines = content
        .split('\n')
        .filter((line) => {
          const trimmed = line.trim();
          return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
        });
      const code = codeLines.join('\n');
      expect(branchPattern.test(code), `${file} must not branch on a Scene feature literal`).toBe(
        false
      );
      // Comments may explain the prohibition; executable code may not contain
      // a Scene/Digital-Use literal at all.
      const executableLiterals = code.match(sceneLiteralPattern);
      expect(executableLiterals, `${file} contains a Scene literal`).toBeNull();
    }
  });
});