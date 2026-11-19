package core

// textColors are the names [color:X]...[/color] accepts. Mirrors TEXT_COLORS in
// frontend/src/components/common/markdown/textColors.ts: the renderer leaves a
// tag with any other name as literal text, so code that strips the markup (for
// exports, or to measure a label) must leave it too.
var textColors = map[string]bool{
	"red": true, "green": true, "blue": true, "purple": true, "orange": true,
	"gold": true, "gray": true, "teal": true, "pink": true, "brown": true,
	"olive": true, "silver": true,
}

// IsTextColor says whether [color:name] renders as a colour rather than as text.
func IsTextColor(name string) bool {
	return textColors[name]
}
