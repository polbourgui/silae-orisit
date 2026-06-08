import express from 'express';
import request from 'supertest';
import { generateManagerToken } from '../../src/utils/jwt.js';
import { requireManagerAuth } from '../../src/middleware/auth.js';
import siteScope from '../../src/middleware/siteScope.js';
import errorHandler from '../../src/middleware/errorHandler.js';

process.env.JWT_SECRET = 'test_manager_secret';
process.env.JWT_MAGIC_LINK_SECRET = 'test_magic_secret';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.get('/resource', requireManagerAuth, siteScope, (req, res) => {
    res.json({ ok: true, siteId: req.siteId });
  });
  app.use(errorHandler);
  return app;
}

describe('siteScope middleware', () => {
  test('autorise l\'accès avec un JWT valide et retourne le siteId', async () => {
    // Arrange
    const token = generateManagerToken({ manager_id: 'm1', site_id: 's1', role: 'manager' });
    const app = buildApp();

    // Act
    const res = await request(app)
      .get('/resource')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.siteId).toBe('s1');
  });

  test('retourne 401 sans token', async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await request(app).get('/resource');

    // Assert
    expect(res.status).toBe(401);
  });

  test('retourne 401 avec un token invalide', async () => {
    // Arrange
    const app = buildApp();

    // Act
    const res = await request(app)
      .get('/resource')
      .set('Authorization', 'Bearer token.invalide.ici');

    // Assert
    expect(res.status).toBe(401);
  });

  test('le siteId provient du JWT, jamais du body', async () => {
    // Arrange — le client envoie un site_id différent dans le body
    const token = generateManagerToken({ manager_id: 'm1', site_id: 's1', role: 'manager' });
    const app = express();
    app.use(express.json());
    app.post('/resource', requireManagerAuth, siteScope, (req, res) => {
      res.json({ ok: true, siteId: req.siteId });
    });
    app.use(errorHandler);

    // Act
    const res = await request(app)
      .post('/resource')
      .set('Authorization', `Bearer ${token}`)
      .send({ site_id: 's_malveillant' });

    // Assert — le siteId retourné est celui du JWT, pas celui du body
    expect(res.body.siteId).toBe('s1');
    expect(res.body.siteId).not.toBe('s_malveillant');
  });
});
