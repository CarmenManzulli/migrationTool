/**
 * WorkspaceDbModel
 * Define a model for Workspace record into DB
 */
import * as t from "io-ts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

export const WorkspaceDbModel = t.intersection([
  t.interface({
    workspaceName: NonEmptyString,
    workspaceLabel: NonEmptyString
  }),
  t.partial({
    workspaceId: NonEmptyString
  })
]);

export type WorkspaceDbModel = t.TypeOf<typeof WorkspaceDbModel>;

export const WorkspaceDbModelQueryItems = t.partial({
  workspaceId: NonEmptyString,
  workspaceName: NonEmptyString,
  workspaceLabel: NonEmptyString
});
export type WorkspaceDbModelQueryItems = t.TypeOf<
  typeof WorkspaceDbModelQueryItems
>;

export const WorkspaceWatsonDetails = t.interface({
  name: t.string,
  workspace_id: t.string
});
export type WorkspaceWatsonDetails = t.TypeOf<typeof WorkspaceWatsonDetails>;
