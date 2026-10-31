import { sql } from "drizzle-orm";

// Russian alphabetical order: "ё" next to "е", case does not split names apart.
// The default collation of the database does not order Cyrillic this way.
export const RU_COLLATION = sql.raw(`"ru-x-icu"`);
