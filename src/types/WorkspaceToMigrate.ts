import * as t from "io-ts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

export const WorkspaceToMigrate = t.interface({
  dbWorkspaceName: NonEmptyString,
  workspace: t.any
});
export type WorkspaceToMigrate = t.TypeOf<typeof WorkspaceToMigrate>;

export const WorkspacesToMigrate = t.readonlyArray(WorkspaceToMigrate);
export type WorkspacesToMigrate = t.TypeOf<typeof WorkspacesToMigrate>;
