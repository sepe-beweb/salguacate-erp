# Flujos TPV, ERP, Fiscal Core Y TicketBAI

Ultima actualizacion: 2026-06-02

Territorio fiscal objetivo inicial: Alava/Araba.

## Flujo Principal De Venta

```text
Empleado abre TPV
  -> abre o usa sesion de caja
  -> crea comanda de barra/mesa
  -> anade productos
  -> cobra
  -> TPV crea venta cerrada
  -> TPV llama a Fiscal API
  -> Fiscal API crea factura fiscal
  -> TicketBAI Araba/proveedor genera XML, firma, identificativo, QR y envia
  -> Fiscal API devuelve estado fiscal
  -> TPV imprime/entrega ticket segun estado y norma
  -> ERP consume venta para stock, caja y analiticas
```

## Flujo Con Fiscal Simulado Compatible Con Araba

Durante las primeras fases:

```text
TPV venta pagada
  -> Fiscal API simulada
  -> crea evidencias mock de XML, firma, identificativo, QR y respuesta
  -> fiscal_invoice.status = accepted_simulated
  -> TPV puede seguir desarrollando UX
  -> ERP recibe resumen de venta
```

Objetivo: no bloquear desarrollo de TPV por TicketBAI real, pero mantener el contrato de datos parecido al flujo Araba.

## Flujo De Anulacion

```text
Usuario solicita anulacion
  -> TPV valida permisos y motivo
  -> Fiscal API crea solicitud correctiva
  -> TicketBAI Araba/proveedor emite anulacion o rectificacion segun proceda
  -> Fiscal API registra respuesta
  -> TPV muestra resultado
  -> ERP recibe evento sale.cancelled o sale.corrected
```

Regla: no se borra la venta original.

## Flujo De Rechazo TicketBAI Araba

```text
TicketBAI Araba rechaza envio
  -> Fiscal API marca fiscal_invoice.status = rejected
  -> Se guarda error_code y error_message
  -> TPV informa al usuario si afecta operacion actual
  -> ERP/administracion ve alerta fiscal
  -> Responsable corrige causa permitida
  -> Se ejecuta retry o subsanacion segun normativa
```

Regla: ningun rechazo debe quedar invisible.

## Flujo Offline Pendiente De Definir Para Araba

Decision pendiente: ver `decision-log.md`, D-007.

Flujo conceptual provisional:

```text
No hay Internet
  -> TPV detecta conectividad degradada
  -> venta se cobra solo si politica offline lo permite
  -> Fiscal API marca envio pendiente
  -> se imprime/entrega documento segun norma territorial
  -> cola reintenta al recuperar conexion
  -> administracion revisa pendientes diariamente
```

Este flujo no debe implementarse en produccion sin validacion fiscal especifica de TicketBAI Araba.

## Eventos Entre TPV Y ERP

Eventos candidatos:

```text
cash_session.opened
cash_session.closed
sale.created
sale.paid
sale.fiscal_pending
sale.fiscal_accepted
sale.fiscal_rejected
sale.cancelled
stock.consumed
```

Uso previsto en ERP:

- dashboard de ventas
- cierres operativos
- analiticas
- inventario/stock
- alertas fiscales

## Estados De Venta Y Factura

Venta TPV:

```text
open_order -> paid_sale -> fiscal_pending -> fiscal_accepted
                                  \-> fiscal_rejected
                                  \-> cancelled/corrected
```

Factura fiscal:

```text
draft -> issued_local -> xml_generated -> signed -> submitted -> accepted
                                                    \-> rejected -> pending_retry
accepted -> cancellation_requested -> cancelled
accepted -> rectification_requested -> rectified
```

## Puntos De Control

- No imprimir ticket definitivo sin conocer politica fiscal aplicable.
- No activar produccion fiscal sin prueba validada contra entorno Araba.
- No descontar stock irreversible antes de venta cerrada.
- No cerrar caja si hay ventas locales no conciliadas.
- No ocultar facturas rechazadas o pendientes.
- No permitir que un empleado borre venta o factura.
- No perder XML, firma, QR, identificativo, request, response ni error tecnico.
