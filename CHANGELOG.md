## [0.23.0] - 2020-12-19

### Added

- Add batch timeout `batchTimeoutMs`

### Changed

- Change consume group id to melonade-${namespace}-client-${task_name}
- [private] Worker.consume() no longer throw error
- use `node-rdkafka.consumer.commitSync` instread of `commit()`
