/**
 * Slice 14 dedicated high-impact Contract / Roleplay APIs.
 * Ordinary node semantics remain on Slice 12's generic Scene API.
 */
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import {
  ConfirmPhoneUseContractRequest,
  CreatePhoneUseRoleplayRequest,
  CreatePhoneUseRoleplayTurnRequest,
  PhoneUseContractDto,
  PhoneUseContractExamplesResponse,
  PhoneUseContractFaqResponse,
  PhoneUseContractRuntimeError,
  PhoneUseContractTemplateResponse,
  PhoneUseRoleplaySelectionResponse,
  PhoneUseRoleplaySessionDto,
  PhoneUseRoleplayTurnDto,
  RatePhoneUseRoleplayRequest,
  RevisePhoneUseContractRequest,
  SavePhoneUseContractDraftRequest,
  SelectPhoneUseRoleplayRequest,
  UpdatePhoneUseContractDraftRequest,
} from '@xiaoshuyin/contracts';
import { withIdentityTransaction } from '../db/tx.js';
import { requireCurrentFamily } from '../family-context.js';
import { readIdempotencyKey } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import {
  confirmPhoneUseContract,
  createPhoneUseContractDraft,
  getPhoneUseContractCurrent,
  getPhoneUseContractExamples,
  getPhoneUseContractFaq,
  getPhoneUseContractTemplate,
  revisePhoneUseContract,
  updatePhoneUseContractDraft,
} from '../services/digital-use-phone-contract.js';
import {
  addPhoneUseRoleplayTurn,
  createPhoneUseRoleplay,
  ratePhoneUseRoleplay,
  selectPhoneUseRoleplay,
} from '../services/digital-use-roleplay.js';
import {
  unavailableProductionRoleplayAdapter,
  type RoleplayAdapter,
} from '../services/digital-use-roleplay-adapter.js';

const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CaseParams=z.strictObject({id:z.string().meta({format:'uuid'})});
const VersionParams=z.strictObject({id:z.string().meta({format:'uuid'}),version:z.coerce.number().int().min(1).max(2147483647)});
const RoleplayParams=z.strictObject({id:z.string().meta({format:'uuid'}),sessionId:z.string().meta({format:'uuid'})});
const BEARER_SECURITY=[{bearerAuth:[]}];
const TAGS=['digital-use-phone-contract'];
const Errors={401:PhoneUseContractRuntimeError,403:PhoneUseContractRuntimeError,404:PhoneUseContractRuntimeError,409:PhoneUseContractRuntimeError,422:PhoneUseContractRuntimeError,500:PhoneUseContractRuntimeError} as const;

function httpError(code:string,message?:string):Error & {statusCode:number;code:string}{
 const mapped=toHttpError(code,message); return Object.assign(new Error(mapped.message),{statusCode:mapped.statusCode,code:mapped.code});
}
function actorOf(req:{actor?:{accountId:string;personId:string|null}|null}){
 const actor=req.actor; if(!actor?.accountId||!actor.personId) throw httpError('UNAUTHENTICATED');
 return {accountId:actor.accountId,personId:actor.personId};
}
function caseIdOf(raw:string){
 const v=raw.toLowerCase(); if(!UUID_PATTERN.test(v)) throw httpError('CASE_NOT_FOUND'); return v;
}
async function resolveFamily(pool:pg.Pool,accountId:string,personId:string){
 return withIdentityTransaction(pool,{accountId,purpose:'FAMILY_MANAGEMENT'},tx=>requireCurrentFamily(tx,personId));
}

export function registerDigitalUsePhoneContractRoutes(
 app:FastifyInstance,pool:pg.Pool,options:{roleplayAdapter?:RoleplayAdapter}={}
){
 const roleplayAdapter=options.roleplayAdapter??unavailableProductionRoleplayAdapter;

 app.get('/api/v1/cases/:id/digital-use/contract/template',{
  onRequest:app.authenticate,exposeHeadRoute:false,
  schema:{operationId:'getPhoneUseContractTemplate',summary:'Read the approved versioned phone-use Contract template',tags:TAGS,security:BEARER_SECURITY,params:CaseParams,response:{200:PhoneUseContractTemplateResponse,...Errors}},
 },async(req,reply)=>{
  const actor=actorOf(req),caseId=caseIdOf((req.params as {id:string}).id),familyId=await resolveFamily(pool,actor.accountId,actor.personId);
  return reply.status(200).send(await getPhoneUseContractTemplate(pool,{actor,familyId,caseId}));
 });

 app.get('/api/v1/cases/:id/digital-use/contract/examples',{
  onRequest:app.authenticate,exposeHeadRoute:false,
  schema:{operationId:'getPhoneUseContractExamples',summary:'Read the four approved professional examples',tags:TAGS,security:BEARER_SECURITY,params:CaseParams,response:{200:PhoneUseContractExamplesResponse,...Errors}},
 },async(req,reply)=>{
  const actor=actorOf(req),caseId=caseIdOf((req.params as {id:string}).id),familyId=await resolveFamily(pool,actor.accountId,actor.personId);
  return reply.status(200).send(await getPhoneUseContractExamples(pool,{actor,familyId,caseId}));
 });

 app.get('/api/v1/cases/:id/digital-use/contract/current',{
  onRequest:app.authenticate,exposeHeadRoute:false,
  schema:{operationId:'getCurrentPhoneUseContract',summary:'Read the authorized current phone-use Contract version',tags:TAGS,security:BEARER_SECURITY,params:CaseParams,response:{200:PhoneUseContractDto,...Errors}},
 },async(req,reply)=>{
  const actor=actorOf(req),caseId=caseIdOf((req.params as {id:string}).id),familyId=await resolveFamily(pool,actor.accountId,actor.personId);
  return reply.status(200).send(await getPhoneUseContractCurrent(pool,{actor,familyId,caseId}));
 });

 app.post('/api/v1/cases/:id/digital-use/contract/drafts',{
  onRequest:app.authenticate,
  schema:{operationId:'createPhoneUseContractDraft',summary:'Create the initial formal phone-use Contract draft',tags:TAGS,security:BEARER_SECURITY,params:CaseParams,body:SavePhoneUseContractDraftRequest,response:{201:PhoneUseContractDto,...Errors}},
 },async(req,reply)=>{
  const actor=actorOf(req),caseId=caseIdOf((req.params as {id:string}).id),body=SavePhoneUseContractDraftRequest.parse(req.body),familyId=await resolveFamily(pool,actor.accountId,actor.personId);
  const result=await createPhoneUseContractDraft(pool,{actor,familyId,caseId,idempotencyKey:readIdempotencyKey(req),...body});
  return reply.status(201).send(result);
 });

 app.patch('/api/v1/cases/:id/digital-use/contract/drafts/:version',{
  onRequest:app.authenticate,
  schema:{operationId:'updatePhoneUseContractDraft',summary:'Correct one mutable Contract draft revision',tags:TAGS,security:BEARER_SECURITY,params:VersionParams,body:UpdatePhoneUseContractDraftRequest,response:{200:PhoneUseContractDto,...Errors}},
 },async(req,reply)=>{
  const actor=actorOf(req),params=req.params as {id:string;version:number|string},caseId=caseIdOf(params.id),body=UpdatePhoneUseContractDraftRequest.parse(req.body),familyId=await resolveFamily(pool,actor.accountId,actor.personId);
  const result=await updatePhoneUseContractDraft(pool,{actor,familyId,caseId,version:Number(params.version),idempotencyKey:readIdempotencyKey(req),...body});
  return reply.status(200).send(result);
 });

 app.post('/api/v1/cases/:id/digital-use/contract/:version/confirm',{
  onRequest:app.authenticate,
  schema:{operationId:'confirmPhoneUseContractVersion',summary:'Record the current Contract party confirmation and activate atomically when complete',tags:TAGS,security:BEARER_SECURITY,params:VersionParams,body:ConfirmPhoneUseContractRequest,response:{200:PhoneUseContractDto,...Errors}},
 },async(req,reply)=>{
  const actor=actorOf(req),params=req.params as {id:string;version:number|string},caseId=caseIdOf(params.id),body=ConfirmPhoneUseContractRequest.parse(req.body),familyId=await resolveFamily(pool,actor.accountId,actor.personId);
  const result=await confirmPhoneUseContract(pool,{actor,familyId,caseId,version:Number(params.version),idempotencyKey:readIdempotencyKey(req),...body});
  return reply.status(200).send(result);
 });

 app.post('/api/v1/cases/:id/digital-use/contract/:version/revise',{
  onRequest:app.authenticate,
  schema:{operationId:'revisePhoneUseContractVersion',summary:'Create a new A4012 draft that supersedes an ACTIVE version only after reconfirmation',tags:TAGS,security:BEARER_SECURITY,params:VersionParams,body:RevisePhoneUseContractRequest,response:{201:PhoneUseContractDto,...Errors}},
 },async(req,reply)=>{
  const actor=actorOf(req),params=req.params as {id:string;version:number|string},caseId=caseIdOf(params.id),body=RevisePhoneUseContractRequest.parse(req.body),familyId=await resolveFamily(pool,actor.accountId,actor.personId);
  const current=await getPhoneUseContractCurrent(pool,{actor,familyId,caseId});
  if(current.version!==Number(params.version)||current.status!=='ACTIVE') throw httpError('PHONE_USE_CONTRACT_STALE_REVISION');
  const result=await revisePhoneUseContract(pool,{actor,familyId,caseId,idempotencyKey:readIdempotencyKey(req),...body});
  return reply.status(201).send(result);
 });

 app.get('/api/v1/cases/:id/digital-use/contract/faq',{
  onRequest:app.authenticate,exposeHeadRoute:false,
  schema:{operationId:'getPhoneUseContractFaq',summary:'Read approved static Contract execution FAQ support',tags:TAGS,security:BEARER_SECURITY,params:CaseParams,response:{200:PhoneUseContractFaqResponse,...Errors}},
 },async(req,reply)=>{
  const actor=actorOf(req),caseId=caseIdOf((req.params as {id:string}).id),familyId=await resolveFamily(pool,actor.accountId,actor.personId);
  return reply.status(200).send(await getPhoneUseContractFaq(pool,{actor,familyId,caseId}));
 });

 app.post('/api/v1/cases/:id/digital-use/roleplays',{
  onRequest:app.authenticate,
  schema:{operationId:'createPhoneUseRoleplay',summary:'Create an adult-only A4003 simulated-parent roleplay session',tags:TAGS,security:BEARER_SECURITY,params:CaseParams,body:CreatePhoneUseRoleplayRequest,response:{201:PhoneUseRoleplaySessionDto,...Errors}},
 },async(req,reply)=>{
  const actor=actorOf(req),caseId=caseIdOf((req.params as {id:string}).id),body=CreatePhoneUseRoleplayRequest.parse(req.body),familyId=await resolveFamily(pool,actor.accountId,actor.personId);
  return reply.status(201).send(await createPhoneUseRoleplay(pool,{actor,familyId,caseId,idempotencyKey:readIdempotencyKey(req),...body},roleplayAdapter));
 });

 for(const operation of ['turns','rate','select'] as const){
  const path=`/api/v1/cases/:id/digital-use/roleplays/:sessionId/${operation}`;
  if(operation==='turns'){
   app.post(path,{onRequest:app.authenticate,schema:{operationId:'addPhoneUseRoleplayTurn',summary:'Generate one simulated-parent roleplay turn',tags:TAGS,security:BEARER_SECURITY,params:RoleplayParams,body:CreatePhoneUseRoleplayTurnRequest,response:{201:PhoneUseRoleplayTurnDto,...Errors}}},async(req,reply)=>{
    const actor=actorOf(req),params=req.params as {id:string;sessionId:string},caseId=caseIdOf(params.id),body=CreatePhoneUseRoleplayTurnRequest.parse(req.body),familyId=await resolveFamily(pool,actor.accountId,actor.personId);
    return reply.status(201).send(await addPhoneUseRoleplayTurn(pool,{actor,familyId,caseId,sessionId:params.sessionId,idempotencyKey:readIdempotencyKey(req),...body},roleplayAdapter));
   });
  }else if(operation==='rate'){
   app.post(path,{onRequest:app.authenticate,schema:{operationId:'ratePhoneUseRoleplayTurn',summary:'Rate one simulated roleplay turn',tags:TAGS,security:BEARER_SECURITY,params:RoleplayParams,body:RatePhoneUseRoleplayRequest,response:{200:PhoneUseRoleplayTurnDto,...Errors}}},async(req,reply)=>{
    const actor=actorOf(req),params=req.params as {id:string;sessionId:string},caseId=caseIdOf(params.id),body=RatePhoneUseRoleplayRequest.parse(req.body),familyId=await resolveFamily(pool,actor.accountId,actor.personId);
    return reply.status(200).send(await ratePhoneUseRoleplay(pool,{actor,familyId,caseId,sessionId:params.sessionId,idempotencyKey:readIdempotencyKey(req),...body}));
   });
  }else{
   app.post(path,{onRequest:app.authenticate,schema:{operationId:'selectPhoneUseRoleplayTurn',summary:'Select one SIMULATION result and complete A4003 atomically',tags:TAGS,security:BEARER_SECURITY,params:RoleplayParams,body:SelectPhoneUseRoleplayRequest,response:{200:PhoneUseRoleplaySelectionResponse,...Errors}}},async(req,reply)=>{
    const actor=actorOf(req),params=req.params as {id:string;sessionId:string},caseId=caseIdOf(params.id),body=SelectPhoneUseRoleplayRequest.parse(req.body),familyId=await resolveFamily(pool,actor.accountId,actor.personId);
    return reply.status(200).send(await selectPhoneUseRoleplay(pool,{actor,familyId,caseId,sessionId:params.sessionId,idempotencyKey:readIdempotencyKey(req),...body}));
   });
  }
 }
}
