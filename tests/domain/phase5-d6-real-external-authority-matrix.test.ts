/**
 * Phase 5 / D6 Targeted Evidence — Real External Authority / Content Matrix.
 *
 * Verifies the boundary between code seams and real-world external authority:
 * - Safety production authority & deterministic fail-closed behavior
 * - Professional qualification & approval external evidence binding
 * - Scene package knowledge binding & empty production baseline
 * - A4003 roleplay composite adapter availability & progression hold
 * - Zero test fixture pollution in production
 */

import { describe, expect, it } from 'vitest';
import {
  runSafetyPrecheck,
  SafetyError,
  type ApprovedPolicyIdentity,
  type ApprovedRuleEvaluation,
  type SafetyCaseSnapshot,
} from '../../packages/domain/src/safety/index.js';
import {
  hashProfessionalKnowledgeApprovalBinding,
  hashProfessionalKnowledgeContent,
  hashProfessionalKnowledgeSourceSet,
  validateProfessionalApproval,
  validateProfessionalQualification,
  type ProfessionalApprovalProof,
  type ProfessionalKnowledgeVersionSnapshot,
} from '../../packages/domain/src/professional-knowledge.js';
import {
  resolveDigitalUseProfessionalKnowledgeBinding,
  digitalUseProfessionalKnowledgePackageBindings,
} from '../../packages/scenes/digital-use/index.js';
import {
  unavailableProductionRoleplayAdapter,
  createProductionRoleplayAdapter,
  type RoleplayCapabilityContext,
  type RoleplayTurnInput,
  type RoleplayProfessionalContentAuthority,
  type RoleplayModelPromptAuthority,
} from '../../apps/server/api/src/services/digital-use-roleplay-adapter.js';
import {
  unavailableProductionProfessionalApprovalProvider,
  unavailableProductionProfessionalQualificationProvider,
} from '../../apps/server/api/src/services/professional-knowledge.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Phase 5 / D6 Targeted Security & Authority Matrix', () => {
  describe('Safety Production Authority Seam & Fail-Closed Behavior', () => {
    const TRUSTED_IDENTITY: ApprovedPolicyIdentity = Object.freeze({
      policyRef: 'policy.safety.production',
      policyVersion: '1.0.0',
      ruleRef: 'rule.safety.deterministic',
      ruleVersion: '1.0.0',
    });

    const openCase: SafetyCaseSnapshot = Object.freeze({
      caseId: 'case-d6-001',
      status: 'OPEN',
      version: 1,
    });

    it('Safety: evaluation is deterministic given identical trusted assets', () => {
      const evaluation: ApprovedRuleEvaluation = {
        outcome: 'NO_HOLD',
        ...TRUSTED_IDENTITY,
        evidenceRefs: [],
      };

      const result1 = runSafetyPrecheck({
        case: openCase,
        trustedPolicyIdentity: TRUSTED_IDENTITY,
        approvedEvaluation: evaluation,
      });

      const result2 = runSafetyPrecheck({
        case: { ...openCase },
        trustedPolicyIdentity: { ...TRUSTED_IDENTITY },
        approvedEvaluation: { ...evaluation },
      });

      expect(result1).toEqual({
        kind: 'ALLOW',
        caseId: 'case-d6-001',
        caseVersion: 1,
      });
      expect(result1).toEqual(result2);
    });

    it('Safety: missing or null evaluation fails closed with SAFETY_PRECHECK_INVALID', () => {
      expect(() =>
        runSafetyPrecheck({
          case: openCase,
          trustedPolicyIdentity: TRUSTED_IDENTITY,
          approvedEvaluation: null,
        })
      ).toThrowError(SafetyError);

      try {
        runSafetyPrecheck({
          case: openCase,
          trustedPolicyIdentity: TRUSTED_IDENTITY,
          approvedEvaluation: null,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(SafetyError);
        expect((err as SafetyError).code).toBe('SAFETY_PRECHECK_INVALID');
      }
    });

    it('Safety: policy identity drift during evaluation fails closed with SAFETY_PRECHECK_STALE', () => {
      const driftedEvaluation: ApprovedRuleEvaluation = {
        outcome: 'HOLD_REQUIRED',
        riskCategoryRef: 'RISK_HIGH',
        policyRef: TRUSTED_IDENTITY.policyRef,
        policyVersion: '2.0.0-superseded',
        ruleRef: TRUSTED_IDENTITY.ruleRef,
        ruleVersion: TRUSTED_IDENTITY.ruleVersion,
        evidenceRefs: [],
      };

      expect(() =>
        runSafetyPrecheck({
          case: openCase,
          trustedPolicyIdentity: TRUSTED_IDENTITY,
          approvedEvaluation: driftedEvaluation,
        })
      ).toThrowError(SafetyError);

      try {
        runSafetyPrecheck({
          case: openCase,
          trustedPolicyIdentity: TRUSTED_IDENTITY,
          approvedEvaluation: driftedEvaluation,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(SafetyError);
        expect((err as SafetyError).code).toBe('SAFETY_PRECHECK_STALE');
      }
    });
  });

  describe('Professional Qualification & Approval External Verification', () => {
    function createMockVersion(): ProfessionalKnowledgeVersionSnapshot {
      const sources = [
        {
          sourceRef: 'source:clinical:001',
          sourceVersion: '1.0',
          sourceHash: 'b'.repeat(64),
          locator: null,
          metadata: {},
        },
      ];
      const content = { title: 'Digital Use Boundaries', guidelines: ['screen_time_limit'] };
      return {
        id: 'ver-d6-01',
        knowledgeId: 'know-d6-01',
        knowledgeKey: 'digital_use_bounds',
        semanticVersion: '1.0.0',
        revision: 1,
        lifecycleStatus: 'CANDIDATE',
        reviewState: 'CURRENT',
        validityState: 'VALID',
        content,
        contentHash: hashProfessionalKnowledgeContent(content),
        sourceSetHash: hashProfessionalKnowledgeSourceSet(sources),
        sources,
        scope: {
          product: 'V1',
          sceneCode: 'DIGITAL_USE',
          scenePackageVersion: 'v1',
          stages: ['ASSESSMENT'],
          ageBands: ['MINOR_14_17'],
          applicability: ['routine_use'],
          exclusions: [],
          riskLevels: ['LOW'],
          locale: 'zh-CN',
        },
        releasedAt: null,
        effectiveFrom: null,
        effectiveTo: null,
      };
    }

    function createMockProof(v: ProfessionalKnowledgeVersionSnapshot): ProfessionalApprovalProof {
      const scope = {
        product: 'V1' as const,
        sceneCode: 'DIGITAL_USE',
        scenePackageVersion: 'v1',
        stages: ['ASSESSMENT'],
        ageBands: ['MINOR_14_17'] as const,
        locale: 'zh-CN',
      };
      return {
        proofId: 'proof-d6-001',
        knowledgeId: v.knowledgeId,
        semanticVersion: v.semanticVersion,
        contentHash: v.contentHash,
        sourceSetHash: v.sourceSetHash,
        semanticBindingHash: hashProfessionalKnowledgeApprovalBinding(v),
        sourceRefs: ['source:clinical:001'],
        scope,
        reviewerIdentity: 'reviewer-licensed-001',
        reviewerAccountId: 'acc-reviewer-001',
        reviewerPersonId: 'person-reviewer-001',
        staffAssignmentRef: 'assign-reviewer-001',
        staffCapability: 'PROFESSIONAL_REVIEW',
        qualificationRef: 'qual-lic-8899',
        qualificationScope: scope,
        approvalStatus: 'APPROVED',
        publicationStatus: 'EFFECTIVE',
        reviewedAt: '2026-06-01T00:00:00Z',
        effectiveFrom: '2026-06-01T00:00:00Z',
        effectiveTo: '2027-06-01T00:00:00Z',
      };
    }

    it('Qualification: production unassigned provider fails closed', async () => {
      const res = await unavailableProductionProfessionalQualificationProvider.resolve({
        qualificationRef: 'qual-any',
        reviewerIdentity: 'any',
        reviewerAccountId: 'any',
        reviewerPersonId: 'any',
        scope: {
          product: 'V1',
          sceneCode: 'DIGITAL_USE',
          scenePackageVersion: 'v1',
          stages: ['ASSESSMENT'],
          ageBands: ['MINOR_14_17'],
          locale: 'zh-CN',
        },
      });

      expect(res.status).toBe('UNAVAILABLE');
      if (res.status === 'UNAVAILABLE') {
        expect(res.reason).toBe('APPROVED PROFESSIONAL REVIEWER — UNASSIGNED');
      }
    });

    it('Qualification: expired credential fails closed as INVALID', () => {
      const scope = {
        product: 'V1' as const,
        sceneCode: 'DIGITAL_USE',
        scenePackageVersion: 'v1',
        stages: ['ASSESSMENT'],
        ageBands: ['MINOR_14_17'] as const,
        locale: 'zh-CN',
      };
      const res = validateProfessionalQualification({
        result: {
          status: 'RESOLVED',
          qualificationRef: 'qual-expired',
          reviewerIdentity: 'rev-01',
          reviewerAccountId: 'acc-01',
          reviewerPersonId: 'per-01',
          scope,
          validFrom: '2025-01-01T00:00:00Z',
          validTo: '2026-01-01T00:00:00Z',
        },
        expected: {
          qualificationRef: 'qual-expired',
          reviewerIdentity: 'rev-01',
          reviewerAccountId: 'acc-01',
          reviewerPersonId: 'per-01',
          scope,
        },
        now: new Date('2026-11-21T00:00:00Z'),
      });

      expect(res.status).toBe('INVALID');
      if (res.status === 'INVALID') {
        expect(res.reason).toBe('PROFESSIONAL_QUALIFICATION_MISMATCH');
      }
    });

    it('Qualification: scope mismatch fails closed as INVALID', () => {
      const scope = {
        product: 'V1' as const,
        sceneCode: 'DIGITAL_USE',
        scenePackageVersion: 'v1',
        stages: ['ASSESSMENT'],
        ageBands: ['MINOR_14_17'] as const,
        locale: 'zh-CN',
      };
      const res = validateProfessionalQualification({
        result: {
          status: 'RESOLVED',
          qualificationRef: 'qual-mismatch',
          reviewerIdentity: 'rev-01',
          reviewerAccountId: 'acc-01',
          reviewerPersonId: 'per-01',
          scope: { ...scope, sceneCode: 'SUBSTANCE_USE' },
          validFrom: '2026-01-01T00:00:00Z',
          validTo: '2027-01-01T00:00:00Z',
        },
        expected: {
          qualificationRef: 'qual-mismatch',
          reviewerIdentity: 'rev-01',
          reviewerAccountId: 'acc-01',
          reviewerPersonId: 'per-01',
          scope,
        },
        now: new Date('2026-06-01T00:00:00Z'),
      });

      expect(res.status).toBe('INVALID');
      if (res.status === 'INVALID') {
        expect(res.reason).toBe('PROFESSIONAL_QUALIFICATION_MISMATCH');
      }
    });

    it('Approval: production unavailable provider fails closed', async () => {
      const res = await unavailableProductionProfessionalApprovalProvider.resolve({
        knowledgeId: 'k1',
        semanticVersion: '1.0.0',
        contentHash: 'hash',
        sourceSetHash: 'hash',
      });
      expect(res.status).toBe('UNAVAILABLE');
      if (res.status === 'UNAVAILABLE') {
        expect(res.reason).toBe('PROVIDER_UNAVAILABLE');
      }
    });

    it('Approval: content drift invalidates existing approval', () => {
      const v = createMockVersion();
      const p = createMockProof(v);

      const modifiedVersion: ProfessionalKnowledgeVersionSnapshot = {
        ...v,
        content: { ...v.content, tampered: true },
        contentHash: hashProfessionalKnowledgeContent({ ...v.content, tampered: true }),
      };

      const validation = validateProfessionalApproval({
        version: modifiedVersion,
        provider: { status: 'RESOLVED', proof: p },
        staffAuthority: {
          status: 'RESOLVED',
          assignmentRef: p.staffAssignmentRef,
          accountId: p.reviewerAccountId,
          personId: p.reviewerPersonId,
          capability: 'PROFESSIONAL_REVIEW',
          scope: 'GLOBAL',
        },
        qualification: {
          status: 'RESOLVED',
          qualificationRef: p.qualificationRef,
          reviewerIdentity: p.reviewerIdentity,
          reviewerAccountId: p.reviewerAccountId,
          reviewerPersonId: p.reviewerPersonId,
          scope: p.qualificationScope,
          validFrom: p.effectiveFrom,
          validTo: p.effectiveTo,
        },
        now: new Date('2026-06-15T00:00:00Z'),
      });

      expect(validation.status).toBe('INVALID');
      if (validation.status === 'INVALID') {
        expect(validation.reason).toBe('APPROVAL_PROOF_MISMATCH');
      }
    });

    it('Approval: exact match with valid qualification and staff authority passes validation', () => {
      const v = createMockVersion();
      const p = createMockProof(v);

      const validation = validateProfessionalApproval({
        version: v,
        provider: { status: 'RESOLVED', proof: p },
        staffAuthority: {
          status: 'RESOLVED',
          assignmentRef: p.staffAssignmentRef,
          accountId: p.reviewerAccountId,
          personId: p.reviewerPersonId,
          capability: 'PROFESSIONAL_REVIEW',
          scope: 'GLOBAL',
        },
        qualification: {
          status: 'RESOLVED',
          qualificationRef: p.qualificationRef,
          reviewerIdentity: p.reviewerIdentity,
          reviewerAccountId: p.reviewerAccountId,
          reviewerPersonId: p.reviewerPersonId,
          scope: p.qualificationScope,
          validFrom: p.effectiveFrom,
          validTo: p.effectiveTo,
        },
        now: new Date('2026-06-15T00:00:00Z'),
      });

      expect(validation.status).toBe('VALID');
    });
  });

  describe('Scene Package Knowledge Binding & Empty Baseline Integrity', () => {
    it('Digital Use Scene v1 package binding resolves strictly empty knowledge refs in production', () => {
      const result = resolveDigitalUseProfessionalKnowledgeBinding('v1');
      expect(result.status).toBe('RESOLVED');
      if (result.status === 'RESOLVED') {
        expect(result.sceneCode).toBe('DIGITAL_USE');
        expect(result.scenePackageVersion).toBe('v1');
        expect(result.refs).toEqual([]);
      }
    });

    it('Package registry explicitly maintains empty professionalKnowledgeRefs', () => {
      const v1Binding = digitalUseProfessionalKnowledgePackageBindings.find(
        (b) => b.sceneCode === 'DIGITAL_USE' && b.scenePackageVersion === 'v1'
      );
      expect(v1Binding).toBeDefined();
      expect(v1Binding?.professionalKnowledgeRefs).toHaveLength(0);
    });
  });

  describe('A4003 Production Roleplay Adapter & Progression Hold', () => {
    const validContext: RoleplayCapabilityContext = {
      scenePackageVersion: 'v1',
      professionalContentVersion: '1.0.0',
      featureCode: 'DIGITAL_USE_ROLEPLAY_A4003',
      expectedModelRef: 'model.roleplay.v1',
      expectedPromptVersionRef: 'prompt.roleplay.v1',
      modelAuthorityRef: 'auth.model.approved',
      promptAuthorityRef: 'auth.prompt.approved',
    };

    const validContentAuthority: RoleplayProfessionalContentAuthority = {
      status: 'APPROVED_PUBLISHED',
      version: '1.0.0',
      authorityRef: 'auth.content.roleplay.001',
    };

    const validModelPromptAuthority: RoleplayModelPromptAuthority = {
      model: {
        status: 'CURRENT_APPROVED',
        modelRef: 'model.roleplay.v1',
        authorityRef: 'auth.model.approved',
      },
      prompt: {
        status: 'CURRENT_APPROVED',
        promptVersionRef: 'prompt.roleplay.v1',
        authorityRef: 'auth.prompt.approved',
      },
    };

    it('unavailableProductionRoleplayAdapter is permanently unavailable and fails closed', async () => {
      expect(await unavailableProductionRoleplayAdapter.isAvailable(validContext)).toBe(false);
      await expect(
        unavailableProductionRoleplayAdapter.createTurn({
          sessionId: 's1',
          roundNumber: 1,
          simulatedChildInput: 'hi',
          actorPersonId: 'p1',
          ...validContext,
        })
      ).rejects.toThrow('DOWNSTREAM_AI_UNAVAILABLE');
    });

    it('createProductionRoleplayAdapter reports available only when all 4 authorities/dependencies are valid', async () => {
      let downstreamCalled = false;
      const downstream = {
        providerRef: 'test-downstream',
        async isAvailable() {
          return true;
        },
        async executeTurn(input: RoleplayTurnInput) {
          downstreamCalled = true;
          return {
            simulatedParentOutput: 'parent response',
            adapterRef: 'test-downstream',
            modelRef: input.expectedModelRef,
            promptVersionRef: input.expectedPromptVersionRef,
          };
        },
      };

      const adapter = createProductionRoleplayAdapter({
        downstreamExecutionProvider: downstream,
        professionalContentAuthority: validContentAuthority,
        modelPromptAuthorityProvider: async () => validModelPromptAuthority,
      });

      expect(await adapter.isAvailable(validContext)).toBe(true);

      const turn = await adapter.createTurn({
        sessionId: 's1',
        roundNumber: 1,
        simulatedChildInput: 'hi',
        actorPersonId: 'p1',
        ...validContext,
      });

      expect(downstreamCalled).toBe(true);
      expect(turn.simulatedParentOutput).toBe('parent response');
    });

    it('createProductionRoleplayAdapter reports unavailable when professional content is missing', async () => {
      const adapter = createProductionRoleplayAdapter({
        downstreamExecutionProvider: {
          providerRef: 'downstream',
          async isAvailable() {
            return true;
          },
          async executeTurn() {
            throw new Error('should not be called');
          },
        },
        professionalContentAuthority: null, // missing!
        modelPromptAuthorityProvider: async () => validModelPromptAuthority,
      });

      expect(await adapter.isAvailable(validContext)).toBe(false);
      await expect(
        adapter.createTurn({
          sessionId: 's1',
          roundNumber: 1,
          simulatedChildInput: 'hi',
          actorPersonId: 'p1',
          ...validContext,
        })
      ).rejects.toThrow('DOWNSTREAM_AI_UNAVAILABLE');
    });

    it('createProductionRoleplayAdapter reports unavailable when model authority is missing', async () => {
      const adapter = createProductionRoleplayAdapter({
        downstreamExecutionProvider: {
          providerRef: 'downstream',
          async isAvailable() {
            return true;
          },
          async executeTurn() {
            throw new Error('should not be called');
          },
        },
        professionalContentAuthority: validContentAuthority,
        modelPromptAuthorityProvider: async () => ({
          model: null, // missing!
          prompt: validModelPromptAuthority.prompt,
        }),
      });

      expect(await adapter.isAvailable(validContext)).toBe(false);
    });

    it('createProductionRoleplayAdapter reports unavailable when prompt authority is missing', async () => {
      const adapter = createProductionRoleplayAdapter({
        downstreamExecutionProvider: {
          providerRef: 'downstream',
          async isAvailable() {
            return true;
          },
          async executeTurn() {
            throw new Error('should not be called');
          },
        },
        professionalContentAuthority: validContentAuthority,
        modelPromptAuthorityProvider: async () => ({
          model: validModelPromptAuthority.model,
          prompt: null, // missing!
        }),
      });

      expect(await adapter.isAvailable(validContext)).toBe(false);
    });

    it('createProductionRoleplayAdapter reports unavailable when downstream execution provider is unavailable', async () => {
      const adapter = createProductionRoleplayAdapter({
        downstreamExecutionProvider: {
          providerRef: 'downstream',
          async isAvailable() {
            return false; // downstream says unavailable!
          },
          async executeTurn() {
            throw new Error('should not be called');
          },
        },
        professionalContentAuthority: validContentAuthority,
        modelPromptAuthorityProvider: async () => validModelPromptAuthority,
      });

      expect(await adapter.isAvailable(validContext)).toBe(false);
    });
  });

  describe('Zero Test Fixture Pollution & Static Hygiene', () => {
    it('verifies digital-use-roleplay-adapter.ts contains no banned AI/RAG keywords', () => {
      const filePath = resolve(
        process.cwd(),
        'apps/server/api/src/services/digital-use-roleplay-adapter.ts'
      );
      const content = readFileSync(filePath, 'utf8');

      expect(content).not.toMatch(
        /\b(OpenAI|Anthropic|embedding|vector store|RAG runtime|agent runtime)\b/i
      );
      expect(content).toContain('unavailableProductionRoleplayAdapter');
      expect(content).toContain('DOWNSTREAM_AI_UNAVAILABLE');
    });

    it('verifies apps/server/api/src/app.ts contains no direct imports from tests/', () => {
      const filePath = resolve(process.cwd(), 'apps/server/api/src/app.ts');
      const content = readFileSync(filePath, 'utf8');

      expect(content).not.toMatch(/from\s+['"][^'"]*tests\//);
      expect(content).not.toMatch(/from\s+['"][^'"]*fixtures\//);
    });
  });
});
