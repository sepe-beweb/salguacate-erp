export default function RequestError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
      <p>{message}</p>
      {onRetry && <button type="button" onClick={onRetry} className="mt-2 font-semibold underline">Reintentar carga</button>}
    </div>
  );
}
