/**
 * Migration Tool
 * tool in order to migrate from a Source watson environment to a target one
 */
import { isLeft } from "fp-ts/lib/Either";
import { Database } from "ibm_db";
import * as Configuration from "./Configuration";
import * as DbUtils from "./utils/DButils";
import { logger } from "./utils/Logger";
import * as MigrationUtils from "./utils/MigrationUtils";
import * as WatsonUtils from "./utils/WatsonUtils";
/**
 * Execute the Migration Tool
 * @returns {Promise<void>}
 */
export async function startTool(): Promise<void> {
  // Retrieve server configuration
  const configOrError = Configuration.getAppConfiguration();
  if (isLeft(configOrError)) {
    logger.error(`Error Getting App Configuration: ${configOrError.value}`);
    return;
  }
  const config = configOrError.value;

  // Create Db client source
  const dbClientSourceOrError = DbUtils.getDb2Client(config.SOURCE.DB);
  if (isLeft(dbClientSourceOrError)) {
    logger.error(`Error Getting Db2 Client Source: ${dbClientSourceOrError}`);
    return;
  }
  const dbClientSource = dbClientSourceOrError.value;

  // Create Assistant client source
  const watsonSourceClientOrError = WatsonUtils.getWatsonAssistantClient(
    config.SOURCE.WATSON_API
  );
  if (isLeft(watsonSourceClientOrError)) {
    logger.error(
      `Error Getting Assistant Client Source: ${watsonSourceClientOrError}`
    );
    return;
  }
  const watsonSourceClient = watsonSourceClientOrError.value;

  // Create db client target
  const dbClientTargetOrError = DbUtils.getDb2Client(config.TARGET.DB);
  if (isLeft(dbClientTargetOrError)) {
    logger.error(`Error Getting Db2 Client Target: ${dbClientTargetOrError}`);
    endProcessHandler(dbClientSource);
    return;
  }
  const dbClientTarget = dbClientTargetOrError.value;

  // Create Assistant client target
  const watsonTargetClientOrError = WatsonUtils.getWatsonAssistantClient(
    config.TARGET.WATSON_API
  );
  if (isLeft(watsonTargetClientOrError)) {
    logger.error(
      `Error Getting Assistant Client Target: ${watsonTargetClientOrError}`
    );
    return;
  }
  const watsonClientTarget = watsonTargetClientOrError.value;

  const workspacesToMigrateOrError = await MigrationUtils.getWorkspacesToMigrate(
    watsonSourceClient,
    dbClientSource,
    config
  );
  if (isLeft(workspacesToMigrateOrError)) {
    logger.error(
      `Error Getting Workpaces To Migrate: ${workspacesToMigrateOrError}`
    );
    return;
  }
  const workspacesToMigrate = workspacesToMigrateOrError.value;
  console.log(JSON.stringify(workspacesToMigrate.length));
  // migrate from source to watson target
  const workspacesTargetToMigrateOrError = await MigrationUtils.updateWorkspaces(
    dbClientTarget,
    watsonClientTarget,
    workspacesToMigrate
  );
  if (isLeft(workspacesTargetToMigrateOrError)) {
    logger.error(
      `Error Updating Workpaces: ${workspacesTargetToMigrateOrError}`
    );
    return;
  }

  const dbSourceClosed = DbUtils.closeDbConnection(dbClientSource);
  if (!dbSourceClosed) {
    logger.error(`Error occurred closing DB Connection Source`);
  }

  const dbTargetClosed = DbUtils.closeDbConnection(dbClientTarget);
  if (!dbTargetClosed) {
    logger.error(`Error occurred closing DB Connection Target`);
  }

  // Catch if administrator is stopping the Server to avoid to keep open the DB connection
  process.stdin.resume();
  process.on(`SIGINT`, () => {
    endProcessHandler(dbClientTarget);
    endProcessHandler(dbClientSource);
  });

  return process.exit();
}

function endProcessHandler(dbClient: Database): void {
  logger.info(
    `Administrator is stopping the server. Releasing DB connections...`
  );
  const dbClosed = DbUtils.closeDbConnection(dbClient);
  if (!dbClosed) {
    logger.error(`Error occurred closing DB Connection`);
  }
  logger.info(`Server stopped successfully`);

  process.exit();
}
/**
 * Start the Migration Tool and catch error
 */
startTool().catch(error => {
  const errMsg = `Error occurred starting Tool: ${error}`;
  logger.error(errMsg);
});
