import { enumToList } from '../utils/common';
import { getPrevState } from '../utils/constant';

export enum TaskTypes {
  Task = 'TASK',
  Compensate = 'COMPENSATE',
  Parallel = 'PARALLEL',
  SubWorkflow = 'SUB_WORKFLOW',
  Decision = 'DECISION',
}

export const TaskTypesList = enumToList(TaskTypes);

export enum TaskStates {
  Scheduled = 'SCHEDULED',
  Inprogress = 'INPROGRESS',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  Timeout = 'TIMEOUT',
}

export const TaskNextStates = {
  [TaskStates.Scheduled]: [TaskStates.Inprogress, TaskStates.Timeout],
  [TaskStates.Inprogress]: [
    TaskStates.Completed,
    TaskStates.Failed,
    TaskStates.Inprogress,
    TaskStates.Timeout,
  ],
  [TaskStates.Completed]: [],
  [TaskStates.Failed]: [],
  [TaskStates.Timeout]: [],
};

const taskPrevStateGetter = getPrevState(TaskNextStates);

export const TaskPrevStates = {
  [TaskStates.Scheduled]: taskPrevStateGetter(TaskStates.Scheduled),
  [TaskStates.Inprogress]: taskPrevStateGetter(TaskStates.Inprogress),
  [TaskStates.Completed]: taskPrevStateGetter(TaskStates.Completed),
  [TaskStates.Failed]: taskPrevStateGetter(TaskStates.Failed),
  [TaskStates.Timeout]: taskPrevStateGetter(TaskStates.Timeout),
};

export const TaskNextStatesSystem = {
  [TaskStates.Scheduled]: [
    TaskStates.Inprogress,
    TaskStates.Timeout,
    TaskStates.Completed,
  ],
  [TaskStates.Inprogress]: [
    TaskStates.Completed,
    TaskStates.Failed,
    TaskStates.Timeout,
    TaskStates.Inprogress,
  ],
  [TaskStates.Completed]: [],
  [TaskStates.Failed]: [TaskStates.Scheduled],
  [TaskStates.Timeout]: [TaskStates.Scheduled],
};

const systemTaskPrevStateGetter = getPrevState(TaskNextStatesSystem);

export const SystemTaskPrevStates = {
  [TaskStates.Scheduled]: systemTaskPrevStateGetter(TaskStates.Scheduled),
  [TaskStates.Inprogress]: systemTaskPrevStateGetter(TaskStates.Inprogress),
  [TaskStates.Completed]: systemTaskPrevStateGetter(TaskStates.Completed),
  [TaskStates.Failed]: systemTaskPrevStateGetter(TaskStates.Failed),
  [TaskStates.Timeout]: systemTaskPrevStateGetter(TaskStates.Timeout),
};

// https://docs.confluent.io/current/installation/configuration/topic-configs.html
export interface TopicConfigurations {
  'cleanup.policy'?: 'compact' | 'delete';
  'compression.type'?:
    | 'uncompressed'
    | 'zstd'
    | 'lz4'
    | 'snappy'
    | 'gzip'
    | 'producer';
  'delete.retention.ms'?: string;
  'file.delete.delay.ms'?: string;
  'flush.messages'?: string;
  'flush.ms'?: string;
  'follower.replication.throttled.replicas'?: string;
  'index.interval.bytes'?: string;
  'leader.replication.throttled.replicas'?: string;
  'max.message.bytes'?: string;
  'message.format.version'?: string;
  'message.timestamp.difference.max.ms'?: string;
  'message.timestamp.type'?: string;
  'min.cleanable.dirty.ratio'?: string;
  'min.compaction.lag.ms'?: string;
  'min.insync.replicas'?: string;
  preallocate?: string;
  'retention.bytes'?: string;
  'retention.ms'?: string;
  'segment.bytes'?: string;
  'segment.index.bytes'?: string;
  'segment.jitter.ms'?: string;
  'segment.ms'?: string;
  'unclean.leader.election.enable'?: boolean;
  'message.downconversion.enable'?: boolean;
}
