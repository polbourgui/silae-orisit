import { jest } from '@jest/globals';

process.env.JWT_SECRET = 'test_jwt_secret_32chars_minimum!!';
process.env.JWT_MAGIC_LINK_SECRET = 'test_magic_secret_32chars_minimum';
process.env.NODE_ENV = 'test';

const siteScope = (await import('../../src/middleware/siteScope.js')).default;
const { ForbiddenError } = await import('../../src/errors/index.js');

function makeReq(opts = {}) {
  return {
    manager: opts.manager ?? null,
    body: opts.body ?? {},
    params: opts.params ?? {},
  };
}

function makeRes() {
  return {};
}

describe('siteScope middleware', () => {
  test('attaches req.siteId from JWT and calls next', () => {
    // Arrange
    const req = makeReq({ manager: { site_id: 'site-abc', manager_id: 'm1', role: 'manager' } });
    const res = makeRes();
    const next = jest.fn();

    // Act
    siteScope(req, res, next);

    // Assert
    expect(req.siteId).toBe('site-abc');
    expect(next).toHaveBeenCalledWith();
  });

  test('calls next with ForbiddenError when body.site_id differs from JWT site_id', () => {
    // Arrange
    const req = makeReq({
      manager: { site_id: 'site-abc', manager_id: 'm1', role: 'manager' },
      body: { site_id: 'site-xyz' },
    });
    const res = makeRes();
    const next = jest.fn();

    // Act
    siteScope(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  test('calls next with ForbiddenError when params.site_id differs from JWT site_id', () => {
    // Arrange
    const req = makeReq({
      manager: { site_id: 'site-abc', manager_id: 'm1', role: 'manager' },
      params: { site_id: 'site-xyz' },
    });
    const res = makeRes();
    const next = jest.fn();

    // Act
    siteScope(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  test('calls next with ForbiddenError when manager is missing', () => {
    // Arrange
    const req = makeReq({ manager: null });
    const res = makeRes();
    const next = jest.fn();

    // Act
    siteScope(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  test('allows matching body.site_id', () => {
    // Arrange
    const req = makeReq({
      manager: { site_id: 'site-abc', manager_id: 'm1', role: 'manager' },
      body: { site_id: 'site-abc' },
    });
    const res = makeRes();
    const next = jest.fn();

    // Act
    siteScope(req, res, next);

    // Assert
    expect(req.siteId).toBe('site-abc');
    expect(next).toHaveBeenCalledWith();
  });
});
