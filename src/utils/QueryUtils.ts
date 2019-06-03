/**
 * QueryUtils
 * Provide a library to build SQL Statements
 */
import { Either, left, right } from "fp-ts/lib/Either";
import { Database, ODBCStatement } from "ibm_db";
import { DbBindItem, DbParamTypeEnum } from "../types/db/DbBindItem";
import { DbQueryItem } from "../types/db/DbQueryItem";
import { logger } from "./Logger";

export function getSelectStatement(
  tableName: string,
  dbQueryFilterList: ReadonlyArray<DbQueryItem>,
  dbClient: Database
): Either<Error, ODBCStatement> {
  // Define the SQL query
  const queryBase = `SELECT * FROM ${tableName}`;
  const queryFilters = dbQueryFilterList.reduce<string>(
    (accumulator: string, currentValue: DbQueryItem): string => {
      const currentFilter = ` ${currentValue.column.columnName}=? `;
      return accumulator === ""
        ? ` WHERE ${currentFilter} `
        : ` ${accumulator} AND ${currentFilter} `;
    },
    ""
  );

  // Bind parameters using prepare pattern
  try {
    const stmt = dbClient.prepareSync(`${queryBase}${queryFilters}`);
    dbQueryFilterList.forEach(
      (currentValue: DbQueryItem): void => {
        stmt.bindSync([
          {
            Data: currentValue.value,
            ParamType: DbParamTypeEnum.INPUT,
            SQLType: currentValue.column.columnType
          }
        ]);
      }
    );
    return right(stmt);
  } catch (exception) {
    const errMsg = `Error binding parameters into a select stmt`;
    logger.info(errMsg);
    return left(Error(errMsg));
  }
}

export function getSelectStatementForNameAndLabel(
  tableName: string,
  dbClient: Database
): Either<Error, ODBCStatement> {
  // Define the SQL query
  const queryBase = `SELECT NAME, LABEL FROM ${tableName}`;
  // Bind parameters using prepare pattern
  try {
    const stmt = dbClient.prepareSync(`${queryBase}`);
    return right(stmt);
  } catch (exception) {
    const errMsg = `Error binding parameters into a select all stmt`;
    logger.info(errMsg);
    return left(Error(errMsg));
  }
}

export function getSelectAllStatement(
  tableName: string,
  dbClient: Database
): Either<Error, ODBCStatement> {
  // Define the SQL query
  const queryBase = `SELECT * FROM ${tableName}`;
  // Bind parameters using prepare pattern
  try {
    const stmt = dbClient.prepareSync(`${queryBase}`);
    return right(stmt);
  } catch (exception) {
    const errMsg = `Error binding parameters into a select all stmt`;
    logger.info(errMsg);
    return left(Error(errMsg));
  }
}

export function getIdFromTargetDb(
  tableName: string,
  nameRecord: string,
  dbClient: Database
): Either<Error, ODBCStatement> {
  // Define the SQL query
  const queryBase = `SELECT ID FROM ${tableName} WHERE NAME = ${nameRecord}`;
  // Bind parameters using prepare pattern
  try {
    const stmt = dbClient.prepareSync(`${queryBase}`);
    return right(stmt);
  } catch (exception) {
    const errMsg = `Error binding parameters into a select Id stmt`;
    logger.info(errMsg);
    return left(Error(errMsg));
  }
}

export function getBindItems(
  dbQueryItems: ReadonlyArray<DbQueryItem>
): ReadonlyArray<DbBindItem> {
  return dbQueryItems.map(
    (currentValue: DbQueryItem): DbBindItem => {
      return {
        ParamType: DbParamTypeEnum.INPUT,
        SQLType: currentValue.column.columnType,
        Data: currentValue.value
      };
    }
  );
}

export function getInsertStatement(
  tableName: string,
  dbQueryItemList: ReadonlyArray<DbQueryItem>,
  dbClient: Database
): Either<Error, ODBCStatement> {
  // Define the SQL query
  const queryBase = `INSERT INTO ${tableName}`; // (x,y) VALUES (?,?)`;
  const queryColumns = dbQueryItemList.reduce<string>(
    (accumulator: string, currentValue: DbQueryItem): string => {
      return accumulator === ""
        ? ` ${currentValue.column.columnName} `
        : ` ${accumulator}, ${currentValue.column.columnName} `;
    },
    ""
  );
  const queryParams = dbQueryItemList.reduce<string>(
    (accumulator: string): string => {
      return accumulator === "" ? ` ? ` : ` ${accumulator}, ? `;
    },
    ""
  );

  // Bind parameters using prepare pattern
  try {
    const stmt = dbClient.prepareSync(
      `${queryBase} (${queryColumns}) VALUES (${queryParams})`
    );
    const bindItems = getBindItems(dbQueryItemList);
    stmt.bindSync(bindItems as DbBindItem[]); // tslint:disable-line
    return right(stmt);
  } catch (exception) {
    const errMsg = `Error binding parameters into a insert stmt`;
    logger.info(errMsg);
    return left(Error(errMsg));
  }
}

export function getUpdateStatement(
  tableName: string,
  dbQueryItemToUpdateList: ReadonlyArray<DbQueryItem>,
  dbQueryItemToFilterList: ReadonlyArray<DbQueryItem>,
  dbClient: Database
): Either<Error, ODBCStatement> {
  // Check at least one filter exists
  if (dbQueryItemToFilterList.length === 0) {
    const errMsg = `Invalid UpdateDB request with null filters`;
    logger.info(errMsg);
    return left(Error(errMsg));
  }

  // Define the SQL query
  const queryBase = `UPDATE ${tableName} SET `; // A=x,B=y.. WHERE C=z`;
  const queryColumns = dbQueryItemToUpdateList.reduce<string>(
    (accumulator: string, currentValue: DbQueryItem): string => {
      return accumulator === ""
        ? ` ${currentValue.column.columnName}=? `
        : ` ${accumulator}, ${currentValue.column.columnName}=? `;
    },
    ""
  );
  const queryFilters = dbQueryItemToFilterList.reduce<string>(
    (accumulator: string, currentValue: DbQueryItem): string => {
      return accumulator === ""
        ? ` ${currentValue.column.columnName}=? `
        : ` ${accumulator} AND ${currentValue.column.columnName}=? `;
    },
    ""
  );

  // Bind parameters using prepare pattern
  try {
    const stmt = dbClient.prepareSync(
      `${queryBase} ${queryColumns} WHERE ${queryFilters}`
    );
    const bindItems = getBindItems(dbQueryItemToUpdateList).concat(
      getBindItems(dbQueryItemToFilterList)
    );
    stmt.bindSync(bindItems);
    return right(stmt);
  } catch (exception) {
    const errMsg = `Error binding parameters into an update stmt: ${exception}`;
    return left(Error(errMsg));
  }
}
