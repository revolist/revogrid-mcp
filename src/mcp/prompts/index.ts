import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'revogrid-feature-check',
    {
      title: 'RevoGrid Feature Check',
      description: 'Validate a feature claim and return docs/examples quickly.',
      argsSchema: {
        featureName: z.string().describe('Feature name or symbol to verify'),
        framework: z.string().optional().describe('Optional framework: react, vue, angular, svelte, or vanilla'),
        version: z.string().optional().describe('Optional target version')
      }
    },
    async (args) => {
      const featureName = args.featureName ?? '';
      const framework = args.framework ? ` and framework "${args.framework}"` : '';
      const version = args.version ? ` for version "${args.version}"` : '';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Use resolve_feature_matrix for "${featureName}"${framework}${version}, then verify with search_revogrid_docs for nearby examples and migration context.`
            }
          }
        ]
      };
    },
  );

  server.registerPrompt(
    'revogrid-migration-checklist',
    {
      title: 'RevoGrid Migration Checklist',
      description: 'Run a migration-oriented discovery flow from version A to B.',
      argsSchema: {
        fromVersion: z.string().describe('Source version, e.g. 4.15.0'),
        toVersion: z.string().describe('Target version, e.g. 5.2.0')
      }
    },
    async (args) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Use get_migration_notes for ${args.fromVersion} → ${args.toVersion}, then follow with search_revogrid_docs for renamed APIs, then find_examples for any migration-ready demos.`
            }
          }
        ]
      };
    },
  );

  server.registerPrompt(
    'revogrid-example-playbook',
    {
      title: 'RevoGrid Example Lookup Playbook',
      description: 'Find high-confidence RevoGrid examples for implementation guidance.',
      argsSchema: {
        objective: z.string().describe('What the example should cover'),
        framework: z.string().optional().describe('Optional framework filter')
      }
    },
    async (args) => {
      const objective = args.objective ?? '';
      const framework = args.framework ? ` (${args.framework})` : '';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Search "search_revogrid_docs" for "${objective}"${framework} to identify setup and API references, then call find_examples with the same intent and same filters to collect runnable examples.`
            }
          }
        ]
      };
    },
  );
}
