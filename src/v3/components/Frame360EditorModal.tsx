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

import {
  createFrame360Grid,
  mergeFrame360Cells,
  splitFrame360Cell,
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

const cloneTemplate = (template: Frame360Template): Frame360Template =>
  JSON.parse(JSON.stringify(template)) as Frame360Template;

export default function Frame360EditorModal({
  visible,
  template,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<Frame360Template | null>(template);
  const [selected, setSelected] = useState<string[]>([]);
  const [gridDialog, setGridDialog] = useState(false);
  const [typeDialog, setTypeDialog] = useState(false);
  const [rowsText, setRowsText] = useState('2');
  const [columnsText, setColumnsText] = useState('5');

  useEffect(() => {
    if (!visible || !template) return;
    setDraft(cloneTemplate(template));
    setSelected([]);
    setRowsText(String(template.grid.rows));
    setColumnsText(String(template.grid.columns));
  }, [visible, template?.id, template?.version]);

  const selectedCells = useMemo(
    () =>
      draft?.grid.dataCells.filter(cell => selected.includes(cell.id)) ?? [],
    [draft, selected],
  );

  const replaceCell = (cellId: string, updater: (cell: Frame360DataCell) => Frame360DataCell) => {
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
      Alert.alert('無法建立格線', error instanceof Error ? error.message : '請檢查列數與欄數');
    }
  };

  if (!draft) return null;

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.screen}>
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
              disabled={selected.length !== 1}
              onPress={() => setTypeDialog(true)}
              style={[styles.toolButton, selected.length !== 1 && styles.disabled]}
            >
              <Text style={styles.toolText}>資料格類型</Text>
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

          <ScrollView
            style={styles.canvas}
            contentContainerStyle={styles.canvasContent}
            horizontal
          >
            <View
              style={[
                styles.grid,
                {
                  width: Math.max(320, draft.grid.columns * 72),
                },
              ]}
            >
              {Array.from({ length: draft.grid.rows }, (_, rowIndex) => (
                <View key={rowIndex} style={styles.row}>
                  {Array.from({ length: draft.grid.columns }, (_, columnIndex) => {
                    const baseId = `r${rowIndex + 1}c${columnIndex + 1}`;
                    const cell = draft.grid.dataCells.find(item =>
                      item.baseCellIds.includes(baseId),
                    );
                    if (!cell) return null;
                    if (
                      cell.rowStart !== rowIndex + 1 ||
                      cell.columnStart !== columnIndex + 1
                    ) {
                      return null;
                    }
                    const active = selected.includes(cell.id);
                    return (
                      <Pressable
                        key={cell.id}
                        onPress={() =>
                          setSelected(current =>
                            current.includes(cell.id)
                              ? current.filter(id => id !== cell.id)
                              : [...current, cell.id],
                          )
                        }
                        style={[
                          styles.cell,
                          {
                            width: 72 * cell.columnSpan,
                            minHeight: 58 * cell.rowSpan,
                          },
                          active && styles.cellActive,
                        ]}
                      >
                        <Text style={styles.cellType}>
                          {frame360CellTypeLabel(cell.content.kind)}
                        </Text>
                        <Text style={styles.cellMeta}>
                          {cell.rowStart}-{cell.columnStart}
                          {cell.rowSpan > 1 || cell.columnSpan > 1
                            ? ` · ${cell.columnSpan}×${cell.rowSpan}`
                            : ''}
                        </Text>
                        {cell.content.kind === 'reminder' ? (
                          <Text style={styles.cellPreview}>{cell.content.activeLabel}</Text>
                        ) : null}
                        {cell.content.kind === 'component' ? (
                          <Text style={styles.cellPreview}>
                            {frame360ComponentLabel(
                            cell.content.kind === 'component'
                              ? cell.content.component
                              : 'summary',
                          )}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>取消</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave({ ...draft, version: draft.version + 1, updatedAt: Date.now() })}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryText}>儲存框架</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={gridDialog} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
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
          <View style={styles.dialog}>
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
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: 18 },
  header: { paddingHorizontal: 18, flexDirection: 'row', alignItems: 'flex-start' },
  headerText: { flex: 1 },
  eyebrow: { color: '#0066FF', fontSize: 11, fontWeight: '900' },
  title: { marginTop: 4, color: '#0F172A', fontSize: 22, fontWeight: '900' },
  subtitle: { marginTop: 4, color: '#64748B', fontSize: 11 },
  closeButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#0F172A', fontSize: 24 },
  toolbar: { paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toolButton: { minHeight: 40, borderRadius: 999, backgroundColor: '#EFF6FF', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  toolText: { color: '#0066FF', fontSize: 11, fontWeight: '800' },
  disabled: { opacity: 0.35 },
  canvas: { flex: 1 },
  canvasContent: { padding: 18 },
  grid: { alignSelf: 'flex-start', borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#CBD5E1' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  cell: { borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', padding: 7, justifyContent: 'center' },
  cellActive: { borderWidth: 2, borderColor: '#0066FF', backgroundColor: '#EFF6FF' },
  cellType: { color: '#0F172A', fontSize: 10, fontWeight: '800' },
  cellMeta: { marginTop: 3, color: '#94A3B8', fontSize: 8 },
  cellPreview: { marginTop: 5, color: '#0066FF', fontSize: 9, fontWeight: '800' },
  footer: { padding: 18, flexDirection: 'row', gap: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#E2E8F0' },
  primaryButton: { flex: 1, minHeight: 44, borderRadius: 999, backgroundColor: '#0066FF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  primaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  secondaryButton: { flex: 1, minHeight: 44, borderRadius: 999, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  secondaryText: { color: '#334155', fontSize: 11, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'center', padding: 22 },
  dialog: { maxHeight: '78%', borderRadius: 20, backgroundColor: '#FFFFFF', padding: 18 },
  dialogTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  dialogHint: { marginTop: 5, color: '#64748B', fontSize: 11 },
  inputRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 12, color: '#0F172A', fontSize: 18, textAlign: 'center' },
  times: { color: '#64748B', fontSize: 18, fontWeight: '800' },
  dialogActions: { marginTop: 18, flexDirection: 'row', gap: 10 },
  typeRow: { minHeight: 58, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  typeTitle: { color: '#0F172A', fontSize: 13, fontWeight: '900' },
  typeDescription: { marginTop: 3, color: '#64748B', fontSize: 10 },
});
