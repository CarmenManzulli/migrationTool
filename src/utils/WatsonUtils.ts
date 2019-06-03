/**
 * WatsonUtils
 * Provide a library to use Watson Services
 */
import { Either, left, right } from "fp-ts/lib/Either";
import * as t from "io-ts";
import * as watson from "watson-developer-cloud";
import {
  CreateDialogNode,
  CreateEntity,
  CreateExample,
  CreateIntent,
  CreateWorkspaceParams,
  DialogNode,
  GetWorkspaceParams,
  IntentExport,
  ValueExport,
  Workspace,
  WorkspaceExport,
  UpdateWorkspaceParams
} from "watson-developer-cloud/assistant/v1";
import {
  CreateValue,
  DeleteWorkspaceParams,
  EntityExport,
  Example,
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

// delete single workspace
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
// get workspace information by id
export function getWorkspaceInformationById(
  watsonAssistantClient: watson.AssistantV1,
  workspaceId: string
): Promise<Either<Error, WorkspaceExport>> {
  logger.info(`Retrieving Information about a workspace Id`, workspaceId);
  return new Promise<Either<Error, WorkspaceExport>>(resolve => {
    watsonAssistantClient.getWorkspace(
      { workspace_id: workspaceId, export: true } as GetWorkspaceParams,
      (err, response) => {
        resolve(decodeWatsonResponse(err, response));
      }
    );
  });
}

// upload always a single workspace
export function uploadWorkspaceInformationById(
  watsonAssistantClient: watson.AssistantV1,
  workspace: UpdateWorkspaceParams
): Promise<Either<Error, Workspace>> {
  logger.info(`Upload workspace to target`);
  return new Promise<Either<Error, Workspace>>(resolve => {
    watsonAssistantClient.updateWorkspace(workspace, (err, response) => {
      console.log("---> ", response, "\n\n", err.status);
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
  logger.info(`Retrieving Workspace List from Watson`);
  return new Promise<Either<Error, WorkspaceCollection>>(resolve => {
    watsonAssistantClient.listWorkspaces({}, (err, response) => {
      resolve(decodeWatsonResponse(err, response));
    });
  });
}

// create single workspace
export function createWorkspace(
  watsonAssistantClient: watson.AssistantV1,
  workspace: WorkspaceExport
): Promise<Either<Error, Workspace>> {
  logger.info(`Create workspace for Target`);
  return new Promise<Either<Error, Workspace>>(resolve => {
    const params = {
      name: workspace.name,
      description: workspace.description,
      language: workspace.language,
      intents: convertIntentExportIntoCreateIntent(workspace.intents),
      entities: convertEntityExportIntoCreateEntity(workspace.entities),
      dialog_nodes: convertDialogExportIntoCreateDialog(workspace.dialog_nodes),
      counterexamples: workspace.counterexamples,
      metadata: workspace.metadata,
      learning_opt_out: workspace.learning_opt_out,
      system_settings: workspace.system_settings
    } as CreateWorkspaceParams;
    watsonAssistantClient.createWorkspace(params, (err, response) => {
      resolve(decodeWatsonResponse(err, response));
    });
  });
}

export function convertExamplesExportIntoCreateExamples(
  exampleExportList: ReadonlyArray<Example>
): ReadonlyArray<CreateExample> {
  return exampleExportList.map(
    (exampleExport: Example): CreateExample => {
      return {
        text: exampleExport.example_text,
        mentions: exampleExport.mentions
      };
    }
  );
}

export function convertIntentExportIntoCreateIntent(
  intentExportList: ReadonlyArray<IntentExport>
): ReadonlyArray<CreateIntent> {
  return intentExportList.map(
    (intentExport: IntentExport): CreateIntent => {
      return {
        intent: intentExport.intent_name,
        description: intentExport.intent_name,
        examples: convertExamplesExportIntoCreateExamples(intentExport.examples)
      } as CreateIntent;
    }
  );
}

export function convertValuesExportIntoCreateValues(
  valuesExportList: ReadonlyArray<ValueExport>
): ReadonlyArray<CreateValue> {
  return valuesExportList.map(
    (valueExport: ValueExport): CreateValue => {
      return {
        value: valueExport.value_text,
        metadata: valueExport.metadata,
        synonyms: valueExport.synonyms,
        patterns: valueExport.patterns,
        value_type: valueExport.value_type
      };
    }
  );
}

export function convertEntityExportIntoCreateEntity(
  entityExportList: ReadonlyArray<EntityExport>
): ReadonlyArray<CreateEntity> {
  return entityExportList.map(
    (entityExport: EntityExport): CreateEntity => {
      return {
        entity: entityExport.entity_name,
        description: entityExport.description,
        metadata: entityExport.metadata,
        fuzzy_match: entityExport.fuzzy_match,
        values: convertValuesExportIntoCreateValues(entityExport.values)
      } as CreateEntity;
    }
  );
}

export function convertDialogExportIntoCreateDialog(
  dialogExportList: ReadonlyArray<DialogNode>
): ReadonlyArray<CreateDialogNode> {
  return dialogExportList.map(
    (entityExport: DialogNode): CreateDialogNode => {
      return {
        dialog_node: entityExport.dialog_node_id,
        description: entityExport.description,
        conditions: entityExport.conditions,
        parent: entityExport.parent,
        previous_sibling: entityExport.previous_sibling,
        output: entityExport.output,
        context: entityExport.metadata,
        metadata: entityExport.metadata,
        next_step: entityExport.next_step,
        actions: entityExport.actions,
        title: entityExport.title,
        node_type: entityExport.node_type,
        event_name: entityExport.event_name,
        variable: entityExport.variable,
        digress_in: entityExport.digress_in,
        digress_out: entityExport.digress_out,
        digress_out_slots: entityExport.digress_out_slots,
        user_label: entityExport.user_label
      } as CreateDialogNode;
    }
  );
}
