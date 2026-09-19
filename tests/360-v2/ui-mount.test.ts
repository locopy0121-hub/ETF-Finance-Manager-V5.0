import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('360 UI mount', () => {
  it('mounts the 360 grid editor in the settings control center', () => {
    const settings = readFileSync('src/v3/screens/SettingsScreen.tsx', 'utf8');
    expect(settings).toContain("import Frame360EditorModal");
    expect(settings).toContain("<Frame360EditorModal");
    expect(settings).toContain("open360Frame(card)");
    expect(settings).toContain("frame360Templates");
  });

  it('uses popup-driven grid and cell type editing', () => {
    const editor = readFileSync(
      'src/v3/components/Frame360EditorModal.tsx',
      'utf8',
    );
    expect(editor).toContain('新增儲存格格線');
    expect(editor).toContain('選擇資料格類型');
    expect(editor).toContain('合併資料格');
    expect(editor).toContain('選擇提醒資料');
  });
});
