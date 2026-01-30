import { useState, useEffect, useCallback } from 'react';
import type { KernelState, PythonEnvironment } from '../types';

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

  // Load environments on mount and auto-connect
  useEffect(() => {
    window.promptbook.kernel.getStatus().then(({ state }) => setKernelState(state));

    // Auto-connect to best available environment
    window.promptbook.kernel.scanEnvironments().then(async (envs) => {
      setEnvironments(envs);

      // Skip auto-connect if already connected
      const status = await window.promptbook.kernel.getStatus();
      if (status.state !== 'disconnected' && status.state !== 'dead') {
        return;
      }

      // Priority 1: Local project venv (./.venv or ./venv)
      const localVenv = envs.find(
        (e) => e.type === 'venv' && (e.name === '.venv' || e.name === 'venv')
      );

      // Priority 2: First environment with ipykernel installed
      const withIpykernel = envs.find((e) => e.hasIpykernel);

      const autoEnv = localVenv || withIpykernel;
      if (autoEnv) {
        handleSelectEnvironmentInternal(autoEnv);
      }
    });
  }, []);

  // Set up kernel event listeners
  useEffect(() => {
    const unsubscribeState = window.promptbook.kernel.onStateChange((state) => {
      setKernelState(state);
    });

    const unsubscribeError = window.promptbook.kernel.onError((error) => {
      onError(`Kernel error: ${error}`);
    });

    return () => {
      unsubscribeState();
      unsubscribeError();
    };
  }, [onError]);

  const handleSelectEnvironmentInternal = async (env: PythonEnvironment) => {
    setInstallError(null);

    if (!env.hasIpykernel) {
      // Need to install ipykernel first
      setIsInstallingIpykernel(true);
      try {
        const result = await window.promptbook.kernel.installIpykernel(env.path);
        setIsInstallingIpykernel(false);

        if (!result.success) {
          setInstallError(result.error || 'Failed to install ipykernel');
          return;
        }

        // Refresh environments to get updated hasIpykernel status
        const updatedEnvs = await window.promptbook.kernel.scanEnvironments();
        setEnvironments(updatedEnvs);
        env = updatedEnvs.find((e) => e.path === env.path) || env;
      } catch (err) {
        setIsInstallingIpykernel(false);
        setInstallError(String(err));
        return;
      }
    }

    const result = await window.promptbook.kernel.selectEnvironment(env.path);
    if (result.success) {
      setSelectedEnvironment(env);
      setEnvironmentPickerOpen(false);
    } else {
      setInstallError(result.error || 'Failed to select environment');
    }
  };

  const handleSelectEnvironment = useCallback(async (env: PythonEnvironment) => {
    await handleSelectEnvironmentInternal(env);
  }, []);

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
