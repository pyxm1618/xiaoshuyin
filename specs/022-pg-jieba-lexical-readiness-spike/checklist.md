# Slice 22 — Mechanical Acceptance Checklist

Feature: 022-pg-jieba-lexical-readiness-spike  
Semantics: checklist PASS means the execution obeyed the frozen evidence contract; it does not mean the Spike itself must return aggregate PASS. A correctly observed and reproducible technical FAIL, or a correctly classified BLOCKED/UNKNOWN, can satisfy this checklist.

Outcome-sensitive row rule, mechanically applied as part of each Required Result:
- when a row states a positive technical value, checklist PASS is either (a) that value is observed and its lower predicate may PASS, or (b) a different raw value is observed and the specified lower predicate is truthfully non-PASS with the required reason; silently claiming the positive value is forbidden;
- downstream LEX/TOK/QRY execution rows are NOT APPLICABLE only when an upstream mandatory predicate is already terminal FAIL/BLOCKED/UNKNOWN and the evidence records the short-circuit;
- resource-removal rows are NOT APPLICABLE only for a resource that was never created, with an explicit absence inventory; CLEANUP itself still requires a terminal state;
- rerun rows are mandatory for aggregate PASS and for any observed technical FAIL claimed as final; they are NOT APPLICABLE for BLOCKED/UNKNOWN where execution cannot reach a reproducible technical result.

| ID | Mechanical Check | Required Result | Evidence |
|---|---|---|---|
| C22-BASE-01 | Frozen Spec head | c583e7d67d3cca7bb5b9f1b533f08448c2362334 | GitHub remote read-back |
| C22-BASE-02 | Frozen Spec blob | c11c595d3fc9390bb569651562ba52c36cf9546b | Git blob read-back |
| C22-BASE-03 | Planning branch ancestry contains Frozen Spec | YES | commit parents/history |
| C22-BASE-04 | Developer start base is current main | behind = 0 | compare commits |
| C22-BASE-05 | No competing 022 implementation | NONE | branch/PR search |
| C22-SCOPE-01 | Dense retrieval introduced | NO | changed-file/content scan |
| C22-SCOPE-02 | Embedding/provider call introduced | NO | changed-file/content scan |
| C22-SCOPE-03 | sparsevec introduced | NO | changed-file/content scan |
| C22-SCOPE-04 | fusion/RRF/rerank introduced | NO | changed-file/content scan |
| C22-SCOPE-05 | Gold Dataset/evaluation introduced | NO | changed-file/content scan |
| C22-SCOPE-06 | production dictionary/RAG/route introduced | NO | changed-file/content scan |
| C22-SCOPE-07 | Context Builder/AI Runtime/TaskModelRegistry/Family Memory introduced | NO | changed-file/content scan |
| C22-SCOPE-08 | production schema/table/index/business rows introduced | NO | diff + runtime catalog checks |
| C22-SCOPE-09 | fallback tokenizer/search engine used | NO | implementation/runtime evidence |
| C22-SCOPE-10 | Slice 20 or Slice 21 result required for 022 | NO | gate report |
| C22-GOV-01 | planned implementation files under tests/ only | YES | changed-file list |
| C22-GOV-02 | current governance fixed-exempt includes tests/ | YES | validator source/readout |
| C22-GOV-03 | apps/ modified | NO | diff |
| C22-GOV-04 | packages/ modified | NO | diff |
| C22-GOV-05 | db/ modified | NO | diff |
| C22-GOV-06 | .github/.specify/scripts/docker-compose/package manifest modified | NO | diff |
| C22-GOV-07 | implementation ownership mutation needed | NO | governance validator |
| C22-GOV-08 | governance prerequisite | NOT REQUIRED while C22-GOV-01..06 PASS | validator + diff |
| C22-ENV-01 | actual PostgreSQL server major observed | 18 | SELECT server_version_num |
| C22-ENV-02 | base image immutable identity | exact current Slice19 digest | Docker inspect |
| C22-ENV-03 | derived image identity observed | nonempty immutable ID/digest | Docker inspect |
| C22-ENV-04 | current runtime role | xiaoshuyin_app | SELECT current_user |
| C22-ENV-05 | runtime superuser | false | pg_roles |
| C22-ENV-06 | runtime BYPASSRLS | false | pg_roles |
| C22-ENV-07 | runtime CREATE on public | false | has_schema_privilege |
| C22-ENV-08 | baseline/loaded/failure env use same derived build | YES | image IDs |
| C22-COMP-01 | pg_jieba source repository | jaiminpan/pg_jieba | build manifest |
| C22-COMP-02 | pg_jieba source commit | d0ffac8028328b2566a889ff4db3d74ba63d1b42 | git rev-parse/build log |
| C22-COMP-03 | libjieba gitlink | 391121d5db0f31dd5ce9795d4d34812f20eeb25c | git submodule status |
| C22-COMP-04 | extension declared version | 1.1.1 | pg_jieba.control + pg_available_extensions |
| C22-COMP-05 | source patched/fork substituted | NO | Dockerfile/source diff |
| C22-COMP-06 | exact source obtained before incompatibility classification | YES for FAIL; otherwise FAIL checklist | build evidence |
| C22-COMP-07 | compile/install on PG18 | success for predicate PASS | build output |
| C22-COMP-08 | CREATE EXTENSION and parser/config load | success for predicate PASS | SQL output/catalog |
| C22-COMP-09 | source/build/package unavailable mislabeled incompatibility | NO | state reason |
| C22-AUTH-01 | lexicon term count | exactly 3 | lexicon manifest |
| C22-AUTH-02 | lexicon terms | 家庭联盟; 手机使用合约; 小树荫 | dictionary bytes |
| C22-AUTH-03 | each term has source identity | YES | manifest |
| C22-AUTH-04 | each term has source blob/version | YES | manifest |
| C22-AUTH-05 | each term has source reference | YES | manifest |
| C22-AUTH-06 | each term has test-use permission | FROZEN_SPEC_OPTION_A_FORMAL_TERM | manifest |
| C22-AUTH-07 | professional/clinical judgment added | NO | manifest/content audit |
| C22-AUTH-08 | frequency/POS invented | NO | dictionary bytes |
| C22-AUTH-09 | professional synonym/label/score created | NO | diff/content audit |
| C22-AUTH-10 | unauthorized term silently replaces frozen term | NO | git blob/fingerprint |
| C22-LEX-01 | dictionary filename | xiaoshuyin_022_test.dict | fixture |
| C22-LEX-02 | dictionary encoding | UTF-8, one term per line | byte validation |
| C22-LEX-03 | lexicon SHA-256 frozen before runtime | YES | manifest + commit time/order |
| C22-LEX-04 | baseline user_dict | jieba_user | SHOW pg_jieba.user_dict |
| C22-LEX-05 | loaded user_dict | jieba_user,xiaoshuyin_022_test | SHOW pg_jieba.user_dict |
| C22-LEX-06 | installed custom dict hash matches fixture | YES | container sha256sum |
| C22-LEX-07 | positive path uses postmaster startup/restart semantics | YES | startup command + SHOW |
| C22-LEX-08 | jieba_reload_dict used as positive multi-backend proof | NO | implementation/runtime scan |
| C22-LEX-09 | required differential term frozen before observation | 手机使用合约 in D02 only | manifest |
| C22-LEX-10 | LEXICON_LOAD depends only on valid provenance + exact dictionary fingerprint + tsearch_data presence + exact user_dict startup identity | YES | manifest/config/file evidence |
| C22-LEX-11 | post-observation term replacement | NO | git history/fingerprint |
| C22-LEX-12 | lexicon identity/provenance incomplete but LEXICON_LOAD PASS | NO | state artifact |
| C22-CORP-01 | corpus document count | exactly 4 | corpus manifest |
| C22-CORP-02 | query count | exactly 2 | corpus manifest |
| C22-CORP-03 | document IDs | D01,D02,D03,D04 | manifest |
| C22-CORP-04 | query IDs | Q01,Q02 | manifest |
| C22-CORP-05 | Q01 expected match | [D02] | frozen manifest |
| C22-CORP-06 | Q02 expected match | [D01] | frozen manifest |
| C22-CORP-07 | each query has unrelated distractors | 3 | manifest |
| C22-CORP-08 | corpus/query fingerprints frozen before runtime | YES | git blobs + SHA-256 |
| C22-CORP-09 | real family/minor/patient/private data | NONE | fixture review |
| C22-CORP-10 | expectation changed after observed result | NO | git/history/run identity |
| C22-TOK-01 | tokenizer is actual pg_jieba | YES | extension/catalog identity |
| C22-TOK-02 | config is pg_jieba jiebacfg | YES | regconfig/catalog |
| C22-TOK-03 | raw ts_debug output captured | YES | runtime evidence |
| C22-TOK-04 | raw to_tsvector output captured | YES | runtime evidence |
| C22-TOK-05 | baseline repetitions | 3 fresh connections | run evidence |
| C22-TOK-06 | loaded repetitions | 3 fresh connections | run evidence |
| C22-TOK-07 | repeated normalized outputs stable per environment | YES | equality assertion |
| C22-TOK-08 | mock/fallback output accepted | NO | architecture/runtime tests |
| C22-TOK-09 | baseline D02 contains 手机使用合约 as one lexeme while TOKENIZATION PASS | NO | raw baseline output |
| C22-TOK-10 | loaded D02 contains 手机使用合约 as one lexeme and three runs agree for TOKENIZATION PASS | YES; otherwise TOKENIZATION FAIL with PRIMARY_DIFFERENTIAL_NOT_OBSERVED | raw loaded output |
| C22-QRY-01 | query uses PostgreSQL lexical FTS + pg_jieba | YES | SQL/test |
| C22-QRY-02 | corpus is disposable in-memory/transaction-local | YES | SQL/catalog |
| C22-QRY-03 | permanent lexical table/index created | NO | catalog/diff |
| C22-QRY-04 | Q01 exact returned IDs | [D02] | raw query output |
| C22-QRY-05 | Q02 exact returned IDs | [D01] | raw query output |
| C22-QRY-06 | lexical query repetitions | 3 fresh connections | evidence |
| C22-QRY-07 | ranking tuning/relevance metric introduced | NO | implementation scan |
| C22-QRY-08 | query mismatch allowed to aggregate PASS | NO | state-machine test |
| C22-NEG-01 | unavailable source/base/Docker classification | BLOCKED | classifier test |
| C22-NEG-02 | observed exact PG18 build/load incompatibility classification | FAIL | classifier + runtime reason |
| C22-NEG-03 | unavailable classified as FAIL | NO | classifier test |
| C22-NEG-04 | unauthorized lexicon provenance classification | LEXICON_LOAD=BLOCKED with LEXICON_PROVENANCE_INVALID; never PASS | classifier test |
| C22-NEG-05 | fixture fingerprint drift classification | evidence invalid; never PASS | classifier test |
| C22-NEG-06 | post-hoc expected-match edit classification | evidence invalid; never PASS | classifier test |
| C22-NEG-07 | fallback/mock classification | never PASS | classifier test |
| C22-NEG-08 | tokenization PASS + lexicon unproven aggregate | not PASS | classifier test |
| C22-NEG-09 | lexicon PASS + query mismatch aggregate | FAIL | classifier test |
| C22-NEG-10 | real missing/invalid dictionary environment attempted | YES | runtime evidence |
| C22-NEG-11 | injected negative mislabeled upstream incompatibility | NO | reason code |
| C22-NEG-12 | inconclusive identity/output classification | UNKNOWN | classifier test |
| C22-EVD-01 | raw ts_debug observations retained | YES when TOKENIZATION executed; otherwise short-circuit N/A rule | runtime evidence |
| C22-EVD-02 | raw to_tsvector observations retained | YES when TOKENIZATION executed; otherwise short-circuit N/A rule | runtime evidence |
| C22-EVD-03 | raw lexical matched doc IDs retained | YES when LEXICAL_QUERY executed; otherwise short-circuit N/A rule | runtime evidence |
| C22-EVD-04 | PostgreSQL/pg_jieba/source/build identities retained | YES for every attempted compatibility run | runtime evidence |
| C22-EVD-05 | five lower states and reason codes retained | YES | runtime evidence |
| C22-EVD-06 | aggregate state is recomputable from lower predicates | YES | architecture test + artifact |
| C22-EVD-07 | runtime evidence generated outside committed source tree | YES | artifact path/git status |
| C22-EVD-08 | runtime evidence artifact SHA-256 recorded | YES | Developer handoff |
| C22-EVD-09 | attempted failures/negative observations retained, not hidden | YES | artifact attempt list |
| C22-EVD-10 | evidence contains no secret/private-family/unauthorized professional content | YES | evidence scan |
| C22-EVD-11 | evidence binds one exact head/environment/lexicon/corpus/run family | YES | identity tuple validation |
| C22-STATE-01 | lower predicates present | exactly 5 | evidence schema |
| C22-STATE-02 | state vocabulary | PASS/FAIL/BLOCKED/UNKNOWN/NOT_EVALUATED only | architecture test |
| C22-STATE-03 | cleanup FAIL precedence | aggregate FAIL | architecture test |
| C22-STATE-04 | any other mandatory FAIL precedence | aggregate FAIL | architecture test |
| C22-STATE-05 | no FAIL + BLOCKED | aggregate BLOCKED | architecture test |
| C22-STATE-06 | no FAIL/BLOCKED + UNKNOWN | aggregate UNKNOWN | architecture test |
| C22-STATE-07 | only PASS/NOT_EVALUATED with at least one NOT_EVALUATED | aggregate NOT_EVALUATED | architecture test |
| C22-STATE-08 | all five PASS | aggregate PASS | architecture test |
| C22-STATE-09 | Developer manually authors aggregate PASS | NO | implementation test |
| C22-STATE-10 | reason codes retained with lower state | YES | evidence |
| C22-CLN-01 | success containers removed | YES | Docker inspect |
| C22-CLN-02 | success volumes removed | YES | Docker inspect |
| C22-CLN-03 | exact derived image tag removed after capture | YES | Docker inspect |
| C22-CLN-04 | expected-failure containers/volumes removed | YES | Docker inspect |
| C22-CLN-05 | unexpected-failure cleanup executed in finally | YES | test path + injected failure |
| C22-CLN-06 | host PostgreSQL config/tsearch_data modified | NO | path/environment proof |
| C22-CLN-07 | production retrieval objects/business rows created | NO | catalog/diff |
| C22-CLN-08 | final PASS or observed technical FAIL has second clean attempt with fresh run_family_id/volumes | YES; N/A only for BLOCKED/UNKNOWN | rerun evidence |
| C22-CLN-09 | second clean attempt depends on first-run residue | NO; N/A only for BLOCKED/UNKNOWN | remove/inspect + rerun |
| C22-CLN-10 | cleanup unproven while aggregate PASS | NO | classifier test |
| C22-PRIV-01 | production DB contacted | NO | connection target evidence |
| C22-PRIV-02 | real user/family/minor/patient data used | NO | fixture audit |
| C22-PRIV-03 | secrets committed/logged in evidence | NO | secret scan |
| C22-PRIV-04 | app role elevated | NO | role facts |
| C22-PRIV-05 | app role creates extension | NO | setup/runtime separation |
| C22-PRIV-06 | raw corpus source is authorized formal project text | YES | source refs/blobs |
| C22-PRIV-07 | production professional approval inferred | NO | handoff claims scan |
| C22-PRIV-08 | Slice22 PASS represented as production RAG readiness | NO | handoff claims scan |
| C22-HEAD-01 | one exact implementation head per run family | YES | evidence |
| C22-HEAD-02 | one base main/merge base per run family | YES | evidence |
| C22-HEAD-03 | one derived image/build identity per run family | YES | evidence |
| C22-HEAD-04 | one frozen lexicon identity per run family | YES | evidence |
| C22-HEAD-05 | one frozen corpus/query identity per run family | YES | evidence |
| C22-HEAD-06 | mixed-head evidence accepted | NO | architecture test |
| C22-HEAD-07 | implementation changes after evidence | require complete rerun | git/evidence chronology |
| C22-HEAD-08 | runtime evidence artifact SHA-256 recorded | YES | handoff |
| C22-HEAD-09 | final remote head equals evidence repo head | YES | remote read-back |
| C22-REG-01 | new architecture test passes | YES | test output |
| C22-REG-02 | new real DB spike test reaches a truthful terminal state when explicitly enabled | YES | test output/evidence |
| C22-REG-03 | current change-governance validator passes | YES | command output |
| C22-REG-04 | static guard + self-test pass | YES | command output |
| C22-REG-05 | canonical verify-all passes | YES | command output |
| C22-REG-06 | full changed-file set remains within frozen implementation surface | YES | git diff/read-back |
| C22-HO-01 | Developer handoff contains lower states/reasons | YES | final report |
| C22-HO-02 | Developer handoff contains raw token/query observations | YES | final report/artifact |
| C22-HO-03 | Developer handoff contains cleanup/rerun proof | YES | final report |
| C22-HO-04 | Developer performs Audit 2 | NO | role boundary |
| C22-HO-05 | Developer merges implementation | NO | role boundary |

## Audit 2 handoff gate

Audit 2 handoff is mechanically complete only when C22-HO-01..05 and C22-HEAD-01..09 pass. A reproducible aggregate FAIL can still be handed to Audit 2. BLOCKED/UNKNOWN/NOT_EVALUATED must remain labeled as such.
