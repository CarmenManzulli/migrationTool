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
  const queryResult = queryResultOrError.value;
  return resultArrayToWorkspaceList(queryResult);
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
): Promise<Either<Error, ReadonlyArray<WorkspaceExport>>> {
  const backupDirectory = config.SOURCE.BACKUP_DIRECTORY;
  const configMigrationParameters = config.MIGRATION_TOOL_PARAMETERS;
  // Retrieve the list of workspaces candidated to migration
  const dbWorkspacesOrError = getWorkspacesFromDbSource(
    WorkspaceDbSchema.TABLENAME,
    dbClientSource,
    configMigrationParameters
  );
  if (isLeft(dbWorkspacesOrError)) {
    logger.info("wrong result from getWorkspacesFromDbSource");
    return left(dbWorkspacesOrError.value);
  }
  const dbWorkspaces = dbWorkspacesOrError.value;
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
        async (dbWorkspace: WorkspaceDbModel): Promise<WorkspaceExport> => {
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

          return watsonWorkspacesInformation;
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

// upload Information List about workspace to target watson
export async function uploadWorkspaces(
  targetClient: AssistantV1,
  workspacesToMigrate: ReadonlyArray<WorkspaceExport>
): Promise<Either<Error, ReadonlyArray<Workspace>>> {
  try {
    const workspacesUpdated = await Promise.all(
      workspacesToMigrate.map(
        async (workspaceToMigrate: WorkspaceExport): Promise<Workspace> => {
          const params = {
            name: workspaceToMigrate.name,
            description: workspaceToMigrate.description,
            language: workspaceToMigrate.language,
            intents: WatsonUtils.convertIntentExportIntoCreateIntent(
              workspaceToMigrate.intents
            ),
            entities: WatsonUtils.convertEntityExportIntoCreateEntity(
              workspaceToMigrate.entities
            ),
            dialog_nodes: WatsonUtils.convertDialogExportIntoCreateDialog(
              workspaceToMigrate.dialog_nodes
            ),
            counterexamples: workspaceToMigrate.counterexamples,
            metadata: workspaceToMigrate.metadata,
            learning_opt_out: workspaceToMigrate.learning_opt_out,
            system_settings: workspaceToMigrate.system_settings
          } as UpdateWorkspaceParams;
          // update workspace in target watson
          const workspaceUpdateOrError = await WatsonUtils.uploadWorkspaceInformationById(
            targetClient,
            params
          );

          if (isLeft(workspaceUpdateOrError)) {
            const errMsg = `error to update workspace`;
            throw Error(errMsg);
          }
          const workspaceUpdate = workspaceUpdateOrError.value;

          return workspaceUpdate;
        }
      )
    );
    return right(workspacesUpdated);
  } catch (exception) {
    return left(exception);
  }
}
