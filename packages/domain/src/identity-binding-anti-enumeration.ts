/**
 * Candidate-facing response serializers.
 *
 * The frozen requirement (005 §5.6.2, spec FR-019) is that every internal
 * reason before a binding exists is observationally indistinguishable:
 * same HTTP status, same body key set, same values except the opaque pending
 * context token. These helpers are the ONLY way candidate routes build a body.
 */

export interface CandidateBootstrapGenericResponse {
  binding: 'NOT_COMPLETED';
  pendingContextToken: string;
}

export interface CandidateBootstrapReusedResponse {
  binding: 'REUSED';
  sessionToken: string;
  account: { id: string };
  person: { id: string };
}

/**
 * Historical settled replay of the same BOOTSTRAP operation key whose
 * authoritative attempt is already COMMITTED (plan D-10.2 / D-5.3).
 *
 * This is NOT the Case B `REUSED` branch: the candidate is already P1, and no
 * session is issued here. Ordinary session exchange remains the only path.
 */
export interface CandidateBootstrapCommittedResponse {
  binding: 'COMMITTED';
}

export interface CandidateDecisionResponse {
  binding: 'NOT_COMPLETED';
}

export interface CandidateStatusResponse {
  binding: 'NOT_COMPLETED' | 'COMMITTED';
}

export interface CandidateSessionCommittedResponse {
  binding: 'COMMITTED';
  sessionToken: string;
  account: { id: string };
  person: { id: string };
}

export interface CandidateSessionGenericResponse {
  binding: 'NOT_COMPLETED';
}

export function candidateBootstrapResponse(
  pendingContextToken: string
): CandidateBootstrapGenericResponse {
  return { binding: 'NOT_COMPLETED', pendingContextToken };
}

export function candidateBootstrapReusedResponse(input: {
  sessionToken: string;
  accountId: string;
  personId: string;
}): CandidateBootstrapReusedResponse {
  return {
    binding: 'REUSED',
    sessionToken: input.sessionToken,
    account: { id: input.accountId },
    person: { id: input.personId },
  };
}

export function candidateBootstrapCommittedResponse(): CandidateBootstrapCommittedResponse {
  return { binding: 'COMMITTED' };
}

export function candidateDecisionResponse(): CandidateDecisionResponse {
  return { binding: 'NOT_COMPLETED' };
}

export function candidateStatusResponse(
  committed: boolean
): CandidateStatusResponse {
  return { binding: committed ? 'COMMITTED' : 'NOT_COMPLETED' };
}

export function candidateSessionResponse(
  committed: boolean,
  input?: { sessionToken: string; accountId: string; personId: string }
): CandidateSessionCommittedResponse | CandidateSessionGenericResponse {
  if (!committed || !input) return { binding: 'NOT_COMPLETED' };
  return {
    binding: 'COMMITTED',
    sessionToken: input.sessionToken,
    account: { id: input.accountId },
    person: { id: input.personId },
  };
}