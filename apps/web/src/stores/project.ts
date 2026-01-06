import type { Project } from '@grisaiaevy/crafting-agent'
import { IndexedDBTaskStorage } from '../agents/indexeddb_storage'

let storageInstance: IndexedDBTaskStorage | null = null

function getStorage(): IndexedDBTaskStorage {
  if (!storageInstance) {
    storageInstance = new IndexedDBTaskStorage()
  }
  return storageInstance
}

export const useProjectStore = defineStore(`project`, () => {
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)
  const isLoaded = ref(false)

  async function loadProjects() {
    const storage = getStorage()
    const allProjects = await storage.getAllProjects()
    projects.value = allProjects

    if (allProjects.length === 0) {
      const defaultProject = await storage.createOrUpdateProject({} as Project)
      if (defaultProject) {
        projects.value = [defaultProject]
        currentProject.value = defaultProject
      }
    }
    else {
      currentProject.value = allProjects[0]
    }

    isLoaded.value = true
  }

  async function createProject(name: string) {
    const storage = getStorage()
    const project = await storage.createOrUpdateProject({ name } as Project)
    if (project) {
      projects.value.push(project)
      return project
    }
    throw new Error(`Failed to create project`)
  }

  async function updateProject(project: Project) {
    const storage = getStorage()
    const updated = await storage.createOrUpdateProject(project)
    if (updated) {
      const index = projects.value.findIndex(p => p.id === project.id)
      if (index !== -1) {
        projects.value[index] = updated
      }
      if (currentProject.value?.id === project.id) {
        currentProject.value = updated
      }
      return updated
    }
    throw new Error(`Failed to update project`)
  }

  async function deleteProject(projectId: string) {
    const storage = getStorage()
    const db = (storage as any).db
    await db.projects.delete(projectId)
    projects.value = projects.value.filter(p => p.id !== projectId)

    if (currentProject.value?.id === projectId) {
      currentProject.value = projects.value[0] || null
    }
  }

  function setCurrentProject(project: Project) {
    currentProject.value = project
  }

  loadProjects()

  return {
    projects,
    currentProject,
    isLoaded,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    setCurrentProject,
  }
})

export default useProjectStore
