import React, { useState, useCallback } from 'react';
import { useProject, Project } from '../contexts';
import {
  CreateProjectModal,
  ProjectContextMenu,
  LandingHeader,
  LandingEmptyState,
  RecentProjectsSection,
  AllProjectsSection,
} from './ProjectLandingComponents';
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

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const otherProjects = state.projects.filter((p) => !state.recentProjects.find((r) => r.id === p.id));

  return (
    <div className="project-landing" onClick={closeContextMenu}>
      <LandingHeader onOpenSettings={onOpenSettings} />

      <main className="project-landing__main">
        <div className="project-landing__welcome">
          <h1>Welcome to Promptbook</h1>
          <p>Create or open a project to get started</p>
        </div>

        <button className="project-landing__create-btn" onClick={() => setShowCreateModal(true)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Project
        </button>

        <RecentProjectsSection
          projects={state.recentProjects}
          onOpenProject={handleOpenProject}
          onContextMenu={handleContextMenu}
        />

        <AllProjectsSection
          projects={otherProjects}
          onOpenProject={handleOpenProject}
          onContextMenu={handleContextMenu}
        />

        {state.projects.length === 0 && !state.isLoading && <LandingEmptyState />}
      </main>

      {showCreateModal && (
        <CreateProjectModal
          projectName={projectName}
          projectsRootPath={state.settings?.projectsRootPath}
          isCreating={isCreating}
          onProjectNameChange={setProjectName}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateProject}
        />
      )}

      {contextMenu && (
        <ProjectContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          project={contextMenu.project}
          onOpen={() => { handleOpenProject(contextMenu.project.id); setContextMenu(null); }}
          onRemove={() => handleDeleteProject(false)}
          onDelete={() => handleDeleteProject(true)}
        />
      )}
    </div>
  );
}
