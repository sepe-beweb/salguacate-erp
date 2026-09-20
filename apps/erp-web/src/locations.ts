// Stored values are stable identifiers shared with the API and existing history.
export const LOCATIONS = [
  { value: 'Principal', label: 'Aguacate' },
  { value: 'Segundo Local', label: 'Salmón' },
] as const;

export function locationLabel(value: string | null | undefined, fallback = 'Local no indicado'): string {
  return LOCATIONS.find(location => location.value === value)?.label ?? (value || fallback);
}

export function matchesLocation(value: string | null, selected: string, shared = false) {
  return selected === 'Todos' || value === selected || (shared && (!value || value === 'Ambos' || value === 'Todos'));
}
