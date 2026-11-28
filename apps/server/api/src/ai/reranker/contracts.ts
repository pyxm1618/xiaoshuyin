export const MAX_RERANK_CANDIDATES = 500;

export type RerankCandidateInput = {
  readonly candidateId: string;
  readonly candidateText: string;
};

export type RerankRequest = {
  readonly query: string;
  readonly candidates: readonly RerankCandidateInput[];
  readonly options: {
    readonly instruct: string;
  };
};

export type RerankCandidateResult = {
  readonly candidateId: string;
  readonly score: number;
  readonly rank: number;
};

export type RerankResult = {
  readonly provider: 'ALIBABA_DASHSCOPE';
  readonly configuredModelId: 'qwen3-rerank';
  readonly configuredModelRevision: null;
  readonly providerRequestId: string;
  readonly usage: {
    readonly totalTokens: number;
  };
  readonly results: readonly RerankCandidateResult[];
};

export type RerankInputValidationFailureReason =
  | 'INVALID_REQUEST_SHAPE'
  | 'QUERY_BLANK'
  | 'CANDIDATES_EMPTY'
  | 'CANDIDATES_TOO_MANY'
  | 'CANDIDATE_ID_BLANK'
  | 'CANDIDATE_ID_DUPLICATE'
  | 'CANDIDATE_TEXT_BLANK'
  | 'INSTRUCT_BLANK';

export type RerankInputValidationResult =
  | {
      readonly ok: true;
      readonly value: RerankRequest;
    }
  | {
      readonly ok: false;
      readonly errorCode: 'INVALID_INPUT';
      readonly reason: RerankInputValidationFailureReason;
    };

function invalidInput(reason: RerankInputValidationFailureReason): RerankInputValidationResult {
  return {
    ok: false,
    errorCode: 'INVALID_INPUT',
    reason,
  };
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates a provider-neutral rerank request before any transport invocation.
 * Preserves exact caller-supplied strings for query, candidateId, candidateText, and instruct.
 */
export function validateRerankRequest(request: RerankRequest): RerankInputValidationResult {
  if (request === null || typeof request !== 'object' || Array.isArray(request)) {
    return invalidInput('INVALID_REQUEST_SHAPE');
  }

  if (!isNonBlankString(request.query)) {
    return invalidInput('QUERY_BLANK');
  }

  if (!Array.isArray(request.candidates)) {
    return invalidInput('INVALID_REQUEST_SHAPE');
  }

  if (request.candidates.length === 0) {
    return invalidInput('CANDIDATES_EMPTY');
  }

  if (request.candidates.length > MAX_RERANK_CANDIDATES) {
    return invalidInput('CANDIDATES_TOO_MANY');
  }

  const seenCandidateIds = new Set<string>();
  for (const candidate of request.candidates) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return invalidInput('INVALID_REQUEST_SHAPE');
    }

    if (!isNonBlankString(candidate.candidateId)) {
      return invalidInput('CANDIDATE_ID_BLANK');
    }

    // Exact string equality only: never trim, lowercase, or normalize caller candidateId.
    if (seenCandidateIds.has(candidate.candidateId)) {
      return invalidInput('CANDIDATE_ID_DUPLICATE');
    }
    seenCandidateIds.add(candidate.candidateId);

    if (!isNonBlankString(candidate.candidateText)) {
      return invalidInput('CANDIDATE_TEXT_BLANK');
    }
  }

  if (request.options === null || typeof request.options !== 'object' || Array.isArray(request.options)) {
    return invalidInput('INVALID_REQUEST_SHAPE');
  }

  if (!isNonBlankString(request.options.instruct)) {
    return invalidInput('INSTRUCT_BLANK');
  }

  return {
    ok: true,
    value: request,
  };
}
