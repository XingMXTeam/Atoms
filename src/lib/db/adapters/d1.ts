import { drizzle } from "drizzle-orm/d1";
import { createAppRepository, type AppRepository } from "../repository";
import * as schema from "../schema";

/** Cloudflare D1 binding (Workers). Avoids a hard dep on workers-types. */
export type D1Binding = Parameters<typeof drizzle>[0];

/** Workers D1 binding adapter. Schema must already be applied via migrations. */
export function createD1Repository(binding: D1Binding): AppRepository {
  const db = drizzle(binding, { schema });
  return createAppRepository(db);
}
