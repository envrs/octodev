import { useEffect, useState } from 'react';
import { getExecutionManager } from '~/lib/modules/agent/execution-manager';
import type { AgentConfig } from '~/lib/modules/agent/types';

interface AgentSelectorProps {
  onSelectAgent: (agent: string, model: string) => void;
  selectedAgent?: string;
  selectedModel?: string;
  disabled?: boolean;
}

export function AgentSelector({ onSelectAgent, selectedAgent, selectedModel, disabled }: AgentSelectorProps) {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const manager = getExecutionManager();
    const availableAgents = manager.getAvailableAgents();

    const agentConfigs: AgentConfig[] = availableAgents.map((provider) => ({
      name: provider.name,
      models: provider.models,
      icon: provider.icon,
      apiKeyLink: provider.apiKeyLink,
    }));

    setAgents(agentConfigs);
    setLoading(false);

    // Set default if not selected
    if (!selectedAgent && agentConfigs.length > 0) {
      const firstAgent = agentConfigs[0];
      const firstModel = firstAgent.models[0];
      if (firstModel) {
        onSelectAgent(firstAgent.name, firstModel.name);
      }
    }
  }, [selectedAgent, onSelectAgent]);

  if (loading) {
    return (
      <div className="p-4 bg-bolt-elements-bg-depth-2 rounded-lg border border-bolt-elements-borderColor">
        <p className="text-bolt-elements-textSecondary">Loading agents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
        <p className="text-red-500 font-medium">Error loading agents</p>
        <p className="text-red-400 text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-bolt-elements-textPrimary">AI Agent</label>
        <select
          disabled={disabled || agents.length === 0}
          value={selectedAgent || ''}
          onChange={(e) => {
            const agent = e.target.value;
            const agentConfig = agents.find((a) => a.name === agent);
            if (agentConfig && agentConfig.models.length > 0) {
              onSelectAgent(agent, agentConfig.models[0].name);
            }
          }}
          className="px-3 py-2 bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary text-sm focus:outline-none focus:border-bolt-elements-borderColorActive disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Select an agent...</option>
          {agents.map((agent) => (
            <option key={agent.name} value={agent.name}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>

      {selectedAgent && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-bolt-elements-textPrimary">Model</label>
          <select
            disabled={disabled}
            value={selectedModel || ''}
            onChange={(e) => {
              const model = e.target.value;
              if (selectedAgent && model) {
                onSelectAgent(selectedAgent, model);
              }
            }}
            className="px-3 py-2 bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary text-sm focus:outline-none focus:border-bolt-elements-borderColorActive disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Select a model...</option>
            {agents
              .find((a) => a.name === selectedAgent)
              ?.models.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.label || model.name}
                </option>
              ))}
          </select>
        </div>
      )}

      {selectedAgent && (
        <div className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>{selectedAgent} is ready to use</span>
        </div>
      )}
    </div>
  );
}
