/**
 * MigrationUtils
 * Provide a library to use the MigrationTool
 */
import { fs } from "file-system";
import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { Database, ODBCStatement } from "ibm_db";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { AssistantV1 } from "watson-developer-cloud";
import { Workspace } from "watson-developer-cloud/assistant/v1";
import {
  UpdateWorkspaceParams,
  WorkspaceExport
} from "watson-developer-cloud/conversation/v1-generated";
import { IConfiguration, IMigrationParametersConfig } from "../Configuration";
import {
  getDbQueryItemListFromModel,
  resultArrayToWorkspaceList
} from "../dao/WorkspaceDao";
import { WorkspaceDbModel } from "../models/WorkspaceDbModel";
import { WorkspaceDbSchema } from "../schema/WorkspaceDbSchema";
import {
  WorkspacesToMigrate,
  WorkspaceToMigrate
} from "../types/WorkspaceToMigrate";
import * as DbUtils from "./DbUtils";
import { logger } from "./Logger";
import * as QueryUtils from "./QueryUtils";
import * as WatsonUtils from "./WatsonUtils";

// Get the query statement based on configuration params
export function getRightQueryStatement(
  tableName: NonEmptyString,
  dbClient: Database,
  migrationWorkspaceAll: boolean,
  singleWorkspaceId: string
): Either<Error, ODBCStatement> {
  if (migrationWorkspaceAll === false && singleWorkspaceId !== "") {
    logger.info("Migrating a single workspace");
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
  if (migrationWorkspaceAll === true && singleWorkspaceId === "") {
    const allSelectStatementOrError = QueryUtils.getSelectAllStatement(
      tableName,
      dbClient
    );
    if (isLeft(allSelectStatementOrError)) {
      return left(allSelectStatementOrError.value);
    }
    return right(allSelectStatementOrError.value);
  }
  logger.error("Wrong Migration Tool Parameters found");
  return left(Error("Wrong Migration Tool Parameters found"));
}

// Get workspaces IDs from db Target
export function getTargetWorkspacesFromTargetDb(
  dbClientTarget: Database,
  tableName: NonEmptyString,
  RecordName: NonEmptyString
): Either<Error, ReadonlyArray<WorkspaceDbModel>> {
  const queryFilters = getDbQueryItemListFromModel({
    workspaceName: RecordName
  });

  const SelectStatementOrError = QueryUtils.getSelectStatement(
    `${tableName}`,
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
  const queryStmtOrError = getRightQueryStatement(
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
    logger.error(`Error Getting From Database Source ${dbWorkspacesOrError}`);
    return left(dbWorkspacesOrError.value);
  }
  const dbWorkspaces = dbWorkspacesOrError.value;
  if (dbWorkspaces.length === 0) {
    logger.error("There Aren't Elements In Database Source");
    return left(Error("There Aren't Elements In Database Source"));
  }
  // Getting List from source watson
  const watsonWorkspacesOrError = await WatsonUtils.getWorkspacesList(
    watsonSourceClient
  );
  if (isLeft(watsonWorkspacesOrError)) {
    return left(Error("Error Getting Workspaces List From Source"));
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
            throw Error("Length Other Than Zero");
          }
          const workspaceInformationOrError = await WatsonUtils.getWorkspaceInformation(
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
    logger.error("Id Name Workspace Is Not Correct");
  } else {
    return nameId
      .concat("_")
      .concat(Date.now().toString())
      .concat(".json");
  }
}
// filter list of workspaces based on workspaceId
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
      logger.error("No Such File Or Directory Found");
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
            logger.error("Error Getting Target Workspaces From Target Db");
            throw targetWorkspacesIdOrError.value;
          }

          const targetWorkspacesId = targetWorkspacesIdOrError.value;
          if (targetWorkspacesId.length === 1) {
            // retrieve workspace information from buildWorkspaceParametersForMigrate
            logger.info(`Updating ${workspaceToMigrate.dbWorkspaceName}`);
            const buildWorkspaceParametersForMigrateOrError = await buildWorkspaceParametersForMigrate(
              workspaceToMigrate,
              targetWorkspacesId[0].workspaceId as string
            );
            if (isLeft(buildWorkspaceParametersForMigrateOrError)) {
              logger.error("Error While Building Workspace Paramaters");
              throw Error("Error While Building Workspace Paramaters");
            }
            // update workspace in target watson
            const workspaceUpdateOrError = await WatsonUtils.updateWorkspaceInformation(
              watsonTargetClient,
              buildWorkspaceParametersForMigrateOrError.value
            );
            if (isLeft(workspaceUpdateOrError)) {
              const errMsg = `Error To Update Workspace`;
              throw Error(errMsg);
            }
            return workspaceUpdateOrError.value;
          }
          logger.error(
            `No single result found for ${
              workspaceToMigrate.dbWorkspaceName
            } In Db Target: ${targetWorkspacesId.length}`
          );
        }
      )
    );
    return right(workspacesUpdated);
  } catch (exception) {
    return left(exception);
  }
}

// TODO build a workspace for migrate
export function buildWorkspaceParametersForMigrate(
  workspacesToMigrate: WorkspaceToMigrate,
  targetWorkspacesId: string
): Either<Error, UpdateWorkspaceParams> {
  const params = {
    workspace_id: targetWorkspacesId,
    description: workspacesToMigrate.workspace.description,
    language: workspacesToMigrate.workspace.language,
    entities: workspacesToMigrate.workspace.entities,
    intents: workspacesToMigrate.workspace.intents,
    dialog_nodes: workspacesToMigrate.workspace.dialog_nodes,
    counterexamples: workspacesToMigrate.workspace.counterexamples,
    metadata: workspacesToMigrate.workspace.metadata,
    learning_opt_out: workspacesToMigrate.workspace.learning_opt_out,
    system_settings: workspacesToMigrate.workspace.system_settings
  };
  return right(params);
}
