export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function parsePagination(query: any): PaginationParams {
  const page = Math.max(1, parseInt(query?.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query?.limit as string, 10) || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export function formatPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / params.limit) || 1;
  return {
    data,
    pagination: {
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPrevPage: params.page > 1,
    },
  };
}
