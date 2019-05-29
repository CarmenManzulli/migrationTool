/**
 * DbQueryItem
 * Define a column-value map to use as filter into a query
 */
import * as t from "io-ts";
import { UTCISODateFromString } from "italia-ts-commons/lib/dates";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { DbColumn } from "./DbColumn";

export const DbQueryItemValue =
  NonEmptyString || t.Integer || UTCISODateFromString || t.object || t.boolean;
export type DbQueryItemValue = t.TypeOf<typeof DbQueryItemValue>;

export const DbQueryItem = t.interface({
  column: DbColumn,
  value: DbQueryItemValue
});
export type DbQueryItem = t.TypeOf<typeof DbQueryItem>;

export function getDbQueryItem(
  column: DbColumn,
  value: DbQueryItemValue
): DbQueryItem {
  if (value === undefined) {
    return undefined;
  }
  return {
    column,
    value
  };
}
