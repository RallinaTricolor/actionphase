package core

import (
	"encoding/json"
	"testing"
	"time"
)

func TestLocalDateTime_UnmarshalJSON(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		wantErr  bool
	}{
		{
			name:     "HTML datetime-local format",
			input:    `"2025-08-31T12:00"`,
			expected: "2025-08-31T12:00:00Z",
			wantErr:  false,
		},
		{
			name:     "HTML datetime-local with seconds",
			input:    `"2025-08-31T12:30:45"`,
			expected: "2025-08-31T12:30:45Z",
			wantErr:  false,
		},
		{
			name:     "RFC3339 format",
			input:    `"2025-08-31T12:00:00Z"`,
			expected: "2025-08-31T12:00:00Z",
			wantErr:  false,
		},
		{
			name:     "RFC3339 with timezone",
			input:    `"2025-08-31T12:00:00-07:00"`,
			expected: "2025-08-31T19:00:00Z",
			wantErr:  false,
		},
		{
			name:    "invalid format",
			input:   `"invalid-date"`,
			wantErr: true,
		},
		{
			name:     "null value",
			input:    `null`,
			expected: "0001-01-01T00:00:00Z",
			wantErr:  false,
		},
		{
			name:     "empty string",
			input:    `""`,
			expected: "0001-01-01T00:00:00Z",
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var ldt LocalDateTime
			err := json.Unmarshal([]byte(tt.input), &ldt)

			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}

			if tt.expected != "" {
				actual := ldt.Time.UTC().Format(time.RFC3339)
				if actual != tt.expected {
					t.Errorf("expected %s, got %s", tt.expected, actual)
				}
			}
		})
	}
}

func TestLocalDateTime_MarshalJSON(t *testing.T) {
	tests := []struct {
		name     string
		dateTime LocalDateTime
		expected string
	}{
		{
			name:     "valid time",
			dateTime: LocalDateTime{time.Date(2025, 8, 31, 12, 0, 0, 0, time.UTC)},
			expected: `"2025-08-31T12:00:00Z"`,
		},
		{
			name:     "zero time",
			dateTime: LocalDateTime{},
			expected: `null`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := json.Marshal(tt.dateTime)
			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}

			if string(result) != tt.expected {
				t.Errorf("expected %s, got %s", tt.expected, string(result))
			}
		})
	}
}

func TestLocalDateTime_ToTimePtr(t *testing.T) {
	tests := []struct {
		name     string
		dateTime *LocalDateTime
		isNil    bool
	}{
		{
			name:     "valid time",
			dateTime: &LocalDateTime{time.Date(2025, 8, 31, 12, 0, 0, 0, time.UTC)},
			isNil:    false,
		},
		{
			name:     "zero time",
			dateTime: &LocalDateTime{},
			isNil:    true,
		},
		{
			name:     "nil datetime",
			dateTime: nil,
			isNil:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.dateTime.ToTimePtr()

			if tt.isNil {
				if result != nil {
					t.Errorf("expected nil, got %v", result)
				}
			} else {
				if result == nil {
					t.Errorf("expected non-nil, got nil")
				}
			}
		})
	}
}
