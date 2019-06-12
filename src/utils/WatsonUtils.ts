/**
 * WatsonUtils
 * Provide a library to use Watson Services
 */
import { Either, left, right } from "fp-ts/lib/Either";
import * as t from "io-ts";
import * as watson from "watson-developer-cloud";
import {
  GetWorkspaceParams,
  Workspace,
  WorkspaceExport,
  UpdateWorkspaceParams
} from "watson-developer-cloud/assistant/v1";
import {
  DeleteWorkspaceParams,
  WorkspaceCollection
} from "watson-developer-cloud/conversation/v1-generated";
import { Empty } from "watson-developer-cloud/natural-language-understanding/v1-generated";
import { IWatsonConfig } from "../Configuration";
import { logger } from "./Logger";

/**
 * Provide a Client for WatsonAssistant services
 * @param {IWatsonConfig} watsonConfig - Configuration used to define the client
 * @returns {Either<Error, watson.AssistantV1>} - The client or error
 */
export function getWatsonAssistantClient(
  watsonConfig: IWatsonConfig
): Either<Error, watson.AssistantV1> {
  try {
    logger.info("Creating WatsonAssistant Client...");
    return right(
      new watson.AssistantV1({
        version: watsonConfig.VERSION,
        username: watsonConfig.USERNAME,
        password: watsonConfig.PASSWORD,
        url: watsonConfig.URL
      })
    );
  } catch (exception) {
    const errMsg = `Cannot create a Watson Assistant Client`;
    logger.info(errMsg);
    return left(Error(errMsg));
  }
}

/**
 * Provide the error or the message contained into the Watson Assistant response
 * @param {mixed} err - The Watson Assistant error
 * @param {T} response - The Watson Assistant response
 * @returns {Either<Error, T>} - The Watson Assistant response or Error
 */
export function decodeWatsonResponse<T>(
  err: t.mixed,
  response: T
): Either<Error, T> {
  if (err) {
    const errMsg = `decodeWatsonResponse returned an error ${err}`;
    logger.info(errMsg);
    return left(Error(errMsg));
  }
  return right(response);
}

// Assistant API - Delete Workspace
export function deleteWorkspace(
  watsonAssistantClient: watson.AssistantV1,
  workspaceId: string
): Promise<Either<Error, Empty>> {
  logger.info(`Delete Workspace from Watson`);
  return new Promise<Either<Error, Empty>>(resolve => {
    watsonAssistantClient.deleteWorkspace(
      { workspace_id: workspaceId } as DeleteWorkspaceParams,
      (err, response) => {
        resolve(decodeWatsonResponse(err, response));
      }
    );
  });
}

// Assistant API - Get workspace information
export function getWorkspaceInformation(
  watsonAssistantClient: watson.AssistantV1,
  workspaceId: string
): Promise<Either<Error, WorkspaceExport>> {
  return new Promise<Either<Error, WorkspaceExport>>(resolve => {
    watsonAssistantClient.getWorkspace(
      { workspace_id: workspaceId, export: false } as GetWorkspaceParams,
      (err, response) => {
        resolve(decodeWatsonResponse(err, response));
      }
    );
  });
}

// Assistant API - Update Workspace
export function updateWorkspaceInformation(
  watsonAssistantClient: watson.AssistantV1,
  workspace: UpdateWorkspaceParams
): Promise<Either<Error, Workspace>> {
  return new Promise<Either<Error, Workspace>>(resolve => {
    watsonAssistantClient.updateWorkspace(workspace, (err, response) => {
      resolve(decodeWatsonResponse(err, response));
    });
  });
}

/**
 * Retrieve a list of workspaces
 * @param {watson.AssistantV1} watsonAssistantClient - The workspace client
 * @returns Promise<Either<Error, WorkspaceCollection>> - The Workspace Collection
 */
export async function getWorkspacesList(
  watsonAssistantClient: watson.AssistantV1
): Promise<Either<Error, WorkspaceCollection>> {
  return new Promise<Either<Error, WorkspaceCollection>>(resolve => {
    watsonAssistantClient.listWorkspaces({}, (err, response) => {
      resolve(decodeWatsonResponse(err, response));
    });
  });
}
