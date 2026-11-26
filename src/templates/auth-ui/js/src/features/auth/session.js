import { getSession, login, logout } from "./authClient.js";

function rejectedBeforeSessionChange(result) {
  return result.kind === "http" && [400, 401, 403, 429, 503].includes(result.status);
}

export function createSessionActions(onState) {
  let state = { status: "checking" };
  let active;
  let started = false;
  let required = false;

  function publish(next) {
    state = next;
    if (started) onState(next, required);
  }

  function begin(mutation) {
    if (!started) return { kind: "aborted" };
    // A cancelled POST may already have reached the server. Do not overlap cookie mutations.
    if (
      active?.mutation ||
      (mutation && (state.status === "checking" || state.status === "error"))
    ) {
      return { kind: "busy" };
    }

    const superseded = active;
    const request = {
      controller: new globalThis.AbortController(),
      mutation,
      previous: superseded?.previous ?? state,
    };
    active = request;
    superseded?.controller.abort();
    publish({ status: "checking" });
    return { kind: "started", request };
  }

  function finish(next) {
    active = undefined;
    publish(next);
  }

  async function verify(request, logoutFailure) {
    const result = await getSession(request.controller.signal);
    if (request !== active) return { kind: "aborted" };

    if (result.kind === "ok") {
      finish(
        logoutFailure
          ? { status: "error", failure: logoutFailure }
          : { status: "authenticated", identity: result.data },
      );
    } else if (result.kind === "http" && result.unauthorized === "no_session") {
      finish({ status: "unauthenticated" });
    } else if (result.kind === "aborted") {
      finish(request.previous);
    } else {
      finish({ status: "error", failure: result });
    }
    return result;
  }

  async function retry() {
    const operation = begin(false);
    return operation.kind === "started" ? verify(operation.request) : operation;
  }

  async function signIn(input) {
    const operation = begin(true);
    if (operation.kind !== "started") return operation;

    const { request } = operation;
    const result = await login(input, request.controller.signal);
    if (request !== active) return { kind: "aborted" };
    if (result.kind === "ok") return verify(request);

    if (rejectedBeforeSessionChange(result)) {
      finish(request.previous);
    } else {
      // A lost or unexpected response cannot tell us whether the cookie changed.
      await verify(request);
    }
    return result;
  }

  async function signOut() {
    const operation = begin(true);
    if (operation.kind !== "started") return operation;

    const { request } = operation;
    const result = await logout(request.controller.signal);
    if (request !== active) return { kind: "aborted" };
    if (result.kind === "ok" || (result.kind === "http" && result.unauthorized === "no_session")) {
      finish({ status: "unauthenticated" });
      return { kind: "ok", data: undefined };
    }
    if (rejectedBeforeSessionChange(result)) {
      finish({ status: "error", failure: result });
    } else {
      await verify(request, result.kind === "aborted" ? { kind: "communication" } : result);
    }
    return result;
  }

  function suspend() {
    const pending = active;
    if (!pending || pending.mutation) return;
    active = undefined;
    pending.controller.abort();
    state = pending.previous;
  }

  return {
    start() {
      started = true;
    },
    stop() {
      started = false;
      suspend();
    },
    setRequired(next) {
      required = next;
      if (next && !active?.mutation) return retry();
      if (!next) suspend();
      publish(state);
    },
    retry,
    login: signIn,
    logout: signOut,
  };
}
