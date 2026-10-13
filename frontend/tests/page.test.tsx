// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "../src/app/page";
import { optimalResult } from "./fixtures";

const previousLocks = Object.getOwnPropertyDescriptor(navigator, "locks");

afterEach(() => {
  cleanup();
  if (previousLocks) Object.defineProperty(navigator, "locks", previousLocks);
  else Reflect.deleteProperty(navigator, "locks");
  window.localStorage.clear();
});

function installLocks() {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (_name: string, _options: unknown, callback: (lock: unknown) => Promise<unknown>) => callback({}),
    },
  });
}

function successResponse() {
  return new Response(JSON.stringify(optimalResult()), { status: 200, headers: { "content-type": "application/json" } });
}

describe("planner page calculation workflow", () => {
  it("renders sample results from the API without modifying user inputs", async () => {
    installLocks();
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successResponse()));
    render(<Home />);

    await user.click(await screen.findByRole("button", { name: /Calculate production plan/ }));
    expect(await screen.findByRole("heading", { name: "Recommended production" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /Recommended production and demand-limit status/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Production by blend/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Orange juice/)).toHaveValue("40");
  });

  it("preserves edits after a service failure and succeeds after manual retry", async () => {
    installLocks();
    const user = userEvent.setup();
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        request_id: "6d8b4960-9d6a-4e4d-94d8-69dc01f0fb8e",
        error: { code: "CALCULATION_TIMEOUT", message: "Calculation timed out. Please retry." },
      }), { status: 503, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(successResponse());
    vi.stubGlobal("fetch", fetch);
    render(<Home />);

    const orange = await screen.findByLabelText(/Orange juice/);
    await user.clear(orange);
    await user.type(orange, "33");
    await user.click(screen.getByRole("button", { name: /Calculate production plan/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Calculation timed out");
    expect(orange).toHaveValue("33");
    expect(screen.queryByRole("heading", { name: "Recommended production" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Recommended production" })).toBeInTheDocument());
    expect(screen.getByLabelText(/Orange juice/)).toHaveValue("33");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("ignores a late response after the user edits inputs during a calculation", async () => {
    installLocks();
    const user = userEvent.setup();
    let resolveOldRequest!: (response: Response) => void;
    const delayedResponse = new Promise<Response>((resolve) => { resolveOldRequest = resolve; });
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(delayedResponse).mockResolvedValueOnce(successResponse()));
    render(<Home />);

    await user.click(await screen.findByRole("button", { name: /Calculate production plan/ }));
    expect(await screen.findByText(/Checking the scenario against available resources/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Orange juice/));
    await user.type(screen.getByLabelText(/Orange juice/), "35");
    resolveOldRequest(successResponse());

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Recommended production" })).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Calculate production plan/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Recommended production" })).toBeInTheDocument());
    expect(screen.getByLabelText(/Orange juice/)).toHaveValue("35");
  });
});
