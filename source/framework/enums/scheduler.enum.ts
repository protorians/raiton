export enum TaskTriggerEnum {
    Cron = 'cron',
    Interval = 'interval',
    Timeout = 'timeout',
    Task = 'task',
}

export enum TaskStatusEnum {
    Pending = 'pending',
    Running = 'running',
    Completed = 'completed',
    Failed = 'failed',
    Cancelled = 'cancelled',
    TimedOut = 'timed-out',
}

export enum TaskPriorityEnum {
    Lowest = 'lowest',
    Low = 'low',
    Normal = 'normal',
    High = 'high',
    Highest = 'highest',
}
