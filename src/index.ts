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
    logger.info("wrong result from getAppConfiguration");
    return;
  }

  const config = configOrError.value;

  // Retrieve a client for Source DB services
  const dbClientSourceOrError = DbUtils.getDb2Client(config.SOURCE.DB);
  if (isLeft(dbClientSourceOrError)) {
    logger.info("wrong result from getDb2Client");
    endProcessHandler(undefined);
    return;
  }

  const dbClientSource = dbClientSourceOrError.value;
  // Catch if administrator is stopping the Server to avoid to keep open the DB connection
  process.stdin.resume();
  process.on(`SIGINT`, () => {
    endProcessHandler(dbClientSource);
  });

  // CREATE CLIENT WATSON SOURCE
  const watsonSourceClientOrError = WatsonUtils.getWatsonAssistantClient(
    config.SOURCE.WATSON_API
  );
  if (isLeft(watsonSourceClientOrError)) {
    logger.error("error in source watson client");
    endProcessHandler(dbClientSource);
    return;
  }
  const watsonSourceClient = watsonSourceClientOrError.value;

  // Retrieve a client for Target DB services
  const dbClientTargetOrError = DbUtils.getDb2Client(config.SOURCE.DB);
  if (isLeft(dbClientSourceOrError)) {
    logger.info("wrong result from getDb2Target");
    endProcessHandler(undefined);
    return;
  }

  const dbClientTarget = dbClientTargetOrError.value;
  // Catch if administrator is stopping the Server to avoid to keep open the DB connection
  process.stdin.resume();
  process.on(`SIGINT`, () => {
    endProcessHandler(dbClientTarget);
  });
  // CREATE CLIENT WATSON TARGET
  const watsonTargetClientOrError = WatsonUtils.getWatsonAssistantClient(
    config.TARGET.WATSON_API
  );
  if (isLeft(watsonTargetClientOrError)) {
    console.log("error in target watson client");
    return;
  }

  const workspaceToMigrateOrError = await MigrationUtils.getWorkspaceToMigrate(
    watsonSourceClient,
    dbClientSource,
    config
  );
  if (isLeft(workspaceToMigrateOrError)) {
    logger.error("error in workspace Db Models To Migrate");
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
}

function endProcessHandler(dbClient: Database): void {
  logger.info(
    `Administrator is stopping the server. Releasing DB connection...`
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
