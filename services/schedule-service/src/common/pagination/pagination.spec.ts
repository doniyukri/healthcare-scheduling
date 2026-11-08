import { buildPageInfo, PaginationInput, toSkipTake } from './pagination.js';

describe('pagination', () => {
  it('computes page info for a middle page', () => {
    expect(buildPageInfo(2, 10, 25)).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('computes page info for the last page', () => {
    expect(buildPageInfo(3, 10, 25)).toMatchObject({
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it('reports zero pages for an empty result', () => {
    expect(buildPageInfo(1, 10, 0)).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('does not report a previous page on page one', () => {
    expect(buildPageInfo(1, 5, 50).hasPreviousPage).toBe(false);
  });

  it('converts a page to skip/take', () => {
    const pagination = new PaginationInput();
    pagination.page = 3;
    pagination.limit = 20;

    expect(toSkipTake(pagination)).toEqual({ skip: 40, take: 20 });
  });
});
