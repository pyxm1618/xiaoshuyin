import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import pg from 'pg';
import { configPlugin } from './plugins/config.js';
import { registerAuthPlugin } from './plugins/auth.js';
import { errorHandler, toHttpError } from './plugins/error-handler.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerMeRoutes } from './routes/me.js';
import { registerFamilyRoutes } from './routes/families.js';
import { registerMemberRoutes } from './routes/members.js';
import { registerComplianceRoutes } from './routes/compliance.js';
import { registerConsentRoutes } from './routes/consents.js';
import { registerCaseRoutes } from './routes/cases.js';
import { registerIdentityBindingRoutes } from './routes/identity-bindings.js';
import { registerMessageRoutes } from './routes/messages.js';
import { registerParticipationRoutes } from './routes/participations.js';
import { registerProblemFormulationRoutes } from './routes/problem-formulations.js';
import { registerGoalRoutes } from './routes/goals.js';
import { registerDigitalUseAssessmentRoutes } from './routes/digital-use-assessment.js';
import { registerDigitalUsePhoneContractRoutes } from './routes/digital-use-phone-contract.js';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import {
  createWechatProvider,
  loadRuntimeConfig,
  type RuntimeConfig,
} from './runtime-env.js';
import type { WechatAuthProvider } from './auth/wechat-provider.js';
import { Slice4InvitationPort } from './identity-binding/invitation-slice4-adapter.js';
import type { InvitationResolutionPort } from './identity-binding/invitation-port.js';
import type { PhoneUseStaticProfessionalContentAuthority } from './services/digital-use-phone-contract.js';
import type {
  RoleplayAdapter,
  RoleplayModelPromptAuthorityProvider,
  RoleplayProfessionalContentAuthority,
} from './services/digital-use-roleplay-adapter.js';
import type { ProfessionalReviewContentProvider } from './services/digital-use-review-professional-content.js';
import {
  SafetyError,
  getCaseById,
  runSafetyPrecheck,
  type ApprovedPolicyIdentity,
  type ApprovedRuleEvaluation,
  type OpaqueEvidenceReference,
  type SafetyCaseSnapshot,
} from '@xiaoshuyin/domain';
import { withIdentityTransaction, withRlsTransaction } from './db/tx.js';
import { requireCurrentFamily } from './family-context.js';
import { requireFamilyAction } from './authz.js';
import { enterSafetyHold } from './safety/enter-safety-hold.js';
import { resolveRisk } from './safety/resolve-risk.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ENTER_INPUT_KEYS = new Set(['actor', 'caseId', 'idempotencyKey']);
const RESOLVE_INPUT_KEYS = new Set([
  'actor',
  'caseId',
  'idempotencyKey',
  'expectedCaseVersion',
  'reviewEvidenceRefs',
]);
const ACTOR_KEYS = new Set(['accountId', 'personId']);

export type SafetyPolicyIdentityResult =
  | { status: 'AVAILABLE'; identity: ApprovedPolicyIdentity }
  | { status: 'UNAVAILABLE' };

export type SafetyApprovedEvaluationResult =
  | { status: 'AVAILABLE'; evaluation: ApprovedRuleEvaluation }
  | { status: 'UNAVAILABLE' };

/**
 * Server-owned seam implemented later by the approved professional Safety
 * asset. The production caller never receives these values from a client.
 */
export interface ApprovedSafetyPolicyRuntime {
  currentIdentity(input: {
    caseId: string;
  }): Promise<SafetyPolicyIdentityResult>;

  evaluate(input: {
    case: SafetyCaseSnapshot;
    trustedPolicyIdentity: ApprovedPolicyIdentity;
  }): Promise<SafetyApprovedEvaluationResult>;
}

export interface SafetyServerActor {
  accountId: string;
  personId: string;
}

export interface SafetyProductionEnterInput {
  actor: SafetyServerActor;
  caseId: string;
  idempotencyKey: string;
}

export interface SafetyProductionResolveInput {
  actor: SafetyServerActor;
  caseId: string;
  idempotencyKey: string;
  expectedCaseVersion: number;
  reviewEvidenceRefs: OpaqueEvidenceReference[];
}

export type SafetyProductionEnterResult =
  | { kind: 'ALLOW'; caseId: string; caseVersion: number }
  | { kind: 'ALREADY_HELD'; caseId: string; caseVersion: number }
  | {
      kind: 'ENTER_HOLD';
      caseId: string;
      caseVersion: number;
      command: { status: number; body: unknown };
    };

export interface SafetyProductionService {
  enter(input: SafetyProductionEnterInput): Promise<SafetyProductionEnterResult>;
  resolve(input: SafetyProductionResolveInput): Promise<{ status: number; body: unknown }>;
}

export class SafetyProductionEntryError extends Error {
  readonly code:
    | 'SAFETY_PRODUCTION_INPUT_INVALID'
    | 'SAFETY_PRODUCTION_RULE_ASSET_UNAVAILABLE';

  constructor(
    code:
      | 'SAFETY_PRODUCTION_INPUT_INVALID'
      | 'SAFETY_PRODUCTION_RULE_ASSET_UNAVAILABLE'
  ) {
    super(code);
    this.name = 'SafetyProductionEntryError';
    this.code = code;
  }
}

function invalidInput(): never {
  throw new SafetyProductionEntryError('SAFETY_PRODUCTION_INPUT_INVALID');
}

function ruleAssetUnavailable(): never {
  throw new SafetyProductionEntryError(
    'SAFETY_PRODUCTION_RULE_ASSET_UNAVAILABLE'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  value: unknown,
  expected: ReadonlySet<string>
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) invalidInput();
  const keys = Object.keys(value);
  if (
    keys.length !== expected.size ||
    keys.some((key) => !expected.has(key))
  ) {
    invalidInput();
  }
}

function requireString(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') invalidInput();
  return value;
}

function validateActor(value: unknown): SafetyServerActor {
  assertExactKeys(value, ACTOR_KEYS);
  return {
    accountId: requireString(value['accountId']),
    personId: requireString(value['personId']),
  };
}

function validateEnterInput(value: unknown): SafetyProductionEnterInput {
  assertExactKeys(value, ENTER_INPUT_KEYS);
  const caseId = requireString(value['caseId']).toLowerCase();
  if (!UUID_PATTERN.test(caseId)) invalidInput();

  const idempotencyKey = requireString(value['idempotencyKey']);
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    invalidInput();
  }

  return {
    actor: validateActor(value['actor']),
    caseId,
    idempotencyKey,
  };
}

function validateResolveInput(value: unknown): SafetyProductionResolveInput {
  assertExactKeys(value, RESOLVE_INPUT_KEYS);
  const caseId = requireString(value['caseId']).toLowerCase();
  if (!UUID_PATTERN.test(caseId)) invalidInput();

  const idempotencyKey = requireString(value['idempotencyKey']);
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    invalidInput();
  }

  const expectedCaseVersion = value['expectedCaseVersion'];
  if (
    typeof expectedCaseVersion !== 'number' ||
    !Number.isInteger(expectedCaseVersion) ||
    expectedCaseVersion < 1
  ) {
    invalidInput();
  }

  if (!Array.isArray(value['reviewEvidenceRefs'])) invalidInput();

  return {
    actor: validateActor(value['actor']),
    caseId,
    idempotencyKey,
    expectedCaseVersion,
    reviewEvidenceRefs: value['reviewEvidenceRefs'] as OpaqueEvidenceReference[],
  };
}

function httpError(code: string, message?: string) {
  const error = toHttpError(code, message);
  return Object.assign(new Error(error.message), error);
}

function sameIdentity(
  left: ApprovedPolicyIdentity,
  right: ApprovedPolicyIdentity
): boolean {
  return (
    left.policyRef === right.policyRef &&
    left.policyVersion === right.policyVersion &&
    left.ruleRef === right.ruleRef &&
    left.ruleVersion === right.ruleVersion
  );
}

async function requireCurrentIdentity(
  runtime: ApprovedSafetyPolicyRuntime,
  caseId: string
): Promise<ApprovedPolicyIdentity> {
  const result = await runtime.currentIdentity({ caseId });
  if (result.status !== 'AVAILABLE') ruleAssetUnavailable();
  return result.identity;
}

async function requireApprovedEvaluation(
  runtime: ApprovedSafetyPolicyRuntime,
  input: {
    case: SafetyCaseSnapshot;
    trustedPolicyIdentity: ApprovedPolicyIdentity;
  }
): Promise<ApprovedRuleEvaluation> {
  const result = await runtime.evaluate(input);
  if (result.status !== 'AVAILABLE') ruleAssetUnavailable();

  // C2 strengthens the orchestration boundary for both outcomes. A stale
  // NO_HOLD evaluation must never become ALLOW simply because it was produced
  // by a superseded approved rule identity.
  if (!sameIdentity(result.evaluation, input.trustedPolicyIdentity)) {
    throw new SafetyError('SAFETY_PRECHECK_STALE');
  }

  return result.evaluation;
}

async function readAuthorizedCaseSnapshot(
  pool: pg.Pool,
  input: {
    actor: SafetyServerActor;
    caseId: string;
  }
): Promise<SafetyCaseSnapshot> {
  const familyId = await withIdentityTransaction(
    pool,
    { accountId: input.actor.accountId, purpose: 'FAMILY_MANAGEMENT' },
    (tx) => requireCurrentFamily(tx, input.actor.personId)
  );

  return withRlsTransaction(
    pool,
    {
      familyId,
      accountId: input.actor.accountId,
      personId: input.actor.personId,
      purpose: 'FAMILY_MANAGEMENT',
    },
    async (tx) => {
      await requireFamilyAction(tx, {
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        familyId,
        action: 'CASE_ENTER_SAFETY_HOLD',
        purpose: 'FAMILY_MANAGEMENT',
        resource: { type: 'CASE', familyId, caseId: input.caseId },
        caseId: input.caseId,
      });

      const row = await getCaseById(tx, input.caseId);
      if (!row || row.family_id !== familyId) {
        throw httpError('CASE_NOT_FOUND', 'Case not found');
      }

      return {
        caseId: row.id,
        status: row.status,
        version: row.version,
      };
    }
  );
}

/**
 * Construct the narrow C2 production orchestrator around an approved runtime.
 *
 * The runtime is a composition dependency, never a per-request/client field.
 * D6 may supply the real reviewed implementation later without changing either
 * Domain Command or exposing a public Safety mutation endpoint.
 */
export function createSafetyProductionService(
  pool: pg.Pool,
  runtime: ApprovedSafetyPolicyRuntime
): SafetyProductionService {
  return {
    async enter(rawInput) {
      const input = validateEnterInput(rawInput);
      const snapshot = await readAuthorizedCaseSnapshot(pool, {
        actor: input.actor,
        caseId: input.caseId,
      });

      const trustedPolicyIdentity = await requireCurrentIdentity(
        runtime,
        snapshot.caseId
      );

      const approvedEvaluation =
        snapshot.status === 'SAFETY_HOLD'
          ? undefined
          : await requireApprovedEvaluation(runtime, {
              case: snapshot,
              trustedPolicyIdentity,
            });

      const decision = runSafetyPrecheck({
        case: snapshot,
        trustedPolicyIdentity,
        ...(approvedEvaluation === undefined
          ? {}
          : { approvedEvaluation }),
      });

      if (decision.kind === 'ALLOW' || decision.kind === 'ALREADY_HELD') {
        return decision;
      }

      // Re-read the server-owned current identity immediately before the
      // command. EnterSafetyHold then compares this value with the decision
      // again after locking/re-reading the Case, preserving the existing
      // policy-identity + Case-version TOCTOU protections.
      const currentIdentity = await requireCurrentIdentity(
        runtime,
        snapshot.caseId
      );

      const command = await enterSafetyHold(pool, {
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        caseId: snapshot.caseId,
        idempotencyKey: input.idempotencyKey,
        expectedCaseVersion: snapshot.version,
        decision,
        trustedPolicyIdentity: currentIdentity,
      });

      return {
        kind: 'ENTER_HOLD',
        caseId: snapshot.caseId,
        caseVersion: snapshot.version,
        command,
      };
    },

    async resolve(rawInput) {
      const input = validateResolveInput(rawInput);
      const trustedPolicyIdentity = await requireCurrentIdentity(
        runtime,
        input.caseId
      );

      // ResolveRisk remains the single legal exit and performs the authoritative
      // production Staff capability + exact Case assignment verification in its
      // own transaction. This layer supplies no isStaff/canResolve shortcut.
      return resolveRisk(pool, {
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        caseId: input.caseId,
        idempotencyKey: input.idempotencyKey,
        expectedCaseVersion: input.expectedCaseVersion,
        reviewEvidenceRefs: input.reviewEvidenceRefs,
        trustedPolicyIdentity,
      });
    },
  };
}

/**
 * Current production composition before D6.
 *
 * There is intentionally NO fake policy/rule identity and NO invented
 * professional detection rule. Any formal C2 invocation therefore fails
 * closed/unavailable before a Safety mutation until D6 installs the reviewed
 * runtime asset.
 */
export function createProductionSafetyPolicyRuntime(): ApprovedSafetyPolicyRuntime {
  return {
    async currentIdentity() {
      return { status: 'UNAVAILABLE' };
    },
    async evaluate() {
      return { status: 'UNAVAILABLE' };
    },
  };
}

export function createProductionSafetyService(
  pool: pg.Pool
): SafetyProductionService {
  return createSafetyProductionService(
    pool,
    createProductionSafetyPolicyRuntime()
  );
}

export interface BuildAppOptions {
  env?: NodeJS.ProcessEnv;
  /** Test-only sink used to assert log privacy (F11). */
  loggerStream?: NodeJS.WritableStream;
  /** Test-only sink to capture real registered route schemas (contract drift). */
  onRoute?: (route: any) => void;
  /**
   * Identity-binding injection points. Production defaults to the real
   * Slice 4 invitation adapter (T121); tests may inject a contract
   * implementation without changing production ownership.
   */
  identityBinding?: {
    invitationPort?: InvitationResolutionPort;
    wechatProvider?: WechatAuthProvider;
  };
  /**
   * Bounded Phone Contract authority seams. Production has neither an assigned
   * static Professional Content package nor A4003 roleplay/model/prompt authority.
   */
  phoneUseContract?: {
    staticProfessionalContent?: PhoneUseStaticProfessionalContentAuthority;
    roleplayAdapter?: RoleplayAdapter;
    roleplayProfessionalContent?: RoleplayProfessionalContentAuthority;
    roleplayModelPromptAuthority?: RoleplayModelPromptAuthorityProvider;
  };
  /**
   * Slice 15 test seam. Production omits this and therefore uses the
   * fail-closed unavailable Professional Review Content provider.
   */
  digitalUseReview?: {
    professionalContent?: ProfessionalReviewContentProvider;
  };
}

/**
 * Request serializer for logs (F11).
 *
 * Fastify's default serializer emits `remoteAddress` / `remotePort` at
 * `LOG_LEVEL=info`. Raw client IP and User-Agent must never reach logs, so the
 * serializer keeps only non-sensitive routing fields.
 */
export function sanitizeRequestUrlForLogs(url: unknown): string {
  if (typeof url !== 'string') return '';
  return url.replace(
    /(\/api\/v1\/participation-invites\/)[^/?#]+/g,
    '$1[REDACTED]'
  );
}

export function requestLogSerializer(req: any) {
  return {
    method: req?.method,
    url: sanitizeRequestUrlForLogs(req?.url),
    host: req?.headers?.host,
    requestId: req?.id,
  };
}

function buildLoggerOptions(
  env: NodeJS.ProcessEnv,
  stream?: NodeJS.WritableStream
) {
  return {
    level: env['LOG_LEVEL'] ?? 'warn',
    serializers: { req: requestLogSerializer },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["user-agent"]',
      ],
      remove: true,
    },
    ...(stream ? { stream } : {}),
  };
}

export async function buildApp(options: BuildAppOptions = {}) {
  const env = options.env ?? process.env;

  // Fail-fast runtime contract (F1). Throws before any route is registered.
  const runtime: RuntimeConfig = loadRuntimeConfig(env);

  const app = Fastify({ logger: buildLoggerOptions(env, options.loggerStream) });

  // Test-only: capture real route schemas before any route is registered.
  if (options.onRoute) app.addHook('onRoute', options.onRoute);

  // Zod schemas are the single source for route contracts; validation
  // failures are mapped to the frozen 422 VALIDATION_ERROR by errorHandler.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Error handler
  app.setErrorHandler(errorHandler);

  // Config (re-validates the same runtime contract and exposes the channel)
  await app.register(configPlugin, { env });

  // Baseline HTTP response hardening. This is independent of proxy/client-IP
  // trust semantics, so it is safe across the current deployment shapes.
  // Global request-rate limiting remains intentionally deferred until the
  // authoritative proxy/client-IP boundary is frozen.
  await app.register(helmet);

  // Database pool
  const pool = new pg.Pool({
    connectionString: env['DATABASE_URL'],
    max: 10,
  });

  // node-postgres emits idle-client failures on Pool. A listener is required
  // so an asynchronous backend/network failure cannot become an uncaught
  // EventEmitter error. Checked-out clients are handled independently by the
  // transaction lifecycle in db/tx.ts.
  pool.on('error', (err) => {
    const rawCode = (err as { code?: unknown }).code;
    const sqlstate =
      typeof rawCode === 'string' && /^[0-9A-Z]{5}$/.test(rawCode) ? rawCode : undefined;
    app.log.error(
      { ...(sqlstate ? { sqlstate } : {}) },
      'postgres pool client error'
    );
  });

  // Production never selects the fake provider (see createWechatProvider).
  const wechatProvider =
    options.identityBinding?.wechatProvider ?? createWechatProvider(runtime);

  // Auth plugin
  registerAuthPlugin(app, pool, runtime.sessionSecret);

  // Health check (no auth)
  app.get('/healthz', async () => {
    return { status: 'ok' };
  });

  // Routes
  registerAuthRoutes(app, pool, wechatProvider, runtime.sessionSecret);
  registerMeRoutes(app, pool);
  registerFamilyRoutes(app, pool);
  registerMemberRoutes(app, pool);
  registerComplianceRoutes(app, pool);
  registerConsentRoutes(app, pool);
  registerCaseRoutes(app, pool);
  registerMessageRoutes(app, pool);
  registerProblemFormulationRoutes(app, pool);
  registerGoalRoutes(app, pool);
  registerDigitalUseAssessmentRoutes(app, pool, {
    evidencePepper: runtime.evidencePepper,
    ...(options.digitalUseReview?.professionalContent === undefined
      ? {}
      : {
          professionalReviewContent:
            options.digitalUseReview.professionalContent,
        }),
  });
  registerDigitalUsePhoneContractRoutes(app, pool, {
    ...(options.phoneUseContract?.staticProfessionalContent
      ? { staticProfessionalContent: options.phoneUseContract.staticProfessionalContent }
      : {}),
    ...(options.phoneUseContract?.roleplayAdapter
      ? { roleplayAdapter: options.phoneUseContract.roleplayAdapter }
      : {}),
    ...(options.phoneUseContract?.roleplayProfessionalContent
      ? {
          roleplayProfessionalContent:
            options.phoneUseContract.roleplayProfessionalContent,
        }
      : {}),
    ...(options.phoneUseContract?.roleplayModelPromptAuthority
      ? {
          roleplayModelPromptAuthority:
            options.phoneUseContract.roleplayModelPromptAuthority,
        }
      : {}),
  });
  registerParticipationRoutes(app, pool, {
    inviteTtlSeconds: runtime.participationInviteTtlSeconds,
    inviteTokenSecret: runtime.participationInviteTokenSecret,
  });

  // Slice 006: exactly six identity-binding capability routes.
  registerIdentityBindingRoutes(app, {
    pool,
    invitationPort:
      options.identityBinding?.invitationPort ?? new Slice4InvitationPort(),
    wechatProvider,
    identityBindingSecret: runtime.identityBindingSecret,
    contextTtlSeconds: runtime.identityBindingContextTtlSeconds,
    attemptTtlSeconds: runtime.identityBindingAttemptTtlSeconds,
    pairingTtlSeconds: runtime.identityBindingPairingTtlSeconds,
    sessionSecret: runtime.sessionSecret,
  });

  return app;
}
