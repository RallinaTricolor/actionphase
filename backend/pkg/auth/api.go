package auth

import (
	"actionphase/pkg/core"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
)

type Request struct {
	*core.User
}

func (r *Request) Bind(req *http.Request) error {
	if r.User == nil {
		return fmt.Errorf("missing required User fields")
	}
	return nil
}

type Handler struct {
	DB *pgxpool.Pool
}

type Response struct {
	*core.User
	Token string
}

func (rd *Response) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}
