package humaconfig

import (
	"regexp"
	"strconv"
	"strings"
	"unicode"

	"github.com/danielgtaylor/huma/v2"
)

// Human-readable validation messages
//
// Huma's schema validator speaks to API clients, not people: a description one
// character short comes back as `detail: "validation failed"` with
// `errors: [{message: "expected length >= 10", location: "body.description"}]`.
// The frontend can only show what it is given, so a GM creating a game saw
// "validation failed" and had no way to tell which field was wrong or why.
//
// humanizeValidation rewrites each detail into a sentence that names the field
// and the rule ("Description must be at least 10 characters"), and replaces the
// generic detail with those sentences. Location and Value are untouched, so a
// client that maps errors onto form fields still can.
//
// The rewrite happens here, in the one hook every huma error passes through,
// rather than per handler: the messages come from struct tags, so there is no
// handler-level place to change them, and doing it once covers every endpoint.

// genericValidationDetail is the detail huma sends for any schema or Resolve
// failure. Only this detail is replaced; one a handler chose is kept.
const genericValidationDetail = "validation failed"

type messageRule struct {
	pattern *regexp.Regexp
	// render builds the message from the field label and the pattern's
	// submatches (match[0] is the whole message).
	render func(label string, match []string) string
}

// messageRules mirror the formats in huma's validation/messages.go. Anything
// unmatched -- including the hand-written messages Resolve hooks return -- is
// passed through with only its leading field name tidied (see humanizeMessage).
var messageRules = []messageRule{
	{regexp.MustCompile(`^expected length >= (\d+)$`), func(label string, m []string) string {
		n, _ := strconv.Atoi(m[1])
		if n <= 1 {
			return label + " is required"
		}
		return label + " must be at least " + m[1] + " characters"
	}},
	{regexp.MustCompile(`^expected length <= (\d+)$`), func(label string, m []string) string {
		return label + " must be at most " + m[1] + " characters"
	}},
	{regexp.MustCompile(`^expected number >= (\S+)$`), func(label string, m []string) string {
		return label + " must be at least " + m[1]
	}},
	{regexp.MustCompile(`^expected number > (\S+)$`), func(label string, m []string) string {
		return label + " must be greater than " + m[1]
	}},
	{regexp.MustCompile(`^expected number <= (\S+)$`), func(label string, m []string) string {
		return label + " must be at most " + m[1]
	}},
	{regexp.MustCompile(`^expected number < (\S+)$`), func(label string, m []string) string {
		return label + " must be less than " + m[1]
	}},
	{regexp.MustCompile(`^expected number to be a multiple of (\S+)$`), func(label string, m []string) string {
		return label + " must be a multiple of " + m[1]
	}},
	{regexp.MustCompile(`^expected array length >= (\d+)$`), func(label string, m []string) string {
		if m[1] == "1" {
			return label + " must have at least 1 item"
		}
		return label + " must have at least " + m[1] + " items"
	}},
	{regexp.MustCompile(`^expected array length <= (\d+)$`), func(label string, m []string) string {
		if m[1] == "1" {
			return label + " must have at most 1 item"
		}
		return label + " must have at most " + m[1] + " items"
	}},
	{regexp.MustCompile(`^expected array items to be unique$`), func(label string, _ []string) string {
		return label + " must not contain duplicates"
	}},
	{regexp.MustCompile(`^expected value to be one of "(.*)"$`), func(label string, m []string) string {
		return label + " must be one of: " + m[1]
	}},
	{regexp.MustCompile(`^expected string to be RFC 5322 email`), func(label string, _ []string) string {
		return label + " must be a valid email address"
	}},
	{regexp.MustCompile(`^expected string to be RFC 3339 date-time$`), func(label string, _ []string) string {
		return label + " must be a valid date and time"
	}},
	{regexp.MustCompile(`^expected string to be RFC 3339 date$`), func(label string, _ []string) string {
		return label + " must be a valid date"
	}},
	{regexp.MustCompile(`^expected string to be RFC 3339 time$`), func(label string, _ []string) string {
		return label + " must be a valid time"
	}},
	{regexp.MustCompile(`^expected string to be RFC 3986 (absolute )?uri`), func(label string, _ []string) string {
		return label + " must be a valid URL"
	}},
	{regexp.MustCompile(`^expected string to match pattern `), func(label string, _ []string) string {
		return label + " is not in a valid format"
	}},
	{regexp.MustCompile(`^expected string to be RFC `), func(label string, _ []string) string {
		return label + " is not in a valid format"
	}},
	// A `patternDescription` tag renders as "expected string to be <description>".
	// Must follow the RFC rules above, which share the prefix.
	{regexp.MustCompile(`^expected string to be (.+)$`), func(label string, m []string) string {
		return label + " must be " + m[1]
	}},
	{regexp.MustCompile(`^expected boolean$`), func(label string, _ []string) string {
		return label + " must be true or false"
	}},
	{regexp.MustCompile(`^expected integer$`), func(label string, _ []string) string {
		return label + " must be a whole number"
	}},
	{regexp.MustCompile(`^expected number$`), func(label string, _ []string) string {
		return label + " must be a number"
	}},
	{regexp.MustCompile(`^expected string$`), func(label string, _ []string) string {
		return label + " must be text"
	}},
	{regexp.MustCompile(`^expected array$`), func(label string, _ []string) string {
		return label + " must be a list"
	}},
	{regexp.MustCompile(`^unexpected property$`), func(label string, _ []string) string {
		return label + " is not a recognised field"
	}},
}

// requiredProperty is handled apart from messageRules: huma reports it at the
// parent object's location ("body"), so the field is named in the message
// rather than the location.
var requiredProperty = regexp.MustCompile(`^expected required property (\S+) to be present$`)

// humanizeValidation rewrites the error details on model in place and, when
// the detail is huma's generic one, replaces it with a summary of them.
func humanizeValidation(model *huma.ErrorModel) {
	if len(model.Errors) == 0 {
		return
	}

	var summary []string
	seen := map[string]bool{}
	for _, d := range model.Errors {
		if d == nil {
			continue
		}
		// Huma reports a missing property at its parent ("body"), naming it only
		// in the message. Once the message is a sentence, the JSON name would
		// be lost, so point the location at the property itself: that is what
		// a client mapping errors onto form fields needs.
		if m := requiredProperty.FindStringSubmatch(strings.TrimSpace(d.Message)); m != nil {
			d.Location = d.Location + "." + m[1]
		}
		d.Message = humanizeMessage(d.Location, d.Message)

		// One sentence per field in the summary. Schema validation and a
		// Resolve hook can both reject the same field ("Title is required",
		// "Title must not be blank"), and saying it twice reads as two
		// problems. Every item of an array counts as the same field, since
		// blank options[1].text and options[2].text both say "Text is
		// required". errors[] keeps every detail.
		key := arrayIndex.ReplaceAllString(d.Location, "[]")
		if fieldName(key) == "" {
			key = "message:" + d.Message
		}
		if d.Message != "" && !seen[key] && !seen["message:"+d.Message] {
			seen[key] = true
			seen["message:"+d.Message] = true
			summary = append(summary, d.Message)
		}
	}

	if strings.EqualFold(strings.TrimSpace(model.Detail), genericValidationDetail) && len(summary) > 0 {
		model.Detail = joinSentences(summary)
	}
}

// arrayIndex matches the index in a location such as "body.options[2].text".
var arrayIndex = regexp.MustCompile(`\[\d+\]`)

// joinSentences joins messages into one detail, adding a full stop between
// them only where a message doesn't already end in punctuation: a Resolve
// hook's "Invalid layout." must not become "Invalid layout.. Title is
// required".
func joinSentences(messages []string) string {
	var b strings.Builder
	for i, m := range messages {
		if i > 0 {
			if !strings.ContainsAny(messages[i-1][len(messages[i-1])-1:], ".!?") {
				b.WriteString(".")
			}
			b.WriteString(" ")
		}
		b.WriteString(m)
	}
	return b.String()
}

// humanizeMessage renders one validation message for a person.
func humanizeMessage(location, message string) string {
	message = strings.TrimSpace(message)

	if m := requiredProperty.FindStringSubmatch(message); m != nil {
		return fieldLabel(m[1]) + " is required"
	}

	field := fieldName(location)
	label := fieldLabel(field)

	// Some IDs are chosen from a list (community_id carries minimum:"1" so the
	// zero value counts as missing); "Community must be at least 1" would be
	// meaningless to the person picking one.
	if isIDField(field) && message == "expected number >= 1" {
		return label + " is required"
	}

	for _, rule := range messageRules {
		if m := rule.pattern.FindStringSubmatch(message); m != nil {
			return rule.render(label, m)
		}
	}

	// Hand-written messages from Resolve hooks ("title must not be blank")
	// already read as prose; only swap a leading raw field name for its label.
	if field != "" && strings.HasPrefix(message, field+" ") {
		message = label + strings.TrimPrefix(message, field)
	}
	return capitalize(message)
}

// fieldName extracts the field a location points at: "body.max_players" gives
// "max_players", "body.options[2].text" gives "text". A bare "body" or an empty
// location names no field.
func fieldName(location string) string {
	idx := strings.LastIndex(location, ".")
	if idx < 0 {
		return ""
	}
	name := location[idx+1:]
	if b := strings.Index(name, "["); b >= 0 {
		name = name[:b]
	}
	return name
}

// isIDField reports whether a JSON field name is a foreign-key style ID.
func isIDField(field string) bool {
	lower := strings.ToLower(field)
	return lower != "id" && (strings.HasSuffix(lower, "_id") || strings.HasSuffix(field, "ID"))
}

// fieldLabel turns a JSON or parameter name into a label: "max_players" gives
// "Max players", "community_id" gives "Community", "gameID" gives "Game".
func fieldLabel(field string) string {
	if field == "" {
		return "This value"
	}
	if isIDField(field) {
		field = strings.TrimSuffix(strings.TrimSuffix(field, "_id"), "ID")
	}

	// Split snake_case and camelCase into words.
	var b strings.Builder
	runes := []rune(field)
	for i, r := range runes {
		switch {
		case r == '_' || r == '-':
			b.WriteRune(' ')
		case i > 0 && unicode.IsUpper(r) && unicode.IsLower(runes[i-1]):
			b.WriteRune(' ')
			b.WriteRune(unicode.ToLower(r))
		default:
			b.WriteRune(r)
		}
	}
	return capitalize(strings.TrimSpace(b.String()))
}

func capitalize(s string) string {
	if s == "" {
		return s
	}
	r := []rune(s)
	r[0] = unicode.ToUpper(r[0])
	return string(r)
}
