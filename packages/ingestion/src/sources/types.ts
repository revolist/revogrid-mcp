export type SourceCategory = 'docs' | 'examples' | 'changelog' | 'api';
export type SourceRepository = 'revogrid' | 'revogrid-pro';

export type SourceRoot = {
  repository: SourceRepository;
  rootPath: string;
  exists: boolean;
  source: 'env' | 'nested-submodule' | 'parent-repo';
};

export type SourceFile = {
  category: SourceCategory;
  repository: SourceRepository;
  absolutePath: string;
  relativePath: string;
  rootPath: string;
  source: SourceRoot['source'];
  requiresPro: boolean;
};
