import { describe, expect, it } from 'vitest';
import {
  createFrame360Template,
  instantiateFrame360Template,
  updateFrame360Template,
} from '../../src/v3/frame360';
import {
  applyFrame360TemplateEdit,
  createFrame360Store,
  registerFrame360Instance,
  resolveFrame360TemplateForInstance,
  saveFrame360Template,
} from '../../src/v3/frame360Store';

describe('360 shared template synchronization', () => {
  it('updates one holding template and all holding instances resolve the new layout', () => {
    const template = createFrame360Template({
      id: 'portfolio-holding',
      surface: 'portfolio',
      templateKey: 'holding-card',
      name: '持股框架',
      rows: 2,
      columns: 5,
      updatedAt: 1,
    });

    let state = saveFrame360Template(createFrame360Store(), template);
    state = registerFrame360Instance(
      state,
      instantiateFrame360Template(template, 'holding-0050', '0050'),
    );
    state = registerFrame360Instance(
      state,
      instantiateFrame360Template(template, 'holding-00878', '00878'),
    );

    const edited = updateFrame360Template(template, {
      grid: { ...template.grid, rows: 3 },
    });
    state = applyFrame360TemplateEdit(state, 'holding-0050', edited);

    expect(resolveFrame360TemplateForInstance(state, 'holding-0050').version).toBe(2);
    expect(resolveFrame360TemplateForInstance(state, 'holding-00878').version).toBe(2);
    expect(state.instances['holding-0050'].dataKey).toBe('0050');
    expect(state.instances['holding-00878'].dataKey).toBe('00878');
  });
});
