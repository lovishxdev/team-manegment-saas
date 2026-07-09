-- Private @euclis user messages (visible only to author, like agent replies)

ALTER TABLE "PostMessage" ADD COLUMN "isAgentPrivate" BOOLEAN NOT NULL DEFAULT false;
