const fs = require('fs');

const required = [
  'src/v3/frame360.ts',
  'src/v3/frame360Registry.ts',
  'src/v3/frame360Reminder.ts',
  'src/v3/frame360Components.ts',
  'src/v3/frame360Store.ts',
  'src/v3/frame360Defaults.ts',
  'src/v3/frame360Color.ts',
  'src/v3/components/Frame360EditorModal.tsx',
  'src/v3/components/Frame360Runtime.tsx',
  'src/v3/components/Global360Context.tsx',
  'src/v3/pageRuntime.tsx',
];

const fail = message => {
  console.error('V500_360_CORE_AUDIT: FAIL');
  console.error(message);
  process.exit(1);
};

for (const file of required) {
  if (!fs.existsSync(file)) fail(`missing ${file}`);
}

const subsystem = required
  .map(file => fs.readFileSync(file, 'utf8'))
  .join('\n');

const bannedLegacy = [
  'UniversalEditor',
  'editorSchema',
  'legacy',
  'Legacy',
];
for (const token of bannedLegacy) {
  if (subsystem.includes(token)) {
    fail(`360 subsystem contains forbidden legacy dependency token: ${token}`);
  }
}

const settings = fs.readFileSync('src/v3/screens/SettingsScreen.tsx', 'utf8');
if (settings.includes('<PageFrameEditorModal')) {
  fail('old page frame editor is still mounted');
}
if (settings.includes('全局版面修改編輯')) {
  fail('legacy global layout editor entry is still visible');
}
if (settings.includes('Page Layout / 卡片順序')) {
  fail('legacy page layout editor controls are still visible');
}

const portfolio = fs.readFileSync('src/v3/screens/PortfolioScreen.tsx', 'utf8');
if (!portfolio.includes('<Frame360Runtime')) {
  fail('PortfolioScreen does not consume the 360 runtime');
}
if (!portfolio.includes("['portfolio:portfolio-list']")) {
  fail('PortfolioScreen does not use the shared holding template key');
}
if (!portfolio.includes('<Frame360EditorModal')) {
  fail('PortfolioScreen does not mount the V5 360 editor');
}
if (!portfolio.includes('setEditingHoldingFrame(true)')) {
  fail('holding long-press does not enter the V5 360 editor');
}
if (!portfolio.includes('onPreferencesChange?.({')) {
  fail('PortfolioScreen does not persist frame360Templates');
}

const editor = fs.readFileSync(
  'src/v3/components/Frame360EditorModal.tsx',
  'utf8',
);
for (const token of [
  "position: 'absolute'",
  'handleBlockLongPress',
  'setDeepDialog(true)',
  '即時預覽框',
  '<Frame360Runtime',
  'renderSourcePicker',
  'dataSourceLabel',
  '數據來源',
  '原生資料來源已保護；解鎖後才可重新指向。',
  'locked: true',
  '<Text style={styles.primaryText}>完成</Text>',
  'setEditorLocked(value => !value)',
  '位置微調',
  '自由圖層 ON',
  '文字背景顏色',
  "renderInlineColorRule('textColorRule')",
  "renderInlineColorRule('textBackgroundColorRule')",
  "renderInlineColorRule('backgroundColorRule')",
  '顯示狀態',
  'Android Elevation',
  '特效',
]) {
  if (!editor.includes(token)) {
    fail(`360 editor missing V5 interaction contract: ${token}`);
  }
}

const bannedVisibleEnglish = [
  'PAGE FRAME',
  'Surface Registry',
  'Editing Session',
  'Draft Sandbox',
  'Validation',
  'Atomic Commit',
  'Runtime Sync',
];
if (editor.includes("<Text style={styles.sourceValue}>{binding")) {
  fail('360 editor exposes raw internal data binding key');
}

for (const token of bannedVisibleEnglish) {
  if (editor.includes(token)) {
    fail(`360 editor visible English residue: ${token}`);
  }
}


const globalContext = fs.readFileSync(
  'src/v3/components/Global360Context.tsx',
  'utf8',
);
for (const token of [
  'Global360Provider',
  'Global360NodeDescriptor',
  'resolveTemplate',
  'frame360Templates',
  'targetNodeId',
]) {
  if (!globalContext.includes(token)) {
    fail(`Global 360 context missing contract: ${token}`);
  }
}

for (const token of ['文字格', '圖片格', '圖示格', '圖表格', '提醒格', '組件格', '容器格', '空白格', '資料格內', '資料格：', '資料格，', '資料格。']) {
  if (editor.includes(token)) {
    fail(`360 editor still exposes deprecated Cell terminology: ${token}`);
  }
}
if (editor.includes('顏色規則（互相獨立）')) {
  fail('360 editor still exposes the deprecated separate color-rule panel');
}

const settingsMaster = fs.readFileSync('src/v3/screens/SettingsScreen.tsx', 'utf8');
if (!settingsMaster.includes('onValueChange={globalEditMode => onChange({ globalEditMode })}')) {
  fail('Settings no longer owns the single 360 master switch');
}
if (!settingsMaster.includes('設定頁本身永久不進入 360 編輯')) {
  fail('Settings hard exclusion contract is missing');
}

const pageRuntime = fs.readFileSync('src/v3/pageRuntime.tsx', 'utf8');
for (const token of [
  'describeVisibleNodes',
  'applyGlobal360NodeStyles',
  'global360.openFrame',
  'frame:root',
  'accessibilityHint="長按進入此區塊的 360 編輯器"',
]) {
  if (!pageRuntime.includes(token)) {
    fail(`PageFrame is not globally editable: ${token}`);
  }
}

if (pageRuntime.includes('設定模式 ON') || pageRuntime.includes('設定模式 OFF')) {
  fail('legacy per-page 360 setting-mode controls are still visible');
}
if (globalContext.includes('pageCustomize') || globalContext.includes('togglePageEdit')) {
  fail('legacy per-page 360 gate is still wired');
}

const runtime = fs.readFileSync(
  'src/v3/components/Frame360Runtime.tsx',
  'utf8',
);
for (const token of [
  'evaluateFormula',
  'formatDataValue',
  'resolveFrame360RuleColor',
  'cell.style.visible === false',
  'RuntimeCellSurface',
]) {
  if (!runtime.includes(token)) {
    fail(`360 runtime missing deep feature: ${token}`);
  }
}

const colorResolver = fs.readFileSync('src/v3/frame360Color.ts', 'utf8');
for (const token of [
  'resolveFrame360RuleColor',
  "typeof value !== 'number'",
  "surface === 'background' ? hex + '22' : hex",
]) {
  if (!colorResolver.includes(token)) {
    fail(`360 color resolver missing raw numeric contract: ${token}`);
  }
}

const headers = [
  ['src/v3/screens/DashboardScreen.tsx', 'dashboard-header'],
  ['src/v3/screens/PortfolioScreen.tsx', 'portfolio-header'],
  ['src/v3/screens/DividendScreen.tsx', 'dividend-header'],
  ['src/v3/screens/LedgerScreen.tsx', 'ledger-header'],
  ['src/v3/screens/MarketScreen.tsx', 'market-header'],
  ['src/v3/screens/AIScreen.tsx', 'ai-header'],
  ['src/v3/screens/HoldingDetailScreen.tsx', 'detail-header'],
  ['src/v3/screens/SettingsScreen.tsx', 'settings-header'],
  ['src/v3/screensBase.tsx', 'calculator-header'],
];
for (const [file, marker] of headers) {
  if (!fs.readFileSync(file, 'utf8').includes(marker)) {
    fail(`Global 360 header coverage missing: ${marker}`);
  }
}

const registry = fs.readFileSync('src/v3/frame360Registry.ts', 'utf8');
for (const label of ['提醒方塊', '組件方塊', '資料方塊', '月曆', '跑馬燈']) {
  if (!registry.includes(label)) fail(`missing Chinese registry label: ${label}`);
}

console.log('V500_360_CORE_AUDIT: PASS');
