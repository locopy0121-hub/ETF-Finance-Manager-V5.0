import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { PageFieldKey } from '../pageRegistry';
import type { V3PageCard, V3Preferences } from '../model';
import {
  createFrame360Template,
  migrateFrame360CellsToBlocks,
  type Frame360Template,
} from '../frame360';
import Frame360EditorModal from './Frame360EditorModal';

export type Global360NodeDescriptor = {
  id: string;
  label: string;
  binding?: string;
  previewValue?: unknown;
  kind?: 'text' | 'data' | 'component' | 'container';
};

type ActiveEdit = {
  page: PageFieldKey;
  cardId: string;
  template: Frame360Template;
  pendingCard?: V3PageCard;
};

type Global360ContextValue = {
  enabled: boolean;
  isPageEditEnabled: (page: PageFieldKey) => boolean;
  togglePageEdit: (page: PageFieldKey) => void;
  canEditPage: (page: PageFieldKey) => boolean;
  openFrame: (
    page: PageFieldKey,
    cardId: string,
    nodes?: Global360NodeDescriptor[],
    displayName?: string,
  ) => void;
  addPageFrame: (page: PageFieldKey) => void;
  duplicatePageFrame: (page: PageFieldKey, cardId: string) => void;
  deletePageFrame: (page: PageFieldKey, cardId: string) => void;
  resolveTemplate: (page: PageFieldKey, cardId: string) => Frame360Template | undefined;
};

const Global360Context = createContext<Global360ContextValue>({
  enabled: false,
  isPageEditEnabled: () => false,
  togglePageEdit: () => undefined,
  canEditPage: () => false,
  openFrame: () => undefined,
  addPageFrame: () => undefined,
  duplicatePageFrame: () => undefined,
  deletePageFrame: () => undefined,
  resolveTemplate: () => undefined,
});

function buildDefaultTemplate(
  page: PageFieldKey,
  cardId: string,
  nodes: Global360NodeDescriptor[],
  displayName?: string,
): Frame360Template {
  const normalized = nodes.filter(node => node.id !== 'frame:root');
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
  template.blocks = normalized.map((node, index) => {
      const columns = Math.max(1, template.canvas.gridColumns);
      const rows = Math.max(1, Math.ceil(normalized.length / columns));
      const column = index % columns;
      const row = Math.floor(index / columns);
      const width = Math.max(16, 100 / columns - 2);
      const height = Math.max(12, 100 / Math.max(1, rows) - 2);
      const cell = {
        id: `block-${node.id}`,
        rowStart: 1,
        columnStart: 1,
        rowSpan: 1,
        columnSpan: 1,
        baseCellIds: [],
        content: { kind: 'empty' as const },
        style: { alignment: 'center' as const },
        layout: {
          mode: 'free' as const,
          x: column * (100 / columns) + 1,
          y: row * (100 / Math.max(1, rows)) + 1,
          width,
          height,
          minWidth: 4,
          minHeight: 4,
          maxWidth: 100,
          maxHeight: 100,
          locked: false,
          zIndex: index,
          nudgeStep: 1,
        },
      };
      const content =
        node.kind === 'data' || node.binding
          ? {
              kind: 'data' as const,
              binding: node.binding ?? node.id,
              label: node.label,
              colorRule: 'auto' as const,
            }
          : { kind: 'text' as const, text: node.label };
      return {
        ...cell,
        targetNodeId: node.id,
        nodeLabel: node.label,
        previewValue: node.previewValue,
        content,
        sourceLocked: true,
      };
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
  const [active, setActive] = useState<ActiveEdit | null>(null);
  // V5.0.6: Settings owns the master permission; each page keeps its own 設定模式.
  const enabled = Boolean(prefs.globalEditMode);
  const isPageEditEnabled = useCallback(
    (page: PageFieldKey) => page !== 'settings' && Boolean(prefs.monitoring?.pageCustomize?.[page]),
    [prefs.monitoring?.pageCustomize],
  );
  const togglePageEdit = useCallback((page: PageFieldKey) => {
    if (!enabled || page === 'settings') return;
    onPreferencesChange({ monitoring: {...prefs.monitoring,pageCustomize:{...prefs.monitoring.pageCustomize,[page]:!isPageEditEnabled(page)}} });
  }, [enabled,isPageEditEnabled,onPreferencesChange,prefs.monitoring]);
  const canEditPage = useCallback((page: PageFieldKey) => enabled && isPageEditEnabled(page), [enabled,isPageEditEnabled]);

  const resolveTemplate = useCallback(
    (page: PageFieldKey, cardId: string) =>
      page === 'settings'
        ? undefined
        : prefs.frame360Templates?.[`${page}:${cardId}`],
    [prefs.frame360Templates],
  );

  const openFrame = useCallback(
    (
      page: PageFieldKey,
      cardId: string,
      nodes: Global360NodeDescriptor[] = [],
      displayName?: string,
    ) => {
      if (!canEditPage(page)) return;
      const existing = resolveTemplate(page, cardId);
      setActive({
        page,
        cardId,
        template: existing
          ? migrateFrame360CellsToBlocks(
              JSON.parse(JSON.stringify(existing)) as Frame360Template,
            )
          : buildDefaultTemplate(page, cardId, nodes, displayName),
      });
    },
    [canEditPage, resolveTemplate],
  );

  const addPageFrame = useCallback(
    (page: PageFieldKey) => {
      if (!canEditPage(page)) return;
      const layout = prefs.pageLayouts?.[page];
      if (!layout) return;

      // Draft only. Nothing is persisted until Frame360EditorModal calls onSave.
      const existingOrdinals = layout.cards
        .filter(card => card.kind === 'custom')
        .map(card => Number(card.title.match(/(\d+)$/)?.[1] ?? 0))
        .filter(Number.isFinite);
      const ordinal = Math.max(0, ...existingOrdinals) + 1;
      const cardId = `${page}-custom-${Date.now()}`;
      const title = `自訂框架 ${ordinal}`;
      const y = layout.cards.reduce(
        (max, card) => Math.max(max, card.y + card.h),
        0,
      );
      const card: V3PageCard = {
        id: cardId,
        title,
        kind: 'custom',
        role: 'normal',
        fields: [],
        fieldSpans: {},
        fieldConfigs: {},
        fieldGap: 8,
        x: 0,
        y,
        w: layout.columns,
        h: 2,
        hidden: false,
        style: {
          fontScale: 100,
          align: 'left',
          backgroundOpacity: 100,
          radius: 16,
          padding: 12,
        },
      };
      const template = migrateFrame360CellsToBlocks(
        createFrame360Template({
          id: `${page}:${cardId}`,
          surface: page,
          templateKey: `global:${page}:${cardId}`,
          name: title,
          rows: 4,
          columns: layout.columns,
        }),
      );
      setActive({ page, cardId, template, pendingCard: card });
    },
    [canEditPage, prefs.pageLayouts],
  );

  const duplicatePageFrame = useCallback(
    (page: PageFieldKey, cardId: string) => {
      if (!canEditPage(page)) return;
      const layout = prefs.pageLayouts?.[page];
      const sourceCard = layout?.cards.find(card => card.id === cardId);
      if (!layout || !sourceCard) return;
      const sourceTemplate = resolveTemplate(page, cardId);
      const newId = `${page}-custom-${Date.now()}`;
      const title = `${sourceCard.title} 副本`;
      const card: V3PageCard = {
        ...JSON.parse(JSON.stringify(sourceCard)),
        id: newId,
        title,
        kind: 'custom',
        y: sourceCard.y + 1,
        hidden: false,
      };
      const template = sourceTemplate
        ? migrateFrame360CellsToBlocks({
            ...JSON.parse(JSON.stringify(sourceTemplate)),
            id: `${page}:${newId}`,
            templateKey: `global:${page}:${newId}`,
            name: title,
            updatedAt: Date.now(),
          })
        : migrateFrame360CellsToBlocks(
            createFrame360Template({
              id: `${page}:${newId}`,
              surface: page,
              templateKey: `global:${page}:${newId}`,
              name: title,
              rows: 4,
              columns: layout.columns,
            }),
          );
      setActive({ page, cardId: newId, template, pendingCard: card });
    },
    [canEditPage, prefs.pageLayouts, resolveTemplate],
  );

  const deletePageFrame = useCallback(
    (page: PageFieldKey, cardId: string) => {
      if (!canEditPage(page)) return;
      const layout = prefs.pageLayouts?.[page];
      const card = layout?.cards.find(item => item.id === cardId);
      if (!layout || !card || card.kind !== 'custom') return;
      const nextTemplates = { ...(prefs.frame360Templates ?? {}) };
      delete nextTemplates[`${page}:${cardId}`];
      onPreferencesChange({
        pageLayouts: {
          ...prefs.pageLayouts,
          [page]: {
            ...layout,
            cards: layout.cards.filter(item => item.id !== cardId),
          },
        },
        frame360Templates: nextTemplates,
      });
      setActive(current =>
        current?.page === page && current.cardId === cardId ? null : current,
      );
    },
    [
      canEditPage,
      onPreferencesChange,
      prefs.frame360Templates,
      prefs.pageLayouts,
    ],
  );

  const value = useMemo(
    () => ({
      enabled,
      isPageEditEnabled,
      togglePageEdit,
      canEditPage,
      openFrame,
      addPageFrame,
      duplicatePageFrame,
      deletePageFrame,
      resolveTemplate,
    }),
    [
      enabled,
      isPageEditEnabled,
      togglePageEdit,
      canEditPage,
      openFrame,
      addPageFrame,
      duplicatePageFrame,
      deletePageFrame,
      resolveTemplate,
    ],
  );

  return (
    <Global360Context.Provider value={value}>
      {children}
      <Frame360EditorModal
        visible={Boolean(active)}
        template={active?.template ?? null}
        onClose={() => setActive(null)}
        onSave={template => {
          if (!active) return;
          const blockTemplate = migrateFrame360CellsToBlocks(template);
          if (active.pendingCard) {
            const layout = prefs.pageLayouts?.[active.page];
            if (!layout) {
              setActive(null);
              return;
            }
            onPreferencesChange({
              pageLayouts: {
                ...prefs.pageLayouts,
                [active.page]: {
                  ...layout,
                  cards: [...layout.cards, active.pendingCard],
                },
              },
              frame360Templates: {
                ...(prefs.frame360Templates ?? {}),
                [blockTemplate.id]: blockTemplate,
              },
            });
          } else {
            onPreferencesChange({
              frame360Templates: {
                ...(prefs.frame360Templates ?? {}),
                [blockTemplate.id]: blockTemplate,
              },
            });
          }
          setActive(null);
        }}
      />
    </Global360Context.Provider>
  );
}

export function useGlobal360() {
  return useContext(Global360Context);
}
