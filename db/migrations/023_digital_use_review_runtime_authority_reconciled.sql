-- Slice 15 authority-reconciled bounded Digital Use review runtime.
-- Minimal additive extension of the authoritative Scene Artifact vocabulary.
-- No generic Review, Professional Package, Reviewer, scheduler or job table.
BEGIN;

DO $$
DECLARE
  current_def text;
  current_expr text;
BEGIN
  SELECT pg_get_constraintdef(oid, true)
    INTO current_def
    FROM pg_constraint
   WHERE conrelid = 'scene_artifacts'::regclass
     AND conname = 'scene_artifacts_type_check';

  IF current_def IS NULL OR current_def NOT LIKE 'CHECK (%' THEN
    RAISE EXCEPTION 'scene_artifacts_type_check authority missing';
  END IF;

  current_expr := substring(current_def FROM 8 FOR char_length(current_def) - 8);
  ALTER TABLE scene_artifacts DROP CONSTRAINT scene_artifacts_type_check;
  EXECUTE format(
    'ALTER TABLE scene_artifacts ADD CONSTRAINT scene_artifacts_type_check CHECK ((%s) OR artifact_type IN (%L,%L))',
    current_expr,
    'DIGITAL_USE_A5001_EFFECT_EVALUATION',
    'DIGITAL_USE_A5002_EFFECT_EVALUATION'
  );

  SELECT pg_get_constraintdef(oid, true)
    INTO current_def
    FROM pg_constraint
   WHERE conrelid = 'scene_artifacts'::regclass
     AND conname = 'scene_artifacts_source_node_check';

  IF current_def IS NULL OR current_def NOT LIKE 'CHECK (%' THEN
    RAISE EXCEPTION 'scene_artifacts_source_node_check authority missing';
  END IF;

  current_expr := substring(current_def FROM 8 FOR char_length(current_def) - 8);
  ALTER TABLE scene_artifacts DROP CONSTRAINT scene_artifacts_source_node_check;
  EXECUTE format(
    'ALTER TABLE scene_artifacts ADD CONSTRAINT scene_artifacts_source_node_check CHECK ((%s) OR source_node_code IN (%L,%L))',
    current_expr,
    'A5001',
    'A5002'
  );

  SELECT pg_get_constraintdef(oid, true)
    INTO current_def
    FROM pg_constraint
   WHERE conrelid = 'scene_artifacts'::regclass
     AND conname = 'scene_artifacts_type_source_check';

  IF current_def IS NULL OR current_def NOT LIKE 'CHECK (%' THEN
    RAISE EXCEPTION 'scene_artifacts_type_source_check authority missing';
  END IF;

  current_expr := substring(current_def FROM 8 FOR char_length(current_def) - 8);
  ALTER TABLE scene_artifacts DROP CONSTRAINT scene_artifacts_type_source_check;
  EXECUTE format(
    'ALTER TABLE scene_artifacts ADD CONSTRAINT scene_artifacts_type_source_check CHECK ((%s) OR (artifact_type = %L AND source_node_code = %L) OR (artifact_type = %L AND source_node_code = %L))',
    current_expr,
    'DIGITAL_USE_A5001_EFFECT_EVALUATION',
    'A5001',
    'DIGITAL_USE_A5002_EFFECT_EVALUATION',
    'A5002'
  );
END
$$;

COMMIT;
