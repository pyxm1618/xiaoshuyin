import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface FileEvidence { readonly file: string; readonly anchor: string }
interface AcceptanceEvidence {
  readonly id: string;
  readonly evidence: readonly FileEvidence[];
  readonly external?: string;
}
interface FrEvidence { readonly id: string; readonly acceptance: readonly string[] }

const HARD='tests/integration/digital-use-runtime-hardening.test.ts';
const CANON='tests/integration/digital-use-canonical-no-model.test.ts';
const CONTENT='tests/domain/digital-use-phone-contract-content.test.ts';
const REPO='tests/domain/digital-use-phone-contract-repository.test.ts';
const AUTH='tests/domain/phone-use-contract-authorization.test.ts';
const AUTH_ARCH='tests/architecture/authorization-contract-confirmation-owner.test.ts';
const DB='tests/db/digital-use-phone-contract-runtime-schema.test.ts';
const GOV='tests/scenes/digital-use/phone-use-contract-governance.test.ts';
const PARALLEL='tests/scenes/digital-use/parallel-fidelity.test.ts';
const ARCH='tests/scenes/digital-use/architecture-guard.test.ts';

const e=(file:string,anchor:string):FileEvidence=>({file,anchor});

const acceptance: readonly AcceptanceEvidence[] = [
  {id:'AS-01',evidence:[e(CANON,'runs the full canonical Slice 12 production orchestration without LLM, RAG, or network route truth')]},
  {id:'AS-02',evidence:[e(HARD,'Slice 14 rejects illegal direct A4002/A4010 entry without creating stream truth')]},
  {id:'AS-03',evidence:[e(PARALLEL,'keeps FAMILY_ALLIANCE independently reachable if contract participation is absent'),e(CANON,'runs the full canonical Slice 12 production orchestration without LLM, RAG, or network route truth')]},
  {id:'AS-04',evidence:[e(CONTENT,'does not accept client-owned lifecycle, confirmation or route authority'),e(AUTH,'denies parent / Family manager impersonation as the child')]},
  {id:'AS-05',evidence:[e(HARD,'Slice 14 A4001 records wrong-answer attempts, explains them, and only routes on all-correct retry')]},
  {id:'AS-06',evidence:[e(HARD,'Slice 14 A4001 records wrong-answer attempts, explains them, and only routes on all-correct retry')]},
  {id:'AS-07',evidence:[e(HARD,'Slice 14 A4001 records wrong-answer attempts, explains them, and only routes on all-correct retry')]},
  {id:'AS-08',evidence:[e(HARD,'Slice 14 A4001 records wrong-answer attempts, explains them, and only routes on all-correct retry')]},
  {id:'AS-09',evidence:[e(CONTENT,'keeps the template, four professional examples and FAQ as assets rather than family facts')]},
  {id:'AS-10',evidence:[e(CONTENT,'keeps the template, four professional examples and FAQ as assets rather than family facts')]},
  {id:'AS-11',evidence:[e(CONTENT,'keeps the template, four professional examples and FAQ as assets rather than family facts'),e(HARD,'Slice 14 A4001 records wrong-answer attempts, explains them, and only routes on all-correct retry')]},
  {id:'AS-12',evidence:[e(CONTENT,'binds the exact approved source blob and exposes one immutable V1 content identity')]},
  {id:'AS-13',evidence:[e(HARD,'Slice 14 test-only deterministic A4003 remains SIMULATION and routes through the official Manifest')]},
  {id:'AS-14',evidence:[e(HARD,'Slice 14 A4003 denies MINOR and UNKNOWN actors before adapter/session creation')]},
  {id:'AS-15',evidence:[e(HARD,'Slice 14 test-only deterministic A4003 remains SIMULATION and routes through the official Manifest')]},
  {id:'AS-16',evidence:[e(HARD,'Slice 14 test-only deterministic A4003 remains SIMULATION and routes through the official Manifest'),e(AUTH,'denies parent / Family manager impersonation as the child')]},
  {id:'AS-17',evidence:[e(GOV,'S14-GOV-04 keeps real AI/RAG absent and the production roleplay adapter truthfully unavailable')]},
  {id:'AS-18',evidence:[e(HARD,'Slice 14 production A4003 is truthfully unavailable and writes no fake session')]},
  {id:'AS-19',evidence:[e(HARD,'Slice 14 test-only deterministic A4003 remains SIMULATION and routes through the official Manifest')]},
  {id:'AS-20',evidence:[e(HARD,'Slice 14 formal Contract requires independent party confirmations and activates atomically')]},
  {id:'AS-21',evidence:[e(HARD,'Slice 14 A4004–A4009 stay independently re-enterable, typed, sourced and correction-safe'),e(GOV,'S14-GOV-02 keeps topology and reachability in the single Manifest/router owner')]},
  {id:'AS-22',evidence:[e(HARD,'Slice 14 A4004–A4009 stay independently re-enterable, typed, sourced and correction-safe')]},
  {id:'AS-23',evidence:[e(HARD,'Slice 14 A4004–A4009 stay independently re-enterable, typed, sourced and correction-safe')]},
  {id:'AS-24',evidence:[e(HARD,'Slice 14 A4004–A4009 stay independently re-enterable, typed, sourced and correction-safe'),e(GOV,'S14-GOV-03 creates no generic workflow/forms engine or Phase-4 owner')]},
  {id:'AS-25',evidence:[e(HARD,'Slice 14 A4004–A4009 stay independently re-enterable, typed, sourced and correction-safe')]},
  {id:'AS-26',evidence:[e(HARD,'Slice 14 A4004–A4009 stay independently re-enterable, typed, sourced and correction-safe')]},
  {id:'AS-27',evidence:[e(HARD,'Slice 14 A4004–A4009 stay independently re-enterable, typed, sourced and correction-safe')]},
  {id:'AS-28',evidence:[e(HARD,'Slice 14 A4004–A4009 stay independently re-enterable, typed, sourced and correction-safe')]},
  {id:'AS-29',evidence:[e(HARD,'Slice 14 formal Contract requires independent party confirmations and activates atomically')]},
  {id:'AS-30',evidence:[e(REPO,'activation requires both confirmations and supersession only targets ACTIVE')]},
  {id:'AS-31',evidence:[e(REPO,'activation requires both confirmations and supersession only targets ACTIVE')]},
  {id:'AS-32',evidence:[e(CONTENT,'does not accept client-owned lifecycle, confirmation or route authority'),e(AUTH,'denies parent / Family manager impersonation as the child')]},
  {id:'AS-33',evidence:[e(AUTH_ARCH,'requires explicit Contract, party and ACTIVE participation facts'),e(HARD,'Slice 14 test-only deterministic A4003 remains SIMULATION and routes through the official Manifest')]},
  {id:'AS-34',evidence:[e(AUTH,'denies the wrong Contract version'),e(AUTH,'denies a participation belonging to another Case')]},
  {id:'AS-35',evidence:[e(CONTENT,'requires every formal semantic section to use explicit VALUE / NOT_APPLICABLE / PENDING state')]},
  {id:'AS-36',evidence:[e(HARD,'Slice 14 Contract idempotency, draft CAS and activation races converge without duplicate truth')]},
  {id:'AS-37',evidence:[e(HARD,'Slice 14 Contract idempotency, draft CAS and activation races converge without duplicate truth'),e(HARD,'Slice 14 A4012 keeps old ACTIVE truth until the replacement is independently reconfirmed')]},
  {id:'AS-38',evidence:[e(HARD,'Slice 14 A4012 keeps old ACTIVE truth until the replacement is independently reconfirmed')]},
  {id:'AS-39',evidence:[e(HARD,'Slice 14 activation fault rolls child confirmation back with Scene/Contract truth')]},
  {id:'AS-40',evidence:[e(HARD,'Slice 14 A4012 keeps old ACTIVE truth until the replacement is independently reconfirmed'),e(GOV,'S14-GOV-07 keeps Contract document projection in one append-only Scene Artifact chain')]},
  {id:'AS-41',evidence:[e(CONTENT,'keeps the template, four professional examples and FAQ as assets rather than family facts'),e(HARD,'Slice 14 formal Contract requires independent party confirmations and activates atomically')]},
  {id:'AS-42',evidence:[e(HARD,'Slice 14 formal Contract requires independent party confirmations and activates atomically')]},
  {id:'AS-43',evidence:[e(HARD,'Slice 14 formal Contract requires independent party confirmations and activates atomically'),e(CONTENT,'production adapter is truthfully unavailable and never returns canned AI output')]},
  {id:'AS-44',evidence:[e(HARD,'Slice 14 formal Contract requires independent party confirmations and activates atomically')]},
  {id:'AS-45',evidence:[e(GOV,'S14-GOV-03 creates no generic workflow/forms engine or Phase-4 owner')]},
  {id:'AS-46',evidence:[e(HARD,'Slice 14 formal Contract requires independent party confirmations and activates atomically'),e(GOV,'S14-GOV-06 keeps A5002 and scheduler/notification execution outside Slice 14')]},
  {id:'AS-47',evidence:[e(HARD,'Slice 14 formal Contract requires independent party confirmations and activates atomically')]},
  {id:'AS-48',evidence:[e(HARD,'Slice 14 A4012 keeps old ACTIVE truth until the replacement is independently reconfirmed')]},
  {id:'AS-49',evidence:[e(HARD,'Slice 14 A4012 keeps old ACTIVE truth until the replacement is independently reconfirmed')]},
  {id:'AS-50',evidence:[e(HARD,'Slice 14 A4012 keeps old ACTIVE truth until the replacement is independently reconfirmed')]},
  {id:'AS-51',evidence:[e(HARD,'Slice 14 A4012 keeps old ACTIVE truth until the replacement is independently reconfirmed')]},
  {id:'AS-52',evidence:[e(HARD,'Slice 14 A4012 keeps old ACTIVE truth until the replacement is independently reconfirmed')]},
  {id:'AS-53',evidence:[e(DB,'enforces Contract identity/provenance/immutability in the database')]},
  {id:'AS-54',evidence:[e(HARD,'Slice 14 A4012 keeps old ACTIVE truth until the replacement is independently reconfirmed')]},
  {id:'AS-55',evidence:[e(HARD,'Slice 14 A4012 keeps old ACTIVE truth until the replacement is independently reconfirmed'),e(DB,'has one-current-ACTIVE, one-open-draft and one-successor DB fences')]},
  {id:'AS-56',evidence:[e(HARD,'Slice 14 A4012 keeps old ACTIVE truth until the replacement is independently reconfirmed')]},
  {id:'AS-57',evidence:[e(GOV,'S14-GOV-06 keeps A5002 and scheduler/notification execution outside Slice 14'),e(HARD,'Slice 14 A4012 keeps old ACTIVE truth until the replacement is independently reconfirmed')]},
  {id:'AS-58',evidence:[e(AUTH,'denies parent / Family manager impersonation as the child'),e(AUTH,'denies unsupported resources instead of treating Case/Participation as Contract authority')]},
  {id:'AS-59',evidence:[e(HARD,'anti-enumerates cross-Family access and keeps A200401 non-addressable'),e(DB,'FORCEs RLS on every new business table')]},
  {id:'AS-60',evidence:[e(HARD,'Slice 14 Consent revoked before Contract commit blocks confirmation with zero success write')]},
  {id:'AS-61',evidence:[e(HARD,'Slice 14 Consent revocation blocks future support but preserves historical ACTIVE Contract truth')]},
  {id:'AS-62',evidence:[e(HARD,'fails closed when the current Slice 10 Compliance policy becomes unresolved')]},
  {id:'AS-63',evidence:[e(HARD,'Safety Hold preempts an ordinary node response without leaving Evidence'),e(HARD,'Slice 14 formal Contract requires independent party confirmations and activates atomically')]},
  {id:'AS-64',evidence:[e(HARD,'revalidates a Safety transition that commits while the node writer waits on the Case lock')]},
  {id:'AS-65',evidence:[e(GOV,'S14-GOV-01 consumes the merged Scene owner and leaves no temporary re-entry owner'),e(HARD,'Slice 14 production A4003 is truthfully unavailable and writes no fake session')]},
  {id:'AS-66',evidence:[e(HARD,'Slice 14 Contract idempotency, draft CAS and activation races converge without duplicate truth')]},
  {id:'AS-67',evidence:[e(HARD,'Slice 14 Contract idempotency, draft CAS and activation races converge without duplicate truth')]},
  {id:'AS-68',evidence:[e(HARD,'Slice 14 Contract idempotency, draft CAS and activation races converge without duplicate truth'),e(REPO,'draft correction is revision-fenced and invalidates both prior confirmations')]},
  {id:'AS-69',evidence:[e(HARD,'a primary switch makes the old Assessment Case lose write authority')]},
  {id:'AS-70',evidence:[e(HARD,'fails closed on package drift and never silently rebinds Scene package truth')]},
  {id:'AS-71',evidence:[e(CONTENT,'binds the exact approved source blob and exposes one immutable V1 content identity')]},
  {id:'AS-72',evidence:[e(HARD,'Slice 14 A4004–A4009 stay independently re-enterable, typed, sourced and correction-safe'),e(REPO,'draft correction is revision-fenced and invalidates both prior confirmations')]},
  {id:'AS-73',evidence:[e(REPO,'draft correction is revision-fenced and invalidates both prior confirmations'),e(AUTH_ARCH,'requires explicit Contract, party and ACTIVE participation facts')]},
  {id:'AS-74',evidence:[e(GOV,'S14-GOV-06 keeps A5002 and scheduler/notification execution outside Slice 14')]},
  {id:'AS-75',evidence:[e(GOV,'S14-GOV-02 keeps topology and reachability in the single Manifest/router owner'),e(ARCH,'accepts the canonical repository architecture')]},
  {id:'AS-76',evidence:[e(GOV,'S14-GOV-03 creates no generic workflow/forms engine or Phase-4 owner')]},
  {id:'AS-77',evidence:[e(GOV,'S14-GOV-03 creates no generic workflow/forms engine or Phase-4 owner')]},
  {id:'AS-78',evidence:[e(GOV,'S14-GOV-06 keeps A5002 and scheduler/notification execution outside Slice 14')]},
  {id:'AS-79',evidence:[e(GOV,'S14-GOV-04 keeps real AI/RAG absent and the production roleplay adapter truthfully unavailable')]},
  {id:'AS-80',evidence:[],external:'Spec Governance PASS + exact-head changed-file diff against origin/main'},
] as const;

const fr: readonly FrEvidence[] = [
  {id:'FR-001',acceptance:['AS-75','AS-80']},
  {id:'FR-002',acceptance:['AS-01','AS-02','AS-20','AS-21','AS-44','AS-75']},
  {id:'FR-003',acceptance:['AS-03','AS-04']},
  {id:'FR-004',acceptance:['AS-05','AS-07']},
  {id:'FR-005',acceptance:['AS-06','AS-08']},
  {id:'FR-006',acceptance:['AS-09','AS-10','AS-11','AS-12']},
  {id:'FR-007',acceptance:['AS-29','AS-35','AS-40','AS-53']},
  {id:'FR-008',acceptance:['AS-13','AS-14']},
  {id:'FR-009',acceptance:['AS-15','AS-16','AS-17','AS-19']},
  {id:'FR-010',acceptance:['AS-18','AS-19','AS-79']},
  {id:'FR-011',acceptance:['AS-20','AS-21','AS-28']},
  {id:'FR-012',acceptance:['AS-22','AS-23']},
  {id:'FR-013',acceptance:['AS-24','AS-45']},
  {id:'FR-014',acceptance:['AS-25']},
  {id:'FR-015',acceptance:['AS-26']},
  {id:'FR-016',acceptance:['AS-27']},
  {id:'FR-017',acceptance:['AS-76']},
  {id:'FR-018',acceptance:['AS-30','AS-31','AS-32','AS-33','AS-34']},
  {id:'FR-019',acceptance:['AS-29','AS-40','AS-48','AS-49','AS-50','AS-51','AS-52','AS-53']},
  {id:'FR-020',acceptance:['AS-29','AS-37','AS-50','AS-51','AS-54']},
  {id:'FR-021',acceptance:['AS-29','AS-39']},
  {id:'FR-022',acceptance:['AS-41']},
  {id:'FR-023',acceptance:['AS-45','AS-46','AS-57','AS-77','AS-78']},
  {id:'FR-024',acceptance:['AS-43','AS-79']},
  {id:'FR-025',acceptance:['AS-48','AS-49','AS-53']},
  {id:'FR-026',acceptance:['AS-51','AS-52','AS-54','AS-55','AS-56']},
  {id:'FR-027',acceptance:['AS-50','AS-51']},
  {id:'FR-028',acceptance:['AS-58','AS-59']},
  {id:'FR-029',acceptance:['AS-60','AS-61']},
  {id:'FR-030',acceptance:['AS-62']},
  {id:'FR-031',acceptance:['AS-47','AS-63','AS-64']},
  {id:'FR-032',acceptance:['AS-15','AS-16','AS-23','AS-32','AS-33','AS-34','AS-40']},
  {id:'FR-033',acceptance:['AS-36','AS-66','AS-67']},
  {id:'FR-034',acceptance:['AS-37','AS-38','AS-54','AS-55','AS-68','AS-69','AS-70']},
  {id:'FR-035',acceptance:['AS-39','AS-56']},
  {id:'FR-036',acceptance:['AS-22','AS-24','AS-25','AS-26','AS-27','AS-72','AS-73']},
  {id:'FR-037',acceptance:['AS-18','AS-43','AS-46','AS-57','AS-74']},
  {id:'FR-038',acceptance:['AS-65','AS-75']},
  {id:'FR-039',acceptance:['AS-80']},
  {id:'FR-040',acceptance:['AS-19','AS-79']},
] as const;

function root(path:string):string {
  return readFileSync(resolve(process.cwd(),path),'utf8');
}

describe('Slice 14 mechanical FR / Acceptance evidence map', () => {
  it('maps exactly AS-01 through AS-80 to executable evidence or the exact-head governance proof', () => {
    expect(acceptance).toHaveLength(80);
    expect(acceptance.map((x)=>x.id)).toEqual(
      Array.from({length:80},(_,i)=>`AS-${String(i+1).padStart(2,'0')}`)
    );
    for(const item of acceptance){
      if(item.id==='AS-80'){
        expect(item.evidence).toHaveLength(0);
        expect(item.external).toBe('Spec Governance PASS + exact-head changed-file diff against origin/main');
        continue;
      }
      expect(item.evidence.length,item.id).toBeGreaterThan(0);
      for(const ref of item.evidence){
        const content=root(ref.file);
        expect(content.includes(ref.anchor),`${item.id} missing evidence anchor: ${ref.file} :: ${ref.anchor}`).toBe(true);
      }
    }
  });

  it('maps exactly FR-001 through FR-040 to Acceptance evidence with no orphan requirement', () => {
    expect(fr).toHaveLength(40);
    expect(fr.map((x)=>x.id)).toEqual(
      Array.from({length:40},(_,i)=>`FR-${String(i+1).padStart(3,'0')}`)
    );
    const acceptanceIds=new Set(acceptance.map((x)=>x.id));
    for(const item of fr){
      expect(item.acceptance.length,item.id).toBeGreaterThan(0);
      for(const asId of item.acceptance) expect(acceptanceIds.has(asId),`${item.id} -> ${asId}`).toBe(true);
    }
  });

  it('keeps AS-80 external evidence narrowly bound to governance/diff rather than pretending source tests can prove Git history', () => {
    const as80=acceptance.find((x)=>x.id==='AS-80')!;
    expect(as80.external).toContain('Spec Governance PASS');
    expect(as80.external).toContain('exact-head changed-file diff');
  });
});
