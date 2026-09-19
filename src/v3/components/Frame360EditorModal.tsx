import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createFrame360Grid,
  mergeFrame360Cells,
  splitFrame360Cell,
  type Frame360Alignment,
  type Frame360CellKind,
  type Frame360DataCell,
  type Frame360Template,
} from '../frame360';
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

  useEffect(() => {
    if (!visible || !template) return;
    setDraft(cloneTemplate(template));
    setSelected([]);
    setDeepCellId(null);
    setDeepDialog(false);
    setMultiSelectMode(false);
    setRowsText(String(template.grid.rows));
    setColumnsText(String(template.grid.columns));
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
        '組件會成為此資料格內的獨立子根。',
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
        '合併資料格',
        '選取的資料格已有多筆內容，請選擇如何處理。系統不會自動刪除資料。',
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

  const createGrid = () => {
    const rows = Number(rowsText);
    const columns = Number(columnsText);
    try {
      const grid = createFrame360Grid(rows, columns);
      setDraft(current => (current ? { ...current, grid } : current));
      setSelected([]);
      setGridDialog(false);
    } catch (error) {
      Alert.alert(
        '無法建立格線',
        error instanceof Error ? error.message : '請檢查列數與欄數',
      );
    }
  };

  const handleCellPress = (cell: Frame360DataCell) => {
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
    setSelected([cell.id]);
    setMultiSelectMode(false);
    setDeepCellId(cell.id);
    setDeepDialog(true);
  };

  const cellPreviewText = (cell: Frame360DataCell) => {
    if (cell.content.kind === 'text') return cell.content.text;
    if (cell.content.kind === 'data') return cell.content.label ?? cell.content.binding;
    if (cell.content.kind === 'icon') return cell.content.icon;
    if (cell.content.kind === 'chart') return cell.content.binding;
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
        {draft.grid.dataCells.map(cell => {
          const active = !preview && selected.includes(cell.id);
          return (
            <Pressable
              key={cell.id}
              disabled={preview}
              onPress={() => handleCellPress(cell)}
              onLongPress={() => handleCellLongPress(cell)}
              delayLongPress={380}
              style={[
                styles.cell,
                {
                  position: 'absolute',
                  left: (cell.columnStart - 1) * unitW,
                  top: (cell.rowStart - 1) * unitH,
                  width: cell.columnSpan * unitW,
                  height: cell.rowSpan * unitH,
                },
                preview && styles.previewCell,
                active && styles.cellActive,
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
                    {cell.rowStart}-{cell.columnStart}
                    {cell.rowSpan > 1 || cell.columnSpan > 1
                      ? ` · ${cell.columnSpan}×${cell.rowSpan}`
                      : ''}
                  </Text>
                  {cell.content.kind !== 'empty' ? (
                    <Text numberOfLines={1} style={styles.cellPreview}>
                      {cellPreviewText(cell)}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </Pressable>
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
                {draft.grid.columns} 欄 × {draft.grid.rows} 列 · 已選 {selected.length} 格
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.toolbar}>
            <Pressable onPress={() => setGridDialog(true)} style={styles.toolButton}>
              <Text style={styles.toolText}>新增格線</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMultiSelectMode(value => !value);
                setSelected([]);
              }}
              style={[styles.toolButton, multiSelectMode && styles.toolButtonActive]}
            >
              <Text style={[styles.toolText, multiSelectMode && styles.toolTextActive]}>
                {multiSelectMode ? '結束多選' : '多選合併'}
              </Text>
            </Pressable>
            <Pressable
              disabled={selected.length < 2}
              onPress={mergeSelected}
              style={[styles.toolButton, selected.length < 2 && styles.disabled]}
            >
              <Text style={styles.toolText}>合併</Text>
            </Pressable>
            <Pressable
              disabled={selected.length !== 1}
              onPress={splitSelected}
              style={[styles.toolButton, selected.length !== 1 && styles.disabled]}
            >
              <Text style={styles.toolText}>拆分</Text>
            </Pressable>
          </View>

          <View style={styles.previewPanel}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>即時預覽框</Text>
              <Text style={styles.previewHint}>與正式格線共用同一份 Draft</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {renderLockedGrid(true)}
            </ScrollView>
          </View>

          <Text style={styles.gestureHint}>
            單點：選擇資料格類型　·　長按：進入 360 深度功能
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
                  version: draft.version + 1,
                  updatedAt: Date.now(),
                })
              }
              style={styles.primaryButton}
            >
              <Text style={styles.primaryText}>儲存框架</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={gridDialog} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={[styles.dialog, { paddingBottom: Math.max(18, insets.bottom + 12) }]}>
            <Text style={styles.dialogTitle}>新增儲存格格線</Text>
            <Text style={styles.dialogHint}>輸入欄 × 列，例如 8 × 4。</Text>
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
              <Pressable onPress={createGrid} style={styles.primaryButton}>
                <Text style={styles.primaryText}>確定建立</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={typeDialog} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={[styles.dialog, { paddingBottom: Math.max(18, insets.bottom + 12) }]}>
            <Text style={styles.dialogTitle}>選擇資料格類型</Text>
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
                ? `${deepCell.rowStart}-${deepCell.columnStart} · ${frame360CellTypeLabel(
                    deepCell.content.kind,
                  )}`
                : ''}
            </Text>

            {deepCell ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.deepBody}
              >
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
                    <Text style={styles.deepLabel}>資料綁定</Text>
                    <TextInput
                      value={deepCell.content.binding}
                      onChangeText={binding =>
                        replaceCell(deepCell.id, cell => ({
                          ...cell,
                          content: {
                            kind: 'data',
                            binding,
                            label:
                              cell.content.kind === 'data'
                                ? cell.content.label
                                : undefined,
                          },
                        }))
                      }
                      style={styles.deepInput}
                    />
                  </>
                ) : null}

                <View style={styles.deepPreviewBox}>
                  <Text style={styles.previewTitle}>此格預覽</Text>
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
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#CBD5E1',
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
});
