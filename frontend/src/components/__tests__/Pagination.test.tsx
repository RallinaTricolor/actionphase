import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from '../Pagination';

describe('Pagination', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 5,
    pageSize: 20,
    hasNextPage: true,
    hasPreviousPage: false,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
  };

  it('renders current page information', () => {
    render(<Pagination {...defaultProps} />);

    expect(screen.getByText('Page 1 of 5')).toBeInTheDocument();
  });

  it('disables Previous button when on first page', () => {
    render(<Pagination {...defaultProps} />);

    const previousButton = screen.getByRole('button', { name: /previous/i });
    expect(previousButton).toBeDisabled();
  });

  it('enables Previous button when not on first page', () => {
    render(<Pagination {...defaultProps} currentPage={2} hasPreviousPage={true} />);

    const previousButton = screen.getByRole('button', { name: /previous/i });
    expect(previousButton).not.toBeDisabled();
  });

  it('disables Next button when on last page', () => {
    render(<Pagination {...defaultProps} currentPage={5} hasNextPage={false} />);

    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();
  });

  it('enables Next button when not on last page', () => {
    render(<Pagination {...defaultProps} />);

    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).not.toBeDisabled();
  });

  it('calls onPageChange when clicking Next button', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} onPageChange={onPageChange} />);

    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange when clicking Previous button', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} currentPage={3} hasPreviousPage={true} onPageChange={onPageChange} />);

    const previousButton = screen.getByRole('button', { name: /previous/i });
    await user.click(previousButton);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('renders page number buttons', () => {
    render(<Pagination {...defaultProps} />);

    // Should show page 1, 2, 3, 4, ellipsis, 5
    expect(screen.getByRole('button', { name: 'Go to page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to page 2' })).toBeInTheDocument();
  });

  it('highlights current page number', () => {
    render(<Pagination {...defaultProps} currentPage={2} />);

    const page2Button = screen.getByRole('button', { name: 'Go to page 2' });
    expect(page2Button).toHaveAttribute('aria-current', 'page');
    expect(page2Button).toBeDisabled();
  });

  it('calls onPageChange when clicking a page number', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} onPageChange={onPageChange} />);

    const page3Button = screen.getByRole('button', { name: 'Go to page 3' });
    await user.click(page3Button);

    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('renders page size selector when onPageSizeChange is provided', () => {
    render(<Pagination {...defaultProps} />);

    expect(screen.getByRole('combobox', { name: /per page/i })).toBeInTheDocument();
  });

  it('calls onPageSizeChange when changing page size', async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    render(<Pagination {...defaultProps} onPageSizeChange={onPageSizeChange} />);

    const select = screen.getByRole('combobox', { name: /per page/i });
    await user.selectOptions(select, '50');

    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it('shows ellipsis for large page counts', () => {
    render(<Pagination {...defaultProps} currentPage={10} totalPages={20} />);

    // Should show ellipsis between page ranges (there will be 2 - before and after)
    const ellipses = screen.getAllByText('...');
    expect(ellipses.length).toBeGreaterThan(0);
  });

  it('disables all buttons when loading', () => {
    render(<Pagination {...defaultProps} isLoading={true} />);

    const previousButton = screen.getByRole('button', { name: /previous/i });
    const nextButton = screen.getByRole('button', { name: /next/i });

    expect(previousButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });
});
