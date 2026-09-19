# Arquitectura de Salguacate

Entrada vigente: [estado de recuperación y puertas de salida](recovery-status.md). Los informes siguientes describen la evidencia de su bloque, no una certificación acumulada de producción. Las cifras, siguientes pasos y menciones a «todavía local» de un informe antiguo corresponden a ese momento; consultar Git y la CI del commit concreto para saber qué está publicado.

## Base técnica, datos y carga

- [1. Cimientos](recovery-foundation.md): SQLite, configuración, autenticación y migraciones.
- [2. Módulos](recovery-modules.md): contratos y separación del backend.
- [3. Pantallas](recovery-screens.md): errores y operaciones de gestión.
- [4. Recuperación de datos](recovery-data.md): backup, verificación y restauración aislada.
- [5. Flujos personales](recovery-personal-workflows.md): notas, escáner y empleado.
- [6. Carga por rutas](recovery-route-loading.md): pantallas diferidas, recuperación y presupuesto.
- [7. Idempotencia](recovery-idempotency.md): altas de notas/gastos y esquema 2.
- [8. Intentos por sesión](recovery-session-attempts.md): navegación, respuestas tardías y cierre de sesión.
- [30. Instalación nueva](recovery-fresh-install.md): alta inicial explícita, sin migrar históricos ni sobrescribir bases.
- [31. Alojamiento gratuito](recovery-free-hosting.md): ensayo Turso desechable, adaptador asíncrono aislado y puertas de integración.

## Finanzas, planificación y personal

- [9. Gastos manuales](recovery-manual-expenses.md): alta y consulta sin IA.
- [10. Valores financieros](recovery-financial-values.md): fechas civiles y sumas en céntimos.
- [11. Panel y cierres](recovery-dashboard-closings.md): resumen e historial.
- [12. Agenda y tareas](recovery-planning-values.md): fechas y estados validados.
- [13. Planificación del empleado](recovery-employee-planning.md): turnos propios.
- [14. Diálogos de planificación](recovery-planning-dialogs.md): foco y borradores.
- [15. Peticiones y plantilla](recovery-personnel-requests.md): consulta y revisión.
- [16. Editores de personal](recovery-personnel-dialogs.md): altas, turnos y aislamiento E2E.
- [27. Presencia registrada](recovery-presence-values.md): consulta validada y actualización manual.

## Navegación, comunicación y sesión

- [17. Buzón](recovery-messages.md): directorio, fechas y envío.
- [18. Navegación móvil](recovery-mobile-navigation.md): destinos por rol e independencia del panel.
- [19. Renovación de PIN](recovery-pin-renewal.md): confirmación y bloqueo del guardado.
- [20. Acceso](recovery-login.md): perfiles y recuperación de errores.
- [21. Sesión autenticada](recovery-authenticated-session.md): identidad y respuestas tardías.
- [26. Notas](recovery-note-values.md): metadatos y fijado sin sobrescribir contenido.

## Catálogo, stock y pedidos

- [22. Stock e historial](recovery-stock-values.md): cantidades y líneas registradas.
- [23. Borrador de pedidos](recovery-order-dialogs.md): proveedor por ID y local conservado.
- [24. Catálogo y alertas](recovery-catalog-values.md): inventario compartido y categorías.
- [25. Altas de catálogo](recovery-catalog-dialogs.md): formularios e imágenes.
- [29. Persistencia de fotos](recovery-catalog-images.md): PNG/JPEG reales en almacenamiento temporal de pruebas.

## Propuestas históricas: no acreditan implementación

Se conservan como material de diseño. No son el contrato vigente del ERP recuperado ni una autorización para implementar, certificar o publicar módulos fiscales.

- [Estructura de plataforma](salguacate-platform-structure.md).
- [Roadmap TPV](salguacate-tpv-roadmap.md).
- [Registro de decisiones previo](decision-log.md).
- [Dominio TPV](tpv-domain-model.md).
- [Dominio fiscal](fiscal-domain-model.md).
- [Flujo TPV y fiscal](tpv-fiscal-flow.md).

La separación propuesta mantiene ERP para gestión, TPV para venta/cobro y una capa fiscal independiente. Álava/Araba figura como territorio objetivo en esos planes: no se ha validado cumplimiento normativo, generación fiscal ni integración TicketBAI. Cualquier continuación de esas áreas exige alcance y validación propios.
