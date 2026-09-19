const fs = require('fs');

const required = [
  'src/v3/frame360.ts',
  'src/v3/frame360Registry.ts',
  'src/v3/frame360Reminder.ts',
  'src/v3/frame360Components.ts',
  'src/v3/frame360Store.ts',
  'src/v3/frame360Defaults.ts',
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
  'pageCustomize',
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
  'handleCellLongPress',
  'setDeepDialog(true)',
  '即時預覽框',
  '<Frame360Runtime',
  '公式 / 運算式',
  '顏色規則',
  '顯示狀態',
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

const pageRuntime = fs.readFileSync('src/v3/pageRuntime.tsx', 'utf8');
for (const token of [
  'describeVisibleNodes',
  'applyGlobal360NodeStyles',
  'global360.openFrame',
  'accessibilityHint="長按進入此區塊的 360 編輯器"',
]) {
  if (!pageRuntime.includes(token)) {
    fail(`PageFrame is not globally editable: ${token}`);
  }
}

const runtime = fs.readFileSync(
  'src/v3/components/Frame360Runtime.tsx',
  'utf8',
);
for (const token of [
  'evaluateFormula',
  'formatDataValue',
  'resolveDataColor',
  'cell.style.visible === false',
]) {
  if (!runtime.includes(token)) {
    fail(`360 runtime missing deep feature: ${token}`);
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
for (const label of ['提醒格', '組件格', '月曆', '跑馬燈']) {
  if (!registry.includes(label)) fail(`missing Chinese registry label: ${label}`);
}

console.log('V500_360_CORE_AUDIT: PASS');
