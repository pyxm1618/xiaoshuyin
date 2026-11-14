import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function root(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const contract = root('apps/server/api/src/services/digital-use-phone-contract.ts');
const roleplay = root('apps/server/api/src/services/digital-use-roleplay.ts');
const roleplayAdapter = root('apps/server/api/src/services/digital-use-roleplay-adapter.ts');
const nodeResponse = root('apps/server/api/src/services/digital-use-node-response.ts');
const sceneRepo = root('packages/domain/src/scene-runtime-repository.ts');
const migration = root('db/migrations/017_digital_use_phone_use_contract_runtime.sql');
const manifest = root('packages/scenes/digital-use/node-manifest.ts');
const authorization = root('packages/authorization/src/authorize.ts');

describe('Slice 14 PHONE_USE_CONTRACT frozen-scope governance', () => {
  it('S14-GOV-01 consumes the merged Scene owner and leaves no temporary re-entry owner', () => {
    const production = [contract, roleplay, nodeResponse, sceneRepo].join('\n');
    expect(production).not.toContain('casReenterCompletedSceneNode');
    expect(sceneRepo).toContain('export async function casRecompleteSceneNodeState');
    expect(contract).toContain('casRecompleteSceneNodeState');
    expect(roleplay).toContain('casRecompleteSceneNodeState');
    expect(nodeResponse).toContain('casRecompleteSceneNodeState');
  });

  it('S14-GOV-02 keeps topology and reachability in the single Manifest/router owner', () => {
    const slice14 = [contract, roleplay, nodeResponse].join('\n');
    expect(slice14).not.toMatch(/const\s+(allowedNext|routeTable|nodeRegistry)\s*=/);
    expect(slice14).not.toMatch(/nodeCode\s*\+\s*1|parseInt\([^)]*node/i);
    expect(manifest).toContain("stream: 'PHONE_USE_CONTRACT'");
    expect(contract).toContain('resolveDigitalUseRuntimeNode');
    expect(roleplay).toContain('routeDigitalUseTopology');
  });

  it('S14-GOV-03 creates no generic workflow/forms engine or Phase-4 owner', () => {
    const production = [contract, roleplay, nodeResponse, migration].join('\n');
    expect(migration).not.toMatch(/CREATE TABLE\s+(goals|plans|plan_versions|tasks|checkins|reviews|outcomes|followups|notifications)\b/i);
    expect(production).not.toMatch(/\b(xstate|workflow engine|forms engine|rules engine|pg-boss)\b/i);
    expect(production).not.toMatch(/InterventionInstance|PlanVersion/);
  });

  it('S14-GOV-04 keeps real AI/RAG absent and the production roleplay adapter truthfully unavailable', () => {
    const production = [contract, roleplay, roleplayAdapter].join('\n');
    expect(production).not.toMatch(/\b(OpenAI|Anthropic|embedding|vector store|RAG runtime|agent runtime)\b/i);
    expect(roleplayAdapter).toContain('unavailableProductionRoleplayAdapter');
    expect(roleplayAdapter).toContain('DOWNSTREAM_AI_UNAVAILABLE');
  });

  it('S14-GOV-05 consumes the authoritative child-confirmation authorization action', () => {
    expect(authorization).toContain("'PHONE_USE_CONTRACT_CONFIRM_SELF'");
    expect(contract).toContain('requirePhoneUseContractChildConfirmation');
    expect(contract).toContain("authorizationAction:'PHONE_USE_CONTRACT_CONFIRM_SELF'");
    expect(contract).not.toMatch(/parentAsChild|managerOverride|aiAsChild|roleplayAsChild/i);
  });

  it('S14-GOV-06 keeps A5002 and scheduler/notification execution outside Slice 14', () => {
    const slice14 = [contract, roleplay, nodeResponse, migration].join('\n');
    expect(slice14).not.toMatch(/A5002/);
    expect(slice14).not.toMatch(/CREATE TABLE\s+(review|reviews|followup|followups|notification|notifications|jobs)\b/i);
    expect(contract).toContain('PHONE_USE_FOLLOWUP_DOWNSTREAM_UNAVAILABLE');
  });

  it('S14-GOV-07 keeps Contract document projection in one append-only Scene Artifact chain', () => {
    expect(contract).toContain("artifactType:'PHONE_USE_CONTRACT_DOCUMENT'");
    expect(contract).toContain("sourceNodeCode:'A4010'");
    expect(contract).toContain('projectionNodeCode:nodeCode');
    expect(contract).toContain('revision:previous===null?1:previous.revision+1');
    expect(contract).toContain('supersedesId:previous.id');
    expect(migration).toContain("artifact_type='PHONE_USE_CONTRACT_DOCUMENT' AND source_node_code='A4010'");
  });
});
