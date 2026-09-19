import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  appendFrame360Block,
  migrateFrame360CellsToBlocks,
  resizeFrame360Workspace,
  mergeFrame360Cells,
  splitFrame360Cell,
  type Frame360Alignment,
  type Frame360CellKind,
  type Frame360DataCell,
  type Frame360Template,
} from '../frame360';
import Frame360Runtime from './Frame360Runtime';
import {
  FRAME360_CELL_TYPES,
  FRAME360_COMPONENTS,
  FRAME360_REMINDERS,
  frame360CellTypeLabel,
  frame360ComponentLabel,
} from '../frame360Registry';

type Props = {
  visible: boolean;
  template: Frame360Template | null;
  onClose: () => void;
  onSave: (template: Frame360Template) => void;
};

const CELL_W = 72;
const CELL_H = 58;
const PREVIEW_W = 46;
const PREVIEW_H = 38;
const COLOR_PRESETS = [
  '#0F172A', '#334155', '#64748B', '#FFFFFF',
  '#0066FF', '#38BDF8', '#7C3AED', '#EC4899',
  '#DC2626', '#F97316', '#CA8A04', '#16A34A',
  '#FEE2E2', '#FEF9C3', '#DCFCE7', '#EFF6FF',
];

type EditableBlockProps = {
  cell: Frame360DataCell;
  active: boolean;
  locked: boolean;
  style: any;
  onPress: () => void;
  onLongPress: () => void;
  onDrag: (dx: number, dy: number) => void;
  children: React.ReactNode;
};

function EditableBlock({
  active,
  locked,
  style,
  onPress,
  onLongPress,
  onDrag,
  children,
}: EditableBlockProps) {
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !locked && (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4),
        onPanResponderRelease: (_event, gesture) => {
          if (!locked) onDrag(gesture.dx, gesture.dy);
        },
      }),
    [locked, onDrag],
  );

  return (
    <Pressable
      {...pan.panHandlers}
      disabled={locked}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={380}
      style={[styles.cell, style, active && styles.cellActive]}
    >
      {children}
    </Pressable>
  );
}

const cloneTemplate = (template: Frame360Template): Frame360Template =>
  JSON.parse(JSON.stringify(template)) as Frame360Template;

const ALIGNMENTS: Array<[Frame360Alignment, string]> = [
  ['topLeft', '左上'],
  ['topCenter', '上中'],
  ['topRight', '右上'],
  ['middleLeft', '左中'],
  ['center', '置中'],
  ['middleRight', '右中'],
  ['bottomLeft', '左下'],
  ['bottomCenter', '下中'],
  ['bottomRight', '右下'],
];

export default function Frame360EditorModal({
  visible,
  template,
  onClose,
  onSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Frame360Template | null>(template);
  const [selected, setSelected] = useState<string[]>([]);
  const [gridDialog, setGridDialog] = useState(false);
  const [typeDialog, setTypeDialog] = useState(false);
  const [deepDialog, setDeepDialog] = useState(false);
  const [deepCellId, setDeepCellId] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [rowsText, setRowsText] = useState('2');
  const [columnsText, setColumnsText] = useState('5');
  const [previewScale, setPreviewScale] = useState(100);
  const [editorLocked, setEditorLocked] = useState(Boolean(template?.locked));

  useEffect(() => {
    if (!visible || !template) return;
    setDraft(migrateFrame360CellsToBlocks(cloneTemplate(template)));
    setSelected([]);
    setDeepCellId(null);
    setDeepDialog(false);
    setMultiSelectMode(false);
    setRowsText(String(template.grid.rows));
    setColumnsText(String(template.grid.columns));
    setPreviewScale(100);
    setEditorLocked(Boolean(template.locked));
  }, [visible, template?.id, template?.version]);

  const selectedCells = useMemo(
    () =>
      draft?.grid.dataCells.filter(cell => selected.includes(cell.id)) ?? [],
    [draft, selected],
  );

  const deepCell = useMemo(
    () => draft?.grid.dataCells.find(cell => cell.id === deepCellId) ?? null,
    [draft, deepCellId],
  );

  const previewData = useMemo(() => {
    if (!draft) return {};
    return Object.fromEntries(
      draft.grid.dataCells
        .filter(cell => cell.content.kind === 'data')
        .map(cell => {
          const content = cell.content.kind === 'data' ? cell.content : null;
          const key = content?.binding ?? '';
          const lower = key.toLowerCase();
          const sample =
            lower.includes('pnl') || lower.includes('profit') ? 169 :
            lower.includes('roi') || lower.includes('percent') ? 1.52 :
            lower.includes('count') || lower.includes('share') ? 32 :
            5754;
          return [key, sample];
        })
        .filter(([key]) => Boolean(key)),
    );
  }, [draft]);

  const previewToday = '2099-01-01';

  const replaceCell = (
    cellId: string,
    updater: (cell: Frame360DataCell) => Frame360DataCell,
  ) => {
    setDraft(current => {
      if (!current) return current;
      return {
        ...current,
        grid: {
          ...current.grid,
          dataCells: current.grid.dataCells.map(cell =>
            cell.id === cellId ? updater(cell) : cell,
          ),
        },
      };
    });
  };


  const getDefaultLayout = (cell: Frame360DataCell) => ({
    mode: 'free' as const,
    x: ((cell.columnStart - 1) / draft!.grid.columns) * 100,
    y: ((cell.rowStart - 1) / draft!.grid.rows) * 100,
    width: (cell.columnSpan / draft!.grid.columns) * 100,
    height: (cell.rowSpan / draft!.grid.rows) * 100,
    minWidth: 4,
    minHeight: 4,
    maxWidth: 100,
    maxHeight: 100,
    lockAspectRatio: false,
    locked: false,
    zIndex: 0,
    nudgeStep: 1,
    ...cell.layout,
  });

  const rectsOverlap = (a: any, b: any) =>
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;

  const updateBlockLayout = (
    cellId: string,
    updater: (layout: ReturnType<typeof getDefaultLayout>) => ReturnType<typeof getDefaultLayout>,
  ) => {
    if (editorLocked || !draft) return;
    setDraft(current => {
      if (!current) return current;
      const target = current.grid.dataCells.find(cell => cell.id === cellId);
      if (!target || target.layout?.locked) return current;
      const base = getDefaultLayout(target);
      const next = updater(base);
      const normalized = {
        ...next,
        x: Math.max(0, Math.min(100 - next.width, next.x)),
        y: Math.max(0, Math.min(100 - next.height, next.y)),
        width: Math.max(next.minWidth ?? 4, Math.min(next.maxWidth ?? 100, next.width)),
        height: Math.max(next.minHeight ?? 4, Math.min(next.maxHeight ?? 100, next.height)),
      };
      if (!current.allowOverlap) {
        const collision = current.grid.dataCells.some(other => {
          if (other.id === cellId || other.content.kind === 'empty') return false;
          return rectsOverlap(normalized, getDefaultLayout(other));
        });
        if (collision) return current;
      }
      return {
        ...current,
        grid: {
          ...current.grid,
          dataCells: current.grid.dataCells.map(cell =>
            cell.id === cellId ? { ...cell, layout: normalized } : cell,
          ),
        },
      };
    });
  };

  const nudgeBlock = (cellId: string, dx: number, dy: number) =>
    updateBlockLayout(cellId, layout => {
      const step = layout.nudgeStep ?? 1;
      const pxW = Math.max(1, draft!.grid.columns * CELL_W);
      const pxH = Math.max(1, draft!.grid.rows * CELL_H);
      return {
        ...layout,
        x: layout.x + (dx * step / pxW) * 100,
        y: layout.y + (dy * step / pxH) * 100,
      };
    });

  const dragBlock = (cellId: string, dx: number, dy: number) =>
    updateBlockLayout(cellId, layout => {
      const pxW = Math.max(1, draft!.grid.columns * CELL_W);
      const pxH = Math.max(1, draft!.grid.rows * CELL_H);
      return {
        ...layout,
        x: layout.x + (dx / pxW) * 100,
        y: layout.y + (dy / pxH) * 100,
      };
    });

  const setLayer = (cellId: string, action: 'up' | 'down' | 'top' | 'bottom') => {
    if (!draft || editorLocked) return;
    const zValues = draft.grid.dataCells.map(cell => cell.layout?.zIndex ?? 0);
    const min = Math.min(0, ...zValues);
    const max = Math.max(0, ...zValues);
    updateBlockLayout(cellId, layout => ({
      ...layout,
      zIndex:
        action === 'top' ? max + 1 :
        action === 'bottom' ? min - 1 :
        action === 'up' ? (layout.zIndex ?? 0) + 1 :
        (layout.zIndex ?? 0) - 1,
    }));
  };

  const renderColorPalette = (
    label: string,
    field: 'textColor' | 'textBackgroundColor' | 'backgroundColor' | 'borderColor',
  ) => (
    <>
      <Text style={styles.deepLabel}>{label}</Text>
      <View style={styles.paletteRow}>
        {COLOR_PRESETS.map(color => (
          <Pressable
            key={color}
            accessibilityLabel={color}
            onPress={() =>
              deepCell &&
              !editorLocked &&
              replaceCell(deepCell.id, cell => ({
                ...cell,
                style: { ...cell.style, [field]: color },
              }))
            }
            style={[
              styles.colorSwatch,
              { backgroundColor: color },
              deepCell?.style[field] === color && styles.colorSwatchActive,
            ]}
          />
        ))}
      </View>
      <TextInput
        editable={!editorLocked}
        value={(deepCell?.style[field] as string | undefined) ?? ''}
        onChangeText={value =>
          deepCell &&
          replaceCell(deepCell.id, cell => ({
            ...cell,
            style: { ...cell.style, [field]: value },
          }))
        }
        placeholder="#RRGGBB / transparent"
        style={styles.deepInput}
      />
    </>
  );

  const applyType = (kind: Frame360CellKind) => {
    if (selected.length !== 1) return;
    const cellId = selected[0];

    if (kind === 'reminder') {
      setTypeDialog(false);
      Alert.alert(
        '選擇提醒資料',
        '提醒條件成立時才會顯示物件；未成立時保留格線但不顯示提醒。',
        [
          ...FRAME360_REMINDERS.map(item => ({
            text: item.label,
            onPress: () =>
              replaceCell(cellId, cell => ({
                ...cell,
                content: {
                  kind: 'reminder' as const,
                  source: item.source,
                  activeLabel: item.activeLabel,
                  effect: 'breathe' as const,
                },
              })),
          })),
          { text: '取消', style: 'cancel' as const },
        ],
      );
      return;
    }

    if (kind === 'component') {
      setTypeDialog(false);
      Alert.alert(
        '選擇組件',
        '組件會成為此方塊內的獨立子根。',
        [
          ...FRAME360_COMPONENTS.map(item => ({
            text: item.label,
            onPress: () =>
              replaceCell(cellId, cell => ({
                ...cell,
                content: { kind: 'component' as const, component: item.kind },
              })),
          })),
          { text: '取消', style: 'cancel' as const },
        ],
      );
      return;
    }

    replaceCell(cellId, cell => ({
      ...cell,
      content:
        kind === 'text'
          ? { kind: 'text', text: '文字' }
          : kind === 'data'
            ? { kind: 'data', binding: 'symbol' }
            : kind === 'image'
              ? { kind: 'image' }
              : kind === 'icon'
                ? { kind: 'icon', icon: '●' }
                : kind === 'chart'
                  ? { kind: 'chart', chartType: 'line', binding: 'price' }
                  : kind === 'container'
                    ? { kind: 'container' }
                    : { kind: 'empty' },
    }));
    setTypeDialog(false);
  };

  const mergeSelected = () => {
    if (!draft || selected.length < 2) return;
    const result = mergeFrame360Cells(draft.grid, selected);
    if (result.status === 'needsDecision') {
      Alert.alert(
        '合併方塊',
        '選取的方塊已有多筆內容，請選擇如何處理。系統不會自動刪除資料。',
        [
          {
            text: '保留第一格',
            onPress: () => {
              const next = mergeFrame360Cells(draft.grid, selected, 'keepFirst');
              if (next.status === 'merged') {
                setDraft({ ...draft, grid: next.grid });
                setSelected([next.mergedCell.id]);
                setMultiSelectMode(false);
              }
            },
          },
          {
            text: '保留最後一格',
            onPress: () => {
              const next = mergeFrame360Cells(draft.grid, selected, 'keepLast');
              if (next.status === 'merged') {
                setDraft({ ...draft, grid: next.grid });
                setSelected([next.mergedCell.id]);
                setMultiSelectMode(false);
              }
            },
          },
          { text: '取消', style: 'cancel' },
        ],
      );
      return;
    }
    setDraft({ ...draft, grid: result.grid });
    setSelected([result.mergedCell.id]);
    setMultiSelectMode(false);
  };

  const splitSelected = () => {
    if (!draft || selected.length !== 1) return;
    const next = splitFrame360Cell(draft.grid, selected[0]);
    setDraft({ ...draft, grid: next });
    setSelected([]);
  };

  const resizeWorkspace = () => {
    const rows = Number(rowsText);
    const columns = Number(columnsText);
    try {
      setDraft(current =>
        current ? resizeFrame360Workspace(current, rows, columns) : current,
      );
      setSelected([]);
      setGridDialog(false);
    } catch (error) {
      Alert.alert(
        '無法調整工作區',
        error instanceof Error ? error.message : '請檢查列數與欄數',
      );
    }
  };

  const addBlock = () => {
    if (!draft || editorLocked) return;
    const result = appendFrame360Block(draft);
    setDraft(result.template);
    setSelected([result.block.id]);
    setMultiSelectMode(false);
    setTypeDialog(true);
  };

  const handleCellPress = (cell: Frame360DataCell) => {
    if (editorLocked || cell.layout?.locked) return;
    if (multiSelectMode) {
      setSelected(current =>
        current.includes(cell.id)
          ? current.filter(id => id !== cell.id)
          : [...current, cell.id],
      );
      return;
    }
    setSelected([cell.id]);
    setTypeDialog(true);
  };

  const handleCellLongPress = (cell: Frame360DataCell) => {
    if (editorLocked || cell.layout?.locked) return;
    setSelected([cell.id]);
    setMultiSelectMode(false);
    setDeepCellId(cell.id);
    setDeepDialog(true);
  };

  const cellPreviewText = (cell: Frame360DataCell) => {
    if (cell.content.kind === 'text') return cell.content.text;
    if (cell.content.kind === 'data') return cell.content.label ?? cell.nodeLabel ?? '資料';
    if (cell.content.kind === 'icon') return cell.content.icon;
    if (cell.content.kind === 'chart') return cell.nodeLabel ?? '圖表';
    if (cell.content.kind === 'reminder') return cell.content.activeLabel;
    if (cell.content.kind === 'component') {
      return frame360ComponentLabel(cell.content.component);
    }
    return frame360CellTypeLabel(cell.content.kind);
  };

  const renderLockedGrid = (preview = false) => {
    if (!draft) return null;
    const unitW = preview ? PREVIEW_W : CELL_W;
    const unitH = preview ? PREVIEW_H : CELL_H;
    const width = draft.grid.columns * unitW;
    const height = draft.grid.rows * unitH;

    return (
      <View
        style={[
          styles.lockedGrid,
          preview ? styles.previewGrid : styles.editGrid,
          { width, height },
        ]}
      >
        {draft.grid.dataCells.filter(cell => cell.content.kind !== 'empty' || Boolean(cell.targetNodeId)).map(cell => {
          const active = !preview && selected.includes(cell.id);
          const layout = getDefaultLayout(cell);
          const baseStyle = cell.layout?.mode === 'free'
            ? {
                position: 'absolute' as const,
                left: (layout.x / 100) * width,
                top: (layout.y / 100) * height,
                width: (layout.width / 100) * width,
                height: (layout.height / 100) * height,
                zIndex: layout.zIndex ?? 0,
              }
            : {
                position: 'absolute' as const,
                left: (cell.columnStart - 1) * unitW,
                top: (cell.rowStart - 1) * unitH,
                width: cell.columnSpan * unitW,
                height: cell.rowSpan * unitH,
                zIndex: cell.layout?.zIndex ?? 0,
              };
          return (
            <EditableBlock
              key={cell.id}
              cell={cell}
              active={active}
              locked={preview || editorLocked || Boolean(cell.layout?.locked)}
              onPress={() => handleCellPress(cell)}
              onLongPress={() => handleCellLongPress(cell)}
              onDrag={(dx, dy) => dragBlock(cell.id, dx, dy)}
              style={[
                baseStyle,
                preview && styles.previewCell,
                cell.layout?.locked && styles.cellLocked,
              ]}
            >
              <Text
                numberOfLines={preview ? 2 : 1}
                style={preview ? styles.previewCellText : styles.cellType}
              >
                {preview ? cellPreviewText(cell) : frame360CellTypeLabel(cell.content.kind)}
              </Text>
              {!preview ? (
                <>
                  <Text style={styles.cellMeta}>
                    {cell.layout?.mode === 'free' ? `Block · Z${cell.layout?.zIndex ?? 0}` : 'Block'}
                  </Text>
                  {cell.content.kind !== 'empty' ? (
                    <Text numberOfLines={1} style={styles.cellPreview}>
                      {cellPreviewText(cell)}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </EditableBlock>
          );
        })}
      </View>
    );
  };

  if (!draft) return null;

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View
          style={[
            styles.screen,
            {
              paddingTop: Math.max(14, insets.top + 8),
              paddingBottom: Math.max(8, insets.bottom),
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>360 編輯器</Text>
              <Text style={styles.title}>{draft.name}</Text>
              <Text style={styles.subtitle}>
                工作區 {draft.grid.columns} 欄 × {draft.grid.rows} 列 · ${draft.grid.dataCells.length} 個方塊 · 已選 {selected.length}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.toolbar}>
            <Pressable
              onPress={() => setEditorLocked(value => !value)}
              style={[styles.toolButton, editorLocked && styles.lockButton]}
            >
              <Text style={[styles.toolText, editorLocked && styles.lockButtonText]}>
                {editorLocked ? '🔒 解鎖編輯' : '🔓 編輯中'}
              </Text>
            </Pressable>
            <Pressable
              disabled={editorLocked}
              onPress={() => setDraft(current => current ? { ...current, allowOverlap: !current.allowOverlap } : current)}
              style={[styles.toolButton, draft.allowOverlap && styles.toolButtonActive, editorLocked && styles.disabled]}
            >
              <Text style={[styles.toolText, draft.allowOverlap && styles.toolTextActive]}>
                {draft.allowOverlap ? '自由圖層 ON' : 'ZERO OVERLAP'}
              </Text>
            </Pressable>
            <Pressable
              disabled={editorLocked}
              onPress={addBlock}
              style={[styles.toolButton, styles.addBlockButton, editorLocked && styles.disabled]}
            >
              <Text style={[styles.toolText, styles.addBlockText]}>＋新增方塊</Text>
            </Pressable>
            <Pressable
              disabled={editorLocked}
              onPress={() => setGridDialog(true)}
              style={[styles.toolButton, editorLocked && styles.disabled]}
            >
              <Text style={styles.toolText}>調整工作區格線</Text>
            </Pressable>

          </View>

          <View style={styles.previewPanel}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>即時預覽框</Text>
              <Text style={styles.previewHint}>實際內容預覽 · {previewScale}%</Text>
            </View>
            <View style={styles.previewScaleRow}>
              {[50, 75, 100, 125, 150].map(scale => (
                <Pressable
                  key={scale}
                  onPress={() => setPreviewScale(scale)}
                  style={[styles.scaleButton, previewScale === scale && styles.scaleButtonActive]}
                >
                  <Text style={[styles.scaleText, previewScale === scale && styles.scaleTextActive]}>
                    {scale}%
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={{ height: Math.max(80, 160 * previewScale / 100), overflow: 'hidden' }}>
              <View
                style={{
                  width: `${10000 / previewScale}%`,
                  transform: [{ scale: previewScale / 100 }],
                  transformOrigin: 'top left',
                }}
              >
            <Frame360Runtime
              template={draft}
              data={previewData}
              reminderContext={{
                today: previewToday,
                dividendDate: previewToday,
                exDividendDate: previewToday,
                lastBuyDate: previewToday,
                payDate: previewToday,
              }}
              minHeight={160}
            />
              </View>
            </View>
          </View>

          <Text style={styles.gestureHint}>
            單點：選擇方塊類型　·　長按：完整編輯　·　拖曳：自由移動
          </Text>

          <ScrollView
            style={styles.canvas}
            contentContainerStyle={styles.canvasContent}
            horizontal
          >
            {renderLockedGrid(false)}
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(18, insets.bottom + 10) },
            ]}
          >
            <Pressable onPress={onClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>取消</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                onSave({
                  ...draft,
                  locked: true,
                  version: draft.version + 1,
                  updatedAt: Date.now(),
                })
              }
              style={styles.primaryButton}
            >
              <Text style={styles.primaryText}>儲存並上鎖</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={gridDialog} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={[styles.dialog, { paddingBottom: Math.max(18, insets.bottom + 12) }]}>
            <Text style={styles.dialogTitle}>調整目前框架工作區</Text>
            <Text style={styles.dialogHint}>只調整定位格線，不新增、不刪除任何方塊。輸入欄 × 列，例如 8 × 4。</Text>
            <View style={styles.inputRow}>
              <TextInput
                keyboardType="number-pad"
                value={columnsText}
                onChangeText={setColumnsText}
                style={styles.input}
              />
              <Text style={styles.times}>×</Text>
              <TextInput
                keyboardType="number-pad"
                value={rowsText}
                onChangeText={setRowsText}
                style={styles.input}
              />
            </View>
            <View style={styles.dialogActions}>
              <Pressable onPress={() => setGridDialog(false)} style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>取消</Text>
              </Pressable>
              <Pressable onPress={resizeWorkspace} style={styles.primaryButton}>
                <Text style={styles.primaryText}>套用到目前框架</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={typeDialog} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={[styles.dialog, { paddingBottom: Math.max(18, insets.bottom + 12) }]}>
            <Text style={styles.dialogTitle}>選擇方塊類型</Text>
            <ScrollView>
              {FRAME360_CELL_TYPES.filter(item => item.kind !== 'empty').map(item => (
                <Pressable
                  key={item.kind}
                  onPress={() => applyType(item.kind)}
                  style={styles.typeRow}
                >
                  <Text style={styles.typeTitle}>{item.label}</Text>
                  <Text style={styles.typeDescription}>{item.description}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setTypeDialog(false)} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>取消</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={deepDialog} transparent animationType="slide">
        <View style={styles.backdrop}>
          <View
            style={[
              styles.deepSheet,
              { paddingBottom: Math.max(20, insets.bottom + 14) },
            ]}
          >
            <Text style={styles.dialogTitle}>360 深度功能</Text>
            <Text style={styles.dialogHint}>
              {deepCell
                ? `${cellPreviewText(deepCell)} · ${frame360CellTypeLabel(
                    deepCell.content.kind,
                  )}`
                : ''}
            </Text>

            {deepCell ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.deepBody}
              >
                <Text style={styles.sectionTitle}>方塊位置與尺寸</Text>
                <View style={styles.choiceWrap}>
                  <Pressable
                    onPress={() => updateBlockLayout(deepCell.id, layout => ({ ...layout, mode: 'free' }))}
                    style={[styles.choice, deepCell.layout?.mode === 'free' && styles.choiceActive]}
                  >
                    <Text style={styles.choiceText}>自由方塊</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => replaceCell(deepCell.id, cell => ({ ...cell, layout: { ...cell.layout, mode: 'grid' } }))}
                    style={[styles.choice, deepCell.layout?.mode !== 'free' && styles.choiceActive]}
                  >
                    <Text style={styles.choiceText}>格線定位</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => updateBlockLayout(deepCell.id, layout => ({ ...layout, locked: !layout.locked }))}
                    style={[styles.choice, deepCell.layout?.locked && styles.choiceActive]}
                  >
                    <Text style={styles.choiceText}>{deepCell.layout?.locked ? '🔒 方塊已鎖' : '🔓 鎖定方塊'}</Text>
                  </Pressable>
                </View>

                <View style={styles.sizeRow}>
                  <View style={styles.sizeField}>
                    <Text style={styles.deepLabel}>寬度 %</Text>
                    <TextInput
                      editable={!editorLocked && !deepCell.layout?.locked}
                      keyboardType="decimal-pad"
                      value={String(Math.round(getDefaultLayout(deepCell).width * 10) / 10)}
                      onChangeText={value => updateBlockLayout(deepCell.id, layout => ({ ...layout, width: Number(value) || layout.width }))}
                      style={styles.deepInput}
                    />
                  </View>
                  <View style={styles.sizeField}>
                    <Text style={styles.deepLabel}>高度 %</Text>
                    <TextInput
                      editable={!editorLocked && !deepCell.layout?.locked}
                      keyboardType="decimal-pad"
                      value={String(Math.round(getDefaultLayout(deepCell).height * 10) / 10)}
                      onChangeText={value => updateBlockLayout(deepCell.id, layout => ({ ...layout, height: Number(value) || layout.height }))}
                      style={styles.deepInput}
                    />
                  </View>
                </View>

                <Text style={styles.deepLabel}>位置微調</Text>
                <View style={styles.nudgePad}>
                  <Pressable style={styles.nudgeButton} onPress={() => nudgeBlock(deepCell.id, 0, -1)}><Text style={styles.nudgeText}>↑</Text></Pressable>
                  <View style={styles.nudgeMiddle}>
                    <Pressable style={styles.nudgeButton} onPress={() => nudgeBlock(deepCell.id, -1, 0)}><Text style={styles.nudgeText}>←</Text></Pressable>
                    <Text style={styles.stepValue}>{getDefaultLayout(deepCell).nudgeStep ?? 1}px</Text>
                    <Pressable style={styles.nudgeButton} onPress={() => nudgeBlock(deepCell.id, 1, 0)}><Text style={styles.nudgeText}>→</Text></Pressable>
                  </View>
                  <Pressable style={styles.nudgeButton} onPress={() => nudgeBlock(deepCell.id, 0, 1)}><Text style={styles.nudgeText}>↓</Text></Pressable>
                </View>
                <View style={styles.choiceWrap}>
                  {[1, 2, 4, 8].map(step => (
                    <Pressable
                      key={step}
                      onPress={() => updateBlockLayout(deepCell.id, layout => ({ ...layout, nudgeStep: step }))}
                      style={[styles.choice, (getDefaultLayout(deepCell).nudgeStep ?? 1) === step && styles.choiceActive]}
                    >
                      <Text style={styles.choiceText}>{step}px</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.deepLabel}>圖層</Text>
                <View style={styles.choiceWrap}>
                  <Pressable style={styles.choice} onPress={() => setLayer(deepCell.id, 'top')}><Text style={styles.choiceText}>最上層</Text></Pressable>
                  <Pressable style={styles.choice} onPress={() => setLayer(deepCell.id, 'up')}><Text style={styles.choiceText}>上移一層</Text></Pressable>
                  <Pressable style={styles.choice} onPress={() => setLayer(deepCell.id, 'down')}><Text style={styles.choiceText}>下移一層</Text></Pressable>
                  <Pressable style={styles.choice} onPress={() => setLayer(deepCell.id, 'bottom')}><Text style={styles.choiceText}>最下層</Text></Pressable>
                </View>

                <Text style={styles.sectionTitle}>內容與對齊</Text>
                <Text style={styles.deepLabel}>九宮格對齊</Text>
                <View style={styles.choiceWrap}>
                  {ALIGNMENTS.map(([key, label]) => (
                    <Pressable
                      key={key}
                      onPress={() =>
                        replaceCell(deepCell.id, cell => ({
                          ...cell,
                          style: { ...cell.style, alignment: key },
                        }))
                      }
                      style={[
                        styles.choice,
                        deepCell.style.alignment === key && styles.choiceActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          deepCell.style.alignment === key && styles.choiceTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.stepRow}>
                  <Text style={styles.deepLabel}>內距</Text>
                  <Pressable
                    style={styles.stepButton}
                    onPress={() =>
                      replaceCell(deepCell.id, cell => ({
                        ...cell,
                        style: {
                          ...cell.style,
                          padding: Math.max(0, (cell.style.padding ?? 8) - 1),
                        },
                      }))
                    }
                  >
                    <Text style={styles.stepButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepValue}>{deepCell.style.padding ?? 8}</Text>
                  <Pressable
                    style={styles.stepButton}
                    onPress={() =>
                      replaceCell(deepCell.id, cell => ({
                        ...cell,
                        style: {
                          ...cell.style,
                          padding: Math.min(32, (cell.style.padding ?? 8) + 1),
                        },
                      }))
                    }
                  >
                    <Text style={styles.stepButtonText}>＋</Text>
                  </Pressable>
                </View>

                <View style={styles.stepRow}>
                  <Text style={styles.deepLabel}>字級</Text>
                  <Pressable
                    style={styles.stepButton}
                    onPress={() =>
                      replaceCell(deepCell.id, cell => ({
                        ...cell,
                        style: {
                          ...cell.style,
                          fontSize: Math.max(8, (cell.style.fontSize ?? 12) - 1),
                        },
                      }))
                    }
                  >
                    <Text style={styles.stepButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepValue}>{deepCell.style.fontSize ?? 12}</Text>
                  <Pressable
                    style={styles.stepButton}
                    onPress={() =>
                      replaceCell(deepCell.id, cell => ({
                        ...cell,
                        style: {
                          ...cell.style,
                          fontSize: Math.min(40, (cell.style.fontSize ?? 12) + 1),
                        },
                      }))
                    }
                  >
                    <Text style={styles.stepButtonText}>＋</Text>
                  </Pressable>
                </View>

                <View style={styles.stepRow}>
                  <Text style={styles.deepLabel}>透明度</Text>
                  <Pressable
                    style={styles.stepButton}
                    onPress={() =>
                      replaceCell(deepCell.id, cell => ({
                        ...cell,
                        style: {
                          ...cell.style,
                          opacity: Math.max(0, (cell.style.opacity ?? 100) - 5),
                        },
                      }))
                    }
                  >
                    <Text style={styles.stepButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepValue}>{deepCell.style.opacity ?? 100}%</Text>
                  <Pressable
                    style={styles.stepButton}
                    onPress={() =>
                      replaceCell(deepCell.id, cell => ({
                        ...cell,
                        style: {
                          ...cell.style,
                          opacity: Math.min(100, (cell.style.opacity ?? 100) + 5),
                        },
                      }))
                    }
                  >
                    <Text style={styles.stepButtonText}>＋</Text>
                  </Pressable>
                </View>

                <View style={styles.stepRow}>
                  <Text style={styles.deepLabel}>圓角</Text>
                  <Pressable
                    style={styles.stepButton}
                    onPress={() =>
                      replaceCell(deepCell.id, cell => ({
                        ...cell,
                        style: { ...cell.style, radius: Math.max(0, (cell.style.radius ?? 8) - 1) },
                      }))
                    }
                  >
                    <Text style={styles.stepButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepValue}>{deepCell.style.radius ?? 8}</Text>
                  <Pressable
                    style={styles.stepButton}
                    onPress={() =>
                      replaceCell(deepCell.id, cell => ({
                        ...cell,
                        style: { ...cell.style, radius: Math.min(48, (cell.style.radius ?? 8) + 1) },
                      }))
                    }
                  >
                    <Text style={styles.stepButtonText}>＋</Text>
                  </Pressable>
                </View>

                <View style={styles.stepRow}>
                  <Text style={styles.deepLabel}>框線</Text>
                  <Pressable
                    style={styles.stepButton}
                    onPress={() =>
                      replaceCell(deepCell.id, cell => ({
                        ...cell,
                        style: { ...cell.style, borderWidth: Math.max(0, (cell.style.borderWidth ?? 0) - 1) },
                      }))
                    }
                  >
                    <Text style={styles.stepButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepValue}>{deepCell.style.borderWidth ?? 0}</Text>
                  <Pressable
                    style={styles.stepButton}
                    onPress={() =>
                      replaceCell(deepCell.id, cell => ({
                        ...cell,
                        style: { ...cell.style, borderWidth: Math.min(8, (cell.style.borderWidth ?? 0) + 1) },
                      }))
                    }
                  >
                    <Text style={styles.stepButtonText}>＋</Text>
                  </Pressable>
                </View>

                <Text style={styles.deepLabel}>字重</Text>
                <View style={styles.choiceWrap}>
                  {(['400', '600', '700', '800', '900'] as const).map(weight => (
                    <Pressable
                      key={weight}
                      onPress={() =>
                        replaceCell(deepCell.id, cell => ({
                          ...cell,
                          style: { ...cell.style, fontWeight: weight },
                        }))
                      }
                      style={[
                        styles.choice,
                        deepCell.style.fontWeight === weight && styles.choiceActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          deepCell.style.fontWeight === weight && styles.choiceTextActive,
                        ]}
                      >
                        {weight}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.deepLabel}>顯示狀態</Text>
                <View style={styles.choiceWrap}>
                  <Pressable
                    onPress={() =>
                      replaceCell(deepCell.id, cell => ({
                        ...cell,
                        style: { ...cell.style, visible: true },
                      }))
                    }
                    style={[
                      styles.choice,
                      deepCell.style.visible !== false && styles.choiceActive,
                    ]}
                  >
                    <Text style={[styles.choiceText, deepCell.style.visible !== false && styles.choiceTextActive]}>顯示</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      replaceCell(deepCell.id, cell => ({
                        ...cell,
                        style: { ...cell.style, visible: false },
                      }))
                    }
                    style={[
                      styles.choice,
                      deepCell.style.visible === false && styles.choiceActive,
                    ]}
                  >
                    <Text style={[styles.choiceText, deepCell.style.visible === false && styles.choiceTextActive]}>隱藏</Text>
                  </Pressable>
                </View>

                <Text style={styles.deepLabel}>特效</Text>
                <View style={styles.choiceWrap}>
                  {([
                    ['none', '無'],
                    ['breathe', '呼吸'],
                    ['blink', '閃爍'],
                    ['jump', '跳動'],
                    ['fade', '淡入淡出'],
                    ['pulse', '脈衝'],
                  ] as const).map(([effect, label]) => (
                    <Pressable
                      key={effect}
                      onPress={() =>
                        replaceCell(deepCell.id, cell => ({
                          ...cell,
                          style: { ...cell.style, effect },
                        }))
                      }
                      style={[
                        styles.choice,
                        (deepCell.style.effect ?? 'none') === effect && styles.choiceActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          (deepCell.style.effect ?? 'none') === effect && styles.choiceTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.deepLabel}>外距</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={String(deepCell.style.margin ?? 0)}
                  onChangeText={value =>
                    replaceCell(deepCell.id, cell => ({
                      ...cell,
                      style: {
                        ...cell.style,
                        margin: Math.max(0, Math.min(32, Number(value) || 0)),
                      },
                    }))
                  }
                  style={styles.deepInput}
                />

                <Text style={styles.deepLabel}>字距</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  value={String(deepCell.style.letterSpacing ?? 0)}
                  onChangeText={value =>
                    replaceCell(deepCell.id, cell => ({
                      ...cell,
                      style: {
                        ...cell.style,
                        letterSpacing: Math.max(-2, Math.min(12, Number(value) || 0)),
                      },
                    }))
                  }
                  style={styles.deepInput}
                />

                <Text style={styles.deepLabel}>行高</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={String(deepCell.style.lineHeight ?? 16)}
                  onChangeText={value =>
                    replaceCell(deepCell.id, cell => ({
                      ...cell,
                      style: {
                        ...cell.style,
                        lineHeight: Math.max(8, Math.min(64, Number(value) || 16)),
                      },
                    }))
                  }
                  style={styles.deepInput}
                />

                <Text style={styles.deepLabel}>陰影透明度</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  value={String(deepCell.style.shadowOpacity ?? 0)}
                  onChangeText={value =>
                    replaceCell(deepCell.id, cell => ({
                      ...cell,
                      style: {
                        ...cell.style,
                        shadowOpacity: Math.max(0, Math.min(1, Number(value) || 0)),
                      },
                    }))
                  }
                  style={styles.deepInput}
                />

                <Text style={styles.deepLabel}>陰影模糊</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={String(deepCell.style.shadowRadius ?? 0)}
                  onChangeText={value =>
                    replaceCell(deepCell.id, cell => ({
                      ...cell,
                      style: {
                        ...cell.style,
                        shadowRadius: Math.max(0, Math.min(40, Number(value) || 0)),
                      },
                    }))
                  }
                  style={styles.deepInput}
                />

                <Text style={styles.deepLabel}>Android Elevation</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={String(deepCell.style.elevation ?? 0)}
                  onChangeText={value =>
                    replaceCell(deepCell.id, cell => ({
                      ...cell,
                      style: {
                        ...cell.style,
                        elevation: Math.max(0, Math.min(24, Number(value) || 0)),
                      },
                    }))
                  }
                  style={styles.deepInput}
                />

                {renderColorPalette('文字顏色', 'textColor')}
                {renderColorPalette('文字背景顏色', 'textBackgroundColor')}
                {renderColorPalette('方塊背景顏色', 'backgroundColor')}
                {renderColorPalette('邊框顏色', 'borderColor')}

                <Text style={styles.deepLabel}>動態顏色來源</Text>
                <View style={styles.choiceWrap}>
                  {([
                    ['fixed', '固定色'],
                    ['theme', '主題色'],
                    ['pnl', '損益色'],
                    ['market', '行情狀態色'],
                  ] as const).map(([rule, label]) => (
                    <Pressable
                      key={rule}
                      onPress={() =>
                        replaceCell(deepCell.id, cell => ({
                          ...cell,
                          style: {
                            ...cell.style,
                            textColorRule: rule,
                            textBackgroundColorRule: rule,
                          },
                          content:
                            cell.content.kind === 'data'
                              ? { ...cell.content, colorRule: rule }
                              : cell.content,
                        }))
                      }
                      style={[
                        styles.choice,
                        (deepCell.content.kind === 'data'
                          ? deepCell.content.colorRule ?? deepCell.style.textColorRule ?? 'fixed'
                          : deepCell.style.textColorRule ?? 'fixed') === rule && styles.choiceActive,
                      ]}
                    >
                      <Text style={styles.choiceText}>{label}</Text>
                    </Pressable>
                  ))}
                </View>

                {deepCell.content.kind === 'text' ? (
                  <>
                    <Text style={styles.deepLabel}>文字內容</Text>
                    <TextInput
                      value={deepCell.content.text}
                      onChangeText={text =>
                        replaceCell(deepCell.id, cell => ({
                          ...cell,
                          content: { kind: 'text', text },
                        }))
                      }
                      style={styles.deepInput}
                    />
                  </>
                ) : null}

                {deepCell.content.kind === 'data' ? (
                  <>
                    <Text style={styles.deepLabel}>標題文字</Text>
                    <TextInput
                      value={deepCell.content.label ?? ''}
                      onChangeText={label =>
                        replaceCell(deepCell.id, cell => ({
                          ...cell,
                          content:
                            cell.content.kind === 'data'
                              ? { ...cell.content, label }
                              : cell.content,
                        }))
                      }
                      style={styles.deepInput}
                    />

                    <View style={styles.techHidden}>
                      <Text style={styles.techHiddenText}>資料來源與技術識別碼已隱藏，避免內部 key 干擾版面編輯。</Text>
                    </View>

                    <Text style={styles.deepLabel}>資料格式</Text>
                    <View style={styles.choiceWrap}>
                      {([
                        ['text', '文字'],
                        ['number', '數字'],
                        ['currency', '金額'],
                        ['percent', '百分比'],
                      ] as const).map(([format, label]) => (
                        <Pressable
                          key={format}
                          onPress={() =>
                            replaceCell(deepCell.id, cell => ({
                              ...cell,
                              content:
                                cell.content.kind === 'data'
                                  ? { ...cell.content, format }
                                  : cell.content,
                            }))
                          }
                          style={[
                            styles.choice,
                            (deepCell.content.kind === 'data' ? deepCell.content.format ?? 'text' : 'text') === format && styles.choiceActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.choiceText,
                              (deepCell.content.kind === 'data' ? deepCell.content.format ?? 'text' : 'text') === format && styles.choiceTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={styles.deepLabel}>顏色規則</Text>
                    <View style={styles.choiceWrap}>
                      {([
                        ['auto', '自動'],
                        ['fixed', '固定'],
                        ['pnl', '損益正負'],
                        ['market', '市場狀態'],
                      ] as const).map(([colorRule, label]) => (
                        <Pressable
                          key={colorRule}
                          onPress={() =>
                            replaceCell(deepCell.id, cell => ({
                              ...cell,
                              content:
                                cell.content.kind === 'data'
                                  ? { ...cell.content, colorRule }
                                  : cell.content,
                            }))
                          }
                          style={[
                            styles.choice,
                            (deepCell.content.kind === 'data' ? deepCell.content.colorRule ?? 'auto' : 'auto') === colorRule && styles.choiceActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.choiceText,
                              (deepCell.content.kind === 'data' ? deepCell.content.colorRule ?? 'auto' : 'auto') === colorRule && styles.choiceTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}

                <View style={styles.deepPreviewBox}>
                  <Text style={styles.previewTitle}>此方塊預覽</Text>
                  <Text style={styles.deepPreviewText}>{cellPreviewText(deepCell)}</Text>
                </View>
              </ScrollView>
            ) : null}

            <Pressable
              onPress={() => setDeepDialog(false)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryText}>完成</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerText: { flex: 1 },
  eyebrow: { color: '#0066FF', fontSize: 11, fontWeight: '900' },
  title: {
    marginTop: 4,
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: { marginTop: 4, color: '#64748B', fontSize: 11 },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#0F172A', fontSize: 24 },
  toolbar: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toolButton: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolButtonActive: { backgroundColor: '#0066FF' },
  addBlockButton: { backgroundColor: '#0066FF' },
  addBlockText: { color: '#FFFFFF' },
  toolText: { color: '#0066FF', fontSize: 11, fontWeight: '800' },
  toolTextActive: { color: '#FFFFFF' },
  disabled: { opacity: 0.35 },
  previewPanel: {
    marginHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  previewHeader: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewTitle: { color: '#0F172A', fontSize: 12, fontWeight: '900' },
  previewHint: { color: '#64748B', fontSize: 9 },
  previewGrid: { backgroundColor: '#F8FAFC' },
  editGrid: { backgroundColor: '#FFFFFF' },
  lockedGrid: {
    position: 'relative',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  gestureHint: {
    marginTop: 10,
    paddingHorizontal: 18,
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  canvas: { flex: 1 },
  canvasContent: { padding: 18 },
  cell: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 7,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewCell: { padding: 4 },
  previewCellText: {
    color: '#334155',
    fontSize: 8,
    fontWeight: '800',
    textAlign: 'center',
  },
  cellActive: {
    borderWidth: 2,
    borderColor: '#0066FF',
    backgroundColor: '#EFF6FF',
  },
  cellType: { color: '#0F172A', fontSize: 10, fontWeight: '800' },
  cellMeta: { marginTop: 3, color: '#94A3B8', fontSize: 8 },
  cellPreview: {
    marginTop: 5,
    color: '#0066FF',
    fontSize: 9,
    fontWeight: '800',
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryText: { color: '#334155', fontSize: 11, fontWeight: '800' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'center',
    padding: 22,
  },
  dialog: {
    maxHeight: '78%',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 18,
  },
  dialogTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  dialogHint: { marginTop: 5, color: '#64748B', fontSize: 11 },
  inputRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    color: '#0F172A',
    fontSize: 18,
    textAlign: 'center',
  },
  times: { color: '#64748B', fontSize: 18, fontWeight: '800' },
  dialogActions: { marginTop: 18, flexDirection: 'row', gap: 10 },
  typeRow: {
    minHeight: 58,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  typeTitle: { color: '#0F172A', fontSize: 13, fontWeight: '900' },
  typeDescription: { marginTop: 3, color: '#64748B', fontSize: 10 },
  deepSheet: {
    maxHeight: '88%',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 18,
  },
  deepBody: { paddingVertical: 16, gap: 12 },
  deepLabel: { color: '#334155', fontSize: 11, fontWeight: '900' },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceActive: { borderColor: '#0066FF', backgroundColor: '#EFF6FF' },
  choiceText: { color: '#64748B', fontSize: 10, fontWeight: '800' },
  choiceTextActive: { color: '#0066FF' },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: { color: '#0066FF', fontSize: 18, fontWeight: '900' },
  stepValue: {
    minWidth: 36,
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  deepInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  deepPreviewBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 14,
  },
  deepPreviewText: {
    marginTop: 8,
    color: '#0066FF',
    fontSize: 14,
    fontWeight: '900',
  },
  lockButton: { backgroundColor: '#0F172A' },
  lockButtonText: { color: '#FFFFFF' },
  cellLocked: { opacity: 0.72 },
  previewScaleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  scaleButton: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleButtonActive: { backgroundColor: '#0066FF', borderColor: '#0066FF' },
  scaleText: { color: '#64748B', fontSize: 9, fontWeight: '800' },
  scaleTextActive: { color: '#FFFFFF' },
  sectionTitle: {
    marginTop: 4,
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '900',
  },
  sizeRow: { flexDirection: 'row', gap: 10 },
  sizeField: { flex: 1 },
  nudgePad: { alignItems: 'center', gap: 6 },
  nudgeMiddle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nudgeButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeText: { color: '#0066FF', fontSize: 21, fontWeight: '900' },
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  colorSwatchActive: { borderWidth: 3, borderColor: '#0066FF' },
  techHidden: {
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    padding: 10,
  },
  techHiddenText: { color: '#64748B', fontSize: 10, fontWeight: '700' },
});
