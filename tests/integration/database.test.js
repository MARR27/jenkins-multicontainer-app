const request = require('supertest');
const { app, pool, connectRedis, getRedisClient } = require('../../src/app');

describe('Pruebas de Integración con PostgreSQL y Redis', () => {
  beforeAll(async () => {
    await connectRedis();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL
      )
    `);
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM users');

    const redisClient = getRedisClient();

    if (redisClient && redisClient.isReady) {
      await redisClient.flushAll();
    }
  });

  afterAll(async () => {
    await pool.query('DROP TABLE IF EXISTS users');
    await pool.end();

    const redisClient = getRedisClient();

    if (redisClient && redisClient.isReady) {
      await redisClient.quit();
    }
  });

  test('POST /users debe crear un usuario en PostgreSQL', async () => {
    const userData = {
      name: 'María González',
      email: 'maria@ejemplo.com',
    };

    const response = await request(app)
      .post('/users')
      .send(userData)
      .expect(201);

    expect(response.body.name).toBe(userData.name);
    expect(response.body.email).toBe(userData.email);
    expect(response.body).toHaveProperty('id');

    const dbResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [userData.email]
    );

    expect(dbResult.rows.length).toBe(1);
    expect(dbResult.rows[0].name).toBe(userData.name);
  });

  test('GET /users/:id debe obtener usuario desde PostgreSQL y luego desde Redis', async () => {
    const userData = {
      name: 'Carlos López',
      email: 'carlos@ejemplo.com',
    };

    const createResponse = await request(app)
      .post('/users')
      .send(userData)
      .expect(201);

    const userId = createResponse.body.id;

    const firstResponse = await request(app)
      .get(`/users/${userId}`)
      .expect(200);

    expect(firstResponse.body.source).toBe('database');
    expect(firstResponse.body.data.email).toBe(userData.email);

    const secondResponse = await request(app)
      .get(`/users/${userId}`)
      .expect(200);

    expect(secondResponse.body.source).toBe('cache');
    expect(secondResponse.body.data.email).toBe(userData.email);
  });
});