import { RunSerialTasksResult, Task } from './types'
import { BaseTasksRunner } from './base-tasks-runner'

export type { RunSerialTasksResult } from './types'

export class SerialTasksRunner<T> extends BaseTasksRunner<T> {
  protected tasks: Task<T>[]

  constructor (...tasks: Task<T>[]) {
    super()
    this.tasks = tasks
  }

  public async run (): RunSerialTasksResult<T> {
    // add all tasks to the pending tasks list on first run
    if (this.status === 'load') {
      this.status = 'pending'
    }

    const results: PromiseSettledResult<T>[] = []
    const taskIterator = this.iterateTasks()

    let nextTask = taskIterator.next()
    while (!nextTask.done) {
      try {
        // run tasks one by one
        const result = await nextTask.value
        results.push({
          status: 'fulfilled',
          value: result
        })
      } catch (error) {
        // if task failed, the runner stops pending tasks
        this.status = 'rejected'
        results.push({
          status: 'rejected',
          reason: error
        })
        return Promise.reject(results)
      }

      nextTask = taskIterator.next()
    }

    this.status = 'fulfilled'
    return Promise.resolve(results)
  }

  private * iterateTasks (): Generator<Promise<T>> {
    for (let i = 0; i < this.tasks.length; i++) {
      // start pending the task if it's not already pending
      if (!(i in this.pendingTasks)) {
        this.pendingTasks.push(this.tasks[i]())
      }

      yield this.pendingTasks[i]
    }
  }

  public async get (index: number): Promise<T> {
    if (this.status === 'load') {
      return Promise.reject(new Error('Task runner is not yet started'))
    }

    // show error if the index is out of bounds
    if (index < 0 || index >= this.tasks.length) {
      return Promise.reject(new Error('Index out of bounds'))
    }

    // return the task if it's already pending
    if (index in this.pendingTasks) {
      return this.pendingTasks[index]
    }

    // run tasks one by one until the index is reached
    const taskIterator = this.iterateTasks()
    for (let i = 0; i < index; i++) {
      try {
        // run tasks one by one
        const nextTask = taskIterator.next()
        await nextTask.value
      } catch {
        return Promise.reject(new Error('Task failed before reach'))
      }
    }

    return taskIterator.next().value
  }
}
