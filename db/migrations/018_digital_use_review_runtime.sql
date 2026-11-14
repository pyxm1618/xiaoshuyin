-- Slice 15 / A5001 only.
-- Extend the authoritative Slice 12 Scene Artifact vocabulary without creating
-- a second Review owner/table and without pre-admitting Slice 14/A5002 truth.
--
-- Migration number 017 is owned by the parallel Slice 14 branch. 018 is used
-- here deliberately so later main convergence orders Slice 14 before Slice 15.
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
    'ALTER TABLE scene_artifacts ADD CONSTRAINT scene_artifacts_type_check CHECK ((%s) OR artifact_type = %L)',
    current_expr,
    'DIGITAL_USE_A5001_EFFECT_EVALUATION'
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
    'ALTER TABLE scene_artifacts ADD CONSTRAINT scene_artifacts_source_node_check CHECK ((%s) OR source_node_code = %L)',
    current_expr,
    'A5001'
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
    'ALTER TABLE scene_artifacts ADD CONSTRAINT scene_artifacts_type_source_check CHECK ((%s) OR (artifact_type = %L AND source_node_code = %L))',
    current_expr,
    'DIGITAL_USE_A5001_EFFECT_EVALUATION',
    'A5001'
  );
END
$$;

COMMIT;
