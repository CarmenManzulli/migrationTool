import { WorkspaceExport } from "watson-developer-cloud/assistant/v1";
import { WorkspaceDbModel } from "../models/WorkspaceDbModel";

export interface IWorkspaceToMigrate {
  readonly workspaceExport: WorkspaceExport;
  readonly workspaceDbModel: WorkspaceDbModel;
}
