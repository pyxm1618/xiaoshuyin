/**
 * Slice 12 — A1001 / 01002 / 01003 authoritative Evidence mapping.
 *
 * These helpers use the existing Evidence Statement writer. The assertion is
 * explicitly an authenticated actor report; it does not fabricate a child
 * Person subject or promote a user report to an independently verified Fact.
 */
import { z } from 'zod';
import {
  canonicalJson,
  recordStatement,
  type EvidenceWriteContext,
  type StoredEvidenceRef,
} from '@xiaoshuyin/domain';
import type pg from 'pg';
import type { DigitalUseConditionState } from '@xiaoshuyin/scenes/digital-use';

export const DIGITAL_USE_EVIDENCE_SCHEMA = 'DIGITAL_USE_ASSESSMENT_EVIDENCE_V1' as const;

const MissingState = z.enum(['UNKNOWN', 'NOT_COLLECTED', 'DECLINED']);
export type MissingEvidenceState = z.infer<typeof MissingState>;

const KnownMinutes = z.strictObject({
  state: z.literal('KNOWN'),
  valueMinutes: z.number().finite().min(0).max(1440),
  certainty: z.enum(['EXACT', 'ESTIMATE']),
});
const MinutesEvidence = z.union([
  KnownMinutes,
  z.strictObject({ state: MissingState }),
]);

const KnownImpact = z.strictObject({
  state: z.literal('KNOWN'),
  affected: z.boolean(),
});
const ImpactEvidence = z.union([
  KnownImpact,
  z.strictObject({ state: MissingState }),
]);

const KnownAge = z.strictObject({
  state: z.literal('KNOWN'),
  valueYears: z.number().int().min(0).max(17),
});
const AgeEvidence = z.union([
  KnownAge,
  z.strictObject({ state: MissingState }),
]);

const Device = z.enum([
  'PHONE',
  'TABLET',
  'COMPUTER',
  'GAME_CONSOLE_OR_DEVICE',
  'RELATED_DIGITAL_DEVICE',
]);

const DurationBand = z.union([
  z.strictObject({
    state: z.literal('KNOWN'),
    ageBand: z.enum(['6_11', '12_18']),
    band: z.enum(['A', 'B', 'C', 'D']),
  }),
  z.strictObject({ state: z.literal('NOT_APPLICABLE') }),
  z.strictObject({ state: MissingState }),
]);

export const A1001ResponseSchema = z.strictObject({
  age: AgeEvidence,
  devices: z.array(Device).min(1).max(16).superRefine((values, ctx) => {
    if (new Set(values).size !== values.length) {
      ctx.addIssue({ code: 'custom', message: 'duplicate device' });
    }
  }),
  purposeDurations: z.strictObject({
    learningResearchHomework: MinutesEvidence,
    necessaryContact: MinutesEvidence,
    entertainmentGamingVideoSocialNonLearning: MinutesEvidence,
  }),
  totalDuration: MinutesEvidence.optional(),
  historicalDurationBand: DurationBand.optional(),
  functionalImpact: z.strictObject({
    sleep: ImpactEvidence,
    studyOrNecessaryAffairs: ImpactEvidence,
    realWorldActivityDisplacement: ImpactEvidence,
  }),
});

const EmotionSelection = z.enum(['A', 'B', 'C', 'D', 'E', 'F']);
export const Emotion01002ResponseSchema = z.union([
  z.strictObject({
    state: z.literal('KNOWN'),
    selections: z.array(EmotionSelection).min(1).max(2).superRefine((values, ctx) => {
      if (new Set(values).size !== values.length) {
        ctx.addIssue({ code: 'custom', message: 'duplicate selection' });
      }
    }),
  }),
  z.strictObject({ state: MissingState }),
]);

export const Family01003ResponseSchema = z.union([
  z.strictObject({
    state: z.literal('KNOWN'),
    selection: EmotionSelection,
  }),
  z.strictObject({ state: MissingState }),
]);

export type A1001Response = z.infer<typeof A1001ResponseSchema>;
export type Emotion01002Response = z.infer<typeof Emotion01002ResponseSchema>;
export type Family01003Response = z.infer<typeof Family01003ResponseSchema>;

export type DigitalUseAssessmentEvidenceEnvelope =
  | {
      schema: typeof DIGITAL_USE_EVIDENCE_SCHEMA;
      nodeCode: 'A1001';
      reportKind: 'ACTOR_REPORTED';
      response: A1001Response;
    }
  | {
      schema: typeof DIGITAL_USE_EVIDENCE_SCHEMA;
      nodeCode: '01002';
      reportKind: 'ACTOR_REPORTED';
      response: Emotion01002Response;
    }
  | {
      schema: typeof DIGITAL_USE_EVIDENCE_SCHEMA;
      nodeCode: '01003';
      reportKind: 'ACTOR_REPORTED';
      response: Family01003Response;
    };

const EnvelopeSchema = z.discriminatedUnion('nodeCode', [
  z.strictObject({
    schema: z.literal(DIGITAL_USE_EVIDENCE_SCHEMA),
    nodeCode: z.literal('A1001'),
    reportKind: z.literal('ACTOR_REPORTED'),
    response: A1001ResponseSchema,
  }),
  z.strictObject({
    schema: z.literal(DIGITAL_USE_EVIDENCE_SCHEMA),
    nodeCode: z.literal('01002'),
    reportKind: z.literal('ACTOR_REPORTED'),
    response: Emotion01002ResponseSchema,
  }),
  z.strictObject({
    schema: z.literal(DIGITAL_USE_EVIDENCE_SCHEMA),
    nodeCode: z.literal('01003'),
    reportKind: z.literal('ACTOR_REPORTED'),
    response: Family01003ResponseSchema,
  }),
]);

function evidenceError(): never {
  throw Object.assign(new Error('SCENE_RESPONSE_INVALID'), { code: 'SCENE_RESPONSE_INVALID' });
}

export function parseA1001Response(value: unknown): A1001Response {
  const parsed = A1001ResponseSchema.safeParse(value);
  if (!parsed.success) evidenceError();
  return parsed.data;
}

export function parse01002Response(value: unknown): Emotion01002Response {
  const parsed = Emotion01002ResponseSchema.safeParse(value);
  if (!parsed.success) evidenceError();
  return parsed.data;
}

export function parse01003Response(value: unknown): Family01003Response {
  const parsed = Family01003ResponseSchema.safeParse(value);
  if (!parsed.success) evidenceError();
  return parsed.data;
}

export function parseDigitalUseEvidenceContent(
  content: string
): DigitalUseAssessmentEvidenceEnvelope | null {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return null;
  }
  const parsed = EnvelopeSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function unresolvedConditionState(
  state: MissingEvidenceState
): DigitalUseConditionState {
  return state;
}

async function writeActorReport(
  tx: pg.PoolClient,
  ctx: EvidenceWriteContext,
  envelope: DigitalUseAssessmentEvidenceEnvelope
): Promise<StoredEvidenceRef> {
  const result = await recordStatement(tx, ctx, {
    // This assertion represents the authenticated actor's report. It does not
    // assert a different Person subject that the Case model cannot authorize.
    subjectPersonId: ctx.actorPersonId,
    sourceKind: 'SELF_STATEMENT',
    sourcePersonId: ctx.actorPersonId,
    sourceMessageId: null,
    occurredTimeState: 'UNKNOWN',
    validFrom: null,
    validUntil: null,
    confirmationStatus: 'UNCONFIRMED',
    content: canonicalJson(envelope),
  });
  return { type: 'ASSERTION', id: result.id };
}

export async function recordA1001Evidence(
  tx: pg.PoolClient,
  ctx: EvidenceWriteContext,
  raw: unknown
): Promise<{ response: A1001Response; ref: StoredEvidenceRef }> {
  const response = parseA1001Response(raw);
  const ref = await writeActorReport(tx, ctx, {
    schema: DIGITAL_USE_EVIDENCE_SCHEMA,
    nodeCode: 'A1001',
    reportKind: 'ACTOR_REPORTED',
    response,
  });
  return { response, ref };
}

export async function record01002Evidence(
  tx: pg.PoolClient,
  ctx: EvidenceWriteContext,
  raw: unknown
): Promise<{ response: Emotion01002Response; ref: StoredEvidenceRef }> {
  const response = parse01002Response(raw);
  const ref = await writeActorReport(tx, ctx, {
    schema: DIGITAL_USE_EVIDENCE_SCHEMA,
    nodeCode: '01002',
    reportKind: 'ACTOR_REPORTED',
    response,
  });
  return { response, ref };
}

export async function record01003Evidence(
  tx: pg.PoolClient,
  ctx: EvidenceWriteContext,
  raw: unknown
): Promise<{ response: Family01003Response; ref: StoredEvidenceRef }> {
  const response = parse01003Response(raw);
  const ref = await writeActorReport(tx, ctx, {
    schema: DIGITAL_USE_EVIDENCE_SCHEMA,
    nodeCode: '01003',
    reportKind: 'ACTOR_REPORTED',
    response,
  });
  return { response, ref };
}
