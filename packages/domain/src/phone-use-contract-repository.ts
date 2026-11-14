/**
 * Slice 14 bounded persistence repository. No auth/routing/policy ownership.
 */
import type { Tx } from './repository.js';

export type PhoneUseContractStatus='DRAFT'|'PENDING_CONFIRMATION'|'ACTIVE'|'SUPERSEDED'|'PAUSED';
export type PhoneUseContractUpdateTrigger='PERIOD_COMPLETE'|'NEW_PROBLEM';
export interface ContractTermPayload { readonly state:'VALUE'|'NOT_APPLICABLE'|'PENDING'; readonly value?:string; readonly reason?:string; }
export interface PhoneUseContractConfirmation {
  readonly kind:'ADULT'|'CHILD'; readonly accountId:string; readonly personId:string;
  readonly draftRevision:number; readonly confirmedAt:string; readonly authorizationAction:string;
  readonly participationId?:string;
}
export interface PhoneUseContractVersionRow {
  id:string; family_id:string; case_id:string; version:number; draft_revision:number; status:PhoneUseContractStatus;
  adult_party_person_id:string; child_party_person_id:string; child_participation_id:string;
  contract_purpose:ContractTermPayload; phone_use_rules:ContractTermPayload; execution_period:ContractTermPayload;
  parent_support_measures:ContractTermPayload; supervision_measures:ContractTermPayload;
  incentives:ContractTermPayload; breach_responsibilities:ContractTermPayload;
  source_template_version:string; dependency_refs:unknown[];
  parent_confirmation:PhoneUseContractConfirmation|null; child_confirmation:PhoneUseContractConfirmation|null;
  supersedes_id:string|null; update_reason:string|null; update_trigger:PhoneUseContractUpdateTrigger|null;
  created_by_person_id:string; created_at:Date; updated_at:Date; activated_at:Date|null; superseded_at:Date|null; paused_at:Date|null;
}
const CONTRACT_COLUMNS=`
 id,family_id,case_id,version,draft_revision,status,
 adult_party_person_id,child_party_person_id,child_participation_id,
 contract_purpose,phone_use_rules,execution_period,parent_support_measures,supervision_measures,incentives,breach_responsibilities,
 source_template_version,dependency_refs,parent_confirmation,child_confirmation,
 supersedes_id,update_reason,update_trigger,created_by_person_id,created_at,updated_at,activated_at,superseded_at,paused_at
`;

export async function getPhoneUseContractVersion(tx:Tx,caseId:string,version:number,lock=false):Promise<PhoneUseContractVersionRow|null>{
 const {rows}=await tx.query<PhoneUseContractVersionRow>(
  `SELECT ${CONTRACT_COLUMNS} FROM digital_use_contract_versions WHERE case_id=$1 AND version=$2 ${lock?'FOR UPDATE':''}`,
  [caseId,version]); return rows[0]??null;
}
export async function getPhoneUseContractById(tx:Tx,id:string,lock=false):Promise<PhoneUseContractVersionRow|null>{
 const {rows}=await tx.query<PhoneUseContractVersionRow>(
  `SELECT ${CONTRACT_COLUMNS} FROM digital_use_contract_versions WHERE id=$1 ${lock?'FOR UPDATE':''}`,[id]);
 return rows[0]??null;
}
export async function getCurrentActivePhoneUseContract(tx:Tx,caseId:string,lock=false):Promise<PhoneUseContractVersionRow|null>{
 const {rows}=await tx.query<PhoneUseContractVersionRow>(
  `SELECT ${CONTRACT_COLUMNS} FROM digital_use_contract_versions WHERE case_id=$1 AND status='ACTIVE' ${lock?'FOR UPDATE':''}`,[caseId]);
 return rows[0]??null;
}
export async function getCurrentPhoneUseContract(tx:Tx,caseId:string):Promise<PhoneUseContractVersionRow|null>{
 const {rows}=await tx.query<PhoneUseContractVersionRow>(
  `SELECT ${CONTRACT_COLUMNS} FROM digital_use_contract_versions WHERE case_id=$1
    ORDER BY CASE status WHEN 'DRAFT' THEN 0 WHEN 'PENDING_CONFIRMATION' THEN 1 WHEN 'ACTIVE' THEN 2 WHEN 'PAUSED' THEN 3 ELSE 4 END,version DESC LIMIT 1`,
  [caseId]); return rows[0]??null;
}
export async function nextPhoneUseContractVersion(tx:Tx,caseId:string):Promise<number>{
 const {rows}=await tx.query<{next_version:number}>(`SELECT COALESCE(MAX(version),0)::integer+1 AS next_version FROM digital_use_contract_versions WHERE case_id=$1`,[caseId]);
 return rows[0]?.next_version??1;
}
export async function insertPhoneUseContractDraft(tx:Tx,input:{
 familyId:string;caseId:string;version:number;adultPartyPersonId:string;childPartyPersonId:string;childParticipationId:string;
 contractPurpose:ContractTermPayload;phoneUseRules:ContractTermPayload;executionPeriod:ContractTermPayload;
 parentSupportMeasures:ContractTermPayload;supervisionMeasures:ContractTermPayload;incentives:ContractTermPayload;breachResponsibilities:ContractTermPayload;
 sourceTemplateVersion:string;dependencyRefs:readonly unknown[];supersedesId?:string|null;updateReason?:string|null;
 updateTrigger?:PhoneUseContractUpdateTrigger|null;createdByPersonId:string;
}):Promise<PhoneUseContractVersionRow>{
 const {rows}=await tx.query<PhoneUseContractVersionRow>(
 `INSERT INTO digital_use_contract_versions(
 family_id,case_id,version,draft_revision,status,adult_party_person_id,child_party_person_id,child_participation_id,
 contract_purpose,phone_use_rules,execution_period,parent_support_measures,supervision_measures,incentives,breach_responsibilities,
 source_template_version,dependency_refs,supersedes_id,update_reason,update_trigger,created_by_person_id)
 VALUES($1,$2,$3,1,'DRAFT',$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15::jsonb,$16,$17,$18,$19)
 RETURNING ${CONTRACT_COLUMNS}`,
 [input.familyId,input.caseId,input.version,input.adultPartyPersonId,input.childPartyPersonId,input.childParticipationId,
 JSON.stringify(input.contractPurpose),JSON.stringify(input.phoneUseRules),JSON.stringify(input.executionPeriod),
 JSON.stringify(input.parentSupportMeasures),JSON.stringify(input.supervisionMeasures),JSON.stringify(input.incentives),JSON.stringify(input.breachResponsibilities),
 input.sourceTemplateVersion,JSON.stringify(input.dependencyRefs),input.supersedesId??null,input.updateReason??null,input.updateTrigger??null,input.createdByPersonId]);
 const row=rows[0]; if(!row) throw new Error('PHONE_USE_CONTRACT_INSERT_RETURNED_NO_ROW'); return row;
}
export async function updatePhoneUseContractDraftCas(tx:Tx,input:{
 caseId:string;version:number;expectedDraftRevision:number;contractPurpose:ContractTermPayload;phoneUseRules:ContractTermPayload;
 executionPeriod:ContractTermPayload;parentSupportMeasures:ContractTermPayload;supervisionMeasures:ContractTermPayload;
 incentives:ContractTermPayload;breachResponsibilities:ContractTermPayload;dependencyRefs:readonly unknown[];
}):Promise<PhoneUseContractVersionRow|null>{
 const {rows}=await tx.query<PhoneUseContractVersionRow>(
 `UPDATE digital_use_contract_versions SET contract_purpose=$4::jsonb,phone_use_rules=$5::jsonb,execution_period=$6::jsonb,
 parent_support_measures=$7::jsonb,supervision_measures=$8::jsonb,incentives=$9::jsonb,breach_responsibilities=$10::jsonb,
 dependency_refs=$11::jsonb,draft_revision=draft_revision+1,parent_confirmation=NULL,child_confirmation=NULL,status='DRAFT'
 WHERE case_id=$1 AND version=$2 AND draft_revision=$3 AND status IN('DRAFT','PENDING_CONFIRMATION') RETURNING ${CONTRACT_COLUMNS}`,
 [input.caseId,input.version,input.expectedDraftRevision,JSON.stringify(input.contractPurpose),JSON.stringify(input.phoneUseRules),
 JSON.stringify(input.executionPeriod),JSON.stringify(input.parentSupportMeasures),JSON.stringify(input.supervisionMeasures),
 JSON.stringify(input.incentives),JSON.stringify(input.breachResponsibilities),JSON.stringify(input.dependencyRefs)]);
 return rows[0]??null;
}
async function recordConfirmation(tx:Tx,input:{caseId:string;version:number;expectedDraftRevision:number;confirmation:PhoneUseContractConfirmation},column:'parent_confirmation'|'child_confirmation'){
 const {rows}=await tx.query<PhoneUseContractVersionRow>(
 `UPDATE digital_use_contract_versions SET ${column}=$4::jsonb,status='PENDING_CONFIRMATION'
 WHERE case_id=$1 AND version=$2 AND draft_revision=$3
   AND status IN('DRAFT','PENDING_CONFIRMATION')
   AND ${column} IS NULL
 RETURNING ${CONTRACT_COLUMNS}`,
 [input.caseId,input.version,input.expectedDraftRevision,JSON.stringify(input.confirmation)]);
 return rows[0]??null;
}
export function recordAdultContractConfirmationCas(tx:Tx,input:{caseId:string;version:number;expectedDraftRevision:number;confirmation:PhoneUseContractConfirmation}){
 return recordConfirmation(tx,input,'parent_confirmation');
}
export function recordChildContractConfirmationCas(tx:Tx,input:{caseId:string;version:number;expectedDraftRevision:number;confirmation:PhoneUseContractConfirmation}){
 return recordConfirmation(tx,input,'child_confirmation');
}
export async function activatePhoneUseContractCas(tx:Tx,input:{caseId:string;version:number;expectedDraftRevision:number}):Promise<PhoneUseContractVersionRow|null>{
 const {rows}=await tx.query<PhoneUseContractVersionRow>(
 `UPDATE digital_use_contract_versions SET status='ACTIVE',activated_at=now()
 WHERE case_id=$1 AND version=$2 AND draft_revision=$3 AND status IN('DRAFT','PENDING_CONFIRMATION')
 AND parent_confirmation IS NOT NULL AND child_confirmation IS NOT NULL RETURNING ${CONTRACT_COLUMNS}`,
 [input.caseId,input.version,input.expectedDraftRevision]); return rows[0]??null;
}
export async function supersedePhoneUseContractCas(tx:Tx,input:{caseId:string;version:number}):Promise<PhoneUseContractVersionRow|null>{
 const {rows}=await tx.query<PhoneUseContractVersionRow>(
 `UPDATE digital_use_contract_versions SET status='SUPERSEDED',superseded_at=now() WHERE case_id=$1 AND version=$2 AND status='ACTIVE' RETURNING ${CONTRACT_COLUMNS}`,
 [input.caseId,input.version]); return rows[0]??null;
}

export interface RoleplaySessionRow {
 id:string;family_id:string;case_id:string;actor_person_id:string;simulation_role:'ADULT_PLAYS_CHILD_AI_SIMULATES_PARENT';
 status:'OPEN'|'COMPLETED';scene_package_version:string;professional_content_version:string;compliance_policy_ref:string;adapter_ref:string;
 selected_turn_id:string|null;revision:number;created_at:Date;completed_at:Date|null;
}
export interface RoleplayTurnRow {
 id:string;family_id:string;case_id:string;session_id:string;round_number:number;simulated_child_input:string;simulated_parent_output:string;
 provenance:'SIMULATION';model_ref:string|null;prompt_version_ref:string|null;user_rating:number|null;created_at:Date;
}
const SESSION_COLUMNS=`id,family_id,case_id,actor_person_id,simulation_role,status,scene_package_version,professional_content_version,compliance_policy_ref,adapter_ref,selected_turn_id,revision,created_at,completed_at`;
const TURN_COLUMNS=`id,family_id,case_id,session_id,round_number,simulated_child_input,simulated_parent_output,provenance,model_ref,prompt_version_ref,user_rating,created_at`;
export async function insertRoleplaySession(tx:Tx,input:{familyId:string;caseId:string;actorPersonId:string;scenePackageVersion:string;professionalContentVersion:string;compliancePolicyRef:string;adapterRef:string}):Promise<RoleplaySessionRow>{
 const {rows}=await tx.query<RoleplaySessionRow>(
 `INSERT INTO roleplay_sessions(family_id,case_id,actor_person_id,simulation_role,status,scene_package_version,professional_content_version,compliance_policy_ref,adapter_ref)
 VALUES($1,$2,$3,'ADULT_PLAYS_CHILD_AI_SIMULATES_PARENT','OPEN',$4,$5,$6,$7) RETURNING ${SESSION_COLUMNS}`,
 [input.familyId,input.caseId,input.actorPersonId,input.scenePackageVersion,input.professionalContentVersion,input.compliancePolicyRef,input.adapterRef]);
 const row=rows[0]; if(!row) throw new Error('ROLEPLAY_SESSION_INSERT_RETURNED_NO_ROW'); return row;
}
export async function getRoleplaySession(tx:Tx,id:string,lock=false):Promise<RoleplaySessionRow|null>{
 const {rows}=await tx.query<RoleplaySessionRow>(`SELECT ${SESSION_COLUMNS} FROM roleplay_sessions WHERE id=$1 ${lock?'FOR UPDATE':''}`,[id]); return rows[0]??null;
}
export async function nextRoleplayRound(tx:Tx,sessionId:string):Promise<number>{
 const {rows}=await tx.query<{next_round:number}>(`SELECT COALESCE(MAX(round_number),0)::integer+1 AS next_round FROM roleplay_turns WHERE session_id=$1`,[sessionId]);
 return rows[0]?.next_round??1;
}
export async function insertRoleplayTurn(tx:Tx,input:{familyId:string;caseId:string;sessionId:string;roundNumber:number;simulatedChildInput:string;simulatedParentOutput:string;modelRef?:string|null;promptVersionRef?:string|null;}):Promise<RoleplayTurnRow>{
 const {rows}=await tx.query<RoleplayTurnRow>(
 `INSERT INTO roleplay_turns(family_id,case_id,session_id,round_number,simulated_child_input,simulated_parent_output,provenance,model_ref,prompt_version_ref)
 VALUES($1,$2,$3,$4,$5,$6,'SIMULATION',$7,$8) RETURNING ${TURN_COLUMNS}`,
 [input.familyId,input.caseId,input.sessionId,input.roundNumber,input.simulatedChildInput,input.simulatedParentOutput,input.modelRef??null,input.promptVersionRef??null]);
 const row=rows[0]; if(!row) throw new Error('ROLEPLAY_TURN_INSERT_RETURNED_NO_ROW'); return row;
}
export async function getRoleplayTurn(tx:Tx,sessionId:string,turnId:string):Promise<RoleplayTurnRow|null>{
 const {rows}=await tx.query<RoleplayTurnRow>(`SELECT ${TURN_COLUMNS} FROM roleplay_turns WHERE id=$1 AND session_id=$2`,[turnId,sessionId]); return rows[0]??null;
}
export async function rateRoleplayTurnCas(tx:Tx,input:{sessionId:string;turnId:string;rating:number}):Promise<RoleplayTurnRow|null>{
 const {rows}=await tx.query<RoleplayTurnRow>(`UPDATE roleplay_turns SET user_rating=$3 WHERE id=$1 AND session_id=$2 RETURNING ${TURN_COLUMNS}`,[input.turnId,input.sessionId,input.rating]);
 return rows[0]??null;
}
export async function selectRoleplayTurnCas(tx:Tx,input:{sessionId:string;expectedRevision:number;turnId:string}):Promise<RoleplaySessionRow|null>{
 const {rows}=await tx.query<RoleplaySessionRow>(
 `UPDATE roleplay_sessions SET selected_turn_id=$3,status='COMPLETED',completed_at=COALESCE(completed_at,now()),revision=revision+1
 WHERE id=$1 AND revision=$2 AND status IN ('OPEN','COMPLETED') AND EXISTS(SELECT 1 FROM roleplay_turns WHERE id=$3 AND session_id=roleplay_sessions.id)
 RETURNING ${SESSION_COLUMNS}`,[input.sessionId,input.expectedRevision,input.turnId]);
 return rows[0]??null;
}
export type PhoneUseBusinessAuditEvent=
 'PHONE_USE_CONTRACT_DRAFT_SAVED'|'PHONE_USE_CONTRACT_CONFIRMED'|'PHONE_USE_CONTRACT_ACTIVATED'|'PHONE_USE_CONTRACT_SUPERSEDED'|'PHONE_USE_ROLEPLAY_RECORDED';
export async function insertPhoneUseBusinessAudit(tx:Tx,input:{familyId:string;actorAccountId:string;caseId:string;eventType:PhoneUseBusinessAuditEvent;metadata:Record<string,unknown>}):Promise<void>{
 await tx.query(`INSERT INTO business_audit_events(family_id,actor_account_id,event_type,resource_type,resource_id,metadata)
 VALUES($1,$2,$3,'CASE',$4,$5::jsonb)`,[input.familyId,input.actorAccountId,input.eventType,input.caseId,JSON.stringify(input.metadata)]);
}
