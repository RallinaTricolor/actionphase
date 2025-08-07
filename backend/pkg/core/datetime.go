package core

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// LocalDateTime is a custom time type that can handle both RFC3339 and HTML datetime-local formats
type LocalDateTime struct {
	time.Time
}

// UnmarshalJSON implements json.Unmarshaler to handle multiple datetime formats
func (ldt *LocalDateTime) UnmarshalJSON(data []byte) error {
	// Remove quotes from JSON string
	s := strings.Trim(string(data), `"`)

	if s == "null" || s == "" {
		return nil
	}

	// Try multiple formats in order of preference
	formats := []string{
		time.RFC3339,           // "2006-01-02T15:04:05Z07:00"
		"2006-01-02T15:04:05Z", // "2006-01-02T15:04:05Z"
		"2006-01-02T15:04:05",  // "2006-01-02T15:04:05"
		"2006-01-02T15:04",     // "2006-01-02T15:04" (datetime-local format)
		"2006-01-02 15:04:05",  // "2006-01-02 15:04:05"
		"2006-01-02 15:04",     // "2006-01-02 15:04"
		"2006-01-02",           // "2006-01-02"
	}

	var err error
	for _, format := range formats {
		ldt.Time, err = time.Parse(format, s)
		if err == nil {
			// If we parsed a datetime-local format (no timezone), assume local timezone
			if format == "2006-01-02T15:04" || format == "2006-01-02T15:04:05" ||
				format == "2006-01-02 15:04" || format == "2006-01-02 15:04:05" {
				ldt.Time = ldt.Time.Local()
			}
			return nil
		}
	}

	return fmt.Errorf("unable to parse datetime: %s", s)
}

// MarshalJSON implements json.Marshaler to output in RFC3339 format
func (ldt LocalDateTime) MarshalJSON() ([]byte, error) {
	if ldt.Time.IsZero() {
		return []byte("null"), nil
	}
	return json.Marshal(ldt.Time.Format(time.RFC3339))
}

// ToTimePtr converts LocalDateTime to *time.Time for database operations
func (ldt *LocalDateTime) ToTimePtr() *time.Time {
	if ldt == nil || ldt.Time.IsZero() {
		return nil
	}
	return &ldt.Time
}
