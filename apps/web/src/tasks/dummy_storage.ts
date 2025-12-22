import type {
  ChatMessage,
  Config,
  Project,
  TaskType,
} from '@crafting-agent/shared'
import { TaskStorage } from '@crafting-agent/shared'

/**
 * DummyTaskStorage - 浏览器端内存存储实现
 * 用于 md-ai 前端环境，不依赖 Node.js 的文件系统或数据库
 * 所有数据存储在内存中，刷新页面后数据会丢失
 */
export class DummyTaskStorage extends TaskStorage {
  private tasks: Map<string, TaskType> = new Map()
  private projects: Map<string, Project> = new Map()
  private configs: Map<string, Config> = new Map()
  private chatMessages: Map<string, ChatMessage[]> = new Map()

  /* Task Methods */
  async getTaskById(id: string): Promise<TaskType | null> {
    return this.tasks.get(id) || null
  }

  async createOrUpdateTask(task: TaskType): Promise<TaskType | null> {
    if (!task.id) {
      task.id = this.generateId()
    }

    const existingTask = this.tasks.get(task.id)
    const updatedTask = {
      ...existingTask,
      ...task,
      updatedAt: new Date(),
      createdAt: existingTask?.createdAt || new Date(),
    }

    this.tasks.set(task.id, updatedTask)
    console.log(`[DummyStorage] Task created/updated:`, updatedTask)
    return updatedTask
  }

  async getTasksByProjectId(projectId: string): Promise<TaskType[]> {
    return Array.from(this.tasks.values()).filter(
      task => task.projectId === projectId,
    )
  }

  /* Project Methods */
  async getProjectById(id: string): Promise<Project | null> {
    return this.projects.get(id) || null
  }

  async createOrUpdateProject(project: Project): Promise<Project | null> {
    if (!project.id) {
      project.id = this.generateId()
    }

    const existingProject = this.projects.get(project.id)
    const updatedProject = {
      ...existingProject,
      ...project,
      updatedAt: new Date(),
      createdAt: existingProject?.createdAt || new Date(),
    }

    this.projects.set(project.id, updatedProject)
    console.log(`[DummyStorage] Project created/updated:`, updatedProject)
    return updatedProject
  }

  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values())
  }

  /* Config Methods */
  async createConfig(data: Config): Promise<Config> {
    if (!data.id) {
      data.id = this.generateId()
    }

    const config = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const key = this.getConfigKey(data.key || ``, data.category)
    this.configs.set(key, config)
    console.log(`[DummyStorage] Config created:`, config)
    return config
  }

  async getConfigByKey(
    key: string,
    category?: string,
  ): Promise<Config | null> {
    const configKey = this.getConfigKey(key, category)
    return this.configs.get(configKey) || null
  }

  /* ChatMessage Methods */
  async createChatMessage(data: ChatMessage): Promise<ChatMessage> {
    if (!data.id) {
      data.id = this.generateId()
    }

    if (!data.taskId) {
      throw new Error(`taskId is required for chat message`)
    }

    const message = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const messages = this.chatMessages.get(data.taskId) || []
    messages.push(message)
    this.chatMessages.set(data.taskId, messages)

    console.log(`[DummyStorage] Chat message created:`, message)
    return message
  }

  async getChatMessagesByTaskId(taskId: string): Promise<ChatMessage[]> {
    return this.chatMessages.get(taskId) || []
  }

  /* Helper Methods */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  private getConfigKey(key: string, category?: string): string {
    return category ? `${category}:${key}` : key
  }

  /* Debug Methods */
  /**
   * 清空所有数据（用于调试）
   */
  clearAll(): void {
    this.tasks.clear()
    this.projects.clear()
    this.configs.clear()
    this.chatMessages.clear()
    console.log(`[DummyStorage] All data cleared`)
  }

  /**
   * 获取所有存储的数据（用于调试）
   */
  getDebugInfo(): {
    tasks: TaskType[]
    projects: Project[]
    configs: Config[]
    messagesCount: number
  } {
    return {
      tasks: Array.from(this.tasks.values()),
      projects: Array.from(this.projects.values()),
      configs: Array.from(this.configs.values()),
      messagesCount: Array.from(this.chatMessages.values()).reduce(
        (sum, msgs) => sum + msgs.length,
        0,
      ),
    }
  }
}
