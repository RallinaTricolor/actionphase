package auth

import (
	"strings"

	"github.com/lindell/go-burner-email-providers/burner"
)

// reservedDomains are never real signups and are never treated as disposable.
//
// These are the RFC 2606 / RFC 6761 reserved names. The upstream burner list
// includes example.com -- correctly, in that no mail can reach it, but that is
// "not a deliverable address", not "a throwaway inbox service". Blocking it
// buys no spam protection (a bot needs an inbox it can actually read) while
// breaking every fixture and test in this repo that uses example.com, which is
// the domain RFC 2606 reserves for exactly that purpose.
//
// Rejecting an undeliverable address is address validation's job, not the
// burner check's.
var reservedDomains = map[string]bool{
	"example.com": true,
	"example.org": true,
	"example.net": true,
	"localhost":   true,
}

// reservedTLDs mirrors reservedDomains for the reserved suffixes, which are
// reserved at any depth (foo.test, mail.foo.invalid).
var reservedTLDs = []string{".test", ".example", ".invalid", ".localhost"}

// isReservedDomain reports whether domain is reserved by RFC 2606 / RFC 6761.
func isReservedDomain(domain string) bool {
	if reservedDomains[domain] {
		return true
	}
	for _, suffix := range reservedTLDs {
		if strings.HasSuffix(domain, suffix) {
			return true
		}
	}
	return false
}

// IsDisposableEmail reports whether an email belongs to a known disposable /
// burner provider.
//
// The domain data comes from github.com/lindell/go-burner-email-providers,
// which compiles ~27k domains in as a generated map -- there is no runtime
// network call, and refreshing the list is a `go get -u` reviewed like any
// other dependency bump.
//
// Two things that library does not do, which this wrapper must:
//
//   - Case. Its lookup is a bare map hit against an all-lowercase list, so
//     IsBurnerDomain("MAILINATOR.COM") is false. Email domains are
//     case-insensitive (RFC 5321), so skipping this normalization would make
//     the whole check bypassable with one capital letter.
//   - Malformed input. Its IsBurnerEmail returns true for anything without an
//     "@", including "". This parses the domain itself and stays fail-open on
//     unparseable input, matching the previous behavior; address validity is
//     already settled upstream by user.Validate.
//
// The domain is taken from the last "@", not by splitting on it: a quoted
// local-part may legally contain one (RFC 5321 allows `"a@b"@mailinator.com`),
// and requiring exactly one "@" would skip the burner check on those entirely.
func (s *BotPreventionService) IsDisposableEmail(email string) bool {
	at := strings.LastIndex(email, "@")
	if at < 0 {
		return false
	}

	domain := strings.ToLower(strings.TrimSpace(email[at+1:]))
	if domain == "" {
		return false
	}

	// Reserved names are never disposable -- see reservedDomains.
	if isReservedDomain(domain) {
		return false
	}

	// The allowlist wins: the blocklist is maintained upstream, so an operator
	// needs a way to unblock a false positive without waiting on a release.
	if s.disposableAllowlist[domain] {
		return false
	}

	return burner.IsBurnerDomain(domain)
}
