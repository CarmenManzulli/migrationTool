/**
 * QuerySyncErrorType
 * Error Type for return value related to querySync() function.
 * It's made because @types/ibm_db is incomplete and define it as any[]
 */
import * as t from "io-ts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

export const QuerySyncErrorType = t.partial({
  error: NonEmptyString,
  message: NonEmptyString
});
export type QuerySyncErrorType = t.TypeOf<typeof QuerySyncErrorType>;
