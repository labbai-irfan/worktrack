import { Request } from 'express';

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
  sort: Record<string, 1 | -1>;
}

export function getPagination(req: Request, defaultSort = '-createdAt', maxLimit = 100): Pagination {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  const sortParam = String(req.query.sort ?? defaultSort);
  const sort: Record<string, 1 | -1> = {};
  for (const part of sortParam.split(',').filter(Boolean)) {
    if (part.startsWith('-')) sort[part.slice(1)] = -1;
    else sort[part] = 1;
  }
  return { page, limit, skip: (page - 1) * limit, sort };
}

export function pageMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
