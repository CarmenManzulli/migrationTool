/**
 * Configuration
 * Configurations for Migration Tool
 */
import { Either } from "fp-ts/lib/Either";
import * as t from "io-ts";
import { reporters } from "italia-ts-commons";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { isNullOrUndefined } from "util";

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
        "baz7-IqfcrUhfZuSAhHme2BsnsYX6yoQtMHa4ACLt16M",
      URL:
        process.env.TARGET_WATSON_URL ||
        "https://gateway-fra.watsonplatform.net/assistant/api"
    }
  },
  MIGRATION_TOOL_PARAMETERS: {
    MIGRATE_ALL: getBoolValueFromProcessEnv(process.env.MIGRATE_ALL, false),
    SINGLE_WORKSPACE_ID:
      process.env.SINGLE_WORKSPACE_ID || "7cfe35a9-f710-4ddb-87bd-9015782aaa72"
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
  SINGLE_WORKSPACE_ID: NonEmptyString
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

export function getBoolValueFromProcessEnv(
  value: string,
  defaultValue: boolean
): boolean | string {
  if (isNullOrUndefined(value)) {
    return defaultValue;
  } else if (value === "1" || value.toLowerCase() === "true") {
    return true;
  } else if (value === "0" || value.toLowerCase() === "false") {
    return false;
  }
  return value;
}

export function getAppConfiguration(): Either<Error, IConfiguration> {
  // Retrieve server configuration
  return IConfiguration.decode(Configuration).mapLeft(err => {
    return Error(
      `Cannot retrieve a valid Server Configuration: ${reporters.readableReport(
        err
      )}`
    );
  });
}
