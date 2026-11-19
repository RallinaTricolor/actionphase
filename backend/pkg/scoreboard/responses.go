package scoreboard

import "actionphase/pkg/core"

// EntryNamesResponse feeds the column picker in the scoreboard editor.
type EntryNamesResponse struct {
	Tabs []core.ScoreboardTabEntryNames `json:"tabs" doc:"Tabs that can feed a column, in sheet order"`
}
