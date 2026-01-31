import React from 'react';
import { Project } from '../contexts';

// Helper function for formatting dates
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}

// Project card component for grid view
interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function ProjectCard({ project, onClick, onContextMenu }: ProjectCardProps) {
  return (
    <div
      className="project-card"
      onClick={onClick}
      onContextMenu={onContextMenu}
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
  );
}

// Project list item for list view
interface ProjectListItemProps {
  project: Project;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function ProjectListItem({ project, onClick, onContextMenu }: ProjectListItemProps) {
  return (
    <div
      className="project-list-item"
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <span className="project-list-item__name">{project.name}</span>
      <span className="project-list-item__path">{project.path}</span>
      <span className="project-list-item__date">{formatDate(project.lastOpened)}</span>
    </div>
  );
}

// Create project modal
interface CreateProjectModalProps {
  projectName: string;
  projectsRootPath: string | undefined;
  isCreating: boolean;
  onProjectNameChange: (name: string) => void;
  onClose: () => void;
  onCreate: () => void;
}

export function CreateProjectModal({
  projectName,
  projectsRootPath,
  isCreating,
  onProjectNameChange,
  onClose,
  onCreate,
}: CreateProjectModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Create New Project</h2>
        <div className="modal__form">
          <label>
            Project Name
            <input
              type="text"
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              placeholder="my-notebook-project"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCreate();
                if (e.key === 'Escape') onClose();
              }}
            />
          </label>
          <p className="modal__hint">
            Project will be created at: {projectsRootPath}/{projectName || 'project-name'}
          </p>
        </div>
        <div className="modal__actions">
          <button className="modal__btn modal__btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="modal__btn modal__btn--primary"
            onClick={onCreate}
            disabled={!projectName.trim() || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Context menu for project actions
interface ProjectContextMenuProps {
  x: number;
  y: number;
  project: Project;
  onOpen: () => void;
  onRemove: () => void;
  onDelete: () => void;
}

export function ProjectContextMenu({
  x,
  y,
  onOpen,
  onRemove,
  onDelete,
}: ProjectContextMenuProps) {
  return (
    <div
      className="context-menu"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onOpen}>
        Open Project
      </button>
      <hr />
      <button onClick={onRemove}>Remove from List</button>
      <button className="context-menu__danger" onClick={onDelete}>
        Delete Project & Files
      </button>
    </div>
  );
}

// Landing page header
interface LandingHeaderProps {
  onOpenSettings?: () => void;
}

export function LandingHeader({ onOpenSettings }: LandingHeaderProps) {
  return (
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
  );
}

// Empty state with ASCII art
export function LandingEmptyState() {
  return (
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
  );
}

// Recent projects section
interface RecentProjectsSectionProps {
  projects: Project[];
  onOpenProject: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, project: Project) => void;
}

export function RecentProjectsSection({ projects, onOpenProject, onContextMenu }: RecentProjectsSectionProps) {
  if (projects.length === 0) return null;
  return (
    <section className="project-landing__section">
      <h2>Recent Projects</h2>
      <div className="project-landing__grid">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onClick={() => onOpenProject(project.id)}
            onContextMenu={(e) => onContextMenu(e, project)}
          />
        ))}
      </div>
    </section>
  );
}

// All projects section (list view)
interface AllProjectsSectionProps {
  projects: Project[];
  onOpenProject: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, project: Project) => void;
}

export function AllProjectsSection({ projects, onOpenProject, onContextMenu }: AllProjectsSectionProps) {
  if (projects.length === 0) return null;
  return (
    <section className="project-landing__section">
      <h2>All Projects</h2>
      <div className="project-landing__list">
        {projects.map((project) => (
          <ProjectListItem
            key={project.id}
            project={project}
            onClick={() => onOpenProject(project.id)}
            onContextMenu={(e) => onContextMenu(e, project)}
          />
        ))}
      </div>
    </section>
  );
}
