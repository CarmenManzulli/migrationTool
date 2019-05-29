/**
 * DbColumnEnum
 * Column types defined for DB Tables
 */
import * as t from "io-ts";
import { enumType } from "italia-ts-commons/lib/types";

export enum DbColumnEnum {
  "INTEGER" = "INTEGER",
  "VARCHAR" = "VARCHAR",
  "TIMESTAMP" = "TIMESTAMP",
  "BOOLEAN" = "BOOLEAN",
  "CLOB" = "CLOB"
}
export type DbColumnEnumType = t.TypeOf<typeof DbColumnEnumType>;
export const DbColumnEnumType = enumType<DbColumnEnum>(
  DbColumnEnum,
  "DbColumnEnum"
);
