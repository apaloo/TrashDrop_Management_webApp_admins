import { handle } from './handler.ts';

Deno.serve((req: Request) => handle(req, Deno.env.toObject()));
