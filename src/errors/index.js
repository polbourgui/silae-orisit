export class InvalidTokenError extends Error {
  constructor(message = 'Token invalide ou expiré') {
    super(message);
    this.name = 'InvalidTokenError';
    this.statusCode = 401;
  }
}

export class SilaeApiError extends Error {
  constructor(message = 'Erreur API Silae') {
    super(message);
    this.name = 'SilaeApiError';
    this.statusCode = 502;
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Ressource introuvable') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Accès refusé') {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

export class ValidationError extends Error {
  constructor(message = 'Données invalides') {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}
