import { jest } from '@jest/globals';

process.env.JWT_SECRET = 'test_jwt_secret_32chars_minimum!!';
process.env.JWT_MAGIC_LINK_SECRET = 'test_magic_secret_32chars_minimum';
process.env.NODE_ENV = 'test';

const { generateMagicLinkToken, verifyToken, generateManagerToken } = await import('../../src/utils/jwt.js');
const { InvalidTokenError } = await import('../../src/errors/index.js');

describe('generateMagicLinkToken', () => {
  test('generates a dispo token with correct payload', () => {
    // Arrange
    const params = { type: 'dispo', extraId: 'uuid-extra-1', siteId: 'uuid-site-1', semaine: '2026-W24' };

    // Act
    const token = generateMagicLinkToken(params);

    // Assert
    const payload = verifyToken(token, process.env.JWT_MAGIC_LINK_SECRET);
    expect(payload.type).toBe('dispo');
    expect(payload.extra_id).toBe('uuid-extra-1');
    expect(payload.site_id).toBe('uuid-site-1');
    expect(payload.semaine).toBe('2026-W24');
  });

  test('generates a contrat token with correct payload', () => {
    // Arrange
    const params = { type: 'contrat', extraId: 'uuid-extra-2', siteId: 'uuid-site-2', contratId: 'uuid-contrat-1' };

    // Act
    const token = generateMagicLinkToken(params);

    // Assert
    const payload = verifyToken(token, process.env.JWT_MAGIC_LINK_SECRET);
    expect(payload.type).toBe('contrat');
    expect(payload.contrat_id).toBe('uuid-contrat-1');
  });

  test('two tokens for same extra are different (unique due to iat)', () => {
    // Arrange
    const params = { type: 'dispo', extraId: 'uuid-extra-1', siteId: 'uuid-site-1', semaine: '2026-W24' };

    // Act
    const token1 = generateMagicLinkToken(params);
    const token2 = generateMagicLinkToken(params);

    // Assert
    expect(token1).not.toBe(token2);
  });

  test('dispo token expires in ~48h', () => {
    // Arrange
    const params = { type: 'dispo', extraId: 'uuid-extra-1', siteId: 'uuid-site-1', semaine: '2026-W24' };

    // Act
    const token = generateMagicLinkToken(params);
    const payload = verifyToken(token, process.env.JWT_MAGIC_LINK_SECRET);

    // Assert
    const expectedExp = Math.floor(Date.now() / 1000) + 48 * 3600;
    expect(Math.abs(payload.exp - expectedExp)).toBeLessThan(5);
  });

  test('contrat token expires in ~7 days', () => {
    // Arrange
    const params = { type: 'contrat', extraId: 'e1', siteId: 's1', contratId: 'c1' };

    // Act
    const token = generateMagicLinkToken(params);
    const payload = verifyToken(token, process.env.JWT_MAGIC_LINK_SECRET);

    // Assert
    const expectedExp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    expect(Math.abs(payload.exp - expectedExp)).toBeLessThan(5);
  });
});

describe('verifyToken', () => {
  test('throws InvalidTokenError for invalid token', () => {
    // Arrange
    const badToken = 'not.a.valid.token';

    // Act & Assert
    expect(() => verifyToken(badToken, process.env.JWT_MAGIC_LINK_SECRET)).toThrow(InvalidTokenError);
  });

  test('throws InvalidTokenError for wrong secret', () => {
    // Arrange
    const token = generateMagicLinkToken({ type: 'dispo', extraId: 'e1', siteId: 's1', semaine: '2026-W01' });

    // Act & Assert
    expect(() => verifyToken(token, 'wrong_secret')).toThrow(InvalidTokenError);
  });
});
