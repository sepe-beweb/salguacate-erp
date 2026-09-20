// Disposable fixtures only: reconstruct the previous schema before testing its upgrade.
function schemaV2(sql) {
  sql.exec(`
    DROP TABLE documento_cambios; DROP TABLE documentos;
    DELETE FROM schema_migrations WHERE version >= 5;
    DROP TABLE relevo_cambios; DROP TABLE relevo_gestion;
    DELETE FROM schema_migrations WHERE version = 4;
    ALTER TABLE tareas DROP COLUMN rutina_ejecucion_id;
    ALTER TABLE tareas DROP COLUMN completado_por;
    ALTER TABLE tareas DROP COLUMN completado_en;
    DROP TABLE relevo_lecturas; DROP TABLE relevos; DROP TABLE rutina_ejecuciones; DROP TABLE rutinas;
    CREATE TABLE old_receipts (
      actor_id INTEGER NOT NULL REFERENCES usuarios(id),
      operation TEXT NOT NULL CHECK (operation IN ('note.create', 'expense.create')),
      request_key TEXT NOT NULL, request_hash TEXT NOT NULL, status INTEGER NOT NULL,
      response_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (actor_id, operation, request_key)
    );
    INSERT INTO old_receipts SELECT * FROM idempotency_requests;
    DROP TABLE idempotency_requests;
    ALTER TABLE old_receipts RENAME TO idempotency_requests;
    DELETE FROM schema_migrations WHERE version = 3;
  `);
}
module.exports = { schemaV2 };
