import { LOCATIONS } from '../locations';

export default function LocalFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div role="group" aria-label="Local de trabajo" className="flex flex-wrap gap-2">
    {[{ value: 'Todos', label: 'Todos' }, ...LOCATIONS].map(location =>
      <button key={location.value} type="button" aria-pressed={value === location.value} onClick={() => onChange(location.value)}
        className={`rounded-xl px-4 py-2.5 text-sm font-semibold border ${value === location.value ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}>
        {location.label}
      </button>)}
  </div>;
}
