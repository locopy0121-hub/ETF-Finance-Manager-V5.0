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
if (!settings.includes('<Frame360EditorModal')) {
  fail('360 editor is not mounted in SettingsScreen');
}
if (settings.includes('<PageFrameEditorModal')) {
  fail('old page frame editor is still mounted');
}
if (!settings.includes('frame360Templates')) {
  fail('SettingsScreen does not persist frame360Templates');
}

const portfolio = fs.readFileSync('src/v3/screens/PortfolioScreen.tsx', 'utf8');
if (!portfolio.includes('<Frame360Runtime')) {
  fail('PortfolioScreen does not consume the 360 runtime');
}
if (!portfolio.includes("['portfolio:portfolio-list']")) {
  fail('PortfolioScreen does not use the shared holding template key');
}

const editor = fs.readFileSync(
  'src/v3/components/Frame360EditorModal.tsx',
  'utf8',
);
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

const registry = fs.readFileSync('src/v3/frame360Registry.ts', 'utf8');
for (const label of ['提醒格', '組件格', '月曆', '跑馬燈']) {
  if (!registry.includes(label)) fail(`missing Chinese registry label: ${label}`);
}

console.log('V500_360_CORE_AUDIT: PASS');
