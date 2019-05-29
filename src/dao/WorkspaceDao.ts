/**
 * WorkspaceDao
 * DAO for Workspace table
 */
import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { Database } from "ibm_db";
import * as t from "io-ts";
import { reporters } from "italia-ts-commons";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import {
  WorkspaceDbModel,
  WorkspaceDbModelQueryItems
} from "../models/WorkspaceDbModel";
import { WorkspaceDbSchema } from "../schema/WorkspaceDbSchema";
import { DbQueryItem, getDbQueryItem } from "../types/db/DbQueryItem";
import * as DbUtils from "../utils/DbUtils";
import { logger } from "../utils/Logger";
import * as QueryUtils from "../utils/QueryUtils";

/**
 * Retrieve a list of workspace labels
 * @param {NonEmptyString | undefined} workspaceId - The workspace id to use as filter
 * @param {Database} dbClient - The DB client used to submit the query
 * @returns {Either<Error, ReadonlyArray<WorkspaceDbModel>>} - The Workspace Db Model
 */
export function getWorkspaces(
  workspaceLabel: NonEmptyString | undefined,
  dbClient: Database
): Either<Error, ReadonlyArray<WorkspaceDbModel>> {
  const queryFilters = getDbQueryItemListFromModel({
    workspaceLabel
  });

  const queryStmtOrError = QueryUtils.getSelectStatement(
    WorkspaceDbSchema.TABLENAME,
    queryFilters,
    dbClient
  );

  if (isLeft(queryStmtOrError)) {
    return left(queryStmtOrError.value);
  }
  const queryResultOrError = DbUtils.executeSelectQuery(queryStmtOrError.value);
  if (isLeft(queryResultOrError)) {
    return left(queryResultOrError.value);
  }
  const queryResult = queryResultOrError.value;
  return resultArrayToWorkspaceList(queryResult);
}

/**
 * Utility to define a list of columns and values to use for queries
 * @param {WorkspaceDbModelQueryItems} workspaceDbModelQueryItems - The Workspace containing values
 * @returns {ReadonlyArray<DbQueryItem>} - The list of query items
 */
export function getDbQueryItemListFromModel(
  workspaceDbModelQueryItems: WorkspaceDbModelQueryItems
): ReadonlyArray<DbQueryItem> {
  return [
    getDbQueryItem(
      WorkspaceDbSchema.COLUMNS.ID,
      workspaceDbModelQueryItems.workspaceId
    ),
    getDbQueryItem(
      WorkspaceDbSchema.COLUMNS.LABEL,
      workspaceDbModelQueryItems.workspaceLabel
    ),
    getDbQueryItem(
      WorkspaceDbSchema.COLUMNS.NAME,
      workspaceDbModelQueryItems.workspaceName
    )
  ].filter(
    (dbQueryItem: DbQueryItem): DbQueryItem => {
      if (dbQueryItem === undefined) {
        return;
      }
      return dbQueryItem;
    }
  );
}

/**
 * Utility to decode a list of WorkspaceDbModel from db result
 * @param {ReadonlyArray<t.Props>} queryResultList - The DB query result
 * @returns {Either<Error, ReadonlyArray<WorkspaceDbModel>>} - The list of WorkspaceDbModel or the error
 */
export function resultArrayToWorkspaceList(
  queryResultList: ReadonlyArray<t.Props>
): Either<Error, ReadonlyArray<WorkspaceDbModel>> {
  try {
    const workspaceDbModelList = queryResultList.map(
      (workspaceDbRecord: t.Props): WorkspaceDbModel => {
        return WorkspaceDbModel.decode({
          workspaceId: workspaceDbRecord.workspaceId,
          workspaceLabel: workspaceDbRecord.workspaceLabel,
          workspaceName: workspaceDbRecord.workspaceName
        }).getOrElseL(errors => {
          throw Error(reporters.readableReport(errors));
        });
      }
    );
    return right(workspaceDbModelList);
  } catch (exception) {
    const errMsg = `Error parsing WorkspaceDbModel from DB`;
    logger.info(errMsg);
    return left(Error(errMsg));
  }
}
