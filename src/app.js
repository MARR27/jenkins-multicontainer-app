const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuración de PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'testdb',
  user: process.env.DB_USER || 'testuser',
  password: process.env.DB_PASSWORD || 'testpass',
});

// Configuración de Redis
let redisClient = null;

const connectRedis = async () => {
  try {
    if (redisClient && redisClient.isReady) {
      return redisClient;
    }

    redisClient = redis.createClient({
      url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
    });

    redisClient.on('error', (error) => {
      console.error('Error en Redis:', error.message);
    });

    await redisClient.connect();
    console.log('Conectado a Redis');

    return redisClient;
  } catch (error) {
    console.error('Error conectando a Redis:', error.message);
    return null;
  }
};

// Middleware
app.use(express.json());

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      postgres: pool ? 'configured' : 'not-configured',
      redis: redisClient && redisClient.isReady ? 'connected' : 'disconnected',
    },
  });
});

// Endpoint para crear usuario
app.post('/users', async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      error: 'El nombre y el correo son obligatorios',
    });
  }

  try {
    const result = await pool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

// Endpoint para obtener usuario
app.get('/users/:id', async (req, res) => {
  const userId = req.params.id;

  // Intentar obtener de Redis
  try {
    if (redisClient && redisClient.isReady) {
      const cachedUser = await redisClient.get(`user:${userId}`);

      if (cachedUser) {
        return res.json({
          source: 'cache',
          data: JSON.parse(cachedUser),
        });
      }
    }
  } catch (error) {
    console.error('Error leyendo desde Redis:', error.message);
  }

  // Si no está en caché, obtener de PostgreSQL
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
      });
    }

    // Guardar en Redis para futuras peticiones
    try {
      if (redisClient && redisClient.isReady) {
        await redisClient.set(`user:${userId}`, JSON.stringify(result.rows[0]));
      }
    } catch (error) {
      console.error('Error guardando en Redis:', error.message);
    }

    return res.json({
      source: 'database',
      data: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

// Iniciar servidor solamente cuando se ejecuta directamente
if (require.main === module) {
  app.listen(port, async () => {
    console.log(`Servidor corriendo en puerto ${port}`);
    await connectRedis();
  });
}

module.exports = {
  app,
  pool,
  connectRedis,
  getRedisClient: () => redisClient,
};