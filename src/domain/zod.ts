import { z } from 'zod';

/**
 * The one place the app imports zod from. Jitless mode makes zod validate with its interpreter
 * instead of compiling parsers with `new Function`, so the app runs under a strict Content
 * Security Policy (`script-src 'self'`, no 'unsafe-eval') without a single violation report.
 * Object schemas read this flag when they are built, so it is set before any schema exists.
 */
z.config({ jitless: true });

export { z };
