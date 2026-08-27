# Rearview Development Guidelines

## Product

Rearview is a private personal journaling and reflection application.

The journal is the source of truth.

The AI exists to help the user discover, retrieve, compare, and synthesize information contained in their journal.

Never treat generated AI content as authoritative over the original journal entries.

## Core Principles

Build simple things well.

Prefer explicit architecture over clever abstractions.

Prefer reusable components over duplicated UI.

Prefer small focused files over large files.

Prefer server side boundaries for sensitive operations.

Never send journal content to external AI providers.

Ollama is the only LLM provider.

PostgreSQL through Neon is the primary database.

Prisma is the primary ORM.

pgvector is used for semantic retrieval.

## Privacy

Journal content is private user data.

Never log journal content.

Never log prompts containing journal content.

Never expose journal content unnecessarily to the browser.

Never expose embeddings to the client.

Never expose database credentials to the client.

Never introduce an external AI API without explicit approval.

All Ollama communication must happen server side.

## Privacy Model

Rearview is a private personal application.

Journal content may be stored in the configured PostgreSQL database for backup and synchronization.

Journal content must never be sent to third party LLM APIs.

Ollama is the only LLM inference provider.

AI inference should occur locally on the machine running Rearview.

Do not introduce OpenAI, Anthropic, Google Gemini, or other hosted AI APIs for journal processing.

Do not send journal content to analytics providers.

Do not log journal content.

Do not include journal content in error reporting payloads.

Do not include journal content in telemetry.

Do not expose journal content through unnecessary API responses.

Database credentials must remain server side.

Embedding generation must use the configured local embedding model through Ollama.

Embeddings must not be sent to hosted AI providers.

The database is considered a backup and persistence layer, not an AI processing provider.

The application should remain functional if Ollama is unavailable, except for AI dependent functionality.

Journal creation and retrieval must not depend on an external AI service.

## Architecture

Keep these concerns separated.

UI

Application logic

Database access

AI services

Retrieval

Validation

Types

Components should not contain database queries.

Components should not directly call Ollama.

Components should not contain vector search implementation.

Route handlers should orchestrate application logic rather than becoming giant implementations.

Database operations should live behind focused data access functions or services.

AI operations should live behind a reusable AI service.

Retrieval operations should live behind a reusable retrieval service.

## Atomic Design

Follow Atomic Design throughout the application.

Use the following hierarchy.

Atoms

Small foundational UI elements.

Examples include buttons, labels, icons, inputs, badges, and simple typography components.

Molecules

Small combinations of atoms that form a meaningful reusable unit.

Examples include DatePicker, SearchInput, MemoryMetadata, EntryDate.

Organisms

Larger reusable interface sections.

Examples include Sidebar, JournalEditor, ActivityMap, MemoryResults.

Templates

Page level structural layouts that compose organisms.

Pages

Route specific compositions.

Do not force components into Atomic Design categories when doing so makes the architecture worse.

Use the category that best represents the component's responsibility.

## Component Reuse

If the same UI or behavior appears more than once, consider creating a reusable component.

Do not duplicate substantial markup.

Keep reusable components focused.

Avoid components that know too much about application state outside their responsibility.

Prefer composition over giant configurable components.

## Naming

Component filenames must include their Atomic Design classification.

Examples

Sidebar.organism.tsx

DatePicker.molecule.tsx

JournalEditor.organism.tsx

ActivityMap.organism.tsx

MemoryCard.molecule.tsx

Button.atom.tsx

The exported component should use the normal component name.

Examples

Sidebar

DatePicker

JournalEditor

ActivityMap

MemoryCard

Button

Hooks should use normal hook naming.

Examples

useJournalEntry.ts

useMemories.ts

useActivityMap.ts

Services should use clear names.

Examples

journal.service.ts

retrieval.service.ts

ollama.service.ts

embedding.service.ts

memory.service.ts

Database access should use focused modules.

## File Size

No source file should exceed 150 lines unless there is a strong architectural reason.

Do not artificially split pure logic merely to satisfy the limit.

When a component becomes too large, identify separate responsibilities and extract them.

Common extraction targets include

Components

Hooks

Utilities

Validation schemas

Database functions

Services

Types

Constants

## Database

Use Prisma for standard relational operations.

Use PostgreSQL specific SQL only where required.

pgvector operations may use raw SQL when Prisma does not provide an appropriate abstraction.

Keep vector operations isolated from the rest of the application.

Journal dates and database timestamps are different concepts.

A journal entry may be created today while representing a date years in the past.

The journal date must therefore be explicitly stored.

Avoid relying on createdAt for journal chronology.

## Journal Entries

Journal entries are the source data for Rearview.

Entries should support

Historical dates

Current dates

Editing

Rich text

Paragraphs

Bold text

Italic text

Bulleted lists

The editor should remain intentionally simple.

Do not introduce unnecessary formatting features.

Avoid unnecessary editor complexity.

## Rich Text

Choose a format that is easy to persist, render, validate, and process for embeddings.

The stored representation must allow clean extraction of plain text for search and embedding generation.

Never embed raw HTML or editor specific structures without first considering how they will be converted into meaningful text.

The retrieval system should work with the semantic text of an entry rather than presentation markup.

## Embeddings

Do not assume every journal entry should become one embedding.

Short entries can remain intact.

Long entries should be split into meaningful chunks.

Every chunk must retain its parent journal entry.

Chunk records should contain enough information to identify

The parent entry

The chunk text

The embedding

The chunk ordering

Any useful metadata

Chunking must be deterministic.

If an entry changes, its existing embeddings should be invalidated or regenerated.

Do not silently leave stale embeddings after an entry is edited.

## Retrieval

Retrieval should be treated as its own application capability.

The Memories page should not know how vector search works.

The retrieval layer should be able to evolve from simple semantic search into more sophisticated retrieval later.

Consider

Semantic similarity

Date filters

Metadata filters

Keyword matching

Result limits

Reranking

Diversity across journal dates

Avoid returning ten chunks from the same journal entry when five different entries would provide a better answer.

For broad questions, retrieval should prioritize evidence across multiple relevant dates.

## AI

Ollama is the only LLM provider.

Model names must be configurable.

Do not hardcode model names throughout the application.

Generation and embeddings should be treated as separate capabilities.

Create a reusable abstraction for both.

Do not call Ollama directly from React components.

The server should construct prompts using retrieved journal evidence.

The model should be explicitly instructed that journal evidence is the source of truth.

The model must not fabricate events.

When evidence is insufficient, the response should communicate uncertainty.

## Memories

A Memory represents a useful reflection discovered through the journal.

A Memory should preserve

The original question

The generated answer

The referenced journal entries

The creation timestamp

The original journal entries remain authoritative.

Saved Memories are snapshots of a reflection, not replacements for journal content.

## Overview

The Overview page should remain intentionally simple.

It should contain

A time based greeting

Current goals

Journal activity

The activity visualization should indicate only whether an entry exists on a particular date.

There should be no contribution intensity system.

The activity data must come from the database.

Never hardcode the date range.

The visualization must continue working as new journal entries are added.

## Current Goals

Current goals are intentionally lightweight.

They exist to remind the user what direction they currently care about.

Do not turn Current Goals into a project management application.

Keep the model and UI simple unless future requirements explicitly expand this feature.

## Validation

Use Zod when appropriate.

Validate all user supplied input.

Validate journal dates.

Validate journal content.

Validate AI queries.

Validate Memory operations.

Never assume client side validation is sufficient.

Server side boundaries must validate input independently.

## Error Handling

Errors should be meaningful and actionable.

Do not silently swallow errors.

Do not expose sensitive implementation details to the user.

Do not expose database credentials.

Do not expose internal prompts unnecessarily.

Ollama being unavailable should produce a useful user facing state.

Embedding failures should not corrupt the underlying journal entry.

A journal entry should remain saved even if asynchronous embedding generation fails.

## Performance

Do not block journal saving on expensive AI operations unless there is a strong reason.

Saving the journal entry and generating its embeddings should be architecturally separable.

Prefer asynchronous or deferred embedding generation when practical.

Retrieval should return a reasonable amount of context.

Do not send an entire lifetime of journals into an LLM context window.

Retrieve evidence first.

Then synthesize.

## Testing

Test application logic rather than only implementation details.

Important areas include

Journal creation

Historical journal dates

Journal editing

Activity map calculations

Date filtering

Embedding generation

Embedding invalidation

Retrieval

Memory creation

AI response handling

Error states

Do not write tests that merely confirm that a component renders without testing meaningful behavior.

## Development Workflow

Before modifying code

Read this CLAUDE.md.

Inspect the relevant existing implementation.

Understand existing conventions.

Prefer modifying existing architecture over replacing it.

Do not rewrite working infrastructure without a clear reason.

Do not introduce unnecessary dependencies.

Keep each implementation session focused on its assigned phase.

Do not start work from a future phase unless the current phase requires a small dependency.

## Session Discipline

Each Claude Code conversation should have one primary phase.

Do not allow implementation sessions to grow indefinitely.

At the end of each phase

Run relevant tests.

Run linting.

Run type checking.

Review changed files.

Confirm acceptance criteria.

Summarize what was implemented.

Identify any remaining issues.

Create the exact prompt for the next Claude Code session.

The next prompt must tell Claude to read CLAUDE.md and continue from the current repository state.

Never assume the next session remembers the previous conversation.

## Git

Keep commits focused.

Do not mix unrelated changes.

Use descriptive commit messages.

A commit should represent one coherent unit of work.

Do not commit secrets or environment files containing credentials.

## Scope Control

Do not add features simply because they seem useful.

The current product intentionally does not need

Complex task management

Social features

Multiple users

Public profiles

Complicated formatting systems

Hosted AI services

Unnecessary analytics

Complex notification systems

The goal is a private, focused personal journal and reflection system.

## Definition of Done

A feature is not complete merely because it works visually.

Before considering a feature complete

The implementation follows the architecture.

The implementation follows Atomic Design.

Files remain reasonably small.

Sensitive data remains private.

Types are correct.

Validation exists.

Error states are handled.

Tests exist where appropriate.

Lint passes.

Type checking passes.

The feature works with real database data.

The feature does not depend on hardcoded journal dates or example content.

The implementation is maintainable by another developer.