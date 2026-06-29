import { generateWithProvider } from './provider-router';
import { avatarService } from './avatar';
import type { OrgAgent, OrgChart, Provider } from '../types';

interface CEOOptions {
  provider: Provider;
  model: string;
  problem: string;
}

class CEOService {
  private buildCEOPrompt(problem: string): string {
    return `You are Alex Yeoo, CEO of YEOO SOFTWARE. You are building an AI organization to solve a business problem.

BUSINESS PROBLEM:
"${problem}"

Your job: Design the optimal AI agent organization to solve this problem.

You must return ONLY a valid JSON object (no markdown, no backticks, no explanation) with this exact structure:

{
  "organizationName": "Name of the org",
  "departments": [
    {
      "name": "Department Name",
      "agents": [
        {
          "name": "Agent Name",
          "emoji": "emoji",
          "role": "Role Title",
          "description": "What this agent does",
          "skills": ["skill1", "skill2", "skill3"],
          "prompt": "System prompt for this agent's behavior and expertise"
        }
      ]
    }
  ]
}

RULES:
- You MUST include exactly these agents in the hierarchy:
  1. A CEO agent (you, Alex Yeoo) at the top level
  2. 2-4 Department Directors/Managers reporting to CEO
  3. 2-5 Specialist agents per department reporting to directors
- Every agent needs: name, emoji, role, description, skills[], prompt
- The CEO agent must have a strategic, coordinating prompt
- Department directors must have management/coordination prompts
- Specialists must have deep technical/specialized prompts relevant to the problem
- Emojis must be relevant to each role
- Skills should be specific and technical
- Total agents: between 6 and 20
- Ensure the organization is tailored to solve the specific business problem

Think about what departments are needed. Common departments: Engineering, Design, Product, Marketing, QA, Operations, Finance, Sales, Support. Pick only the ones relevant to THIS problem.`;
  }

  async generateOrganization(options: CEOOptions): Promise<OrgChart> {
    const { provider, model, problem } = options;

    const response = await generateWithProvider(provider, {
      model,
      prompt: this.buildCEOPrompt(problem),
      temperature: 0.5,
    });

    // Clean the response - remove markdown code blocks if present
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return this.transformResponse(parsed, problem, provider, model);
    } catch (e) {
      // Try to extract JSON from the response
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.transformResponse(parsed, problem, provider, model);
      }
      throw new Error('Failed to parse CEO response as JSON');
    }
  }

  private transformResponse(data: any, problem: string, provider: Provider, selectedModel: string): OrgChart {
    const agents: OrgAgent[] = [];
    let ceoId = '';

    if (data.departments && Array.isArray(data.departments)) {
      for (const dept of data.departments) {
        const deptName = dept.name || 'Department';
        const deptId = `dept-${deptName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

        if (dept.agents && Array.isArray(dept.agents)) {
          for (const agent of dept.agents) {
            const isCEO = agent.role?.toLowerCase().includes('ceo') ||
                          agent.name?.toLowerCase().includes('ceo') ||
                          agent.name?.toLowerCase().includes('alex');
            const agentId = `agent-${(agent.name || 'agent').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

            const orgAgent: OrgAgent = {
              id: agentId,
              name: agent.name || 'Agent',
              emoji: agent.emoji || '🤖',
              role: agent.role || 'Specialist',
              description: agent.description || '',
              parentId: isCEO ? null : deptId,
              model: selectedModel,
              context: '',
              skills: agent.skills || [],
              status: 'active',
              prompt: agent.prompt || 'Execute your role with excellence.',
              division: deptName,
              avatarUrl: '',
              gender: undefined,
            };

            if (isCEO) {
              ceoId = agentId;
              orgAgent.parentId = null;
            }

            agents.push(orgAgent);
          }
        }
      }
    }

    // If no departments parsed, create a minimal default
    if (agents.length === 0) {
      ceoId = `agent-ceo-${Date.now()}`;
      agents.push({
        id: ceoId,
        name: 'Alex Yeoo',
        emoji: '👨‍💼',
        role: 'CEO',
        description: 'Strategic decision maker and team orchestrator',
        parentId: null,
        model: selectedModel,
        context: '',
        skills: ['Strategy', 'Leadership', 'Orchestration'],
        status: 'active',
        prompt: 'Lead the organization to solve the business problem.',
        division: 'Executive',
        avatarUrl: '',
        gender: undefined,
      });
    }

    // Assign permanent avatars to all agents
    const agentsWithAvatars = avatarService.assignAllAvatars(agents);

    return {
      id: `org-${Date.now()}`,
      name: data.organizationName || 'AI Organization',
      problem,
      agents: agentsWithAvatars,
      createdAt: new Date(),
      provider,
    };
  }

  async generateExecutiveReport(
    provider: Provider,
    model: string,
    problem: string,
    agentOutputs: { name: string; role: string; output: string }[]
  ): Promise<string> {
    const reportPrompt = `You are the CEO of YEOO SOFTWARE. Generate a comprehensive executive report based on the following:

BUSINESS PROBLEM:
"${problem}"

TEAM OUTPUTS:
${agentOutputs.map((a, i) => `### ${a.name} (${a.role})\n${a.output}`).join('\n\n')}

Generate a professional executive report with:
1. Executive Summary
2. Key Findings
3. Recommendations
4. Next Steps
5. Risk Assessment
6. Timeline & Resources

Format the report professionally with clear sections. Use markdown formatting.`;

    return await generateWithProvider(provider, {
      model,
      prompt: reportPrompt,
      temperature: 0.5,
    });
  }
}

export const CEOServiceInstance = new CEOService();