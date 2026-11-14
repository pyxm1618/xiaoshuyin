/**
 * Slice 14 bounded phone-use Contract Scene semantics.
 *
 * This module derives node conditions and writes typed Scene Artifacts only.
 * It is not a topology/router owner and never writes formal Contract truth.
 */
import type pg from 'pg';
import { z } from 'zod';
import {
  getCurrentActivePhoneUseContract,
  getLatestSceneArtifact,
  insertSceneArtifact,
  isParticipationProcessingAllowed,
  lockParticipationById,
  type StoredSceneRef,
} from '@xiaoshuyin/domain';
import {
  DIGITAL_USE_PACKAGE_VERSION,
  PHONE_USE_CONTRACT_CONTENT_VERSION,
  PHONE_USE_CONTRACT_QUIZ,
  resolvePhoneUseContractContent,
} from '@xiaoshuyin/scenes/digital-use';
import type { DigitalUseConditionState } from '@xiaoshuyin/scenes/digital-use';

export interface PhoneUseSceneSemanticContext {
  readonly tx: pg.PoolClient;
  readonly actor: { readonly accountId: string; readonly personId: string };
  readonly familyId: string;
  readonly caseId: string;
  readonly nodeCode: string;
  readonly response: Readonly<Record<string, unknown>>;
  readonly currentInputRefs: readonly StoredSceneRef[];
}

export interface PhoneUseSceneSemanticResult {
  readonly inputRefs: readonly StoredSceneRef[];
  readonly outputRefs: readonly StoredSceneRef[];
  readonly conditions: Readonly<Record<string, DigitalUseConditionState>>;
  readonly progression: 'ROUTE' | 'HOLD' | 'COMPLETE_NO_ROUTE';
  readonly nextInputRefs?: readonly StoredSceneRef[];
  readonly holdReasonCode?: 'PHONE_USE_CONTRACT_QUIZ_NOT_PASSED' | 'PHONE_USE_CONTRACT_SUPPORT_RECORDED';
  readonly completeReasonCode?: string;
}

function semanticError(code='SCENE_RESPONSE_INVALID'): never {
  throw Object.assign(new Error(code), { code });
}

const Versioned = z.strictObject({
  contentVersion: z.string().min(1).max(128),
});
const A4001Response = Versioned.extend({
  answers: z.array(z.boolean()).length(5),
});
const A4002Response = Versioned.extend({
  action: z.literal('ACKNOWLEDGE_TEMPLATE'),
});
const A4004Response = z.strictObject({
  tool: z.enum(['DURATION','SUPERVISION','INCENTIVE','BREACH','SELF_REGULATION']),
});
const Term = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('VALUE'), value: z.string().trim().min(1).max(8000) }),
  z.strictObject({ state: z.literal('NOT_APPLICABLE'), reason: z.string().trim().min(1).max(2000) }),
  z.strictObject({ state: z.literal('PENDING') }),
]);
const ToolTermResponse = z.strictObject({ term: Term });
const A4006Response = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('CONFIGURE'), term: Term }),
  z.strictObject({ action: z.literal('LOG'), note: z.string().trim().min(1).max(4000) }),
]);
const ActiveContractRef = z.strictObject({
  contractVersionId: z.string().uuid(),
  contractVersion: z.number().int().min(1).max(2147483647),
});
const A4011Response = z.discriminatedUnion('action', [
  ActiveContractRef.extend({
    action: z.literal('FAQ_VIEWED'),
    topic: z.string().trim().min(1).max(120),
  }),
  ActiveContractRef.extend({ action: z.literal('PERIOD_COMPLETE') }),
  ActiveContractRef.extend({ action: z.literal('NEW_PROBLEM') }),
  ActiveContractRef.extend({
    action: z.literal('PERSONALIZED_AI_SUPPORT'),
    prompt: z.string().trim().min(1).max(4000),
  }),
  ActiveContractRef.extend({ action: z.literal('FOLLOWUP_REMINDER') }),
]);

async function insertArtifact(
  context: PhoneUseSceneSemanticContext,
  artifactType:
    | 'PHONE_USE_CONTRACT_QUIZ_ATTEMPT'
    | 'PHONE_USE_CONTRACT_TOOL_SELECTION'
    | 'PHONE_USE_DURATION_COMPONENT'
    | 'PHONE_USE_SUPERVISION_COMPONENT'
    | 'PHONE_USE_SUPERVISION_LOG'
    | 'PHONE_USE_INCENTIVE_COMPONENT'
    | 'PHONE_USE_BREACH_COMPONENT'
    | 'PARENT_SELF_REGULATION_CHECKLIST'
    | 'PHONE_USE_CONTRACT_SUPPORT_LOG',
  data: Record<string, unknown>
): Promise<StoredSceneRef> {
  const previous=await getLatestSceneArtifact(context.tx,context.caseId,artifactType);
  const artifact=await insertSceneArtifact(context.tx,{
    familyId:context.familyId,
    caseId:context.caseId,
    scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,
    artifactType,
    schemaVersion:'v1',
    sourceNodeCode:context.nodeCode as
      | 'A4001'|'A4004'|'A4005'|'A4006'|'A4007'|'A4008'|'A4009'|'A4011',
    data: {
      contentVersion: PHONE_USE_CONTRACT_CONTENT_VERSION,
      ...data,
    },
    ownerPersonId:context.actor.personId,
    sourceRefs:context.currentInputRefs,
    revision:previous===null?1:previous.revision+1,
    ...(previous ? { supersedesId: previous.id } : {}),
  });
  return {type:'SCENE_ARTIFACT',id:artifact.id};
}

async function handleA4001(context:PhoneUseSceneSemanticContext):Promise<PhoneUseSceneSemanticResult>{
  const parsed=A4001Response.safeParse(context.response);
  if(!parsed.success) semanticError();
  resolvePhoneUseContractContent(parsed.data.contentVersion);
  const results=parsed.data.answers.map((answer,index)=>{
    const expected=PHONE_USE_CONTRACT_QUIZ[index]!.answer;
    return {
      questionId:PHONE_USE_CONTRACT_QUIZ[index]!.id,
      correct:answer===expected,
      submittedAnswer:answer,
      explanation:PHONE_USE_CONTRACT_QUIZ[index]!.explanation,
    };
  });
  const allCorrect=results.every(item=>item.correct);
  const ref=await insertArtifact(context,'PHONE_USE_CONTRACT_QUIZ_ATTEMPT',{
    contentVersion:parsed.data.contentVersion,
    actorPersonId:context.actor.personId,
    actorAccountId:context.actor.accountId,
    answers:parsed.data.answers,
    results,
    allCorrect,
    provenance:'AUTHENTICATED_ACTOR_INPUT',
  });
  return {
    inputRefs:context.currentInputRefs,
    outputRefs:[ref],
    conditions:allCorrect?{CONTRACT_PREP_QUIZ_COMPLETE:true}:{},
    progression:allCorrect?'ROUTE':'HOLD',
    ...(allCorrect
      ? {nextInputRefs:[ref]}
      : {holdReasonCode:'PHONE_USE_CONTRACT_QUIZ_NOT_PASSED' as const,nextInputRefs:[ref]}),
  };
}

async function handleA4002(context:PhoneUseSceneSemanticContext):Promise<PhoneUseSceneSemanticResult>{
  const parsed=A4002Response.safeParse(context.response);
  if(!parsed.success) semanticError();
  resolvePhoneUseContractContent(parsed.data.contentVersion);
  return {
    inputRefs:context.currentInputRefs,
    outputRefs:[],
    conditions:{CONTRACT_TEMPLATE_REVIEWED:true},
    progression:'ROUTE',
    nextInputRefs:context.currentInputRefs,
  };
}

async function handleA4004(context:PhoneUseSceneSemanticContext):Promise<PhoneUseSceneSemanticResult>{
  const parsed=A4004Response.safeParse(context.response);
  if(!parsed.success) semanticError();
  const ref=await insertArtifact(context,'PHONE_USE_CONTRACT_TOOL_SELECTION',{
    tool:parsed.data.tool,
    actorPersonId:context.actor.personId,
    provenance:'AUTHENTICATED_ACTOR_INPUT',
  });
  const condition={
    DURATION:'SELECT_DURATION_TOOL',
    SUPERVISION:'SELECT_SUPERVISION_TOOL',
    INCENTIVE:'SELECT_INCENTIVE_TOOL',
    BREACH:'SELECT_BREACH_TOOL',
    SELF_REGULATION:'SELECT_SELF_REGULATION_TOOL',
  }[parsed.data.tool]!;
  return {
    inputRefs:context.currentInputRefs,
    outputRefs:[ref],
    conditions:{[condition]:true},
    progression:'ROUTE',
    nextInputRefs:[ref],
  };
}

async function handleTerm(
 context:PhoneUseSceneSemanticContext,
 artifactType:'PHONE_USE_DURATION_COMPONENT'|'PHONE_USE_INCENTIVE_COMPONENT'|'PHONE_USE_BREACH_COMPONENT'|'PARENT_SELF_REGULATION_CHECKLIST'
):Promise<PhoneUseSceneSemanticResult>{
 const parsed=ToolTermResponse.safeParse(context.response);
 if(!parsed.success) semanticError();
 const ref=await insertArtifact(context,artifactType,{
   term:parsed.data.term,actorPersonId:context.actor.personId,provenance:'AUTHENTICATED_ACTOR_INPUT',
 });
 return {
   inputRefs:context.currentInputRefs,outputRefs:[ref],conditions:{},
   progression:'COMPLETE_NO_ROUTE',completeReasonCode:'PHONE_USE_CONTRACT_COMPONENT_SAVED',nextInputRefs:[ref],
 };
}

async function handleA4006(context:PhoneUseSceneSemanticContext):Promise<PhoneUseSceneSemanticResult>{
 const parsed=A4006Response.safeParse(context.response);
 if(!parsed.success) semanticError();
 const artifactType=parsed.data.action==='LOG'?'PHONE_USE_SUPERVISION_LOG':'PHONE_USE_SUPERVISION_COMPONENT';
 const ref=await insertArtifact(context,artifactType,{
   ...parsed.data,actorPersonId:context.actor.personId,provenance:'AUTHENTICATED_ACTOR_INPUT',
 });
 return {
   inputRefs:context.currentInputRefs,outputRefs:[ref],conditions:{},
   progression:'COMPLETE_NO_ROUTE',completeReasonCode:'PHONE_USE_CONTRACT_COMPONENT_SAVED',nextInputRefs:[ref],
 };
}

async function handleA4011(context:PhoneUseSceneSemanticContext):Promise<PhoneUseSceneSemanticResult>{
 const parsed=A4011Response.safeParse(context.response);
 if(!parsed.success) semanticError();

 const active=await getCurrentActivePhoneUseContract(context.tx,context.caseId,true);
 if(!active) semanticError('PHONE_USE_CONTRACT_NOT_FOUND');
 if(
   active.id!==parsed.data.contractVersionId
   || active.version!==parsed.data.contractVersion
   || active.status!=='ACTIVE'
 ) semanticError('PHONE_USE_CONTRACT_STALE_REVISION');
 resolvePhoneUseContractContent(active.source_template_version);

 const participation=await lockParticipationById(context.tx,active.child_participation_id);
 if(
   !participation
   || participation.family_id!==context.familyId
   || participation.case_id!==context.caseId
   || participation.person_id!==active.child_party_person_id
   || participation.state!=='ACTIVE'
   || !(await isParticipationProcessingAllowed(context.tx,participation.person_id))
 ) semanticError('PHONE_USE_CONTRACT_CONSENT_BLOCKED');

 if(parsed.data.action==='PERSONALIZED_AI_SUPPORT'){
   semanticError('DOWNSTREAM_AI_UNAVAILABLE');
 }
 if(parsed.data.action==='FOLLOWUP_REMINDER'){
   semanticError('PHONE_USE_FOLLOWUP_DOWNSTREAM_UNAVAILABLE');
 }
 if(parsed.data.action==='FAQ_VIEWED'){
   const ref=await insertArtifact(context,'PHONE_USE_CONTRACT_SUPPORT_LOG',{
     action:parsed.data.action,
     topic:parsed.data.topic,
     contractVersionId:active.id,
     contractVersion:active.version,
     actorPersonId:context.actor.personId,
     provenance:'AUTHENTICATED_ACTOR_INPUT',
   });
   return {
     inputRefs:context.currentInputRefs,outputRefs:[ref],conditions:{},progression:'HOLD',
     holdReasonCode:'PHONE_USE_CONTRACT_SUPPORT_RECORDED',nextInputRefs:[ref],
   };
 }
 return {
   inputRefs:context.currentInputRefs,outputRefs:[],
   conditions:{
     CONTRACT_PERIOD_COMPLETE:parsed.data.action==='PERIOD_COMPLETE',
     CONTRACT_NEW_PROBLEM:parsed.data.action==='NEW_PROBLEM',
   },
   progression:'ROUTE',
   nextInputRefs:context.currentInputRefs,
 };
}

export async function applyPhoneUseContractNodeSemantics(
 context:PhoneUseSceneSemanticContext
):Promise<PhoneUseSceneSemanticResult|null>{
 switch(context.nodeCode){
   case 'A4001': return handleA4001(context);
   case 'A4002': return handleA4002(context);
   case 'A4004': return handleA4004(context);
   case 'A4005': return handleTerm(context,'PHONE_USE_DURATION_COMPONENT');
   case 'A4006': return handleA4006(context);
   case 'A4007': return handleTerm(context,'PHONE_USE_INCENTIVE_COMPONENT');
   case 'A4008': return handleTerm(context,'PHONE_USE_BREACH_COMPONENT');
   case 'A4009': return handleTerm(context,'PARENT_SELF_REGULATION_CHECKLIST');
   case 'A4011': return handleA4011(context);
   default: return null;
 }
}
