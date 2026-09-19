import type {
  Frame360Instance,
  Frame360Template,
} from './frame360';

export type Frame360TemplateStoreState = {
  templates: Record<string, Frame360Template>;
  instances: Record<string, Frame360Instance>;
};

export const createFrame360Store = (): Frame360TemplateStoreState => ({
  templates: {},
  instances: {},
});

export function saveFrame360Template(
  state: Frame360TemplateStoreState,
  template: Frame360Template,
): Frame360TemplateStoreState {
  return {
    ...state,
    templates: {
      ...state.templates,
      [template.id]: template,
    },
  };
}

export function registerFrame360Instance(
  state: Frame360TemplateStoreState,
  instance: Frame360Instance,
): Frame360TemplateStoreState {
  return {
    ...state,
    instances: {
      ...state.instances,
      [instance.id]: instance,
    },
  };
}

export function resolveFrame360TemplateForInstance(
  state: Frame360TemplateStoreState,
  instanceId: string,
): Frame360Template {
  const instance = state.instances[instanceId];
  if (!instance) throw new Error(`找不到框架實例：${instanceId}`);
  const template = state.templates[instance.templateId];
  if (!template) throw new Error(`找不到框架模板：${instance.templateId}`);
  return template;
}

export function listFrame360InstancesByTemplate(
  state: Frame360TemplateStoreState,
  templateId: string,
): Frame360Instance[] {
  return Object.values(state.instances).filter(
    instance => instance.templateId === templateId,
  );
}

export function applyFrame360TemplateEdit(
  state: Frame360TemplateStoreState,
  editedFromInstanceId: string,
  nextTemplate: Frame360Template,
): Frame360TemplateStoreState {
  const source = state.instances[editedFromInstanceId];
  if (!source) throw new Error(`找不到編輯來源實例：${editedFromInstanceId}`);
  if (source.templateId !== nextTemplate.id) {
    throw new Error('不可將其他模板寫入目前框架實例');
  }

  return saveFrame360Template(state, nextTemplate);
}
