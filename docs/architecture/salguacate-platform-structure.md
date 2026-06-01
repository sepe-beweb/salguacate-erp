# Estructura De Plataforma Salguacate

## Objetivo

Preparar el repositorio para que Salguacate ERP, Salguacate TPV y la capa fiscal TicketBAI evolucionen con limites claros.

## Carpetas Principales

- `apps/erp-web`: frontend actual del ERP.
- `apps/api`: backend Express actual.
- `apps/android`: wrapper Android del ERP web.
- `apps/tpv-web`: espacio reservado para el futuro TPV.
- `packages/shared`: tipos y utilidades comunes.
- `packages/fiscal-core`: dominio fiscal independiente de territorios.
- `packages/ticketbai`: adaptadores TicketBAI/BATUZ.
- `docs`: documentacion funcional, tecnica y fiscal.
- `scripts`: automatizaciones del repositorio.

## Regla De Separacion

El ERP gestiona el negocio. El TPV vende y cobra. Fiscal Core emite documentos fiscales inmutables. TicketBAI implementa la comunicacion normativa concreta.

Ninguna pantalla del ERP o TPV debe generar XML TicketBAI directamente.

## Documentos Relacionados

- `README.md`: indice de arquitectura.
- `salguacate-tpv-roadmap.md`: plan por fases para TPV y fiscal.
- `decision-log.md`: decisiones aceptadas y pendientes.
- `tpv-domain-model.md`: dominio de ventas, caja y pagos.
- `fiscal-domain-model.md`: dominio fiscal independiente.
- `tpv-fiscal-flow.md`: flujos entre TPV, ERP, Fiscal Core y TicketBAI.

## Posible Separacion En Repos

Mantener monorepo mientras se estabilizan contratos internos. Separar en repos solo cuando existan APIs estables y ciclos de despliegue independientes.

Separacion futura posible:

- `salguacate-docs-platform`: documentacion, decisiones y paquetes compartidos publicados/versionados.
- `salguacate-erp`: ERP web, Android y API ERP si se mantiene acoplada.
- `salguacate-tpv`: TPV web y API de ventas.
- `salguacate-fiscal`: opcional si el motor fiscal se vuelve producto independiente.
