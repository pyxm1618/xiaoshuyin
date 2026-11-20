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
  caseIdempotencyKeyBytes,
  getCaseById,
  getReservedIdempotency,
  runSafetyPrecheck,
  SafetyError,
  type ApprovedPolicyIdentity,
  type ApprovedRuleEvaluation,
  type OpaqueEvidenceReference,
  type SafetyCaseSnapshot,
} from '@xiaoshuyin/domain';
import { withIdentityTransaction, withRlsTransaction } from './db/tx.js';
import { requireCurrentFamily } from './family-context.js';
import { requireFamilyAction } from './authz.js';
import {
  ENTER_SAFETY_HOLD_COMMAND,
  enterSafetyHold,
} from './safety/enter-safety-hold.js';
import { resolveRisk } from './safety/resolve-risk.js';


/**
 * Phase 5 / C2 — narrow internal Safety production-entry authority seam.
 *
 * Production deliberately defaults to UNAVAILABLE until D6 supplies a real,
 * approved deterministic Safety rule asset. No HTTP route can inject a
 * decision, trusted identity, risk boolean, or resolver capability.
 */
export interface SafetyProductionAuthorityProvider {
  currentPolicyIdentity(input: {
    readonly caseId: string;
  }): Promise<ApprovedPolicyIdentity | null>;
  evaluate(input: {
    readonly case: SafetyCaseSnapshot;
    readonly trustedPolicyIdentity: ApprovedPolicyIdentity;
  }): Promise<ApprovedRuleEvaluation | null>;
}

const unavailableProductionSafetyAuthorityProvider:
  SafetyProductionAuthorityProvider = Object.freeze({
    async currentPolicyIdentity() {
      return null;
    },
    async evaluate() {
      return null;
    },
  });

export type SafetyProductionEntryResult =
  | { kind: 'ALLOW'; caseId: string; caseVersion: number }
  | { kind: 'ALREADY_HELD'; caseId: string; caseVersion: number }
  | { kind: 'ENTER_HOLD'; status: number; body: unknown };

export interface SafetyProductionActor {
  readonly accountId: string;
  readonly personId: string;
}

export interface SafetyProductionEntryInput {
  readonly actor: SafetyProductionActor;
  readonly caseId: string;
  readonly operationKey: string;
}

export interface SafetyProductionResolveInput {
  readonly actor: SafetyProductionActor;
  readonly caseId: string;
  readonly operationKey: string;
  readonly expectedCaseVersion: number;
  readonly reviewEvidenceRefs: OpaqueEvidenceReference[];
}

export interface SafetyProductionService {
  enter(input: SafetyProductionEntryInput): Promise<SafetyProductionEntryResult>;
  resolve(input: SafetyProductionResolveInput): Promise<{ status: number; body: unknown }>;
}

const SAFETY_CASE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFETY_POLICY_IDENTITY_KEYS = [
  'policyRef',
  'policyVersion',
  'ruleRef',
  'ruleVersion',
] as const;
const SAFETY_ENTRY_INPUT_KEYS = new Set(['actor', 'caseId', 'operationKey']);
const SAFETY_RESOLVE_INPUT_KEYS = new Set([
  'actor',
  'caseId',
  'operationKey',
  'expectedCaseVersion',
  'reviewEvidenceRefs',
]);

function requireSafetyInputRecord(
  value: unknown,
  expectedKeys: ReadonlySet<string>
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SafetyError('SAFETY_PRECHECK_INVALID', 'invalid Safety production input');
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== expectedKeys.size ||
    keys.some((key) => !expectedKeys.has(key))
  ) {
    throw new SafetyError('SAFETY_PRECHECK_INVALID', 'invalid Safety production input');
  }
  return record;
}

function requireSafetyActor(value: unknown): SafetyProductionActor {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SafetyError('SAFETY_PRECHECK_INVALID', 'invalid Safety actor');
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record['accountId'] !== 'string' ||
    record['accountId'].trim() === '' ||
    typeof record['personId'] !== 'string' ||
    record['personId'].trim() === ''
  ) {
    throw new SafetyError('SAFETY_PRECHECK_INVALID', 'invalid Safety actor');
  }
  return {
    accountId: record['accountId'],
    personId: record['personId'],
  };
}

function requireSafetyCaseId(value: unknown): string {
  if (typeof value !== 'string') safetyCaseNotFound();
  const caseId = value.toLowerCase();
  if (!SAFETY_CASE_ID_PATTERN.test(caseId)) safetyCaseNotFound();
  return caseId;
}

function safetyCaseNotFound(): never {
  const mapped = toHttpError('CASE_NOT_FOUND', 'Case not found');
  throw Object.assign(new Error(mapped.message), mapped);
}

function safetyOperationKey(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    value.length < 8 ||
    value.length > 200
  ) {
    throw new SafetyError('SAFETY_PRECHECK_INVALID', 'invalid Safety operation key');
  }
  return value;
}

function requireApprovedPolicyIdentity(value: unknown): ApprovedPolicyIdentity {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SafetyError('SAFETY_PRECHECK_INVALID', 'trusted Safety policy identity unavailable');
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expected = [...SAFETY_POLICY_IDENTITY_KEYS].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    throw new SafetyError('SAFETY_PRECHECK_INVALID', 'trusted Safety policy identity malformed');
  }
  for (const key of SAFETY_POLICY_IDENTITY_KEYS) {
    if (typeof record[key] !== 'string' || (record[key] as string).trim() === '') {
      throw new SafetyError('SAFETY_PRECHECK_INVALID', 'trusted Safety policy identity malformed');
    }
  }
  return {
    policyRef: record['policyRef'] as string,
    policyVersion: record['policyVersion'] as string,
    ruleRef: record['ruleRef'] as string,
    ruleVersion: record['ruleVersion'] as string,
  };
}

async function currentTrustedSafetyIdentity(
  authority: SafetyProductionAuthorityProvider,
  caseId: string
): Promise<ApprovedPolicyIdentity> {
  let identity: ApprovedPolicyIdentity | null;
  try {
    identity = await authority.currentPolicyIdentity({ caseId });
  } catch {
    throw new SafetyError('SAFETY_PRECHECK_INVALID', 'trusted Safety policy identity unavailable');
  }
  return requireApprovedPolicyIdentity(identity);
}

function sameSafetyIdentity(
  left: ApprovedPolicyIdentity,
  right: ApprovedPolicyIdentity
): boolean {
  return SAFETY_POLICY_IDENTITY_KEYS.every((key) => left[key] === right[key]);
}

function internalSafetyError(message: string): never {
  const mapped = toHttpError('INTERNAL_ERROR', message);
  throw Object.assign(new Error(mapped.message), mapped);
}

/**
 * C2 retry bridge over the existing command idempotency store.
 *
 * A completed CASE_ENTER_SAFETY_HOLD operation must replay even when the Case
 * is now held or has subsequently been resolved. We read only the existing
 * command reservation; no second idempotency record or persistence owner is
 * introduced. Current Family visibility and the command's authorization action
 * are rechecked before the stored response is returned.
 */
async function readCompletedEnterSafetyHoldReplay(
  pool: pg.Pool,
  input: {
    actor: SafetyProductionActor;
    caseId: string;
    operationKey: string;
  }
): Promise<Extract<SafetyProductionEntryResult, { kind: 'ENTER_HOLD' }> | null> {
  const lookup = await withIdentityTransaction(
    pool,
    { accountId: input.actor.accountId, purpose: 'FAMILY_MANAGEMENT' },
    async (tx) => {
      const row = await getReservedIdempotency(tx, {
        actorAccountId: input.actor.accountId,
        commandType: ENTER_SAFETY_HOLD_COMMAND,
        keyBytes: caseIdempotencyKeyBytes(input.operationKey),
        legacyKeyText: null,
      });
      if (row === null) return null;
      const familyId = await requireCurrentFamily(tx, input.actor.personId);
      return { row, familyId };
    }
  );
  if (lookup === null) return null;

  if (lookup.row.response_status === 0) {
    internalSafetyError('Safety idempotency slot incomplete');
  }

  return withRlsTransaction(
    pool,
    {
      familyId: lookup.familyId,
      accountId: input.actor.accountId,
      personId: input.actor.personId,
      purpose: 'FAMILY_MANAGEMENT',
    },
    async (tx) => {
      const caseRow = await getCaseById(tx, input.caseId);
      if (!caseRow || caseRow.family_id !== lookup.familyId) safetyCaseNotFound();

      await requireFamilyAction(tx, {
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        familyId: lookup.familyId,
        action: 'CASE_ENTER_SAFETY_HOLD',
        purpose: 'FAMILY_MANAGEMENT',
        resource: {
          type: 'CASE',
          familyId: lookup.familyId,
          caseId: input.caseId,
        },
        caseId: input.caseId,
      });

      const body = lookup.row.response_body;
      if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        internalSafetyError('Safety idempotency replay body invalid');
      }
      const replayCaseId = (body as Record<string, unknown>)['caseId'];
      if (typeof replayCaseId !== 'string') {
        internalSafetyError('Safety idempotency replay Case identity missing');
      }
      if (replayCaseId.toLowerCase() !== input.caseId) {
        const mapped = toHttpError(
          'IDEMPOTENCY_PAYLOAD_MISMATCH',
          'Idempotency payload mismatch'
        );
        throw Object.assign(new Error(mapped.message), mapped);
      }

      return {
        kind: 'ENTER_HOLD',
        status: lookup.row.response_status,
        body,
      };
    }
  );
}

async function readSafetyCaseSnapshot(
  pool: pg.Pool,
  actor: SafetyProductionActor,
  rawCaseId: string
): Promise<SafetyCaseSnapshot> {
  const caseId = rawCaseId.toLowerCase();
  if (!SAFETY_CASE_ID_PATTERN.test(caseId)) safetyCaseNotFound();

  const familyId = await withIdentityTransaction(
    pool,
    { accountId: actor.accountId, purpose: 'FAMILY_MANAGEMENT' },
    (tx) => requireCurrentFamily(tx, actor.personId)
  );

  return withRlsTransaction(
    pool,
    {
      familyId,
      accountId: actor.accountId,
      personId: actor.personId,
      purpose: 'FAMILY_MANAGEMENT',
    },
    async (tx) => {
      await requireFamilyAction(tx, {
        accountId: actor.accountId,
        personId: actor.personId,
        familyId,
        action: 'CASE_ENTER_SAFETY_HOLD',
        purpose: 'FAMILY_MANAGEMENT',
        resource: { type: 'CASE', familyId, caseId },
        caseId,
      });

      const row = await getCaseById(tx, caseId);
      if (!row || row.family_id !== familyId) safetyCaseNotFound();
      return {
        caseId: row.id,
        status: row.status,
        version: row.version,
      };
    }
  );
}

/**
 * Internal-only production entry:
 * server-owned Case snapshot + current trusted identity + approved evaluator
 * output -> runSafetyPrecheck() -> existing EnterSafetyHold command.
 *
 * The operation key is forwarded unchanged so retries reuse the command's
 * existing idempotency contract. This function never writes Safety state.
 */
async function runSafetyProductionEntryWithAuthority(
  pool: pg.Pool,
  input: SafetyProductionEntryInput,
  authority: SafetyProductionAuthorityProvider
): Promise<SafetyProductionEntryResult> {
  const parsed = requireSafetyInputRecord(input, SAFETY_ENTRY_INPUT_KEYS);
  const actor = requireSafetyActor(parsed['actor']);
  const operationKey = safetyOperationKey(parsed['operationKey']);
  const caseId = requireSafetyCaseId(parsed['caseId']);

  // A retry of a completed command is decided before current-state evaluation,
  // because the Case may already be held or may have been resolved since the
  // original response was persisted. The existing idempotency reservation is
  // still the only operation record.
  const replay = await readCompletedEnterSafetyHoldReplay(pool, {
    actor,
    caseId,
    operationKey,
  });
  if (replay !== null) return replay;

  const snapshot = await readSafetyCaseSnapshot(pool, actor, caseId);
  const identityAtEvaluation = await currentTrustedSafetyIdentity(
    authority,
    snapshot.caseId
  );

  let approvedEvaluation: ApprovedRuleEvaluation | null | undefined;
  if (snapshot.status !== 'SAFETY_HOLD') {
    try {
      approvedEvaluation = await authority.evaluate({
        case: snapshot,
        trustedPolicyIdentity: identityAtEvaluation,
      });
    } catch {
      throw new SafetyError('SAFETY_PRECHECK_INVALID', 'approved Safety evaluation unavailable');
    }
  }

  // Re-read the server-owned identity after the evaluator returns. A policy or
  // rule swap during evaluation invalidates BOTH HOLD_REQUIRED and NO_HOLD;
  // ALLOW can never be granted from a superseded evaluation.
  const currentIdentity = await currentTrustedSafetyIdentity(
    authority,
    snapshot.caseId
  );
  if (!sameSafetyIdentity(identityAtEvaluation, currentIdentity)) {
    throw new SafetyError('SAFETY_PRECHECK_STALE');
  }

  const decision = runSafetyPrecheck({
    case: snapshot,
    trustedPolicyIdentity: currentIdentity,
    ...(snapshot.status === 'SAFETY_HOLD'
      ? {}
      : { approvedEvaluation: approvedEvaluation ?? null }),
  });

  // runSafetyPrecheck validates the strict evaluation shape. Its NO_HOLD path
  // intentionally does not itself compare identity, so the production entry
  // performs that current-identity check before an ALLOW is returned.
  if (
    approvedEvaluation !== undefined &&
    approvedEvaluation !== null &&
    !sameSafetyIdentity(approvedEvaluation, currentIdentity)
  ) {
    throw new SafetyError('SAFETY_PRECHECK_STALE');
  }

  if (decision.kind === 'ALLOW') {
    // ALLOW is itself an authority-bearing result for ordinary progression.
    // Re-read the authorized Case after evaluation so a concurrent status or
    // revision change (especially SAFETY_HOLD) cannot be approved from the
    // stale pre-evaluation snapshot.
    const currentCase = await readSafetyCaseSnapshot(pool, actor, snapshot.caseId);
    if (
      currentCase.caseId !== decision.caseId ||
      currentCase.version !== decision.caseVersion ||
      currentCase.status !== snapshot.status
    ) {
      throw new SafetyError('SAFETY_PRECHECK_STALE');
    }
    return decision;
  }

  if (decision.kind === 'ALREADY_HELD') {
    return decision;
  }

  // EnterSafetyHold revalidates decision Case revision + identity after taking
  // the Case lock. C2 owns no second transition or persistence primitive.
  const result = await enterSafetyHold(pool, {
    accountId: actor.accountId,
    personId: actor.personId,
    caseId: snapshot.caseId,
    idempotencyKey: operationKey,
    expectedCaseVersion: decision.caseVersion,
    decision,
    trustedPolicyIdentity: currentIdentity,
  });
  return { kind: 'ENTER_HOLD', ...result };
}

/**
 * Internal-only controlled production resolution entry.
 *
 * Staff authority, exact Case assignment, evidence validation, hold trace,
 * policy-context matching, locking, persistence and idempotency remain owned by
 * the existing ResolveRisk command. C2 only obtains the current server-owned
 * policy identity and forwards a stable operation key.
 */
async function runSafetyProductionResolveWithAuthority(
  pool: pg.Pool,
  input: SafetyProductionResolveInput,
  authority: SafetyProductionAuthorityProvider
): Promise<{ status: number; body: unknown }> {
  const parsed = requireSafetyInputRecord(input, SAFETY_RESOLVE_INPUT_KEYS);
  const actor = requireSafetyActor(parsed['actor']);
  const operationKey = safetyOperationKey(parsed['operationKey']);
  const caseId = requireSafetyCaseId(parsed['caseId']);
  const expectedCaseVersion = parsed['expectedCaseVersion'];
  if (
    typeof expectedCaseVersion !== 'number' ||
    !Number.isInteger(expectedCaseVersion) ||
    expectedCaseVersion < 1 ||
    !Array.isArray(parsed['reviewEvidenceRefs'])
  ) {
    throw new SafetyError('SAFETY_PRECHECK_INVALID', 'invalid Safety resolution input');
  }

  const trustedPolicyIdentity = await currentTrustedSafetyIdentity(authority, caseId);
  return resolveRisk(pool, {
    accountId: actor.accountId,
    personId: actor.personId,
    caseId,
    idempotencyKey: operationKey,
    expectedCaseVersion,
    reviewEvidenceRefs: parsed['reviewEvidenceRefs'] as OpaqueEvidenceReference[],
    trustedPolicyIdentity,
  });
}

/**
 * C2 internal production service composition.
 *
 * The approved evaluator/trusted identity provider is bound once at server
 * composition time. Per-operation callers can supply only actor/Case/evidence
 * inputs; they cannot replace the Safety authority source.
 *
 * Until D6 installs a reviewed deterministic provider, omitting `authority`
 * preserves the formal production entry but fails closed before mutation.
 */
export function createSafetyProductionService(
  pool: pg.Pool,
  authority: SafetyProductionAuthorityProvider =
    unavailableProductionSafetyAuthorityProvider
): SafetyProductionService {
  return Object.freeze({
    enter(input: SafetyProductionEntryInput) {
      return runSafetyProductionEntryWithAuthority(pool, input, authority);
    },
    resolve(input: SafetyProductionResolveInput) {
      return runSafetyProductionResolveWithAuthority(pool, input, authority);
    },
  });
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
