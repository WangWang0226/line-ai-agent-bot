# LINE Shared-Memory AI Agent

This project implements the MVP for a LINE group AI assistant that only responds when mentioned, keeps short-term conversation context, and supports a group-scoped long-term memory layer backed by Supabase + pgvector.

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
3. Fill in required values in `.env`.
4. Start the app:
   ```bash
   npm run dev
   ```
5. For production build:
   ```bash
   npm run build
   npm start
   ```

## Required environment values

- `PORT`
- `OPENAI_API_KEY`
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_EMBEDDING_MODEL`
- `OPENAI_EMBEDDING_DIMENSIONS`

The app validates these at startup and exits with a clear error if required config is missing.

## LINE webhook

The webhook endpoint is:

```http
POST /webhooks/line
```

This route verifies the LINE signature header before processing any event.

## MVP status

Implemented so far:

- LINE webhook route with signature verification
- Mention detection and bot mention stripping
- Express app and health endpoint
- OpenAI Responses API integration with web search and function tools
- Message storage and recent group context loading
- Group-scoped memory tools: search, save, update, delete
- OpenAI embeddings for long-term memories
- Supabase REST repositories and pgvector migration
- webhook idempotency using `line_message_id`
- safe LINE response splitting
- automatic memory extraction from batches of raw group messages
- memory deduplication before automatic saves
- unit tests for mention detection, memory isolation, and invalid signature handling

## Next steps for you

1. Create a LINE Messaging API channel and set the webhook URL.
2. Set your actual environment values in `.env`.
3. Create a Supabase project and run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor.
4. Add the OpenAI API key with access to the response model and `text-embedding-3-small`.
5. Deploy to Cloud Run or another public HTTPS host.
6. In LINE Developers, set the webhook to `https://YOUR_DOMAIN/webhooks/line` and enable webhook usage.

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run the full contents of:
   ```text
   supabase/migrations/001_initial_schema.sql
   ```
4. If you created the database before automatic memory extraction was added, also run:
   ```text
   supabase/migrations/002_memory_extraction.sql
   ```
5. Copy the project URL into `SUPABASE_URL`.
6. Copy the service role key into `SUPABASE_SERVICE_ROLE_KEY`.

The migration uses `text-embedding-3-small`, which has 1536 dimensions. If you change `OPENAI_EMBEDDING_MODEL`, update both `OPENAI_EMBEDDING_DIMENSIONS` and the `vector(1536)` definitions in the migration.

## Important security notes

- Do not commit real credentials.
- Keep `group_id` controlled by runtime context, never by LLM tool input.
- Only store or retrieve memory within the current LINE group.

## Docker

```bash
docker build -t line-memory-agent .
docker run --env-file .env -p 8080:8080 line-memory-agent
```

## Cloud Run

Use environment variables or Secret Manager for secrets. Example:

```bash
gcloud run deploy line-memory-agent \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars PORT=8080
```

Set secret values such as `OPENAI_API_KEY`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, and `SUPABASE_SERVICE_ROLE_KEY` through Secret Manager or Cloud Run environment configuration. Do not bake secrets into the Docker image.

## Automatic memory extraction

The app stores raw group messages separately from long-term memory. It periodically processes unhandled raw messages in batches, asks OpenAI to extract durable memories, deduplicates against existing memories, and saves only useful long-term facts.

Useful environment values:

```env
MEMORY_EXTRACTION_ENABLED=true
MEMORY_EXTRACTION_BATCH_SIZE=30
MEMORY_EXTRACTION_MIN_MESSAGES=20
MEMORY_EXTRACTION_DEDUPE_THRESHOLD=0.88
OPENAI_EXTRACTION_MODEL=gpt-4.1-mini
```

Raw message cleanup does not delete long-term memories.
