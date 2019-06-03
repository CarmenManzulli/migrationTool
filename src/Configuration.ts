/**
 * Configuration
 * Configurations for Migration Tool
 */
import { Either } from "fp-ts/lib/Either";
import * as t from "io-ts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

export const CONFIG = process.env.WINSTON_LOG_LEVEL || "debug";
export const Configuration = {
  SOURCE: {
    BACKUP_DIRECTORY: process.env.BACKUP_DIRECTORY || "./src/backup/",
    DB: {
      DBNAME: process.env.SOURCE_DB2_DBNAME || "BLUDB",
      HOSTNAME:
        process.env.SOURCE_DB2_HOSTNAME ||
        "dashdb-txn-sbox-yp-lon02-01.services.eu-gb.bluemix.net",
      UID: process.env.SOURCE_DB2_UID || "jtn54202",
      PWD: process.env.SOURCE_DB2_PWD || "z8q7jm3x2-d1dw5r",
      PORT: Number(process.env.SOURCE_DB2_PORT) || 50000
    },
    WATSON_API: {
      USERNAME: process.env.SOURCE_WATSON_USERNAME || "apikey",
      VERSION: process.env.SOURCE_WATSON_VERSION || "2018-07-10",
      PASSWORD:
        process.env.SOURCE_WATSON_PASSWORD ||
        "voRSiJMabwxsDisI8dZFPU-gaMzQ7uVBgr7TAyDRpsmX",
      URL:
        process.env.SOURCE_WATSON_URL ||
        "https://gateway-fra.watsonplatform.net/assistant/api"
    }
  },
  TARGET: {
    DB: {
      DBNAME: process.env.TARGET_DB2_DBNAME || "BLUDB",
      HOSTNAME:
        process.env.TARGET_DB2_HOSTNAME ||
        "dashdb-txn-sbox-yp-dal09-04.services.dal.bluemix.net",
      UID: process.env.TARGET_DB2_UID || "hsp40824",
      PWD: process.env.TARGET_DB2_PWD || "cbqw+bc0nzkfh5p4",
      PORT: Number(process.env.TARGET_DB2_PORT) || 50000
    },
    WATSON_API: {
      USERNAME: process.env.TARGET_WATSON_USERNAME || "apikey",
      VERSION: process.env.TARGET_WATSON_VERSION || "2018-07-10",
      PASSWORD:
        process.env.TARGET_WATSON_PASSWORD ||
        "qGcsRSdAyHPv58cMuMiFxyoe5l9CyFKCk_awS8AIlq7m",
      URL:
        process.env.TARGET_WATSON_URL ||
        "https://gateway-fra.watsonplatform.net/assistant/api"
    }
  },
  MIGRATION_TOOL_PARAMETERS: {
    MIGRATE_ALL: false,
    SINGLE_WORKSPACE_ID:
      process.env.SINGLE_WORKSPACE_ID || "59297d1e-7d09-4ddc-a04f-c28ad3c8d517"
  }
};

export const IWatsonConfig = t.interface({
  USERNAME: NonEmptyString,
  VERSION: NonEmptyString,
  PASSWORD: NonEmptyString,
  URL: NonEmptyString
});
export type IWatsonConfig = t.TypeOf<typeof IWatsonConfig>;

export const IDatabaseConfig = t.interface({
  DBNAME: NonEmptyString,
  HOSTNAME: NonEmptyString,
  UID: NonEmptyString,
  PWD: NonEmptyString,
  PORT: t.number
});
export type IDatabaseConfig = t.TypeOf<typeof IDatabaseConfig>;

export const IEnvironmentConfig = t.intersection([
  t.interface({
    DB: IDatabaseConfig,
    WATSON_API: IWatsonConfig
  }),
  t.partial({
    BACKUP_DIRECTORY: NonEmptyString
  })
]);
export type IEnvironmentConfig = t.TypeOf<typeof IEnvironmentConfig>;

export const IMigrationParametersConfig = t.interface({
  MIGRATE_ALL: t.boolean,
  SINGLE_WORKSPACE_ID: t.string
});
export type IMigrationParametersConfig = t.TypeOf<
  typeof IMigrationParametersConfig
>;

export const IConfiguration = t.interface({
  SOURCE: IEnvironmentConfig,
  TARGET: IEnvironmentConfig,
  MIGRATION_TOOL_PARAMETERS: IMigrationParametersConfig
});
export type IConfiguration = t.TypeOf<typeof IConfiguration>;

export function getAppConfiguration(): Either<Error, IConfiguration> {
  // Retrieve server configuration
  return IConfiguration.decode(Configuration).mapLeft(err => {
    return new Error(`Cannot retrieve a valid Server Configuration: ${err}`);
  });
}
