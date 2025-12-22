/**
 * Task Module for md-ai
 *
 * 提供基于 @crafting-agent/shared 的任务执行能力
 * 适配浏览器环境，不依赖 Node.js 文件系统
 */

export { DummyTaskStorage } from './dummy_storage'
export {
  createTask,
  type ModelConfig,
  runSimpleTask,
  startTaskWithStreaming,
  type TaskContext,
  type TaskExecutor,
} from './task'
