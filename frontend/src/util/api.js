import {accessToken} from "./auth";

export function withAuth(headers={}) {
  return (state) => ({
    ...headers,
    'Authorization': `JWT ${accessToken(state)}`
  })
}