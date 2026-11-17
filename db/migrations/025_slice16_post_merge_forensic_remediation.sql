-- Slice 16 post-merge forensic remediation.
-- Forward-only repair: immutable InterventionDefinition identity includes id.
BEGIN;

CREATE OR REPLACE FUNCTION app.guard_intervention_definition_immutable_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF ROW(
      NEW.id,
      NEW.scene_id, NEW.intervention_code, NEW.version, NEW.content_hash,
      NEW.target_problem_or_mechanism, NEW.formulation_dependencies,
      NEW.supporting_evidence_requirements, NEW.applicable_conditions,
      NEW.exclusion_or_contraindication_conditions, NEW.age_and_development_scope,
      NEW.rationale, NEW.intervention_steps, NEW.participation_and_consent_requirements,
      NEW.baseline_and_observation, NEW.expected_observable_change,
      NEW.burden_and_barriers, NEW.adverse_or_worsening_signals,
      NEW.review_window_and_criteria, NEW.stop_reassess_safety_referral_conditions,
      NEW.allowed_combinations, NEW.conflicting_interventions,
      NEW.professional_source_refs, NEW.supersedes_id, NEW.created_by_person_id,
      NEW.created_at
    ) IS DISTINCT FROM ROW(
      OLD.id,
      OLD.scene_id, OLD.intervention_code, OLD.version, OLD.content_hash,
      OLD.target_problem_or_mechanism, OLD.formulation_dependencies,
      OLD.supporting_evidence_requirements, OLD.applicable_conditions,
      OLD.exclusion_or_contraindication_conditions, OLD.age_and_development_scope,
      OLD.rationale, OLD.intervention_steps, OLD.participation_and_consent_requirements,
      OLD.baseline_and_observation, OLD.expected_observable_change,
      OLD.burden_and_barriers, OLD.adverse_or_worsening_signals,
      OLD.review_window_and_criteria, OLD.stop_reassess_safety_referral_conditions,
      OLD.allowed_combinations, OLD.conflicting_interventions,
      OLD.professional_source_refs, OLD.supersedes_id, OLD.created_by_person_id,
      OLD.created_at
    ) THEN
    RAISE EXCEPTION 'INTERVENTION_DEFINITION_IMMUTABLE' USING ERRCODE='23514';
  END IF;

  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'INTERVENTION_DEFINITION_STALE_REVISION' USING ERRCODE='40001';
  END IF;

  IF OLD.definition_state IN ('SUPERSEDED','RETIRED') THEN
    RAISE EXCEPTION 'INTERVENTION_DEFINITION_TERMINAL' USING ERRCODE='23514';
  END IF;

  IF NEW.definition_state NOT IN ('SUPERSEDED','RETIRED')
     OR NEW.definition_state = OLD.definition_state THEN
    RAISE EXCEPTION 'INTERVENTION_DEFINITION_INVALID_TRANSITION' USING ERRCODE='23514';
  END IF;

  RETURN NEW;
END
$function$;

COMMIT;
