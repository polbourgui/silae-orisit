import { generateMagicLinkToken, generateManagerToken, verifyToken } from '../../src/utils/jwt.js';

process.env.JWT_SECRET = 'test_manager_secret';
process.env.JWT_MAGIC_LINK_SECRET = 'test_magic_secret';

describe('generateMagicLinkToken', () => {
  test('génère un token avec les bons champs pour type dispo', () => {
    // Arrange
    const params = { type: 'dispo', extraId: 'e1', siteId: 's1', semaine: '2026-W24' };

    // Act
    const token = generateMagicLinkToken(params);
    const payload = verifyToken(token, process.env.JWT_MAGIC_LINK_SECRET);

    // Assert
    expect(payload.type).toBe('dispo');
    expect(payload.extra_id).toBe('e1');
    expect(payload.site_id).toBe('s1');
    expect(payload.semaine).toBe('2026-W24');
    expect(payload.exp).toBeDefined();
  });

  test('le token dispo expire dans moins de 49h', () => {
    // Arrange
    const params = { type: 'dispo', extraId: 'e1', siteId: 's1', semaine: '2026-W24' };

    // Act
    const token = generateMagicLinkToken(params);
    const payload = verifyToken(token, process.env.JWT_MAGIC_LINK_SECRET);

    // Assert
    const now = Math.floor(Date.now() / 1000);
    const diffH = (payload.exp - now) / 3600;
    expect(diffH).toBeLessThanOrEqual(49);
    expect(diffH).toBeGreaterThan(0);
  });

  test('génère un token contrat avec contrat_id', () => {
    // Arrange
    const params = { type: 'contrat', extraId: 'e2', siteId: 's2', contratId: 'c1' };

    // Act
    const token = generateMagicLinkToken(params);
    const payload = verifyToken(token, process.env.JWT_MAGIC_LINK_SECRET);

    // Assert
    expect(payload.type).toBe('contrat');
    expect(payload.contrat_id).toBe('c1');
  });

  test('deux tokens générés consécutivement sont différents', () => {
    // Arrange
    const params = { type: 'dispo', extraId: 'e1', siteId: 's1', semaine: '2026-W24' };

    // Act
    const token1 = generateMagicLinkToken(params);
    const token2 = generateMagicLinkToken({ ...params, semaine: '2026-W25' });

    // Assert
    expect(token1).not.toBe(token2);
  });

  test('verifyToken lève une erreur sur token falsifié', () => {
    // Arrange
    const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.eyJ0eXBlIjoiZGlzcG8ifQ.invalidsig';

    // Act & Assert
    expect(() => verifyToken(fakeToken, process.env.JWT_MAGIC_LINK_SECRET)).toThrow();
  });
});
