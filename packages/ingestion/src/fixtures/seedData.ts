import type {
  DocumentChunk,
  FeatureRecord,
  MigrationNoteRecord,
  SeedDataset,
  VersionRecord
} from '@revogrid-mcp/content-model';

const versions: VersionRecord[] = [
  {
    version: '4.15.0',
    label: '4.15.0',
    latest: false,
    releaseDate: '2024-10-08',
    surfaces: ['core', 'columntype', 'plugin']
  },
  {
    version: '5.2.0',
    label: '5.2.0',
    latest: true,
    releaseDate: '2025-02-14',
    surfaces: ['core', 'pro', 'pivot', 'plugin', 'columntype', 'migration', 'changelog']
  }
];

const chunks: DocumentChunk[] = [
  {
    id: 'guide-react-getting-started',
    title: 'React getting started',
    body:
      'Install revogrid and @revolist/react-datagrid, register the web component, and render a basic editable grid.',
    summary: 'React installation and first editable grid setup.',
    framework: 'react',
    surface: 'core',
    docType: 'guide',
    version: '5.2.0',
    requiresPro: false,
    symbols: ['RevoGrid', 'beforeedit', 'source', 'columns'],
    stability: 'stable',
    url: 'https://rv-grid.com/guide/react/',
    sourcePath: 'revogrid/docs/guide/react/index.md',
    packageNames: ['revogrid', '@revolist/react-datagrid']
  },
  {
    id: 'guide-vue-getting-started',
    title: 'Vue getting started',
    body:
      'Install revogrid for Vue and mount the grid with columns, source, and editor support for inline editing.',
    summary: 'Vue setup guide for RevoGrid.',
    framework: 'vue',
    surface: 'core',
    docType: 'guide',
    version: '5.2.0',
    requiresPro: false,
    symbols: ['RevoGrid', 'source', 'columns'],
    stability: 'stable',
    url: 'https://rv-grid.com/guide/vue/',
    sourcePath: 'revogrid/docs/guide/vue/index.md',
    packageNames: ['revogrid', '@revolist/vue3-datagrid']
  },
  {
    id: 'guide-angular-getting-started',
    title: 'Angular getting started',
    body:
      'Install the Angular wrapper package, declare the component, and configure editable columns and source rows.',
    summary: 'Angular wrapper setup for RevoGrid.',
    framework: 'angular',
    surface: 'core',
    docType: 'guide',
    version: '5.2.0',
    requiresPro: false,
    symbols: ['RevoGrid', 'columns', 'source'],
    stability: 'stable',
    url: 'https://rv-grid.com/guide/angular/',
    sourcePath: 'revogrid/docs/guide/angular/index.md',
    packageNames: ['revogrid', '@revolist/angular-datagrid']
  },
  {
    id: 'guide-editable-grid',
    title: 'Editable grid basics',
    body:
      'Editable cells are enabled through column editors and lifecycle events such as beforeedit. Works across vanilla, React, Vue, and Angular wrappers.',
    summary: 'Core editing lifecycle, editors, and validation overview.',
    framework: 'vanilla',
    surface: 'core',
    docType: 'guide',
    version: '5.2.0',
    requiresPro: false,
    symbols: ['beforeedit', 'afteredit', 'editors'],
    stability: 'stable',
    url: 'https://rv-grid.com/guide/editing',
    sourcePath: 'revogrid/docs/guide/editors.md'
  },
  {
    id: 'api-beforeedit-event',
    title: 'beforeedit event',
    body:
      'beforeedit fires before a cell enters edit mode and can be used to cancel editing or inject custom validation logic.',
    summary: 'API reference for the beforeedit event hook.',
    framework: 'vanilla',
    surface: 'core',
    docType: 'api',
    version: '5.2.0',
    requiresPro: false,
    symbols: ['beforeedit', 'BeforeSaveDataDetails'],
    stability: 'stable',
    url: 'https://rv-grid.com/api/events/beforeedit',
    sourcePath: 'revogrid/src/types/interfaces.ts'
  },
  {
    id: 'example-react-editable-grid',
    title: 'Editable React grid demo',
    body:
      'Runnable React demo with editable columns, inline cell editors, beforeedit guard, and typed source rows.',
    summary: 'Live example for editable React RevoGrid.',
    framework: 'react',
    surface: 'core',
    docType: 'live-demo',
    version: '5.2.0',
    requiresPro: false,
    symbols: ['beforeedit', 'columns', 'editors'],
    stability: 'stable',
    url: 'https://rv-grid.com/demo/react/editable-grid',
    sourcePath: 'revogrid/packages/react/demo/src/editing.tsx',
    exampleUrl: 'https://rv-grid.com/demo/react/editable-grid',
    packageNames: ['revogrid', '@revolist/react-datagrid']
  },
  {
    id: 'guide-custom-column-type',
    title: 'Custom column type guide',
    body:
      'Column types let you bundle editor, formatter, parser, and validation behavior into reusable named definitions.',
    summary: 'Build reusable custom column types.',
    framework: 'vanilla',
    surface: 'columntype',
    docType: 'guide',
    version: '5.2.0',
    requiresPro: false,
    symbols: ['columnTypes', 'format', 'editor'],
    stability: 'stable',
    url: 'https://rv-grid.com/guide/column-types/custom',
    sourcePath: 'revogrid/formats/number/package.json'
  },
  {
    id: 'example-custom-column-type',
    title: 'Custom column type demo',
    body:
      'Runnable example showing a custom column type with formatter, editor, and parser registration.',
    summary: 'Live custom column type demo.',
    framework: 'vanilla',
    surface: 'columntype',
    docType: 'live-demo',
    version: '5.2.0',
    requiresPro: false,
    symbols: ['columnTypes', 'editor'],
    stability: 'stable',
    url: 'https://rv-grid.com/demo/column-types/custom',
    sourcePath: 'revogrid/formats/number/package.json',
    exampleUrl: 'https://rv-grid.com/demo/column-types/custom',
    packageNames: ['revogrid']
  },
  {
    id: 'guide-pivot-overview',
    title: 'Pivot overview',
    body:
      'Pivot mode is available in RevoGrid Pro and adds drag-and-drop dimensions, summaries, sorting, and filtering for analytical tables.',
    summary: 'Overview of pivot functionality in RevoGrid Pro.',
    framework: 'vanilla',
    surface: 'pivot',
    docType: 'guide',
    version: '5.2.0',
    requiresPro: true,
    symbols: ['pivot', 'dimensions', 'summaryRows'],
    stability: 'stable',
    url: 'https://pro.rv-grid.com/features/pivot',
    sourcePath: 'revogrid-pro/public/images/pivot.png',
    packageNames: ['@revolist/revogrid-pro']
  },
  {
    id: 'example-pivot-demo',
    title: 'Pivot demo',
    body:
      'Live Pro demo showing pivot dimensions, summaries, sorting, and filtering in a hosted analytical view.',
    summary: 'Runnable pivot example for Pro users.',
    framework: 'vanilla',
    surface: 'pivot',
    docType: 'live-demo',
    version: '5.2.0',
    requiresPro: true,
    symbols: ['pivot', 'summaryRows'],
    stability: 'stable',
    url: 'https://pro.rv-grid.com/demo/pivot',
    sourcePath: 'revogrid-pro/src/pages/demo/[slug].astro',
    exampleUrl: 'https://pro.rv-grid.com/demo/pivot',
    packageNames: ['@revolist/revogrid-pro']
  },
  {
    id: 'migration-v4-to-v5-guide',
    title: 'Migrate from RevoGrid 4.x to 5.x',
    body:
      'Upgrade guidance covering wrapper package updates, renamed hooks, default editor changes, and cleanup for deprecated options.',
    summary: 'Migration notes for the 4.x to 5.x upgrade.',
    framework: 'vanilla',
    surface: 'migration',
    docType: 'migration',
    version: '5.2.0',
    requiresPro: false,
    symbols: ['beforeedit', 'columnTypes', 'readonly'],
    stability: 'stable',
    url: 'https://rv-grid.com/migrations/4-to-5',
    sourcePath: 'revogrid/docs/blog/datagrid.md'
  },
  {
    id: 'changelog-v5-2-0',
    title: 'RevoGrid 5.2.0 changelog highlights',
    body:
      'Highlights include improved editor lifecycle hooks, better React wrapper examples, and pivot documentation updates.',
    summary: 'Changelog summary for 5.2.0.',
    framework: 'vanilla',
    surface: 'changelog',
    docType: 'faq',
    version: '5.2.0',
    requiresPro: false,
    symbols: ['beforeedit', 'pivot'],
    stability: 'stable',
    url: 'https://rv-grid.com/changelog/5.2.0',
    sourcePath: 'revogrid/docs/release.mjs',
    releaseDate: '2025-02-14'
  }
];

const features: FeatureRecord[] = [
  {
    featureName: 'editable grid',
    supported: true,
    requiresPro: false,
    stability: 'stable',
    supportedFrameworks: ['react', 'vue', 'angular', 'svelte', 'vanilla'],
    notes: ['Uses editors and edit lifecycle events such as beforeedit.'],
    relatedChunkIds: ['guide-editable-grid', 'guide-react-getting-started', 'api-beforeedit-event'],
    relatedExampleIds: ['example-react-editable-grid'],
    aliases: ['editing', 'editable react grid']
  },
  {
    featureName: 'custom column type',
    supported: true,
    requiresPro: false,
    stability: 'stable',
    supportedFrameworks: ['react', 'vue', 'angular', 'svelte', 'vanilla'],
    notes: ['Column type definitions are reusable across wrappers once registered in the core grid.'],
    relatedChunkIds: ['guide-custom-column-type'],
    relatedExampleIds: ['example-custom-column-type'],
    aliases: ['column type', 'custom type']
  },
  {
    featureName: 'beforeedit',
    supported: true,
    requiresPro: false,
    stability: 'stable',
    supportedFrameworks: ['react', 'vue', 'angular', 'svelte', 'vanilla'],
    notes: ['Lifecycle event available before cell editing starts.'],
    relatedChunkIds: ['api-beforeedit-event', 'guide-editable-grid'],
    relatedExampleIds: ['example-react-editable-grid'],
    aliases: ['before edit', 'edit guard']
  },
  {
    featureName: 'pivot',
    supported: true,
    requiresPro: true,
    stability: 'stable',
    supportedFrameworks: ['react', 'vue', 'angular', 'svelte', 'vanilla'],
    notes: ['Pivot is a Pro capability and should be hidden from anonymous clients.'],
    relatedChunkIds: ['guide-pivot-overview'],
    relatedExampleIds: ['example-pivot-demo'],
    fallbackApproach: 'For anonymous users, use grouping plus aggregation as the closest public fallback.',
    aliases: ['pivot table', 'pivot feature']
  }
];

const migrations: MigrationNoteRecord[] = [
  {
    id: 'migration-4-to-5',
    fromVersion: '4.15.0',
    toVersion: '5.2.0',
    breakingChanges: [
      'Wrapper package versions should be upgraded together with core revogrid.',
      'Deprecated editor registration shims were removed in favor of explicit column type registration.'
    ],
    renamedSymbols: [
      {
        from: 'beforeEdit',
        to: 'beforeedit'
      }
    ],
    changedDefaults: [
      'Editable columns now assume explicit editor configuration instead of implicit text editor fallback.'
    ],
    packageChanges: [
      'Upgrade revogrid and framework wrapper packages to the same 5.x release line.'
    ],
    recommendedDocIds: ['migration-v4-to-v5-guide', 'guide-react-getting-started'],
    recommendedExampleIds: ['example-react-editable-grid']
  }
];

export function buildSeedDataset(): SeedDataset {
  return {
    chunks,
    versions,
    features,
    migrations
  };
}
