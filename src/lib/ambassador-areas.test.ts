import { describe, expect, it } from "vitest";
import { hasActionAccess, hasAreaAccess } from "./ambassador-areas";
describe("individual ambassador actions", () => {
  it("viewing jobs does not allow publishing", () => expect(hasActionAccess(["vagas"], "vagas", "publicar")).toBe(false));
  it("approval does not allow removal", () => expect(hasActionAccess(["eventos:aprovar"], "eventos", "remover")).toBe(false));
  it("scanner access allows event area but not approving registrations", () => {
    expect(hasAreaAccess(["eventos:checkin"], "eventos")).toBe(true);
    expect(hasActionAccess(["eventos:checkin"], "eventos", "inscricoes")).toBe(false);
  });
});