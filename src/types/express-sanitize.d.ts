declare module 'express-sanitize' {
  import { RequestHandler } from 'express';
  
  interface SanitizeOptions {
    replaceWith?: string;
  }
  
  function sanitize(options?: SanitizeOptions): RequestHandler;
  
  export = sanitize;
}
