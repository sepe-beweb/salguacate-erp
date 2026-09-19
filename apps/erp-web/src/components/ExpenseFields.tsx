import type { ExpenseDraft } from '../expenses';

const inputClass = 'w-full p-2 border rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white';

export default function ExpenseFields({ value, onChange, disabled, amountLabel = 'Importe (€)', conceptRequired = false }: {
  value: ExpenseDraft; onChange: (value: ExpenseDraft) => void; disabled: boolean; amountLabel?: string; conceptRequired?: boolean;
}) {
  return <fieldset disabled={disabled} className="space-y-3">
    <label className="block">{amountLabel}<input type="number" required min="0" max="1000000" step="0.01" value={value.total} onChange={e => onChange({ ...value, total: e.target.value })} className={inputClass} /></label>
    <label className="block">Proveedor<input type="text" required maxLength={160} value={value.proveedor_nombre} onChange={e => onChange({ ...value, proveedor_nombre: e.target.value })} className={inputClass} /></label>
    <label className="block">Fecha<input type="date" required min="0001-01-01" max="9999-12-31" value={value.fecha} onChange={e => onChange({ ...value, fecha: e.target.value })} className={inputClass} /></label>
    <label className="block">Local<select value={value.local} onChange={e => onChange({ ...value, local: e.target.value })} className={inputClass}><option>Principal</option><option>Segundo Local</option></select></label>
    <label className="block">Concepto{!conceptRequired && ' (opcional)'}<input type="text" required={conceptRequired} maxLength={1000} value={value.concepto} onChange={e => onChange({ ...value, concepto: e.target.value })} className={inputClass} /></label>
  </fieldset>;
}
