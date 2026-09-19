import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { PageFieldKey } from '../pageRegistry';
import type { V3Preferences } from '../model';
import {
  createFrame360Template,
  type Frame360Template,
} from '../frame360';
import Frame360EditorModal from './Frame360EditorModal';

type Global360ContextValue = {
  enabled: boolean;
  openFrame: (
    page: PageFieldKey,
    cardId: string,
    fields?: string[],
    displayName?: string,
  ) => void;
};

const Global360Context = createContext<Global360ContextValue>({
  enabled: false,
  openFrame: () => undefined,
});

function buildDefaultTemplate(
  page: PageFieldKey,
  cardId: string,
  fields: string[],
  displayName?: string,
): Frame360Template {
  const normalized = fields.length ? fields : ['content'];
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
  template.grid.dataCells = template.grid.dataCells.map((cell, index) => {
    const binding = normalized[index];
    if (!binding) return cell;
    return {
      ...cell,
      content: {
        kind: 'data' as const,
        binding,
        label: binding,
      },
    };
  });
  return template;
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

  const openFrame = useCallback(
    (
      page: PageFieldKey,
      cardId: string,
      fields: string[] = [],
      displayName?: string,
    ) => {
      if (!enabled) return;
      const id = `${page}:${cardId}`;
      const existing = prefs.frame360Templates?.[id];
      setActive(
        existing
          ? JSON.parse(JSON.stringify(existing))
          : buildDefaultTemplate(page, cardId, fields, displayName),
      );
    },
    [enabled, prefs.frame360Templates],
  );

  const value = useMemo(
    () => ({ enabled, openFrame }),
    [enabled, openFrame],
  );

  return (
    <Global360Context.Provider value={value}>
      {children}
      <Frame360EditorModal
        visible={Boolean(active)}
        template={active}
        onClose={() => setActive(null)}
        onSave={template => {
          onPreferencesChange({
            frame360Templates: {
              ...(prefs.frame360Templates ?? {}),
              [template.id]: template,
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
