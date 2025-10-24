import { forwardRef, useState, useEffect } from 'react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { tv } from '../../lib/theme/utils';

export type DateTimeInputSize = 'sm' | 'md' | 'lg';
export type DateTimeInputVariant = 'default' | 'error';

export interface DateTimeInputProps {
  inputSize?: DateTimeInputSize;
  variant?: DateTimeInputVariant;
  error?: string;
  helperText?: string;
  label?: string;
  optional?: boolean;
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * DateTimeInput variant styles using semantic tokens.
 * Replaces verbose dark: classes with clean semantic tokens.
 */
const dateTimeInputStyles = tv({
  base: [
    // Base layout and transitions
    'w-full rounded-lg border transition-colors',
    // Background and text colors using semantic tokens
    'surface-base text-content-primary',
    // Focus states
    'focus:outline-none focus:ring-2 focus:ring-interactive-primary',
    // Disabled state
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
  variants: {
    variant: {
      default: 'border-theme-default focus:border-interactive-primary',
      error: 'border-semantic-danger focus:border-semantic-danger focus:ring-semantic-danger',
    },
    inputSize: {
      sm: 'px-2 py-1 text-sm',
      md: 'px-3 py-2 text-base',
      lg: 'px-4 py-3 text-lg',
    },
  },
  defaultVariants: {
    variant: 'default',
    inputSize: 'md',
  },
});

/**
 * DateTimeInput - Enhanced datetime picker with calendar popup and time selection
 *
 * Uses react-datepicker for better UX:
 * - Calendar popup for date selection
 * - Integrated time picker
 * - Consistent UI across all browsers
 * - Better accessibility
 *
 * @example
 * ```tsx
 * <DateTimeInput
 *   label="Start Date"
 *   value={startDate}
 *   onChange={(e) => setStartDate(e.target.value)}
 * />
 *
 * <DateTimeInput
 *   label="End Date"
 *   optional
 *   variant="error"
 *   error="End date must be after start date"
 * />
 * ```
 */
export const DateTimeInput = forwardRef<HTMLInputElement, DateTimeInputProps>(
  (
    {
      inputSize = 'md',
      variant = 'default',
      error,
      helperText,
      label,
      optional = false,
      className,
      id,
      value,
      onChange,
      disabled,
      placeholder,
      ...props
    },
    _ref
  ) => {
    const inputId = id || props.name;
    const showError = variant === 'error' || error;

    // Convert string value to Date object for react-datepicker
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    useEffect(() => {
      if (value) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          setSelectedDate(date);
        }
      } else {
        setSelectedDate(null);
      }
    }, [value]);

    const handleDateChange = (date: Date | null) => {
      setSelectedDate(date);
      if (onChange) {
        // Convert Date to datetime-local string format (YYYY-MM-DDTHH:mm)
        // WITHOUT timezone conversion (preserve local time)
        let dateString = '';
        if (date) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          dateString = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
        onChange({ target: { value: dateString } });
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-content-primary mb-2"
          >
            {label}
            {optional && (
              <span className="ml-1 text-sm font-normal text-content-tertiary">
                (optional)
              </span>
            )}
          </label>
        )}
        <ReactDatePicker
          id={inputId}
          selected={selectedDate}
          onChange={handleDateChange}
          showTimeSelect
          timeFormat="HH:mm"
          timeIntervals={15}
          timeCaption="Time"
          dateFormat="MMMM d, yyyy h:mm aa"
          placeholderText={placeholder || "Select date and time"}
          disabled={disabled}
          className={dateTimeInputStyles({
            variant: showError ? 'error' : 'default',
            inputSize,
            className,
          })}
          wrapperClassName="w-full"
        />
        {error && (
          <p className="mt-1 text-sm text-semantic-danger">{error}</p>
        )}
        {!error && helperText && (
          <p className="mt-1 text-sm text-content-secondary">{helperText}</p>
        )}
      </div>
    );
  }
);

DateTimeInput.displayName = 'DateTimeInput';
