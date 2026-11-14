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
  getLatestSceneArtifact,
  insertSceneArtifact,
  listCurrentSceneEvidenceStatements,
  recordStatement,
  type StoredSceneRef,
} from '@xiaoshuyin/domain';
import {
  DIGITAL_USE_PACKAGE_VERSION,
  buildA200401RecordMarker,
  buildSolutionSummaryArtifactData,
  buildTimelineArtifactData,
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
  getCurrentPurposeScopedConsentDecision,
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
  readonly holdReasonCode?:
    | 'INTEGRATED_TRIAGE_INSUFFICIENT'
    | 'APPROVED_INSTRUMENT_UNAVAILABLE';
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
  // Existing Consent-owner contract: this is evidence of the exact
  // confirmation/refusal statement the user accepted. Slice 12 must not
  // manufacture a substitute statement catalog or server-invented hash.
  confirmationStatementHash: z.string().regex(/^[0-9a-f]{64}$/),
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

const TimelineScalar = z.union([
  z.string().min(1).max(500),
  z.number().finite(),
  z.boolean(),
]);

const A2007Response = z.strictObject({
  timeline: z.record(z.string().min(1).max(64), TimelineScalar)
    .refine((value) => Object.keys(value).length > 0),
});

const A2010Response = z.strictObject({
  action: z.literal('GENERATE_SUMMARY'),
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
    inputRefs: context.currentInputRefs,
    outputRefs: refs,
    conditions: { A1001_ASSESSMENT_COMPLETE: true },
    evidenceBasis: basis,
    progression: 'ROUTE',
    nextInputRefs: propagatedRefs(context, refs),
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
      inputRefs: context.currentInputRefs,
      outputRefs: refs,
      conditions: {
        EMOTION_SEVERE_F: conditionState,
        EMOTION_ASSESSMENT_NON_SEVERE: conditionState,
      },
      evidenceBasis: ['EMOTION'],
      progression: 'HOLD',
      holdReasonCode: 'INTEGRATED_TRIAGE_INSUFFICIENT',
      nextInputRefs: propagatedRefs(context, refs),
    };
  }

  if (emotion.kind === 'CONFLICT') {
    return {
      inputRefs: context.currentInputRefs,
      outputRefs: refs,
      conditions: {},
      evidenceBasis: ['EMOTION'],
      completionStatus: 'BLOCKED',
      progression: 'BLOCKED',
      blockReasonCode: '01002_CONFLICT_FAMILY',
      nextInputRefs: propagatedRefs(context, refs),
    };
  }

  const hasF = emotion.value.includes('F');
  return {
    inputRefs: context.currentInputRefs,
    outputRefs: refs,
    conditions: {
      EMOTION_SEVERE_F: hasF,
      EMOTION_ASSESSMENT_NON_SEVERE: !hasF,
    },
    evidenceBasis: ['EMOTION'],
    progression: 'ROUTE',
    nextInputRefs: propagatedRefs(context, refs),
  };
}

async function handle01003(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = Response01003.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');
  await recordAssessmentStatement(
    context,
    '01003.family_relationship',
    parsed.data
  );

  // Always classify the write-after current Evidence snapshot. A submitted
  // UNKNOWN/DECLINED value cannot hide another current conflict, and a usable
  // approved current value is not downgraded merely because this actor is
  // missing-like.
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
      inputRefs: context.currentInputRefs,
      outputRefs: currentEvidenceRefs,
      conditions: {},
      evidenceBasis: integratedBasis,
      progression: 'HOLD',
      holdReasonCode: 'INTEGRATED_TRIAGE_INSUFFICIENT',
      nextInputRefs: propagatedRefs(context, currentEvidenceRefs),
    };
  }

  if (triage.outcome === 'BLOCKED') {
    return {
      inputRefs: context.currentInputRefs,
      outputRefs: currentEvidenceRefs,
      conditions: {},
      evidenceBasis: integratedBasis,
      completionStatus: 'BLOCKED',
      progression: 'BLOCKED',
      blockReasonCode: triage.reasonCode,
      nextInputRefs: propagatedRefs(context, currentEvidenceRefs),
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
      nextInputRefs: propagatedRefs(context, currentEvidenceRefs),
    };
  }

  return {
    inputRefs: context.currentInputRefs,
    outputRefs: currentEvidenceRefs,
    conditions: {
      FAMILY_CONFLICT_SEVERE_F: triage.outcome === '01006',
      ...triage.conditions,
    },
    evidenceBasis: integratedBasis,
    progression: 'ROUTE',
    nextInputRefs: propagatedRefs(context, currentEvidenceRefs),
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


async function handleA2007(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = A2007Response.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');

  const data = buildTimelineArtifactData(parsed.data.timeline);
  const previous = await getLatestSceneArtifact(context.tx, context.caseId, 'TIMELINE');
  const artifact = await insertSceneArtifact(context.tx, {
    familyId: context.familyId,
    caseId: context.caseId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    artifactType: 'TIMELINE',
    schemaVersion: 'v1',
    sourceNodeCode: 'A2007',
    data: data as Record<string, unknown>,
    ownerPersonId: context.actor.personId,
    sourceRefs: context.currentInputRefs,
    revision: previous === null ? 1 : previous.revision + 1,
    ...(previous === null ? {} : { supersedesId: previous.id }),
  });
  const ref: StoredSceneRef = { type: 'SCENE_ARTIFACT', id: artifact.id };
  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [ref],
    conditions: { TIMELINE_SET: true },
    progression: 'ROUTE',
    nextInputRefs: [ref],
  };
}


async function handleA2010(
  context: DigitalUseNodeSemanticsContext
): Promise<DigitalUseNodeSemanticResult> {
  const parsed = A2010Response.safeParse(context.response);
  if (!parsed.success) semanticError('SCENE_RESPONSE_INVALID');

  const timeline = await getLatestSceneArtifact(context.tx, context.caseId, 'TIMELINE');
  if (!timeline) semanticError('SCENE_RESPONSE_INVALID');

  const data = buildSolutionSummaryArtifactData({
    timelineArtifactId: timeline.id,
    timelineData: timeline.data,
  });
  const previousSummary = await getLatestSceneArtifact(
    context.tx,
    context.caseId,
    'SOLUTION_SUMMARY'
  );
  const artifact = await insertSceneArtifact(context.tx, {
    familyId: context.familyId,
    caseId: context.caseId,
    scenePackageVersion: DIGITAL_USE_PACKAGE_VERSION,
    artifactType: 'SOLUTION_SUMMARY',
    schemaVersion: 'v1',
    sourceNodeCode: 'A2010',
    data: data as Record<string, unknown>,
    ownerPersonId: context.actor.personId,
    sourceRefs: [
      { type: 'SCENE_ARTIFACT', id: timeline.id },
      ...context.currentInputRefs,
    ],
    revision: previousSummary === null ? 1 : previousSummary.revision + 1,
    ...(previousSummary === null ? {} : { supersedesId: previousSummary.id }),
  });
  const ref: StoredSceneRef = { type: 'SCENE_ARTIFACT', id: artifact.id };
  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [ref],
    conditions: { SOLUTION_STAGE_READY: true },
    progression: 'ROUTE',
    nextInputRefs: [ref],
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
        confirmationStatementHash: parsed.data.confirmationStatementHash,
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

  const consentRefs = context.currentInputRefs.filter(
    (ref): ref is Extract<StoredSceneRef, { type: 'CONSENT' }> =>
      ref.type === 'CONSENT'
  );
  if (consentRefs.length !== 1) {
    semanticError('SUPPLEMENTAL_ASSESSMENT_CONSENT_REQUIRED');
  }

  // Re-check the current Consent OWNER truth under the same owner scope lock.
  // The owner lock is held to outer transaction commit, serializing a
  // concurrent revoke/decision behind this 01000 command.
  const currentConsent = await getCurrentPurposeScopedConsentDecision(
    context.tx,
    {
      familyId: context.familyId,
      caseId: context.caseId,
      actor: context.actor,
      purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
    }
  );
  if (
    currentConsent === null ||
    currentConsent.decision !== 'GRANTED' ||
    currentConsent.consentRecordId !== consentRefs[0]!.id
  ) {
    semanticError('SUPPLEMENTAL_ASSESSMENT_CONSENT_REQUIRED');
  }

  // No concrete instrument/item-bank/scoring/cut-off is approved in the
  // current Authority. Persist a versioned truthful boundary, but DO NOT
  // falsely complete 01000 or route as if an assessment had run.
  const previous = await getLatestSceneArtifact(
    context.tx,
    context.caseId,
    'SUPPLEMENTAL_ASSESSMENT_BOUNDARY'
  );
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
    revision: previous === null ? 1 : previous.revision + 1,
    ...(previous === null ? {} : { supersedesId: previous.id }),
  });

  const artifactRef: StoredSceneRef = { type: 'SCENE_ARTIFACT', id: artifact.id };
  return {
    inputRefs: context.currentInputRefs,
    outputRefs: [artifactRef],
    conditions: {},
    progression: 'HOLD',
    holdReasonCode: 'APPROVED_INSTRUMENT_UNAVAILABLE',
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
    case 'A2007':
      return handleA2007(context);
    case 'A2008':
      return handleA2008(context);
    case 'A2009':
      return handleA2009(context);
    case 'A2010':
      return handleA2010(context);
    default:
      semanticError('SCENE_RESPONSE_INVALID');
  }
}


/**
 * Read-only lock-order preview for T1216.
 *
 * This does NOT decide topology and never writes. It only identifies the exact
 * responses whose final authoritative route may require Slice 8 to acquire its
 * own Family -> Case lock before the Scene shell does. The real semantic
 * handler + Slice 11 router are still executed afterwards and must agree.
 */
export async function shouldPrepareProblemFormulationHandoff(
  context: Omit<DigitalUseNodeSemanticsContext, 'currentInputRefs' | 'requestEvidence'>
): Promise<boolean> {
  if (context.nodeCode === 'A2001') {
    const parsed = A2001ChoiceResponse.safeParse(context.response);
    return parsed.success && parsed.data.choice === 'CONTINUE_DIGITAL_USE';
  }
  if (context.nodeCode === 'A2002') {
    const parsed = A2002ChoiceResponse.safeParse(context.response);
    return parsed.success && parsed.data.choice === 'CONTINUE_DIGITAL_USE';
  }
  if (context.nodeCode !== '01003') return false;

  const parsed = Response01003.safeParse(context.response);
  if (!parsed.success || parsed.data.state !== 'KNOWN') return false;

  const evidence = await loadIntegratedTriageEvidence(context.tx, context.caseId);
  const result = evaluateIntegratedTriage({
    ...evidence,
    family01003: { kind: 'VALUE', value: parsed.data.selection },
  });
  return result.outcome === 'A2003';
}
