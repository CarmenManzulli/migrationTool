/**
 * DBUtils
 * Provide a library to use DB2 Services
 */
import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { Database, ODBCResult, ODBCStatement, openSync } from "ibm_db";
import * as t from "io-ts";
import { IDatabaseConfig } from "../Configuration";
import * as WorkspaceDao from "../dao/WorkspaceDao";
import { WorkspaceDbModel } from "../models/WorkspaceDbModel";
import { WorkspaceDbSchema } from "../schema/WorkspaceDbSchema";
import { logger } from "./Logger";
import * as QueryUtils from "./QueryUtils";

/**
 * Provide a DB2 Client
 * @param {IDatabaseConfig} dbConfig - Configuration used to define DB2 Client
 * @returns {Either<Error, Database>} - The DB2 Client or the error
 */
export function getDb2Client(
  dbConfig: IDatabaseConfig
): Either<Error, Database> {
  logger.info(`Creating DB2 Client...`);
  try {
    return right(
      openSync(
        `DATABASE=${dbConfig.DBNAME};HOSTNAME=${dbConfig.HOSTNAME};UID=${
          dbConfig.UID
        };PWD=${dbConfig.PWD};PORT=${dbConfig.PORT};PROTOCOL=TCPIP`
      )
    );
  } catch (exception) {
    const errMsg = `Error occurred connecting to DB`;
    logger.info(errMsg);
    return left(Error(errMsg));
  }
}

/**
 * Close a DB2 Client connection
 * @param {Database} dbClient - DB2 Client to close
 * @returns {Either<Error, void>} - Error if operation failed or right if success
 */
export function closeDbConnection(dbClient: Database): Either<Error, void> {
  logger.info(`Closing DB2 connection...`);
  try {
    if (dbClient === undefined) {
      return right(undefined);
    }
    const closeSyncResult = dbClient.closeSync();
    if (closeSyncResult !== true) {
      throw Error(`CloseSync returned false`);
    }
    return right(undefined);
  } catch (exception) {
    const errMsg = `Error occurred closing DB connection`;
    logger.info(errMsg);
    return left(Error(errMsg));
  }
}

/**
 * Execute a select query to DB2 server
 * @param {ODBCStatement} stmt - The prepared statement to execute
 * @returns {Either<Error, ReadonlyArray<t.Props>>} - The records or the error
 */
export function executeSelectQuery(
  stmt: ODBCStatement
): Either<Error, ReadonlyArray<t.Props>> {
  logger.info("Executing Select ODBC Statement into DB2...");
  const odbcResultOrError = executeOdbcStatement(stmt, false);
  if (isLeft(odbcResultOrError)) {
    return left(odbcResultOrError.value);
  }
  const odbcResult = odbcResultOrError.value;
  try {
    const fetchAllSyncResult = odbcResult.fetchAllSync();
    return right(fetchAllSyncResult);
  } catch (exception) {
    const errMsg = `Error occurred fetching results from ODBCResult`;
    logger.info(errMsg);
    return left(Error(errMsg));
  } finally {
    odbcResult.closeSync();
  }
}

/**
 * Execute a Statement to DB2
 * @param {ODBCStatement} stmt - ODBC Prepared Statement to execute
 * @param {boolean} closeAfterExecution - If true, odbcResult is closed after execution
 * @returns {Either<Error, ODBCResult>} - The ODBResult or the execution error
 */
export function executeOdbcStatement(
  stmt: ODBCStatement,
  closeAfterExecution: boolean
): Either<Error, ODBCResult> {
  try {
    logger.info("Executing ODBC Statement into DB2...");
    const odbcResult = stmt.executeSync();
    if (closeAfterExecution === true) {
      odbcResult.closeSync();
    }
    return right(odbcResult);
  } catch (exception) {
    const errMsg = `Error occurred execution stmt to DB`;
    logger.info(errMsg);
    return left(Error(errMsg));
  }
}

/**
 * Execute an update or insert statement to DB2 server
 * @param {ODBCStatement} stmt - The statement to execute
 * @returns {Either<Error, void>} - The error or right
 */
export function executeUpdateInsertQuery(
  stmt: ODBCStatement
): Either<Error, void> {
  logger.info("Executing Update-Insert ODBC Statement into DB2...");
  return executeOdbcStatement(stmt, true).map(_ => {
    return undefined;
  });
}

/**
 * Execute an insert statement to DB2 server for workspaceDbModel
 * @param {WorkspaceDbModel} workspaceDbModel - The workspaceDbModel to insert
 * @param {Database} dbClient - DB2 Client
 * @returns {Either<Error, void>} - The error or right
 */
export function insertWorkspaceDbModel(
  workspaceDbModel: WorkspaceDbModel,
  dbClient: Database
): Either<Error, void> {
  logger.info(`Inserting AccessToken into DB...`);
  const queryStmtOrError = QueryUtils.getInsertStatement(
    WorkspaceDbSchema.TABLENAME,
    WorkspaceDao.getDbQueryItemListFromModel(workspaceDbModel),
    dbClient
  );
  if (isLeft(queryStmtOrError)) {
    return left(queryStmtOrError.value);
  }
  return executeUpdateInsertQuery(queryStmtOrError.value).map(_ => {
    return undefined;
  });
}
