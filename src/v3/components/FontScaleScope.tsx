import React from 'react';
import { StyleSheet, Text } from 'react-native';

import type { V3Preferences } from '../model';

function scaleNode(node: React.ReactNode, scale: number): React.ReactNode {
  return React.Children.map(node, child => {
    if (!React.isValidElement(child)) return child;

    const props = child.props as {
      children?: React.ReactNode | ((...args: any[]) => React.ReactNode);
      style?: any;
    };

    // Render-prop children must stay untouched.
    if (typeof props.children === 'function') return child;

    const children = props.children != null ? scaleNode(props.children, scale) : props.children;

    if (child.type === Text) {
      const flat = StyleSheet.flatten(props.style) ?? {};
      const baseFontSize = Number(flat.fontSize);
      const baseLineHeight = Number(flat.lineHeight);
      const scaledStyle = {
        ...(Number.isFinite(baseFontSize) ? { fontSize: baseFontSize * scale } : null),
        ...(Number.isFinite(baseLineHeight) ? { lineHeight: baseLineHeight * scale } : null),
      };
      return React.cloneElement(child as React.ReactElement<any>, {
        ...props,
        style: [props.style, scaledStyle],
        children,
      });
    }

    return React.cloneElement(child as React.ReactElement<any>, {
      ...props,
      children,
    });
  });
}

export function FontScaleScope({
  prefs,
  percent,
  children,
}: {
  prefs: Pick<V3Preferences, 'fontScale'>;
  percent?: number;
  children: React.ReactNode;
}) {
  const requested = percent ?? prefs.fontScale;
  const scale = Math.max(0.8, Math.min(1.6, Number(requested || 100) / 100));
  return <>{scaleNode(children, scale)}</>;
}

export default FontScaleScope;
