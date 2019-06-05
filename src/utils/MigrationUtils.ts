/**
 * MigrationUtils
 * Provide a library to use the MigrationTool
 */
import { fs } from "file-system";
import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { Database, ODBCStatement } from "ibm_db";
import * as t from "io-ts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { AssistantV1 } from "watson-developer-cloud";
import { Workspace } from "watson-developer-cloud/assistant/v1";
import {
  WorkspaceExport,
  UpdateWorkspaceParams
} from "watson-developer-cloud/conversation/v1-generated";
import { IConfiguration, IMigrationParametersConfig } from "../Configuration";
import { getDbQueryItemListFromModel } from "../dao/WorkspaceDao";
import { WorkspaceDbModel } from "../models/WorkspaceDbModel";
import { WorkspaceDbSchema } from "../schema/WorkspaceDbSchema";
import * as DbUtils from "./DbUtils";
import { logger } from "./Logger";
import * as QueryUtils from "./QueryUtils";
import * as WatsonUtils from "./WatsonUtils";
import {
  WorkspaceToMigrate,
  WorkspacesToMigrate
} from "../types/WorkspaceToMigrate";

// Get query statement
export function getQueryStatement(
  tableName: NonEmptyString,
  dbClient: Database,
  migrationWorkspaceAll: boolean,
  singleWorkspaceId: string
): Either<Error, ODBCStatement> {
  if (migrationWorkspaceAll === false) {
    if (singleWorkspaceId === "") {
      logger.error("SINGLE_WORKSPACE_ID is empty");
      return left(Error("SINGLE_WORKSPACE_ID is empty"));
    }
    const queryFilters = getDbQueryItemListFromModel({
      workspaceId: singleWorkspaceId as NonEmptyString
    });
    const oneSelectStatementOrError = QueryUtils.getSelectStatement(
      tableName,
      queryFilters,
      dbClient
    );
    if (isLeft(oneSelectStatementOrError)) {
      return left(oneSelectStatementOrError.value);
    }
    return right(oneSelectStatementOrError.value);
  }
  const allSelectStatementOrError = QueryUtils.getSelectAllStatement(
    tableName,
    dbClient
  );
  if (isLeft(allSelectStatementOrError)) {
    return left(allSelectStatementOrError.value);
  }
  return right(allSelectStatementOrError.value);
}

// Get Id from db Target
export function getTargetWorkspacesFromTargetDb(
  dbClientTarget: Database,
  tableName: NonEmptyString,
  RecordName: NonEmptyString
): Either<Error, ReadonlyArray<WorkspaceDbModel>> {
  const queryFilters = getDbQueryItemListFromModel({
    workspaceName: RecordName
  });
  const SelectStatementOrError = QueryUtils.getSelectStatement(
    tableName,
    queryFilters,
    dbClientTarget
  );
  if (isLeft(SelectStatementOrError)) {
    return left(SelectStatementOrError.value);
  }
  const SelectStatement = SelectStatementOrError.value;

  const queryResultOrError = DbUtils.executeSelectQuery(SelectStatement);
  if (isLeft(queryResultOrError)) {
    return left(queryResultOrError.value);
  }
  return resultArrayToWorkspaceList(queryResultOrError.value);
}

// Get workspaces from DB source
export function getWorkspacesFromDbSource(
  tableName: NonEmptyString,
  dbClient: Database,
  migrationParametersConfig: IMigrationParametersConfig
): Either<Error, ReadonlyArray<WorkspaceDbModel>> {
  logger.info(`Retrieving Workspaces from SOURCE DB...`);
  const queryStmtOrError = getQueryStatement(
    tableName,
    dbClient,
    migrationParametersConfig.MIGRATE_ALL,
    migrationParametersConfig.SINGLE_WORKSPACE_ID
  );
  if (isLeft(queryStmtOrError)) {
    return left(queryStmtOrError.value);
  }
  const queryStmt = queryStmtOrError.value;
  const queryResultOrError = DbUtils.executeSelectQuery(queryStmt);
  if (isLeft(queryResultOrError)) {
    return left(queryResultOrError.value);
  }
  return resultArrayToWorkspaceList(queryResultOrError.value);
}

// Convert db type into list type
export function resultArrayToWorkspaceList(
  queryResultList: ReadonlyArray<t.Props>
): Either<Error, ReadonlyArray<WorkspaceDbModel>> {
  try {
    const workspaceDbModelList = queryResultList.map(
      (workspaceDbRecord: t.Props): WorkspaceDbModel => {
        return WorkspaceDbModel.decode({
          workspaceName: workspaceDbRecord.NAME,
          workspaceLabel: workspaceDbRecord.LABEL,
          workspaceId: workspaceDbRecord.ID
        }).getOrElseL(errors => {
          throw Error(errors.toString());
        });
      }
    );
    return right(workspaceDbModelList);
  } catch (exception) {
    const errMsg = `Error parsing workspaceDbModelList from DB`;
    return left(Error(errMsg));
  }
}

export async function getWorkspacesToMigrate(
  watsonSourceClient: AssistantV1,
  dbClientSource: Database,
  config: IConfiguration
): Promise<Either<Error, WorkspacesToMigrate>> {
  const backupDirectory = config.SOURCE.BACKUP_DIRECTORY;
  const configMigrationParameters = config.MIGRATION_TOOL_PARAMETERS;
  // Retrieve the list of workspaces candidated to migration
  const dbWorkspacesOrError = getWorkspacesFromDbSource(
    WorkspaceDbSchema.TABLENAME,
    dbClientSource,
    configMigrationParameters
  );
  if (isLeft(dbWorkspacesOrError)) {
    logger.error(
      `Error getting App Configuration from Database Source ${dbWorkspacesOrError}`
    );
    return left(dbWorkspacesOrError.value);
  }
  const dbWorkspaces = dbWorkspacesOrError.value;
  if (dbWorkspaces.length === 0) {
    logger.error("There aren't elements in database source");
    return left(Error("There aren't elements in database source"));
  }
  // Getting List from source watson
  const watsonWorkspacesOrError = await WatsonUtils.getWorkspacesList(
    watsonSourceClient
  );
  if (isLeft(watsonWorkspacesOrError)) {
    return left(Error("error getting workspaces list from source"));
  }
  const watsonWorkspaces = watsonWorkspacesOrError.value;

  try {
    const result = await Promise.all(
      dbWorkspaces.map(
        async (dbWorkspace: WorkspaceDbModel): Promise<WorkspaceToMigrate> => {
          // Get Information List about workspace from source watson
          const listDbInWatsonListFound = searchListDbInWatsonList(
            watsonWorkspaces.workspaces,
            dbWorkspace.workspaceId
          );
          if (listDbInWatsonListFound.length !== 1) {
            throw Error("length other than zero");
          }
          const workspaceInformationOrError = await WatsonUtils.getWorkspaceInformationById(
            watsonSourceClient,
            listDbInWatsonListFound[0]
          );
          if (isLeft(workspaceInformationOrError)) {
            throw workspaceInformationOrError.value;
          }
          const watsonWorkspacesInformation = workspaceInformationOrError.value;
          const fileNameBackup = getFileBackupName(dbWorkspace.workspaceId);
          createFileBackupJson(
            watsonWorkspacesInformation,
            backupDirectory.toString().concat(fileNameBackup)
          );
          return {
            dbWorkspaceName: dbWorkspace.workspaceName,
            workspace: watsonWorkspacesInformation
          };
        }
      )
    );
    return right(result);
  } catch (exception) {
    logger.error(JSON.stringify(exception));
    return left(exception);
  }
}

export function getFileBackupName(nameId: string): string {
  if (!nameId) {
    logger.error("id name workspace is not correct");
  } else {
    return nameId
      .concat("_")
      .concat(Date.now().toString())
      .concat(".json");
  }
}
// searches for two identical elements between two lists
export function searchListDbInWatsonList(
  watsonWorkspacesList: ReadonlyArray<Workspace>,
  idWorkspaceDatabase: string
): ReadonlyArray<string> {
  return watsonWorkspacesList.reduce(
    (idAccumulator: ReadonlyArray<string>, workspace: Workspace) => {
      if (idWorkspaceDatabase === workspace.workspace_id) {
        return idAccumulator.concat(workspace.workspace_id);
      }
      return idAccumulator;
    },
    []
  );
}

// create file json for save information about workspace
export function createFileBackupJson(
  workspaceInformation: WorkspaceExport,
  filePathBackup: string
): void {
  fs.writeFile(filePathBackup, JSON.stringify(workspaceInformation), err => {
    if (err) {
      logger.error("No such file or directory found");
    }
  });
}

// update Information List about workspace to target watson
export async function updateWorkspaces(
  dbTargetClient: Database,
  watsonTargetClient: AssistantV1,
  workspacesToMigrate: WorkspacesToMigrate
): Promise<Either<Error, ReadonlyArray<Workspace>>> {
  try {
    const workspacesUpdated = await Promise.all(
      workspacesToMigrate.map(
        async (workspaceToMigrate: WorkspaceToMigrate): Promise<Workspace> => {
          // Retrieve target workspace id from db target
          const targetWorkspacesIdOrError = getTargetWorkspacesFromTargetDb(
            dbTargetClient,
            WorkspaceDbSchema.TABLENAME,
            workspaceToMigrate.dbWorkspaceName as NonEmptyString
          );

          if (isLeft(targetWorkspacesIdOrError)) {
            logger.error("Error getting Target Workspaces from Target Db");
            throw targetWorkspacesIdOrError.value;
          }
          const targetWorkspacesId = targetWorkspacesIdOrError.value;
          if (targetWorkspacesId.length !== 1) {
            logger.error(
              `Non single result for ${
                workspaceToMigrate.dbWorkspaceName
              } in db Target`
            );
            throw Error(
              `Non single result for ${
                workspaceToMigrate.dbWorkspaceName
              } in db Target`
            );
          }
          // retrieve workspace information from buildWorkspaceParametersForMigrate
          const buildWorkspaceParametersForMigrateOrError = await buildWorkspaceParametersForMigrate(
            workspaceToMigrate,
            targetWorkspacesId[0].workspaceId as string
          );
          if (isLeft(buildWorkspaceParametersForMigrateOrError)) {
            logger.error("Error while building workspace paramaters");
            throw Error("Error while building workspace paramaters");
          }
          // update workspace in target watson
          const workspaceUpdateOrError = await WatsonUtils.updateWorkspaceInformationById(
            watsonTargetClient,
            buildWorkspaceParametersForMigrateOrError.value
          );
          if (isLeft(workspaceUpdateOrError)) {
            const errMsg = `error to update workspace`;
            throw Error(errMsg);
          }
          return workspaceUpdateOrError.value;
        }
      )
    );
    return right(workspacesUpdated);
  } catch (exception) {
    return left(exception);
  }
}
//build a workspace for migrate
export function buildWorkspaceParametersForMigrate(
  WorkspacesToMigrate: WorkspaceToMigrate,
  targetWorkspacesId: string
): Either<Error, UpdateWorkspaceParams> {
  const params = {
    workspace_id: targetWorkspacesId,
    description: WorkspacesToMigrate.workspace.description,
    language: WorkspacesToMigrate.workspace.language,
    entities: WorkspacesToMigrate.workspace.entities,
    intents: WorkspacesToMigrate.workspace.intents,
    dialog_nodes: WorkspacesToMigrate.workspace.dialog_nodes,
    counterexamples: WorkspacesToMigrate.workspace.counterexamples,
    metadata: WorkspacesToMigrate.workspace.metadata,
    learning_opt_out: WorkspacesToMigrate.workspace.learning_opt_out,
    system_settings: WorkspacesToMigrate.workspace.system_settings
  };
  return right(params);
}
