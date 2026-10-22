-- RowAudit history lookup (GET api/rowaudit?tableName=&pkid=): index for WHERE TableName AND PrimaryKeyValues.
-- Hand-written DDL (not an SSMS export), safe to re-run. The table itself is in admin.sql.
USE [CMS]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Plain (not filtered) index: a filtered index would make every RowAudit INSERT fail on connections
-- with QUOTED_IDENTIFIER OFF (sqlcmd default, legacy tools).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RowAudit_TableName_PrimaryKeyValues' AND object_id = OBJECT_ID('dbo.RowAudit'))
CREATE NONCLUSTERED INDEX [IX_RowAudit_TableName_PrimaryKeyValues]
	ON [dbo].[RowAudit] ([TableName], [PrimaryKeyValues], [DateTime] DESC)
	INCLUDE ([UserName], [ActionType], [ActionDesc])
GO
