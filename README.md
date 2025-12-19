# Strapi Plugin Semantic Search

A Strapi plugin that adds semantic search capabilities using OpenRouter embeddings. This plugin enables intelligent content search that understands meaning and context, not just keyword matching.

## Features

- **Semantic Search**: Search content using embeddings for better relevance
- **Document Chunking**: Automatically chunks large documents for optimal search results
- **Similarity Threshold**: Configurable similarity threshold for search results
- **OpenRouter Integration**: Uses OpenRouter's embedding models
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
module.exports = ({ env }) => ({
  // ... other plugins
  "strapi-plugin-semantic-search": {
    enabled: true,
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
  ownerId // Required: user ID for ownership filtering
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
  ownerId // Required: user ID for ownership filtering
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

The plugin can be configured through environment variables:

| Variable               | Description                  | Default                         |
| ---------------------- | ---------------------------- | ------------------------------- |
| `OPENROUTER_API_KEY`   | Your OpenRouter API key      | Required                        |
| `OPENROUTER_MODEL`     | Embedding model to use       | `openai/text-embedding-3-small` |
| `SITE_URL`             | Your Strapi site URL         | `http://localhost:1337`         |
| `SITE_NAME`            | Your site name               | `StrapiSemanticSearch`          |
| `CHUNK_SIZE`           | Document chunk size          | `1000`                          |
| `CHUNK_OVERLAP`        | Chunk overlap size           | `150`                           |
| `SIMILARITY_THRESHOLD` | Default similarity threshold | `0.5`                           |

## How It Works

### Indexing Process

The plugin provides two main indexing functions:

1. **Document Indexing** (`indexDocument`):

   - Retrieves a specific document by content type and ID
   - Extracts text content from specified field (e.g., 'content')
   - Splits text into chunks using configurable chunk size and overlap
   - Generates vector embeddings for each chunk using OpenRouter
   - Stores chunks with metadata in `plugin::semantic-search.chunk` table
   - Links chunks to parent document with ownership filtering

2. **Multi-Field Indexing** (`indexDocumentFields`):
   - Combines multiple fields from a document into a single text string
   - Processes the combined text through the same chunking and embedding pipeline
   - Useful for indexing title, content, description, etc. together

### Search Process

The `querySearch` function performs semantic search using these steps:

1. **Query Vectorization**: Converts the search query into a vector embedding
2. **Chunk Retrieval**: Fetches stored chunks filtered by owner ID and optionally by content type
3. **Similarity Calculation**: Computes cosine similarity between query vector and all chunk embeddings
4. **Threshold Filtering**: Removes results below the similarity threshold (default: 0.7)
5. **Deduplication**: Groups results by document ID, keeping the highest-scoring chunk per document
6. **Full Content Retrieval**: For each unique document, fetches the full document content from `api::doc.doc` table
7. **Ranking**: Returns results sorted by similarity score with configurable limit

### Data Flow

- **Input**: User search query + optional filters (content type, limit, threshold)
- **Processing**: Vector embedding → cosine similarity → threshold filtering → deduplication
- **Output**: Array of documents with full content, titles, snippets, and similarity scores

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
git clone https://github.com/yourusername/strapi-plugin-semantic-search.git

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

1. Check the [Issues](https://github.com/yourusername/strapi-plugin-semantic-search/issues) page
2. Create a new issue with detailed information
3. Include your Strapi version and plugin version

## Changelog

### v1.0.0

- Initial release
- Basic semantic search functionality
- OpenRouter integration
- Configurable chunking and similarity threshold
