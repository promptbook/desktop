import React, { useCallback, useEffect, useState } from 'react';
import { ProjectProvider, SessionProvider, useProject, useSession } from './contexts';
import { ProjectLanding, TabBar, FloatingSidebar, EmptyState } from './components';
import { App } from './App';
import { Settings, AppSettings, defaultSettings } from './Settings';
import './AppWrapper.css';

// Inner component that uses the contexts
function AppContent() {
  const { state: projectState, closeProject, openProject } = useProject();
  const { state: sessionState, addTab, getActiveTab } = useSession();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  // Load settings on mount
  useEffect(() => {
    window.promptbook.settings.load().then(setSettings);
  }, []);

  const handleSaveSettings = async (newSettings: AppSettings) => {
    await window.promptbook.settings.save(newSettings);
    setSettings(newSettings);
  };

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleFileSelect = useCallback((filePath: string) => {
    addTab(filePath);
  }, [addTab]);

  const handleNewNotebook = useCallback(async () => {
    if (!projectState.currentProject) return;

    // Create a new untitled notebook
    const timestamp = Date.now();
    const fileName = `untitled_${timestamp}.yaml`;
    const created = await window.promptbook.project.createFile(
      projectState.currentProject.id,
      fileName,
      'cells: []\n'
    );

    if (created.success) {
      addTab(fileName);
    }
  }, [projectState.currentProject, addTab]);

  // Show project landing if no project is selected
  if (!projectState.currentProject) {
    return (
      <>
        <ProjectLanding onOpenSettings={handleOpenSettings} />
        {settingsOpen && (
          <Settings
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            settings={settings}
            onSave={handleSaveSettings}
          />
        )}
      </>
    );
  }

  const activeTab = getActiveTab();
  const hasTabs = (sessionState.session?.openTabs.length || 0) > 0;

  return (
    <div className="app-wrapper">
      {/* Floating sidebar with file browser */}
      <FloatingSidebar onFileSelect={handleFileSelect} />

      {/* Main content area */}
      <div className="app-wrapper__main">
        {/* Tab bar */}
        <TabBar onNewNotebook={handleNewNotebook} />

        {/* Content area */}
        <div className="app-wrapper__content">
          {hasTabs && activeTab ? (
            // Show notebook editor for active tab
            <NotebookContainer
              projectId={projectState.currentProject.id}
              filePath={activeTab.filePath}
              onOpenSettings={handleOpenSettings}
            />
          ) : (
            // Show empty state when no tabs
            <EmptyState />
          )}
        </div>
      </div>

      {/* Settings modal */}
      {settingsOpen && (
        <Settings
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );
}

// Container for the notebook that loads file content
interface NotebookContainerProps {
  projectId: string;
  filePath: string;
  onOpenSettings: () => void;
}

function NotebookContainer({ projectId, filePath, onOpenSettings }: NotebookContainerProps) {
  // For now, render the existing App component
  // The App component manages its own file loading, so we pass the file path through props
  // In a future refactor, we can make App receive the notebook state from context
  return (
    <App
      projectId={projectId}
      filePath={filePath}
      onOpenSettings={onOpenSettings}
    />
  );
}

// Main wrapper component with providers
export function AppWrapper() {
  return (
    <ProjectProvider>
      <SessionProvider>
        <AppContent />
      </SessionProvider>
    </ProjectProvider>
  );
}
