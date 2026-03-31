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
    const chunks = await this.repository.getChunks();
    return hybridSearch(query, chunks, filters);
  }

  public async findExamples(
    query: string,
    filters: SearchQueryFilters,
  ): Promise<SearchMatch[]> {
    const chunks = (await this.repository.getChunks()).filter(
      (chunk) => chunk.docType === 'example' || chunk.docType === 'live-demo',
    );

    return hybridSearch(query, chunks, filters);
  }
}
