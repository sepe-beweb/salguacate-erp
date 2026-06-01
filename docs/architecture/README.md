# Arquitectura Salguacate

Indice vivo de arquitectura, planes y decisiones de plataforma.

## Documentos

- `salguacate-platform-structure.md`: estructura del monorepo y criterio de separacion futura.
- `salguacate-tpv-roadmap.md`: plan de accion por fases para Salguacate TPV y capa fiscal.
- `decision-log.md`: decisiones tomadas, pendientes y criterios de revision.
- `tpv-domain-model.md`: modelo de dominio previsto para ventas, mesas, caja y pagos.
- `fiscal-domain-model.md`: modelo fiscal independiente de TicketBAI concreto.
- `tpv-fiscal-flow.md`: flujos entre TPV, ERP, Fiscal Core y TicketBAI.
- `../arquitectura_tpv_hosteleria.pdf`: documento de referencia sobre TPVs de nueva generacion para hosteleria.

## Regla Principal

ERP gestiona negocio. TPV vende y cobra. Fiscal Core crea documentos fiscales inmutables. TicketBAI comunica con Hacienda.

Territorio fiscal objetivo inicial: Alava/Araba.

Ninguna pantalla del ERP o TPV debe generar XML TicketBAI directamente.

## Como Usar Estos Documentos

- Cada decision importante debe registrarse en `decision-log.md`.
- Cada cambio que afecte flujo de venta o facturacion debe reflejarse en `tpv-fiscal-flow.md`.
- Cada nueva tabla o entidad TPV debe entrar primero en `tpv-domain-model.md`.
- Cada nueva tabla o entidad fiscal debe entrar primero en `fiscal-domain-model.md`.
