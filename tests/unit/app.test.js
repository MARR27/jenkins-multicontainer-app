const request = require('supertest');
const { app } = require('../../src/app');

describe('Pruebas Unitarias - API', () => {
  test('GET /health debe retornar estado saludable', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('services');
    expect(response.body.services).toHaveProperty('postgres');
    expect(response.body.services).toHaveProperty('redis');
  });

  test('POST /users debe validar datos obligatorios', async () => {
    const response = await request(app)
      .post('/users')
      .send({
        name: '',
        email: '',
      })
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('El nombre y el correo son obligatorios');
  });
});