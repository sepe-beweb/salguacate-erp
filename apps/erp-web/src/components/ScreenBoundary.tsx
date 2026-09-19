import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; onHome: () => void; }

// The layout stays mounted. A rejected lazy import is cached: do not promise a
// retry of the same module or automatically reload and discard in-memory state.
export default class ScreenBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  private reload = () => {
    if (window.confirm('Recargar cerrará tu sesión y descartará los borradores y PDF sin guardar. ¿Quieres continuar?')) {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section role="alert" className="rounded-xl border border-red-300 bg-red-50 p-5 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100 space-y-3">
        <h2 className="text-lg font-semibold">No se pudo mostrar esta pantalla</h2>
        <p>Ha fallado la carga o la ejecución de esta sección. Puedes abrir otra sección desde el menú.</p>
        <p>Si el problema continúa, comprueba la conexión y recarga. Tendrás que iniciar sesión de nuevo y se perderán los borradores y PDF que no hayas guardado.</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={this.props.onHome} className="rounded-lg border border-current px-4 py-2 font-semibold">Volver al inicio</button>
          <button type="button" onClick={this.reload} className="rounded-lg bg-red-800 px-4 py-2 font-semibold text-white">Recargar aplicación</button>
        </div>
      </section>
    );
  }
}
