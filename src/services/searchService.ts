import type { ContentRepository } from '../repositories/contentRepository.js';
import { hybridSearch } from '../retrieval/hybridSearch.js';
import type {
  RevogridSearchService,
  SearchMatch,
  SearchQueryFilters
} from '../types/catalog.js';

export class DefaultRevogridSearchService implements RevogridSearchService {
  public constructor(private readonly repository: ContentRepository) {}

  public async searchDocs(
    query: string,
    filters: SearchQueryFilters,
  ): Promise<SearchMatch[]> {
    const chunks = await this.getCandidateChunks(query, filters);
    return hybridSearch(query, chunks, filters, 'docs');
  }

  public async findExamples(
    query: string,
    filters: SearchQueryFilters,
  ): Promise<SearchMatch[]> {
    const chunks = (await this.getCandidateChunks(query, {
      ...filters,
      docTypes: ['example', 'live-demo']
    })).filter(
      (chunk) => chunk.docType === 'example' || chunk.docType === 'live-demo',
    );

    return hybridSearch(query, chunks, filters, 'examples');
  }

  private async getCandidateChunks(query: string, filters: SearchQueryFilters) {
    if (!this.repository.findLexicalCandidates) return this.repository.getChunks();
    return this.repository.findLexicalCandidates(query, filters, Math.max(filters.limit * 20, 200));
  }
}
