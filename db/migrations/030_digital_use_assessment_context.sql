CREATE TABLE digital_use_assessment_context (
  case_id uuid PRIMARY KEY,
  family_id uuid NOT NULL,
  target_person_id uuid NOT NULL,
  created_by_person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (case_id, family_id) REFERENCES cases (id, family_id),
  FOREIGN KEY (family_id, target_person_id) REFERENCES family_members (family_id, person_id),
  FOREIGN KEY (family_id, created_by_person_id) REFERENCES family_members (family_id, person_id)
);

ALTER TABLE digital_use_assessment_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_use_assessment_context FORCE ROW LEVEL SECURITY;

CREATE POLICY digital_use_assessment_context_family_scope ON digital_use_assessment_context
  USING (family_id = app_family_id())
  WITH CHECK (family_id = app_family_id());

GRANT SELECT, INSERT ON digital_use_assessment_context TO xiaoshuyin_app;
