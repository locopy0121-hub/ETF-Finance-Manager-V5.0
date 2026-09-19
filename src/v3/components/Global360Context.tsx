import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { PageFieldKey } from '../pageRegistry';
import type { V3Preferences } from '../model';
import {
  createFrame360Template,
  migrateFrame360CellsToBlocks,
  type Frame360Template,
} from '../frame360';
import Frame360EditorModal from './Frame360EditorModal';

export type Global360NodeDescriptor = { id: string; label: string; binding?: string; kind?: 'text' | 'data' | 'component' | 'container' };

type Global360ContextValue = {
  enabled: boolean;
  openFrame: (
    page: PageFieldKey,
    cardId: string,
    nodes?: Global360NodeDescriptor[],
    displayName?: string,
  ) => void;
  resolveTemplate: (page: PageFieldKey, cardId: string) => Frame360Template | undefined;
};

const Global360Context = createContext<Global360ContextValue>({
  enabled: false,
  openFrame: () => undefined,
  resolveTemplate: () => undefined,
});

function buildDefaultTemplate(
  page: PageFieldKey,
  cardId: string,
  nodes: Global360NodeDescriptor[],
  displayName?: string,
): Frame360Template {
  const normalized = nodes.length ? nodes : [{ id: 'content', label: '內容', kind: 'container' as const }];
  const columns = Math.min(4, Math.max(1, normalized.length));
  const rows = Math.max(1, Math.ceil(normalized.length / columns));
  const template = createFrame360Template({
    id: `${page}:${cardId}`,
    surface: page,
    templateKey: `global:${page}:${cardId}`,
    name: displayName || `${page} / ${cardId}`,
    rows,
    columns,
  });
  template.grid.dataCells = template.grid.dataCells
    .slice(0, normalized.length)
    .map((cell, index) => {
      const node = normalized[index];
      const content =
        node.kind === 'data' || node.binding
          ? { kind: 'data' as const, binding: node.binding ?? node.id, label: node.label, colorRule: 'auto' as const }
          : { kind: 'text' as const, text: node.label };
      return { ...cell, targetNodeId: node.id, nodeLabel: node.label, content };
    });
  return migrateFrame360CellsToBlocks(template);
}

export function Global360Provider({
  prefs,
  onPreferencesChange,
  children,
}: {
  prefs: V3Preferences;
  onPreferencesChange: (patch: Partial<V3Preferences>) => void;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<Frame360Template | null>(null);
  const enabled =
    prefs.globalEditMode ||
    Object.values(prefs.monitoring?.pageCustomize ?? {}).some(Boolean);

  const resolveTemplate = useCallback(
    (page: PageFieldKey, cardId: string) => prefs.frame360Templates?.[`${page}:${cardId}`],
    [prefs.frame360Templates],
  );

  const openFrame = useCallback(
    (
      page: PageFieldKey,
      cardId: string,
      nodes: Global360NodeDescriptor[] = [],
      displayName?: string,
    ) => {
      if (!enabled) return;
      const existing = resolveTemplate(page, cardId);
      setActive(
        existing
          ? migrateFrame360CellsToBlocks(JSON.parse(JSON.stringify(existing)))
          : buildDefaultTemplate(page, cardId, nodes, displayName),
      );
    },
    [enabled, resolveTemplate],
  );

  const value = useMemo(
    () => ({ enabled, openFrame, resolveTemplate }),
    [enabled, openFrame, resolveTemplate],
  );

  return (
    <Global360Context.Provider value={value}>
      {children}
      <Frame360EditorModal
        visible={Boolean(active)}
        template={active}
        onClose={() => setActive(null)}
        onSave={template => {
          const blockTemplate = migrateFrame360CellsToBlocks(template);
          onPreferencesChange({
            frame360Templates: {
              ...(prefs.frame360Templates ?? {}),
              [blockTemplate.id]: blockTemplate,
            },
          });
          setActive(null);
        }}
      />
    </Global360Context.Provider>
  );
}

export function useGlobal360() {
  return useContext(Global360Context);
}
