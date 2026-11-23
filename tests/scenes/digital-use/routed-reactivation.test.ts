/**
 * Finding #7 — the reactivation authority is derived from the Frozen Manifest,
 * never from a node-code special case.
 */

import { describe, expect, it } from 'vitest';
import {
  authorizeRoutedReactivation,
  digitalUseNodeManifest,
  isRoutedOnlyNode,
  manifestPredecessorsOf,
  resolveRoutedReactivation,
  resolveDigitalUseRuntimeNode,
} from '@xiaoshuyin/scenes/digital-use';

describe('Finding #7: routed reactivation authority', () => {
  it('keeps the frozen Manifest edges into 01004 exactly as approved', () => {
    const target = resolveDigitalUseRuntimeNode('01004');
    expect(target.entryMode).toEqual(['ROUTED']);
    expect(target.helpOrReentryRefs).toEqual([]);

    const edge = (sourceCode: string) =>
      resolveDigitalUseRuntimeNode(sourceCode).allowedNext.some(
        (candidate) =>
          candidate.kind === 'NODE' && candidate.targetNodeCode === '01004'
      );
    expect(edge('A2002')).toBe(true);
    expect(edge('A2009')).toBe(true);
  });

  it.each(['A2002', 'A2009'])(
    'authorizes the manifest-declared %s → 01004 routed edge',
    (sourceNodeCode) => {
      expect(
        resolveRoutedReactivation({ sourceNodeCode, targetNodeCode: '01004' })
      ).toEqual({
        authorized: true,
        reason: 'AUTHORIZED_ROUTED_REACTIVATION',
      });
    }
  );

  it('denies a predecessor without a manifest edge', () => {
    expect(
      resolveRoutedReactivation({ sourceNodeCode: 'A2001', targetNodeCode: '01004' })
    ).toEqual({ authorized: false, reason: 'NO_MANIFEST_EDGE' });
  });

  it('denies a self route', () => {
    expect(
      resolveRoutedReactivation({ sourceNodeCode: '01004', targetNodeCode: '01004' })
    ).toEqual({ authorized: false, reason: 'SELF_ROUTE' });
  });

  it('denies a target that has any non-routed entry mode', () => {
    const withUserInitiatedEntry = (
      digitalUseNodeManifest as readonly {
        nodeCode: string;
        entryMode: readonly string[];
        helpOrReentryRefs: readonly string[];
      }[]
    ).find(
      (node) =>
        node.entryMode.includes('USER_INITIATED') ||
        node.helpOrReentryRefs.length > 0
    );
    expect(withUserInitiatedEntry).toBeDefined();

    // The same node cannot be reactivated as if it were ROUTED-only: that is
    // exactly the USER_INITIATED widening the finding forbids.
    const source = (
      digitalUseNodeManifest as readonly {
        nodeCode: string;
        allowedNext: readonly { kind: string; targetNodeCode?: string }[];
      }[]
    ).find((node) =>
      node.allowedNext.some(
        (candidate) =>
          candidate.kind === 'NODE' &&
          candidate.targetNodeCode === withUserInitiatedEntry!.nodeCode
      )
    );
    expect(source).toBeDefined();
    expect(
      resolveRoutedReactivation({
        sourceNodeCode: source!.nodeCode,
        targetNodeCode: withUserInitiatedEntry!.nodeCode,
      }).authorized
    ).toBe(false);
  });

  it('only treats manifest ROUTED-only nodes as reactivatable targets', () => {
    expect(isRoutedOnlyNode(resolveDigitalUseRuntimeNode('01004'))).toBe(true);
    expect(isRoutedOnlyNode(resolveDigitalUseRuntimeNode('A2009'))).toBe(true);
    expect(authorizeRoutedReactivation({ sourceNodeCode: 'A2009', targetNodeCode: '01004' })).toBe(
      true
    );
  });

  it('requires several manifest predecessors so single-route nodes are untouched', () => {
    expect(manifestPredecessorsOf('01004').sort()).toEqual(['A2002', 'A2009']);
    // A3000 is ROUTED-only but only A2010 routes into it: the generic helper must
    // not rewrite its own reassessment semantics.
    expect(manifestPredecessorsOf('A3000')).toEqual(['A2010']);
    expect(
      resolveRoutedReactivation({ sourceNodeCode: 'A2010', targetNodeCode: 'A3000' })
    ).toEqual({ authorized: false, reason: 'SINGLE_PREDECESSOR' });
  });
});
