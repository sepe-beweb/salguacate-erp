# Modelo De Dominio TPV

Ultima actualizacion: 2026-06-02

## Objetivo

Definir el dominio inicial de Salguacate TPV antes de construir pantallas o endpoints definitivos.

## Alcance

Incluye venta operativa, comandas, caja y pagos.

No incluye generacion XML TicketBAI, firma, QR fiscal ni envio a Hacienda.

El documento `docs/arquitectura_tpv_hosteleria.pdf` queda como referencia de producto para evolucionar hacia offline-first, comanderos, KDS, pagos integrados, control de efectivo, escandallos y prediccion de demanda.

## Entidades Principales

### Register / Caja

Representa una caja fisica o logica.

Campos candidatos:

- `id`
- `nombre`
- `local`
- `activo`
- `fiscal_device_id` opcional

### Cash Session / Sesion De Caja

Representa una apertura y cierre de caja.

Campos candidatos:

- `id`
- `register_id`
- `opened_by`
- `closed_by`
- `opened_at`
- `closed_at`
- `opening_cash_amount`
- `expected_cash_amount`
- `counted_cash_amount`
- `card_total`
- `cash_total`
- `difference`
- `status`

Estados candidatos:

- `open`
- `closed`
- `reviewed`

### Product / Producto Vendible

Producto usado por el TPV para vender.

Campos candidatos:

- `id`
- `name`
- `category_id`
- `price`
- `tax_rate`
- `active`
- `erp_inventory_item_id` opcional

Nota: no todos los productos vendibles tienen por que descontar una unidad directa de inventario. Algunos consumen receta o ingredientes.

### Category / Categoria TPV

Agrupa productos vendibles.

Campos candidatos:

- `id`
- `name`
- `sort_order`
- `active`

### Order / Comanda

Venta en curso antes de cobro.

Campos candidatos:

- `id`
- `local`
- `register_id`
- `cash_session_id`
- `table_name` opcional
- `alias` opcional para cuentas provisionales de barra, por ejemplo `Grupo Chaqueta Azul`
- `service_mode`: `bar`, `table`, `takeaway`
- `target_area`: `bar`, `kitchen`, `cold_kitchen`, `coffee`, `other` opcional
- `opened_by`
- `opened_at`
- `status`

Estados candidatos:

- `open`
- `held`
- `voided`
- `paid`

### Order Line / Linea De Comanda

Linea editable mientras la comanda esta abierta.

Campos candidatos:

- `id`
- `order_id`
- `product_id`
- `name_snapshot`
- `quantity`
- `unit_price`
- `tax_rate`
- `notes`
- `modifiers_json` opcional
- `allergens_json` opcional
- `course`: `drink`, `starter`, `main`, `dessert`, `other` opcional
- `kds_status` opcional
- `status`

### Sale / Venta Cerrada

Resultado final tras cobro. Debe ser estable y no editable destructivamente.

Campos candidatos:

- `id`
- `order_id`
- `local`
- `register_id`
- `cash_session_id`
- `sold_by`
- `sold_at`
- `subtotal`
- `tax_total`
- `discount_total`
- `total`
- `status`
- `fiscal_invoice_id` opcional

Estados candidatos:

- `paid`
- `fiscal_pending`
- `fiscal_accepted`
- `fiscal_rejected`
- `cancelled`

### Sale Line / Linea De Venta

Snapshot final de productos vendidos.

Campos candidatos:

- `id`
- `sale_id`
- `product_id`
- `name_snapshot`
- `quantity`
- `unit_price`
- `tax_rate`
- `line_total`

### Payment / Pago

Pago asociado a una venta.

Campos candidatos:

- `id`
- `sale_id`
- `method`: `cash`, `card`, `mixed`, `other`
- `provider` opcional: dataphone, Bizum, Apple Pay, Google Pay u otro proveedor futuro
- `amount`
- `reference`
- `paid_at`
- `status`

### Refund / Anulacion O Devolucion

Operacion correctiva sobre una venta.

Campos candidatos:

- `id`
- `sale_id`
- `reason`
- `amount`
- `created_by`
- `created_at`
- `status`
- `fiscal_invoice_id` opcional

### KDS Ticket / Orden De Cocina

Entidad futura para enrutado de comandas a cocina/barra.

Campos candidatos:

- `id`
- `order_id`
- `target_area`
- `status`: `pending`, `in_progress`, `ready`, `served`, `cancelled`
- `created_at`
- `completed_at`

### Table Transfer / Traspaso De Barra A Mesa

Entidad futura para mover una cuenta provisional a mesa sin cerrar ticket intermedio.

Campos candidatos:

- `id`
- `order_id`
- `from_alias`
- `to_table_name`
- `moved_by`
- `moved_at`

## Invariantes

- Una comanda abierta puede editarse.
- Una comanda de barra con alias puede traspasarse a mesa mientras no este cobrada.
- Una venta cobrada no se edita destructivamente.
- Una venta cerrada conserva snapshots de nombre, precio e IVA.
- Todo pago debe pertenecer a una venta.
- Todo cierre de caja debe poder reconciliar efectivo esperado contra efectivo contado.
- Si una venta tiene factura fiscal emitida, cualquier correccion debe crear evento correctivo.
- Las notas de cocina, modificadores y alergenos deben conservarse al convertir comanda en venta si afectan al producto entregado.

## Endpoints Iniciales Candidatos

```text
GET /api/tpv/products
POST /api/tpv/orders
PATCH /api/tpv/orders/:id
POST /api/tpv/orders/:id/lines
PATCH /api/tpv/order-lines/:id
POST /api/tpv/orders/:id/pay
GET /api/tpv/sales/:id
POST /api/tpv/cash-sessions
PATCH /api/tpv/cash-sessions/:id/close
```

## Relacion Con ERP

El ERP consume resumenes y eventos TPV. No debe modificar ventas cobradas.

Datos que el ERP puede consumir:

- ventas por dia/local/caja
- productos vendidos
- consumo de stock
- cierres de caja
- estados fiscales
- incidencias y anulaciones
