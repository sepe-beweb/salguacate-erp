import { useId } from 'react';
import type { Provider } from '../catalogData';
import { documentTypes, documentInput, type DocumentFields as Fields } from '../documentData';
import { locationLabel } from '../locations';
const suggestions = ['pendiente de pago', 'pagado', 'mantenimiento', 'suministros', 'gestoría', 'revisar'];
export default function DocumentFields({ value, onChange, providers, locals, tag, setTag, disabled = false }: { value: Fields; onChange: (value: Fields) => void; providers: Provider[]; locals: string[]; tag: string; setTag: (tag: string) => void; disabled?: boolean }) {
  const tagId = useId();
  const add = (text: string) => { const clean = text.trim().toLocaleLowerCase('es-ES'); if (clean && !value.etiquetas.includes(clean)) { if (clean.length > 40 || value.etiquetas.length >= 12) return; onChange({ ...value, etiquetas: [...value.etiquetas, clean] }); } setTag(''); };
  return <fieldset disabled={disabled} className="space-y-4 min-w-0">
    <label className="block">Título<input required maxLength={160} value={value.titulo} onChange={e => onChange({ ...value, titulo: e.target.value })} className={documentInput} /></label>
    <div className="grid sm:grid-cols-2 gap-3">
      <label>Local<select value={value.local} onChange={e => onChange({ ...value, local: e.target.value })} className={documentInput}>{locals.map(l => <option key={l} value={l}>{locationLabel(l)}</option>)}</select></label>
      <label>Fecha del documento<input type="date" required value={value.fecha} onChange={e => onChange({ ...value, fecha: e.target.value })} className={documentInput} /></label>
      <label>Tipo de documento<select value={value.tipo} onChange={e => onChange({ ...value, tipo: e.target.value as Fields['tipo'] })} className={documentInput}>{Object.entries(documentTypes).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>
      <label>Proveedor<select value={value.proveedor_id ?? ''} onChange={e => onChange({ ...value, proveedor_id: e.target.value ? Number(e.target.value) : null })} className={documentInput}><option value="">Sin proveedor</option>{providers.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
    </div>
    <div className="space-y-2"><label htmlFor={tagId} className="block">Nueva etiqueta</label><div className="flex gap-2"><input id={tagId} value={tag} maxLength={40} className={documentInput} onChange={e => setTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(tag); } }} /><button type="button" disabled={!tag.trim() || value.etiquetas.length >= 12} className="border rounded-lg px-3 disabled:opacity-50" onClick={() => add(tag)}>Añadir</button></div>
      <div className="flex flex-wrap gap-2">{value.etiquetas.map(t => <button key={t} type="button" aria-label={`Quitar etiqueta ${t}`} className="rounded-full bg-brand-100 text-brand-900 px-3 py-1 text-sm" onClick={() => onChange({ ...value, etiquetas: value.etiquetas.filter(x => x !== t) })}>{t} ×</button>)}</div>
      <div className="flex flex-wrap gap-2">{suggestions.filter(t => !value.etiquetas.includes(t)).map(t => <button type="button" key={t} disabled={value.etiquetas.length >= 12} className="text-xs underline p-1" onClick={() => { const pending = tag; add(t); setTag(pending); }}>+ {t}</button>)}</div><p className="text-xs text-slate-500">Hasta 12 etiquetas. La etiqueta escrita también se incorpora al guardar. Sirven para buscar, no cambian el estado contable.</p>
    </div>
    <label className="block">Notas<textarea maxLength={2000} rows={3} value={value.notas} onChange={e => onChange({ ...value, notas: e.target.value })} className={documentInput} /></label>
  </fieldset>;
}
