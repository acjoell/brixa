import { ThemeSelector } from "./ThemeSelector.jsx";
import { useAppContent } from "./useAppContent.jsx";

const brandPath = `${import.meta.env.BASE_URL}brand/`;
const repository = "https://github.com/acjoell/brixa";

function App({ projectName = "", initialThemePreference }) {
  const { LanguageSelector, t, EditInstruction } = useAppContent();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-4 px-5 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={`${brandPath}logo.png`}
              width="848"
              height="939"
              alt=""
              className="h-auto w-8 shrink-0 rounded-md"
            />

            <div className="min-w-0">
              <p className="m-0 text-sm font-semibold text-heading">Brixa</p>
              <p className="m-0 text-xs text-muted [overflow-wrap:anywhere]">{projectName}</p>
            </div>
          </div>
          <nav
            aria-label={t("nav.label")}
            className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-muted"
          >
            <a className="hover:text-heading" href={`${repository}#readme`}>
              {t("nav.docs")}
            </a>
            <a className="hover:text-heading" href={repository}>
              GitHub
            </a>
            <LanguageSelector />
            <ThemeSelector t={t} initialPreference={initialThemePreference} />
          </nav>
        </div>
      </header>

      <main className="mx-auto box-border w-full max-w-6xl flex-1 px-5 pb-12 pt-8 sm:px-8 sm:pb-16 sm:pt-12">
        <section
          aria-labelledby="welcome-title"
          className="grid items-center gap-8 rounded-3xl border border-line bg-linear-to-br from-panel to-hero px-6 py-10 sm:p-12 md:grid-cols-[minmax(0,1fr)_minmax(0,0.45fr)] lg:gap-12 lg:p-16"
        >
          <div>
            <h1
              id="welcome-title"
              className="m-0 max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight text-heading sm:text-6xl"
            >
              {t("home.title")}
            </h1>
            <p className="mb-0 mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              {t("home.subtitle")}
            </p>
            <a
              href="#start"
              className="mt-7 inline-flex min-h-11 items-center rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"
            >
              {t("home.start")}
            </a>
          </div>
          <img
            src={`${brandPath}logo-transparent.png`}
            width="648"
            height="739"
            alt=""
            className="theme-mark-dark mx-auto h-auto w-24 sm:w-32 md:w-full md:max-w-47"
          />

          <img
            src={`${brandPath}logo.png`}
            width="848"
            height="939"
            alt=""
            className="theme-mark-light mx-auto h-auto w-24 rounded-2xl sm:w-32 md:w-full md:max-w-47"
          />
        </section>

        <section
          id="start"
          tabIndex={-1}
          aria-labelledby="start-title"
          className="mt-12 rounded-lg"
        >
          <h2 id="start-title" className="m-0 text-2xl font-semibold tracking-tight text-heading">
            {t("launchpad.title")}
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
              <h3 className="m-0 font-semibold text-heading">{t("launchpad.stack")}</h3>
              <p className="mb-0 mt-3 text-sm leading-relaxed text-muted">
                React · Vite · Tailwind CSS
              </p>
            </article>
            <article className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
              <h3 className="m-0 font-semibold text-heading">{t("launchpad.entry")}</h3>
              <p className="mb-0 mt-3 text-sm leading-relaxed text-muted">
                <EditInstruction />
              </p>
            </article>
            <article className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
              <h3 className="m-0 font-semibold text-heading">{t("launchpad.next")}</h3>
              <p className="mb-0 mt-3 text-sm leading-relaxed text-muted">{t("launchpad.build")}</p>
              <code className="mt-3 inline-block rounded-md bg-canvas px-2.5 py-1 text-sm text-accent">
                npm run build
              </code>
            </article>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <p className="m-0 mx-auto max-w-6xl px-5 py-5 text-sm text-muted sm:px-8">
          {t("footer.tagline")}
        </p>
      </footer>
    </div>
  );
}

export default App;
