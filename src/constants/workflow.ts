import { getPrevState } from '../utils/constant';

export enum WorkflowStates {
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  Timeout = 'TIMEOUT',
  Running = 'RUNNING',
  Paused = 'PAUSED',
  Cancelled = 'CANCELLED',
}

export enum FailureStrategies {
  Failed = 'FAILED',
  RecoveryWorkflow = 'RECOVERY_WORKFLOW',
  Retry = 'RETRY',
  Compensate = 'COMPENSATE',
  CompensateThenRetry = 'COMPENSATE_THEN_RETRY',
}

export enum WorkflowTypes {
  Workflow = 'WORKFLOW', // When Completed make transaction COMPLETED
  SubWorkflow = 'SUB_WORKFLOW', // When Completed make parent task COMPLETED
  CompensateWorkflow = 'COMPENSATE_WORKFLOW', // When Completed Make Transaction CANCELLED
  CompensateThenRetryWorkflow = 'COMPENSATE_THEN_WORKFLOW', // When Completed Start original workflow
}

export const WorkflowNextStates = {
  [WorkflowStates.Completed]: [],
  [WorkflowStates.Failed]: [],
  [WorkflowStates.Timeout]: [],
  [WorkflowStates.Running]: [
    WorkflowStates.Completed,
    WorkflowStates.Failed,
    WorkflowStates.Running,
    WorkflowStates.Timeout,
    WorkflowStates.Paused,
    WorkflowStates.Cancelled,
  ],
  [WorkflowStates.Paused]: [
    WorkflowStates.Completed,
    WorkflowStates.Failed,
    WorkflowStates.Running,
    WorkflowStates.Timeout,
    WorkflowStates.Cancelled,
  ],
  [WorkflowStates.Cancelled]: [],
};

const workflowPrevStateGetter = getPrevState(WorkflowNextStates);

export const WorkflowPrevStates = {
  [WorkflowStates.Completed]: workflowPrevStateGetter(WorkflowStates.Completed),
  [WorkflowStates.Failed]: workflowPrevStateGetter(WorkflowStates.Failed),
  [WorkflowStates.Timeout]: workflowPrevStateGetter(WorkflowStates.Timeout),
  [WorkflowStates.Running]: workflowPrevStateGetter(WorkflowStates.Running),
  [WorkflowStates.Paused]: workflowPrevStateGetter(WorkflowStates.Paused),
  [WorkflowStates.Cancelled]: workflowPrevStateGetter(WorkflowStates.Cancelled),
};
