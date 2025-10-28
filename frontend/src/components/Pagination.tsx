import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/Button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isLoading?: boolean;
}

/**
 * Pagination component with page navigation and optional page size selector
 *
 * Features:
 * - Previous/Next navigation
 * - Direct page number navigation with smart ellipsis
 * - Optional page size selector
 * - Responsive design with semantic tokens
 *
 * @example
 * ```tsx
 * <Pagination
 *   currentPage={metadata.page}
 *   totalPages={metadata.total_pages}
 *   pageSize={metadata.page_size}
 *   hasNextPage={metadata.has_next_page}
 *   hasPreviousPage={metadata.has_previous_page}
 *   onPageChange={setPage}
 *   onPageSizeChange={setPageSize}
 * />
 * ```
 */
export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  hasNextPage,
  hasPreviousPage,
  isLoading = false,
}: PaginationProps) {
  // Generate page numbers to display with ellipsis logic
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage <= 3) {
        // Near the start: 1 2 3 4 ... last
        pages.push(2, 3, 4, 'ellipsis', totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near the end: 1 ... last-3 last-2 last-1 last
        pages.push('ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        // In the middle: 1 ... current-1 current current+1 ... last
        pages.push('ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages);
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav
      className="flex items-center justify-between gap-4 px-4 py-3 surface-raised border-t border-theme-default"
      aria-label="Pagination"
    >
      {/* Page info and size selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-content-secondary">
          Page {currentPage} of {totalPages}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="text-sm text-content-secondary">
              Per page:
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={isLoading}
              className="px-2 py-1 text-sm rounded border border-theme-default surface-raised text-content-primary focus:outline-none focus:ring-2 focus:ring-interactive-primary"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        {/* Previous button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPreviousPage || isLoading}
          aria-label="Previous page"
          icon={<ChevronLeft className="w-4 h-4" />}
        >
          Previous
        </Button>

        {/* Page number buttons */}
        <div className="hidden sm:flex items-center gap-1">
          {pageNumbers.map((page, index) => {
            if (page === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 py-1 text-content-secondary"
                >
                  ...
                </span>
              );
            }

            const isCurrentPage = page === currentPage;

            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                disabled={isLoading || isCurrentPage}
                aria-label={`Go to page ${page}`}
                aria-current={isCurrentPage ? 'page' : undefined}
                className={`
                  px-3 py-1 text-sm rounded transition-colors
                  focus:outline-none focus:ring-2 focus:ring-interactive-primary
                  ${
                    isCurrentPage
                      ? 'bg-interactive-primary text-content-inverse font-semibold'
                      : 'surface-raised hover:surface-overlay text-content-primary'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Next button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNextPage || isLoading}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </nav>
  );
}
