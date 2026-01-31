import { useState, useEffect, useCallback, useMemo } from 'react';
import type { KernelState, PythonEnvironment } from '../types';

/**
 * Finds the best environment to auto-connect to.
 * Priority 1: Local project venv (./.venv or ./venv)
 * Priority 2: First environment with ipykernel installed
 */
function findBestEnvironment(envs: PythonEnvironment[]): PythonEnvironment | undefined {
  const localVenv = envs.find(
    (e) => e.type === 'venv' && (e.name === '.venv' || e.name === 'venv')
  );
  const withIpykernel = envs.find((e) => e.hasIpykernel);
  return localVenv || withIpykernel;
}

interface SelectEnvCallbacks {
  setInstallError: (error: string | null) => void;
  setIsInstallingIpykernel: (installing: boolean) => void;
  setEnvironments: (envs: PythonEnvironment[]) => void;
  setSelectedEnvironment: (env: PythonEnvironment) => void;
  setEnvironmentPickerOpen: (open: boolean) => void;
}

async function selectEnvironmentWithInstall(
  env: PythonEnvironment,
  callbacks: SelectEnvCallbacks
): Promise<void> {
  callbacks.setInstallError(null);

  if (!env.hasIpykernel) {
    callbacks.setIsInstallingIpykernel(true);
    try {
      const result = await window.promptbook.kernel.installIpykernel(env.path);
      callbacks.setIsInstallingIpykernel(false);

      if (!result.success) {
        callbacks.setInstallError(result.error || 'Failed to install ipykernel');
        return;
      }

      const updatedEnvs = await window.promptbook.kernel.scanEnvironments();
      callbacks.setEnvironments(updatedEnvs);
      env = updatedEnvs.find((e) => e.path === env.path) || env;
    } catch (err) {
      callbacks.setIsInstallingIpykernel(false);
      callbacks.setInstallError(String(err));
      return;
    }
  }

  const result = await window.promptbook.kernel.selectEnvironment(env.path);
  if (result.success) {
    callbacks.setSelectedEnvironment(env);
    callbacks.setEnvironmentPickerOpen(false);
  } else {
    callbacks.setInstallError(result.error || 'Failed to select environment');
  }
}

export interface UseKernelReturn {
  kernelState: KernelState;
  environments: PythonEnvironment[];
  selectedEnvironment: PythonEnvironment | null;
  environmentPickerOpen: boolean;
  isInstallingIpykernel: boolean;
  isCreatingVenv: boolean;
  installError: string | null;
  setEnvironmentPickerOpen: (open: boolean) => void;
  handleSelectEnvironment: (env: PythonEnvironment) => Promise<void>;
  handleRefreshEnvironments: () => Promise<void>;
  handleCreateVenv: (name: string) => Promise<{ success: boolean; error?: string }>;
  handleInterrupt: () => Promise<void>;
  handleRestart: () => Promise<void>;
  setInstallError: (error: string | null) => void;
}

export function useKernel(onError: (error: string) => void): UseKernelReturn {
  const [kernelState, setKernelState] = useState<KernelState>('disconnected');
  const [environments, setEnvironments] = useState<PythonEnvironment[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<PythonEnvironment | null>(null);
  const [environmentPickerOpen, setEnvironmentPickerOpen] = useState(false);
  const [isInstallingIpykernel, setIsInstallingIpykernel] = useState(false);
  const [isCreatingVenv, setIsCreatingVenv] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  const selectEnvCallbacks = useMemo<SelectEnvCallbacks>(() => ({
    setInstallError, setIsInstallingIpykernel, setEnvironments, setSelectedEnvironment, setEnvironmentPickerOpen,
  }), []);

  // Load environments on mount and auto-connect
  useEffect(() => {
    window.promptbook.kernel.getStatus().then(({ state }) => setKernelState(state));
    window.promptbook.kernel.scanEnvironments().then(async (envs) => {
      setEnvironments(envs);
      const status = await window.promptbook.kernel.getStatus();
      if (status.state !== 'disconnected' && status.state !== 'dead') return;
      const autoEnv = findBestEnvironment(envs);
      if (autoEnv) selectEnvironmentWithInstall(autoEnv, selectEnvCallbacks);
    });
  }, [selectEnvCallbacks]);

  // Set up kernel event listeners
  useEffect(() => {
    const unsubscribeState = window.promptbook.kernel.onStateChange((state) => setKernelState(state));
    const unsubscribeError = window.promptbook.kernel.onError((error) => onError(`Kernel error: ${error}`));
    return () => { unsubscribeState(); unsubscribeError(); };
  }, [onError]);

  const handleSelectEnvironment = useCallback(async (env: PythonEnvironment) => {
    await selectEnvironmentWithInstall(env, selectEnvCallbacks);
  }, [selectEnvCallbacks]);

  const handleRefreshEnvironments = useCallback(async () => {
    const envs = await window.promptbook.kernel.scanEnvironments();
    setEnvironments(envs);
  }, []);

  const handleCreateVenv = useCallback(async (name: string): Promise<{ success: boolean; error?: string }> => {
    setIsCreatingVenv(true);
    try {
      const result = await window.promptbook.kernel.createVenv(name);
      if (result.success) {
        // Refresh environments to show the new venv
        const envs = await window.promptbook.kernel.scanEnvironments();
        setEnvironments(envs);
      }
      return result;
    } finally {
      setIsCreatingVenv(false);
    }
  }, []);

  const handleInterrupt = useCallback(async () => {
    await window.promptbook.kernel.interrupt();
  }, []);

  const handleRestart = useCallback(async () => {
    await window.promptbook.kernel.restart();
  }, []);

  return {
    kernelState,
    environments,
    selectedEnvironment,
    environmentPickerOpen,
    isInstallingIpykernel,
    isCreatingVenv,
    installError,
    setEnvironmentPickerOpen,
    handleSelectEnvironment,
    handleRefreshEnvironments,
    handleCreateVenv,
    handleInterrupt,
    handleRestart,
    setInstallError,
  };
}
