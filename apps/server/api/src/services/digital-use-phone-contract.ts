/**
 * Slice 14 authoritative phone-use Contract commands.
 *
 * Contract lifecycle truth lives only in digital_use_contract_versions.
 * Scene Artifact is a projection; Manifest/Router, Safety, Compliance,
 * Consent/Participation, Authorization, idempotency, Case Event and Audit
 * remain their existing owners.
 */
import type pg from 'pg';
import {
  assertOrdinaryProgressionAllowedRaw,
  casCompleteSceneNodeState,
  casReenterCompletedSceneNode,
  ensureSceneNodeAvailable,
  getCurrentActivePhoneUseContract,
  getCurrentPhoneUseContract,
  getLatestSceneArtifact,
  getPhoneUseContractVersion,
  getSceneNodeState,
  getScenePackageBinding,
  hashPayload,
  insertDigitalUseNodeCompletedAudit,
  insertDigitalUseNodeCompletedEvent,
  insertPhoneUseBusinessAudit,
  insertPhoneUseContractDraft,
  insertSceneArtifact,
  isParticipationProcessingAllowed,
  lockFamilyForPrimaryDecision,
  lockParticipationById,
  lockSceneCase,
  nextPhoneUseContractVersion,
  recordAdultContractConfirmationCas,
  recordChildContractConfirmationCas,
  supersedePhoneUseContractCas,
  activatePhoneUseContractCas,
  updatePhoneUseContractDraftCas,
  validateSceneRefs,
  type ContractTermPayload,
  type PhoneUseContractConfirmation,
  type PhoneUseContractVersionRow,
  type StoredSceneRef,
} from '@xiaoshuyin/domain';
import {
  DIGITAL_USE_PACKAGE_VERSION,
  DIGITAL_USE_SCENE_CODE,
  PHONE_USE_CONTRACT_CONTENT_VERSION,
  resolveDigitalUseRuntimeNode,
  resolvePhoneUseContractContent,
  routeDigitalUseTopology,
} from '@xiaoshuyin/scenes/digital-use';
import type { PhoneUseContractTermsType } from '@xiaoshuyin/contracts';
import { withRlsTransaction } from '../db/tx.js';
import {
  decideFamilyAction,
  requireFamilyAction,
  requirePhoneUseContractChildConfirmation,
} from '../authz.js';
import { runIdempotentCommandInTransaction } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import {
  assertAssessmentCompliance,
  type DigitalUseActor,
} from './digital-use-assessment.js';
import { assertNodeCasePreconditions, requireResolvedRoute } from './digital-use-node-response.js';

function contractError(code:string,message?:string):Error & {statusCode:number;code:string}{
  const mapped=toHttpError(code,message);
  return Object.assign(new Error(mapped.message),{statusCode:mapped.statusCode,code:mapped.code});
}
function toStoredRefs(refs:readonly unknown[]):readonly StoredSceneRef[]{
  return refs as readonly StoredSceneRef[];
}
function term(value:PhoneUseContractTermsType[keyof PhoneUseContractTermsType]):ContractTermPayload{
  return value as ContractTermPayload;
}
function dto(row:PhoneUseContractVersionRow){
  return {
    id:row.id,familyId:row.family_id,caseId:row.case_id,version:row.version,draftRevision:row.draft_revision,status:row.status,
    adultPartyPersonId:row.adult_party_person_id,childPartyPersonId:row.child_party_person_id,childParticipationId:row.child_participation_id,
    terms:{
      purpose:row.contract_purpose,phoneUseRules:row.phone_use_rules,executionPeriod:row.execution_period,
      parentSupportMeasures:row.parent_support_measures,supervisionMeasures:row.supervision_measures,
      incentives:row.incentives,breachResponsibilities:row.breach_responsibilities,
    },
    sourceTemplateVersion:row.source_template_version,dependencyRefs:row.dependency_refs,
    parentConfirmation:row.parent_confirmation,childConfirmation:row.child_confirmation,
    supersedesId:row.supersedes_id,updateReason:row.update_reason,updateTrigger:row.update_trigger,
    createdByPersonId:row.created_by_person_id,createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString(),
    activatedAt:row.activated_at?new Date(row.activated_at).toISOString():null,
    supersededAt:row.superseded_at?new Date(row.superseded_at).toISOString():null,
    pausedAt:row.paused_at?new Date(row.paused_at).toISOString():null,
  };
}
async function authorizeManager(
 tx:pg.PoolClient,input:{actor:DigitalUseActor;familyId:string;caseId:string},action:'CASE_READ_ASSESSMENT_SCENE'|'CASE_RESPOND_ASSESSMENT_SCENE'
){
 await requireFamilyAction(tx,{
  accountId:input.actor.accountId,personId:input.actor.personId,familyId:input.familyId,caseId:input.caseId,
  action,purpose:'FAMILY_MANAGEMENT',resource:{type:'CASE',familyId:input.familyId,caseId:input.caseId},
 });
}
async function lockManagerContractCase(
 tx:pg.PoolClient,
 input:{actor:DigitalUseActor;familyId:string;caseId:string;expectedCaseVersion:number},
 nodeCode:'A4010'|'A4012'
){
 await authorizeManager(tx,input,'CASE_RESPOND_ASSESSMENT_SCENE');
 if(!(await lockFamilyForPrimaryDecision(tx,input.familyId))) throw contractError('CASE_NOT_FOUND');
 const caseRow=await lockSceneCase(tx,input.caseId);
 if(!caseRow) throw contractError('CASE_NOT_FOUND');
 const node=resolveDigitalUseRuntimeNode(nodeCode);
 assertNodeCasePreconditions(caseRow,node,input.expectedCaseVersion);
 await assertOrdinaryProgressionAllowedRaw(tx,{caseId:input.caseId});
 await assertAssessmentCompliance(tx,input.actor.personId);
 const binding=await getScenePackageBinding(tx,input.caseId);
 if(binding!==DIGITAL_USE_PACKAGE_VERSION) throw contractError(binding===null?'SCENE_NODE_UNREACHABLE':'STALE_SCENE_PACKAGE');
 return {caseRow,node};
}
async function ensureContractNode(
 tx:pg.PoolClient,
 input:{familyId:string;caseId:string;nodeCode:'A4010'|'A4012';inputRefs:readonly StoredSceneRef[]}
){
 const manifest=resolveDigitalUseRuntimeNode(input.nodeCode);
 if(!manifest.entryMode.includes('USER_INITIATED')) throw contractError('SCENE_NODE_UNREACHABLE');
 let existing=await getSceneNodeState(tx,input.caseId,input.nodeCode,true);
 if(existing?.status==='COMPLETED'){
   const reentered=await casReenterCompletedSceneNode(tx,{
     caseId:input.caseId,nodeCode:input.nodeCode,scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,
     expectedRevision:existing.revision,branchReasonCodes:['USER_INITIATED_REENTRY'],inputRefs:input.inputRefs,
   });
   if(!reentered) throw contractError('STALE_NODE_REVISION');
   existing=reentered;
 }
 if(existing){
   if(existing.status!=='AVAILABLE'&&existing.status!=='IN_PROGRESS') throw contractError('SCENE_NODE_UNREACHABLE');
   return existing;
 }
 if(input.nodeCode==='A4010'){
   const catalog=await getSceneNodeState(tx,input.caseId,'A4004',true);
   if(!catalog||catalog.status!=='COMPLETED') throw contractError('PHONE_USE_CONTRACT_ILLEGAL_ENTRY');
 }
 return ensureSceneNodeAvailable(tx,{
   familyId:input.familyId,caseId:input.caseId,scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,
   nodeCode:manifest.nodeCode,sourceNodeCode:manifest.sourceNodeCode,
   branchReasonCodes:['USER_INITIATED_CONTRACT_ENTRY'],inputRefs:input.inputRefs,
 });
}
async function assertDependencies(
 tx:pg.PoolClient,input:{familyId:string;caseId:string;dependencyRefs:readonly unknown[]}
){
 const refs=toStoredRefs(input.dependencyRefs);
 if(!(await validateSceneRefs(tx,{familyId:input.familyId,caseId:input.caseId,refs}))){
   throw contractError('PHONE_USE_CONTRACT_INVALID_PAYLOAD','Dependency refs are outside the authorized Case');
 }
 return refs;
}
async function assertChildParticipation(
 tx:pg.PoolClient,input:{familyId:string;caseId:string;childPersonId:string;participationId:string}
){
 const p=await lockParticipationById(tx,input.participationId);
 if(!p||p.family_id!==input.familyId||p.case_id!==input.caseId||p.person_id!==input.childPersonId||p.state!=='ACTIVE'){
   throw contractError('PHONE_USE_CONTRACT_INVALID_PAYLOAD','Child participation is not current');
 }
 if(!(await isParticipationProcessingAllowed(tx,p.person_id))) throw contractError('PHONE_USE_CONTRACT_CONSENT_BLOCKED');
 return p;
}
function confirmation(input:{
 kind:'ADULT'|'CHILD';actor:DigitalUseActor;draftRevision:number;authorizationAction:string;participationId?:string
}):PhoneUseContractConfirmation{
 return {
  kind:input.kind,accountId:input.actor.accountId,personId:input.actor.personId,draftRevision:input.draftRevision,
  confirmedAt:new Date().toISOString(),authorizationAction:input.authorizationAction,
  ...(input.participationId?{participationId:input.participationId}:{}),
 };
}

export async function getPhoneUseContractCurrent(
 pool:pg.Pool,input:{actor:DigitalUseActor;familyId:string;caseId:string}
){
 const managerDecision=await withRlsTransaction(pool,{
  familyId:input.familyId,accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT'
 },tx=>decideFamilyAction(tx,{
  accountId:input.actor.accountId,personId:input.actor.personId,familyId:input.familyId,caseId:input.caseId,
  action:'CASE_READ_ASSESSMENT_SCENE',purpose:'FAMILY_MANAGEMENT',resource:{type:'CASE',familyId:input.familyId,caseId:input.caseId},
 }));
 if(managerDecision.decision==='ALLOW'){
  return withRlsTransaction(pool,{
   familyId:input.familyId,accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT'
  },async tx=>{
    await authorizeManager(tx,input,'CASE_READ_ASSESSMENT_SCENE');
    const row=await getCurrentPhoneUseContract(tx,input.caseId);
    if(!row) throw contractError('PHONE_USE_CONTRACT_NOT_FOUND');
    return dto(row);
  });
 }
 return withRlsTransaction(pool,{
  familyId:input.familyId,accountId:input.actor.accountId,personId:input.actor.personId,purpose:'PHONE_USE_CONTRACT'
 },async tx=>{
   const row=await getCurrentPhoneUseContract(tx,input.caseId);
   if(!row) throw contractError('PHONE_USE_CONTRACT_NOT_FOUND');
   const p=await assertChildParticipation(tx,{
     familyId:input.familyId,caseId:input.caseId,childPersonId:row.child_party_person_id,participationId:row.child_participation_id,
   });
   await requirePhoneUseContractChildConfirmation(tx,{
     accountId:input.actor.accountId,personId:input.actor.personId,familyId:input.familyId,caseId:input.caseId,contract:row,participation:p,
   });
   await assertAssessmentCompliance(tx,input.actor.personId);
   return dto(row);
 });
}

export async function createPhoneUseContractDraft(
 pool:pg.Pool,
 input:{
  actor:DigitalUseActor;familyId:string;caseId:string;expectedCaseVersion:number;idempotencyKey:string;
  adultPartyPersonId:string;childPartyPersonId:string;childParticipationId:string;sourceTemplateVersion:string;
  dependencyRefs:readonly unknown[];terms:PhoneUseContractTermsType;
 }
){
 return withRlsTransaction(pool,{
  familyId:input.familyId,accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT'
 },async tx=>{
  await lockManagerContractCase(tx,input,'A4010');
  if(input.adultPartyPersonId!==input.actor.personId||input.childPartyPersonId===input.actor.personId) throw contractError('PHONE_USE_CONTRACT_UNAUTHORIZED');
  resolvePhoneUseContractContent(input.sourceTemplateVersion);
  const refs=await assertDependencies(tx,input);
  await assertChildParticipation(tx,{familyId:input.familyId,caseId:input.caseId,childPersonId:input.childPartyPersonId,participationId:input.childParticipationId});
  await ensureContractNode(tx,{familyId:input.familyId,caseId:input.caseId,nodeCode:'A4010',inputRefs:refs});
  if(await getCurrentActivePhoneUseContract(tx,input.caseId,true)) throw contractError('PHONE_USE_CONTRACT_INVALID_PAYLOAD','Use A4012 revision for an active Contract');
  const requestHash=hashPayload({
   familyId:input.familyId,caseId:input.caseId,expectedCaseVersion:input.expectedCaseVersion,
   adultPartyPersonId:input.adultPartyPersonId,childPartyPersonId:input.childPartyPersonId,childParticipationId:input.childParticipationId,
   sourceTemplateVersion:input.sourceTemplateVersion,dependencyRefs:input.dependencyRefs,terms:input.terms,
  });
  const outcome=await runIdempotentCommandInTransaction(tx,{
   accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT',
   commandType:'PHONE_USE_CONTRACT_DRAFT_SAVE',idempotencyKey:input.idempotencyKey,requestHash,
  },async()=>{
   const current=await getCurrentPhoneUseContract(tx,input.caseId);
   if(current&&current.status!=='SUPERSEDED') throw contractError('PHONE_USE_CONTRACT_STALE_REVISION','Open draft already exists');
   const version=await nextPhoneUseContractVersion(tx,input.caseId);
   const row=await insertPhoneUseContractDraft(tx,{
    familyId:input.familyId,caseId:input.caseId,version,
    adultPartyPersonId:input.adultPartyPersonId,childPartyPersonId:input.childPartyPersonId,childParticipationId:input.childParticipationId,
    contractPurpose:term(input.terms.purpose),phoneUseRules:term(input.terms.phoneUseRules),executionPeriod:term(input.terms.executionPeriod),
    parentSupportMeasures:term(input.terms.parentSupportMeasures),supervisionMeasures:term(input.terms.supervisionMeasures),
    incentives:term(input.terms.incentives),breachResponsibilities:term(input.terms.breachResponsibilities),
    sourceTemplateVersion:input.sourceTemplateVersion,dependencyRefs:input.dependencyRefs,createdByPersonId:input.actor.personId,
   });
   await insertPhoneUseBusinessAudit(tx,{familyId:input.familyId,actorAccountId:input.actor.accountId,caseId:input.caseId,eventType:'PHONE_USE_CONTRACT_DRAFT_SAVED',metadata:{contractVersionId:row.id,version:row.version,draftRevision:row.draft_revision}});
   return {status:201,body:dto(row)};
  });
  if(outcome.action==='MISMATCH') throw contractError('IDEMPOTENCY_PAYLOAD_MISMATCH');
  return outcome.body;
 });
}

export async function updatePhoneUseContractDraft(
 pool:pg.Pool,
 input:{
  actor:DigitalUseActor;familyId:string;caseId:string;version:number;expectedCaseVersion:number;expectedDraftRevision:number;idempotencyKey:string;
  dependencyRefs:readonly unknown[];terms:PhoneUseContractTermsType;
 }
){
 return withRlsTransaction(pool,{
  familyId:input.familyId,accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT'
 },async tx=>{
  await lockManagerContractCase(tx,input,input.version===1?'A4010':'A4012');
  const current=await getPhoneUseContractVersion(tx,input.caseId,input.version,true);
  if(!current||current.adult_party_person_id!==input.actor.personId) throw contractError('PHONE_USE_CONTRACT_NOT_FOUND');
  resolvePhoneUseContractContent(current.source_template_version);
  const refs=await assertDependencies(tx,input);
  await assertChildParticipation(tx,{familyId:input.familyId,caseId:input.caseId,childPersonId:current.child_party_person_id,participationId:current.child_participation_id});
  const requestHash=hashPayload({caseId:input.caseId,version:input.version,expectedCaseVersion:input.expectedCaseVersion,expectedDraftRevision:input.expectedDraftRevision,dependencyRefs:input.dependencyRefs,terms:input.terms});
  const outcome=await runIdempotentCommandInTransaction(tx,{
   accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT',
   commandType:'PHONE_USE_CONTRACT_DRAFT_SAVE',idempotencyKey:input.idempotencyKey,requestHash,
  },async()=>{
   const row=await updatePhoneUseContractDraftCas(tx,{
    caseId:input.caseId,version:input.version,expectedDraftRevision:input.expectedDraftRevision,
    contractPurpose:term(input.terms.purpose),phoneUseRules:term(input.terms.phoneUseRules),executionPeriod:term(input.terms.executionPeriod),
    parentSupportMeasures:term(input.terms.parentSupportMeasures),supervisionMeasures:term(input.terms.supervisionMeasures),
    incentives:term(input.terms.incentives),breachResponsibilities:term(input.terms.breachResponsibilities),dependencyRefs:input.dependencyRefs,
   });
   if(!row) throw contractError('PHONE_USE_CONTRACT_STALE_REVISION');
   await insertPhoneUseBusinessAudit(tx,{familyId:input.familyId,actorAccountId:input.actor.accountId,caseId:input.caseId,eventType:'PHONE_USE_CONTRACT_DRAFT_SAVED',metadata:{contractVersionId:row.id,version:row.version,draftRevision:row.draft_revision,correction:true}});
   return {status:200,body:dto(row)};
  });
  if(outcome.action==='MISMATCH') throw contractError('IDEMPOTENCY_PAYLOAD_MISMATCH');
  return outcome.body;
 });
}

async function activateConfirmedContract(
 tx:pg.PoolClient,
 input:{actor:DigitalUseActor;familyId:string;caseId:string;row:PhoneUseContractVersionRow}
):Promise<PhoneUseContractVersionRow>{
 const row=input.row;
 if(!row.parent_confirmation||!row.child_confirmation) return row;
 if(row.parent_confirmation.draftRevision!==row.draft_revision||row.child_confirmation.draftRevision!==row.draft_revision){
   throw contractError('PHONE_USE_CONTRACT_MISSING_CONFIRMATION');
 }
 resolvePhoneUseContractContent(row.source_template_version);
 const refs=await assertDependencies(tx,{familyId:input.familyId,caseId:input.caseId,dependencyRefs:row.dependency_refs});
 await assertChildParticipation(tx,{familyId:input.familyId,caseId:input.caseId,childPersonId:row.child_party_person_id,participationId:row.child_participation_id});
 const nodeCode:'A4010'|'A4012'=row.supersedes_id?'A4012':'A4010';
 const scene=await ensureContractNode(tx,{familyId:input.familyId,caseId:input.caseId,nodeCode,inputRefs:refs});
 if(row.supersedes_id){
   const old=await getCurrentActivePhoneUseContract(tx,input.caseId,true);
   if(!old||old.id!==row.supersedes_id) throw contractError('PHONE_USE_CONTRACT_STALE_REVISION');
   const superseded=await supersedePhoneUseContractCas(tx,{caseId:input.caseId,version:old.version});
   if(!superseded) throw contractError('PHONE_USE_CONTRACT_STALE_REVISION');
   await insertPhoneUseBusinessAudit(tx,{familyId:input.familyId,actorAccountId:input.actor.accountId,caseId:input.caseId,eventType:'PHONE_USE_CONTRACT_SUPERSEDED',metadata:{contractVersionId:old.id,version:old.version,supersededBy:row.id}});
 }
 const active=await activatePhoneUseContractCas(tx,{caseId:input.caseId,version:row.version,expectedDraftRevision:row.draft_revision});
 if(!active) throw contractError('PHONE_USE_CONTRACT_STALE_REVISION');
 const previous=await getLatestSceneArtifact(tx,input.caseId,'PHONE_USE_CONTRACT_DOCUMENT');
 const document=await insertSceneArtifact(tx,{
   familyId:input.familyId,caseId:input.caseId,scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,
   artifactType:'PHONE_USE_CONTRACT_DOCUMENT',schemaVersion:'v1',sourceNodeCode:nodeCode,
   data:{contractVersionId:active.id,version:active.version,draftRevision:active.draft_revision,status:'ACTIVE',projection:dto(active)},
   ownerPersonId:input.actor.personId,sourceRefs:refs,revision:previous===null?1:previous.revision+1,
   ...(previous?{supersedesId:previous.id}:{}),
 });
 const outputRefs=[{type:'SCENE_ARTIFACT' as const,id:document.id}];
 const completed=await casCompleteSceneNodeState(tx,{
   caseId:input.caseId,nodeCode,scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,expectedRevision:scene.revision,status:'COMPLETED',
   branchReasonCodes:[nodeCode==='A4010'?'FORMAL_CONTRACT_CONFIRMED':'CONTRACT_VERSION_ACTIVATED'],
   inputRefs:refs,outputRefs,
 });
 if(!completed) throw contractError('STALE_NODE_REVISION');
 let nextNodeCode:string|null=null; let reasonCode='CONTRACT_VERSION_ACTIVATED';
 if(nodeCode==='A4010'){
   const routed=requireResolvedRoute(routeDigitalUseTopology({
    sceneCode:DIGITAL_USE_SCENE_CODE,packageVersion:DIGITAL_USE_PACKAGE_VERSION,currentNodeCode:'A4010',
    conditions:{FORMAL_CONTRACT_CONFIRMED:true},
   }));
   if(routed.kind!=='NODE'||routed.nextNodeCode!=='A4011') throw contractError('SCENE_ROUTE_UNRESOLVED');
   reasonCode=routed.reasonCode; nextNodeCode='A4011';
   const next=resolveDigitalUseRuntimeNode('A4011');
   await ensureSceneNodeAvailable(tx,{familyId:input.familyId,caseId:input.caseId,scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,nodeCode:next.nodeCode,sourceNodeCode:next.sourceNodeCode,branchReasonCodes:[routed.reasonCode],inputRefs:outputRefs});
 }else{
   const support=await getSceneNodeState(tx,input.caseId,'A4011',true);
   if(support?.status==='COMPLETED'){
    const reopened=await casReenterCompletedSceneNode(tx,{caseId:input.caseId,nodeCode:'A4011',scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,expectedRevision:support.revision,branchReasonCodes:['CONTRACT_VERSION_ACTIVATED'],inputRefs:outputRefs});
    if(!reopened) throw contractError('STALE_NODE_REVISION');
   }
 }
 await insertDigitalUseNodeCompletedEvent(tx,{familyId:input.familyId,caseId:input.caseId,actorAccountId:input.actor.accountId,scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,nodeCode,nodeRevision:completed.revision,routeReasonCode:reasonCode,inputRefs:refs,outputRefs,nextNodeCode,terminalCode:null});
 await insertDigitalUseNodeCompletedAudit(tx,{familyId:input.familyId,caseId:input.caseId,actorAccountId:input.actor.accountId,scenePackageVersion:DIGITAL_USE_PACKAGE_VERSION,nodeCode,nodeRevision:completed.revision,routeReasonCode:reasonCode,nextNodeCode,terminalCode:null});
 await insertPhoneUseBusinessAudit(tx,{familyId:input.familyId,actorAccountId:input.actor.accountId,caseId:input.caseId,eventType:'PHONE_USE_CONTRACT_ACTIVATED',metadata:{contractVersionId:active.id,version:active.version,draftRevision:active.draft_revision}});
 return active;
}

async function managerConfirm(
 pool:pg.Pool,input:{actor:DigitalUseActor;familyId:string;caseId:string;version:number;expectedCaseVersion:number;expectedDraftRevision:number;idempotencyKey:string}
){
 return withRlsTransaction(pool,{familyId:input.familyId,accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT'},async tx=>{
  const row0=await getPhoneUseContractVersion(tx,input.caseId,input.version,true);
  if(!row0) throw contractError('PHONE_USE_CONTRACT_NOT_FOUND');
  await lockManagerContractCase(tx,input,row0.supersedes_id?'A4012':'A4010');
  const row=await getPhoneUseContractVersion(tx,input.caseId,input.version,true);
  if(!row||row.adult_party_person_id!==input.actor.personId) throw contractError('PHONE_USE_CONTRACT_UNAUTHORIZED');
  const requestHash=hashPayload({caseId:input.caseId,version:input.version,expectedCaseVersion:input.expectedCaseVersion,expectedDraftRevision:input.expectedDraftRevision,party:'ADULT'});
  const outcome=await runIdempotentCommandInTransaction(tx,{
   accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT',commandType:'PHONE_USE_CONTRACT_CONFIRM',idempotencyKey:input.idempotencyKey,requestHash,
  },async()=>{
   const confirmed=await recordAdultContractConfirmationCas(tx,{
    caseId:input.caseId,version:input.version,expectedDraftRevision:input.expectedDraftRevision,
    confirmation:confirmation({kind:'ADULT',actor:input.actor,draftRevision:input.expectedDraftRevision,authorizationAction:'CASE_RESPOND_ASSESSMENT_SCENE'}),
   });
   if(!confirmed) throw contractError('PHONE_USE_CONTRACT_STALE_REVISION');
   await insertPhoneUseBusinessAudit(tx,{familyId:input.familyId,actorAccountId:input.actor.accountId,caseId:input.caseId,eventType:'PHONE_USE_CONTRACT_CONFIRMED',metadata:{contractVersionId:confirmed.id,version:confirmed.version,draftRevision:confirmed.draft_revision,party:'ADULT'}});
   const finalRow=await activateConfirmedContract(tx,{actor:input.actor,familyId:input.familyId,caseId:input.caseId,row:confirmed});
   return {status:200,body:dto(finalRow)};
  });
  if(outcome.action==='MISMATCH') throw contractError('IDEMPOTENCY_PAYLOAD_MISMATCH');
  return outcome.body;
 });
}

async function childConfirm(
 pool:pg.Pool,input:{actor:DigitalUseActor;familyId:string;caseId:string;version:number;expectedCaseVersion:number;expectedDraftRevision:number;idempotencyKey:string}
){
 return withRlsTransaction(pool,{familyId:input.familyId,accountId:input.actor.accountId,personId:input.actor.personId,purpose:'PHONE_USE_CONTRACT'},async tx=>{
  const row=await getPhoneUseContractVersion(tx,input.caseId,input.version,true);
  if(!row) throw contractError('PHONE_USE_CONTRACT_NOT_FOUND');
  const caseRow=await lockSceneCase(tx,input.caseId);
  if(!caseRow||caseRow.version!==input.expectedCaseVersion) throw contractError(!caseRow?'PHONE_USE_CONTRACT_NOT_FOUND':'STALE_CASE_VERSION');
  await assertOrdinaryProgressionAllowedRaw(tx,{caseId:input.caseId});
  await assertAssessmentCompliance(tx,input.actor.personId);
  const participation=await assertChildParticipation(tx,{familyId:input.familyId,caseId:input.caseId,childPersonId:row.child_party_person_id,participationId:row.child_participation_id});
  await requirePhoneUseContractChildConfirmation(tx,{accountId:input.actor.accountId,personId:input.actor.personId,familyId:input.familyId,caseId:input.caseId,contract:row,participation});
  const requestHash=hashPayload({caseId:input.caseId,version:input.version,expectedCaseVersion:input.expectedCaseVersion,expectedDraftRevision:input.expectedDraftRevision,party:'CHILD'});
  const outcome=await runIdempotentCommandInTransaction(tx,{
   accountId:input.actor.accountId,personId:input.actor.personId,purpose:'PHONE_USE_CONTRACT',commandType:'PHONE_USE_CONTRACT_CONFIRM',idempotencyKey:input.idempotencyKey,requestHash,
  },async()=>{
   const confirmed=await recordChildContractConfirmationCas(tx,{
    caseId:input.caseId,version:input.version,expectedDraftRevision:input.expectedDraftRevision,
    confirmation:confirmation({kind:'CHILD',actor:input.actor,draftRevision:input.expectedDraftRevision,authorizationAction:'PHONE_USE_CONTRACT_CONFIRM_SELF',participationId:participation.id}),
   });
   if(!confirmed) throw contractError('PHONE_USE_CONTRACT_STALE_REVISION');
   await insertPhoneUseBusinessAudit(tx,{familyId:input.familyId,actorAccountId:input.actor.accountId,caseId:input.caseId,eventType:'PHONE_USE_CONTRACT_CONFIRMED',metadata:{contractVersionId:confirmed.id,version:confirmed.version,draftRevision:confirmed.draft_revision,party:'CHILD',participationId:participation.id}});
   const finalRow=await activateConfirmedContract(tx,{actor:input.actor,familyId:input.familyId,caseId:input.caseId,row:confirmed});
   return {status:200,body:dto(finalRow)};
  });
  if(outcome.action==='MISMATCH') throw contractError('IDEMPOTENCY_PAYLOAD_MISMATCH');
  return outcome.body;
 });
}

export async function confirmPhoneUseContract(
 pool:pg.Pool,input:{actor:DigitalUseActor;familyId:string;caseId:string;version:number;expectedCaseVersion:number;expectedDraftRevision:number;idempotencyKey:string}
){
 const decision=await withRlsTransaction(pool,{familyId:input.familyId,accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT'},tx=>decideFamilyAction(tx,{
  accountId:input.actor.accountId,personId:input.actor.personId,familyId:input.familyId,caseId:input.caseId,
  action:'CASE_RESPOND_ASSESSMENT_SCENE',purpose:'FAMILY_MANAGEMENT',resource:{type:'CASE',familyId:input.familyId,caseId:input.caseId},
 }));
 return decision.decision==='ALLOW'?managerConfirm(pool,input):childConfirm(pool,input);
}

export async function revisePhoneUseContract(
 pool:pg.Pool,
 input:{actor:DigitalUseActor;familyId:string;caseId:string;expectedCaseVersion:number;expectedActiveDraftRevision:number;updateTrigger:'PERIOD_COMPLETE'|'NEW_PROBLEM';updateReason:string;idempotencyKey:string}
){
 return withRlsTransaction(pool,{familyId:input.familyId,accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT'},async tx=>{
  await lockManagerContractCase(tx,input,'A4012');
  const active=await getCurrentActivePhoneUseContract(tx,input.caseId,true);
  if(!active||active.adult_party_person_id!==input.actor.personId) throw contractError('PHONE_USE_CONTRACT_NOT_FOUND');
  if(active.draft_revision!==input.expectedActiveDraftRevision) throw contractError('PHONE_USE_CONTRACT_STALE_REVISION');
  resolvePhoneUseContractContent(PHONE_USE_CONTRACT_CONTENT_VERSION);
  await assertChildParticipation(tx,{familyId:input.familyId,caseId:input.caseId,childPersonId:active.child_party_person_id,participationId:active.child_participation_id});
  await ensureContractNode(tx,{familyId:input.familyId,caseId:input.caseId,nodeCode:'A4012',inputRefs:toStoredRefs(active.dependency_refs)});
  const requestHash=hashPayload({caseId:input.caseId,expectedCaseVersion:input.expectedCaseVersion,expectedActiveDraftRevision:input.expectedActiveDraftRevision,activeId:active.id,updateTrigger:input.updateTrigger,updateReason:input.updateReason});
  const outcome=await runIdempotentCommandInTransaction(tx,{
   accountId:input.actor.accountId,personId:input.actor.personId,purpose:'FAMILY_MANAGEMENT',commandType:'PHONE_USE_CONTRACT_REVISE',idempotencyKey:input.idempotencyKey,requestHash,
  },async()=>{
   const version=await nextPhoneUseContractVersion(tx,input.caseId);
   const row=await insertPhoneUseContractDraft(tx,{
    familyId:input.familyId,caseId:input.caseId,version,
    adultPartyPersonId:active.adult_party_person_id,childPartyPersonId:active.child_party_person_id,childParticipationId:active.child_participation_id,
    contractPurpose:active.contract_purpose,phoneUseRules:active.phone_use_rules,executionPeriod:active.execution_period,
    parentSupportMeasures:active.parent_support_measures,supervisionMeasures:active.supervision_measures,
    incentives:active.incentives,breachResponsibilities:active.breach_responsibilities,
    sourceTemplateVersion:PHONE_USE_CONTRACT_CONTENT_VERSION,dependencyRefs:active.dependency_refs,
    supersedesId:active.id,updateReason:input.updateReason,updateTrigger:input.updateTrigger,createdByPersonId:input.actor.personId,
   });
   await insertPhoneUseBusinessAudit(tx,{familyId:input.familyId,actorAccountId:input.actor.accountId,caseId:input.caseId,eventType:'PHONE_USE_CONTRACT_DRAFT_SAVED',metadata:{contractVersionId:row.id,version:row.version,draftRevision:row.draft_revision,supersedesId:active.id,updateTrigger:input.updateTrigger}});
   return {status:201,body:dto(row)};
  });
  if(outcome.action==='MISMATCH') throw contractError('IDEMPOTENCY_PAYLOAD_MISMATCH');
  return outcome.body;
 });
}


async function readProfessionalAssetGate(
  pool: pg.Pool,
  input: { actor: DigitalUseActor; familyId: string; caseId: string; nodeCode: 'A4002' | 'A4011' }
): Promise<void> {
  return withRlsTransaction(pool, {
    familyId: input.familyId,
    accountId: input.actor.accountId,
    personId: input.actor.personId,
    purpose: 'FAMILY_MANAGEMENT',
  }, async (tx) => {
    await authorizeManager(tx, input, 'CASE_READ_ASSESSMENT_SCENE');
    await assertOrdinaryProgressionAllowedRaw(tx, { caseId: input.caseId });
    await assertAssessmentCompliance(tx, input.actor.personId);
    const binding = await getScenePackageBinding(tx, input.caseId);
    if (binding !== DIGITAL_USE_PACKAGE_VERSION) {
      throw contractError(binding === null ? 'SCENE_NODE_UNREACHABLE' : 'STALE_SCENE_PACKAGE');
    }
    const node = await getSceneNodeState(tx, input.caseId, input.nodeCode);
    if (!node || (node.status !== 'AVAILABLE' && node.status !== 'IN_PROGRESS' && node.status !== 'COMPLETED')) {
      throw contractError('SCENE_NODE_UNREACHABLE');
    }
  });
}

export async function getPhoneUseContractTemplate(
  pool: pg.Pool,
  input: { actor: DigitalUseActor; familyId: string; caseId: string }
) {
  await readProfessionalAssetGate(pool, { ...input, nodeCode: 'A4002' });
  const content = resolvePhoneUseContractContent(PHONE_USE_CONTRACT_CONTENT_VERSION);
  return { meta: content.meta, ...content.template };
}

export async function getPhoneUseContractExamples(
  pool: pg.Pool,
  input: { actor: DigitalUseActor; familyId: string; caseId: string }
) {
  await readProfessionalAssetGate(pool, { ...input, nodeCode: 'A4002' });
  const content = resolvePhoneUseContractContent(PHONE_USE_CONTRACT_CONTENT_VERSION);
  return { meta: content.meta, examples: content.examples };
}

export async function getPhoneUseContractFaq(
  pool: pg.Pool,
  input: { actor: DigitalUseActor; familyId: string; caseId: string }
) {
  await readProfessionalAssetGate(pool, { ...input, nodeCode: 'A4011' });
  const content = resolvePhoneUseContractContent(PHONE_USE_CONTRACT_CONTENT_VERSION);
  return { meta: content.meta, ...content.faq };
}
