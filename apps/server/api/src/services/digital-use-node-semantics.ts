/**
 * Slice 12 — one bounded node-semantics composition point.
 *
 * Node-specific Evidence / Consent / Artifact handling lives here task-by-task.
 * This module is not a router: it derives authoritative conditions and refs
 * only. Slice 11 routeDigitalUseTopology() remains the sole topology owner.
 */
import type pg from 'pg';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  canonicalJson,
  insertSceneArtifact,
  listCurrentSceneEvidenceStatements,
  recordStatement,
  type StoredSceneRef,
} from '@xiaoshuyin/domain';
import {
  DIGITAL_USE_PACKAGE_VERSION,
  buildA200401RecordMarker,
  evaluateIntegratedTriage,
} from '@xiaoshuyin/scenes/digital-use';
import type {
  DigitalUseConditionState,
  DigitalUseEvidenceBasisCategory,
} from '@xiaoshuyin/scenes/digital-use';
import {
  APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY,
  CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE,
  DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
  PurposeScopedConsentError,
  recordPurposeScopedConsentDecision,
} from '@xiaoshuyin/compliance';
import { loadIntegratedTriageEvidence } from './digital-use-triage-evidence.js';

export interface DigitalUseNodeSemanticsContext {
  readonly tx: pg.PoolClient;
  readonly actor: { readonly accountId: string; readonly personId: string };
  readonly familyId: string;
  readonly caseId: string;
  readonly nodeCode: string;
  readonly response: Readonly<Record<string, unknown>>;
  readonly currentInputRefs: readonly StoredSceneRef[];
  readonly requestEvidence?: {
    readonly clientIp: string | null;
    readonly userAgent: string | null;
    readonly pepper: string;
  };
}

export interface DigitalUseNodeSemanticResult {
  readonly inputRefs: readonly StoredSceneRef[];
  readonly outputRefs: readonly StoredSceneRef[];
  readonly conditions: Readonly<Record<string, DigitalUseConditionState>>;
  readonly evidenceBasis?: readonly DigitalUseEvidenceBasisCategory[];
  readonly completionStatus?: 'COMPLETED' | 'SKIPPED' | 'BLOCKED';
  readonly nextInputRefs?: readonly StoredSceneRef[];
  /** Legal collected-but-insufficient response: retain Evidence, do not route. */
  readonly progression?: 'ROUTE' | 'HOLD' | 'BLOCKED';
  readonly holdReasonCode?: 'INTEGRATED_TRIAGE_INSUFFICIENT';
  readonly blockReasonCode?: string;
}

function semanticError(code: string): never {
  throw Object.assign(new Error(code), { code });
}

const UnresolvedState = z.enum(['UNKNOWN', 'NOT_COLLECTED', 'DECLINED']);

const DurationAnswer = z.union([
  z.strictObject({
    state: z.literal('KNOWN'),
    minutesPerDay: z.number().finite().min(0).max(1440),
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
}).superRefine((value, ctx) => {
  if (
    value.historicalDurationBand !== undefined &&
    (
      value.reportedAgeYears === undefined ||
      value.reportedAgeYears < 6 ||
      value.reportedAgeYears > 18
    )
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['historicalDurationBand'],
      message: 'historical duration band is only approved for reported ages 6–18',
    });
  }
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

const Response01004 = z.strictObject({
  decision: z.enum(['GRANTED', 'DECLINED']),
});

const Response01000 = z.strictObject({
  category: z.enum(['EMOTION', 'PARENT_CHILD_INTERACTION']),
});

const TextAnswer = z.union([
  z.strictObject({ state: z.literal('KNOWN'), text: z.string().min(1).max(2000) }),
  z.strictObject({ state: UnresolvedState }),
]);

const A2003Response = z.strictObject({
  expectedDuration: DurationAnswer,
  reason: TextAnswer,
  priorMethods: TextAnswer,
  observedEffect: TextAnswer,
  difficulties: TextAnswer,
});

const A2004Response = z.strictObject({
  decision: z.enum([
    'YES',
    'NO',
    'ASKED_WHY',
    'TRIED_BEFORE_NOT_WORKED',
    'UNKNOWN',
    'DECLINED',
  ]),
});

const A2005Response = z.strictObject({
  decision: z.enum([
    'WILLING',
    'UNWILLING',
    'TRIED_BEFORE_NOT_WORKED',
    'UNKNOWN',
    'DECLINED',
  ]),
});

const WillingnessResponse = z.strictObject({
  decision: z.enum(['WILLING', 'UNWILLING', 'UNKNOWN', 'DECLINED']),
});

const AgreementResponse = z.strictObject({
  decision: z.enum(['AGREE', 'DISAGREE', 'UNKNOWN', 'DECLINED']),
});

const A2001ChoiceResponse = z.strictObject({
  choice: z.enum(['GENERAL_ADVICE', 'CONTINUE_DIGITAL_USE', 'OTHER_CONTENT']),
});

const A2002ChoiceResponse = z.strictObject({
  choice: z.enum(['FURTHER_ASSESSMENT', 'CONTINUE_DIGITAL_USE', 'OTHER_CONTENT']),
});

const ExplicitExitResponse = z.strictObject({
  action: z.literal('EXIT'),
});

const ReturnMainResponse = z.strictObject({
  action: z.literal('RETURN_MAIN'),
});

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
  await recordAssessmentStatement(context, '01002.emotion', parsed.data);

  // Re-read the authoritative current Evidence family after the write. The
  // submitted payload alone is never allowed to erase another current source,
  // an Evidence conflict group or a disputed current statement.
  const evidence = await loadIntegratedTriageEvidence(context.tx, context.caseId);
  const emotion = evidence.emotion01002;
  const refs: StoredSceneRef[] = (
    await listCurrentSceneEvidenceStatements(
      context.tx,
      context.caseId,
      'DUA:v1:01002.emotion:'
    )
  ).map((row) => ({ type: 'ASSERTION' as const, id: row.id }));

  if (emotion.kind === 'MISSING') {
    const conditionState =
      emotion.reason === 'DECLINED'
        ? 'DECLINED'
        : emotion.reason === 'NOT_COLLECTED'
          ? 'NOT_COLLECTED'
          : 'UNKNOWN';
    return {
      inputRefs: [],
      outputRefs: refs,
      conditions: {
        EMOTION_SEVERE_F: conditionState,
        EMOTION_ASSESSMENT_NON_SEVERE: conditionState,
      },
      evidenceBasis: ['EMOTION'],
      progression: 'HOLD',
      holdReasonCode: 'INTEGRATED_TRIAGE_INSUFFICIENT',
      nextInputRefs: refs,
    };
  }

  if (emotion.kind === 'CONFLICT') {
    return {
      inputRefs: [],
      outputRefs: refs,
      conditions: {},
      evidenceBasis: ['EMOTION'],
      completionStatus: 'BLOCKED',
      progression: 'BLOCKED',
      blockReasonCode: '01002_CONFLICT_FAMILY',
      nextInputRefs: refs,
    };
  }

  const hasF = emotion.value.includes('F');
  return {
    inputRefs: [],
    outputRefs: refs,
    conditions: {
      EMOTION_SEVERE_F: hasF,
      EMOTION_ASSESSMENT_NON_SEVERE: !hasF,
    },
    evidenceBasis: ['EMOTION'],
    progression: 'ROUTE',
    nextInputRefs: refs,
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

  const evidence = await loadIntegratedTriageEvidence(context.tx, context.caseId);
  const triage = evaluateIntegratedTriage(evidence);
  const currentEvidenceRefs: StoredSceneRef[] = (
    await listCurrentSceneEvidenceStatements(context.tx, context.caseId, 'DUA:v1:')
  ).map((row) => ({ type: 'ASSERTION' as const, id: row.id }));

  const integratedBasis: DigitalUseEvidenceBasisCategory[] = [
    'FUNCTIONAL_IMPACT',
    'SLEEP',
    'REAL_WORLD_ACTIVITY_DISPLACEMENT',
    'EMOTION',
    'FAMILY_RELATIONSHIP_OR_CONFLICT',
  ];

  if (triage.outcome === 'INSUFFICIENT') {
    return {
      inputRefs: [],
      outputRefs: currentEvidenceRefs,
      conditions: {},
      evidenceBasis: integratedBasis,
      progression: 'HOLD',
      holdReasonCode: 'INTEGRATED_TRIAGE_INSUFFICIENT',
      nextInputRefs: currentEvidenceRefs,
    };
  }

  if (triage.outcome === 'BLOCKED') {
    return {
      inputRefs: [],
      outputRefs: currentEvidenceRefs,
      conditions: {},
      evidenceBasis: integratedBasis,
      completionStatus: 'BLOCKED',
      progression: 'BLOCKED',
      blockReasonCode: triage.reasonCode,
      nextInputRefs: currentEvidenceRefs,
    };
  }

  if (triage.outcome === '01005') {
    // A valid 01002F must have exited at 01002. Reaching 01003 with current
    // Evidence now requiring 01005 indicates stale/re-entered progression.
    // Slice 12 cannot invent a 01003->01005 edge outside the Slice 11 manifest.
    return {
      inputRefs: [],
      outputRefs: currentEvidenceRefs,
      conditions: {},
      evidenceBasis: integratedBasis,
      completionStatus: 'BLOCKED',
      progression: 'BLOCKED',
      blockReasonCode: '01002_PRIORITY_ROUTE_STALE_AT_01003',
      nextInputRefs: currentEvidenceRefs,
    };
  }

  return {
    inputRefs: [],
    outputRefs: currentEvidenceRefs,
    conditions: {
      FAMILY_CONFLICT_SEVERE_F: triage.outcome === '01006',
      ...triage.conditions,
    },
    evidenceBasis: integratedBasis,
    progression: 'ROUTE',
    nextInputRefs: currentEvidenceRefs,
  };
}



function propagatedRefs(
  context: DigitalUseNodeSemanticsContext,
  added: readonly StoredSceneRef[]
): StoredSceneRef[] {
  const seen = new Set<string>();
  const result: StoredSceneRef[] = [];
  for (const ref of [...context.currentInputRefs, ...added]) {
    const key =
      ref.type === 'RECORD_MARKER'
        ? `RECORD_MARKER:${ref.markerCode}:${ref.evidenceRefs.map((item) => item.id).join(',')}`
        : `${ref.type}:${ref.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ref);
  }
  return result;
}


async function handleA2001(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = A2001ChoiceResponse.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');
  const ref = await recordAssessmentStatement(context, 'a2001.user_choice', parsed.data);
  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [ref],
    conditions: {
      USER_WANTS_GENERAL_ADVICE: parsed.data.choice === 'GENERAL_ADVICE',
      USER_CONTINUES_DIGITAL_USE: parsed.data.choice === 'CONTINUE_DIGITAL_USE',
      USER_WANTS_OTHER_CONTENT: parsed.data.choice === 'OTHER_CONTENT',
    },
    progression: 'ROUTE',
    nextInputRefs: propagatedRefs(context, [ref]),
  };
}

async function handleA1000(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = ReturnMainResponse.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');
  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [],
    conditions: { RETURN_MAIN: true },
    progression: 'ROUTE',
    nextInputRefs: context.currentInputRefs,
  };
}

async function handleA2002(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = A2002ChoiceResponse.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');
  const ref = await recordAssessmentStatement(context, 'a2002.user_choice', parsed.data);
  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [ref],
    conditions: {
      USER_ACCEPTS_FURTHER_ASSESSMENT: parsed.data.choice === 'FURTHER_ASSESSMENT',
      USER_CONTINUES_DIGITAL_USE: parsed.data.choice === 'CONTINUE_DIGITAL_USE',
      USER_WANTS_OTHER_CONTENT: parsed.data.choice === 'OTHER_CONTENT',
    },
    progression: 'ROUTE',
    nextInputRefs: propagatedRefs(context, [ref]),
  };
}

async function handlePriorityExit(
  context: DigitalUseNodeSemanticsContext,
  condition: 'PRIORITY_EMOTION_EXIT' | 'PRIORITY_CONFLICT_EXIT'
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = ExplicitExitResponse.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');
  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [],
    conditions: { [condition]: true },
    progression: 'ROUTE',
    nextInputRefs: context.currentInputRefs,
  };
}

async function handleA2003(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = A2003Response.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');

  const evidenceRefs: StoredSceneRef[] = [
    await recordAssessmentStatement(context, 'a2003.expected_duration', parsed.data.expectedDuration),
    await recordAssessmentStatement(context, 'a2003.reason', parsed.data.reason),
    await recordAssessmentStatement(context, 'a2003.prior_methods', parsed.data.priorMethods),
    await recordAssessmentStatement(context, 'a2003.observed_effect', parsed.data.observedEffect),
    await recordAssessmentStatement(context, 'a2003.difficulties', parsed.data.difficulties),
  ];
  const onlyEvidence = evidenceRefs.map((ref) => {
    if (ref.type !== 'ASSERTION') semanticError('INTERNAL_ERROR');
    return { type: 'ASSERTION' as const, id: ref.id };
  });
  const marker = buildA200401RecordMarker(onlyEvidence);
  if (marker.type !== 'RECORD_MARKER') semanticError('INTERNAL_ERROR');
  const markerRef: StoredSceneRef = marker;

  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [...evidenceRefs, markerRef],
    conditions: { PARENT_EXPECTATION_CAPTURED: true },
    progression: 'ROUTE',
    nextInputRefs: propagatedRefs(context, [markerRef, ...evidenceRefs]),
  };
}

async function handleA2004(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = A2004Response.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');
  const ref = await recordAssessmentStatement(context, 'a2004.collaborative_duration', parsed.data);
  const yes = parsed.data.decision === 'YES';
  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [ref],
    conditions: {
      COLLABORATIVE_DURATION_YES: yes,
      COLLABORATIVE_DURATION_NO: !yes,
    },
    progression: 'ROUTE',
    nextInputRefs: propagatedRefs(context, [ref]),
  };
}

async function handleA2005(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = A2005Response.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');
  const ref = await recordAssessmentStatement(context, 'a2005.solution_willingness', parsed.data);
  const willing = parsed.data.decision === 'WILLING';
  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [ref],
    conditions: {
      SOLUTION_APPROACH_WILLING: willing,
      SOLUTION_APPROACH_UNWILLING: !willing,
    },
    progression: 'ROUTE',
    nextInputRefs: propagatedRefs(context, [ref]),
  };
}

async function handleA2006(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = WillingnessResponse.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');
  const marker = context.currentInputRefs.find(
    (ref) => ref.type === 'RECORD_MARKER' && ref.markerCode === 'A200401'
  );
  if (!marker) semanticError('SCENE_RESPONSE_INVALID');
  const ref = await recordAssessmentStatement(context, 'a2006.motivation_reconsider', parsed.data);
  const willing = parsed.data.decision === 'WILLING';
  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [ref],
    conditions: {
      MOTIVATION_RECONSIDER_WILLING: willing,
      MOTIVATION_RECONSIDER_UNWILLING: !willing,
    },
    progression: 'ROUTE',
    nextInputRefs: propagatedRefs(context, [ref]),
  };
}

async function handleA2008(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = AgreementResponse.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');
  const marker = context.currentInputRefs.find(
    (ref) => ref.type === 'RECORD_MARKER' && ref.markerCode === 'A200401'
  );
  if (!marker) semanticError('SCENE_RESPONSE_INVALID');
  const ref = await recordAssessmentStatement(context, 'a2008.family_alliance_agreement', parsed.data);
  const agreed = parsed.data.decision === 'AGREE';
  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [ref],
    conditions: {
      FAMILY_ALLIANCE_AGREED: agreed,
      FAMILY_ALLIANCE_DECLINED: !agreed,
    },
    progression: 'ROUTE',
    nextInputRefs: propagatedRefs(context, [ref]),
  };
}

async function handleA2009(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = AgreementResponse.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');
  const ref = await recordAssessmentStatement(context, 'a2009.relationship_assessment', parsed.data);
  const agreed = parsed.data.decision === 'AGREE';
  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [ref],
    conditions: {
      RELATIONSHIP_ASSESSMENT_AGREED: agreed,
      RELATIONSHIP_ASSESSMENT_DECLINED: !agreed,
    },
    progression: 'ROUTE',
    nextInputRefs: propagatedRefs(context, [ref]),
  };
}

function confirmationReceiptHash(decision: 'GRANTED' | 'DECLINED'): string {
  return createHash('sha256')
    .update(
      [
        DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
        CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE.reference,
        CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE.version,
        CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE.hash,
        decision,
      ].join('\n'),
      'utf8'
    )
    .digest('hex');
}

async function handle01004(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = Response01004.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');
  if (context.requestEvidence === undefined) semanticError('INTERNAL_ERROR');

  let decisionRef: Awaited<ReturnType<typeof recordPurposeScopedConsentDecision>>;
  try {
    decisionRef = await recordPurposeScopedConsentDecision(
      context.tx,
      {
        familyId: context.familyId,
        caseId: context.caseId,
        actor: context.actor,
        purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
        decision: parsed.data.decision,
        expectedVersion: null,
        disclosure: {
          reference: CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE.reference,
          version: CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE.version,
          hash: CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE.hash,
        },
        confirmationStatementHash: confirmationReceiptHash(parsed.data.decision),
        sceneAuthorization: { nodeCode: '01004', verified: true },
        evidence: context.requestEvidence,
      },
      APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY
    );
  } catch (error) {
    if (error instanceof PurposeScopedConsentError) {
      if (error.code === 'CONSENT_DISCLOSURE_NOT_APPROVED') {
        semanticError('SUPPLEMENTAL_ASSESSMENT_CONSENT_REQUIRED');
      }
      if (
        error.code === 'CONSENT_STALE_VERSION' ||
        error.code === 'CONSENT_DECISION_CONFLICT'
      ) {
        semanticError('SCENE_RESPONSE_INVALID');
      }
    }
    throw error;
  }

  const ref: StoredSceneRef = {
    type: 'CONSENT',
    id: decisionRef.consentRecordId,
  };
  const granted = parsed.data.decision === 'GRANTED';
  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [ref],
    conditions: {
      CONSENT_ACCEPTED: granted,
      CONSENT_DECLINED: !granted,
    },
    progression: 'ROUTE',
    nextInputRefs: [ref],
  };
}

async function handle01000(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = Response01000.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');

  // No concrete instrument/item-bank/scoring/cut-off is approved in the
  // current Authority. Persist the truthful boundary instead of generating one.
  const artifact = await insertSceneArtifact(context.tx, {
    familyId: context.familyId,
    caseId: context.caseId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    artifactType: 'SUPPLEMENTAL_ASSESSMENT_BOUNDARY',
    schemaVersion: 'v1',
    sourceNodeCode: '01000',
    data: {
      category: parsed.data.category,
      status: 'APPROVED_INSTRUMENT_UNAVAILABLE',
      approvedInstrument: null,
      questionnaire: null,
      scoring: null,
      cutoff: null,
      diagnosis: null,
      generated: false,
    },
    ownerPersonId: context.actor.personId,
    sourceRefs: context.currentInputRefs,
    revision: 1,
  });

  const artifactRef: StoredSceneRef = { type: 'SCENE_ARTIFACT', id: artifact.id };
  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [artifactRef],
    conditions: { SUPPLEMENTAL_ASSESSMENT_COMPLETE: true },
    progression: 'ROUTE',
    nextInputRefs: [artifactRef],
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
    case '01004':
      return handle01004(context);
    case '01000':
      return handle01000(context);
    case 'A2001':
      return handleA2001(context);
    case 'A1000':
      return handleA1000(context);
    case 'A2002':
      return handleA2002(context);
    case '01005':
      return handlePriorityExit(context, 'PRIORITY_EMOTION_EXIT');
    case '01006':
      return handlePriorityExit(context, 'PRIORITY_CONFLICT_EXIT');
    case 'A2003':
      return handleA2003(context);
    case 'A2004':
      return handleA2004(context);
    case 'A2005':
      return handleA2005(context);
    case 'A2006':
      return handleA2006(context);
    case 'A2008':
      return handleA2008(context);
    case 'A2009':
      return handleA2009(context);
    default:
      semanticError('SCENE_RESPONSE_INVALID');
  }
}
