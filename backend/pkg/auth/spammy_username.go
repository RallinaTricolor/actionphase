package auth

import (
	"regexp"
	"strings"
)

// spammyUsernamePatterns matches usernames used by spam registrations.
//
// These are deliberately narrower than the patterns in the removed
// pkg/botprevention package. That set matched bare "crypto", "marketing" and
// "admin" as substrings, which also blocks cryptographer, marketingstudent and
// sysadmin_dave -- and a false positive here is unrecoverable for the user,
// since registration is the only path in and there is no appeal flow. What
// survives is either a whole word (\b-anchored) or structural.
//
// Structural patterns catch the generated-account shapes that no deliberate
// name produces: ten or more consecutive digits, or a character repeated six
// or more times.
var spammyUsernamePatterns = []*regexp.Regexp{
	// Pharma spam -- distinctive enough as substrings.
	regexp.MustCompile(`viagra`),
	regexp.MustCompile(`cialis`),

	// Gambling spam, whole-word so "casinovsky" style surnames survive.
	regexp.MustCompile(`\bcasino\b`),

	// SEO spam, whole-word. "backlinks" has no innocent reading; the bare
	// "seo" does, so it lives in ambiguousSpamTokens instead.
	regexp.MustCompile(`\bbacklinks?\b`),

	// Structural: generated-account shapes.
	//
	// The digit run is 10+, not the 6 the removed pkg/botprevention package
	// used. Six digits is an ordinary thing for a person to put in a name
	// (gamer123456, a birth date, a jersey number), and blocking it is
	// unrecoverable for that user -- registration is the only way in and there
	// is no appeal flow. Ten or more consecutive digits is the shape of a
	// machine-generated handle: a timestamp, an epoch, a random ID.
	regexp.MustCompile(`\d{10,}`),
}

// ambiguousSpamTokens are spam words that are also ordinary name components,
// so a whole-word match alone is not enough to block on.
//
// Separator normalization (see separatorReplacer) makes \b-anchored patterns
// see each underscore- or hyphen-delimited part as its own word. That is what
// lets "Free_BTC_Now" match \bbtc\b -- but it equally makes "Seo_Yeon",
// "seo-jun" and "min-seo" match \bseo\b, and Seo is a very common Korean given
// name. Likewise "eth_dev" and "Eth-Hunt" match \beth\b, and "poker-face"
// matches \bpoker\b.
//
// Blocking those is exactly the unrecoverable false positive this file exists
// to avoid, so these tokens only count when the username also carries a
// commercial spam signal (see spamSignalPattern). Real spam handles pair them:
// "Free_BTC_Now", "cheap_seo_services", "buy-eth-cheap". A person's name does
// not.
var ambiguousSpamTokens = []*regexp.Regexp{
	regexp.MustCompile(`\bbtc\b`),
	regexp.MustCompile(`\beth\b`),
	regexp.MustCompile(`\bseo\b`),
	regexp.MustCompile(`\bpoker\b`),
}

// spamSignalPattern matches the commercial come-on that accompanies an
// ambiguous token in a real spam handle. These are whole words too, so
// "freeman", "buyer" and "cheapside" do not count as signals.
var spamSignalPattern = regexp.MustCompile(`\b(free|buy|cheap|sell|discount|best|deals?|promo|offer|win|earn|profit|invest|bonus)\b`)

// repeatedCharRun is the threshold for "the same character six or more times
// in a row", which the regex patterns cannot express: Go's regexp is RE2, and
// RE2 has no backreferences, so the `(.)\1{5,}` form used by the removed
// pkg/botprevention package does not compile -- it panics at init. Counting a
// run directly is both correct and cheaper.
const repeatedCharRun = 6

// hasRepeatedCharRun reports whether s contains the same character repeated
// repeatedCharRun or more times consecutively.
func hasRepeatedCharRun(s string) bool {
	run := 0
	var prev rune
	for i, r := range s {
		if i > 0 && r == prev {
			run++
			if run >= repeatedCharRun {
				return true
			}
			continue
		}
		prev = r
		run = 1
	}
	return false
}

// separatorReplacer maps the separators usernames are built from to spaces.
//
// RE2 counts "_" as a word character, so \bbtc\b does not match "Free_BTC_Now"
// -- the exact shape this check exists to catch. Normalizing separators to
// spaces first makes the word-boundary patterns work across all of them,
// without widening them into substring matches that would catch "bethany".
var separatorReplacer = strings.NewReplacer("_", " ", "-", " ", ".", " ")

// IsSpammyUsername reports whether a username matches a known spam pattern.
//
// Matching is case-insensitive, and separators are normalized to spaces so
// word-anchored patterns apply to "buy_btc" as well as "buy btc". The
// repeated-character check runs against the original (lowercased) form, since
// a run of underscores is itself a signal.
func IsSpammyUsername(username string) bool {
	lower := strings.ToLower(username)
	normalized := separatorReplacer.Replace(lower)

	for _, pattern := range spammyUsernamePatterns {
		if pattern.MatchString(normalized) {
			return true
		}
	}

	// Ambiguous tokens need a commercial spam signal alongside them -- see
	// ambiguousSpamTokens.
	if spamSignalPattern.MatchString(normalized) {
		for _, pattern := range ambiguousSpamTokens {
			if pattern.MatchString(normalized) {
				return true
			}
		}
	}

	return hasRepeatedCharRun(lower)
}
