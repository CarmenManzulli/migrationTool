/**
 * WorkspaceDbSchema
 * DB Schema for WORKSPACE Table
 */
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { DbColumn } from "../types/db/DbColumn";
import { DbColumnEnum } from "../types/db/DbColumnEnum";

export const WorkspaceDbSchema = {
  TABLENAME: "WORKSPACE" as NonEmptyString,
  COLUMNS: {
    NAME: {
      columnName: "NAME" as NonEmptyString,
      columnType: DbColumnEnum.VARCHAR
    } as DbColumn,
    ID: {
      columnName: "ID" as NonEmptyString,
      columnType: DbColumnEnum.VARCHAR
    } as DbColumn,
    LABEL: {
      columnName: "LABEL" as NonEmptyString,
      columnType: DbColumnEnum.VARCHAR
    } as DbColumn
  }
};
