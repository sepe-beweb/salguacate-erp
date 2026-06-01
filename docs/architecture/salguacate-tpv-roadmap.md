# Roadmap Salguacate TPV Y Fiscal

Ultima actualizacion: 2026-06-02

## Objetivo

Construir Salguacate TPV como producto conectado al ERP y preparado para emitir tickets/facturas mediante una capa fiscal aislada compatible con TicketBAI Araba. Bizkaia/BATUZ, Gipuzkoa y Veri*Factu quedan fuera del objetivo inicial salvo decision futura.

## Principios

- El TPV no es una pantalla mas del ERP: es una aplicacion operativa de venta.
- El ERP no debe vender ni fiscalizar; debe recibir informacion fiable del TPV.
- TicketBAI no debe vivir en componentes React ni en pantallas de caja.
- La fiscalidad debe ser inmutable, auditable y testeable.
- Alava/Araba es el territorio fiscal objetivo inicial y sus requisitos mandan sobre cualquier comodidad operativa.
- Veri*Factu se mantiene como referencia conceptual, no como objetivo principal del primer despliegue.
- Primero se estabilizan contratos y dominio; despues se construyen pantallas.
- El monorepo se mantiene hasta que existan contratos y despliegues independientes.

## Fase 0 - Preparacion Y Decisiones

Objetivo: cerrar riesgos de negocio antes de implementar fuerte.

Entregables:

- Territorio fiscal: cerrado como Alava/Araba.
- Confirmacion de emisor fiscal: autonomo, SL, varios emisores o varios NIF.
- Politica de series: global, por local, por caja o por emisor.
- Politica offline validada contra TicketBAI Araba: que se permite si no hay Internet y como se envia despues.
- Decision inicial sobre proveedor fiscal vs motor propio.
- Inventario de hardware: tablets, caja, impresoras 80 mm, dataphonos, red.
- Definicion de operativa real de anulaciones y errores de camarero.
- Revision de documentacion oficial Araba: XSD, endpoints, politica de firma, QR, alta/registro de software y certificados.

Criterio de salida:

- Las decisiones criticas estan registradas en `decision-log.md`.
- El equipo entiende que una venta cobrada/fiscalizada no se edita destructivamente.

## Fase 1 - Dominio Y API TPV Sin TicketBAI Real

Objetivo: crear venta real interna sin fiscalizacion real todavia.

Entregables:

- Tablas TPV base.
- API de productos vendibles, comandas, ventas, pagos y caja.
- Sesion de caja: apertura, movimientos y cierre.
- Venta cerrada con pago efectivo/tarjeta/mixto.
- Ticket interno no fiscal para pruebas.
- Eventos hacia ERP para stock, cierres y analiticas.
- Preparacion de dominio para comanderos, KDS/cocina, alias de barra, traspaso a mesa, modificadores y alergenos, aunque no entren todos en el MVP.

Criterio de salida:

- Una venta puede crearse, cobrarse y consultarse desde API.
- El ERP puede recibir o consultar resumen de ventas TPV.
- No existe todavia XML TicketBAI real en el TPV.

## Fase 2 - Fiscal API Simulada

Objetivo: bloquear el contrato fiscal antes de implementar TicketBAI.

Entregables:

- API fiscal abstracta.
- Estados fiscales simulados.
- Registro fiscal inmutable simulado.
- Anulacion simulada.
- Reintento simulado.
- Panel o endpoint para facturas pendientes/rechazadas.
- Persistencia simulada de evidencias fiscales: identificador, QR, XML, firma y respuesta, aunque sean datos mock.

Contrato inicial:

```text
POST /api/fiscal/invoices
GET /api/fiscal/invoices/:id
POST /api/fiscal/invoices/:id/cancel
POST /api/fiscal/invoices/:id/retry
```

Criterio de salida:

- El TPV depende de Fiscal API, no de TicketBAI directamente.
- Se puede cambiar implementacion simulada por proveedor o motor propio sin reescribir TPV.

## Fase 3 - Primer TPV Web Operativo

Objetivo: construir UX minima de venta.

Entregables:

- Pantalla de barra.
- Pantalla de mesas simple.
- Seleccion de productos.
- Modificacion de cantidades.
- Cobro.
- Vista de caja actual.
- Apertura y cierre de caja.

Criterio de salida:

- Un camarero puede operar una venta completa en entorno local/demo.
- La venta llama a Fiscal API simulada.
- El ERP recibe datos utiles para stock y caja.

## Fase 4 - POC TicketBAI Real

Objetivo: demostrar una factura simplificada minima contra entorno de pruebas de TicketBAI Araba.

Entregables:

- XML de alta TicketBAI Araba para una venta simple.
- Validacion contra XSD oficial de Araba.
- Firma XAdES.
- Identificativo TicketBAI.
- QR.
- Envio a entorno de pruebas de Araba.
- Registro de respuesta.
- Prueba de anulacion si el entorno/documentacion lo permite.
- Documento tecnico con pasos, certificados usados, request/response y errores encontrados.

Criterio de salida:

- Existe una prueba documentada de envio y respuesta.
- Se decide formalmente entre proveedor fiscal y motor propio.

## Fase 5 - Integracion Fiscal Real

Objetivo: sustituir simulacion por implementacion fiscal real o proveedor.

Entregables:

- Factura simplificada real.
- Anulacion real.
- Rectificacion/subsanacion si aplica en el flujo Araba.
- Reintentos.
- Tratamiento de rechazos.
- Exportacion de XML y respuestas.
- Monitor fiscal para administracion.
- Alertas de certificado si aplica.

Criterio de salida:

- Flujo de venta real preparado para piloto controlado.
- El asesor fiscal valida comportamiento y documentos.

## Fase 6 - Piloto Y Produccion

Objetivo: operar en una caja/local controlado.

Entregables:

- Procedimiento de apertura y cierre.
- Procedimiento de contingencia offline.
- Procedimiento de rechazo TicketBAI.
- Backups y restauracion probada.
- Formacion de personal.
- Checklist diaria de facturas pendientes.

Criterio de salida:

- Operacion real estable.
- No hay facturas pendientes sin control.
- El personal sabe anular, reimprimir y reportar incidencias.

## Primer Sprint Recomendado

1. Cerrar emisor fiscal y series para Alava/Araba.
2. Crear tablas TPV base.
3. Crear tablas fiscales simuladas.
4. Crear API TPV minima.
5. Crear Fiscal API simulada.
6. Crear pantalla TPV de barra simple.
7. Conectar venta con ERP a nivel de resumen.
8. Preparar POC TicketBAI Araba como siguiente sprint.

## Backlog Posterior Al MVP

Elementos recogidos del documento `docs/arquitectura_tpv_hosteleria.pdf` que deben considerarse despues del flujo minimo:

- Arquitectura offline-first con base local y sincronizacion cloud.
- Comanderos moviles.
- KDS/monitores de cocina.
- Enrutado de comandas por zona: barra, cocina fria, cocina caliente, cafeteria.
- Alias de barra y traspaso de consumo a mesa.
- Modificadores, alergenos, intolerancias y orden de salida de platos.
- Carta digital/autopedido QR.
- Pagos integrados: dataphono, Bizum, Apple Pay, Google Pay.
- Cajones inteligentes tipo Cashlogy/Cashkeeper como opcion de control de efectivo.
- Escandallos, recetas, food cost y rentabilidad de carta.
- Prediccion de demanda e IA para compras/produccion.
