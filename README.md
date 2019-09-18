# node-saga-pm

This is prototype of saga implementation, written in Node.

## Tasks

- [x] Workflow Definition
- [x] Task Definition
- [x] Workflow Instance
- [x] Task Instance
- [x] State Translation
- [x] Store
- [x] Refacetor code, move to their's domain
- [x] Dispatcher
- [x] Consumer
- [x] Config
- [ ] Logger
- [ ] Use custom error
- [x] Clean up completed workflows/tasks
- [ ] Delay dispatcher
- [ ] Cron job
- [x] Failed workflow handling
- [x] Timeout workflow handling
- [ ] Cancle workflow
- [ ] Event store
- [x] Compensate workflow
- [x] Publish event to kafka
- [x] Update Workflow/Transaction's output
- [ ] Time keeper
- [ ] Refactor redundant action in "STATE"

## Known issues

- [ ] parallel tasks can be empty
- [ ] Sub workflow won't get compensate
- [ ] Task/Workflow data send as string's ISO time format instead of number
