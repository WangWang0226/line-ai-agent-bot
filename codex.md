# LINE Shared-Memory AI Agent

## 1. Project Goal

Build an AI agent that can be added to a LINE group chat.

The bot should remain silent during normal conversation and respond only when explicitly mentioned/tagged.

Example:

```text
Leon:
@Jarvis What did we decide about the Montreal trip?

Jarvis:
You previously decided to travel to Montreal on December 20.
```

The bot should support:

1. LINE group integration
2. Mention-based activation
3. OpenAI Responses API
4. Web search
5. Tool/function calling
6. Short-term conversation context
7. Long-term shared group memory
8. Semantic memory retrieval using embeddings
9. Automatic extraction of important memories
10. Explicit memory commands
11. Cloud deployment

The system should behave as a shared AI assistant for the entire LINE group rather than as a simple chatbot.

---

# 2. Technology Stack

Use the following stack unless there is a strong technical reason to change it.

```text
Language:
TypeScript

Runtime:
Node.js

Web framework:
Fastify or Express

AI:
OpenAI Responses API

LINE:
LINE Messaging API

Database:
Supabase PostgreSQL

Vector search:
pgvector

Deployment:
Google Cloud Run

Container:
Docker

Optional archive:
Google Drive API
```

Avoid introducing LangChain/LangGraph in the initial implementation.

Prefer native OpenAI tool/function calling.

Keep the architecture simple and modular so an orchestration framework can be added later if necessary.

---

# 3. High-Level Architecture

```text
                         LINE Group
                              │
                              │ @bot
                              ▼
                    LINE Messaging API
                              │
                           Webhook
                              │
                              ▼
                  ┌─────────────────────┐
                  │   Node.js Backend   │
                  │     TypeScript      │
                  └──────────┬──────────┘
                             │
                     Mention Detection
                             │
                             ▼
                  ┌─────────────────────┐
                  │    Agent Service    │
                  │ OpenAI Responses API│
                  └──────────┬──────────┘
                             │
              ┌──────────────┼───────────────┐
              │              │               │
              ▼              ▼               ▼
         Web Search     Memory Tools      Other Tools
                             │
                             ▼
                  ┌─────────────────────┐
                  │      Supabase       │
                  │ PostgreSQL+pgvector │
                  └─────────────────────┘
```

The LINE webhook handler must NOT contain agent/business logic.

Use clear service boundaries.

---

# 4. Suggested Project Structure

Create approximately the following structure:

```text
src/
├── app.ts
├── server.ts
│
├── config/
│   ├── env.ts
│   └── constants.ts
│
├── routes/
│   └── lineWebhook.ts
│
├── line/
│   ├── client.ts
│   ├── verifySignature.ts
│   ├── mention.ts
│   └── reply.ts
│
├── agent/
│   ├── agent.ts
│   ├── systemPrompt.ts
│   ├── contextBuilder.ts
│   └── toolRegistry.ts
│
├── tools/
│   ├── memory/
│   │   ├── searchMemory.ts
│   │   ├── saveMemory.ts
│   │   ├── updateMemory.ts
│   │   └── deleteMemory.ts
│   │
│   └── index.ts
│
├── memory/
│   ├── memoryService.ts
│   ├── memoryExtractor.ts
│   ├── embeddingService.ts
│   └── memoryRepository.ts
│
├── messages/
│   ├── messageService.ts
│   └── messageRepository.ts
│
├── db/
│   ├── supabase.ts
│   └── types.ts
│
├── types/
│   ├── line.ts
│   ├── memory.ts
│   └── agent.ts
│
└── utils/
    └── logger.ts

supabase/
└── migrations/

tests/
├── unit/
└── integration/

Dockerfile
.env.example
package.json
tsconfig.json
README.md
codex.md
```

Do not over-engineer the folder structure if some modules remain small.

---

# 5. Environment Variables

Create `.env.example`.

Never commit real credentials.

Required variables:

```env
PORT=8080

OPENAI_API_KEY=

LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Optional
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_REFRESH_TOKEN=
```

Validate required environment variables when the application starts.

Fail fast if required variables are missing.

---

# 6. LINE Integration

Create a LINE Messaging API webhook endpoint.

```http
POST /webhooks/line
```

Verify the LINE webhook signature before processing any events.

Reject invalid requests.

The webhook may contain multiple events, so process each supported event independently.

Initially support:

```text
message.type = text
source.type = group
```

Ignore unsupported events gracefully.

---

# 7. Mention-Based Activation

The AI agent must respond only when the bot itself is mentioned.

Use LINE's mention metadata rather than checking the text for a hard-coded bot name.

Conceptually:

```ts
const botWasMentioned =
  event.message.mention?.mentionees?.some(
    mention => mention.isSelf === true
  );
```

If the bot is not mentioned:

```text
Do not invoke the main AI agent.
Do not send a LINE response.
```

However, see the message-storage requirements below. Non-mentioned messages may still be stored for conversation context if the group has opted into history storage.

Remove or normalize the bot mention before sending the user's actual question to the LLM.

---

# 8. Message Storage

Store group text messages so the bot can understand recent conversation context.

Suggested schema:

```sql
groups

id uuid primary key
line_group_id text unique not null
name text
created_at timestamptz
updated_at timestamptz
```

```sql
users

id uuid primary key
line_user_id text unique not null
display_name text
created_at timestamptz
updated_at timestamptz
```

```sql
messages

id uuid primary key
group_id uuid references groups(id)
user_id uuid references users(id)
line_message_id text unique
content text not null
created_at timestamptz
```

Add indexes for:

```text
group_id
user_id
created_at
line_message_id
```

---

# 9. Privacy / Group Isolation

This requirement is critical.

Memories and messages belonging to one LINE group must NEVER be exposed to another group.

Every memory query must be scoped by:

```text
group_id
```

Never perform global memory retrieval unless explicitly implementing an administrator feature in the future.

The effective security boundary is:

```text
LINE Group
    ↓
group_id
    ↓
messages + memories
```

---

# 10. Short-Term Context

When the bot is mentioned, retrieve recent messages from the same group.

Example:

```text
last 20-50 messages
```

The exact number should be configurable.

Example:

```env
RECENT_MESSAGE_LIMIT=30
```

Build the agent context approximately as:

```text
System Prompt

Relevant Long-Term Memories

Recent Group Conversation

Current User Question
```

Do NOT send the entire group history to the model.

---

# 11. Long-Term Memory

Long-term memory must be separate from raw message history.

Do not treat every LINE message as a permanent memory.

Create:

```sql
memories

id uuid primary key
group_id uuid references groups(id)

content text not null
summary text

category text
importance float

embedding vector(...)

created_by uuid references users(id)

created_at timestamptz
updated_at timestamptz
```

Possible categories:

```text
decision
plan
recommendation
preference
fact
resource
event
other
```

Create:

```sql
memory_sources

id uuid primary key
memory_id uuid references memories(id)
message_id uuid references messages(id)
```

This allows a memory to retain references to the original messages from which it was extracted.

---

# 12. Embeddings

When a long-term memory is created:

```text
memory text
     ↓
OpenAI Embedding API
     ↓
embedding vector
     ↓
Supabase pgvector
```

Use a currently supported OpenAI embedding model.

Do not hard-code embedding dimensions independently of the selected model.

Document the selected model and vector dimension in configuration/migrations.

---

# 13. Semantic Memory Search

Implement:

```text
search_memory
```

Input:

```json
{
  "query": "Montreal trip",
  "limit": 5
}
```

Process:

```text
query
  ↓
embedding
  ↓
pgvector similarity search
  ↓
filter by current group_id
  ↓
Top-K memories
```

Return structured results:

```json
[
  {
    "id": "...",
    "content": "The group decided to visit Montreal on December 20.",
    "category": "plan",
    "similarity": 0.89,
    "createdAt": "..."
  }
]
```

The LLM can then use those memories to answer naturally.

---

# 14. Agent Tools

Create a central tool registry.

Initial tools:

```text
search_memory
save_memory
update_memory
delete_memory
```

OpenAI built-in tool:

```text
web_search
```

The tool architecture must make adding future tools easy.

Potential future tools:

```text
weather
exchange_rate
create_poll
create_todo
list_todos
restaurant_search
calendar
summarize_today
summarize_week
```

---

# 15. search_memory Tool

Purpose:

Search long-term group memory.

Parameters:

```json
{
  "query": "string",
  "limit": 5
}
```

The backend must inject `group_id`.

The model must NOT be allowed to choose arbitrary group IDs.

Conceptually:

```ts
searchMemory({
  groupId: runtimeContext.groupId,
  query,
  limit
});
```

This prevents cross-group data access.

---

# 16. save_memory Tool

Purpose:

Explicitly save important information.

Example:

```text
@Jarvis Remember that we're going to Montreal on December 20.
```

The agent should call:

```text
save_memory
```

Example parameters:

```json
{
  "content": "The group plans to travel to Montreal on December 20.",
  "category": "plan",
  "importance": 0.8
}
```

Backend automatically provides:

```text
group_id
created_by
created_at
```

Generate an embedding before inserting the memory.

---

# 17. update_memory Tool

Allow the agent to modify an existing memory.

Example:

```text
@Jarvis Actually, Montreal was changed from December 20 to December 21.
```

Expected flow:

```text
search_memory
      ↓
identify existing memory
      ↓
update_memory
      ↓
regenerate embedding
```

Do not simply create contradictory duplicate memories when the user clearly intends to update existing information.

---

# 18. delete_memory Tool

Allow users to explicitly remove memories.

Example:

```text
@Jarvis Forget the Montreal plan.
```

Flow:

```text
search_memory
      ↓
identify relevant memory
      ↓
delete_memory
```

The initial implementation may physically delete the memory.

Design the repository so soft deletion can be introduced later.

---

# 19. Automatic Memory Extraction

Do not call `save_memory` for every normal message.

That would produce large amounts of useless memory.

Instead, periodically analyze batches of recent messages.

Example:

```text
20-50 new messages
       ↓
Memory Extractor
       ↓
LLM
       ↓
0-N candidate memories
```

The extractor should look for information worth remembering.

Examples:

```text
decisions
plans
recommendations
stable preferences
important facts
shared resources
events
```

Do not normally save:

```text
greetings
jokes
small talk
temporary emotional states
random reactions
duplicate information
```

Example conversation:

```text
A: Should we go to Montreal in December?
B: Sure.
Leon: December 20?
A: Works for me.
B: Me too.
```

Extract:

```json
{
  "content": "The group agreed to visit Montreal on December 20.",
  "category": "plan",
  "importance": 0.8
}
```

Not five separate memories.

---

# 20. Memory Deduplication

Before automatically inserting a candidate memory:

```text
candidate memory
      ↓
embedding
      ↓
search similar existing memories
```

If a highly similar memory already exists, either:

```text
skip
```

or:

```text
update/merge
```

Do not accumulate many nearly identical memories.

Keep similarity thresholds configurable.

---

# 21. Agent System Prompt

Create the system prompt in a dedicated module.

The prompt should explain that the agent:

* participates in a LINE group
* responds only after the application has determined it was mentioned
* may use recent conversation context
* has access to shared group memory
* should search memory when questions reference previous discussions
* should use web search for current/external information
* should distinguish memory from current web information
* should not invent past conversations
* should save memory only when explicitly requested or when clearly appropriate
* should prefer updating an existing memory when information changes
* must never claim to remember something when memory retrieval found nothing

Example behavioral rule:

```text
If the user asks about something previously discussed, use search_memory before answering.

If the information may have changed recently, use web_search.

If both historical group context and current information are needed, use both tools.
```

---

# 22. Agent Execution Flow

When mentioned:

```text
LINE event
    ↓
verify signature
    ↓
parse group/user/message
    ↓
store message
    ↓
load recent messages
    ↓
optional initial memory retrieval
    ↓
build agent context
    ↓
OpenAI Responses API
    ↓
tool call?
 ┌──────┴───────┐
 yes            no
 │               │
 ▼               ▼
execute tool   final answer
 │
 ▼
return tool result
 │
 ▼
LLM continues
 │
 ▼
final answer
    ↓
LINE Reply API
```

Support multiple tool calls if required.

Do not assume one tool call per request.

Add a maximum tool-call iteration limit to prevent infinite loops.

---

# 23. Web Search

Enable OpenAI's built-in web search tool.

The model should use web search for questions such as:

```text
current news
current exchange rates
recent product information
current laws/rules
recent events
up-to-date factual questions
```

It should not unnecessarily search the web for simple questions or information already available in group memory.

---

# 24. Response Formatting

LINE responses should be concise and readable.

Avoid Markdown features that LINE renders poorly.

Transform or strip unsupported formatting before replying.

Implement a safe maximum response length.

If the model produces a very long response, either:

```text
truncate intelligently
```

or:

```text
split into multiple LINE messages
```

Prefer splitting at paragraph boundaries.

---

# 25. Error Handling

Handle:

```text
invalid LINE signature
unsupported event
OpenAI API failure
Supabase failure
embedding failure
tool execution failure
LINE reply failure
timeout
duplicate webhook delivery
```

Do not crash the server because one event fails.

Log useful debugging metadata without logging secrets.

---

# 26. Webhook Idempotency

LINE may redeliver webhook events.

Use `line_message_id` or another appropriate event identifier to avoid processing the same message twice.

Duplicate webhook delivery must not:

```text
create duplicate messages
create duplicate memories
invoke the LLM twice
send duplicate replies
```

---

# 27. Logging

Implement structured logging.

Log fields such as:

```text
event type
group ID or safe hashed identifier
message ID
tool name
OpenAI request duration
database duration
error category
```

Never log:

```text
API keys
access tokens
LINE channel secret
Supabase service role key
```

Be conservative about logging full user messages.

---

# 28. Cost Controls

The system should be designed to minimize API cost.

Use:

```text
mention-only agent invocation
limited recent-message context
semantic memory retrieval
Top-K memory results
batch memory extraction
smaller/cheaper models for extraction where appropriate
```

Do not repeatedly summarize the entire conversation.

Store summaries/memories so previous work can be reused.

---

# 29. Optional Google Drive Archive

Google Drive is NOT the primary memory database.

Supabase is the source of truth for searchable memory.

Google Drive may later be used as a human-readable archive.

Possible structure:

```text
LINE Group Memory/
└── <group>/
    └── 2026/
        └── September/
            ├── Decisions.md
            ├── Travel.md
            ├── Recommendations.md
            └── Weekly Summary.md
```

Implement this only after the core MVP works.

Keep Drive functionality behind a separate service interface.

---

# 30. Testing

Use automated tests.

At minimum test:

### Mention detection

```text
bot mentioned → true
other user mentioned → false
no mention → false
multiple mentions including bot → true
```

### Group isolation

Memory from Group A must never appear in Group B.

### Memory search

Test:

```text
embedding generation
vector search
Top-K behavior
group filtering
```

### Memory tools

Test:

```text
save
search
update
delete
```

### Webhook

Test:

```text
valid signature
invalid signature
duplicate event
unsupported message type
```

Mock external APIs in unit tests.

---

# 31. Docker

Create a production-ready Dockerfile.

Application should run using:

```bash
docker build -t line-memory-agent .
docker run --env-file .env -p 8080:8080 line-memory-agent
```

Expose port:

```text
8080
```

Use a small production Node image and avoid shipping unnecessary development dependencies where practical.

---

# 32. Cloud Run Deployment

The application must be deployable to Google Cloud Run.

Expected architecture:

```text
LINE
 ↓
HTTPS webhook
 ↓
Cloud Run
 ↓
OpenAI
 ↓
Supabase
```

Document deployment instructions in README.

Do not store production secrets inside the Docker image.

Use environment variables or Google Secret Manager in production.

---

# 33. Security

Implement:

```text
LINE webhook signature verification
environment-based secrets
group-scoped database queries
input validation
tool argument validation
reasonable request limits
safe logging
```

Never allow LLM-generated tool arguments to directly determine privileged identifiers such as:

```text
group_id
user_id
database connection information
```

These values must come from trusted runtime context.

---

# 34. MVP Scope

Implement the MVP in this order.

## Phase 1 — LINE Echo Bot

Implement:

```text
LINE webhook
signature verification
mention detection
LINE reply
```

Acceptance:

```text
Normal group message
→ bot silent

@bot hello
→ bot responds
```

---

## Phase 2 — OpenAI Agent

Replace echo response with OpenAI Responses API.

Acceptance:

```text
@bot explain Ethereum

→ OpenAI answer
→ LINE response
```

---

## Phase 3 — Message History

Add:

```text
Supabase
groups
users
messages
recent conversation context
```

Acceptance:

The bot can understand references to the immediately preceding group conversation.

---

## Phase 4 — Long-Term Memory

Add:

```text
pgvector
embeddings
memories
memory_sources

search_memory
save_memory
update_memory
delete_memory
```

Acceptance:

```text
@bot Remember that our Montreal trip is December 20.

...

@bot When is our Montreal trip?

→ December 20.
```

---

## Phase 5 — Web Search

Enable:

```text
OpenAI web_search
```

Acceptance:

The agent can answer current-information questions using web search.

---

## Phase 6 — Automatic Memory Extraction

Add:

```text
message batching
memory extraction
importance classification
deduplication
automatic memory creation
```

Acceptance:

Important group decisions can later be recalled even if nobody explicitly said "remember this."

---

## Phase 7 — Production Hardening

Add:

```text
idempotency
retry strategy
structured logging
rate limiting
error handling
Cloud Run deployment
Secret Manager
integration tests
```

---

# 35. Do Not Implement Yet

Do NOT include these in the initial MVP unless required by an earlier architectural decision:

```text
LangChain
LangGraph
Redis
Kafka
Kubernetes
complex microservices
custom vector database
Google Drive synchronization
admin dashboard
multi-agent architecture
```

The application should initially remain one deployable backend service.

Avoid adding infrastructure simply because it exists.

---

# 36. Future Extensions

Design extension points for:

```text
Google Calendar

@bot When are we all free next weekend?


Todo management

@bot Add "book hotel" to our Japan trip todo list.


Polls

@bot Create a poll for Montreal vs Quebec City.


Restaurant search

@bot Find Japanese restaurants near our hotel.


Group summaries

@bot Summarize what we discussed this week.


Memory browser

Web UI for viewing/editing stored memories.


Personal memory

Separate:
group shared memory
user private memory


Multimodal input

LINE image
    ↓
vision model
    ↓
understand image
    ↓
optional memory


Document ingestion

PDF / URL / Google Drive
    ↓
chunking
    ↓
embeddings
    ↓
group knowledge base
```

Keep these possibilities in mind but do not prematurely implement them.

---

# 37. Core Design Principle

The application has three fundamentally different information sources:

```text
1. Recent conversation
   ↓
short-term context

2. Historical group knowledge
   ↓
long-term semantic memory

3. External/current information
   ↓
web search
```

The agent should dynamically decide which source is needed.

Example:

```text
"剛剛 Kevin 說哪一天有空？"

→ recent conversation


"我們之前決定日本住哪裡？"

→ search_memory


"東京下週天氣如何？"

→ web_search


"我們之前決定 12/20 去 Montreal，
現在那週天氣預報如何？"

→ search_memory
→ web_search
→ combined answer
```

---

# 38. Definition of Done

The MVP is complete when this scenario works end-to-end:

```text
LINE group:

A:
How about Montreal on December 20?

B:
Works for me.

Leon:
Sounds good.

[Later]

Leon:
@Jarvis Remember our Montreal plan.

Jarvis:
Saved.

[Weeks later]

Leon:
@Jarvis When did we decide to go to Montreal?

Jarvis:
You decided on December 20.

Leon:
@Jarvis What's the weather forecast around that date?

Jarvis:
[uses web search and responds with current information]
```

The bot must retrieve the Montreal information from persistent semantic memory rather than relying on an indefinitely growing OpenAI conversation.

---

# 39. Implementation Instructions for Codex

Work incrementally.

Before implementing each phase:

1. Inspect the existing repository.
2. Do not overwrite working functionality unnecessarily.
3. State which files will be created or modified.
4. Implement the smallest coherent change.
5. Add tests.
6. Run type checking.
7. Run tests.
8. Fix failures before continuing.
9. Update README when setup or architecture changes.
10. Never commit credentials.

Prefer:

```text
simple
typed
testable
modular
production-oriented
```

over clever abstractions.

When uncertain about an external API, consult the current official documentation rather than assuming outdated SDK behavior.

At the end of each phase, report:

```text
Implemented
Files changed
Tests added
Commands run
Known limitations
Next phase
```

Do not proceed by generating the entire application as one giant unverified change.
