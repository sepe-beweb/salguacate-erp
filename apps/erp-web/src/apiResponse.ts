export async function readJson<T = unknown>(response: Response): Promise<T> {
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new Error('Respuesta inválida del servidor. Inténtalo de nuevo.'); }
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'No se pudo completar la operación.';
    throw new Error(message);
  }
  return data as T;
}

export async function readList<T>(response: Response): Promise<T[]> {
  const data = await readJson<unknown>(response);
  if (!Array.isArray(data)) throw new Error('El servidor no devolvió una lista válida.');
  return data as T[];
}

export const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : 'Error de conexión. Inténtalo de nuevo.';
