/**
 * DbColumn
 * Types for Db Schema
 */
import * as t from "io-ts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { DbColumnEnumType } from "./DbColumnEnum";

export const DbColumn = t.interface({
  columnName: NonEmptyString,
  columnType: DbColumnEnumType
});
export type DbColumn = t.TypeOf<typeof DbColumn>;
