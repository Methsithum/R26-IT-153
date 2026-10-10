// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import api from "../apiClient";
import { loginUser, readStoredUser, refreshStoredUser, storeUser } from "../userApi";

function reply(data) {
  api.defaults.adapter = async (config) => ({ data, status: 200, statusText: "OK", headers: {}, config });
}

beforeEach(() => localStorage.clear());

describe("authenticated Journal requests", () => {
  it("saves the session token returned by password login", async () => {
    reply({ id: "student-a", access_token: "session-token" });
    await loginUser("student@example.com", "password");
    expect(readStoredUser().access_token).toBe("session-token");
  });

  it("sends a bearer token on private API requests", async () => {
    storeUser({ id: "student-a", access_token: "session-token" });
    reply({});
    const result = await api.get("/analytics/learning-patterns/student-a");
    expect(result.config.headers.Authorization).toBe("Bearer session-token");
  });

  it("preserves credentials when refreshing the profile", async () => {
    storeUser({ id: "student-a", access_token: "session-token" });
    reply({ id: "student-a", name: "Updated", access_token: null });
    await refreshStoredUser();
    expect(readStoredUser()).toMatchObject({ name: "Updated", access_token: "session-token" });
  });

  it("preserves credentials when campus progress is saved", () => {
    storeUser({ id: "student-a", access_token: "session-token" });
    storeUser({ id: "student-a", total_xp: 500 });
    expect(readStoredUser().access_token).toBe("session-token");
  });

  it("does not carry a token into another account", () => {
    storeUser({ id: "student-a", access_token: "session-token" });
    storeUser({ id: "student-b" });
    expect(readStoredUser().access_token).toBeUndefined();
  });

  it("clears expired login state on HTTP 401", async () => {
    storeUser({ id: "student-a", access_token: "expired" });
    api.defaults.adapter = async () => { throw { response: { status: 401 } }; };
    expect(await refreshStoredUser()).toBeNull();
    expect(readStoredUser()).toBeNull();
  });

  it("handles invalid local storage without supplying credentials", async () => {
    localStorage.setItem("smart-uni-guide-user", "invalid-json");
    reply({});
    const result = await api.get("/analytics/behavior-latest/student-a");
    expect(result.config.headers.Authorization).toBeUndefined();
  });
});
