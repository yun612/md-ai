import type {
  ChatMessage,
  Config,
  Project,
  Task,
} from '@grisaiaevy/crafting-agent'
import type { EntityTable } from 'dexie'
import { TaskStorage } from '@grisaiaevy/crafting-agent'
import Dexie from 'dexie'

class TaskDatabase extends Dexie {
  tasks!: EntityTable<Task, `id`>
  projects!: EntityTable<Project, `id`>
  configs!: EntityTable<Config, `id`>
  chatMessages!: EntityTable<ChatMessage, `id`>

  constructor() {
    super(`TaskDatabase`)

    this.version(1).stores({
      tasks: `id, projectId, createdAt, updatedAt`,
      projects: `id, createdAt, updatedAt`,
      configs: `id, [category+key], category, key`,
      chatMessages: `id, taskId, projectId, conversationRound, messageOrder, createdAt`,
    })
  }
}

export class IndexedDBTaskStorage extends TaskStorage {
  private db: TaskDatabase

  constructor() {
    super()
    this.db = new TaskDatabase()
  }

  async getTaskById(id: string): Promise<Task | null> {
    const task = await this.db.tasks.get(id)
    return task || null
  }

  async createOrUpdateTask(task: Task): Promise<Task | null> {
    if (!task.id) {
      task.id = this.generateId()
    }

    const existingTask = await this.db.tasks.get(task.id)
    const updatedTask: Task = {
      ...existingTask,
      ...task,
      id: task.id,
      updatedAt: new Date(),
      createdAt: existingTask?.createdAt || new Date(),
    }

    await this.db.tasks.put(updatedTask)
    console.log(`[IndexedDBStorage] Task created/updated:`, updatedTask)
    return updatedTask
  }

  async getTasksByProjectId(projectId: string): Promise<Task[]> {
    return await this.db.tasks
      .where(`projectId`)
      .equals(projectId)
      .toArray()
  }

  async getProjectById(id: string): Promise<Project | null> {
    const project = await this.db.projects.get(id)
    return project || null
  }

  async createOrUpdateProject(project: Project): Promise<Project | null> {
    if (!project.id) {
      project.id = this.generateId()
    }

    const existingProject = await this.db.projects.get(project.id)
    const updatedProject: Project = {
      ...existingProject,
      ...project,
      id: project.id,
      updatedAt: new Date(),
      createdAt: existingProject?.createdAt || new Date(),
    }

    await this.db.projects.put(updatedProject)
    console.log(`[IndexedDBStorage] Project created/updated:`, updatedProject)
    return updatedProject
  }

  async getAllProjects(): Promise<Project[]> {
    return await this.db.projects.toArray()
  }

  async createConfig(data: Config): Promise<Config> {
    let id = data.id

    if (data.key && data.category) {
      const existing = await this.getConfigByKey(data.key, data.category)
      if (existing) {
        id = existing.id
      }
      else if (!id) {
        id = this.generateId()
      }
    }
    else if (!id) {
      id = this.generateId()
    }

    const config: Config = {
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.db.configs.put(config)
    console.log(`[IndexedDBStorage] Config created/updated:`, config)
    return config
  }

  async getConfigByKey(
    key: string,
    category?: string,
  ): Promise<Config | null> {
    let query = this.db.configs.where(`key`).equals(key)

    if (category) {
      query = this.db.configs.where(`[category+key]`).equals([category, key])
    }

    const config = await query.first()
    return config || null
  }

  async getConfigsByCategory(category: string): Promise<Config[]> {
    return await this.db.configs.where(`category`).equals(category).toArray()
  }

  async deleteConfig(id: string): Promise<void> {
    await this.db.configs.delete(id)
    console.log(`[IndexedDBStorage] Config deleted:`, id)
  }

  async createChatMessage(data: ChatMessage): Promise<ChatMessage> {
    if (!data.id) {
      data.id = this.generateId()
    }

    if (!data.taskId) {
      throw new Error(`taskId is required for chat message`)
    }

    const message: ChatMessage = {
      ...data,
      id: data.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.db.chatMessages.add(message)
    console.log(`[IndexedDBStorage] Chat message created:`, message)
    return message
  }

  async getChatMessagesByTaskId(taskId: string): Promise<ChatMessage[]> {
    return await this.db.chatMessages
      .where(`taskId`)
      .equals(taskId)
      .sortBy(`conversationRound`)
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  async clearAll(): Promise<void> {
    await Promise.all([
      this.db.tasks.clear(),
      this.db.projects.clear(),
      this.db.configs.clear(),
      this.db.chatMessages.clear(),
    ])
    console.log(`[IndexedDBStorage] All data cleared`)
  }

  async getDebugInfo(): Promise<{
    tasks: Task[]
    projects: Project[]
    configs: Config[]
    messagesCount: number
  }> {
    const [tasks, projects, configs, messageCount] = await Promise.all([
      this.db.tasks.toArray(),
      this.db.projects.toArray(),
      this.db.configs.toArray(),
      this.db.chatMessages.count(),
    ])

    return {
      tasks,
      projects,
      configs,
      messagesCount: messageCount,
    }
  }

  async clearConfigsByCategory(category: string): Promise<void> {
    await this.db.configs.where(`category`).equals(category).delete()
    console.log(`[IndexedDBStorage] Configs cleared for category:`, category)
  }
}
