import { createHash } from 'node:crypto';
import 'dotenv/config';

function deriveToken(secret: string): string {
  return createHash('sha256')
    .update(secret + 'reindex-webhook-salt')
    .digest('hex');
}

const secret = process.env.AUTH_JWT_SECRET;

if (!secret) {
  console.error('Error: AUTH_JWT_SECRET not found in .env');
  process.exit(1);
}

const token = deriveToken(secret);
console.log('Derived WEBHOOK_TOKEN:');
console.log(token);
