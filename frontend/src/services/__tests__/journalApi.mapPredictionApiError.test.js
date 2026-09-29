import { describe, it, expect } from "vitest";
import { mapPredictionApiError } from "../journalApi";

describe("mapPredictionApiError: readable messages for the Score Forecast API calls", () => {
  it("maps a 503 to the model-unavailable message", () => {
    const err = { response: { status: 503, data: { detail: "some internal detail" } } };
    expect(mapPredictionApiError(err).message).toBe("The prediction model is currently unavailable");
  });

  it("maps a 404 to the backend's own detail message", () => {
    const err = { response: { status: 404, data: { detail: "No user found for user_id='abc'" } } };
    expect(mapPredictionApiError(err).message).toBe("No user found for user_id='abc'");
  });

  it("maps a 422 to the backend's own detail message", () => {
    const err = { response: { status: 422, data: { detail: "'user_id' is not a valid id: 'x'" } } };
    expect(mapPredictionApiError(err).message).toBe("'user_id' is not a valid id: 'x'");
  });

  it("maps a network error (no response at all) to a generic retry message", () => {
    const err = { message: "Network Error" };
    expect(mapPredictionApiError(err).message).toBe("Network error — please try again.");
  });

  it("falls back to a generic message when the response has no usable detail", () => {
    const err = { response: { status: 500, data: {} } };
    expect(mapPredictionApiError(err).message).toBe("Something went wrong.");
  });
});
