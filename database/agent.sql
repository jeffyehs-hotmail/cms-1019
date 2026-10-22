-- Agent token usage report (Claude Code SessionEnd hook → api/agent-token-usages).
-- Hand-written DDL (not an SSMS export), safe to re-run. Spec: spec/agent/AgentTokenUsage.md
USE [CMS]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Per-user agent token (cms_at_...). Only the lowercase hex SHA-256 is stored; NULL = no token.
IF COL_LENGTH('dbo.AppUser', 'AgentTokenHash') IS NULL
	ALTER TABLE [dbo].[AppUser] ADD [AgentTokenHash] [nvarchar](64) NULL
GO
-- Plain (not filtered/unique) index: a filtered index would make every AppUser INSERT/UPDATE fail on connections
-- with QUOTED_IDENTIFIER OFF (sqlcmd default, legacy tools). Tokens are 256-bit random, so collisions are not a concern.
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_AppUser_AgentTokenHash')
	DROP INDEX [UX_AppUser_AgentTokenHash] ON [dbo].[AppUser]
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AppUser_AgentTokenHash')
CREATE NONCLUSTERED INDEX [IX_AppUser_AgentTokenHash] ON [dbo].[AppUser] ([AgentTokenHash])
GO

-- One row per Claude Code session, Taipei (UTC+8) date and model. A report replaces all rows of its session.
IF OBJECT_ID('dbo.AgentTokenUsage', 'U') IS NULL
CREATE TABLE [dbo].[AgentTokenUsage](
	[SessionId] [nvarchar](100) NOT NULL,
	[UsageDate] [date] NOT NULL,
	[Model] [nvarchar](100) NOT NULL,
	[UserId] [nvarchar](200) NOT NULL,
	[Project] [nvarchar](200) NOT NULL,
	[SessionName] [nvarchar](200) NULL,
	[InputTokens] [bigint] NOT NULL,
	[OutputTokens] [bigint] NOT NULL,
	[CacheWrite5mTokens] [bigint] NOT NULL,
	[CacheWrite1hTokens] [bigint] NOT NULL,
	[CacheReadTokens] [bigint] NOT NULL,
	[Cost] [decimal](18, 6) NULL,
	[ParserVersion] [nvarchar](20) NOT NULL,
	[UpdatedTime] [datetime] NOT NULL,
 CONSTRAINT [PK_AgentTokenUsage] PRIMARY KEY CLUSTERED
(
	[SessionId] ASC,
	[UsageDate] ASC,
	[Model] ASC
)
) ON [PRIMARY]
GO
-- Session name from the transcript: last custom-title (/rename), else last ai-title; NULL when neither.
IF COL_LENGTH('dbo.AgentTokenUsage', 'SessionName') IS NULL
	ALTER TABLE [dbo].[AgentTokenUsage] ADD [SessionName] [nvarchar](200) NULL
GO
IF OBJECT_ID('dbo.FK_AgentTokenUsage_AppUser', 'F') IS NULL
ALTER TABLE [dbo].[AgentTokenUsage] WITH CHECK ADD CONSTRAINT [FK_AgentTokenUsage_AppUser] FOREIGN KEY([UserId])
REFERENCES [dbo].[AppUser] ([UserId])
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AgentTokenUsage_Date_User')
CREATE NONCLUSTERED INDEX [IX_AgentTokenUsage_Date_User] ON [dbo].[AgentTokenUsage] ([UsageDate], [UserId])
GO

-- USD list prices per million tokens, effective from a date (latest EffectiveFrom <= UsageDate wins).
IF OBJECT_ID('dbo.AgentModelPrice', 'U') IS NULL
CREATE TABLE [dbo].[AgentModelPrice](
	[Model] [nvarchar](100) NOT NULL,
	[EffectiveFrom] [date] NOT NULL,
	[InputPerMTok] [decimal](18, 6) NOT NULL,
	[OutputPerMTok] [decimal](18, 6) NOT NULL,
	[CacheWrite5mPerMTok] [decimal](18, 6) NOT NULL,
	[CacheWrite1hPerMTok] [decimal](18, 6) NOT NULL,
	[CacheReadPerMTok] [decimal](18, 6) NOT NULL,
 CONSTRAINT [PK_AgentModelPrice] PRIMARY KEY CLUSTERED
(
	[Model] ASC,
	[EffectiveFrom] ASC
)
) ON [PRIMARY]
GO

-- Seed: platform.claude.com/docs/en/about-claude/pricing (fetched 2026-10-20), standard (global) pricing.
-- Haiku 5.5 uses the <= 100K-token prompt tier; fast mode and US-only inference surcharges are not modelled.
INSERT INTO [dbo].[AgentModelPrice]
	([Model], [EffectiveFrom], [InputPerMTok], [OutputPerMTok], [CacheWrite5mPerMTok], [CacheWrite1hPerMTok], [CacheReadPerMTok])
SELECT v.* FROM (VALUES
	(N'claude-fable-5-1',  '2026-01-01', 10.00, 50.00, 12.50,  20.00, 0.25),
	(N'claude-opus-5-5',   '2026-01-01',  4.00, 20.00,  5.00,   8.00, 0.20),
	(N'claude-sonnet-5-5', '2026-01-01',  2.00, 10.00,  2.50,   4.00, 0.10),
	(N'claude-haiku-5-5',  '2026-01-01',  0.10,  0.50,  0.125,  0.20, 0.01)
) v ([Model], [EffectiveFrom], [InputPerMTok], [OutputPerMTok], [CacheWrite5mPerMTok], [CacheWrite1hPerMTok], [CacheReadPerMTok])
WHERE NOT EXISTS (SELECT 1 FROM [dbo].[AgentModelPrice] p WHERE p.[Model] = v.[Model] AND p.[EffectiveFrom] = v.[EffectiveFrom])
GO
