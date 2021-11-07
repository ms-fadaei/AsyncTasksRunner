import { RunSerialTasksResult, Task } from "./types.ts";
import { BaseTasksRunner } from "./base-tasks-runner.ts";

export type { RunSerialTasksResult } from "./types.ts";

export class SerialTasksRunner<T> extends BaseTasksRunner<T> {
  protected tasks: Task<T>[];

  constructor(...tasks: Task<T>[]) {
    super();
    this.tasks = tasks;
  }

  public async runTasks(): RunSerialTasksResult<T> {
    // add all tasks to the running tasks list on first run
    if (this.status === "open") {
      this.status = "pending";
    }

    const results: PromiseSettledResult<T>[] = [];
    const taskIterator = this.iterateTasks();

    let nextTask = taskIterator.next();
    while (!nextTask.done) {
      try {
        // run tasks one by one
        const result = await nextTask.value;
        results.push({
          status: "fulfilled",
          value: result,
        });
      } catch (error) {
        // if task failed, the runner stops running tasks
        this.status = "rejected";
        results.push({
          status: "rejected",
          reason: error.message || error,
        });
        return Promise.reject(results);
      }

      nextTask = taskIterator.next();
    }

    this.status = "fulfilled";
    return Promise.resolve(results);
  }

  private * iterateTasks(): Generator<Promise<T>> {
    for (let i = 0; i < this.tasks.length; i++) {
      // start running the task if it's not already running
      if (!(i in this.runningTasks)) {
        this.runningTasks.push(this.tasks[i]());
      }

      yield this.runningTasks[i];
    }
  }

  public async getRunningTask(index: number): Promise<T> {
    if (this.status === "open") {
      return Promise.reject(new Error("Task runner is open"));
    }

    // show error if the index is out of bounds
    if (index < 0 || index >= this.tasks.length) {
      return Promise.reject(new Error("Index out of bounds"));
    }

    // return the task if it's already running
    if (index in this.runningTasks) {
      return this.runningTasks[index];
    }

    // run tasks one by one until the index is reached
    const taskIterator = this.iterateTasks();
    for (let i = 0; i < index; i++) {
      try {
        // run tasks one by one
        const nextTask = taskIterator.next()
        await nextTask.value;
      } catch {
        return Promise.reject(new Error("Task failed"));
      }
    }

    return taskIterator.next().value;
  }
}
