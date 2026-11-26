/* The mcw-site Worker. Cloudflare serves public/ as static assets and runs this
   script only for /api/* (wrangler.jsonc → assets.run_worker_first), so the
   pages themselves never cost a Worker invocation.

     GET  /api/sketch   whether Claude and sending are switched on, and the Turnstile site key
     POST /api/sketch   one step of the /start sketch, from Claude (sketch.js)
     POST /api/brief    the finished sketch, sent to Business OS (brief.js)

   Anything else under /api/ falls through to the assets, which answer with
   public/404.html. */

import * as sketch from './sketch.js';
import * as brief from './brief.js';

const ROUTES = {
  '/api/sketch': { GET: sketch.handleGet, POST: sketch.handlePost },
  '/api/brief': { POST: brief.handlePost },
};

export default {
  async fetch(request, env) {
    const route = ROUTES[new URL(request.url).pathname];
    if (!route) return env.ASSETS.fetch(request);
    const handler = route[request.method];
    if (!handler) {
      return new Response('Method not allowed', { status: 405, headers: { allow: Object.keys(route).join(', ') } });
    }
    return handler({ request, env });
  },
};
