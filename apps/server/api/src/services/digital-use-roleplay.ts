/**
 * Slice 14 A4003 Phase-2 roleplay orchestration.
 * One transaction composes existing Authorization, RLS, Safety, Compliance,
 * Scene State/Artifact, idempotency, Case Event and Audit owners.
 */
import type pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  createServerFeatureDescriptor,
  evaluateComplianceAtTransactionTime,
  getComplianceProfile,
  type ComplianceObligation,
} from '@xiaoshuyin/compliance';
import {
  assertOrdinaryProgressionAllowedRaw,
  casCompleteSceneNodeState,
  ensureSceneNodeAvailable,
  getLatestSceneArtifact,
  getRoleplaySession,
  getRoleplayTurn,
  getSceneNodeState,
  hashPayload,
  insertDigitalUseNodeCompletedAudit,
  insertDigitalUseNodeCompletedEvent,
  insertRoleplaySession,
  insertRoleplayTurn,
  insertSceneArtifact,
  lockFamilyForPrimaryDecision,
  lockSceneCase,
  nextRoleplayRound,
  rateRoleplayTurnCas,
  selectRoleplayTurnCas,
} from '@xiaoshuyin/domain';
import {
  DIGITAL_USE_PACKAGE_VERSION,
  DIGITAL_USE_SCENE_CODE,
  PHONE_USE_CONTRACT_CONTENT_VERSION,
  resolveDigitalUseRuntimeNode,
  routeDigitalUseTopology,
} from '@xiaoshuyin/scenes/digital-use';
import { withRlsTransaction } from '../db/tx.js';
import { requireFamilyAction } from '../authz.js';
import { runIdempotentCommandInTransaction } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import { assertNodeCasePreconditions, requireResolvedRoute } from './digital-use-node-response.js';
import {
  unavailableProductionRoleplayAdapter,
  type RoleplayAdapter,
} from './digital-use-roleplay-adapter.js';
import type { DigitalUseActor } from './digital-use-assessment.js';

const ROLEPLAY_FEATURE=createServerFeatureDescriptor({
  featureCode:'DIGITAL_USE_ROLEPLAY_A4003',
  featureContractRevision:'v1',
  capabilityLabel:'Digital Use A4003 simulated-parent roleplay',
});
const SUPPORTED_ROLEPLAY_OBLIGATIONS=[
  'REQUIRE_GUARDIAN_CONSENT',
  'REQUIRE_MINOR_MODE',
  'REQUIRE_AI_DISCLOSURE',
  'REQUIRE_GENERATED_CONTENT_LABEL',
  'REQUIRE_USAGE_REMINDER',
] as const satisfies readonly ComplianceObligation[];

function roleplayError(code:string,message?:string):Error & {statusCode:number;code:string}{
  const mapped=toHttpError(code,message);
  return Object.assign(new Error(mapped.message),{statusCode:mapped.statusCode,code:mapped.code});
}
async function authorizeAdultRoleplay(
  tx:pg.PoolClient,
  input:{actor:DigitalUseActor;familyId:string;caseId:string;expectedCaseVersion:number}
){
  await requireFamilyAction(tx,{
    accountId:input.actor.accountId,personId:input.actor.personId,familyId:input.familyId,caseId:input.caseId,
    action:'CASE_RESPOND_ASSESSMENT_SCENE',purpose:'FAMILY_MANAGEMENT',
    resource:{type:'CASE',familyId:input.familyId,caseId:input.caseId},
  });
  if(!(await lockFamilyForPrimaryDecision(tx,input.familyId))) throw roleplayError('CASE_NOT_FOUND');
  const caseRow=await lockSceneCase(tx,input.caseId);
  if(!caseRow) throw roleplayError('CASE_NOT_FOUND');
  const node=resolveDigitalUseRuntimeNode('A4003');
  assertNodeCasePreconditions(caseRow,node,input.expectedCaseVersion);
  await assertOrdinaryProgressionAllowedRaw(tx,{caseId:input.caseId});
  const profile=await getComplianceProfile(tx,input.actor.personId);
  if(!profile || profile.age_band==='UNKNOWN') throw roleplayError('AGE_BAND_UNKNOWN');
  if(profile.age_band!=='ADULT') throw roleplayError('FORBIDDEN','A4003_ADULT_ONLY');
  const scene=await getSceneNodeState(tx,input.caseId,'A4003',true);
  if(!scene || scene.scene_package_version!==DIGITAL_USE_PACKAGE_VERSION) throw roleplayError('SCENE_NODE_UNREACHABLE');
  if(scene.status!=='AVAILABLE'&&scene.status!=='IN_PROGRESS') throw roleplayError('SCENE_NODE_UNREACHABLE');
  return {caseRow,node,scene};
}
async function assertRoleplayCompliance(tx:pg.PoolClient,personId:string){
  const result=await evaluateComplianceAtTransactionTime(drizzle(tx),tx,{
    descriptor:ROLEPLAY_FEATURE,personId,supportedObligations:SUPPORTED_ROLEPLAY_OBLIGATIONS,
  });
  if(result.gate!=='ALLOW') throw roleplayError('COMPLIANCE_BLOCKED',result.reasonCode??'COMPLIANCE_BLOCKED');
  return result;
}
async function requireAdapterAvailable(adapter:RoleplayAdapter){
  const available=await adapter.isAvailable({
    scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,
    professionalContentVersion:PHONE_USE_CONTRACT_CONTENT_VERSION,
    featureCode:'DIGITAL_USE_ROLEPLAY_A4003',
  });
  if(!available) throw roleplayError('DOWNSTREAM_AI_UNAVAILABLE');
}
export interface RoleplayCommandContext {
  readonly actor:DigitalUseActor; readonly familyId:string; readonly caseId:string;
  readonly expectedCaseVersion:number; readonly idempotencyKey:string;
}

export async function createPhoneUseRoleplay(
 pool:pg.Pool,
 input:RoleplayCommandContext & {readonly professionalContentVersion:string},
 adapter:RoleplayAdapter=unavailableProductionRoleplayAdapter
){
 return withRlsTransaction(pool,{
  familyId:input.familyId,accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT'
 },async tx=>{
   await authorizeAdultRoleplay(tx,input);
   if(input.professionalContentVersion!==PHONE_USE_CONTRACT_CONTENT_VERSION) throw roleplayError('PHONE_USE_CONTRACT_CONTENT_STALE');
   await requireAdapterAvailable(adapter);
   const compliance=await assertRoleplayCompliance(tx,input.actor.personId);
   const requestHash=hashPayload({
     familyId:input.familyId,caseId:input.caseId,expectedCaseVersion:input.expectedCaseVersion,
     professionalContentVersion:input.professionalContentVersion,
   });
   const outcome=await runIdempotentCommandInTransaction(tx,{
     accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT',
     commandType:'PHONE_USE_ROLEPLAY_CREATE',idempotencyKey:input.idempotencyKey,requestHash,
   },async()=>{
     const row=await insertRoleplaySession(tx,{
       familyId:input.familyId,caseId:input.caseId,actorPersonId:input.actor.personId,
       scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,
       professionalContentVersion:PHONE_USE_CONTRACT_CONTENT_VERSION,
       compliancePolicyRef:`${compliance.featureCode}@${compliance.featureContractRevision}:policy-${compliance.policyVersion ?? 'none'}`,
       adapterRef:'roleplay-adapter:v1',
     });
     return {status:201,body:roleplaySessionDto(row)};
   });
   if(outcome.action==='MISMATCH') throw roleplayError('IDEMPOTENCY_PAYLOAD_MISMATCH');
   return outcome.body;
 });
}

export async function addPhoneUseRoleplayTurn(
 pool:pg.Pool,
 input:RoleplayCommandContext & {readonly sessionId:string;readonly expectedSessionRevision:number;readonly simulatedChildInput:string},
 adapter:RoleplayAdapter=unavailableProductionRoleplayAdapter
){
 return withRlsTransaction(pool,{
  familyId:input.familyId,accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT'
 },async tx=>{
   await authorizeAdultRoleplay(tx,input);
   await requireAdapterAvailable(adapter);
   await assertRoleplayCompliance(tx,input.actor.personId);
   const requestHash=hashPayload({sessionId:input.sessionId,expectedSessionRevision:input.expectedSessionRevision,simulatedChildInput:input.simulatedChildInput});
   const outcome=await runIdempotentCommandInTransaction(tx,{
     accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT',
     commandType:'PHONE_USE_ROLEPLAY_TURN',idempotencyKey:input.idempotencyKey,requestHash,
   },async()=>{
     const session=await getRoleplaySession(tx,input.sessionId,true);
     if(!session||session.case_id!==input.caseId||session.actor_person_id!==input.actor.personId) throw roleplayError('PHONE_USE_CONTRACT_NOT_FOUND');
     if(session.status!=='OPEN'||session.revision!==input.expectedSessionRevision) throw roleplayError('PHONE_USE_CONTRACT_STALE_REVISION');
     const roundNumber=await nextRoleplayRound(tx,session.id);
     const generated=await adapter.createTurn({
       sessionId:session.id,roundNumber,simulatedChildInput:input.simulatedChildInput,actorPersonId:input.actor.personId,
       scenePackageVersion:session.scene_package_version,professionalContentVersion:session.professional_content_version,
     });
     const turn=await insertRoleplayTurn(tx,{
       familyId:input.familyId,caseId:input.caseId,sessionId:session.id,roundNumber,
       simulatedChildInput:input.simulatedChildInput,simulatedParentOutput:generated.simulatedParentOutput,
       modelRef:generated.modelRef,promptVersionRef:generated.promptVersionRef,
     });
     return {status:201,body:roleplayTurnDto(turn)};
   });
   if(outcome.action==='MISMATCH') throw roleplayError('IDEMPOTENCY_PAYLOAD_MISMATCH');
   return outcome.body;
 });
}

export async function ratePhoneUseRoleplay(
 pool:pg.Pool,
 input:RoleplayCommandContext & {readonly sessionId:string;readonly turnId:string;readonly rating:number}
){
 return withRlsTransaction(pool,{
  familyId:input.familyId,accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT'
 },async tx=>{
   await authorizeAdultRoleplay(tx,input);
   const requestHash=hashPayload({sessionId:input.sessionId,turnId:input.turnId,rating:input.rating});
   const outcome=await runIdempotentCommandInTransaction(tx,{
     accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT',
     commandType:'PHONE_USE_ROLEPLAY_RATE',idempotencyKey:input.idempotencyKey,requestHash,
   },async()=>{
     const session=await getRoleplaySession(tx,input.sessionId,true);
     if(!session||session.case_id!==input.caseId||session.actor_person_id!==input.actor.personId) throw roleplayError('PHONE_USE_CONTRACT_NOT_FOUND');
     const turn=await rateRoleplayTurnCas(tx,{sessionId:session.id,turnId:input.turnId,rating:input.rating});
     if(!turn) throw roleplayError('PHONE_USE_CONTRACT_NOT_FOUND');
     return {status:200,body:roleplayTurnDto(turn)};
   });
   if(outcome.action==='MISMATCH') throw roleplayError('IDEMPOTENCY_PAYLOAD_MISMATCH');
   return outcome.body;
 });
}

export async function selectPhoneUseRoleplay(
 pool:pg.Pool,
 input:RoleplayCommandContext & {readonly sessionId:string;readonly turnId:string;readonly expectedSessionRevision:number;readonly expectedNodeRevision:number}
){
 return withRlsTransaction(pool,{
  familyId:input.familyId,accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT'
 },async tx=>{
   const {scene}=await authorizeAdultRoleplay(tx,input);
   if(scene.revision!==input.expectedNodeRevision) throw roleplayError('STALE_NODE_REVISION');
   await assertRoleplayCompliance(tx,input.actor.personId);
   const requestHash=hashPayload({
     sessionId:input.sessionId,turnId:input.turnId,expectedSessionRevision:input.expectedSessionRevision,expectedNodeRevision:input.expectedNodeRevision
   });
   const outcome=await runIdempotentCommandInTransaction(tx,{
     accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT',
     commandType:'PHONE_USE_ROLEPLAY_SELECT',idempotencyKey:input.idempotencyKey,requestHash,
   },async()=>{
     const session=await getRoleplaySession(tx,input.sessionId,true);
     if(!session||session.case_id!==input.caseId||session.actor_person_id!==input.actor.personId) throw roleplayError('PHONE_USE_CONTRACT_NOT_FOUND');
     const turn=await getRoleplayTurn(tx,session.id,input.turnId);
     if(!turn) throw roleplayError('PHONE_USE_CONTRACT_NOT_FOUND');
     const selected=await selectRoleplayTurnCas(tx,{
       sessionId:session.id,expectedRevision:input.expectedSessionRevision,turnId:turn.id
     });
     if(!selected) throw roleplayError('PHONE_USE_CONTRACT_STALE_REVISION');

     const previous=await getLatestSceneArtifact(tx,input.caseId,'PHONE_USE_ROLEPLAY_SELECTION');
     const artifact=await insertSceneArtifact(tx,{
       familyId:input.familyId,caseId:input.caseId,scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,
       artifactType:'PHONE_USE_ROLEPLAY_SELECTION',schemaVersion:'v1',sourceNodeCode:'A4003',
       data:{
         roleplaySessionId:selected.id,selectedTurnId:turn.id,roundNumber:turn.round_number,
         provenance:'SIMULATION',actorPersonId:input.actor.personId,
         professionalContentVersion:selected.professional_content_version,
       },
       ownerPersonId:input.actor.personId,sourceRefs:scene.input_refs,revision:previous===null?1:previous.revision+1,
     });
     const outputRefs=[{type:'SCENE_ARTIFACT' as const,id:artifact.id}];
     const completed=await casCompleteSceneNodeState(tx,{
       caseId:input.caseId,nodeCode:'A4003',scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,
       expectedRevision:input.expectedNodeRevision,status:'COMPLETED',
       branchReasonCodes:['SIMULATION_COMPLETE'],inputRefs:scene.input_refs,outputRefs,
     });
     if(!completed) throw roleplayError('STALE_NODE_REVISION');
     const routed=requireResolvedRoute(routeDigitalUseTopology({
       sceneCode:DIGITAL_USE_SCENE_CODE,packageVersion:DIGITAL_USE_PACKAGE_VERSION,currentNodeCode:'A4003',
       conditions:{SIMULATION_COMPLETE:true},
     }));
     if(routed.kind!=='NODE'||routed.nextNodeCode!=='A4004') throw roleplayError('SCENE_ROUTE_UNRESOLVED');
     const next=resolveDigitalUseRuntimeNode(routed.nextNodeCode);
     await ensureSceneNodeAvailable(tx,{
       familyId:input.familyId,caseId:input.caseId,scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,
       nodeCode:next.nodeCode,sourceNodeCode:next.sourceNodeCode,branchReasonCodes:[routed.reasonCode],inputRefs:outputRefs,
     });
     await insertDigitalUseNodeCompletedEvent(tx,{
       familyId:input.familyId,caseId:input.caseId,actorAccountId:input.actor.accountId,
       scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,nodeCode:'A4003',nodeRevision:completed.revision,
       routeReasonCode:routed.reasonCode,inputRefs:scene.input_refs,outputRefs,nextNodeCode:'A4004',terminalCode:null,
     });
     await insertDigitalUseNodeCompletedAudit(tx,{
       familyId:input.familyId,caseId:input.caseId,actorAccountId:input.actor.accountId,
       scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,nodeCode:'A4003',nodeRevision:completed.revision,
       routeReasonCode:routed.reasonCode,nextNodeCode:'A4004',terminalCode:null,
     });
     return {status:200,body:{session:roleplaySessionDto(selected),selectedTurn:roleplayTurnDto(turn)}};
   });
   if(outcome.action==='MISMATCH') throw roleplayError('IDEMPOTENCY_PAYLOAD_MISMATCH');
   return outcome.body;
 });
}

function roleplaySessionDto(row:Awaited<ReturnType<typeof insertRoleplaySession>>){
 return {
  id:row.id,familyId:row.family_id,caseId:row.case_id,actorPersonId:row.actor_person_id,
  simulationRole:row.simulation_role,status:row.status,scenePackageVersion:row.scene_package_version,
  professionalContentVersion:row.professional_content_version,compliancePolicyRef:row.compliance_policy_ref,
  adapterRef:row.adapter_ref,selectedTurnId:row.selected_turn_id,revision:row.revision,
  createdAt:new Date(row.created_at).toISOString(),completedAt:row.completed_at?new Date(row.completed_at).toISOString():null,
 };
}
function roleplayTurnDto(row:Awaited<ReturnType<typeof insertRoleplayTurn>>){
 return {
  id:row.id,sessionId:row.session_id,roundNumber:row.round_number,
  simulatedChildInput:row.simulated_child_input,simulatedParentOutput:row.simulated_parent_output,
  provenance:row.provenance,modelRef:row.model_ref,promptVersionRef:row.prompt_version_ref,
  userRating:row.user_rating,createdAt:new Date(row.created_at).toISOString(),
 };
}
