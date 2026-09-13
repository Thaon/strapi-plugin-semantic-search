# Strapi Plugin Semantic Search

A Strapi plugin that adds semantic search capabilities using OpenRouter embeddings. This plugin enables intelligent content search that understands meaning and context, not just keyword matching.

## Features

- **Semantic Search**: Search content using embeddings for better relevance
- **Document Chunking**: Automatically chunks large documents for optimal search results
- **Similarity Threshold**: Configurable similarity threshold for search results
- **OpenRouter Integration**: Uses OpenRouter's embedding models (no SDK dependency — direct REST calls with request timeouts)
- **Batched Embeddings**: Documents are embedded in a single batched API call instead of one call per chunk
- **In-Memory Vector Cache**: Chunks are cached per owner as pre-normalized `Float32Array`s, so query-time similarity is pure dot products (single-digit milliseconds at any realistic corpus size)
- **Automatic DB Indexes**: Indexes on `owner` / (`parent_doc_id`, `parent_type`) are created at startup
- **Built-in Timing Logs**: Every search and indexing operation logs per-stage timings for easy latency attribution
- **Strapi 4 Compatible**: Works with Strapi v4.x and v5.x

## Installation

### Prerequisites

- Node.js >= 20
- Strapi v4.x or v5.x
- OpenRouter API key

### Install the Plugin

```bash
# Using npm
npm install strapi-plugin-semantic-search

# Using yarn
yarn add strapi-plugin-semantic-search
```

### Configure Environment Variables

Add the following environment variables to your `.env` file:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=openai/text-embedding-3-small
SITE_URL=http://localhost:1337
SITE_NAME=YourSiteName
```

### Enable the Plugin

Add the plugin to your `config/plugins.js` file:

```javascript
module.exports = () => ({
  "semantic-search": {
    enabled: true,
    resolve: "@thaon/strapi-plugin-semantic-search",
  },
});
```

## Usage

The plugin provides two main services: **indexing** and **searching**. Both must be called manually through your application code or API endpoints.

### 1. Index Documents

Before searching, you must manually index your documents using the indexer service.

#### Single Field Indexing

Index a specific field from a document:

```javascript
// In your controller or service
const indexer = strapi.plugin("semantic-search").service("indexer");

await indexer.indexDocument(
  contentType, // e.g., "api::doc.doc"
  documentId, // Document ID to index
  field, // Field name to index (e.g., "content")
  titleField, // Optional: field to use as title (default: "title")
  ownerId, // Required: user ID for ownership filtering
);
```

**Parameters:**

- `contentType` (string): The content type UID (e.g., `api::doc.doc`)
- `documentId` (string): The document ID to index
- `field` (string): The field containing text to index (e.g., `content`)
- `titleField` (string, optional): Field to use as document title reference (default: `title`)
- `ownerId` (number): User ID for ownership-based filtering

**Response:**

```json
{
  "success": true,
  "documentId": "123",
  "contentType": "api::doc.doc",
  "chunksCreated": 5
}
```

#### Multi-Field Indexing

Index multiple fields from a document:

```javascript
const indexer = strapi.plugin("semantic-search").service("indexer");

await indexer.indexDocumentFields(
  contentType, // e.g., "api::doc.doc"
  documentId, // Document ID to index
  fields, // Array of field names (e.g., ["title", "content"])
  titleField, // Optional: field to use as title
  ownerId, // Required: user ID for ownership filtering
);
```

**Parameters:**

- `contentType` (string): The content type UID
- `documentId` (string): The document ID to index
- `fields` (string[]): Array of field names to combine and index
- `titleField` (string, optional): Field to use as document title (default: `title`)
- `ownerId` (number): User ID for ownership-based filtering

### 2. Perform Semantic Search

After indexing, search indexed documents using the search service.

```javascript
const searchService = strapi.plugin("semantic-search").service("search");

const results = await searchService.querySearch(query, options);
```

**Parameters:**

- `query` (string): The search query
- `options` (object):
  - `ownerId` (number, required): User ID to filter results by ownership
  - `limit` (number, optional): Maximum results to return (default: 5)
  - `threshold` (number, optional): Similarity threshold 0-1 (default: 0.5)
  - `contentType` (string, optional): Filter by specific content type

**Response:**

```json
[
  {
    "documentId": "123",
    "title": "Document Title",
    "textSnippet": "Relevant excerpt from the document...",
    "fullContent": "Complete document content...",
    "contentType": "api::doc.doc",
    "score": 0.85
  }
]
```

### 3. API Endpoints Example

If you expose these services via API endpoints:

```bash
# Index a document
POST /api/semantic-search/index
Content-Type: application/json
{
  "contentType": "api::doc.doc",
  "documentId": "123",
  "field": "content",
  "ownerId": 1
}

# Search indexed documents
GET /api/semantic-search/search?query=your+search+query&limit=10&threshold=0.5
```

## Configuration

The plugin can be configured through environment variables or by overriding the configuration in your Strapi project.

### Method 1: Environment Variables (Recommended)

Add the following environment variables to your `.env` file:

| Variable             | Description             | Default                         |
| -------------------- | ----------------------- | ------------------------------- |
| `OPENROUTER_API_KEY` | Your OpenRouter API key | Required                        |
| `OPENROUTER_MODEL`   | Embedding model to use  | `openai/text-embedding-3-small` |
| `SITE_URL`           | Your Strapi site URL    | `http://localhost:1337`         |
| `SITE_NAME`          | Your site name          | `StrapiSemanticSearch`          |

**Note**: The remaining config options use hardcoded defaults in the plugin's `server/config/index.js`:

- `contentTypes`: `[]` (no content types pre-configured)
- `chunkSize`: `2000` characters
- `chunkOverlap`: `200` characters
- `similarityThreshold`: `0.7`

### Method 2: Custom Configuration File

For advanced configuration, you can override the plugin's default settings by creating a custom configuration file in your Strapi project:

#### Create Custom Config File

Create a file at `config/plugins.js` in your Strapi project:

```javascript
module.exports = ({ env }) => ({
  "semantic-search": {
    enabled: true,
    resolve: "@thaon/strapi-plugin-semantic-search",
    config: {
      // Override default configuration
      apiKey: env("OPENROUTER_API_KEY"),
      model: env("OPENROUTER_MODEL", "openai/text-embedding-3-small"),
      siteUrl: env("SITE_URL", "http://localhost:1337"),
      siteName: env("SITE_NAME", "StrapiSemanticSearch"),
      contentTypes: ["api::article.article", "api::page.page"], // Specify content types to index
      chunkSize: 800, // Custom chunk size
      chunkOverlap: 100, // Custom chunk overlap
      similarityThreshold: 0.6, // Custom similarity threshold
    },
  },
});
```

#### Configuration Options Explained

The plugin's configuration is defined in `server/config/index.js` and includes the following options:

| Option                | Type   | Description                                           | Default                         |
| --------------------- | ------ | ----------------------------------------------------- | ------------------------------- |
| `apiKey`              | string | Your OpenRouter API key (required)                    | -                               |
| `model`               | string | Embedding model to use from OpenRouter                | `openai/text-embedding-3-small` |
| `siteUrl`             | string | Your Strapi site URL                                  | `http://localhost:1337`         |
| `siteName`            | string | Your site name for identification                     | `StrapiSemanticSearch`          |
| `contentTypes`        | array  | Array of content type UIDs to enable indexing for     | `[]`                            |
| `chunkSize`           | number | Maximum characters per document chunk                 | `2000`                          |
| `chunkOverlap`        | number | Number of characters to overlap between chunks        | `200`                           |
| `similarityThreshold` | number | Default similarity threshold (0-1) for search results | `0.7`                           |

#### Configuration Structure

The plugin's `server/config/index.js` defines this structure:

```javascript
module.exports = {
  default: ({ env }) => ({
    apiKey: env("OPENROUTER_API_KEY", ""),
    model: env("OPENROUTER_MODEL", "openai/text-embedding-3-small"),
    siteUrl: env("SITE_URL", "http://localhost:1337"),
    siteName: env("SITE_NAME", "StrapiSemanticSearch"),
    contentTypes: [],
    chunkSize: 2000,
    chunkOverlap: 200,
    similarityThreshold: 0.7,
  }),
  validator: (config) => {
    if (!config.apiKey) {
      throw new Error("Semantic Search: OPENROUTER_API_KEY is required");
    }
  },
};
```

#### Configuration Validation

The plugin includes built-in validation that ensures:

- `apiKey` is provided (throws error if missing)
- All configuration values are of the correct type

#### Accessing Configuration in Code

You can access the plugin configuration in your services:

```javascript
const config = strapi.config.get("plugin::semantic-search");
console.log(config.similarityThreshold); // 0.7 or custom value
```

#### Example: Environment-Specific Configuration

You can use different configurations for different environments:

```javascript
module.exports = ({ env }) => ({
  "semantic-search": {
    enabled: true,
    resolve: "@thaon/strapi-plugin-semantic-search",
    config: {
      apiKey: env("OPENROUTER_API_KEY"),
      model: env("OPENROUTER_MODEL", "openai/text-embedding-3-small"),
      siteUrl: env("SITE_URL", "http://localhost:1337"),
      siteName: env("SITE_NAME", "StrapiSemanticSearch"),
      // Development-specific settings
      chunkSize: env("NODE_ENV") === "development" ? 300 : 800,
      similarityThreshold: env("NODE_ENV") === "development" ? 0.5 : 0.7,
    },
  },
});
```

## How It Works

### Indexing Process

The plugin provides three indexing functions:

1. **Document Indexing** (`indexDocument`):

   - Retrieves a specific document by content type and ID
   - Extracts text content from specified field (e.g., 'content')
   - Splits text into chunks using configurable chunk size and overlap
   - Generates embeddings for **all chunks in a single batched API call** (falls back to per-chunk calls if the provider rejects batched input)
   - Stores chunks with metadata in `plugin::semantic-search.chunk` table
   - Links chunks to parent document with ownership filtering
   - Invalidates the in-memory cache for the affected owner

2. **Multi-Field Indexing** (`indexDocumentFields`):

   - Combines multiple fields from a document into a single text string
   - Processes the combined text through the same chunking and embedding pipeline
   - Useful for indexing title, content, description, etc. together

3. **Multi-Owner Indexing** (`indexOwnedContent`):
   - Lower-level API for when the same content must be indexed for several owners (e.g. a document shared by multiple agents)
   - Chunks and embeds the text **once**, then stores one set of chunks per owner
   - Accepts `{ text, parentDocId, parentType, title, ownerIds }`

### Search Process

The `querySearch` function performs semantic search using these steps:

1. **Query Vectorization**: Converts the search query into a vector embedding (with a 10 s request timeout — hung provider requests fail fast instead of stalling the caller)
2. **Chunk Cache**: Loads the owner's chunks once into memory as pre-normalized `Float32Array` rows; subsequent queries skip the database entirely until the cache is invalidated by an indexing operation
3. **Similarity Calculation**: Computes cosine similarity as dot products over the pre-normalized vectors — no JSON parsing or ORM hydration per query
4. **Threshold Filtering**: Removes results below the similarity threshold (default: 0.7)
5. **Deduplication**: Groups results by document ID, keeping the highest-scoring chunk per document
6. **Full Content Retrieval**: Fetches full document content for all unique documents in a **single query** (`$in`)
7. **Ranking**: Returns results sorted by similarity score with configurable limit

Every stage logs its timing under the `[Semantic Search]` prefix:

```
[Semantic Search] Embedding + cache: 412 ms (48 chunks for owner 3)
[Semantic Search] Scoring: 0 ms | Top scores: ... | After threshold filter: 2
[Semantic Search] Hydration: 1 ms | Total: 414 ms | Unique documents returned: 2
```

### Data Flow

- **Input**: User search query + optional filters (content type, limit, threshold)
- **Processing**: Vector embedding → cached dot-product similarity → threshold filtering → deduplication
- **Output**: Array of documents with full content, titles, snippets, and similarity scores

## Performance

v1.2.0 focuses on query latency and indexing throughput:

| Change                                                            | Effect                                                                                                                                                                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| In-memory per-owner vector cache (`Float32Array`, pre-normalized) | Query-time similarity is pure dot products; no per-query chunk fetch, JSON parsing, or ORM hydration. Search stage measures in single-digit milliseconds for corpora up to hundreds of thousands of chunks |
| Batched embedding calls at index time                             | Re-indexing makes ~1 API call per 64 chunks instead of 1 per chunk (10–50× faster indexing)                                                                                                                |
| DB indexes created at bootstrap                                   | `owner` and (`parent_doc_id`, `parent_type`) lookups no longer scan the full chunk table                                                                                                                   |
| Single `$in` hydration                                            | Full document content fetched in one round trip instead of one query per result                                                                                                                            |
| Direct REST embedding client with 10 s timeout                    | No SDK dependency; hung provider requests fail fast                                                                                                                                                        |

Notes:

- The cache lives in the Strapi process memory (~6 KB per chunk as float32) and is invalidated automatically whenever the indexer writes or removes chunks. It cold-loads lazily on the first query per owner after a restart.
- If you change `OPENROUTER_MODEL`, re-index your corpus: the plugin detects the vector-dimension mismatch and returns no results (with a warning) rather than garbage scores.

## Example Response

```json
{
  "data": [
    {
      "id": 1,
      "attributes": {
        "title": "Article Title",
        "content": "Article content...",
        "similarity": 0.85
      }
    }
  ],
  "meta": {
    "total": 1,
    "threshold": 0.7
  }
}
```

## Development

### Local Development

```bash
# Clone the repository
git clone https://github.com/thaon/strapi-plugin-semantic-search.git

# Install dependencies
cd strapi-plugin-semantic-search
npm install

# Link for local development
npm link
```

### Testing

```bash
# Run tests
npm test
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/thaon/strapi-plugin-semantic-search/issues) page
2. Create a new issue with detailed information
3. Include your Strapi version and plugin version

## Changelog

### v1.2.0

- **Performance**: in-memory per-owner vector cache (`Float32Array`, pre-normalized) — query-time similarity is now pure dot products
- **Performance**: batched embedding calls at index time (one API call per ~64 chunks, with per-chunk fallback)
- **Performance**: database indexes on `owner` / (`parent_doc_id`, `parent_type`) created automatically at bootstrap
- **Performance**: full document content hydrated in a single `$in` query instead of N+1 `findOne`s
- **Robustness**: replaced the OpenRouter SDK dependency with direct REST calls and a 10 s request timeout
- **Robustness**: cache invalidation on every index/remove operation; dimension-mismatch detection with a clear warning
- **Observability**: per-stage timing logs for search (`Embedding + cache`, `Scoring`, `Hydration`, `Total`) and indexing
- **API**: new `indexer.indexOwnedContent({ text, parentDocId, parentType, title, ownerIds })` for multi-owner indexing with a single embedding pass
- Removed `@openrouter/sdk` dependency (now zero runtime dependencies)

### v1.0.0

- Initial release
- Basic semantic search functionality
- OpenRouter integration
- Configurable chunking and similarity threshold
