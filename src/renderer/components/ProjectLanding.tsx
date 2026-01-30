import React, { useState, useCallback } from 'react';
import { useProject, Project } from '../contexts';
import './ProjectLanding.css';

interface ProjectLandingProps {
  onOpenSettings?: () => void;
}

export function ProjectLanding({ onOpenSettings }: ProjectLandingProps) {
  const { state, createProject, openProject, deleteProject } = useProject();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; project: Project } | null>(null);

  const handleCreateProject = useCallback(async () => {
    if (!projectName.trim()) return;
    setIsCreating(true);
    await createProject(projectName.trim());
    setIsCreating(false);
    setShowCreateModal(false);
    setProjectName('');
  }, [projectName, createProject]);

  const handleOpenProject = useCallback(async (projectId: string) => {
    await openProject(projectId);
  }, [openProject]);

  const handleContextMenu = useCallback((e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, project });
  }, []);

  const handleDeleteProject = useCallback(async (deleteFiles: boolean) => {
    if (contextMenu?.project) {
      await deleteProject(contextMenu.project.id, deleteFiles);
      setContextMenu(null);
    }
  }, [contextMenu, deleteProject]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="project-landing" onClick={closeContextMenu}>
      {/* Header */}
      <header className="project-landing__header">
        <div className="project-landing__logo">
          <span className="project-landing__logo-icon">P</span>
          <span className="project-landing__logo-text">Promptbook</span>
        </div>
        <button className="project-landing__settings-btn" onClick={onOpenSettings} title="Settings">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="10" cy="10" r="3" />
            <path d="M10 1v2M10 17v2M1 10h2M17 10h2M3.5 3.5l1.5 1.5M15 15l1.5 1.5M3.5 16.5l1.5-1.5M15 5l1.5-1.5" />
          </svg>
        </button>
      </header>

      {/* Main content */}
      <main className="project-landing__main">
        <div className="project-landing__welcome">
          <h1>Welcome to Promptbook</h1>
          <p>Create or open a project to get started</p>
        </div>

        {/* Create new project button */}
        <button className="project-landing__create-btn" onClick={() => setShowCreateModal(true)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Project
        </button>

        {/* Recent projects */}
        {state.recentProjects.length > 0 && (
          <section className="project-landing__section">
            <h2>Recent Projects</h2>
            <div className="project-landing__grid">
              {state.recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="project-card"
                  onClick={() => handleOpenProject(project.id)}
                  onContextMenu={(e) => handleContextMenu(e, project)}
                >
                  <div className="project-card__icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 7v13a2 2 0 002 2h14a2 2 0 002-2V7" />
                      <path d="M3 7l3-4h12l3 4" />
                      <path d="M12 11v6M9 14h6" />
                    </svg>
                  </div>
                  <div className="project-card__content">
                    <h3 className="project-card__name">{project.name}</h3>
                    <p className="project-card__path" title={project.path}>{project.path}</p>
                    <p className="project-card__date">{formatDate(project.lastOpened)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* All projects */}
        {state.projects.length > 0 && state.projects.length !== state.recentProjects.length && (
          <section className="project-landing__section">
            <h2>All Projects</h2>
            <div className="project-landing__list">
              {state.projects
                .filter((p) => !state.recentProjects.find((r) => r.id === p.id))
                .map((project) => (
                  <div
                    key={project.id}
                    className="project-list-item"
                    onClick={() => handleOpenProject(project.id)}
                    onContextMenu={(e) => handleContextMenu(e, project)}
                  >
                    <span className="project-list-item__name">{project.name}</span>
                    <span className="project-list-item__path">{project.path}</span>
                    <span className="project-list-item__date">{formatDate(project.lastOpened)}</span>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {state.projects.length === 0 && !state.isLoading && (
          <div className="project-landing__empty">
            <div className="project-landing__empty-art">
              <pre>{`
    ____                            __  __                __
   / __ \\_________  ____ ___  ____  / /_/ /_  ____  ____  / /__
  / /_/ / ___/ __ \\/ __ \`__ \\/ __ \\/ __/ __ \\/ __ \\/ __ \\/ //_/
 / ____/ /  / /_/ / / / / / / /_/ / /_/ /_/ / /_/ / /_/ / ,<
/_/   /_/   \\____/_/ /_/ /_/ .___/\\__/_.___/\\____/\\____/_/|_|
                         /_/
              `}</pre>
            </div>
            <p>No projects yet. Create your first project to begin.</p>
          </div>
        )}
      </main>

      {/* Create project modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Project</h2>
            <div className="modal__form">
              <label>
                Project Name
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="my-notebook-project"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateProject();
                    if (e.key === 'Escape') setShowCreateModal(false);
                  }}
                />
              </label>
              <p className="modal__hint">
                Project will be created at: {state.settings?.projectsRootPath}/{projectName || 'project-name'}
              </p>
            </div>
            <div className="modal__actions">
              <button className="modal__btn modal__btn--secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button
                className="modal__btn modal__btn--primary"
                onClick={handleCreateProject}
                disabled={!projectName.trim() || isCreating}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { handleOpenProject(contextMenu.project.id); setContextMenu(null); }}>
            Open Project
          </button>
          <hr />
          <button onClick={() => handleDeleteProject(false)}>Remove from List</button>
          <button className="context-menu__danger" onClick={() => handleDeleteProject(true)}>
            Delete Project & Files
          </button>
        </div>
      )}
    </div>
  );
}
