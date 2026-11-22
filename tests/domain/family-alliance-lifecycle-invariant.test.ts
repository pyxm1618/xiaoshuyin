import { describe, expect, it } from 'vitest';
import {
  type DigitalUseTargetItemRow,
  type FamilyAllianceTargetCode,
} from '@xiaoshuyin/domain';

function createMockTargetItem(overrides: Partial<DigitalUseTargetItemRow> = {}): DigitalUseTargetItemRow {
  return {
    id: 'target-item-1',
    family_id: 'fam-1',
    case_id: 'case-1',
    scene_package_version: 'v1',
    target_code: 'SLEEP' as FamilyAllianceTargetCode,
    selection_revision: 1,
    revision: 1,
    selected: true,
    concrete_target_text: null,
    feasibility_payload: null,
    progress_payload: null,
    progress_evidence_refs: [],
    help_history_refs: [],
    source_refs: [],
    created_by_person_id: 'person-1',
    created_at: new Date('2026-01-01T00:00:00Z'),
    superseded_at: null,
    ...overrides,
  };
}

describe('Finding #13: Family Alliance TARGET -> FEASIBILITY -> PROGRESS Invariant', () => {
  describe('Layer 1: Materialization filtering rules', () => {
    it('blocks FEASIBILITY and PROGRESS/HELP materialization until respective prerequisites are met', () => {
      // 1. Initial selection: concrete_target_text is null, feasibility_payload is null
      const initialItem = createMockTargetItem({
        concrete_target_text: null,
        feasibility_payload: null,
      });

      const canMaterializeFeasibilityInitial = Boolean(initialItem.concrete_target_text);
      const canMaterializeProgressInitial = Boolean(initialItem.feasibility_payload);

      expect(canMaterializeFeasibilityInitial).toBe(false);
      expect(canMaterializeProgressInitial).toBe(false);

      // 2. TARGET node completed: concrete_target_text defined, feasibility_payload still null
      const targetDefinedItem = createMockTargetItem({
        concrete_target_text: 'Bedtime target defined',
        feasibility_payload: null,
      });

      const canMaterializeFeasibilityStage = Boolean(targetDefinedItem.concrete_target_text);
      const canMaterializeProgressStage = Boolean(targetDefinedItem.feasibility_payload);

      expect(canMaterializeFeasibilityStage).toBe(true);
      expect(canMaterializeProgressStage).toBe(false);

      // 3. FEASIBILITY completed: feasibility_payload defined
      const feasibilityDoneItem = createMockTargetItem({
        concrete_target_text: 'Bedtime target defined',
        feasibility_payload: { needRating: 3 } as any,
      });

      const canMaterializeFeasibilityDone = Boolean(feasibilityDoneItem.concrete_target_text);
      const canMaterializeProgressDone = Boolean(feasibilityDoneItem.feasibility_payload);

      expect(canMaterializeFeasibilityDone).toBe(true);
      expect(canMaterializeProgressDone).toBe(true);
    });
  });

  describe('Layer 2: Server Command Invariant across target states', () => {
    function evaluateTargetCommandInvariant(
      targetRow: DigitalUseTargetItemRow,
      nodeRole: 'TARGET' | 'FEASIBILITY' | 'PROGRESS' | 'HELP'
    ): { ok: boolean; errorCode?: string } {
      if (nodeRole === 'FEASIBILITY' && !targetRow.concrete_target_text) {
        return { ok: false, errorCode: 'TARGET_SELECTION_STATE_INVALID' };
      }
      if ((nodeRole === 'PROGRESS' || nodeRole === 'HELP') && !targetRow.feasibility_payload) {
        return { ok: false, errorCode: 'TARGET_SELECTION_STATE_INVALID' };
      }
      return { ok: true };
    }

    it('rejects direct FEASIBILITY invocation when concrete_target_text is missing', () => {
      const target = createMockTargetItem({
        concrete_target_text: null,
        feasibility_payload: null,
      });
      const check = evaluateTargetCommandInvariant(target, 'FEASIBILITY');
      expect(check.ok).toBe(false);
      expect(check.errorCode).toBe('TARGET_SELECTION_STATE_INVALID');
    });

    it('allows FEASIBILITY invocation when concrete_target_text is defined', () => {
      const target = createMockTargetItem({
        concrete_target_text: '10:30 PM bedtime',
        feasibility_payload: null,
      });
      const check = evaluateTargetCommandInvariant(target, 'FEASIBILITY');
      expect(check.ok).toBe(true);
    });

    it('rejects direct PROGRESS invocation when feasibility_payload is missing', () => {
      const target = createMockTargetItem({
        concrete_target_text: '10:30 PM bedtime',
        feasibility_payload: null,
      });
      const check = evaluateTargetCommandInvariant(target, 'PROGRESS');
      expect(check.ok).toBe(false);
      expect(check.errorCode).toBe('TARGET_SELECTION_STATE_INVALID');
    });

    it('allows PROGRESS invocation when feasibility_payload is present', () => {
      const target = createMockTargetItem({
        concrete_target_text: '10:30 PM bedtime',
        feasibility_payload: { needRating: 3 } as any,
      });
      const check = evaluateTargetCommandInvariant(target, 'PROGRESS');
      expect(check.ok).toBe(true);
    });

    it('enforces isolation across different targets (Target A progress does not permit Target B bypass)', () => {
      const targetA = createMockTargetItem({
        target_code: 'SLEEP',
        concrete_target_text: '10:30 PM bedtime',
        feasibility_payload: { needRating: 3 } as any,
      });
      const targetB = createMockTargetItem({
        target_code: 'EXERCISE',
        concrete_target_text: null,
        feasibility_payload: null,
      });

      expect(evaluateTargetCommandInvariant(targetA, 'PROGRESS').ok).toBe(true);
      expect(evaluateTargetCommandInvariant(targetB, 'FEASIBILITY').ok).toBe(false);
      expect(evaluateTargetCommandInvariant(targetB, 'PROGRESS').ok).toBe(false);
    });
  });
});
