-- Current Goals become rich text, sharing the journal editor. Additive column
-- with a constant default: no table rewrite, no data loss. The existing `text`
-- column is retained as the extracted plain-text mirror (CLAUDE.md > Rich Text).

-- AlterTable
ALTER TABLE "CurrentGoals" ADD COLUMN "content" JSONB NOT NULL DEFAULT '{}';
