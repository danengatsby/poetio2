ALTER TABLE `orders` ADD `attempt_key` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `request_hash` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `language` text DEFAULT 'ro' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_min_days` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_max_days` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_attempt_key_unique` ON `orders` (`attempt_key`);--> statement-breakpoint
ALTER TABLE `videos` ADD `subtitle_text` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `videos` ADD `subtitle_language` text DEFAULT 'ro' NOT NULL;
DROP TRIGGER history_video_insert;
DROP TRIGGER history_video_update;
DROP TRIGGER history_video_delete;
UPDATE videos SET subtitle_text='WEBVTT

00:00:00.000 --> 00:00:01.750 line:10%
O zi încărcată de mister.

00:00:01.940 --> 00:00:05.000 line:10%
Amprentele păsărilor
rămân înrămate în ceață.

00:00:05.420 --> 00:00:08.650 line:10%
Ecoul unui pian se stinge
în penumbra dimineții.

00:00:09.040 --> 00:00:10.420 line:10%
Amintirile copilăriei

00:00:10.420 --> 00:00:13.350 line:10%
se ascund în dulceața
unei bomboane uitată.

00:00:14.400 --> 00:00:16.960 line:10%
Mireasma casei vechi de lângă râu

00:00:16.960 --> 00:00:19.180 line:10%
mă întristează cu fiecare suflare.

00:00:19.860 --> 00:00:23.000 line:10%
Bucuria omului de zăpadă
se topește în lacrimi reci.

00:00:23.300 --> 00:00:24.740 line:10%
Vântul aspru aduce cu el

00:00:24.740 --> 00:00:26.900 line:10%
amintiri ale nopților nesfârșite.

00:00:27.700 --> 00:00:29.580 line:10%
Tristețea unui trandafir uscat

00:00:29.580 --> 00:00:31.650 line:10%
mă înfășoară în melancolie.

00:00:32.020 --> 00:00:35.750 line:10%
Pasiunea unui sărut pierdut
mă învăluie în amărăciune.

00:00:36.420 --> 00:00:38.320 line:10%
Efervescența unui lichid roziu

00:00:38.320 --> 00:00:40.200 line:10%
se transformă într-o lacrimă de vin.

00:00:41.320 --> 00:00:44.350 line:10%
Delicatețea unui fular de mătase
se desprinde,

00:00:44.680 --> 00:00:45.820 line:10%
purtată de vânt.

00:00:46.520 --> 00:00:47.560 line:10%
Grația unei frunze

00:00:47.560 --> 00:00:50.100 line:10%
se scufundă în adâncurile
timpului uitat.

00:00:50.900 --> 00:00:54.650 line:10%
Textura celui mai frumos dar
al lui Dumnezeu mă învăluie.

00:00:54.960 --> 00:00:56.340 line:10%
Ești tu, dragă suflete,

00:00:56.340 --> 00:00:58.450 line:10%
visul meu pierdut în negura nopții.
' WHERE file_id='0c08a990-fc6c-473a-a127-f553d2e06906';
CREATE TRIGGER history_video_insert AFTER INSERT ON videos BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('video', NEW.id, NEW.revision, 'saved', NEW.title, json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'description', NEW.description, 'file_id', NEW.file_id, 'subtitle_text', NEW.subtitle_text, 'subtitle_language', NEW.subtitle_language, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at), CAST(strftime('%s','now') AS INTEGER)*1000);
END;

--> statement-breakpoint
CREATE TRIGGER history_video_update AFTER UPDATE ON videos BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('video', NEW.id, NEW.revision, 'saved', NEW.title, json_object('id', NEW.id, 'title', NEW.title, 'author', NEW.author, 'description', NEW.description, 'file_id', NEW.file_id, 'subtitle_text', NEW.subtitle_text, 'subtitle_language', NEW.subtitle_language, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at), CAST(strftime('%s','now') AS INTEGER)*1000);
END;

--> statement-breakpoint
CREATE TRIGGER history_video_delete AFTER DELETE ON videos BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('video', OLD.id, OLD.revision, 'deleted', OLD.title, json_object('id', OLD.id, 'title', OLD.title, 'author', OLD.author, 'description', OLD.description, 'file_id', OLD.file_id, 'subtitle_text', OLD.subtitle_text, 'subtitle_language', OLD.subtitle_language, 'revision', OLD.revision, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at), CAST(strftime('%s','now') AS INTEGER)*1000);
END;
