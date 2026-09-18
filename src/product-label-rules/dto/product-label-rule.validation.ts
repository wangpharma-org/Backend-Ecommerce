export const normalizeRequiredString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
