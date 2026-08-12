CREATE TABLE "tessera_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"tessera_id" text NOT NULL,
	"order_id" text,
	"buyer_email" text,
	"buyer_name" text,
	"category" text,
	"status" text,
	"promo_code" text,
	"currency" text,
	"purchased_at" timestamp with time zone,
	"ticket_price" numeric(14, 2),
	"gross_sales" numeric(14, 2),
	"total_fees" numeric(14, 2),
	"net_sales" numeric(14, 2),
	"discount_amount" numeric(14, 2),
	"refunded_amount" numeric(14, 2),
	"vat" numeric(14, 2),
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tessera_transactions" ADD CONSTRAINT "tessera_transactions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tessera_tx_event_tessera_idx" ON "tessera_transactions" USING btree ("event_id","tessera_id");--> statement-breakpoint
CREATE INDEX "tessera_tx_event_idx" ON "tessera_transactions" USING btree ("event_id");