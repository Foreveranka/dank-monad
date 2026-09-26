CREATE TABLE "applications" (
	"wallet" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"profile" text NOT NULL,
	"note" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"message" text NOT NULL,
	"expires" bigint NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"project_id" text NOT NULL,
	"event_slug" text NOT NULL,
	"title" text NOT NULL,
	"proof" text NOT NULL,
	"note" text NOT NULL,
	"winner" integer NOT NULL,
	"placement" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"created" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "challenge_wallet" ON "challenges" USING btree ("wallet");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_member_event" ON "evidence" USING btree ("wallet","event_slug");--> statement-breakpoint
CREATE INDEX "evidence_wallet" ON "evidence" USING btree ("wallet");