package auth

import "testing"

func TestIsSpammyUsername(t *testing.T) {
	tests := []struct {
		name     string
		username string
		spammy   bool
	}{
		// Pharma spam.
		{"viagra", "buyviagra", true},
		{"cialis", "cialis_deals", true},

		// Gambling and crypto spam, whole-word.
		{"casino", "best casino", true},
		{"poker", "free poker", true},
		{"btc", "free btc now", true},
		{"eth", "cheap eth", true},

		// SEO spam.
		{"seo", "cheap seo", true},
		{"backlinks", "buy backlinks", true},

		// Structural: shapes no deliberate username produces. The digit
		// threshold is 10+, so a machine-generated handle trips it but an
		// ordinary name with digits does not.
		{"timestamp suffix", "user1757308800123", true},
		{"epoch handle", "bot1699999999", true},
		{"repeated char", "aaaaaaaa", true},
		{"repeated char mid", "spaaaaaaam", true},

		// Separator normalization: RE2 counts "_" as a word character, so
		// without normalizing these the \b-anchored patterns miss the most
		// common spam shape.
		{"underscore separated btc", "Free_BTC_Now", true},
		{"underscore separated seo", "cheap_seo_services", true},
		{"hyphen separated", "buy-backlinks-now", true},
		{"dot separated", "best.casino.online", true},

		// Case insensitivity.
		{"uppercase", "BUYVIAGRA", true},
		{"mixed case", "Free_BTC_Now", true},

		// --- Must NOT be flagged. These are the false positives that the
		// removed pkg/botprevention patterns would have blocked, and a false
		// positive here has no appeal path. ---
		{"cryptographer", "cryptographer", false},
		{"cryptography fan", "cryptography_fan", false},
		{"marketing student", "marketingstudent", false},
		{"sysadmin", "sysadmin_dave", false},
		{"admin substring", "badminton", false},
		{"seo substring", "seoul_tiger", false},
		{"eth substring", "bethany", false},
		{"eth substring 2", "ethan_hunt", false},
		{"btc substring", "objction", false},
		{"casino substring", "casinovsky", false},
		{"poker substring", "pokerface_fan", false},

		// Ambiguous tokens standing alone. Separator normalization makes each
		// part its own word, so these all match a \b-anchored token pattern --
		// and blocking them would be an unrecoverable false positive on very
		// ordinary names. They only count alongside a commercial spam signal.
		{"korean given name", "Seo_Yeon", false},
		{"korean given name hyphen", "seo-jun", false},
		{"korean given name trailing", "min-seo", false},
		{"eth as a name part", "eth_dev", false},
		{"eth as a name part hyphen", "Eth-Hunt", false},
		{"poker as a name part", "poker-face", false},
		{"btc as a name part", "btc_notes", false},
		{"signal word alone", "free_spirit", false},
		{"signal word alone 2", "best_dave", false},
		{"signal substring is not a signal", "freeman_seo_yeon", false},

		// The same tokens with a spam signal alongside are the real thing.
		{"signal plus seo", "cheap-seo-jun", true},
		{"signal plus eth", "buy_eth_now", true},
		{"signal plus poker", "best-poker-face", true},

		// Ordinary names with digits are fine; only a 10+ run is structural.
		// These are the false positives a 6-digit threshold would produce.
		{"few digits", "player12345", false},
		{"six digits", "gamer123456", false},
		{"birth date", "dave19870204", false},
		{"year suffix", "gamer2026", false},
		{"short repeat", "aaaa_bbb", false},
		{"five repeats", "aaaaa", false},

		// Plain names.
		{"simple", "alice", false},
		{"underscored", "bob_the_builder", false},
		{"hyphenated", "jean-luc", false},
		{"empty", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsSpammyUsername(tt.username); got != tt.spammy {
				t.Errorf("IsSpammyUsername(%q) = %v, want %v", tt.username, got, tt.spammy)
			}
		})
	}
}
