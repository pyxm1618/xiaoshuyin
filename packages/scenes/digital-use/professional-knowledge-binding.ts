/**
 * Slice 17 contribution to the existing Digital Use Scene Package owner.
 * The Scene owner—not Professional Knowledge—owns exact package-version
 * bindings. Production v1 intentionally binds the empty Knowledge set.
 */
import type {
  ScenePackageKnowledgeBindingResult,
  ScenePackageProfessionalKnowledgeRef,
} from '@xiaoshuyin/domain';

export interface DigitalUseProfessionalKnowledgePackageBinding {
  readonly sceneCode: 'DIGITAL_USE';
  readonly scenePackageVersion: string;
  readonly professionalKnowledgeRefs: readonly ScenePackageProfessionalKnowledgeRef[];
}

export const digitalUseProfessionalKnowledgePackageBindings:
  readonly DigitalUseProfessionalKnowledgePackageBinding[] = Object.freeze([
    Object.freeze({
      sceneCode: 'DIGITAL_USE' as const,
      scenePackageVersion: 'v1',
      professionalKnowledgeRefs:
        Object.freeze([]) as readonly ScenePackageProfessionalKnowledgeRef[],
    }),
  ]);

export function resolveProfessionalKnowledgeBindingFromRegistry(
  registry: readonly DigitalUseProfessionalKnowledgePackageBinding[],
  scenePackageVersion: string
): ScenePackageKnowledgeBindingResult {
  const matches = registry.filter(
    (entry) =>
      entry.sceneCode === 'DIGITAL_USE' &&
      entry.scenePackageVersion === scenePackageVersion
  );
  if (matches.length !== 1) {
    return {
      status: 'INVALID',
      reason: matches.length === 0
        ? 'SCENE_PACKAGE_VERSION_NOT_FOUND'
        : 'SCENE_PACKAGE_BINDING_AMBIGUOUS',
    };
  }
  const entry = matches[0]!;
  return {
    status: 'RESOLVED',
    sceneCode: entry.sceneCode,
    scenePackageVersion: entry.scenePackageVersion,
    refs: entry.professionalKnowledgeRefs.map((ref) => ({ ...ref })),
  };
}

export function resolveDigitalUseProfessionalKnowledgeBinding(
  scenePackageVersion: string
): ScenePackageKnowledgeBindingResult {
  return resolveProfessionalKnowledgeBindingFromRegistry(
    digitalUseProfessionalKnowledgePackageBindings,
    scenePackageVersion
  );
}
