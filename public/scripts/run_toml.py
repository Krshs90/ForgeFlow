#!/usr/bin/env python3
"""
Run a .toml "command playlist" like:

cmds = [
  "mkdir -p auto;",
  "PROJECT_NAME_1=\"repo\";",
  "cd auto/$PROJECT_NAME_1;",
  "cat > file << EOF\n...\nEOF",
]

Key design choice:
- We run ALL cmds in ONE shell session so variables (PROJECT_NAME_1) and `cd` persist.

Usage:
  python run_toml.py path/to/file.toml
  python run_toml.py path/to/file.toml --dry-run
  python run_toml.py path/to/file.toml --shell bash
  python run_toml.py path/to/file.toml --shell pwsh
"""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# tomllib is built-in in Python 3.11+. If you're on 3.10 or older, install tomli.
try:
    import tomllib  # pyright: ignore[reportMissingImports]
except ModuleNotFoundError:  # pragma: no cover
    try:
        import tomli as tomllib  # type: ignore
    except ModuleNotFoundError:
        print("ERROR: Need Python 3.11+ (tomllib) or install 'tomli' for older Python.", file=sys.stderr)
        sys.exit(2)


def load_toml(path: Path) -> dict:
    raw = path.read_bytes()
    return tomllib.loads(raw.decode("utf-8"))


def normalize_cmds(doc: dict) -> list[str]:
    """
    Supports:
      cmds = ["...", "..."]
    (Optional future extension: cmds = [{cmd="...", cwd="..."}])
    """
    if "cmds" not in doc:
        raise ValueError("TOML must contain a top-level 'cmds' key (array of strings).")

    cmds = doc["cmds"]
    if not isinstance(cmds, list) or not all(isinstance(x, str) for x in cmds):
        raise ValueError("'cmds' must be an array/list of strings.")

    # Keep order, preserve embedded newlines (heredocs etc.)
    return [c.rstrip() for c in cmds if c.strip() != ""]


def detect_default_shell() -> str:
    # Your sample is clearly bash-style (mkdir -p, heredoc, $VAR), so default to bash when possible.
    if shutil.which("bash"):
        return "bash"
    if os.name == "nt":
        # On Windows, user may have pwsh but that won't run bash syntax.
        # Still, we fall back to pwsh ONLY if bash is missing and user explicitly wants it.
        if shutil.which("pwsh"):
            return "pwsh"
        if shutil.which("powershell"):
            return "powershell"
    return "sh" if shutil.which("sh") else ""


def run_in_bash(script_text: str, stop_on_error: bool) -> int:
    bash = shutil.which("bash")
    if not bash:
        print(
            "ERROR: 'bash' not found. Install Git Bash or use WSL (Windows) or run on macOS/Linux.",
            file=sys.stderr,
        )
        return 2

    # Write a temporary bash script so we don't fight quoting/escaping.
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".sh", encoding="utf-8", newline="\n") as f:
        script_path = f.name
        f.write("#!/usr/bin/env bash\n")
        # Strict-ish mode; allow user to opt out of stop-on-error by not using `set -e`.
        f.write("set -u\n")  # undefined vars are errors (helps catch typos)
        if stop_on_error:
            f.write("set -e\n")
        f.write("\n")
        f.write(script_text)
        f.write("\n")

    try:
        # Use bash directly; state is kept inside the script.
        proc = subprocess.run([bash, script_path], text=True)
        return proc.returncode
    finally:
        try:
            os.remove(script_path)
        except OSError:
            pass


def run_in_pwsh(script_text: str, stop_on_error: bool) -> int:
    pwsh = shutil.which("pwsh") or shutil.which("powershell")
    if not pwsh:
        print("ERROR: PowerShell not found ('pwsh' or 'powershell').", file=sys.stderr)
        return 2

    # PowerShell script file
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".ps1", encoding="utf-8", newline="\n") as f:
        script_path = f.name
        if stop_on_error:
            f.write("$ErrorActionPreference = 'Stop'\n")
        f.write(script_text)
        f.write("\n")

    try:
        proc = subprocess.run([pwsh, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script_path], text=True)
        return proc.returncode
    finally:
        try:
            os.remove(script_path)
        except OSError:
            pass


def build_script_from_cmds(cmds: list[str], shell: str) -> str:
    if shell in ("bash", "sh"):
        # Join commands with newlines so heredocs work naturally.
        # Keep comments; bash will ignore lines starting with #.
        return "\n".join(cmds)
    elif shell in ("pwsh", "powershell"):
        # For PowerShell, TOML would need PowerShell syntax commands.
        return "\n".join(cmds)
    else:
        raise ValueError(f"Unsupported shell: {shell}")


LOG_FILE = Path(os.path.expanduser("~")) / "Downloads" / "processed" / "run_toml_output.txt"


class TeeWriter:
    """Write to both stdout and a log file simultaneously."""
    def __init__(self, log_path: Path):
        log_path.parent.mkdir(parents=True, exist_ok=True)
        self._file = open(log_path, "w", encoding="utf-8")
        self._stdout = sys.stdout

    def write(self, text: str) -> int:
        self._stdout.write(text)
        self._file.write(text)
        self._file.flush()
        return len(text)

    def flush(self) -> None:
        self._stdout.flush()
        self._file.flush()

    def close(self) -> None:
        self._file.close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("toml_file", help="Path to the .toml file containing cmds=[...]")
    ap.add_argument("--shell", choices=["bash", "sh", "pwsh", "powershell"], default=None, help="Shell to run in")
    ap.add_argument("--dry-run", action="store_true", help="Print commands but do not execute")
    ap.add_argument("--continue-on-error", action="store_true", help="Do not stop on first failing command")
    args = ap.parse_args()

    # Set up tee logging to both console and log file
    tee = TeeWriter(LOG_FILE)
    sys.stdout = tee  # type: ignore

    toml_path = Path(args.toml_file).expanduser().resolve()
    if not toml_path.exists():
        print(f"ERROR: File not found: {toml_path}")
        tee.close()
        return 2

    try:
        doc = load_toml(toml_path)
        cmds = normalize_cmds(doc)
    except Exception as e:
        print(f"ERROR: Failed to parse TOML: {e}")
        tee.close()
        return 2

    shell = args.shell or detect_default_shell()
    if not shell:
        print("ERROR: Could not detect any usable shell on this system.")
        tee.close()
        return 2

    script_text = build_script_from_cmds(cmds, shell)

    if args.dry_run:
        print(f"--- DRY RUN ({shell}) ---")
        print(script_text)
        tee.close()
        return 0

    stop_on_error = not args.continue_on_error

    print(f"Running {len(cmds)} command(s) from: {toml_path.name}")
    print(f"Shell: {shell} | OS: {platform.system()} {platform.release()}")
    print("----")

    if shell in ("bash", "sh"):
        rc = run_in_bash(script_text, stop_on_error=stop_on_error)
    else:
        rc = run_in_pwsh(script_text, stop_on_error=stop_on_error)

    print("")
    print("=" * 50)
    if rc == 0:
        print(f"SUCCESS: All {len(cmds)} command(s) from '{toml_path.name}' executed successfully!")
    else:
        print(f"FAILED: Script '{toml_path.name}' exited with error code {rc}.")
    print(f"Shell: {shell} | OS: {platform.system()} {platform.release()}")
    print(f"Log saved to: {LOG_FILE}")
    print("=" * 50)

    tee.close()
    return rc


if __name__ == "__main__":
    raise SystemExit(main())

print("Script finished successfully!")