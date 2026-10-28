import { FormlyFieldConfig } from '@ngx-formly/core';

export function gcTextField(key: string, label: string, required = false): FormlyFieldConfig {
  return { key, type: 'input', props: { label, required } };
}

export function gcSelectField(
  key: string,
  label: string,
  options: ReadonlyArray<{ label: string; value: string }>,
  required = false,
): FormlyFieldConfig {
  return { key, type: 'select', props: { label, required, options: [...options] } };
}
