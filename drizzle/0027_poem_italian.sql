ALTER TABLE `poem_search` ADD `it_title` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `poem_search` ADD `it_theme` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `poem_search` ADD `it_content` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `poems` ADD `it_title` text;
--> statement-breakpoint
ALTER TABLE `poems` ADD `it_theme` text;
--> statement-breakpoint
ALTER TABLE `poems` ADD `it_content` text;
--> statement-breakpoint
ALTER TABLE `poems` ADD `it_provenance` text;
--> statement-breakpoint
DROP TRIGGER poem_search_fts_insert;
--> statement-breakpoint
DROP TRIGGER poem_search_fts_delete;
--> statement-breakpoint
DROP TRIGGER poem_search_fts_update;
--> statement-breakpoint
DROP TABLE poem_search_fts;
--> statement-breakpoint
CREATE VIRTUAL TABLE poem_search_fts USING fts5(title, author, theme, content, translated_title, translated_theme, translated_content, fr_title, fr_theme, fr_content, de_title, de_theme, de_content, es_title, es_theme, es_content, it_title, it_theme, it_content, content='poem_search', content_rowid='rowid', tokenize='trigram case_sensitive 1');
--> statement-breakpoint
CREATE TRIGGER poem_search_fts_insert AFTER INSERT ON poem_search BEGIN
  INSERT INTO poem_search_fts(rowid, title, author, theme, content, translated_title, translated_theme, translated_content, fr_title, fr_theme, fr_content, de_title, de_theme, de_content, es_title, es_theme, es_content, it_title, it_theme, it_content) VALUES (NEW.rowid, NEW.title, NEW.author, NEW.theme, NEW.content, NEW.translated_title, NEW.translated_theme, NEW.translated_content, NEW.fr_title, NEW.fr_theme, NEW.fr_content, NEW.de_title, NEW.de_theme, NEW.de_content, NEW.es_title, NEW.es_theme, NEW.es_content, NEW.it_title, NEW.it_theme, NEW.it_content);
END;
--> statement-breakpoint
CREATE TRIGGER poem_search_fts_delete AFTER DELETE ON poem_search BEGIN
  INSERT INTO poem_search_fts(poem_search_fts, rowid, title, author, theme, content, translated_title, translated_theme, translated_content, fr_title, fr_theme, fr_content, de_title, de_theme, de_content, es_title, es_theme, es_content, it_title, it_theme, it_content) VALUES ('delete', OLD.rowid, OLD.title, OLD.author, OLD.theme, OLD.content, OLD.translated_title, OLD.translated_theme, OLD.translated_content, OLD.fr_title, OLD.fr_theme, OLD.fr_content, OLD.de_title, OLD.de_theme, OLD.de_content, OLD.es_title, OLD.es_theme, OLD.es_content, OLD.it_title, OLD.it_theme, OLD.it_content);
END;
--> statement-breakpoint
CREATE TRIGGER poem_search_fts_update AFTER UPDATE ON poem_search BEGIN
  INSERT INTO poem_search_fts(poem_search_fts, rowid, title, author, theme, content, translated_title, translated_theme, translated_content, fr_title, fr_theme, fr_content, de_title, de_theme, de_content, es_title, es_theme, es_content, it_title, it_theme, it_content) VALUES ('delete', OLD.rowid, OLD.title, OLD.author, OLD.theme, OLD.content, OLD.translated_title, OLD.translated_theme, OLD.translated_content, OLD.fr_title, OLD.fr_theme, OLD.fr_content, OLD.de_title, OLD.de_theme, OLD.de_content, OLD.es_title, OLD.es_theme, OLD.es_content, OLD.it_title, OLD.it_theme, OLD.it_content);
  INSERT INTO poem_search_fts(rowid, title, author, theme, content, translated_title, translated_theme, translated_content, fr_title, fr_theme, fr_content, de_title, de_theme, de_content, es_title, es_theme, es_content, it_title, it_theme, it_content) VALUES (NEW.rowid, NEW.title, NEW.author, NEW.theme, NEW.content, NEW.translated_title, NEW.translated_theme, NEW.translated_content, NEW.fr_title, NEW.fr_theme, NEW.fr_content, NEW.de_title, NEW.de_theme, NEW.de_content, NEW.es_title, NEW.es_theme, NEW.es_content, NEW.it_title, NEW.it_theme, NEW.it_content);
END;
--> statement-breakpoint
INSERT INTO poem_search_fts(poem_search_fts) VALUES ('rebuild');
--> statement-breakpoint
DROP TRIGGER poem_search_insert;
--> statement-breakpoint
CREATE TRIGGER poem_search_insert AFTER INSERT ON poems BEGIN
    INSERT INTO poem_search (poem_id, title, author, theme, content, translated_title, translated_theme, translated_content, fr_title, fr_theme, fr_content, de_title, de_theme, de_content, es_title, es_theme, es_content, it_title, it_theme, it_content) VALUES (NEW.id, (CASE WHEN length(CAST(coalesce(NEW.title, '') AS BLOB)) = length(coalesce(NEW.title, '')) THEN lower(coalesce(NEW.title, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.title, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.title, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.author, '') AS BLOB)) = length(coalesce(NEW.author, '')) THEN lower(coalesce(NEW.author, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.author, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.author, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.theme, '') AS BLOB)) = length(coalesce(NEW.theme, '')) THEN lower(coalesce(NEW.theme, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.theme, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.theme, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.content, '') AS BLOB)) = length(coalesce(NEW.content, '')) THEN lower(coalesce(NEW.content, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.content, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.content, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.translated_title, '') AS BLOB)) = length(coalesce(NEW.translated_title, '')) THEN lower(coalesce(NEW.translated_title, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.translated_title, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.translated_title, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.translated_theme, '') AS BLOB)) = length(coalesce(NEW.translated_theme, '')) THEN lower(coalesce(NEW.translated_theme, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.translated_theme, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.translated_theme, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.translated_content, '') AS BLOB)) = length(coalesce(NEW.translated_content, '')) THEN lower(coalesce(NEW.translated_content, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.translated_content, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.translated_content, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.fr_title, '') AS BLOB)) = length(coalesce(NEW.fr_title, '')) THEN lower(coalesce(NEW.fr_title, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.fr_title, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.fr_title, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.fr_theme, '') AS BLOB)) = length(coalesce(NEW.fr_theme, '')) THEN lower(coalesce(NEW.fr_theme, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.fr_theme, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.fr_theme, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.fr_content, '') AS BLOB)) = length(coalesce(NEW.fr_content, '')) THEN lower(coalesce(NEW.fr_content, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.fr_content, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.fr_content, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.de_title, '') AS BLOB)) = length(coalesce(NEW.de_title, '')) THEN lower(coalesce(NEW.de_title, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.de_title, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.de_title, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.de_theme, '') AS BLOB)) = length(coalesce(NEW.de_theme, '')) THEN lower(coalesce(NEW.de_theme, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.de_theme, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.de_theme, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.de_content, '') AS BLOB)) = length(coalesce(NEW.de_content, '')) THEN lower(coalesce(NEW.de_content, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.de_content, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.de_content, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.es_title, '') AS BLOB)) = length(coalesce(NEW.es_title, '')) THEN lower(coalesce(NEW.es_title, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.es_title, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.es_title, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.es_theme, '') AS BLOB)) = length(coalesce(NEW.es_theme, '')) THEN lower(coalesce(NEW.es_theme, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.es_theme, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.es_theme, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.es_content, '') AS BLOB)) = length(coalesce(NEW.es_content, '')) THEN lower(coalesce(NEW.es_content, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.es_content, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.es_content, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.it_title, '') AS BLOB)) = length(coalesce(NEW.it_title, '')) THEN lower(coalesce(NEW.it_title, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.it_title, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.it_title, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.it_theme, '') AS BLOB)) = length(coalesce(NEW.it_theme, '')) THEN lower(coalesce(NEW.it_theme, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.it_theme, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.it_theme, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.it_content, '') AS BLOB)) = length(coalesce(NEW.it_content, '')) THEN lower(coalesce(NEW.it_content, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.it_content, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.it_content, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END))
    ON CONFLICT(poem_id) DO UPDATE SET title=excluded.title, author=excluded.author, theme=excluded.theme, content=excluded.content, translated_title=excluded.translated_title, translated_theme=excluded.translated_theme, translated_content=excluded.translated_content, fr_title=excluded.fr_title, fr_theme=excluded.fr_theme, fr_content=excluded.fr_content, de_title=excluded.de_title, de_theme=excluded.de_theme, de_content=excluded.de_content, es_title=excluded.es_title, es_theme=excluded.es_theme, es_content=excluded.es_content, it_title=excluded.it_title, it_theme=excluded.it_theme, it_content=excluded.it_content;
  END;
--> statement-breakpoint
DROP TRIGGER poem_search_update;
--> statement-breakpoint
CREATE TRIGGER poem_search_update AFTER UPDATE OF title, author, theme, content, translated_title, translated_theme, translated_content, fr_title, fr_theme, fr_content, de_title, de_theme, de_content, es_title, es_theme, es_content, it_title, it_theme, it_content ON poems BEGIN
    INSERT INTO poem_search (poem_id, title, author, theme, content, translated_title, translated_theme, translated_content, fr_title, fr_theme, fr_content, de_title, de_theme, de_content, es_title, es_theme, es_content, it_title, it_theme, it_content) VALUES (NEW.id, (CASE WHEN length(CAST(coalesce(NEW.title, '') AS BLOB)) = length(coalesce(NEW.title, '')) THEN lower(coalesce(NEW.title, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.title, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.title, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.author, '') AS BLOB)) = length(coalesce(NEW.author, '')) THEN lower(coalesce(NEW.author, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.author, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.author, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.theme, '') AS BLOB)) = length(coalesce(NEW.theme, '')) THEN lower(coalesce(NEW.theme, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.theme, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.theme, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.content, '') AS BLOB)) = length(coalesce(NEW.content, '')) THEN lower(coalesce(NEW.content, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.content, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.content, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.translated_title, '') AS BLOB)) = length(coalesce(NEW.translated_title, '')) THEN lower(coalesce(NEW.translated_title, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.translated_title, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.translated_title, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.translated_theme, '') AS BLOB)) = length(coalesce(NEW.translated_theme, '')) THEN lower(coalesce(NEW.translated_theme, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.translated_theme, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.translated_theme, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.translated_content, '') AS BLOB)) = length(coalesce(NEW.translated_content, '')) THEN lower(coalesce(NEW.translated_content, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.translated_content, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.translated_content, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.fr_title, '') AS BLOB)) = length(coalesce(NEW.fr_title, '')) THEN lower(coalesce(NEW.fr_title, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.fr_title, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.fr_title, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.fr_theme, '') AS BLOB)) = length(coalesce(NEW.fr_theme, '')) THEN lower(coalesce(NEW.fr_theme, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.fr_theme, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.fr_theme, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.fr_content, '') AS BLOB)) = length(coalesce(NEW.fr_content, '')) THEN lower(coalesce(NEW.fr_content, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.fr_content, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.fr_content, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.de_title, '') AS BLOB)) = length(coalesce(NEW.de_title, '')) THEN lower(coalesce(NEW.de_title, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.de_title, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.de_title, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.de_theme, '') AS BLOB)) = length(coalesce(NEW.de_theme, '')) THEN lower(coalesce(NEW.de_theme, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.de_theme, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.de_theme, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.de_content, '') AS BLOB)) = length(coalesce(NEW.de_content, '')) THEN lower(coalesce(NEW.de_content, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.de_content, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.de_content, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.es_title, '') AS BLOB)) = length(coalesce(NEW.es_title, '')) THEN lower(coalesce(NEW.es_title, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.es_title, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.es_title, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.es_theme, '') AS BLOB)) = length(coalesce(NEW.es_theme, '')) THEN lower(coalesce(NEW.es_theme, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.es_theme, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.es_theme, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.es_content, '') AS BLOB)) = length(coalesce(NEW.es_content, '')) THEN lower(coalesce(NEW.es_content, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.es_content, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.es_content, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.it_title, '') AS BLOB)) = length(coalesce(NEW.it_title, '')) THEN lower(coalesce(NEW.it_title, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.it_title, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.it_title, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.it_theme, '') AS BLOB)) = length(coalesce(NEW.it_theme, '')) THEN lower(coalesce(NEW.it_theme, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.it_theme, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.it_theme, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END), (CASE WHEN length(CAST(coalesce(NEW.it_content, '') AS BLOB)) = length(coalesce(NEW.it_content, '')) THEN lower(coalesce(NEW.it_content, '')) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(coalesce(NEW.it_content, ''), letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(coalesce(NEW.it_content, ''))
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END))
    ON CONFLICT(poem_id) DO UPDATE SET title=excluded.title, author=excluded.author, theme=excluded.theme, content=excluded.content, translated_title=excluded.translated_title, translated_theme=excluded.translated_theme, translated_content=excluded.translated_content, fr_title=excluded.fr_title, fr_theme=excluded.fr_theme, fr_content=excluded.fr_content, de_title=excluded.de_title, de_theme=excluded.de_theme, de_content=excluded.de_content, es_title=excluded.es_title, es_theme=excluded.es_theme, es_content=excluded.es_content, it_title=excluded.it_title, it_theme=excluded.it_theme, it_content=excluded.it_content;
  END;
--> statement-breakpoint
DROP TRIGGER poem_search_pending_update;
--> statement-breakpoint
CREATE TRIGGER poem_search_pending_update AFTER UPDATE OF title, author, theme, content, translated_title, translated_theme, translated_content, fr_title, fr_theme, fr_content, de_title, de_theme, de_content, es_title, es_theme, es_content, it_title, it_theme, it_content ON poems BEGIN
  INSERT INTO poem_search_pending(poem_id, token) VALUES (NEW.id, hex(randomblob(16)))
  ON CONFLICT(poem_id) DO UPDATE SET token=excluded.token;
END;
--> statement-breakpoint
DROP TRIGGER history_poem_insert;
--> statement-breakpoint
CREATE TRIGGER history_poem_insert AFTER INSERT ON poems BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('poem', NEW.id, NEW.revision, 'saved', NEW.title, json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'theme', NEW.theme, 'content', NEW.content, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at, 'image_id', NEW.image_id, 'source_language', NEW.source_language, 'translated_title', NEW.translated_title, 'translated_theme', NEW.translated_theme, 'translated_content', NEW.translated_content, 'audio_ro_id', NEW.audio_ro_id, 'audio_en_id', NEW.audio_en_id, 'translation_provenance', json(NEW.translation_provenance), 'fr_title', NEW.fr_title, 'fr_theme', NEW.fr_theme, 'fr_content', NEW.fr_content, 'fr_provenance', json(NEW.fr_provenance), 'de_title', NEW.de_title, 'de_theme', NEW.de_theme, 'de_content', NEW.de_content, 'de_provenance', json(NEW.de_provenance), 'es_title', NEW.es_title, 'es_theme', NEW.es_theme, 'es_content', NEW.es_content, 'es_provenance', json(NEW.es_provenance), 'it_title', NEW.it_title, 'it_theme', NEW.it_theme, 'it_content', NEW.it_content, 'it_provenance', json(NEW.it_provenance)), CAST(strftime('%s','now') AS INTEGER)*1000);
END;
--> statement-breakpoint
DROP TRIGGER history_poem_update;
--> statement-breakpoint
CREATE TRIGGER history_poem_update AFTER UPDATE ON poems BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('poem', NEW.id, NEW.revision, 'saved', NEW.title, json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'theme', NEW.theme, 'content', NEW.content, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at, 'image_id', NEW.image_id, 'source_language', NEW.source_language, 'translated_title', NEW.translated_title, 'translated_theme', NEW.translated_theme, 'translated_content', NEW.translated_content, 'audio_ro_id', NEW.audio_ro_id, 'audio_en_id', NEW.audio_en_id, 'translation_provenance', json(NEW.translation_provenance), 'fr_title', NEW.fr_title, 'fr_theme', NEW.fr_theme, 'fr_content', NEW.fr_content, 'fr_provenance', json(NEW.fr_provenance), 'de_title', NEW.de_title, 'de_theme', NEW.de_theme, 'de_content', NEW.de_content, 'de_provenance', json(NEW.de_provenance), 'es_title', NEW.es_title, 'es_theme', NEW.es_theme, 'es_content', NEW.es_content, 'es_provenance', json(NEW.es_provenance), 'it_title', NEW.it_title, 'it_theme', NEW.it_theme, 'it_content', NEW.it_content, 'it_provenance', json(NEW.it_provenance)), CAST(strftime('%s','now') AS INTEGER)*1000);
END;
--> statement-breakpoint
DROP TRIGGER history_poem_delete;
--> statement-breakpoint
CREATE TRIGGER history_poem_delete AFTER DELETE ON poems BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('poem', OLD.id, OLD.revision, 'deleted', OLD.title, json_object('id', OLD.id, 'title', OLD.title, 'author', OLD.author, 'theme', OLD.theme, 'content', OLD.content, 'revision', OLD.revision, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at, 'image_id', OLD.image_id, 'source_language', OLD.source_language, 'translated_title', OLD.translated_title, 'translated_theme', OLD.translated_theme, 'translated_content', OLD.translated_content, 'audio_ro_id', OLD.audio_ro_id, 'audio_en_id', OLD.audio_en_id, 'translation_provenance', json(OLD.translation_provenance), 'fr_title', OLD.fr_title, 'fr_theme', OLD.fr_theme, 'fr_content', OLD.fr_content, 'fr_provenance', json(OLD.fr_provenance), 'de_title', OLD.de_title, 'de_theme', OLD.de_theme, 'de_content', OLD.de_content, 'de_provenance', json(OLD.de_provenance), 'es_title', OLD.es_title, 'es_theme', OLD.es_theme, 'es_content', OLD.es_content, 'es_provenance', json(OLD.es_provenance), 'it_title', OLD.it_title, 'it_theme', OLD.it_theme, 'it_content', OLD.it_content, 'it_provenance', json(OLD.it_provenance)), CAST(strftime('%s','now') AS INTEGER)*1000);
END;
