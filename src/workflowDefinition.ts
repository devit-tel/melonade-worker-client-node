import { FailureStrategies } from './constants/workflow';
import { TaskTypes } from './constants/task';

export interface IBaseTask {
  name: string;
  taskReferenceName: string;
  inputParameters: {
    [key: string]: string | number;
  };
}

export interface ITaskTask extends IBaseTask {
  type: TaskTypes.Task;
  retry?: {
    limit: number;
    delay: number;
  };
  ackTimeout?: number;
  timeout?: number;
}

export interface ICompensateTask extends IBaseTask {
  type: TaskTypes.Compensate;
}

export interface IParallelTask extends IBaseTask {
  type: TaskTypes.Parallel;
  parallelTasks: AllTaskType[][];
}
export interface ISubWorkflowTask extends IBaseTask {
  type: TaskTypes.SubWorkflow;
  workflow: {
    name: string;
    rev: string;
  };
}

export interface IDecisionTask extends IBaseTask {
  type: TaskTypes.Decision;
  decisions: {
    [decision: string]: AllTaskType[];
  };
  defaultDecision: AllTaskType[];
}

export type AllTaskType =
  | ITaskTask
  | ICompensateTask
  | IParallelTask
  | ISubWorkflowTask
  | IDecisionTask;

export interface IWorkflowDefinition {
  name: string;
  rev: string;
  description?: string;
  tasks: AllTaskType[];
  failureStrategy: FailureStrategies;
  retry?: {
    limit: number;
    delay: number;
  };
  recoveryWorkflow?: {
    name: string;
    rev: string;
  };
}
