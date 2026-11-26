import { useRef, useState } from "react";

import { Link, Navigate, useLocation } from "react-router";
import { useAppContent } from "../../useAppContent.jsx";
import { AuthForm, EmailField, PasswordField } from "./AuthForm.jsx";

import { useSession } from "./sessionContext.js";
import { SessionNotice } from "./SessionNotice.jsx";
import messages from "./messages.json";

function retryDelay(value) {
  if (!value) return undefined;
  const seconds = /^\d+$/.test(value)
    ? Number(value)
    : Math.ceil((Date.parse(value) - Date.now()) / 1000);
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined;
}

export function LoginForm({ feedback, fieldErrors, retryAfter, onSubmit }) {
  const { t } = useAppContent();
  const translate = (key) => t(`auth.${key}`, messages[key]);
  const pending = feedback === "loginPending";
  return (
    <AuthForm
      title={translate("loginTitle")}
      description={translate("loginIntro")}
      action={translate(pending ? "loginPending" : "loginAction")}
      onSubmit={onSubmit}
      pending={pending}
      noValidate
      notice={
        feedback && !pending
          ? {
              text: retryAfter
                ? `${translate(feedback)} ${translate("retryAfter").replace("{seconds}", String(retryAfter))}`
                : translate(feedback),
              error: feedback !== "activationSuccess",
            }
          : undefined
      }
    >
      <EmailField
        label={translate("emailLabel")}
        error={fieldErrors?.email && translate(fieldErrors.email)}
      />

      <PasswordField
        label={translate("passwordLabel")}
        name="password"
        showLabel={translate("showPassword")}
        hideLabel={translate("hidePassword")}
        autoComplete="current-password"
        error={fieldErrors?.password && translate(fieldErrors.password)}
      />

      {pending && (
        <span className="sr-only" role="status">
          {translate("loginPending")}
        </span>
      )}
    </AuthForm>
  );
}

export function LoginView() {
  const { state, login } = useSession();
  const { state: navigationState } = useLocation();
  const [feedback, setFeedback] = useState();
  const [fieldErrors, setFieldErrors] = useState();
  const [retryAfter, setRetryAfter] = useState();
  const submitting = useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || state.status !== "unauthenticated") return;

    const email = event.currentTarget.elements.namedItem("email");
    const password = event.currentTarget.elements.namedItem("password");
    if (
      !(email instanceof globalThis.HTMLInputElement) ||
      !(password instanceof globalThis.HTMLInputElement)
    )
      return;

    const input = { email: email.value.trim(), password: password.value };
    const errors = {
      email: !input.email
        ? "emailRequired"
        : email.validity.typeMismatch || input.email.length > 254
          ? "emailInvalid"
          : undefined,
      password: !input.password ? "passwordRequired" : undefined,
    };
    setFieldErrors(errors);
    setRetryAfter(undefined);
    if (errors.email || errors.password) {
      setFeedback(undefined);
      if (errors.email) email.focus();
      else password.focus();
      return;
    }

    submitting.current = true;
    setFeedback("loginPending");
    password.value = "";

    try {
      const result = await login(input);
      if (result.kind === "http") {
        if (result.unauthorized === "invalid_credentials") setFeedback("loginRejected");
        else if (result.unauthorized === "no_session") setFeedback("loginSessionMissing");
        else if (result.status === 429 || result.status === 503) {
          setRetryAfter(retryDelay(result.retryAfter));
          setFeedback(result.status === 429 ? "rateLimited" : "serviceUnavailable");
        } else setFeedback("loginHttpRejected");
      } else if (result.kind === "communication") {
        setFeedback("communicationError");
      } else if (result.kind === "unexpected_response" || result.kind === "aborted") {
        setFeedback("loginUnconfirmed");
      } else {
        setFeedback(undefined);
      }
    } finally {
      submitting.current = false;
    }
  }

  if (state.status === "authenticated") return <Navigate to="/app" replace />;
  if (state.status === "error" || (state.status === "checking" && feedback !== "loginPending")) {
    return <SessionNotice titleKey="loginTitle" />;
  }
  return (
    <LoginForm
      onSubmit={(event) => void submit(event)}
      fieldErrors={fieldErrors}
      retryAfter={retryAfter}
      feedback={
        feedback ?? (navigationState?.accountActivated === true ? "activationSuccess" : undefined)
      }
    />
  );
}

export function ActivationForm({
  feedback,
  onSubmit,
  onRetry,
  retryDisabled,
  submitDisabled,
  passwordPolicy,
}) {
  const { t } = useAppContent();
  const translate = (key) => t(`auth.${key}`, messages[key]);
  const passwordError = feedback === "passwordLimits" || feedback === "passwordPolicyRejected";
  const fieldError = feedback === "passwordMismatch" || passwordError;
  const passwordHint =
    passwordPolicy &&
    translate("passwordRequirements").replace(/\{(minLength|maxLength|maxBytes)\}/g, (_, key) =>
      String(passwordPolicy[key]),
    );

  return (
    <AuthForm
      title={translate("activationTitle")}
      description={translate("activationIntro")}
      action={onSubmit ? translate("activationAction") : undefined}
      onSubmit={onSubmit}
      pending={feedback === "operationPending"}
      submitDisabled={submitDisabled}
      notice={
        feedback
          ? {
              text: translate(fieldError ? "formError" : feedback),
              error: feedback !== "operationPending" && feedback !== "activationChecking",
            }
          : undefined
      }
      ambient
    >
      {feedback === "activationInvalid" && (
        <Link to="/login" className="w-fit font-semibold text-accent">
          {translate("loginAction")}
        </Link>
      )}
      {onRetry && (
        <button
          type="button"
          disabled={retryDisabled}
          onClick={onRetry}
          className="min-h-11 w-fit rounded-lg border border-solid border-control bg-transparent px-4 text-sm font-semibold text-accent disabled:opacity-60"
        >
          {translate("sessionRetry")}
        </button>
      )}
      {onSubmit && (
        <>
          <PasswordField
            label={translate("newPasswordLabel")}
            name="password"
            showLabel={translate("showNewPassword")}
            hideLabel={translate("hideNewPassword")}
            autoComplete="new-password"
            error={passwordError ? translate(feedback) : undefined}
            hint={passwordHint}
          />

          <PasswordField
            label={translate("confirmPasswordLabel")}
            name="confirmation"
            showLabel={translate("showConfirmation")}
            hideLabel={translate("hideConfirmation")}
            autoComplete="new-password"
            error={feedback === "passwordMismatch" ? translate(feedback) : undefined}
          />
        </>
      )}
    </AuthForm>
  );
}
