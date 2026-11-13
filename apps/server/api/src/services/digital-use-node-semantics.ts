/**
 * Slice 12 — one bounded node-semantics composition point.
 *
 * Node-specific Evidence / Consent / Artifact handling lives here task-by-task.
 * This module is not a router: it derives authoritative conditions and refs
 * only. Slice 11 routeDigitalUseTopology() remains the sole topology owner.
 */
import type pg from 'pg';
import { z } from 'zod';
import {
  canonicalJson,
  listCurrentSceneEvidenceStatements,
  recordStatement,
  type StoredSceneRef,
} from '@xiaoshuyin/domain';
import type {
  DigitalUseConditionState,
  DigitalUseEvidenceBasisCategory,
} from '@xiaoshuyin/scenes/digital-use';

export interface DigitalUseNodeSemanticsContext {
  readonly tx: pg.PoolClient;
  readonly actor: { readonly accountId: string; readonly personId: string };
  readonly familyId: string;
  readonly caseId: string;
  readonly nodeCode: string;
  readonly response: Readonly<Record<string, unknown>>;
}

export interface DigitalUseNodeSemanticResult {
  readonly inputRefs: readonly StoredSceneRef[];
  readonly outputRefs: readonly StoredSceneRef[];
  readonly conditions: Readonly<Record<string, DigitalUseConditionState>>;
  readonly evidenceBasis?: readonly DigitalUseEvidenceBasisCategory[];
  readonly completionStatus?: 'COMPLETED' | 'SKIPPED' | 'BLOCKED';
  readonly nextInputRefs?: readonly StoredSceneRef[];
  /** Legal collected-but-insufficient response: retain Evidence, do not route. */
  readonly progression?: 'ROUTE' | 'HOLD';
  readonly holdReasonCode?: 'INTEGRATED_TRIAGE_INSUFFICIENT';
}

function semanticError(code: string): never {
  throw Object.assign(new Error(code), { code });
}

const UnresolvedState = z.enum(['UNKNOWN', 'NOT_COLLECTED', 'DECLINED']);

const DurationAnswer = z.union([
  z.strictObject({
    state: z.literal('KNOWN'),
    minutesPerDay: z.number().finite().min(0),
    certainty: z.enum(['EXACT', 'ESTIMATE']),
  }),
  z.strictObject({ state: UnresolvedState }),
]);

const ImpactAnswer = z.union([
  z.strictObject({
    state: z.literal('KNOWN'),
    impacted: z.boolean(),
  }),
  z.strictObject({ state: UnresolvedState }),
]);

const A1001Response = z.strictObject({
  reportedAgeYears: z.number().int().min(0).max(150).optional(),
  devices: z.array(z.enum([
    'PHONE',
    'TABLET',
    'COMPUTER',
    'GAME_CONSOLE_OR_DEVICE',
    'OTHER_RELATED_DIGITAL_DEVICE',
  ])).min(1).transform((values) => [...new Set(values)]),
  purposeDurations: z.strictObject({
    learningResearchHomework: DurationAnswer,
    necessaryContact: DurationAnswer,
    entertainmentGamingVideoSocialNonLearning: DurationAnswer,
  }),
  totalDuration: DurationAnswer.optional(),
  historicalDurationBand: z.enum(['A', 'B', 'C', 'D']).optional(),
  functionalImpact: z.strictObject({
    sleep: ImpactAnswer,
    studyOrNecessaryAffairs: ImpactAnswer,
    realWorldActivityDisplacement: ImpactAnswer,
  }),
});

const Known01002 = z.strictObject({
  state: z.literal('KNOWN'),
  selections: z.array(z.enum(['A', 'B', 'C', 'D', 'E', 'F']))
    .min(1)
    .max(2)
    .refine((values) => new Set(values).size === values.length),
});
const Response01002 = z.union([
  Known01002,
  z.strictObject({ state: UnresolvedState }),
]);

const Response01003 = z.union([
  z.strictObject({
    state: z.literal('KNOWN'),
    selection: z.enum(['A', 'B', 'C', 'D', 'E', 'F']),
  }),
  z.strictObject({ state: UnresolvedState }),
]);

function statementPrefix(code: string): string {
  return `DUA:v1:${code}:`;
}

/**
 * Persist a structured response only through Evidence Core. The content is a
 * server-canonicalized statement made by the authenticated manager; Scene state
 * stores only its reference. A retry on an IN_PROGRESS node supersedes the
 * actor's prior current statement for the exact same code instead of creating
 * a parallel answer truth.
 */
async function recordAssessmentStatement(
  context: DigitalUseNodeSemanticsContext,
  code: string,
  value: unknown
): Promise<StoredSceneRef> {
  const prefix = statementPrefix(code);
  const existing = await listCurrentSceneEvidenceStatements(
    context.tx,
    context.caseId,
    prefix
  );
  const actorOwned = existing.filter(
    (row) =>
      row.subject_person_id === context.actor.personId &&
      row.source_person_id === context.actor.personId
  );
  // Multiple current actor-owned rows are already a conflict. Do not silently
  // choose one predecessor and erase that fact.
  if (actorOwned.length > 1) semanticError('INTEGRATED_TRIAGE_BLOCKED');

  const result = await recordStatement(
    context.tx,
    {
      familyId: context.familyId,
      caseId: context.caseId,
      actorAccountId: context.actor.accountId,
      actorPersonId: context.actor.personId,
      purpose: 'FAMILY_MANAGEMENT',
    },
    {
      subjectPersonId: context.actor.personId,
      sourceKind: 'SELF_STATEMENT',
      sourcePersonId: context.actor.personId,
      occurredTimeState: 'UNKNOWN',
      confirmationStatus: 'UNCONFIRMED',
      ...(actorOwned[0] ? { supersedesId: actorOwned[0].id } : {}),
      content: `${prefix}${canonicalJson(value)}`,
    }
  );
  return { type: 'ASSERTION', id: result.id };
}

async function handleA1001(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = A1001Response.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');
  const value = parsed.data;

  const refs: StoredSceneRef[] = [];
  refs.push(await recordAssessmentStatement(context, 'a1001.devices', value.devices));
  if (value.reportedAgeYears !== undefined) {
    refs.push(await recordAssessmentStatement(
      context,
      'a1001.reported_age_years',
      { value: value.reportedAgeYears, authority: 'USER_REPORTED_EVIDENCE_ONLY' }
    ));
  }
  refs.push(
    await recordAssessmentStatement(
      context,
      'a1001.duration.learning_research_homework',
      value.purposeDurations.learningResearchHomework
    ),
    await recordAssessmentStatement(
      context,
      'a1001.duration.necessary_contact',
      value.purposeDurations.necessaryContact
    ),
    await recordAssessmentStatement(
      context,
      'a1001.duration.entertainment_gaming_video_social_non_learning',
      value.purposeDurations.entertainmentGamingVideoSocialNonLearning
    )
  );
  if (value.totalDuration !== undefined) {
    refs.push(await recordAssessmentStatement(
      context,
      'a1001.duration.total_auxiliary',
      value.totalDuration
    ));
  }
  if (value.historicalDurationBand !== undefined) {
    refs.push(await recordAssessmentStatement(
      context,
      'a1001.duration.historical_band_auxiliary',
      { state: 'KNOWN', band: value.historicalDurationBand }
    ));
  }
  refs.push(
    await recordAssessmentStatement(
      context,
      'a1001.impact.sleep',
      value.functionalImpact.sleep
    ),
    await recordAssessmentStatement(
      context,
      'a1001.impact.study_or_necessary_affairs',
      value.functionalImpact.studyOrNecessaryAffairs
    ),
    await recordAssessmentStatement(
      context,
      'a1001.impact.real_world_activity_displacement',
      value.functionalImpact.realWorldActivityDisplacement
    )
  );

  const basis: DigitalUseEvidenceBasisCategory[] = [
    'PURPOSE',
    'FUNCTIONAL_IMPACT',
    'SLEEP',
    'REAL_WORLD_ACTIVITY_DISPLACEMENT',
  ];
  if (value.totalDuration !== undefined) basis.push('TOTAL_DURATION');
  if (value.historicalDurationBand !== undefined) basis.push('HISTORICAL_DURATION_BAND');

  return {
    inputRefs: [],
    outputRefs: refs,
    conditions: { A1001_ASSESSMENT_COMPLETE: true },
    evidenceBasis: basis,
    progression: 'ROUTE',
  };
}

async function handle01002(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = Response01002.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');
  const answer = parsed.data;
  const ref = await recordAssessmentStatement(context, '01002.emotion', answer);

  if (answer.state !== 'KNOWN') {
    return {
      inputRefs: [],
      outputRefs: [ref],
      conditions: {
        EMOTION_SEVERE_F: answer.state,
        EMOTION_ASSESSMENT_NON_SEVERE: answer.state,
      },
      evidenceBasis: ['EMOTION'],
      progression: 'HOLD',
      holdReasonCode: 'INTEGRATED_TRIAGE_INSUFFICIENT',
    };
  }

  const hasF = answer.selections.includes('F');
  return {
    inputRefs: [],
    outputRefs: [ref],
    conditions: {
      EMOTION_SEVERE_F: hasF,
      EMOTION_ASSESSMENT_NON_SEVERE: !hasF,
    },
    evidenceBasis: ['EMOTION'],
    progression: 'ROUTE',
  };
}

async function handle01003(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = Response01003.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');
  const answer = parsed.data;
  const ref = await recordAssessmentStatement(context, '01003.family_relationship', answer);

  if (answer.state !== 'KNOWN') {
    return {
      inputRefs: [],
      outputRefs: [ref],
      conditions: { FAMILY_CONFLICT_SEVERE_F: answer.state },
      evidenceBasis: ['FAMILY_RELATIONSHIP_OR_CONFLICT'],
      progression: 'HOLD',
      holdReasonCode: 'INTEGRATED_TRIAGE_INSUFFICIENT',
    };
  }

  // T1210 owns only collection / priority-family Evidence semantics. T1211
  // adds the normal Integrated Triage conditions for non-F answers.
  return {
    inputRefs: [],
    outputRefs: [ref],
    conditions: { FAMILY_CONFLICT_SEVERE_F: answer.selection === 'F' },
    evidenceBasis: ['FAMILY_RELATIONSHIP_OR_CONFLICT'],
    progression: 'ROUTE',
  };
}

/**
 * Single node-specific dispatch point. Later tasks extend this switch; no
 * per-node service/router/state machine is created.
 */
export async function applyDigitalUseNodeSemantics(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  switch (context.nodeCode) {
    case 'A1001':
      return handleA1001(context);
    case '01002':
      return handle01002(context);
    case '01003':
      return handle01003(context);
    default:
      semanticError('SCENE_RESPONSE_INVALID');
  }
}
