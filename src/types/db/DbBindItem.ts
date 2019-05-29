/**
 * DbBindItem
 * Type for items used to query binding
 * Type is not complete. It just consider what iwo-cb uses
 * Full documentation described here:
 * https://github.com/ibmdb/node-ibm_db/blob/master/APIDocumentation.md#user-content-bindParameters
 */
import * as t from "io-ts";
import { enumType } from "italia-ts-commons/lib/types";
import { DbColumnEnumType } from "./DbColumnEnum";
import { DbQueryItemValue } from "./DbQueryItem";

export enum DbParamTypeEnum {
  "INPUT" = "INPUT"
}
export type DbParamType = t.TypeOf<typeof DbParamType>;
export const DbParamType = enumType<DbParamTypeEnum>(
  DbParamTypeEnum,
  "DbParamTypeEnum"
);

export const DbBindItem = t.interface({
  ParamType: DbParamType,
  SQLType: DbColumnEnumType,
  Data: DbQueryItemValue
});
export type DbBindItem = t.TypeOf<typeof DbBindItem>;
