import { State, Task } from '@melonade/melonade-declaration';

export {
  Command,
  Event,
  State,
  Task,
  TaskDefinition,
  Transaction,
  Workflow,
  WorkflowDefinition,
} from '@melonade/melonade-declaration';
export { Admin, IAdminConfig } from './admin';
export { ISyncUpdateTask, ISyncWorkerConfig, SyncWorker } from './syncWorker';
export { ITaskRef, ITaskResponse, IWorkerConfig, Worker } from './worker';

export const TaskStates = State.TaskStates;

export interface ITask extends Task.ITask {}
