# Decision Log Salguacate

Ultima actualizacion: 2026-06-02

Este documento registra decisiones de arquitectura y producto. Las decisiones pendientes no deben asumirse como cerradas en codigo.

## Estados

- `Aceptada`: se puede implementar siguiendo esta decision.
- `Pendiente`: necesita confirmacion de negocio, fiscalidad o tecnologia.
- `Revisar`: decision provisional que debe reevaluarse.
- `Rechazada`: alternativa descartada con motivo.

## Decisiones

### D-001 - Mantener Monorepo De Plataforma

Estado: Aceptada

Decision: mantener ERP, API, Android, TPV futuro y paquetes compartidos en el mismo repositorio por ahora.

Motivo: aun no existen contratos estables ni despliegues independientes para TPV y fiscal. Separar ahora en varios repos generaria coste operativo sin aportar aislamiento real.

Revision: separar en repos cuando TPV, ERP y fiscal tengan ciclos de despliegue independientes y APIs estables.

### D-002 - Separar ERP, TPV Y Fiscal Por Responsabilidad

Estado: Aceptada

Decision: ERP gestiona negocio, TPV vende/cobra, Fiscal Core crea documentos fiscales y TicketBAI comunica con Hacienda.

Motivo: TicketBAI tiene riesgo normativo, firma, XML, certificados y auditoria. Debe estar aislado de pantallas y flujos operativos.

Consecuencia: ninguna pantalla React debe generar XML TicketBAI directamente.

### D-003 - Crear Fiscal API Antes De TicketBAI Real

Estado: Aceptada

Decision: el TPV consumira una Fiscal API abstracta, primero simulada y despues real/proveedor.

Motivo: permite avanzar TPV sin bloquearse por firma XAdES, XSD, certificados y entorno de pruebas foral.

Consecuencia: el TPV no depende de clases o funciones especificas de TicketBAI.

### D-004 - Proveedor Fiscal Vs Motor Propio

Estado: Pendiente

Decision pendiente: elegir si la primera version real usara proveedor/SDK fiscal o motor TicketBAI propio.

Criterios:

- Proveedor: menor riesgo y salida a produccion mas rapida.
- Motor propio: mas control, mas coste, mas responsabilidad y mantenimiento normativo.
- Recomendacion actual: proveedor/SDK para produccion inicial, POC propio en paralelo solo si interesa independencia futura.

Necesario para cerrar: presupuesto, plazo objetivo, nivel de riesgo aceptado y resultado del POC TicketBAI Araba.

### D-005 - Territorio Fiscal

Estado: Aceptada

Decision: el territorio fiscal objetivo de Salguacate es Alava/Araba.

Motivo: el negocio debe cumplir de forma escrupulosa los requisitos TicketBAI aplicables en Alava.

Consecuencia: el POC fiscal inicial debe centrarse en TicketBAI Araba, sus XSD, endpoints, politica de firma, QR, identificativo, registro/alta de software si aplica, acuses y procedimientos de anulacion.

Nota: Veri*Factu queda como referencia conceptual y posible requisito futuro solo si el software se usa con emisores de territorio comun o se comercializa fuera del ambito foral.

### D-006 - Emisor, Locales Y Series

Estado: Pendiente

Decision pendiente: confirmar si ambos locales comparten NIF emisor y como se asignan series.

Opciones:

- Serie unica por emisor.
- Serie por local.
- Serie por caja/dispositivo.
- Serie por emisor/local/caja.

Recomendacion provisional: serie por emisor/local/caja si hay varias cajas operativas, salvo que asesor fiscal recomiende otra politica.

### D-007 - Politica Offline

Estado: Pendiente

Decision pendiente: definir si se puede emitir/cobrar cuando no hay Internet y como se gestiona el envio posterior.

Motivo: en hosteleria la caja no puede bloquearse facilmente, pero TicketBAI exige control y envio conforme a normativa.

Necesario para cerrar: normativa territorial, hardware real, red local y criterio de asesor fiscal.

### D-008 - Edicion De Ventas Cobradas

Estado: Aceptada

Decision: una venta cobrada o factura fiscal emitida no se edita destructivamente.

Motivo: integridad fiscal, auditoria y trazabilidad.

Consecuencia: los errores se resuelven con anulacion, rectificacion, devolucion o evento correctivo.

### D-009 - Datos Historicos Del ERP Actual

Estado: Revisar

Decision provisional: no migrar cierres de caja actuales a ventas TPV fiscales.

Motivo: los cierres actuales son contabilidad operativa, no facturas fiscales ni ventas linea a linea.

Revision: cuando exista modelo TPV, decidir si se importan datos antiguos solo como analitica historica.

### D-010 - Cumplimiento TicketBAI Araba Como Requisito De Diseno

Estado: Aceptada

Decision: la capa fiscal se disenara desde el inicio bajo criterios estrictos de cumplimiento TicketBAI Araba, aunque la primera API fiscal sea simulada.

Motivo: no se quiere construir un TPV que luego haya que rehacer para cumplir requisitos fiscales.

Consecuencias:

- Las facturas/tickets fiscales seran inmutables.
- Las anulaciones y rectificaciones se modelaran como documentos/eventos correctivos.
- Se conservaran XML, firmas, hashes, QR, identificadores y respuestas de Hacienda.
- Toda factura rechazada o pendiente debera ser visible y accionable.
- Ningun flujo de produccion podra depender de editar o borrar ventas/facturas ya emitidas.

### D-011 - Offline-First Condicionado Por Normativa Fiscal

Estado: Pendiente

Decision pendiente: definir el alcance real del modo offline para TPV en Alava.

Motivo: el PDF de arquitectura TPV recomienda offline-first para hosteleria, pero el flujo fiscal debe validarse con TicketBAI Araba y asesor fiscal antes de operar en produccion.

Recomendacion provisional: disenar cola local y sincronizacion, pero no activar emision fiscal offline en produccion hasta tener procedimiento validado.
