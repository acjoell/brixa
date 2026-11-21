"""Run against a generated Auth backend with its dependencies installed.

Usage: python3 scripts/test-bootstrap-tty.py BACKEND sqlite|postgres
Requires a POSIX pseudo-terminal. With no fixture URL, PostgreSQL mode only
exercises rejected configuration. Use the bootstrap-tty mode of
test-postgres-audit-privileges.sh for successful PostgreSQL bootstrap.
"""
import os
import pty
import select
import subprocess
import sys
import tempfile
import termios
import time
from pathlib import Path
from urllib.parse import urlsplit

COMMAND = ("npm", "run", "auth:bootstrap")
SECRET = b" test-only-PHRASE-94! "
OTHER = b"test-only-PHRASE-94!"
URL_SECRET = "test-only-connection-secret"
EMAIL = b"initial@example.test\r"


def interactive(backend, env, steps, expected, code, command=COMMAND):
    master, slave = pty.openpty()
    original = termios.tcgetattr(slave)
    child = None
    output = bytearray()

    def read_until(condition):
        deadline = time.monotonic() + 12
        while not condition():
            remaining = max(0, deadline - time.monotonic())
            if not select.select([master], [], [], remaining)[0]:
                raise AssertionError("La sesión PTY no alcanzó el estado esperado")
            output.extend(os.read(master, 8192))

    try:
        child = subprocess.Popen(
            command, cwd=backend, env=env, stdin=slave, stdout=slave, stderr=slave,
        )
        for prompt, answer in steps:
            read_until(lambda: prompt in output)
            assert not termios.tcgetattr(slave)[3] & termios.ECHO
            os.write(master, answer)
        read_until(lambda: expected in output)
        assert child.wait(timeout=12) == code
        while select.select([master], [], [], 0)[0]:
            output.extend(os.read(master, 8192))
        sensitive = [SECRET, OTHER, URL_SECRET.encode(), b"$argon2"]
        for key in ("DATABASE_URL", "MIGRATION_DATABASE_URL"):
            value = env.get(key, "")
            if value.startswith(("postgres:", "postgresql:")):
                sensitive.append(value.encode())
                password = urlsplit(value).password
                if password:
                    sensitive.append(password.encode())
        assert not any(value in output for value in sensitive)
        assert termios.tcgetattr(slave) == original
    finally:
        if child is not None and child.poll() is None:
            child.kill()
            child.wait(timeout=12)
        termios.tcsetattr(slave, termios.TCSANOW, original)
        os.close(slave)
        os.close(master)


def recovery(backend, engine, env):
    command = ("npm", "run", "auth:recover-admin")
    first = ("Contraseña: ".encode(), SECRET + b"\r")
    confirm = ("Confirma la contraseña: ".encode(), SECRET + b"\r")
    prompts = [first, confirm]
    failure = b"No se pudo recuperar"
    non_tty = subprocess.run(command, cwd=backend, env=env, input=SECRET, capture_output=True, timeout=12)
    assert non_tty.returncode == 1 and b"terminal interactiva" in non_tty.stderr
    assert SECRET not in non_tty.stdout + non_tty.stderr
    for key in (b"\x03", b"\x04"):
        interactive(backend, env, [(first[0], key)], b"cancelada", 130, command)
    interactive(backend, env, [first, (confirm[0], OTHER + b"\r")], b"no coinciden", 1, command)
    interactive(backend, env, [], b"sin argumentos.", 1, (*command, "--", "fixture-argument"))
    if engine == "postgres":
        owner = env.pop("BRIXA_TEST_BOOTSTRAP_OWNER_URL")
        interactive(backend, env, prompts, failure, 1, command)
        interactive(backend, {**env, "MIGRATION_DATABASE_URL": env["DATABASE_URL"]}, prompts, failure, 1, command)
        interactive(backend, {**env, "MIGRATION_DATABASE_URL": owner}, prompts, b"recuperada.", 0, command)
    else:
        with tempfile.TemporaryDirectory(prefix="brixa-recovery-tty-") as directory:
            env["DATABASE_URL"] = "file:" + str(Path(directory) / "auth.db")
            migration = (
                ("node", "--import", "tsx", "src/db/migrate.ts")
                if (backend / "src/db/migrate.ts").exists()
                else ("npm", "run", "db:migrate")
            )
            subprocess.run(migration, cwd=backend, env=env, check=True, timeout=20)
            interactive(backend, env, prompts, failure, 1, command)
            interactive(
                backend, env, [(b"Email: ", EMAIL), first, confirm],
                b"Administrador inicial creado.", 0,
            )
            alternate = [(first[0], OTHER + b"\r"), (confirm[0], OTHER + b"\r")]
            interactive(backend, env, alternate, b"recuperada.", 0, command)
    print(f"{engine} PTY: recuperación, confirmación exacta, cancelación y terminal restaurada")


def main():
    backend, engine = Path(sys.argv[1]), sys.argv[2]
    env = {**os.environ}
    env.pop("MIGRATION_DATABASE_URL", None)
    env.pop("POSTGRES_PASSWORD", None)
    if sys.argv[3:] == ["recover"]:
        recovery(backend, engine, env)
        return
    prompts = [
        (b"Email: ", EMAIL),
        ("Contraseña: ".encode(), SECRET + b"\r"),
        ("Confirma la contraseña: ".encode(), SECRET + b"\r"),
    ]
    non_tty = subprocess.run(
        COMMAND, cwd=backend, env=env, input=EMAIL + SECRET, capture_output=True, timeout=12,
    )
    assert non_tty.returncode == 1 and b"terminal interactiva" in non_tty.stderr
    assert OTHER not in non_tty.stdout + non_tty.stderr
    if engine == "postgres":
        fixture_url = env.pop("BRIXA_TEST_BOOTSTRAP_OWNER_URL", None)
        runtime_url = env.get("DATABASE_URL")
        env["DATABASE_URL"] = f"postgres://app_exec:{URL_SECRET}@localhost:1/test"
        failure = b"No se pudo completar el bootstrap."
        interactive(backend, env, prompts, failure, 1)
        env["MIGRATION_DATABASE_URL"] = env["DATABASE_URL"]
        interactive(backend, env, prompts, failure, 1)
        print("PostgreSQL PTY: URL privilegiada ausente y credencial runtime rechazada")
        if fixture_url:
            assert runtime_url
            env["DATABASE_URL"] = runtime_url
            env["MIGRATION_DATABASE_URL"] = fixture_url
            interactive(backend, env, prompts, b"Administrador inicial creado.", 0)
            interactive(backend, env, prompts, b"ya est", 1)
            print("PostgreSQL PTY: alta y reintento con conexión privilegiada aislada")
        return
    assert engine == "sqlite"
    with tempfile.TemporaryDirectory(prefix="brixa-tty-") as directory:
        env["DATABASE_URL"] = "file:" + str(Path(directory) / "auth.db")
        migration = (
            ("node", "--import", "tsx", "src/db/migrate.ts")
            if (backend / "src/db/migrate.ts").exists()
            else ("npm", "run", "db:migrate")
        )
        subprocess.run(migration, cwd=backend, env=env, check=True, timeout=20)
        for key in (b"\x03", b"\x04"):
            interactive(backend, env, prompts[:1] + [(prompts[1][0], key)], b"Bootstrap cancelado.", 130)
        interactive(
            backend, env, prompts[:2] + [(prompts[2][0], OTHER + b"\r")],
            b"no coinciden", 1,
        )
        invalid = [(prompts[0][0], b"bad-email\r"), *prompts[1:]]
        interactive(backend, env, invalid, b"Introduce un email", 1)
        interactive(backend, env, prompts, b"Administrador inicial creado.", 0)
        interactive(backend, env, prompts, b"ya est", 1)
        interactive(backend, {**env, "DATABASE_URL": ":memory:"}, prompts, b"No se pudo completar", 1)
    print("SQLite PTY: entrada oculta, terminal restaurada, cancelación, validación, éxito y reintento")


if __name__ == "__main__":
    main()
