export const emptyProduct = (local = 'Principal') => ({ producto: '', stock_actual: '0', stock_minimo: '5', categoria: 'Bebida', proveedor_id: '', local });
export const emptyProvider = () => ({ nombre: '', telefono: '', email: '', categoria: 'General' });
export function readProductForm(form: ReturnType<typeof emptyProduct>) {
  const quantity = (value: string) => /^\d+$/.test(value) && value.trim() === value && Number.isSafeInteger(Number(value)) && Number(value) <= 1000000;
  if (!form.producto.trim() || form.producto.length > 160 || !quantity(form.stock_actual) || !quantity(form.stock_minimo) ||
    !['Bebida', 'Comida'].includes(form.categoria) || !['Principal', 'Segundo Local'].includes(form.local) ||
    (form.proveedor_id !== '' && (form.proveedor_id.trim() !== form.proveedor_id || !/^\d+$/.test(form.proveedor_id) || !Number.isSafeInteger(Number(form.proveedor_id)) || Number(form.proveedor_id) < 1))) throw new Error('Revisa nombre, local, categoría y cantidades enteras entre 0 y 1000000.');
  return { ...form, producto: form.producto.trim(), stock_actual: Number(form.stock_actual), stock_minimo: Number(form.stock_minimo), proveedor_id: form.proveedor_id === '' ? null : Number(form.proveedor_id) };
}
export function readProviderForm(form: ReturnType<typeof emptyProvider>) {
  if (!form.nombre.trim() || form.nombre.length > 160 || form.telefono.length > 40 || form.email.length > 254 || !form.categoria.trim() || form.categoria.length > 80) throw new Error('Revisa nombre y categoría; máximo 160 caracteres de nombre, 40 de teléfono y 254 de email.');
  return { ...form, nombre: form.nombre.trim() };
}
