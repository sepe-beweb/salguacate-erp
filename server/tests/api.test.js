import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

// Configurar entorno de pruebas
process.env.NODE_ENV = 'test';
const require = createRequire(import.meta.url);

// Mockear el SDK de Google GenAI para evitar llamadas reales
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      constructor() {}
      models = {
        generateContent: async () => ({
          text: '{"proveedor": "Proveedor Test", "total": 120.50, "rawText": "Factura de prueba de 120.50 euros"}'
        }),
        generateImages: async () => ({
          generatedImages: [
            { image: { imageBytes: 'dummypngimagebytes' } }
          ]
        })
      };
    }
  };
});

let app;
let db;

describe('Salguacate ERP - Batería de Tests de la API REST', () => {
  
  beforeAll(async () => {
    // Cargar después de fijar NODE_ENV y usando require para compartir la misma instancia CJS.
    app = require('../index');
    db = require('../database');
    // Esperar a que las tablas de database.sqlite (:memory:) estén listas
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  afterAll(() => {
    db?.close();
  });

  let authToken = '';

  describe('👥 Endpoints de Usuarios y Autenticación', () => {
    
    it('GET /api/usuarios/public - Debería retornar la lista pública de usuarios sin revelar PINs', async () => {
      const res = await request(app)
        .get('/api/usuarios/public')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('nombre');
      expect(res.body[0]).toHaveProperty('rol');
      expect(res.body[0]).not.toHaveProperty('pin'); // Seguridad
    });

    it('POST /api/login - Debería permitir login con PIN correcto', async () => {
      // El usuario ID 1 es 'Admin' (owner) con PIN '0000' (default) en las semillas
      const res = await request(app)
        .post('/api/login')
        .send({ usuario_id: 1, pin: '0000' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.id).toBe(1);
      if (res.body.token) {
        authToken = res.body.token;
      }
    });

    it('POST /api/login - Debería rechazar login con PIN incorrecto', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ usuario_id: 1, pin: '9999' })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(res.body).toHaveProperty('error', 'PIN incorrecto');
    });

  });

  describe('🟢 Endpoint de Presencia y Control Horario', () => {
    
    it('GET /api/fichajes/presencia - Debería retornar el estado de presencia de la plantilla', async () => {
      const res = await request(app)
        .get('/api/fichajes/presencia')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // Por defecto la plantilla semilla no tiene fichajes de hoy, su estado inicial debería ser 'fuera'
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('estado_presencia');
    });

  });

  describe('📋 Endpoint de Tareas', () => {
    
    it('POST /api/tareas - Debería registrar una nueva tarea', async () => {
      const nuevaTarea = {
        titulo: 'Limpiar cafetera principal',
        descripcion: 'Limpieza con detergente especial',
        asignado_a: 1,
        fecha: '2026-05-25',
        prioridad: 'alta',
        local: 'Principal'
      };

      const res = await request(app)
        .post('/api/tareas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(nuevaTarea)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('mensaje', 'Tarea añadida');
    });

  });

});
