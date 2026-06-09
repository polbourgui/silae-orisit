import 'dotenv/config';

// Sur Render, l'URL publique est fournie via RENDER_EXTERNAL_URL
if (!process.env.APP_BASE_URL && process.env.RENDER_EXTERNAL_URL) {
  process.env.APP_BASE_URL = process.env.RENDER_EXTERNAL_URL;
}

if (process.env.NODE_ENV === 'production' && !process.env.APP_BASE_URL) {
  throw new Error('APP_BASE_URL must be set in production');
}
