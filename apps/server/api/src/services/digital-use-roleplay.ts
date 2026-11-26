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
  getComplianceProfileForUpdate,
  lockComplianceFeatureEvaluationBasis,
  type ComplianceEvaluationResult,
  type ComplianceObligation,
} from '@xiaoshuyin/compliance';
import {
  assertOrdinaryProgressionAllowedRaw,
  isSafetyHoldStatus,
  casCompleteSceneNodeState,
  casRecordSceneNodeProgress,
  casRecompleteSceneNodeState,
  ensureSceneNodeAvailable,
  getLatestSceneArtifact,
  getRoleplaySession,
  getRoleplayTurn,
  getSceneNodeState,
  getScenePackageBinding,
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
  type SceneNodeStateRow,
} from '@xiaoshuyin/domain';
import {
  DIGITAL_USE_PACKAGE_VERSION,
  DIGITAL_USE_SCENE_CODE,
  resolveDigitalUseRuntimeNode,
  routeDigitalUseTopology,
} from '@xiaoshuyin/scenes/digital-use';
import { withRlsTransaction } from '../db/tx.js';
import { isKnownAuthorizationDenial, requireFamilyAction } from '../authz.js';
import { runIdempotentCommandInTransaction } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import { assertNodeCasePreconditions, requireResolvedRoute } from './digital-use-node-response.js';
import {
  unavailableProductionRoleplayAdapter,
  type RoleplayAdapter,
  type RoleplayModelPromptAuthorityProvider,
  type RoleplayProfessionalContentAuthority,
} from './digital-use-roleplay-adapter.js';
import type { DigitalUseActor } from './digital-use-assessment.js';
import { assertCurrentDigitalUseProblemFormulation } from './digital-use-case-lifecycle.js';

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
async function lockRoleplayAuthority(
  tx:pg.PoolClient,
  input:{actor:DigitalUseActor;familyId:string;caseId:string}
){
  try {
    await requireFamilyAction(tx,{
      accountId:input.actor.accountId,personId:input.actor.personId,familyId:input.familyId,caseId:input.caseId,
      action:'CASE_RESPOND_ASSESSMENT_SCENE',purpose:'FAMILY_MANAGEMENT',
      resource:{type:'CASE',familyId:input.familyId,caseId:input.caseId},
    });
  } catch (error) {
    if (isKnownAuthorizationDenial(error)) {
      throw roleplayError('CASE_NOT_FOUND');
    }
    throw error;
  }
  if(!(await lockFamilyForPrimaryDecision(tx,input.familyId))) throw roleplayError('CASE_NOT_FOUND');
  const caseRow=await lockSceneCase(tx,input.caseId);
  if(!caseRow) throw roleplayError('CASE_NOT_FOUND');
  return caseRow;
}
async function resolveRoleplayExecution(
  tx:pg.PoolClient,
  input:{caseId:string;expectedCaseVersion:number},
  caseRow:NonNullable<Awaited<ReturnType<typeof lockSceneCase>>>,
  allowCompleted=false
){
  const node=resolveDigitalUseRuntimeNode('A4003');
  assertNodeCasePreconditions(caseRow,node,input.expectedCaseVersion);
  await assertOrdinaryProgressionAllowedRaw(tx,{caseId:input.caseId});
  await assertCurrentDigitalUseProblemFormulation(tx,input.caseId);
  const binding=await getScenePackageBinding(tx,input.caseId);
  if(binding!==DIGITAL_USE_PACKAGE_VERSION) {
    throw roleplayError(binding===null?'SCENE_NODE_UNREACHABLE':'STALE_SCENE_PACKAGE');
  }
  const scene=await getSceneNodeState(tx,input.caseId,'A4003',true);
  if(!scene || scene.scene_package_version!==DIGITAL_USE_PACKAGE_VERSION) throw roleplayError('SCENE_NODE_UNREACHABLE');
  if(
    scene.status!=='AVAILABLE'
    && scene.status!=='IN_PROGRESS'
    && !(allowCompleted&&scene.status==='COMPLETED')
  ) throw roleplayError('SCENE_NODE_UNREACHABLE');
  return {caseRow,node,scene};
}
function requireRoleplayComplianceAllow(result:ComplianceEvaluationResult){
  if(result.gate!=='ALLOW') {
    if(result.reasonCode==='COMPLIANCE_FEATURE_BLOCKED') {
      throw roleplayError('FORBIDDEN','A4003_ADULT_ONLY');
    }
    if(result.reasonCode==='COMPLIANCE_AGE_UNKNOWN'||result.reasonCode==='COMPLIANCE_PROFILE_MISSING') {
      throw roleplayError('AGE_BAND_UNKNOWN');
    }
    throw roleplayError('COMPLIANCE_BLOCKED',result.reasonCode??'COMPLIANCE_BLOCKED');
  }
  return result;
}
async function assertRoleplayCompliance(tx:pg.PoolClient,personId:string){
  // Pin mutable person/policy authority for the write-side revalidation.
  await getComplianceProfileForUpdate(tx,personId);
  await lockComplianceFeatureEvaluationBasis(tx,ROLEPLAY_FEATURE);
  const result=await evaluateComplianceAtTransactionTime(drizzle(tx),tx,{
    descriptor:ROLEPLAY_FEATURE,actorPersonId:personId,targetPersonId:personId,supportedObligations:SUPPORTED_ROLEPLAY_OBLIGATIONS,
  });
  return requireRoleplayComplianceAllow(result);
}
function requireProfessionalContentAuthority(
  requestedVersion:string,
  authority:RoleplayProfessionalContentAuthority|undefined
):RoleplayProfessionalContentAuthority|null{
  if(
    authority===undefined ||
    authority.status!=='APPROVED_PUBLISHED' ||
    authority.version!==requestedVersion
  ) return null;
  return authority;
}

interface CurrentRoleplayModelPromptBinding {
 readonly modelRef:string;
 readonly promptVersionRef:string;
 readonly modelAuthorityRef:string;
 readonly promptAuthorityRef:string;
}

async function resolveCurrentRoleplayModelPromptAuthority(
 provider:RoleplayModelPromptAuthorityProvider|undefined
):Promise<CurrentRoleplayModelPromptBinding|null>{
 if(provider===undefined) return null;
 let authority:Awaited<ReturnType<RoleplayModelPromptAuthorityProvider>>;
 try {
  authority=await provider();
 } catch {
  return null;
 }
 if(
  authority===null
  || authority.model===null
  || authority.prompt===null
  || authority.model.status!=='CURRENT_APPROVED'
  || authority.prompt.status!=='CURRENT_APPROVED'
  || authority.model.modelRef.trim().length===0
  || authority.prompt.promptVersionRef.trim().length===0
  || authority.model.authorityRef.trim().length===0
  || authority.prompt.authorityRef.trim().length===0
 ) return null;
 return {
  modelRef:authority.model.modelRef,
  promptVersionRef:authority.prompt.promptVersionRef,
  modelAuthorityRef:authority.model.authorityRef,
  promptAuthorityRef:authority.prompt.authorityRef,
 };
}

function assertRoleplaySessionCurrent(
 session:{
  scene_package_version:string;
  professional_content_version:string;
 },
 authority:RoleplayProfessionalContentAuthority|undefined
):void{
  if(
    session.scene_package_version!==DIGITAL_USE_PACKAGE_VERSION
    || authority===undefined
    || authority.status!=='APPROVED_PUBLISHED'
    || session.professional_content_version!==authority.version
  ) throw roleplayError('PHONE_USE_CONTRACT_PACKAGE_DRIFT');
}

function modelPromptAuthorityHashBinding(
 binding:CurrentRoleplayModelPromptBinding|null
){
 return binding===null
  ? {status:'UNAVAILABLE' as const}
  : {status:'CURRENT_APPROVED' as const,...binding};
}

function sameModelPromptBinding(
 left:CurrentRoleplayModelPromptBinding,
 right:CurrentRoleplayModelPromptBinding
):boolean{
 return left.modelRef===right.modelRef
  && left.promptVersionRef===right.promptVersionRef
  && left.modelAuthorityRef===right.modelAuthorityRef
  && left.promptAuthorityRef===right.promptAuthorityRef;
}

async function adapterAvailable(
 adapter:RoleplayAdapter,
 professionalContentVersion:string,
 modelPromptAuthority:CurrentRoleplayModelPromptBinding
):Promise<boolean>{
 return adapter.isAvailable({
   scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,
   professionalContentVersion,
   featureCode:'DIGITAL_USE_ROLEPLAY_A4003',
   expectedModelRef:modelPromptAuthority.modelRef,
   expectedPromptVersionRef:modelPromptAuthority.promptVersionRef,
   modelAuthorityRef:modelPromptAuthority.modelAuthorityRef,
   promptAuthorityRef:modelPromptAuthority.promptAuthorityRef,
 });
}

async function recordRoleplayHold(
 tx:pg.PoolClient,
 scene:SceneNodeStateRow,
 reasonCode:'PROFESSIONAL_CONTENT_UNAVAILABLE'|'DOWNSTREAM_AI_UNAVAILABLE'
){
 const progressed=await casRecordSceneNodeProgress(tx,{
   caseId:scene.case_id,
   nodeCode:'A4003',
   scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,
   expectedRevision:scene.revision,
   branchReasonCodes:[reasonCode],
   inputRefs:scene.input_refs,
   outputRefs:[],
 });
 if(!progressed) throw roleplayError('STALE_NODE_REVISION');
 return {
   kind:'HOLD' as const,
   nodeCode:'A4003' as const,
   status:'IN_PROGRESS' as const,
   nodeRevision:progressed.revision,
   reasonCode,
 };
}

export interface RoleplayCommandContext {
  readonly actor:DigitalUseActor; readonly familyId:string; readonly caseId:string;
  readonly expectedCaseVersion:number; readonly idempotencyKey:string;
}

export async function createPhoneUseRoleplay(
 pool:pg.Pool,
 input:RoleplayCommandContext & {readonly professionalContentVersion:string},
 adapter:RoleplayAdapter=unavailableProductionRoleplayAdapter,
 professionalContentAuthority?:RoleplayProfessionalContentAuthority,
 modelPromptAuthorityProvider?:RoleplayModelPromptAuthorityProvider
){
 return withRlsTransaction(pool,{
  familyId:input.familyId,accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT'
 },async tx=>{
   const caseRow=await lockRoleplayAuthority(tx,input);
   if(isSafetyHoldStatus(caseRow.status)) throw roleplayError('SAFETY_HOLD_BLOCKED');
   const professionalContent=requireProfessionalContentAuthority(
     input.professionalContentVersion,
     professionalContentAuthority
   );
   const authorityAtRequest=professionalContent===null
     ? null
     : await resolveCurrentRoleplayModelPromptAuthority(modelPromptAuthorityProvider);

   const requestHash=hashPayload({
     familyId:input.familyId,
     caseId:input.caseId,
     expectedCaseVersion:input.expectedCaseVersion,
     professionalContentVersion:input.professionalContentVersion,
     modelPromptAuthority:modelPromptAuthorityHashBinding(authorityAtRequest),
   });
   const outcome=await runIdempotentCommandInTransaction(tx,{
     accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT',
     commandType:'PHONE_USE_ROLEPLAY_CREATE',idempotencyKey:input.idempotencyKey,requestHash,
   },async()=>{
     const compliance=await assertRoleplayCompliance(tx,input.actor.personId);
     const {scene}=await resolveRoleplayExecution(tx,input,caseRow);
     if(professionalContent===null){
       return {
         status:200,
         body:await recordRoleplayHold(
           tx,
           scene,
           'PROFESSIONAL_CONTENT_UNAVAILABLE'
         ),
       };
     }
     const modelPromptAuthority=await resolveCurrentRoleplayModelPromptAuthority(
       modelPromptAuthorityProvider
     );
     if(
       authorityAtRequest===null
       || modelPromptAuthority===null
     ){
       return {
         status:200,
         body:await recordRoleplayHold(tx,scene,'DOWNSTREAM_AI_UNAVAILABLE'),
       };
     }
     if(!sameModelPromptBinding(authorityAtRequest,modelPromptAuthority)){
       throw roleplayError(
         'PHONE_USE_CONTRACT_PACKAGE_DRIFT',
         'Roleplay Model / Prompt authority changed during create'
       );
     }
     if(!(await adapterAvailable(
       adapter,
       professionalContent.version,
       modelPromptAuthority
     ))){
       return {
         status:200,
         body:await recordRoleplayHold(tx,scene,'DOWNSTREAM_AI_UNAVAILABLE'),
       };
     }

     const row=await insertRoleplaySession(tx,{
       familyId:input.familyId,caseId:input.caseId,actorPersonId:input.actor.personId,
       scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,
       professionalContentVersion:professionalContent.version,
       compliancePolicyRef:`${compliance.featureCode}@${compliance.featureContractRevision}:policy-${compliance.policyVersion ?? 'none'}`,
       adapterRef:adapter.adapterRef,
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
 adapter:RoleplayAdapter=unavailableProductionRoleplayAdapter,
 professionalContentAuthority?:RoleplayProfessionalContentAuthority,
 modelPromptAuthorityProvider?:RoleplayModelPromptAuthorityProvider
){
 return withRlsTransaction(pool,{
  familyId:input.familyId,accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT'
 },async tx=>{
   const caseRow=await lockRoleplayAuthority(tx,input);
   if(isSafetyHoldStatus(caseRow.status)) throw roleplayError('SAFETY_HOLD_BLOCKED');
   const authorityAtRequest=await resolveCurrentRoleplayModelPromptAuthority(
     modelPromptAuthorityProvider
   );
   const requestHash=hashPayload({
     sessionId:input.sessionId,
     expectedSessionRevision:input.expectedSessionRevision,
     simulatedChildInput:input.simulatedChildInput,
     modelPromptAuthority:modelPromptAuthorityHashBinding(authorityAtRequest),
   });
   const outcome=await runIdempotentCommandInTransaction(tx,{
     accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT',
     commandType:'PHONE_USE_ROLEPLAY_TURN',idempotencyKey:input.idempotencyKey,requestHash,
   },async()=>{
     await assertRoleplayCompliance(tx,input.actor.personId);
     const {scene}=await resolveRoleplayExecution(tx,input,caseRow);
     const session=await getRoleplaySession(tx,input.sessionId,true);
     if(!session||session.case_id!==input.caseId||session.actor_person_id!==input.actor.personId) throw roleplayError('PHONE_USE_CONTRACT_NOT_FOUND');
     assertRoleplaySessionCurrent(session,professionalContentAuthority);
     if(session.status!=='OPEN'||session.revision!==input.expectedSessionRevision) throw roleplayError('PHONE_USE_CONTRACT_STALE_REVISION');
     const modelPromptAuthority=await resolveCurrentRoleplayModelPromptAuthority(
       modelPromptAuthorityProvider
     );
     if(authorityAtRequest===null||modelPromptAuthority===null) {
       return {
         status:200,
         body:await recordRoleplayHold(tx,scene,'DOWNSTREAM_AI_UNAVAILABLE'),
       };
     }
     if(!sameModelPromptBinding(authorityAtRequest,modelPromptAuthority)){
       throw roleplayError(
         'PHONE_USE_CONTRACT_PACKAGE_DRIFT',
         'Roleplay Model / Prompt authority changed before generation'
       );
     }
     if(!(await adapterAvailable(
       adapter,
       session.professional_content_version,
       modelPromptAuthority
     ))) {
       return {
         status:200,
         body:await recordRoleplayHold(tx,scene,'DOWNSTREAM_AI_UNAVAILABLE'),
       };
     }
     const roundNumber=await nextRoleplayRound(tx,session.id);
     const generated=await adapter.createTurn({
       sessionId:session.id,roundNumber,simulatedChildInput:input.simulatedChildInput,actorPersonId:input.actor.personId,
       scenePackageVersion:session.scene_package_version,professionalContentVersion:session.professional_content_version,
       expectedModelRef:modelPromptAuthority.modelRef,
       expectedPromptVersionRef:modelPromptAuthority.promptVersionRef,
       modelAuthorityRef:modelPromptAuthority.modelAuthorityRef,
       promptAuthorityRef:modelPromptAuthority.promptAuthorityRef,
     });
     const currentAfterGeneration=await resolveCurrentRoleplayModelPromptAuthority(
       modelPromptAuthorityProvider
     );
     if(currentAfterGeneration===null) {
       return {
         status:200,
         body:await recordRoleplayHold(tx,scene,'DOWNSTREAM_AI_UNAVAILABLE'),
       };
     }
     if(generated.adapterRef!==session.adapter_ref){
       throw roleplayError('PHONE_USE_CONTRACT_PACKAGE_DRIFT','Roleplay adapter provenance drift');
     }
     if(
       currentAfterGeneration.modelRef!==modelPromptAuthority.modelRef
       || currentAfterGeneration.promptVersionRef!==modelPromptAuthority.promptVersionRef
       || currentAfterGeneration.modelAuthorityRef!==modelPromptAuthority.modelAuthorityRef
       || currentAfterGeneration.promptAuthorityRef!==modelPromptAuthority.promptAuthorityRef
     ){
       throw roleplayError('PHONE_USE_CONTRACT_PACKAGE_DRIFT','Roleplay Model / Prompt authority rotated during generation');
     }
     if(generated.modelRef!==currentAfterGeneration.modelRef){
       throw roleplayError('PHONE_USE_CONTRACT_PACKAGE_DRIFT','Roleplay model provenance drift');
     }
     if(generated.promptVersionRef!==currentAfterGeneration.promptVersionRef){
       throw roleplayError('PHONE_USE_CONTRACT_PACKAGE_DRIFT','Roleplay prompt provenance drift');
     }
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
 input:RoleplayCommandContext & {readonly sessionId:string;readonly turnId:string;readonly rating:number},
 professionalContentAuthority?:RoleplayProfessionalContentAuthority
){
 return withRlsTransaction(pool,{
  familyId:input.familyId,accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT'
 },async tx=>{
   const caseRow=await lockRoleplayAuthority(tx,input);
   if(isSafetyHoldStatus(caseRow.status)) throw roleplayError('SAFETY_HOLD_BLOCKED');
   const requestHash=hashPayload({sessionId:input.sessionId,turnId:input.turnId,rating:input.rating});
   const outcome=await runIdempotentCommandInTransaction(tx,{
     accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT',
     commandType:'PHONE_USE_ROLEPLAY_RATE',idempotencyKey:input.idempotencyKey,requestHash,
   },async()=>{
     await assertRoleplayCompliance(tx,input.actor.personId);
     await resolveRoleplayExecution(tx,input,caseRow);
     const session=await getRoleplaySession(tx,input.sessionId,true);
     if(!session||session.case_id!==input.caseId||session.actor_person_id!==input.actor.personId) throw roleplayError('PHONE_USE_CONTRACT_NOT_FOUND');
     assertRoleplaySessionCurrent(session,professionalContentAuthority);
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
 input:RoleplayCommandContext & {readonly sessionId:string;readonly turnId:string;readonly expectedSessionRevision:number;readonly expectedNodeRevision:number},
 professionalContentAuthority?:RoleplayProfessionalContentAuthority,
 modelPromptAuthorityProvider?:RoleplayModelPromptAuthorityProvider
){
 return withRlsTransaction(pool,{
  familyId:input.familyId,accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT'
 },async tx=>{
   // Current identity, tenant, authorization and Safety remain
   // mandatory on replay. Mutable execution preconditions belong below the
   // idempotency decision; preserve family/case lock order.
   const caseRow=await lockRoleplayAuthority(tx,input);
   // The RLS-visible Case is locked in this transaction. Only genuine Safety
   // Hold blocks a historical replay here. WAITING/CLOSED and other mutable
   // lifecycle eligibility are enforced by resolveRoleplayExecution on EXECUTE.
   if(isSafetyHoldStatus(caseRow.status)) throw roleplayError('SAFETY_HOLD_BLOCKED');
   const authorityAtRequest=await resolveCurrentRoleplayModelPromptAuthority(
     modelPromptAuthorityProvider
   );
   const requestHash=hashPayload({
     caseId:input.caseId,
     expectedCaseVersion:input.expectedCaseVersion,
     sessionId:input.sessionId,
     turnId:input.turnId,
     expectedSessionRevision:input.expectedSessionRevision,
     expectedNodeRevision:input.expectedNodeRevision,
     modelPromptAuthority:modelPromptAuthorityHashBinding(authorityAtRequest),
   });
   const outcome=await runIdempotentCommandInTransaction(tx,{
     accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT',
     commandType:'PHONE_USE_ROLEPLAY_SELECT',idempotencyKey:input.idempotencyKey,requestHash,
   },async()=>{
     await assertRoleplayCompliance(tx,input.actor.personId);
     const {scene}=await resolveRoleplayExecution(tx,input,caseRow,true);
     if(scene.revision!==input.expectedNodeRevision) throw roleplayError('STALE_NODE_REVISION');
     const correction=scene.status==='COMPLETED';
     const session=await getRoleplaySession(tx,input.sessionId,true);
     if(!session||session.case_id!==input.caseId||session.actor_person_id!==input.actor.personId) throw roleplayError('PHONE_USE_CONTRACT_NOT_FOUND');
     assertRoleplaySessionCurrent(session,professionalContentAuthority);
     const modelPromptAuthority=await resolveCurrentRoleplayModelPromptAuthority(
       modelPromptAuthorityProvider
     );
     if(authorityAtRequest===null||modelPromptAuthority===null) {
       if(correction) {
         throw roleplayError('DOWNSTREAM_AI_UNAVAILABLE','Current roleplay Model / Prompt authority unavailable');
       }
       return {
         status:200,
         body:await recordRoleplayHold(tx,scene,'DOWNSTREAM_AI_UNAVAILABLE'),
       };
     }
     if(!sameModelPromptBinding(authorityAtRequest,modelPromptAuthority)){
       throw roleplayError(
         'PHONE_USE_CONTRACT_PACKAGE_DRIFT',
         'Roleplay Model / Prompt authority changed before selection'
       );
     }
     if(correction&&session.status!=='COMPLETED') throw roleplayError('PHONE_USE_CONTRACT_STALE_REVISION');
     if(!correction&&session.status!=='OPEN') throw roleplayError('PHONE_USE_CONTRACT_STALE_REVISION');
     const turn=await getRoleplayTurn(tx,session.id,input.turnId);
     if(!turn) throw roleplayError('PHONE_USE_CONTRACT_NOT_FOUND');
     if(
       turn.model_ref!==modelPromptAuthority.modelRef
       || turn.prompt_version_ref!==modelPromptAuthority.promptVersionRef
     ) {
       throw roleplayError('PHONE_USE_CONTRACT_PACKAGE_DRIFT','Selected roleplay turn is not current Model / Prompt provenance');
     }
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
         modelRef:turn.model_ref,
         promptVersionRef:turn.prompt_version_ref,
         modelAuthorityRef:modelPromptAuthority.modelAuthorityRef,
         promptAuthorityRef:modelPromptAuthority.promptAuthorityRef,
       },
       ownerPersonId:input.actor.personId,sourceRefs:scene.input_refs,revision:previous===null?1:previous.revision+1,
       ...(previous?{supersedesId:previous.id}:{}),
     });
     const outputRefs=[{type:'SCENE_ARTIFACT' as const,id:artifact.id}];
     let completed;
     let routeReasonCode:string;
     let nextNodeCode:string|null=null;
     if(correction){
       completed=await casRecompleteSceneNodeState(tx,{
         caseId:input.caseId,nodeCode:'A4003',scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,
         expectedRevision:input.expectedNodeRevision,
         branchReasonCodes:['SIMULATION_SELECTION_CORRECTED'],inputRefs:scene.input_refs,outputRefs,
       });
       if(!completed) throw roleplayError('STALE_NODE_REVISION');
       routeReasonCode='SIMULATION_SELECTION_CORRECTED';
     }else{
       completed=await casCompleteSceneNodeState(tx,{
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
       routeReasonCode=routed.reasonCode;
       nextNodeCode='A4004';
       const next=resolveDigitalUseRuntimeNode(routed.nextNodeCode);
       await ensureSceneNodeAvailable(tx,{
         familyId:input.familyId,caseId:input.caseId,scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,
         nodeCode:next.nodeCode,sourceNodeCode:next.sourceNodeCode,branchReasonCodes:[routed.reasonCode],inputRefs:outputRefs,
       });
     }
     await insertDigitalUseNodeCompletedEvent(tx,{
       familyId:input.familyId,caseId:input.caseId,actorAccountId:input.actor.accountId,
       scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,nodeCode:'A4003',nodeRevision:completed.revision,
       routeReasonCode,inputRefs:scene.input_refs,outputRefs,nextNodeCode,terminalCode:null,
     });
     await insertDigitalUseNodeCompletedAudit(tx,{
       familyId:input.familyId,caseId:input.caseId,actorAccountId:input.actor.accountId,
       scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,nodeCode:'A4003',nodeRevision:completed.revision,
       routeReasonCode,nextNodeCode,terminalCode:null,
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
