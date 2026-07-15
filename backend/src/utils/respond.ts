import { Response } from 'express';

interface Meta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export function ok(res: Response, data: unknown, message = 'OK', meta: Meta = {}, status = 200) {
  return res.status(status).json({ success: true, message, data, meta });
}

export function created(res: Response, data: unknown, message = 'Created successfully.') {
  return ok(res, data, message, {}, 201);
}
