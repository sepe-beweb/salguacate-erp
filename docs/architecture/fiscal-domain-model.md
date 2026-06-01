# Modelo De Dominio Fiscal

Ultima actualizacion: 2026-06-02

## Objetivo

Definir una capa fiscal independiente del ERP, TPV y adaptador TicketBAI concreto. El territorio objetivo inicial es Alava/Araba.

## Alcance

Incluye facturas fiscales, series, emisores, dispositivos, estados, auditoria, evidencias TicketBAI y cola de envio.

No incluye UI de TPV, gestion de mesas ni inventario.

## Entidades Principales

### Fiscal Issuer / Emisor Fiscal

Representa la entidad que emite facturas.

Campos candidatos:

- `id`
- `legal_name`
- `tax_id`
- `territory`: inicialmente `araba`
- `address`
- `active`

Nota: el modelo conserva el campo `territory` para no bloquear una expansion futura, pero la implementacion inicial debe validar solamente el flujo Araba.

### Fiscal Device / Dispositivo Fiscal

Representa caja/dispositivo asociado a emision fiscal.

Campos candidatos:

- `id`
- `issuer_id`
- `local`
- `register_id`
- `certificate_id`
- `device_reference`
- `active`

### Invoice Series / Serie Fiscal

Controla numeracion.

Campos candidatos:

- `id`
- `issuer_id`
- `local`
- `register_id`
- `series_code`
- `next_number`
- `active`

### Fiscal Invoice / Factura Fiscal

Documento fiscal inmutable.

Campos candidatos:

- `id`
- `source_type`: `tpv_sale`, `manual_invoice`, `correction`
- `source_id`
- `issuer_id`
- `device_id`
- `series_id`
- `invoice_number`
- `issued_at`
- `customer_tax_id` opcional
- `subtotal`
- `tax_total`
- `total`
- `status`
- `tbai_identifier` opcional
- `qr_url` opcional
- `previous_invoice_hash` opcional
- `invoice_hash` opcional
- `submission_deadline_at` opcional

Estados candidatos:

- `draft`
- `issued_local`
- `xml_generated`
- `signed`
- `submitted`
- `accepted`
- `rejected`
- `pending_retry`
- `cancelled`
- `rectified`

### Fiscal Invoice Line / Linea Fiscal

Snapshot fiscal de una linea vendida.

Campos candidatos:

- `id`
- `fiscal_invoice_id`
- `description`
- `quantity`
- `unit_price`
- `tax_rate`
- `tax_amount`
- `line_total`

### TBAI XML Document / Documento XML

Guarda XML generado y firmado.

Campos candidatos:

- `id`
- `fiscal_invoice_id`
- `territory`
- `xsd_version`
- `unsigned_xml`
- `signed_xml`
- `xml_hash`
- `signature_algorithm`
- `certificate_fingerprint`
- `tbai_identifier`
- `qr_payload`
- `created_at`

### TBAI Submission / Envio

Registra envios y respuestas.

Campos candidatos:

- `id`
- `fiscal_invoice_id`
- `endpoint`
- `request_payload_ref`
- `response_payload`
- `status_code`
- `result`: `accepted`, `rejected`, `temporary_error`
- `error_code`
- `error_message`
- `submitted_at`
- `retry_count`
- `submitted_by_process`
- `raw_request_hash`
- `raw_response_hash`

### Fiscal Event / Evento Fiscal

Auditoria.

Campos candidatos:

- `id`
- `fiscal_invoice_id`
- `event_type`
- `actor_user_id`
- `metadata_json`
- `created_at`

### Fiscal Certificate / Certificado Fiscal

Representa certificado usado para firma/envio.

Campos candidatos:

- `id`
- `issuer_id`
- `alias`
- `type`: `company`, `representative`, `device`
- `fingerprint`
- `valid_from`
- `valid_until`
- `status`

### Fiscal Compliance Check / Comprobacion De Cumplimiento

Checklist tecnico por factura o lote.

Campos candidatos:

- `id`
- `fiscal_invoice_id`
- `check_name`
- `status`: `passed`, `failed`, `not_applicable`
- `details`
- `created_at`

## Invariantes

- Una factura aceptada no se modifica.
- Una factura emitida conserva sus lineas y totales.
- Una anulacion o rectificacion crea nuevo evento/documento, no borra el anterior.
- Cada factura debe pertenecer a un emisor y una serie.
- El control de numeracion debe ser transaccional.
- Cada XML y respuesta de Hacienda debe conservarse.
- Todo rechazo debe quedar visible para administracion.
- Todo XML debe poder trazarse a version XSD, certificado, firma y respuesta.
- El sistema debe impedir saltos o duplicidades de numeracion en condiciones normales.
- Antes de produccion se deben probar alta, anulacion, rechazo y reintento en entorno Araba.

## API Fiscal Inicial

```text
POST /api/fiscal/invoices
GET /api/fiscal/invoices/:id
POST /api/fiscal/invoices/:id/cancel
POST /api/fiscal/invoices/:id/retry
GET /api/fiscal/invoices?status=pending_retry
```

## Integracion TicketBAI

`packages/fiscal-core` debe exponer dominio y contratos. `packages/ticketbai` implementa detalles territoriales.

Prioridad inicial: adaptador `ticketbai-araba`.

Adaptador candidato:

```text
createXml(invoice, territoryConfig)
signXml(unsignedXml, certificate)
buildQr(signedXml, invoice)
submitSignedXml(signedXml, endpointConfig)
parseSubmissionResponse(response)
```

## Requisitos Especificos Para Araba

Antes de produccion deben estar documentados y probados:

- XSD vigente de TicketBAI Araba.
- Endpoint de pruebas y endpoint de produccion.
- Politica de firma XAdES requerida.
- Tipo de certificado admitido y procedimiento de alta/registro si aplica.
- Reglas de generacion del identificativo TicketBAI.
- Reglas de generacion del QR.
- Flujo de alta de factura simplificada.
- Flujo de anulacion.
- Tratamiento de rechazos y reintentos.
- Conservacion de XML firmado, respuesta y evidencias.
- Procedimiento operativo para facturas pendientes o rechazadas.

## Decision Pendiente

La implementacion real para Araba puede ser:

- Motor propio en `packages/ticketbai`.
- Proveedor/SDK fiscal detras de la misma Fiscal API.

El TPV no debe notar la diferencia.
