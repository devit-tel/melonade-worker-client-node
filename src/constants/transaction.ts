import { getPrevState } from '../utils/constant';

export enum TransactionStates {
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  Running = 'RUNNING',
  Paused = 'PAUSED',
  Cancelled = 'CANCELLED',
  Compensated = 'COMPENSATED',
}

export const TransactionNextStates = {
  [TransactionStates.Completed]: [],
  [TransactionStates.Failed]: [],
  [TransactionStates.Running]: [
    TransactionStates.Completed,
    TransactionStates.Failed,
    TransactionStates.Running,
    TransactionStates.Paused,
    TransactionStates.Cancelled,
    TransactionStates.Compensated,
  ],
  [TransactionStates.Paused]: [
    TransactionStates.Completed,
    TransactionStates.Failed,
    TransactionStates.Running,
    TransactionStates.Cancelled,
    TransactionStates.Compensated,
  ],
  [TransactionStates.Cancelled]: [],
  [TransactionStates.Compensated]: [],
};

const workflowPrevStateGetter = getPrevState(TransactionNextStates);

export const TransactionPrevStates = {
  [TransactionStates.Completed]: workflowPrevStateGetter(
    TransactionStates.Completed,
  ),
  [TransactionStates.Failed]: workflowPrevStateGetter(TransactionStates.Failed),
  [TransactionStates.Running]: workflowPrevStateGetter(
    TransactionStates.Running,
  ),
  [TransactionStates.Paused]: workflowPrevStateGetter(TransactionStates.Paused),
  [TransactionStates.Cancelled]: workflowPrevStateGetter(
    TransactionStates.Cancelled,
  ),
  [TransactionStates.Compensated]: workflowPrevStateGetter(
    TransactionStates.Compensated,
  ),
};
