import { describe, expect, it } from "vitest";
import { notificationCategory } from "./notification-meta";

describe("notificationCategory", () => {
  it("event reminders are events", () => expect(notificationCategory("event_reminder")).toBe("eventos"));
  it("new jobs are vagas", () => expect(notificationCategory("job_published")).toBe("vagas"));
  it("direct messages are mensagens", () => expect(notificationCategory("direct_message")).toBe("mensagens"));
  it("feed comment is interacoes", () => expect(notificationCategory("feed_comment")).toBe("interacoes"));
  it("unknown is sistema", () => expect(notificationCategory("welcome")).toBe("sistema"));
});
