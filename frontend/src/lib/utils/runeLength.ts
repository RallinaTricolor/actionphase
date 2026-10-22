/**
 * A string's length in code points, which is how the backend counts it (Go
 * runes, so huma's minLength/maxLength). `.length` counts UTF-16 units, so an
 * emoji counts twice and a client-side check disagrees with the server.
 */
export const runeLength = (value: string): number => [...value].length;
